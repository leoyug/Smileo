import { readFile, readdir, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { exiftool } from "exiftool-vendored";
import sharp from "sharp";
import { thumbnailPath, thumbnailWidths } from "../media/paths.mjs";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const publicRoot = path.join(projectRoot, "public");
const contentRoot = path.join(projectRoot, "src/content/photos");
const photoDirectories = ["assets/figma-v03/photos", "media/photos"];

type PhotoRecord = {
  src: string;
  alt: string;
  order: number;
  width: number;
  height: number;
  draft?: boolean;
};

async function listFiles(directory: string): Promise<string[]> {
  try {
    const entries = await readdir(directory, { withFileTypes: true });
    return (await Promise.all(entries.map(async (entry) => {
      const file = path.join(directory, entry.name);
      return entry.isDirectory() ? listFiles(file) : [file];
    }))).flat();
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }
}

async function auditPhotos() {
  const errors: string[] = [];
  const orders = new Set<number>();
  const referenced = new Set<string>();
  const records = (await readdir(contentRoot)).filter((name) => name.endsWith(".json"));
  let published = 0;

  for (const name of records) {
    const photo = JSON.parse(await readFile(path.join(contentRoot, name), "utf8")) as PhotoRecord;
    if (!photo.draft) {
      published++;
      if (!photo.alt?.trim()) errors.push(`${name}: 缺少替代文本`);
      if (!Number.isInteger(photo.order) || photo.order < 1 || orders.has(photo.order)) errors.push(`${name}: 展示顺序无效或重复`);
      orders.add(photo.order);
    }
    if (!photo.src?.startsWith("/")) {
      errors.push(`${name}: 资产路径必须以 / 开头`);
      continue;
    }

    const absolute = path.resolve(publicRoot, `.${photo.src}`);
    if (!absolute.startsWith(`${publicRoot}${path.sep}`)) {
      errors.push(`${name}: 资产路径超出 public/`);
      continue;
    }
    referenced.add(absolute);
    if (photo.src.startsWith("/media/photos/")) {
      for (const width of thumbnailWidths) {
        const preview = path.join(publicRoot, thumbnailPath(photo.src, width));
        referenced.add(preview);
        if (photo.draft) continue;
        try {
          const [file, metadata, tags] = await Promise.all([stat(preview), sharp(preview).metadata(), exiftool.read(preview)]);
          const expectedWidth = Math.min(width, photo.width);
          const expectedHeight = Math.round(photo.height * expectedWidth / photo.width);
          if (metadata.format !== "webp" || metadata.width !== expectedWidth || metadata.height !== expectedHeight) errors.push(`${name}: ${width}px 预览格式或尺寸不正确`);
          if (file.size > 2_000_000 || metadata.exif?.length || metadata.xmp?.length) errors.push(`${name}: ${width}px 预览超过大小限制或含元数据`);
          if (Object.keys(tags).some(key => key !== "ProfileCopyright" && /(gps|latitude|longitude|altitude|serialnumber|ownername|artist|copyright)/i.test(key))) errors.push(`${name}: ${width}px 预览含敏感元数据`);
        } catch (error) { errors.push(`${name}: ${width}px 预览无法读取：${error instanceof Error ? error.message : error}`); }
      }
    }
    try {
      const [file, metadata] = await Promise.all([stat(absolute), sharp(absolute).metadata()]);
      if (file.size > 2_000_000) errors.push(`${name}: 发布资产超过 2 MB`);
      if (metadata.width !== photo.width || metadata.height !== photo.height) errors.push(`${name}: 尺寸与内容记录不一致`);
      if (Math.max(photo.width, photo.height) > 2400) errors.push(`${name}: 最长边超过 2400px`);
      if (metadata.exif?.length || metadata.xmp?.length) errors.push(`${name}: 发布资产仍含 EXIF 或 XMP 元数据`);
      const tags = await exiftool.read(absolute);
      const sensitive = Object.keys(tags).filter((key) => key !== "ProfileCopyright" && /(gps|latitude|longitude|altitude|serialnumber|ownername|artist|copyright)/i.test(key));
      if (sensitive.length) errors.push(`${name}: 发布资产仍含敏感元数据字段 ${sensitive.join("、")}`);
    } catch (error) {
      errors.push(`${name}: ${error instanceof Error ? error.message : "无法读取发布资产"}`);
    }
  }

  for (const directory of photoDirectories) {
    for (const file of await listFiles(path.join(publicRoot, directory))) {
      if (!referenced.has(file)) errors.push(`发现未被照片内容引用的公开文件：${path.relative(publicRoot, file)}`);
    }
  }

  await exiftool.end();
  if (errors.length) throw new Error(`照片审计失败：\n- ${errors.join("\n- ")}`);
  console.log(`照片审计通过：${published} 张已发布照片，${referenced.size} 个照片资产。`);
}

auditPhotos().catch((error) => {
  void exiftool.end();
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
