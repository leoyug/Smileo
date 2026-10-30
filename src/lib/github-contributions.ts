const HEATMAP_WEEKS = 26;

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
  const pending = fetchContributions(username).catch(() => null);
  cache.set(username, pending);
  return pending;
}

async function fetchContributions(username: string): Promise<GithubContributions | null> {
  const response = await fetch(`https://github.com/users/${encodeURIComponent(username)}/contributions`, {
    headers: { Accept: "text/html", "User-Agent": "incessantleo" },
    signal: AbortSignal.timeout(8000),
  });
  if (!response.ok) return null;
  return parseContributions(await response.text());
}

function parseContributions(html: string): GithubContributions | null {
  const totalMatch = html.match(/([\d,]+)\s+contributions\s+in the last year/i);
  const total = totalMatch ? Number(totalMatch[1].replaceAll(",", "")) : NaN;
  if (!Number.isFinite(total)) return null;

  const byWeek = new Map<number, Map<number, number>>();
  for (const match of html.matchAll(/id="contribution-day-component-(\d+)-(\d+)"[^>]*data-level="(\d+)"/g)) {
    const day = Number(match[1]);
    const week = Number(match[2]);
    const level = Number(match[3]);
    const days = byWeek.get(week) ?? new Map<number, number>();
    days.set(day, level);
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
