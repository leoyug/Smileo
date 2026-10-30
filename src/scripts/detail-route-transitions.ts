import { withoutLanguage } from "../i18n/runtime";
const returnContextKey = "detail-list-return";
const writingSourceKey = "writing-title-return";
interface WritingSource { from: string; to: string; scrollX: number; scrollY: number; }
const writingRow = (root: Document, href: string) => Array.from(root.querySelectorAll<HTMLAnchorElement>("a.content-row[href]"))
  .find((row) => new URL(row.getAttribute("href")!, location.origin).pathname.replace(/\/+$/, "") === new URL(href).pathname.replace(/\/+$/, ""));

const normalizedPath = (path: string) => path.replace(/\/+$/, "") || "/";
const listKind = (path: string) => {
  const normalized = withoutLanguage(normalizedPath(path));
  return normalized === "/projects" || normalized === "/writing" ? normalized : null;
};
const detailKind = (path: string) => {
  const match = withoutLanguage(normalizedPath(path)).match(/^\/(projects|writing)\/[^/]+$/);
  return match ? `/${match[1]}` : null;
};

export function initDetailRouteTransitions() {
  document.addEventListener("astro:before-preparation", (event) => {
    document.querySelectorAll(".content-row.is-writing-transition").forEach((row) => row.classList.remove("is-writing-transition"));
    if (detailKind(event.to.pathname) === "/writing" && ["/", "/writing"].includes(withoutLanguage(normalizedPath(event.from.pathname)))) {
      const row = writingRow(document, event.to.href);
      if (row) {
        row.classList.add("is-writing-transition");
        sessionStorage.setItem(writingSourceKey, JSON.stringify({ from: event.from.href, to: event.to.href, scrollX: window.scrollX, scrollY: window.scrollY }));
      }
    }
    if (!detailKind(event.to.pathname)) return;

    const load = event.loader;
    event.loader = async () => {
      await load();
      if (event.signal.aborted || event.defaultPrevented) return;

      const cover = event.newDocument.querySelector<HTMLImageElement>("[data-detail-page] .content-detail__cover");
      const src = cover?.getAttribute("src");
      if (!src) return;

      // The transition snapshot must contain the decoded detail cover.
      const image = new Image();
      image.decoding = "async";
      image.fetchPriority = "high";
      image.src = new URL(src, event.to).href;
      await image.decode().catch(() => undefined);
    };
  });

  document.addEventListener("click", (event) => {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    if (!(event.target instanceof Element)) return;

    const link = event.target.closest<HTMLAnchorElement>("a[href]");
    if (!link || link.hasAttribute("download") || (link.target && link.target !== "_self")) return;

    const from = normalizedPath(location.pathname);
    const to = new URL(link.href);
    const targetKind = detailKind(to.pathname);
    const entersDetail = targetKind === withoutLanguage(from) || withoutLanguage(from) === "/" || (withoutLanguage(from) === "/portfolio" && targetKind === "/projects");
    if (to.origin !== location.origin || !targetKind || !entersDetail) return;

    sessionStorage.setItem(returnContextKey, JSON.stringify({
      from,
      to: to.href,
      historyIndex: history.state?.index,
    }));
  }, { capture: true });

  document.addEventListener("astro:before-swap", (event) => {
    const fromList = listKind(event.from.pathname);
    const toList = listKind(event.to.pathname);
    const fromDetail = detailKind(event.from.pathname);
    const toDetail = detailKind(event.to.pathname);
    const opensDetailFromHome = withoutLanguage(normalizedPath(event.from.pathname)) === "/" && !!toDetail;

    if (toDetail && (fromList === toDetail || opensDetailFromHome)) {
      event.newDocument.documentElement.dataset.detailTransition = "open";
      event.newDocument.documentElement.dataset.detailTransitionKind = toDetail.slice(1);
    } else if (fromDetail && (fromDetail === toList || withoutLanguage(normalizedPath(event.to.pathname)) === "/")) {
      event.newDocument.documentElement.dataset.detailTransition = "close";
      event.newDocument.documentElement.dataset.detailTransitionKind = fromDetail.slice(1);
    }

    if (toDetail === "/writing" && document.querySelector(".is-writing-transition")) {
      event.newDocument.documentElement.dataset.writingTitleTransition = "";
    } else if (fromDetail === "/writing" && event.newDocument.documentElement.dataset.detailTransition === "close") {
      let source: WritingSource | null = null;
      try { source = JSON.parse(sessionStorage.getItem(writingSourceKey) ?? "null"); } catch { /* Ignore stale navigation data. */ }
      const samePage = (left: string, right: URL) => {
        try {
          const url = new URL(left);
          return url.origin === right.origin && normalizedPath(url.pathname) === normalizedPath(right.pathname) && url.search === right.search;
        } catch { return false; }
      };
      if (source && samePage(source.from, event.to) && samePage(source.to, event.from)
        && Number.isFinite(source.scrollX) && Number.isFinite(source.scrollY)) {
        const row = writingRow(event.newDocument, event.from.href);
        if (row) {
          row.classList.add("is-writing-transition");
          event.newDocument.documentElement.dataset.writingTitleTransition = "";
          const { scrollX, scrollY } = source;
          document.addEventListener("astro:after-swap", () => {
            window.scrollTo({ left: scrollX, top: scrollY, behavior: "instant" });
          }, { once: true });
        }
      }
    }
    const finish = () => {
      document.querySelectorAll(".is-writing-transition").forEach((row) => row.classList.remove("is-writing-transition"));
      delete document.documentElement.dataset.writingTitleTransition;
    };
    void event.viewTransition.finished.then(finish, finish);
  });

  const clearStaleReturn = () => {
    const stored = sessionStorage.getItem(returnContextKey);
    if (!stored) return;
    try {
      const context = JSON.parse(stored) as { to?: string };
      if (context.to) {
        const target = new URL(context.to);
        if (target.origin === location.origin && normalizedPath(target.pathname) === normalizedPath(location.pathname) && target.search === location.search) return;
      }
    } catch {
      // A stale or malformed entry must not affect a later detail visit.
    }
    sessionStorage.removeItem(returnContextKey);
  };

  clearStaleReturn();
  document.addEventListener("astro:page-load", clearStaleReturn);
}
