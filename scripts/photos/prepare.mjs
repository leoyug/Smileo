import { readFile, readdir, stat, writeFile, unlink } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { readPublicPhotoMetadata } from "../import/photo-metadata.mjs";
import { preparePhotoPreviews } from "../media/previews.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const contentDirectory = path.join(root, "src/content/photos");
const publicDirectory = path.join(root, "public");
let running;
let queued = false;

export function preparePhotos() {
  if (running) {
    queued = true;
    return running;
  }
  running = (async () => {
    do {
      queued = false;
      await prepare();
    } while (queued);
  })().finally(() => { running = undefined; });
  return running;
}

async function prepare() {
  const photos = [];
  for (const name of (await readdir(contentDirectory)).filter((name) => name.endsWith(".json"))) {
    const recordPath = path.join(contentDirectory, name);
    const photo = JSON.parse(await readFile(recordPath, "utf8"));
    if (!photo.src?.startsWith("/media/photos/")) continue;
    const source = path.resolve(publicDirectory, `.${photo.src}`);
    if (!source.startsWith(`${path.join(publicDirectory, "media/photos")}${path.sep}`)) throw new Error(`${name}: 图片路径无效`);
    let metadata;
    let file;
    try {
      [metadata, file] = await Promise.all([sharp(source).metadata(), stat(source)]);
    } catch (error) {
      if (photo.draft) continue;
      throw error;
    }
    if (!metadata.width || !metadata.height || metadata.width === metadata.height) throw new Error(`${name}: 暂不支持正方形照片`);
    const needsProcessing = Math.max(metadata.width, metadata.height) > 2400 || file.size > 2_000_000 || Boolean(metadata.exif?.length || metadata.xmp?.length);
    let extractedMetadata = {};
    if (needsProcessing) {
      if (photo.draft) {
        try { extractedMetadata = await readPublicPhotoMetadata(source); }
        catch { console.warn(`${name}: 拍摄信息读取失败，请在后台手动补充。`); }
      }
      const target = source.replace(/\.[^.]+$/, ".webp");
      let output;
      for (const quality of [84, 76, 68, 60]) {
        output = await sharp(source).rotate().resize({ width: 2400, height: 2400, fit: "inside", withoutEnlargement: true }).webp({ quality }).toBuffer();
        if (output.length <= 2_000_000) break;
      }
      if (!output || output.length > 2_000_000) throw new Error(`${name}: 照片压缩后仍超过 2 MB`);
      await writeFile(target, output);
      if (target !== source) await unlink(source);
      photo.src = `/${path.relative(publicDirectory, target).split(path.sep).join("/")}`;
      metadata = await sharp(target).metadata();
    }
    let changed = needsProcessing;
    if (Object.keys(extractedMetadata).length) {
      const existing = photo.publicMetadata && typeof photo.publicMetadata === "object" ? photo.publicMetadata : {};
      const filled = Object.fromEntries(Object.entries(existing).filter(([, value]) => value != null && value !== ""));
      const merged = { ...extractedMetadata, ...filled };
      if (JSON.stringify(merged) !== JSON.stringify(existing)) {
        photo.publicMetadata = merged;
        changed = true;
      }
    }
    const orientation = metadata.height > metadata.width ? "portrait" : "landscape";
    const updates = { width: metadata.width, height: metadata.height, orientation, size: orientation === "portrait" ? "tall" : "short" };
    for (const [key, value] of Object.entries(updates)) {
      if (photo[key] !== value) { photo[key] = value; changed = true; }
    }
    if (photo.publicMetadata) {
      for (const [key, value] of Object.entries(photo.publicMetadata)) {
        if (value == null || value === "") { delete photo.publicMetadata[key]; changed = true; }
      }
    }
    if (changed) {
      await writeFile(recordPath, `${JSON.stringify(photo, null, 2)}\n`);
      console.log(`已准备照片：${name}`);
    }
    photos.push(photo);
  }
  await preparePhotoPreviews(root, photos);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  preparePhotos().catch((error) => { console.error(error); process.exitCode = 1; });
}
