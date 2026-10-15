import { createHash, randomUUID } from "node:crypto";
import { readdir, readFile, writeFile, unlink } from "node:fs/promises";
import { renameSync, writeFileSync } from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import { moveEntries } from "../../src/admin/collection-order.js";
import { withContentLock } from "./lock.mjs";
import { renamedPhotoReferences } from "../photos/component-references.mjs";

const formats = { projects: ".md", photos: ".json", articles: ".md" };
const conflict = () => Object.assign(new Error("内容已在其他页面修改，请刷新列表后重试。"), { status: 409 });

export function createOrderStore(root) {

  async function read(collection) {
    const extension = formats[collection];
    if (!extension) throw new Error("这个栏目不支持手动排序。");
    const folder = path.join(root, "src/content", collection);
    const names = (await readdir(folder, { withFileTypes: true }))
      .filter((file) => file.isFile() && file.name.endsWith(extension)).map((file) => file.name).sort();
    const files = await Promise.all(names.map(async (name) => {
      const filepath = path.join(folder, name);
      const raw = await readFile(filepath, "utf8");
      const data = extension === ".json" ? JSON.parse(raw) : matter(raw).data;
      if (collection === "articles" && data.order === undefined) data.order = 0;
      if (!Number.isSafeInteger(data.order) || data.order < (collection === "photos" ? 1 : 0)) {
        throw new Error(`展示顺序无效：${name}。请先在编辑页填写有效数字。`);
      }
      return { filepath, raw, slug: name.slice(0, -extension.length), order: data.order,
        publishedAt: data.publishedAt ? new Date(data.publishedAt).getTime() : 0 };
    }));
    const hash = createHash("sha256");
    for (const file of files) hash.update(JSON.stringify([file.slug, file.raw]));
    const entries = files.map(({ slug, order, publishedAt }) => ({ slug, order, publishedAt }))
      .sort((a, b) => a.order - b.order || b.publishedAt - a.publishedAt || a.slug.localeCompare(b.slug));
    return { files, entries, version: hash.digest("hex") };
  }

  function patchOrder(file, order) {
    if (file.filepath.endsWith(".json")) {
      const matches = [...file.raw.matchAll(/("order"\s*:\s*)(\d+)(?=\s*[,}])/g)];
      if (matches.length !== 1 || Number(matches[0][2]) !== file.order) throw new Error(`无法更新展示顺序：${file.slug}`);
      return file.raw.replace(/("order"\s*:\s*)(\d+)(?=\s*[,}])/, (_, prefix) => `${prefix}${order}`);
    }
    const frontmatter = file.raw.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
    const matches = [...(frontmatter?.[1] ?? "").matchAll(/^(order:[ \t]*)(\d+)([ \t]*(?:#.*)?\r?)$/gm)];
    if (frontmatter && matches.length === 0 && file.order === 0 && !/^order:/m.test(frontmatter[1])) {
      const eol = file.raw.includes("\r\n") ? "\r\n" : "\n";
      return frontmatter[0].replace(/^---\r?\n/, `---${eol}order: ${order}${eol}`) + file.raw.slice(frontmatter[0].length);
    }
    if (matches.length !== 1 || Number(matches[0][2]) !== file.order) throw new Error(`无法更新展示顺序：${file.slug}`);
    const updated = frontmatter[0].replace(/^(order:[ \t]*)(\d+)([ \t]*(?:#.*)?\r?)$/m,
      (_, prefix, _value, suffix) => `${prefix}${order}${suffix}`);
    return updated + file.raw.slice(frontmatter[0].length);
  }

  async function persist(collection, snapshot, changes) {
    const staged = [];
    const renamed = [];
    try {
      for (const change of changes) {
        const temp = `${change.filepath}.reorder-${randomUUID()}.tmp`;
        await writeFile(temp, change.after, { flag: "wx" });
        staged.push({ ...change, temp });
      }
      if ((await read(collection)).version !== snapshot.version) throw conflict();
      // Publish the prepared files in one event-loop turn. The dev watcher sees
      // the finished numbering, without half of a multi-file reorder.
      for (const change of staged) {
        renameSync(change.temp, change.filepath);
        renamed.push(change);
      }
    } catch (error) {
      for (const change of renamed) writeFileSync(change.filepath, change.before);
      throw error;
    } finally {
      await Promise.all(staged.map((change) => unlink(change.temp).catch((error) => {
        if (error.code !== "ENOENT") throw error;
      })));
    }
  }

  const publicSnapshot = ({ entries, version }) => ({ entries, version });
  async function mutate(collection, run) {
    return withContentLock(root, collection, run);
  }

  return {
    async normalize(collection) {
      return mutate(collection, async () => {
        const snapshot = await read(collection);
        const orders = new Map(snapshot.entries.map((entry, index) => [entry.slug, index + 1]));
        const changes = snapshot.files.filter(file => file.order !== orders.get(file.slug))
          .map(file => ({ filepath: file.filepath, before: file.raw, after: patchOrder(file, orders.get(file.slug)) }));
        if (changes.length) await persist(collection, snapshot, changes);
        return publicSnapshot(await read(collection));
      });
    },
    // Include every affected position in the native CMS save, so its returned
    // tree contains the final file hashes rather than a stale pre-reorder tree.
    async update(updates, save) {
      const collectionOf = value => typeof value === "string" ? value.match(/^src\/content\/(projects|photos|articles)\/[^/]+\.(md|json)$/)?.[1] : undefined;
      if (!Array.isArray(updates?.additions) || !Array.isArray(updates?.deletions)) return save(updates);
      const touched = [...new Set([...updates.additions, ...updates.deletions].map(file => collectionOf(file?.path)).filter(Boolean))].sort();
      const locks = [...touched];
      if (touched.includes("photos") || [...updates.additions, ...updates.deletions].some(file =>
        /^src\/data\/photo-components\/(home-fan|home-drag|text-hover)\.json$/.test(file?.path))) locks.push("photo-components");
      locks.sort();
      const run = async () => {
        const additions = new Map(updates.additions.map(file => [file.path, file]));
        const deleted = new Set(updates.deletions.map(file => file.path));
        for (const collection of touched) {
          const snapshot = await read(collection);
          const originals = new Map(snapshot.files.map(file => [path.relative(root, file.filepath), file]));
          if (collection === "photos") for (const change of await renamedPhotoReferences(root, updates, originals)) additions.set(change.path, change);
          const files = new Map([...originals].filter(([name]) => !deleted.has(name)));
          let ordered = snapshot.entries.map(entry => `src/content/${collection}/${entry.slug}${formats[collection]}`).filter(name => files.has(name));
          for (const addition of updates.additions.filter(file => collectionOf(file.path) === collection)) {
            if (typeof addition.contents !== "string") throw new Error("内容无效。");
            const raw = Buffer.from(addition.contents, "base64url").toString("utf8");
            const order = (formats[collection] === ".json" ? JSON.parse(raw) : matter(raw).data).order;
            if (!Number.isSafeInteger(order) || order < 1) throw new Error("展示位置必须是从 1 开始的整数。");
            const original = originals.get(addition.path);
            files.set(addition.path, { filepath: path.join(root, addition.path), raw, order, slug: addition.path });
            if (!ordered.includes(addition.path)) ordered.push(addition.path);
            else if (original && order !== original.order) {
              ordered = ordered.filter(name => name !== addition.path);
              ordered.splice(Math.min(order - 1, ordered.length), 0, addition.path);
            }
          }
          ordered.forEach((name, index) => {
            const file = files.get(name);
            if (file.order !== index + 1) additions.set(name, {
              path: name, contents: Buffer.from(patchOrder(file, index + 1)).toString("base64url"),
            });
          });
        }
        return save({ ...updates, additions: [...additions.values()] });
      };
      // Match lock order for saves that touch more than one collection.
      const locked = index => index === locks.length ? run() : mutate(locks[index], () => locked(index + 1));
      return locked(0);
    },
    async snapshot(collection) {
      return publicSnapshot(await read(collection));
    },
    async reorder(collection, request) {
      return mutate(collection, async () => {
        const snapshot = await read(collection);
        if (request.version !== snapshot.version) throw conflict();
        if (!Array.isArray(request.keys) || !request.target) throw new Error("排序请求不完整。");
        const moved = moveEntries(snapshot.entries, request.keys, request.target);
        if (moved.every((entry, index) => entry.slug === snapshot.entries[index].slug)) return publicSnapshot(snapshot);
        const orders = new Map(moved.map((entry, index) => [entry.slug, index + 1]));
        const changes = snapshot.files.filter((file) => file.order !== orders.get(file.slug))
          .map((file) => ({ filepath: file.filepath, before: file.raw, after: patchOrder(file, orders.get(file.slug)) }));
        await persist(collection, snapshot, changes);
        return publicSnapshot(await read(collection));
      });
    },
  };
}
