import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const HEATMAP_WEEKS = 26;
const snapshotPath = fileURLToPath(new URL("../data/github-contributions.json", import.meta.url));

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
      if (!value) throw new Error("empty");
      writeSnapshot(value);
      return value;
    })
    .catch(() => {
      cache.delete(username);
      return readSnapshot();
    });
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

function readSnapshot(): GithubContributions | null {
  try {
    const data = JSON.parse(readFileSync(snapshotPath, "utf8")) as GithubContributions;
    if (!Number.isFinite(data.total) || !data.weeks || !data.cells?.length) return null;
    return data;
  } catch {
    return null;
  }
}

function writeSnapshot(value: GithubContributions) {
  const next = JSON.stringify(value);
  try {
    if (readFileSync(snapshotPath, "utf8").trim() === next) return;
  } catch {
    // The snapshot is created on the first successful read.
  }
  writeFileSync(snapshotPath, `${next}\n`);
}
