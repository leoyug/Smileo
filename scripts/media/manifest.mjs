import { createHash } from 'node:crypto';
import { readFile, readdir, writeFile, mkdir, realpath } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import matter from 'gray-matter';
import { assertMediaPath, thumbnailPath, thumbnailWidths } from './paths.mjs';
import { bodyMediaReferences } from './references.mjs';

export const projectRoot = fileURLToPath(new URL('../../', import.meta.url));
export const manifestFile = 'src/data/media-manifest.json';
export const digest = buffer => createHash('sha256').update(buffer).digest('hex');

export async function mediaFile(root, source) {
  assertMediaPath(source);
  const target = path.join(root, 'public', source);
  const base = await realpath(path.join(root, 'public/media'));
  const actual = await realpath(target);
  if (!actual.startsWith(`${base}${path.sep}`)) throw new Error(`媒体文件超出 public/media：${source}`);
  return actual;
}

export async function publishedMedia(root = projectRoot) {
  const sources = new Set();
  const add = value => {
    if (!value?.startsWith('/media/')) return;
    const clean = value.split(/[?#]/)[0];
    sources.add(assertMediaPath(decodeURI(clean)));
  };
  for (const collection of ['photos', 'projects', 'articles']) {
    const directory = path.join(root, 'src/content', collection);
    for (const name of (await readdir(directory)).sort()) {
      if (!/\.(json|md|mdx)$/.test(name)) continue;
      const raw = await readFile(path.join(directory, name), 'utf8');
      const { data, content } = name.endsWith('.json') ? { data: JSON.parse(raw), content: '' } : matter(raw);
      if (data.draft) continue;
      if (collection === 'photos') {
        add(data.src);
        if (data.src?.startsWith('/media/')) for (const width of thumbnailWidths) add(thumbnailPath(data.src, width));
      } else {
        add(data.cover);
        for (const image of data.archiveImages ?? []) add(image);
        try { for (const ref of bodyMediaReferences(content)) add(ref); }
        catch (error) { throw new Error(`${collection}/${name}: ${error.message}`); }
      }
    }
  }
  return [...sources].sort();
}

export async function createManifest(root = projectRoot) {
  const files = {};
  for (const source of await publishedMedia(root)) {
    const buffer = await readFile(await mediaFile(root, source));
    const extension = path.posix.extname(source);
    files[source] = `${source.slice('/media/'.length, -extension.length)}-${digest(buffer)}${extension}`;
  }
  return { files };
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
