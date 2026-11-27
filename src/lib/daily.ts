export const dailyPageSize = 5;

export interface DailyEntry {
  id: string;
  body: string;
  url: string | null;
  title: string | null;
  publishedAt: number;
}

export interface DailyPage {
  entries: DailyEntry[];
  nextCursor: string | null;
}

export function dailyEntryPath(id: string) {
  return `/daily/${id}/`;
}

export function dailyLink(value: string) {
  try {
    const url = new URL(value);
    return (url.protocol === "https:" || url.protocol === "http:") && !url.username && !url.password ? url : null;
  } catch {
    return null;
  }
}
