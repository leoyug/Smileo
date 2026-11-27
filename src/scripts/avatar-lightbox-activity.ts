import { dailyEntryPath, dailyLink, dailyPageSize, type DailyPage } from "../lib/daily";

const timeZone = "Asia/Shanghai";
const calendar = new Intl.DateTimeFormat("zh-CN", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" });
const clock = new Intl.DateTimeFormat("zh-CN", { timeZone, hour: "2-digit", minute: "2-digit", hourCycle: "h23" });

function createActivityRows(template: HTMLTemplateElement, entries: DailyPage["entries"]) {
  const rows = document.createDocumentFragment();
  let previousMonth = "";
  for (const [index, entry] of entries.slice(0, dailyPageSize).entries()) {
    const date = new Date(entry.publishedAt);
    if (!Number.isFinite(date.getTime())) continue;
    const parts = Object.fromEntries(calendar.formatToParts(date).map(({ type, value }) => [type, value]));
    const month = `${parts.year}-${parts.month}`;
    const row = template.content.firstElementChild!.cloneNode(true) as HTMLLIElement;
    row.style.setProperty("--avatar-lightbox-activity-index", String(index));

    const dateLink = row.querySelector<HTMLAnchorElement>("[data-daily-date]")!;
    dateLink.href = dailyEntryPath(entry.id);
    dateLink.setAttribute("aria-label", `${calendar.format(date)} ${clock.format(date)}`);
    const monthLabel = row.querySelector<HTMLSpanElement>("[data-daily-month]")!;
    monthLabel.textContent = `${parts.month} 月`;
    monthLabel.hidden = month === previousMonth;
    previousMonth = month;
    row.querySelector("time")!.dateTime = date.toISOString();
    row.querySelector("[data-daily-day]")!.textContent = parts.day;
    row.querySelector("[data-daily-clock]")!.textContent = clock.format(date);

    const body = row.querySelector<HTMLParagraphElement>("[data-daily-body]")!;
    const read = row.querySelector<HTMLAnchorElement>("[data-daily-read]")!;
    const excerpt = [...entry.body.split("\n").slice(0, 4).join("\n")].slice(0, 180).join("");
    const shortened = excerpt !== entry.body;
    body.textContent = shortened ? `${excerpt.trimEnd()}…` : excerpt;
    body.hidden = !entry.body;
    read.href = dailyEntryPath(entry.id);
    read.hidden = !shortened;

    const link = row.querySelector<HTMLAnchorElement>("[data-daily-link]")!;
    const url = dailyLink(entry.url ?? "");
    if (url) {
      link.href = url.href;
      link.querySelector("[data-daily-link-title]")!.textContent = entry.title || url.hostname;
      const domain = link.querySelector<HTMLElement>("[data-daily-link-domain]")!;
      domain.textContent = url.hostname;
      domain.hidden = !entry.title;
    }
    link.hidden = !url;
    rows.append(row);
  }
  return rows;
}

export function bindAvatarActivity(dialog: HTMLDialogElement) {
  const list = dialog.querySelector<HTMLOListElement>("[data-daily-list]");
  const template = dialog.querySelector<HTMLTemplateElement>("[data-daily-template]");
  const status = dialog.querySelector<HTMLElement>("[data-daily-status]");
  const loading = status?.querySelector<HTMLElement>("[data-daily-loading]");
  const empty = status?.querySelector<HTMLElement>("[data-daily-empty]");
  const error = status?.querySelector<HTMLElement>("[data-daily-error]");
  const archive = dialog.querySelector<HTMLAnchorElement>("[data-daily-archive]");
  if (!list || !template || !status || !loading || !empty || !error || !archive) return;

  let lastResponse: string | undefined;
  const updateStatus = (state: "loading" | "empty" | "error" | "loaded") => {
    loading.hidden = state !== "loading";
    empty.hidden = state !== "empty";
    error.hidden = state !== "error";
  };

  return async (signal: AbortSignal) => {
    if (document.documentElement.lang === "en") return;
    if (!lastResponse) updateStatus("loading");

    try {
      const preview = dialog.querySelector<HTMLScriptElement>("[data-daily-preview]")?.textContent;
      let page: DailyPage;
      if (preview) {
        page = JSON.parse(preview);
      } else {
        const response = await fetch("/api/daily", { signal, cache: "no-store" });
        if (!response.ok) throw new Error("Daily feed unavailable");
        page = await response.json();
      }
      if (signal.aborted) return;
      const entries = page.entries.slice(0, dailyPageSize);
      const current = JSON.stringify(entries);
      if (current !== lastResponse) {
        list.replaceChildren(createActivityRows(template, entries));
        lastResponse = current;
      }
      list.hidden = entries.length === 0;
      archive.hidden = entries.length === 0 || Boolean(preview);
      updateStatus(entries.length ? "loaded" : "empty");
    } catch {
      if (!signal.aborted && !list.childElementCount) updateStatus("error");
    }
  };
}
