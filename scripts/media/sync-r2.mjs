import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadEnv } from 'vite';
import { S3Client, ListObjectsV2Command, PutObjectCommand } from '@aws-sdk/client-s3';
import { createManifest, digest, manifestFile, mediaFile, projectRoot } from './manifest.mjs';

const contentTypes = { '.webp': 'image/webp', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.gif': 'image/gif', '.avif': 'image/avif', '.svg': 'image/svg+xml' };

export async function syncMedia({ root = projectRoot, dryRun = false, env = loadEnv('production', root, ''), client, log = console.log } = {}) {
  const manifest = JSON.parse(await readFile(path.join(root, manifestFile), 'utf8'));
  if (JSON.stringify(manifest) !== JSON.stringify(await createManifest(root))) throw new Error('媒体清单已过期，请先运行 npm run media:prepare 和 npm run check。');
  const required = ['R2_ACCOUNT_ID', 'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY', 'R2_BUCKET'];
  const missing = required.filter(name => !env[name]?.trim());
  if (missing.length && !dryRun && !client) throw new Error(`缺少 ${missing.join('、')}。请在 .env.local 中填写；密钥不要提交到 Git。`);
  const entries = Object.entries(manifest.files);
  const known = new Set();
  if (missing.length && !client) {
    log('未配置完整凭证：以下仅为本地发布列表，尚未与 R2 对比。');
    for (const [, key] of entries) log(`[本地计划] ${key}`);
    return { planned: entries.length, uploaded: 0, skipped: 0, remoteCompared: false };
  }
  const connection = client ?? new S3Client({
    region: 'auto',
    endpoint: `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId: env.R2_ACCESS_KEY_ID, secretAccessKey: env.R2_SECRET_ACCESS_KEY },
  });
  let uploaded = 0;
  let skipped = 0;
  try {
    let cursor;
    do {
      const page = await connection.send(new ListObjectsV2Command({ Bucket: env.R2_BUCKET, ContinuationToken: cursor }));
      for (const object of page.Contents ?? []) known.add(object.Key);
      cursor = page.IsTruncated ? page.NextContinuationToken : undefined;
      if (page.IsTruncated && !cursor) throw new Error('R2 返回的分页游标无效');
    } while (cursor);
    for (const [source, key] of entries) {
      if (known.has(key)) { skipped++; continue; }
      const contentType = contentTypes[path.extname(source).toLowerCase()];
      if (!contentType) throw new Error(`不支持的发布媒体格式：${source}`);
      if (dryRun) { log(`[待上传] ${key}`); continue; }
      const body = await readFile(await mediaFile(root, source));
      if (!key.endsWith(`-${digest(body)}${path.extname(source)}`)) throw new Error(`同步期间图片发生变化：${source}，请重新准备后再上传。`);
      await connection.send(new PutObjectCommand({
        Bucket: env.R2_BUCKET, Key: key, Body: body,
        ContentType: contentType, CacheControl: 'public, max-age=31536000, immutable',
        IfNoneMatch: '*',
      }));
      uploaded++;
      log(`[已上传] ${key}`);
    }
  } finally { if (!client) connection.destroy(); }
  const result = { planned: entries.length - skipped, uploaded, skipped, remoteCompared: true };
  log(JSON.stringify(result));
  return result;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  if (args.some(arg => arg !== '--dry-run')) {
    console.error('仅支持 --dry-run；本工具不删除远端对象。');
    process.exitCode = 1;
  } else {
    syncMedia({ dryRun: args.includes('--dry-run') }).catch(error => { console.error(error.message); process.exitCode = 1; });
  }
}
