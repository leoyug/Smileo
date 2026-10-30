import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtemp, mkdir, writeFile, readFile, rm, stat, utimes, symlink, realpath } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import sharp from 'sharp';
import { resolveMediaUrl, thumbnailPath } from './paths.mjs';
import { contentDisplayPath, remarkContentDisplayImages } from './display-images.mjs';
import { bodyMediaReferences, rewriteMediaHtml } from './references.mjs';
import { createManifest, prepareMediaManifest, manifestFile } from './manifest.mjs';
import { prepareContentPreviews, preparePhotoPreviews } from './previews.mjs';
import { syncMedia } from './sync-r2.mjs';
import { finalizeMediaBuild } from './finalize-build.mjs';

const quiet = () => {};
const env = { R2_ACCOUNT_ID: 'test', R2_ACCESS_KEY_ID: 'test', R2_SECRET_ACCESS_KEY: 'test', R2_BUCKET: 'test' };

async function fixture(t) {
  const root = await realpath(await mkdtemp(path.join(os.tmpdir(), 'smileo-media-')));
  t.after(() => rm(root, { recursive: true, force: true }));
  const put = async (file, value) => { const target = path.join(root, file); await mkdir(path.dirname(target), { recursive: true }); await writeFile(target, value); };
  for (const collection of ['photos', 'projects', 'articles']) await mkdir(path.join(root, 'src/content', collection), { recursive: true });
  const buffer = await sharp({ create: { width: 1200, height: 800, channels: 3, background: '#9abcde' } }).jpeg().toBuffer();
  const photo = { src: '/media/photos/one/src.jpg', width: 1200, height: 800, draft: false };
  await put('public/media/photos/one/src.jpg', buffer);
  await put('src/content/photos/one.json', JSON.stringify(photo));
  await preparePhotoPreviews(root, [photo]);
  return { root, put, photo, buffer };
}

test('media URLs preserve local/external addresses, encode keys once and reject unsafe configuration', () => {
  const files = { '/media/photos/街 角/src.jpg': "photos/街 角/src-'hash.jpg" };
  const local = '/media/photos/街 角/src.jpg';
  assert.equal(resolveMediaUrl(local, '', files), local);
  assert.equal(resolveMediaUrl('/assets/icon.svg', 'https://photos.example/', files), '/assets/icon.svg');
  const remote = 'https://photos.example/photos/%E8%A1%97%20%E8%A7%92/src-\'hash.jpg';
  assert.equal(resolveMediaUrl(`${encodeURI(local)}?v=2#detail`, 'https://photos.example///', files), `${remote}?v=2#detail`);
  assert.equal(resolveMediaUrl(remote, 'https://photos.example', files), remote);
  assert.throws(() => resolveMediaUrl('/media/../secret.jpg', 'https://photos.example', {}), /无效/);
  assert.throws(() => resolveMediaUrl('/media/missing.jpg', 'https://photos.example', {}), /清单缺少/);
  assert.throws(() => resolveMediaUrl(local, 'https://user:secret@example.com', files), /PUBLIC_MEDIA_BASE/);
});

test('ordinary body references and HTML rewrite cover titles, encoded attributes and external images', () => {
  const body = '![图](/media/a.jpg "说明") [查看](</media/a b.jpg>) <img alt="图" src="/media/c.jpg"> ![外部](https://example.com/a.jpg)\n```md\n![示例](/media/example.jpg)\n```';
  assert.deepEqual(bodyMediaReferences(body), ['/media/a.jpg', '/media/a b.jpg', '/media/c.jpg']);
  assert.throws(() => bodyMediaReferences('[p]: /media/p.jpg'), /暂不支持/);
  const html = '<img src="/media/a.jpg?x=1&amp;y=2"><a href=\'/media/a.jpg\'>图</a><img src="https://example.com/a.jpg">';
  const rewritten = rewriteMediaHtml(html, src => resolveMediaUrl(src, 'https://photos.example', { '/media/a.jpg': 'a-hash.jpg' }));
  assert.match(rewritten, /src="https:\/\/photos.example\/a-hash.jpg\?x=1&amp;y=2"/);
  assert.match(rewritten, /href='https:\/\/photos.example\/a-hash.jpg'/);
  assert.match(rewritten, /src="https:\/\/example.com\/a.jpg"/);
  assert.equal(rewriteMediaHtml('<code>src="/media/example.jpg"</code>', () => { throw new Error('must not rewrite text'); }), '<code>src="/media/example.jpg"</code>');
});

