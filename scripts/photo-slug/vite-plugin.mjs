import { generatePhotoSlug } from './generate.mjs';

export function localPhotoSlugs() {
  return {
    name: 'local-photo-slugs',
    hooks: {
      'astro:server:setup'({ server }) {
        server.middlewares.use(async (req, res, next) => {
          if (new URL(req.url ?? '/', 'http://localhost').pathname !== '/api/photo-slug') return next();
          const send = (status, data) => {
            res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' });
            res.end(JSON.stringify(data));
          };
          const host = req.headers.host;
          const origin = req.headers.origin;
          let sameOrigin = false;
          try { sameOrigin = !origin || new URL(origin).host === host; } catch { /* Reject malformed origins. */ }
          if (!['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(req.socket.remoteAddress)
            || !host || !/^(localhost|127\.0\.0\.1|\[::1\]):\d+$/.test(host) || !sameOrigin) {
            return send(403, { error: '短名生成仅允许本机访问。' });
          }
          if (req.method !== 'POST') return send(405, { error: '请求方法不支持。' });
          if (!/^application\/json(?:;|$)/i.test(req.headers['content-type'] ?? '')) return send(415, { error: '请使用 JSON 提交画面描述。' });
          try {
            let size = 0;
            const chunks = [];
            for await (const chunk of req) {
              size += chunk.length;
              if (size > 4096) return send(413, { error: '画面描述过长。' });
              chunks.push(chunk);
            }
            const data = JSON.parse(Buffer.concat(chunks).toString('utf8'));
            return send(200, { slug: await generatePhotoSlug(data?.description) });
          } catch (error) { return send(400, { error: error.message ?? '短名生成失败，请重试。' }); }
        });
      },
    },
  };
}
