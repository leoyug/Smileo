import { dailyEntryPath, dailyLink, type DailyEntry } from "../../src/lib/daily";
import { isDailyId, parseDailyCursor } from "./store";

const noStore = { "Cache-Control": "no-store" };
const date = new Intl.DateTimeFormat("zh-CN", {
  timeZone: "Asia/Shanghai", dateStyle: "medium", timeStyle: "short", hourCycle: "h23",
});

function escapeHtml(value: string) {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;").replaceAll("'", "&#39;");
}

function renderEntry(entry: DailyEntry, permalink: boolean) {
  const time = `<time datetime="${new Date(entry.publishedAt).toISOString()}">${date.format(entry.publishedAt)}</time>`;
  const url = dailyLink(entry.url ?? "");
  const meta = permalink
    ? `<a class="text-link text-link--fade" href="${dailyEntryPath(entry.id)}">${time}</a>` : time;
  const body = entry.body ? `<p class="daily__body">${escapeHtml(entry.body)}</p>` : "";
  const link = url
    ? `<a class="daily__link text-link text-link--fade" href="${escapeHtml(url.href)}">${escapeHtml(entry.title || url.hostname)}${entry.title ? `<small>${escapeHtml(url.hostname)}</small>` : ""}</a>`
    : "";
  return `<article class="daily__entry"><div class="daily__date">${meta}</div>${body}${link}</article>`;
}

function previousPageLink(cursor: string | null) {
  return cursor ? `<a class="text-link text-link--fade" href="/daily/?before=${encodeURIComponent(cursor)}">更早的动态</a>` : "";
}

export async function serveDaily(request: Request, env: Env, url: URL) {
  if (request.method !== "GET" && request.method !== "HEAD") {
    return new Response(null, { status: 405, headers: { Allow: "GET, HEAD", ...noStore } });
  }
  const daily = env.DAILY.getByName("leo");
  const cursor = url.searchParams.get("before");
  const before = cursor === null ? null : parseDailyCursor(cursor);
  if (url.pathname === "/api/daily") {
    const page = cursor !== null && !before
      ? Response.json({ error: "Invalid cursor" }, { status: 400, headers: noStore })
      : Response.json(await daily.list(before), { headers: noStore });
    return request.method === "HEAD" ? new Response(null, page) : page;
  }

  if (url.pathname === "/daily") {
    const canonical = new URL(url);
    canonical.pathname += "/";
    return Response.redirect(canonical.href, 301);
  }
  const match = /^\/daily\/([^/]+)\/?$/.exec(url.pathname);
  const id = match?.[1];
  if (id && !isDailyId(id)) return env.ASSETS.fetch(request);
  if (url.pathname !== "/daily/" && !id) return env.ASSETS.fetch(request);
  if (id && !url.pathname.endsWith("/")) {
    const canonical = new URL(url);
    canonical.pathname += "/";
    return Response.redirect(canonical.href, 301);
  }

  const entry = id ? await daily.find(id) : null;
  const status = id ? (entry ? 200 : 404) : (cursor !== null && !before ? 400 : 200);
  let content: string;
  let indexable = Boolean(entry);
  if (entry) {
    content = `${renderEntry(entry, false)}<p class="daily__pagination"><a class="text-link text-link--fade" href="/daily/">全部动态</a></p>`;
  } else if (status !== 200) {
    content = `<p>${status === 404 ? "这条动态已不可用。" : "无法打开这一页动态。"} <a class="text-link text-link--fade" href="/daily/">全部动态</a></p>`;
  } else {
    const page = await daily.list(before, 20);
    indexable = page.entries.length > 0;
    content = page.entries.length
      ? `<ol class="daily__list">${page.entries.map(item => `<li>${renderEntry(item, true)}</li>`).join("")}</ol><p class="daily__pagination">${previousPageLink(page.nextCursor)}</p>`
      : "<p>还没有公开动态。</p>";
  }

  const shell = await env.ASSETS.fetch(new URL("/daily/", url));
  if (!shell.ok) return shell;
  const headers = new Headers(shell.headers);
  headers.delete("Content-Length");
  headers.delete("ETag");
  headers.set("Cache-Control", noStore["Cache-Control"]);
  if (status !== 200) headers.set("X-Robots-Tag", "noindex");
  if (request.method === "HEAD") return new Response(null, { status, headers });

  const rewriter = new HTMLRewriter().on("[data-daily-content]", {
    element(element) { element.setInnerContent(content, { html: true }); },
  });
  if (indexable) rewriter.on('meta[name="robots"]', { element(element) { element.remove(); } });
  if (entry) {
    const canonical = new URL(dailyEntryPath(entry.id), url).href;
    const summary = [...(entry.body || entry.title || dailyLink(entry.url ?? "")?.hostname || "动态")].slice(0, 120).join("");
    rewriter
      .on('link[rel="canonical"], link[rel="alternate"][hreflang="zh-CN"], link[rel="alternate"][hreflang="x-default"]', {
        element(element) { element.setAttribute("href", canonical); },
      })
      .on('link[rel="alternate"][hreflang="en"]', { element(element) { element.remove(); } })
      .on('meta[property="og:url"]', { element(element) { element.setAttribute("content", canonical); } })
      .on('meta[name="description"], meta[property="og:description"], meta[name="twitter:description"]', {
        element(element) { element.setAttribute("content", summary); },
      });
  }
  return rewriter.transform(new Response(shell.body, { status, headers }));
}