test('previews are proportional, incremental and refreshed when bytes change with the same timestamp', async t => {
  const { root, photo } = await fixture(t);
  const preview = path.join(root, 'public', thumbnailPath(photo.src, 480));
  const before = await stat(preview);
  const originalBytes = await readFile(preview);
  const metadata = await sharp(originalBytes).metadata();
  assert.deepEqual([metadata.width, metadata.height, metadata.format, metadata.exif], [480, 320, 'webp', undefined]);
  await preparePhotoPreviews(root, [photo]);
  assert.equal((await stat(preview)).mtimeMs, before.mtimeMs);
  const source = path.join(root, 'public', photo.src);
  const sourceInfo = await stat(source);
  await sharp({ create: { width: 1200, height: 800, channels: 3, background: '#ff0000' } }).jpeg().toFile(source);
  await utimes(source, sourceInfo.atime, sourceInfo.mtime);
  await preparePhotoPreviews(root, [photo]);
  assert.notDeepEqual(await readFile(preview), originalBytes);
});

test('reading images use a display preview and leave photo originals unchanged', () => {
  assert.equal(contentDisplayPath('/media/projects/shared.jpg'), '/media/projects/shared-preview-2400.webp');
  assert.equal(contentDisplayPath('/media/photos/one/src.jpg'), '/media/photos/one/src.jpg');
  assert.equal(contentDisplayPath('/media/projects/shared-preview-2400.webp'), '/media/projects/shared-preview-2400.webp');
  assert.equal(contentDisplayPath('/assets/cover.png'), '/assets/cover.png');
  const tree = { type: 'root', children: [{ type: 'image', url: '/media/articles/body.jpg?v=1' }] };
  remarkContentDisplayImages()(tree);
  assert.equal(tree.children[0].url, '/media/articles/body-preview-2400.webp?v=1');
});

test('manifest includes published body/cover/shared assets, excludes drafts and changes keys when bytes change', async t => {
  const { root, put } = await fixture(t);
  const image = await sharp({ create: { width: 32, height: 16, channels: 3, background: '#abcdef' } }).jpeg().toBuffer();
  await put('public/media/projects/shared.jpg', image);
  await put('public/media/articles/body.jpg', image);
  await put('public/media/projects/draft.jpg', image);
  await put('src/content/projects/published.md', '---\ndraft: false\ncover: /media/projects/shared.jpg\n---\n![正文](/media/articles/body.jpg)');
  await put('src/content/projects/draft.md', '---\ndraft: true\ncover: /media/projects/shared.jpg\narchiveImages: [/media/projects/draft.jpg]\n---');
  await prepareContentPreviews(root);
  const preview = await sharp(path.join(root, 'public/media/projects/shared-preview-2400.webp')).metadata();
  assert.equal(preview.format, 'webp');
  assert.equal(preview.width, 32);
  const first = await prepareMediaManifest(root);
  assert.equal(Object.keys(first.files).length, 8);
  assert.equal(first.files['/media/projects/draft.jpg'], undefined);
  assert.equal(first.files['/media/projects/draft-preview-2400.webp'], undefined);
  assert.equal(first.files['/media/articles/body-preview-480.webp'], undefined);
  assert.match(first.files['/media/projects/shared-preview-2400.webp'], /shared-preview-2400-/);
  assert.match(first.files['/media/projects/shared-preview-480.webp'], /shared-preview-480-/);
  assert.match(first.files['/media/articles/body-preview-2400.webp'], /body-preview-2400-/);
  await put('public/media/articles/body.jpg', 'changed');
  const second = await createManifest(root);
  assert.notEqual(first.files['/media/articles/body.jpg'], second.files['/media/articles/body.jpg']);
  assert.equal(first.files['/media/projects/shared.jpg'], second.files['/media/projects/shared.jpg']);
  await symlink(path.join(root, 'src/content/projects/draft.md'), path.join(root, 'public/media/projects/escape.jpg'));
  await put('src/content/projects/published.md', '---\ncover: /media/projects/escape.jpg\n---');
  await assert.rejects(createManifest(root), /超出 public\/media/);
});

