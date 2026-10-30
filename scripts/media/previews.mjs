import { readFile, writeFile, mkdir, access, readdir, rm } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import { createHash } from 'node:crypto';
import { contentPreviewWidths, thumbnailPath, thumbnailWidths } from './paths.mjs';
import { projectRoot, contentPreviewJobs } from './manifest.mjs';

const cacheName = 'private/cms/media-previews.json';

async function readCache(root) {
  try { return JSON.parse(await readFile(path.join(root, cacheName), 'utf8')); }
  catch (error) { if (error.code !== 'ENOENT') throw error; return {}; }
}

function isPhotoPreviewKey(key) {
  return key.startsWith('/media/photos/') && thumbnailWidths.some((width) => key.endsWith(`-preview-${width}.webp`));
}

function isContentPreviewKey(key) {
  if (key.startsWith('/media/photos/')) return false;
  return contentPreviewWidths.some((width) => key.endsWith(`-preview-${width}.webp`));
}

async function previewKeys(directory, publicRoot) {
  let entries;
  try { entries = await readdir(directory, { withFileTypes: true }); }
  catch (error) { if (error.code === 'ENOENT') return []; throw error; }
  const keys = [];
  for (const entry of entries) {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) keys.push(...await previewKeys(absolute, publicRoot));
    else if (/-preview-\d+\.webp$/.test(entry.name)) keys.push(`/${path.relative(publicRoot, absolute).split(path.sep).join('/')}`);
  }
  return keys;
}

async function updatePreviews(root, jobs, owns) {
  const cache = await readCache(root);
  const next = { ...cache };
  const managed = new Set();
  for (const job of jobs) {
    if (!job.src?.startsWith('/media/')) continue;
    const source = path.join(root, 'public', job.src);
    let bytes;
    try { bytes = await readFile(source); }
    catch (error) {
      if (error.code === 'ENOENT') throw new Error(`缺少媒体文件：${job.src}`);
      throw error;
    }
    const hash = createHash('sha256').update(bytes).update(`preview-v1:${sharp.versions.sharp}`).digest('hex');
    for (const width of job.widths) {
      const local = thumbnailPath(job.src, width);
      managed.add(local);
      const target = path.join(root, 'public', local);
      let exists = true;
      try { await access(target); } catch (error) { if (error.code !== 'ENOENT') throw error; exists = false; }
      if (cache[local] !== hash || !exists) {
        await mkdir(path.dirname(target), { recursive: true });
        await sharp(bytes).rotate().resize({ width, withoutEnlargement: true }).webp({ quality: 80 }).toFile(target);
      }
      next[local] = hash;
    }
  }
  for (const key of Object.keys(next)) {
    if (owns(key) && !managed.has(key)) delete next[key];
  }
  if (JSON.stringify(cache) !== JSON.stringify(next)) {
    const cacheFile = path.join(root, cacheName);
    await mkdir(path.dirname(cacheFile), { recursive: true });
    await writeFile(cacheFile, `${JSON.stringify(next, null, 2)}\n`);
  }
  return managed;
}

export async function preparePhotoPreviews(root, photos) {
  const jobs = photos
    .filter((photo) => !photo.draft && photo.src?.startsWith('/media/photos/'))
    .map((photo) => ({ src: photo.src, widths: thumbnailWidths }));
  await updatePreviews(root, jobs, isPhotoPreviewKey);
}

export async function prepareContentPreviews(root = projectRoot, options = {}) {
  const jobs = await contentPreviewJobs(root, options);
  const managed = await updatePreviews(root, jobs, isContentPreviewKey);
  const publicRoot = path.join(root, 'public');
  for (const directory of ['media/projects', 'media/articles']) {
    for (const key of await previewKeys(path.join(publicRoot, directory), publicRoot)) {
      if (isContentPreviewKey(key) && !managed.has(key)) await rm(path.join(publicRoot, key), { force: true });
    }
  }
}
