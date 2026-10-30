import { getCollection } from "astro:content";
import { siteTitles } from "../lib/site-metadata";

export async function GET({ site }) {
  const articles = (await getCollection("articles", ({ data }) => !data.draft))
    .sort((a, b) => b.data.publishedAt.valueOf() - a.data.publishedAt.valueOf());
  const items = articles.map((article) => `<item><title><![CDATA[${article.data.title}]]></title><link>${new URL(`/writing/${article.id}`, site)}</link><description><![CDATA[${article.data.description}]]></description><pubDate>${article.data.publishedAt.toUTCString()}</pubDate></item>`).join("");
  return new Response(`<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><title>${siteTitles["zh-CN"]}</title><link>${site}</link><description>Leo 的文章：关于设计工程、个人档案与日常观察。</description>${items}</channel></rss>`, { headers: { "Content-Type": "application/xml" } });
}
