import { DOMParser } from "@xmldom/xmldom";
import { dailyLink } from "../../src/lib/daily";
import type { Candidate } from "./store";
import { dailyTelegramConfig, sendDailyCandidates, type DailyTelegramEnv } from "./telegram";

type SourceEnv = Env & DailyTelegramEnv & { DAILY_GITHUB_TOKEN?: string };

function parseRss(xml: string): Candidate[] {
  const document = new DOMParser({
    onError(level) {
      if (level !== "warning") throw new Error("Invalid article RSS");
    },
  }).parseFromString(xml, "application/xml");
  if (document.doctype || document.documentElement?.nodeName !== "rss") {
    throw new Error("Expected an RSS document");
  }
  const channel = document.getElementsByTagName("channel").item(0);
  if (!channel) throw new Error("Missing RSS channel");

  return Array.from(channel.getElementsByTagName("item"), item => {
    const field = (tag: string) => item.getElementsByTagName(tag).item(0)?.textContent?.trim() ?? "";
    const url = dailyLink(field("link"));
    const title = field("title");
    const time = Date.parse(field("pubDate"));
    if (!url || !title || !Number.isFinite(time)) throw new Error("Invalid article RSS item");
    const key = url.origin + url.pathname.replace(/\/+$/, "");
    return { key, url: url.href, title, time, summary: field("description") };
  });
}

async function articleCandidates(assets: Fetcher, rssUrl: string) {
  const response = await assets.fetch(rssUrl);
  if (!response.ok) throw new Error(`Article RSS returned ${response.status}`);
  return parseRss(await response.text());
}

interface GitHubStar {
  starred_at: string;
  repo: { id: number; html_url: string; full_name: string; private: boolean; description: string | null };
}

async function githubCandidates(user: string, token: string | undefined, watermark: number | null) {
  if (!/^[a-z\d-]{1,39}$/i.test(user)) throw new Error("Invalid GitHub username");
  const url = new URL(`https://api.github.com/users/${user}/starred`);
  url.search = "sort=created&direction=desc&per_page=100";
  const headers = new Headers({
    Accept: "application/vnd.github.star+json",
    "User-Agent": "Smileo-Daily",
    "X-GitHub-Api-Version": "2026-03-10",
  });
  if (token) headers.set("Authorization", `Bearer ${token}`);

  const entries: Candidate[] = [];
  for (let page = 1; ; page++) {
    url.searchParams.set("page", String(page));
    const response = await fetch(url, { headers, redirect: "manual", signal: AbortSignal.timeout(10_000) });
    if (!response.ok) throw new Error(`GitHub Stars returned ${response.status}`);
    const stars = await response.json<GitHubStar[]>();
    if (!Array.isArray(stars)) throw new Error("Invalid GitHub Stars response");
    let oldest = Infinity;
    for (const star of stars) {
      const time = Date.parse(star.starred_at);
      const repo = star.repo;
      if (!repo || !Number.isFinite(time)) throw new Error("Invalid GitHub Star");
      oldest = Math.min(time, oldest);
      if (repo.private !== false || (watermark !== null && time < watermark)) continue;
      const link = dailyLink(repo.html_url);
      if (link?.hostname !== "github.com" || !repo.full_name || !Number.isSafeInteger(repo.id)) continue;
      entries.push({ key: String(repo.id), url: link.href, title: repo.full_name, time, summary: repo.description ?? "" });
    }
    if (watermark === null || oldest < watermark || !stars.length || !response.headers.get("Link")?.includes('rel="next"')) break;
  }
  return entries;
}

export async function syncDailySources(env: SourceEnv, now: number) {
  const telegram = dailyTelegramConfig(env);
  if (!telegram) return;
  const daily = env.DAILY.getByName("leo");
  const outcomes = await Promise.allSettled([
    (async () => {
      if (env.DAILY_RSS_URL) await daily.ingest("rss", await articleCandidates(env.ASSETS, env.DAILY_RSS_URL), now);
    })(),
    (async () => {
      if (!env.DAILY_GITHUB_USER) return;
      const watermark = await daily.watermark("github");
      const candidates = await githubCandidates(env.DAILY_GITHUB_USER, env.DAILY_GITHUB_TOKEN, watermark);
      await daily.ingest("github", candidates, now);
    })(),
  ]);
  for (const [index, result] of outcomes.entries()) {
    if (result.status === "rejected") {
      // The upstream response may include credentials or unpublished material.
      console.error("Daily source sync failed", { source: index === 0 ? "rss" : "github" });
    }
  }
  try {
    await sendDailyCandidates(daily, telegram);
  } catch {
    console.error("Daily candidate delivery failed");
  }
}
