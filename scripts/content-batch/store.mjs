import { createHash, randomUUID } from "node:crypto";
import { readdir, readFile, writeFile, mkdir, unlink, lstat, realpath } from "node:fs/promises";
import { renameSync, writeFileSync } from "node:fs";
import { thumbnailPath, thumbnailWidths } from "../media/paths.mjs";
import path from "node:path";
import matter from "gray-matter";
import { withContentLock } from "../content-order/lock.mjs";
import { uploadPositions } from "./upload-order.mjs";
import { createOrderStore } from "../content-order/store.mjs";

const formats = { photos: ".json", projects: ".md", articles: ".md" };
const conflict = () => Object.assign(new Error("内容已在其他页面修改，请刷新列表后重新选择。"), { status: 409 });

export function createBatchStore(root) {
  async function read(collection) {
    const extension = formats[collection];
    if (!extension) throw new Error("这个栏目不支持批量操作。");
    const folder = path.join(root, "src/content", collection);
    const names = (await readdir(folder, { withFileTypes: true }))
      .filter(file => file.isFile() && file.name.endsWith(extension)).map(file => file.name).sort();
    const files = await Promise.all(names.map(async name => {
      const filepath = path.join(folder, name);
      const raw = await readFile(filepath, "utf8");
      const data = extension === ".json" ? JSON.parse(raw) : matter(raw).data;
      if (data.draft !== undefined && typeof data.draft !== "boolean") throw new Error(`发布状态无效：${name}`);
      return { filepath, raw, data, slug: name.slice(0, -extension.length) };
    }));
    const hash = createHash("sha256");
    for (const file of files) hash.update(JSON.stringify([file.slug, file.raw]));
    return { files, version: hash.digest("hex") };
  }

  const publicSnapshot = async (snapshot, collection) => {
    const positions = await uploadPositions(root, collection, snapshot.files);
    return { version: snapshot.version,
      entries: snapshot.files.map(file => ({ slug: file.slug, draft: Boolean(file.data.draft), uploadOrder: positions.get(file.slug) })) };
  };

  function patchDraft(file, draft) {
    if (file.filepath.endsWith(".json")) {
      const matches = [...file.raw.matchAll(/("draft"\s*:\s*)(true|false)/g)];
      if (matches.length === 1) return file.raw.replace(/("draft"\s*:\s*)(true|false)/, `$1${draft}`);
      if (matches.length) throw new Error(`发布状态字段重复：${file.slug}`);
      return `${JSON.stringify({ ...file.data, draft }, null, 2)}\n`;
    }
    const frontmatter = file.raw.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
    if (!frontmatter) throw new Error(`无法读取内容字段：${file.slug}`);
    const matches = [...frontmatter[1].matchAll(/^(draft:[ \t]*)(true|false)([ \t]*(?:#.*)?\r?)$/gm)];
    if (matches.length > 1) throw new Error(`发布状态字段重复：${file.slug}`);
    const eol = file.raw.includes("\r\n") ? "\r\n" : "\n";
    const updated = matches.length ? frontmatter[0].replace(/^(draft:[ \t]*)(true|false)([ \t]*(?:#.*)?\r?)$/m,
      (_, prefix, _value, suffix) => `${prefix}${draft}${suffix}`)
      : frontmatter[0].replace(/^---\r?\n/, `---${eol}draft: ${draft}${eol}`);
    return updated + file.raw.slice(frontmatter[0].length);
  }

  async function saveStatus(collection, snapshot, selected, draft) {
    const changes = selected.filter(file => Boolean(file.data.draft) !== draft)
      .map(file => ({ ...file, after: patchDraft(file, draft), temp: `${file.filepath}.batch-${randomUUID()}.tmp` }));
    const staged = [], committed = [];
    try {
      for (const file of changes) { await writeFile(file.temp, file.after, { flag: "wx" }); staged.push(file); }
      if ((await read(collection)).version !== snapshot.version) throw conflict();
      for (const file of staged) { renameSync(file.temp, file.filepath); committed.push(file); }
    } catch (error) {
      for (const file of committed) writeFileSync(file.filepath, file.raw);
      throw error;
    } finally {
      await Promise.all(staged.map(file => unlink(file.temp).catch(error => { if (error.code !== "ENOENT") throw error; })));
    }
  }

  async function deleteFiles(collection, snapshot, selected) {
    const selectedPaths = new Set(selected.map(file => file.filepath));
    const keys = new Set(selected.map(file => file.slug));
    const all = (await Promise.all(Object.keys(formats).map(async name => {
      try { return (await read(name)).files; } catch (error) { if (error.code === "ENOENT") return []; throw error; }
    }))).flat();
    const remaining = all.filter(file => !selectedPaths.has(file.filepath));
    const relation = collection === "projects" ? "relatedProjects" : collection === "articles" ? "relatedArticles" : null;
    if (relation) {
      const referencing = remaining.find(file => file.data[relation]?.some(key => keys.has(key)));
      if (referencing) throw new Error(`「${referencing.data.title ?? referencing.slug}」仍引用所选内容，请先移除关联再删除。`);
    }
    const paths = new Set(selectedPaths);
    // Photo assets must leave public/ with their last record, or the photo audit
    // would reject orphan files. Shared images remain available to other content.
    if (collection === "photos") for (const file of selected) {
      const src = file.data.src;
      if (!src || remaining.some(other => other.raw.includes(src))) continue;
      if (!/^\/(?:media\/photos|assets\/figma-v03\/photos)\//.test(src)) throw new Error(`照片资产路径无效：${file.slug}`);
      const absolute = path.resolve(root, "public", `.${src}`);
      const publicRoot = path.join(root, "public");
      if (!["media/photos", "assets/figma-v03/photos"].some(directory => absolute.startsWith(`${path.join(publicRoot, directory)}${path.sep}`))) {
        throw new Error("照片资产路径超出摄影目录。");
      }
      try {
        const info = await lstat(absolute);
        const expected = path.join(await realpath(publicRoot), path.relative(publicRoot, absolute));
        if (!info.isFile() || info.isSymbolicLink() || await realpath(absolute) !== expected) throw new Error("照片资产不是普通本地文件。");
        paths.add(absolute);
        if (src.startsWith("/media/photos/")) for (const width of thumbnailWidths) {
          const preview = path.join(root, "public", thumbnailPath(src, width));
          try {
            const previewInfo = await lstat(preview);
            const expectedPreview = path.join(await realpath(publicRoot), path.relative(publicRoot, preview));
            if (!previewInfo.isFile() || previewInfo.isSymbolicLink() || await realpath(preview) !== expectedPreview) throw new Error("照片预览不是普通本地文件。");
            paths.add(preview);
          } catch (error) { if (error.code !== "ENOENT") throw error; }
        }
      } catch (error) { if (error.code !== "ENOENT") throw error; }
    }
    const backup = path.join(root, "private/content-trash", randomUUID());
    const moves = [];
    for (const source of paths) {
      const target = path.join(backup, path.relative(root, source));
      await mkdir(path.dirname(target), { recursive: true });
      moves.push({ source, target });
    }
    if ((await read(collection)).version !== snapshot.version) throw conflict();
    const committed = [];
    try {
      for (const move of moves) { renameSync(move.source, move.target); committed.push(move); }
    } catch (error) {
      for (const move of committed.reverse()) renameSync(move.target, move.source);
      throw error;
    }
  }

  return {
    async snapshot(collection) { return publicSnapshot(await read(collection), collection); },
    async apply(collection, request) {
      const result = await withContentLock(root, collection, async () => {
        const snapshot = await read(collection);
        if (request.version !== snapshot.version) throw conflict();
        if (!["publish", "draft", "delete"].includes(request.action)) throw new Error("批量操作无效。");
        if (!Array.isArray(request.keys) || !request.keys.length || new Set(request.keys).size !== request.keys.length
          || request.keys.some(key => !snapshot.files.some(file => file.slug === key))) throw new Error("所选内容已失效，请重新选择。");
        const selected = snapshot.files.filter(file => request.keys.includes(file.slug));
        if (request.action === "delete") await deleteFiles(collection, snapshot, selected);
        else await saveStatus(collection, snapshot, selected, request.action === "draft");
        return { ...await publicSnapshot(await read(collection), collection), affected: selected.length };
      });
      if (request.action === "delete") {
        await createOrderStore(root).normalize(collection);
        return { ...await publicSnapshot(await read(collection), collection), affected: result.affected };
      }
      return result;
    },
  };
}