test('development generates draft previews and preserves them after unpublishing without publishing draft media', async t => {
  const { root, put, buffer } = await fixture(t);
  const previews = [];
  for (const collection of ['projects', 'articles']) {
    for (const name of ['cover', 'archive', 'body']) await put(`public/media/${collection}/${name}.jpg`, buffer);
    const content = draft => `---\ndraft: ${draft}\ncover: /media/${collection}/cover.jpg\narchiveImages: [/media/${collection}/archive.jpg]\n---\n![正文](/media/${collection}/body.jpg)`;
    await put(`src/content/${collection}/entry.md`, content(collection === 'articles'));
    if (collection === 'projects') {
      await prepareContentPreviews(root);
      await put(`src/content/${collection}/entry.md`, content(true));
    }
    previews.push(
      `/media/${collection}/cover-preview-2400.webp`,
      `/media/${collection}/cover-preview-480.webp`,
      `/media/${collection}/archive-preview-480.webp`,
      `/media/${collection}/body-preview-2400.webp`,
    );
  }
  await prepareContentPreviews(root, { includeDrafts: true });
  // The watcher uses the same mode; repeated preparation must retain draft previews.
  await prepareContentPreviews(root, { includeDrafts: true });
  const manifest = await prepareMediaManifest(root);
  for (const preview of previews) {
    assert.equal((await sharp(path.join(root, 'public', preview)).metadata()).format, 'webp');
    assert.equal(manifest.files[preview], undefined);
    await put(`dist${preview}`, await readFile(path.join(root, 'public', preview)));
  }
  assert.ok(Object.keys(manifest.files).every(source => source.startsWith('/media/photos/')));
  await finalizeMediaBuild(root, '');
  for (const preview of previews) {
    await assert.rejects(stat(path.join(root, 'dist', preview)), { code: 'ENOENT' });
    assert.ok(await stat(path.join(root, 'public', preview)));
  }
  // Production preparation retains its published-only behavior.
  await prepareContentPreviews(root);
  for (const preview of previews) await assert.rejects(stat(path.join(root, 'public', preview)), { code: 'ENOENT' });
});

test('dry-run never writes, real sync skips existing keys and stops on the first upload failure', async t => {
  const { root } = await fixture(t);
  const { files } = await prepareMediaManifest(root);
  const keys = Object.values(files);
  const commands = [];
  const client = { send: async command => {
    commands.push(command.constructor.name);
    if (command.constructor.name === 'ListObjectsV2Command') return { Contents: [{ Key: keys[0] }] };
    throw new Error('upload failed');
  } };
  const dry = await syncMedia({ root, env, client, dryRun: true, log: quiet });
  assert.deepEqual(dry, { planned: 2, uploaded: 0, skipped: 1, remoteCompared: true });
  assert.deepEqual(commands, ['ListObjectsV2Command']);
  await assert.rejects(syncMedia({ root, env, client, log: quiet }), /upload failed/);
  assert.deepEqual(commands, ['ListObjectsV2Command', 'ListObjectsV2Command', 'PutObjectCommand']);
  assert.deepEqual(await syncMedia({ root, env: {}, dryRun: true, log: quiet }), { planned: 3, uploaded: 0, skipped: 0, remoteCompared: false });
  await assert.rejects(syncMedia({ root, env: {}, log: quiet }), /缺少/);
  const stale = JSON.parse(await readFile(path.join(root, manifestFile), 'utf8'));
  stale.files['/media/missing.jpg'] = 'missing.jpg';
  await writeFile(path.join(root, manifestFile), JSON.stringify(stale));
  await assert.rejects(syncMedia({ root, env, client, log: quiet }), /清单已过期/);
});

test('finalization rewrites rendered body images and removes draft sources and previews from dist only', async t => {
  const { root, put } = await fixture(t);
  const { files } = await prepareMediaManifest(root);
  await put('dist/index.html', '<img src="/media/photos/one/src.jpg">');
  await put('dist/media/photos/one/src.jpg', 'published');
  await put('dist/media/photos/draft/src.jpg', 'draft');
  await put('dist/media/photos/draft/src-preview-480.webp', 'draft preview');
  await finalizeMediaBuild(root, 'https://photos.example');
  assert.match(await readFile(path.join(root, 'dist/index.html'), 'utf8'), new RegExp(files['/media/photos/one/src.jpg']));
  await assert.rejects(stat(path.join(root, 'dist/media/photos/draft/src.jpg')), { code: 'ENOENT' });
  await assert.rejects(stat(path.join(root, 'dist/media/photos/draft/src-preview-480.webp')), { code: 'ENOENT' });
  assert.equal(await readFile(path.join(root, 'dist/media/photos/one/src.jpg'), 'utf8'), 'published');
  assert.ok(await stat(path.join(root, 'public/media/photos/one/src.jpg')));
});

test('sync refuses bytes edited after the snapshot instead of publishing them under an old hash', async t => {
  const { root, put } = await fixture(t);
  const manifest = await prepareMediaManifest(root);
  const firstSource = Object.keys(manifest.files)[0];
  const commands = [];
  const client = { send: async command => {
    commands.push(command.constructor.name);
    await put(`public${firstSource}`, 'edited during sync');
    return { Contents: [] };
  } };
  await assert.rejects(syncMedia({ root, env, client, log: quiet }), /同步期间图片发生变化/);
  assert.deepEqual(commands, ['ListObjectsV2Command']);
});
