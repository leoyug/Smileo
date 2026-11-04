import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'parse5';

const escapeXml = value => value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&apos;');
const normalizePath = value => decodeURIComponent(value).replace(/\/$/, '') || '/';

async function htmlFiles(directory) {
  const files = await Promise.all((await readdir(directory, { withFileTypes: true })).map(entry => {
    const file = join(directory, entry.name);
    return entry.isDirectory() ? htmlFiles(file) : entry.name.endsWith('.html') ? [file] : [];
  }));
  return files.flat();
}

// Use final page metadata rather than maintaining a second list of exclusions.
export function searchDiscovery() {
  let site;
  return {
    name: 'search-discovery',
    hooks: {
      'astro:config:done': ({ config }) => { site = config.site; },
      'astro:build:done': async ({ dir, logger }) => {
        if (!site) throw new Error('Search discovery requires Astro site configuration.');
        const directory = fileURLToPath(dir);
        const entries = new Map();
        for (const file of await htmlFiles(directory)) {
          const document = parse(await readFile(file, 'utf8'));
          const head = document.childNodes.find(node => node.tagName === 'html')?.childNodes.find(node => node.tagName === 'head');
          const elements = (head?.childNodes ?? []).map(node => ({ tag: node.tagName, ...Object.fromEntries((node.attrs ?? []).map(attr => [attr.name, attr.value])) }));
          if (elements.some(node => node.tag === 'meta' && (
            node['http-equiv']?.toLowerCase() === 'refresh' ||
            ['robots', 'googlebot'].includes(node.name?.toLowerCase()) && /\b(noindex|none)\b/i.test(node.content ?? '')
          ))) continue;
          const canonical = elements.find(node => node.tag === 'link' && node.rel === 'canonical')?.href;
          if (!canonical) continue;
          const url = new URL(canonical, site);
          const route = '/' + relative(directory, file).replaceAll('\\', '/').replace(/index\.html$/, '').replace(/\.html$/, '');
          if (url.origin !== new URL(site).origin || normalizePath(url.pathname) !== normalizePath(route)) continue;
          const alternates = elements.filter(node => node.tag === 'link' && node.rel === 'alternate' && node.hreflang && node.href);
          entries.set(url.href, alternates);
        }
        const urls = [...entries].sort(([a], [b]) => a.localeCompare(b)).map(([url, alternates]) => {
          const links = alternates.filter(link => entries.has(new URL(link.href, site).href)).map(link =>
            `<xhtml:link rel="alternate" hreflang="${escapeXml(link.hreflang)}" href="${escapeXml(new URL(link.href, site).href)}"/>`
          ).join('');
          return `  <url><loc>${escapeXml(url)}</loc>${links}</url>`;
        });
        await writeFile(join(directory, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n${urls.join('\n')}\n</urlset>\n`);
        await writeFile(join(directory, 'robots.txt'), `User-agent: *\nAllow: /\n\nSitemap: ${new URL('/sitemap.xml', site).href}\n`);
        logger.info(`Generated sitemap.xml (${entries.size} indexable pages) and robots.txt.`);
      },
    },
  };
}
