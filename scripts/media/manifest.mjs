import { createHash } from 'node:crypto';
import { readFile, readdir, writeFile, mkdir, realpath } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import matter from 'gray-matter';
import { assertMediaPath, contentPreviewWidths, readingPreviewWidth, thumbnailPath, thumbnailWidths, thumbPreviewWidth } from './paths.mjs';
import { bodyMediaReferences } from './references.mjs';

export const projectRoot = fileURLToPath(new URL('../../', import.meta.url));
export const manifestFile = 'src/data/media-manifest.json';
export const digest = buffer => createHash('sha256').update(buffer).digest('hex');
const rasterPattern = /\.(png|jpe?g|webp|gif|avif)$/i;

function cleanMediaPath(value) {
  if (!value?.startsWith('/media/')) return;
  return assertMediaPath(decodeURI(value.split(/[?#]/)[0]));
}

export async function mediaFile(root, source) {
  assertMediaPath(source);
  const target = path.join(root, 'public', source);
  const base = await realpath(path.join(root, 'public/media'));
  const actual = await realpath(target);
  if (!actual.startsWith(`${base}${path.sep}`)) throw new Error(`媒体文件超出 public/media：${source}`);
  return actual;
}

async function collectMedia(root, { includeDrafts = false } = {}) {
  const sources = new Set();
  const jobs = new Map();
  const add = value => {
    if (!value?.startsWith('/media/')) return;
    sources.add(assertMediaPath(decodeURI(value.split(/[?#]/)[0])));
  };
  const track = (value, widths) => {
    const clean = cleanMediaPath(value);
    if (!clean) return;
    sources.add(clean);
    if (clean.startsWith('/media/photos/') || !rasterPattern.test(clean)) return;
    const selected = jobs.get(clean) ?? new Set();
    for (const width of widths) {
      selected.add(width);
      sources.add(thumbnailPath(clean, width));
    }
    jobs.set(clean, selected);
  };
  for (const collection of ['photos', 'projects', 'articles']) {
    const directory = path.join(root, 'src/content', collection);
    for (const name of (await readdir(directory)).sort()) {
      if (!/\.(json|md|mdx)$/.test(name)) continue;
      const raw = await readFile(path.join(directory, name), 'utf8');
      const { data, content } = name.endsWith('.json') ? { data: JSON.parse(raw), content: '' } : matter(raw);
      if (data.draft && !includeDrafts) continue;
      if (collection === 'photos') {
        add(data.src);
        if (data.src?.startsWith('/media/')) for (const width of thumbnailWidths) add(thumbnailPath(data.src, width));
      } else {
        track(data.cover, contentPreviewWidths);
        for (const image of data.archiveImages ?? []) track(image, [thumbPreviewWidth]);
        try { for (const ref of bodyMediaReferences(content)) track(ref, [readingPreviewWidth]); }
        catch (error) { throw new Error(`${collection}/${name}: ${error.message}`); }
      }
    }
  }
  return { sources, jobs };
}

export async function publishedMedia(root = projectRoot) {
  const { sources } = await collectMedia(root);
  // Validate original files before derived previews, so a bad source fails as itself.
  return [...sources].sort((left, right) => Number(/-preview-\d+\.webp$/.test(left)) - Number(/-preview-\d+\.webp$/.test(right)) || left.localeCompare(right));
}

export async function contentPreviewJobs(root = projectRoot, options = {}) {
  const { jobs } = await collectMedia(root, options);
  return [...jobs].map(([src, widths]) => ({ src, widths: [...widths].sort((left, right) => right - left) }));
}

export async function createManifest(root = projectRoot) {
  const files = {};
  for (const source of await publishedMedia(root)) {
    const buffer = await readFile(await mediaFile(root, source));
    const extension = path.posix.extname(source);
    files[source] = `${source.slice('/media/'.length, -extension.length)}-${digest(buffer)}${extension}`;
  }
  return { files: Object.fromEntries(Object.keys(files).sort().map((source) => [source, files[source]])) };
}

export async function prepareMediaManifest(root = projectRoot) {
  const manifest = await createManifest(root);
  const target = path.join(root, manifestFile);
  const output = `${JSON.stringify(manifest, null, 2)}\n`;
  let previous;
  try { previous = await readFile(target, 'utf8'); } catch (error) { if (error.code !== 'ENOENT') throw error; }
  if (previous !== output) {
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, output);
  }
  return manifest;
}
