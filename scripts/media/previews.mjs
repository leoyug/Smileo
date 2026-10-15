import { readFile, writeFile, mkdir, access } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import { createHash } from 'node:crypto';
import { thumbnailPath, thumbnailWidths } from './paths.mjs';

export async function preparePhotoPreviews(root, photos) {
  const cacheFile = path.join(root, 'private/cms/media-previews.json');
  let cache = {};
  try { cache = JSON.parse(await readFile(cacheFile, 'utf8')); }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
  const next = {};
  for (const photo of photos) {
    if (photo.draft || !photo.src?.startsWith('/media/photos/')) continue;
    const source = path.join(root, 'public', photo.src);
    const hash = createHash('sha256').update(await readFile(source)).update(`preview-v1:${sharp.versions.sharp}`).digest('hex');
    for (const width of thumbnailWidths) {
      const local = thumbnailPath(photo.src, width);
      const target = path.join(root, 'public', local);
      let exists = true;
      try { await access(target); } catch (error) { if (error.code !== 'ENOENT') throw error; exists = false; }
      if (cache[local] !== hash || !exists) await sharp(source).rotate().resize({ width, withoutEnlargement: true }).webp({ quality: 80 }).toFile(target);
      next[local] = hash;
    }
  }
  if (JSON.stringify(cache) !== JSON.stringify(next)) {
    await mkdir(path.dirname(cacheFile), { recursive: true });
    await writeFile(cacheFile, `${JSON.stringify(next, null, 2)}\n`);
  }
}
