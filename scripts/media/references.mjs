// Deliberately limited to ordinary inline Markdown links/images and quoted HTML
// src/href. Extend these rules when actual content needs more complex syntax.
export function bodyMediaReferences(body) {
  const text = body.replace(/```[^\n]*\n[\s\S]*?```|~~~[^\n]*\n[\s\S]*?~~~/g, '').replace(/`[^`\n]*`/g, '');
  const refs = new Set();
  for (const match of text.matchAll(/!?\[[^\]\n]*\]\(\s*(?:<([^>\n]+)>|([^\s)]+))/g)) {
    const value = match[1] ?? match[2];
    if (value.startsWith('/media/')) refs.add(value);
  }
  for (const match of text.matchAll(/\b(?:src|href)\s*=\s*(["'])(\/media\/.*?)\1/g)) refs.add(match[2]);
  if (/^\s*\[[^\]\n]+\]:\s*<?\/media\//m.test(text) || /\bsrcset\s*=\s*["'][^"']*\/media\//.test(text)) {
    throw new Error('媒体暂不支持引用式 Markdown 图片或 srcset，请使用普通 ![](/media/...) 或 img src。');
  }
  return [...refs];
}

export function rewriteMediaHtml(html, resolve) {
  return html.replace(/<(?:img|source|a|meta|link)\b(?:[^"'<>]|"[^"]*"|'[^']*')*>/gi, tag => tag.replace(/\b(src|href|content)\s*=\s*(["'])(\/media\/.*?)\2/gi, (_, attr, quote, value) => {
    const decoded = value.replaceAll('&amp;', '&').replaceAll('&#39;', "'").replaceAll('&quot;', '"');
    const url = resolve(decoded).replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll("'", '&#39;');
    return `${attr}=${quote}${url}${quote}`;
  }));
}
