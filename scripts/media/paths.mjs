export const thumbnailWidths = [480, 222];
// Reading images are at most the 768px column, then zoom to 1.6×. 2400px covers that on a 2× screen.
// 480px covers archive thumbnails and the small photo stacks.
export const readingPreviewWidth = 2400;
export const thumbPreviewWidth = 480;
export const contentPreviewWidths = [readingPreviewWidth, thumbPreviewWidth];
const previewWidths = new Set([...thumbnailWidths, ...contentPreviewWidths]);

export function assertMediaPath(value) {
  if (!value.startsWith('/media/') || /[\\\0?#]/.test(value) || value.split('/').some(part => part === '.' || part === '..')) {
    throw new Error(`无效的媒体路径：${value}`);
  }
  return value;
}

export function thumbnailPath(source, width) {
  assertMediaPath(source);
  if (!previewWidths.has(width)) throw new Error(`不支持的缩略图宽度：${width}`);
  return source.replace(/\.[^/.]+$/, `-preview-${width}.webp`);
}

export function normalizeMediaBase(base = '') {
  if (!base.trim()) return '';
  const url = new URL(base.trim());
  if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password || url.search || url.hash) {
    throw new Error('PUBLIC_MEDIA_BASE 须为不含凭证、查询参数或片段的 HTTP(S) 地址');
  }
  return url.href.replace(/\/+$/, '');
}

export function resolveMediaUrl(value, base, files) {
  if (!value?.startsWith('/media/')) return value;
  const normalized = normalizeMediaBase(base);
  if (!normalized) return value;
  const [, pathname, suffix = ''] = value.match(/^([^?#]+)(.*)$/);
  let local = pathname;
  if (!Object.hasOwn(files, local)) local = decodeURIComponent(pathname);
  assertMediaPath(local);
  const key = files[local];
  if (!key) throw new Error(`已发布媒体清单缺少：${local}。请运行 npm run media:prepare。`);
  return `${normalized}/${key.split('/').map(encodeURIComponent).join('/')}${suffix}`;
}
