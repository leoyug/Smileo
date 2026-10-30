import { getCollection } from 'astro:content';
import type { APIRoute } from 'astro';
import { translations } from '../../i18n/render';

const escape = (value: string) => value.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&apos;');
export const GET: APIRoute = async ({ site }) => {
  const articles = (await getCollection('articles', ({data}) => !data.draft)).sort((a,b)=>b.data.publishedAt.valueOf()-a.data.publishedAt.valueOf());
  const items = articles.map(article=>{
    const en = translations[`articles/${article.id}`];
    if(!en) throw new Error(`Missing English RSS translation: ${article.id}`);
    return `<item><title>${escape(en.data.title)}</title><link>${new URL(`/en/writing/${article.id}/`,site)}</link><description>${escape(en.data.description)}</description><pubDate>${article.data.publishedAt.toUTCString()}</pubDate></item>`;
  }).join('');
  return new Response(`<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><title>Leo's digital garden</title><link>${new URL('/en/',site)}</link><language>en</language><description>Writing on design engineering, personal archives, and everyday observations.</description>${items}</channel></rss>`, {headers:{'Content-Type':'application/xml; charset=utf-8'}});
};
