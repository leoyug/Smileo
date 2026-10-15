import { readdir, readFile, writeFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { loadEnv } from 'vite';
import { projectRoot, manifestFile } from './manifest.mjs';
import { normalizeMediaBase, resolveMediaUrl } from './paths.mjs';
import { rewriteMediaHtml } from './references.mjs';

export async function finalizeMediaBuild(root = projectRoot, base = loadEnv('production', root, '').PUBLIC_MEDIA_BASE) {
  const manifest = JSON.parse(await readFile(path.join(root, manifestFile), 'utf8'));
  const mediaBase = normalizeMediaBase(base);
  const output = path.join(root, 'dist');
  let removed = 0;
  async function walk(directory) {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const target = path.join(directory, entry.name);
      if (entry.isDirectory()) { await walk(target); continue; }
      const relative = `/${path.relative(output, target).split(path.sep).join('/')}`;
      if (relative.startsWith('/media/') && !Object.hasOwn(manifest.files, relative)) {
        await rm(target);
        removed++;
      } else if (entry.name.endsWith('.html') && mediaBase) {
        const html = await readFile(target, 'utf8');
        const rewritten = rewriteMediaHtml(html, value => resolveMediaUrl(value, mediaBase, manifest.files));
        if (rewritten !== html) await writeFile(target, rewritten);
      }
    }
  }
  await walk(output);
  console.log(`已从构建结果移除 ${removed} 个草稿或未引用媒体文件${mediaBase ? '，并改写正文媒体地址' : ''}。`);
}
