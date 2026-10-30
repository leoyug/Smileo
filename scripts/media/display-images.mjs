import { readingPreviewWidth, thumbnailPath } from './paths.mjs';

const rasterPattern = /\.(png|jpe?g|webp|gif|avif)$/i;

export function contentDisplayPath(value, width = readingPreviewWidth) {
  if (typeof value !== 'string' || !value.startsWith('/media/')) return value;
  const match = value.match(/^([^?#]+)(.*)$/);
  const pathname = decodeURI(match[1]);
  const suffix = match[2] ?? '';
  if (pathname.startsWith('/media/photos/') || /-preview-\d+\.webp$/i.test(pathname) || !rasterPattern.test(pathname)) return value;
  return thumbnailPath(pathname, width) + suffix;
}

export function remarkContentDisplayImages() {
  const rewrite = (node) => {
    if (!node || typeof node !== 'object') return;
    if (node.type === 'image' && typeof node.url === 'string') node.url = contentDisplayPath(node.url);
    else if (node.type === 'html' && typeof node.value === 'string') {
      node.value = node.value.replace(/\bsrc\s*=\s*(["'])(\/media\/.*?)\1/gi, (_, quote, value) => `src=${quote}${contentDisplayPath(value)}${quote}`);
    }
    for (const child of node.children ?? []) rewrite(child);
  };
  return (tree) => rewrite(tree);
}
