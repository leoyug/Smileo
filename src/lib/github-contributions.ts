import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import snapshotData from "../data/github-contributions.json";

const HEATMAP_WEEKS = 26;
const snapshotPath = join(process.cwd(), "src/data/github-contributions.json");

export type ContributionCell = {
  column: number;
  row: number;
  level: number;
};

export type GithubContributions = {
  total: number;
  weeks: number;
  cells: ContributionCell[];
};

const cache = new Map<string, Promise<GithubContributions | null>>();

export function loadGithubContributions(username: string) {
  const cached = cache.get(username);
  if (cached) return cached;
  const pending = fetchContributions(username)
    .then((value) => {
      if (!value) return bundledSnapshot();
      writeSnapshot(value);
      return value;
    })
    .catch(() => bundledSnapshot());
  cache.set(username, pending);
  return pending;
}

async function fetchContributions(username: string): Promise<GithubContributions | null> {
  const response = await fetch(`https://github.com/users/${encodeURIComponent(username)}/contributions`, {
    headers: {
      Accept: "text/html",
      "User-Agent": "Mozilla/5.0 (compatible; incessantleo/1.0)",
    },
    signal: AbortSignal.timeout(12000),
  });
  if (!response.ok) return null;
  return parseContributions(await response.text());
}

function parseContributions(html: string): GithubContributions | null {
  const totalMatch = html.match(/([\d,]+)\s+contributions\s+in the last year/i);
  const total = totalMatch ? Number(totalMatch[1].replaceAll(",", "")) : NaN;
  if (!Number.isFinite(total)) return null;

  const byWeek = new Map<number, Map<number, number>>();
  for (const match of html.matchAll(/<td\b[^>]*ContributionCalendar-day[^>]*>/g)) {
    const tag = match[0];
    const id = tag.match(/id="contribution-day-component-(\d+)-(\d+)"/);
    const levelMatch = tag.match(/data-level="(\d+)"/);
    if (!id || !levelMatch) continue;
    const day = Number(id[1]);
    const week = Number(id[2]);
    const days = byWeek.get(week) ?? new Map<number, number>();
    days.set(day, Number(levelMatch[1]));
    byWeek.set(week, days);
  }

  const selected = [...byWeek.keys()].sort((a, b) => a - b).slice(-HEATMAP_WEEKS);
  if (!selected.length) return null;

  const cells = selected.flatMap((week, index) => {
    const days = byWeek.get(week);
    if (!days) return [];
    return [...days].map(([day, level]) => ({ column: index + 1, row: day + 1, level }));
  });

  return { total, weeks: selected.length, cells };
}

function bundledSnapshot(): GithubContributions | null {
  return normalize(snapshotData);
}

function normalize(data: unknown): GithubContributions | null {
  if (!data || typeof data !== "object") return null;
  const value = data as GithubContributions;
  if (!Number.isFinite(value.total) || !value.weeks || !value.cells?.length) return null;
  return { total: value.total, weeks: value.weeks, cells: value.cells };
}

function writeSnapshot(value: GithubContributions) {
  const next = `${JSON.stringify(value)}\n`;
  try {
    if (readFileSync(snapshotPath, "utf8") === next) return;
    writeFileSync(snapshotPath, next);
  } catch {
    // Refreshing the file is optional. The imported snapshot still renders.
  }
}
