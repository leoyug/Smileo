import { withoutLanguage } from "../i18n/runtime";
interface ProjectReturnContext {
  source: string;
  from: string;
  to: string;
  scrollX: number;
  scrollY: number;
  mediaTransform?: string;
}

const sourceKey = "project-transition-source";
const rememberSource = (source: string, href: string, element: HTMLElement) => {
  const media = element.querySelector<HTMLElement>(".project-card__media");
  const mediaTransform = media ? getComputedStyle(media).transform : undefined;
  if (mediaTransform) element.style.setProperty("--project-transition-media-transform", mediaTransform);
  const context: ProjectReturnContext = {
    source,
    from: location.href,
    to: new URL(href, location.href).href,
    scrollX: window.scrollX,
    scrollY: window.scrollY,
    mediaTransform,
  };
  sessionStorage.setItem(sourceKey, JSON.stringify(context));
};

const initializeProjectTransitions = () => {
  const links = document.querySelectorAll<HTMLElement>("[data-project-transition]");
  const featuredLinks = document.querySelectorAll<HTMLElement>(".project-card");

  links.forEach((link) => {
    if (link.dataset.transitionReady === "true") return;
    link.dataset.transitionReady = "true";

    const markAsSource = (event: MouseEvent | PointerEvent) => {
      if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      links.forEach((item) => item.classList.remove("is-transitioning"));
      featuredLinks.forEach((item) => item.classList.remove("is-transitioning"));
      link.classList.add("is-transitioning");
      const source = link.dataset.projectSource;
      if (source && link instanceof HTMLAnchorElement) rememberSource(source, link.href, link);
    };

    link.addEventListener("pointerdown", markAsSource, { passive: true });
    link.addEventListener("click", markAsSource);
  });

  featuredLinks.forEach((link) => {
    if (link.dataset.transitionReady === "true") return;
    link.dataset.transitionReady = "true";

    const clearSource = (event: MouseEvent | PointerEvent) => {
      if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const anchor = (event.target as Element).closest<HTMLAnchorElement>("a[href]");
      if (!anchor || !link.contains(anchor)) return;

      links.forEach((item) => item.classList.remove("is-transitioning"));
      featuredLinks.forEach((item) => item.classList.remove("is-transitioning"));
      link.classList.add("is-transitioning");
      const href = anchor.getAttribute("href");
      if (href) rememberSource(`featured:${href}`, href, link);
    };

    link.addEventListener("pointerdown", clearSource, { passive: true });
    link.addEventListener("click", clearSource);
  });
};

const finishProjectTransition = () => {
  // Let the shared cover finish before the live stack settles back to rest.
  requestAnimationFrame(() => {
    document.querySelectorAll("[data-project-archive-list] .is-transitioning").forEach((row) => row.classList.remove("is-transitioning"));
    document.querySelectorAll<HTMLElement>(".project-card.is-transitioning").forEach((card) => {
      card.classList.remove("is-transitioning");
      card.style.removeProperty("--project-transition-media-transform");
    });
    sessionStorage.removeItem("project-transition-source");
  });
};

initializeProjectTransitions();
document.addEventListener("astro:before-preparation", (event) => {
  if (!/^\/(?:en\/)?projects\/[^/]+\/?$/.test(event.from.pathname)
    || !["/", "/projects"].includes(withoutLanguage(event.to.pathname.replace(/\/+$/, "") || "/"))) return;
  // Stop an unfinished directory smooth scroll on the outgoing document.
  window.scrollTo({ left: window.scrollX, top: window.scrollY, behavior: "instant" });
});
document.addEventListener("astro:page-load", () => {
  initializeProjectTransitions();
  const list = document.querySelector("[data-project-archive-list]");
  if (list && !document.querySelector(".project-archive-row.is-transitioning, .project-card.is-transitioning")) {
    sessionStorage.removeItem("project-transition-source");
  }
});
document.addEventListener("astro:before-swap", (event) => {
  const list = event.newDocument.querySelector("[data-project-archive-list]");
  if (!list && !event.newDocument.querySelector(".project-card")) return;

  let context: ProjectReturnContext | null = null;
  try {
    const stored = sessionStorage.getItem(sourceKey);
    context = stored ? JSON.parse(stored) : null;
  } catch {
    // Old or malformed source entries cannot restore a previous visit.
  }
  const returningFromDetail = /^\/(?:en\/)?projects\/[^/]+\/?$/.test(event.from.pathname);
  const samePage = (left: URL, right: URL) => left.origin === right.origin
    && left.pathname.replace(/\/+$/, "") === right.pathname.replace(/\/+$/, "")
    && left.search === right.search;
  if (!context || typeof context.source !== "string" || !Number.isFinite(context.scrollX) || !Number.isFinite(context.scrollY)
    || typeof context.from !== "string" || typeof context.to !== "string"
    || !returningFromDetail || !samePage(new URL(context.from, location.href), event.to)
    || !samePage(new URL(context.to, location.href), event.from)) {
    sessionStorage.removeItem("project-transition-source");
    return;
  }

  const source = context.source;
  // Astro restores history before after-swap; use the captured entry position
  // before the new snapshot so the shared image lands at its original place.
  const { scrollX, scrollY } = context;
  document.addEventListener("astro:after-swap", () => {
    const restore = () => {
      if (event.signal.aborted || !samePage(new URL(location.href), event.to)) return;
      window.scrollTo({ left: scrollX, top: scrollY, behavior: "instant" });
    };
    restore();
    // Confirm after the browser applies its first history-restoration frame.
    requestAnimationFrame(restore);
  }, { once: true });

  if (source.startsWith("featured:")) {
    const href = source.slice("featured:".length);
    const card = Array.from(event.newDocument.querySelectorAll<HTMLElement>(".project-card"))
      .find((item) => item.querySelector<HTMLAnchorElement>("a[href]")?.getAttribute("href") === href);
    card?.classList.add("is-transitioning");
    if (context.mediaTransform) card?.style.setProperty("--project-transition-media-transform", context.mediaTransform);
  } else {
    const selector = `[data-project-source="${CSS.escape(source)}"]`;
    list?.querySelector(selector)?.classList.add("is-transitioning");
  }

  void event.viewTransition.finished.then(finishProjectTransition, finishProjectTransition);
});
