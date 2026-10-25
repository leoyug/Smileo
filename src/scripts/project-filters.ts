type ProjectFiltersElement = HTMLElement & { projectFiltersCleanup?: () => void };

const selectedCategory = (root: HTMLElement) => {
  const key = root.dataset.projectFilterKey;
  if (key) {
    try { return sessionStorage.getItem(`project-filter:${key}`) ?? "all"; } catch { /* Storage is optional. */ }
  }
  return "all";
};

const setPanelSpace = (root: HTMLElement, height: number) => {
  const panel = root.querySelector<HTMLElement>("[data-project-filter-panel]");
  if (!panel) return;
  panel.style.minHeight = height > 0 ? `${height}px` : "";
  const key = root.dataset.projectFilterKey;
  if (key) {
    try {
      if (height > 0) sessionStorage.setItem(`project-filter-space:${key}`, String(height));
      else sessionStorage.removeItem(`project-filter-space:${key}`);
    } catch { /* Storage is optional. */ }
  }
};

const restorePanelSpace = (root: HTMLElement) => {
  const key = root.dataset.projectFilterKey;
  if (!key) return;
  try {
    const height = Number(sessionStorage.getItem(`project-filter-space:${key}`));
    if (Number.isFinite(height) && height > 0) setPanelSpace(root, height);
  } catch { /* Storage is optional. */ }
};

const reservePanelSpace = (root: HTMLElement) => {
  const panel = root.querySelector<HTMLElement>("[data-project-filter-panel]");
  if (!panel) return;
  const height = panel.getBoundingClientRect().height;
  const spare = document.documentElement.scrollHeight - window.innerHeight - window.scrollY;
  // Keep only the space needed to make the current scroll position reachable.
  // Reserve it before hiding rows: restoring scrollY afterwards is too late.
  setPanelSpace(root, window.scrollY > 0 ? Math.ceil(Math.max(0, height - spare)) : 0);
};

const applyCategory = (root: HTMLElement, category: string, announce = false) => {
  const tabs = [...root.querySelectorAll<HTMLButtonElement>("[data-project-filter-value]")];
  const selected = tabs.find((tab) => tab.dataset.projectFilterValue === category) ?? tabs[0];
  if (!selected) return;
  const value = selected.dataset.projectFilterValue ?? "all";
  let count = 0;
  root.querySelectorAll<HTMLElement>("[data-project-category]").forEach((item) => {
    item.hidden = value !== "all" && item.dataset.projectCategory !== value;
    if (!item.hidden) count++;
  });
  tabs.forEach((tab) => {
    const active = tab === selected;
    tab.setAttribute("aria-selected", String(active));
    tab.tabIndex = active ? 0 : -1;
  });
  root.querySelectorAll<HTMLElement>("[data-project-filter-copy-value]").forEach((copy) => {
    copy.dataset.selected = String(copy.dataset.projectFilterCopyValue === value);
  });
  root.querySelector("[data-project-filter-panel]")?.setAttribute("aria-labelledby", selected.id);
  const empty = root.querySelector<HTMLElement>("[data-project-filter-empty]");
  if (empty) empty.hidden = count > 0;
  const tabList = root.querySelector<HTMLElement>("[data-project-filter-tabs]");
  if (tabList) tabList.hidden = false;
  if (announce) {
    const status = root.querySelector<HTMLElement>("[data-project-filter-status]");
    if (status) status.textContent = `${selected.textContent?.trim()}，显示 ${count} 个项目`;
  }
  return value;
};

const positionActiveTab = (root: HTMLElement) => {
  const track = root.querySelector<HTMLElement>("[data-project-filter-track]");
  const active = root.querySelector<HTMLElement>("[data-project-filter-active]");
  const tab = root.querySelector<HTMLElement>('[data-project-filter-value][aria-selected="true"]');
  if (!track || !active || !tab || !track.clientWidth) return;
  const top = tab.offsetTop;
  const left = tab.offsetLeft;
  const right = track.clientWidth - left - tab.offsetWidth;
  const bottom = track.clientHeight - top - tab.offsetHeight;
  // The visual copy shares the real tabs' layout, so its text is never stretched.
  active.style.clipPath = `inset(${top}px ${right}px ${bottom}px ${left}px round var(--radius-pill))`;
  active.hidden = false;
};

const revealSelectedTab = (root: HTMLElement, behavior: ScrollBehavior = "instant") => {
  const viewport = root.querySelector<HTMLElement>("[data-project-filter-tabs]");
  const tab = root.querySelector<HTMLElement>('[data-project-filter-value][aria-selected="true"]');
  if (!viewport || !tab) return;
  const frame = viewport.getBoundingClientRect();
  const item = tab.getBoundingClientRect();
  const clearance = parseFloat(getComputedStyle(viewport).paddingInlineStart);
  const delta = item.left < frame.left + clearance ? item.left - frame.left - clearance
    : item.right > frame.right - clearance ? item.right - frame.right + clearance : 0;
  // Scroll only the tab viewport; selection must never move the whole page.
  if (delta) viewport.scrollBy({ left: delta, behavior });
};

const initializeProjectFilters = () => {
  document.querySelectorAll<ProjectFiltersElement>("[data-project-filters]").forEach((root) => {
    if (root.projectFiltersCleanup) return;
    const controller = new AbortController();
    const { signal } = controller;
    const tabs = [...root.querySelectorAll<HTMLButtonElement>("[data-project-filter-value]")];
    const active = root.querySelector<HTMLElement>("[data-project-filter-active]");
    const pieces = [...root.querySelectorAll<HTMLElement>("[data-project-filter-icon], [data-project-filter-label]")];
    const panel = root.querySelector<HTMLElement>("[data-project-filter-panel]");
    const reduce = matchMedia("(prefers-reduced-motion: reduce)");
    const styles = getComputedStyle(root);
    const durationValue = styles.getPropertyValue("--duration-fast").trim();
    const duration = parseFloat(durationValue) * (durationValue.endsWith("ms") ? 1 : 1000);
    const easing = styles.getPropertyValue("--ease-smooth-out").trim();
    let animations: Animation[] = [];
    let motionEpoch = 0;
    const cancelMotion = () => {
      motionEpoch++;
      const effects = new Set([
        ...animations,
        ...pieces.flatMap((piece) => piece.getAnimations()),
        ...(active?.getAnimations() ?? []),
      ]);
      effects.forEach((animation) => {
        animation.onfinish = null;
        animation.cancel();
      });
      animations = [];
    };
    restorePanelSpace(root);
    applyCategory(root, selectedCategory(root));
    positionActiveTab(root);
    const track = root.querySelector<HTMLElement>("[data-project-filter-track]");
    let layoutWidth = root.clientWidth;
    const resizeObserver = new ResizeObserver(() => {
      if (root.clientWidth !== layoutWidth) {
        layoutWidth = root.clientWidth;
        if (panel?.style.minHeight) reservePanelSpace(root);
      }
      if (!animations.some((animation) => animation.playState === "running")) positionActiveTab(root);
    });
    if (track) resizeObserver.observe(track);
    resizeObserver.observe(root);
    window.addEventListener("resize", () => {
      if (panel?.style.minHeight) reservePanelSpace(root);
    }, { signal });
    window.addEventListener("scroll", () => {
      if (window.scrollY === 0 && panel?.style.minHeight) setPanelSpace(root, 0);
    }, { signal, passive: true });

    const select = (tab: HTMLButtonElement, animate = false) => {
      if (tab.getAttribute("aria-selected") === "true") return;
      const { scrollX, scrollY } = window;
      const shouldAnimate = animate && !reduce.matches && active && typeof active.animate === "function";
      const previousClip = shouldAnimate ? getComputedStyle(active).clipPath : "";
      const previousPieces = shouldAnimate ? pieces.map((piece) => {
        const rect = piece.getBoundingClientRect();
        return { left: rect.left, top: rect.top, opacity: getComputedStyle(piece).opacity };
      }) : [];
      // Capture the displayed values before cancelling an interrupted selection.
      cancelMotion();
      reservePanelSpace(root);
      const value = applyCategory(root, tab.dataset.projectFilterValue ?? "all", true);
      positionActiveTab(root);
      // Flush the new layout before restoring the reachable position. This also
      // stops any browser scroll adjustment already in flight near the footer.
      window.scrollTo({ left: scrollX, top: scrollY, behavior: "instant" });
      if (track) track.dataset.motion = shouldAnimate ? "animate" : "instant";
      if (shouldAnimate) {
        const nextClip = getComputedStyle(active).clipPath;
        const nextPieces = pieces.map((piece) => ({ rect: piece.getBoundingClientRect(), opacity: getComputedStyle(piece).opacity }));
        const options = { duration, easing };
        const startTime = document.timeline.currentTime;
        // Lay out the selected icon once, then move the text and icon from their
        // displayed positions. No per-frame reflow or scaling of their contents.
        animations = pieces.map((piece, index) => piece.animate([
          {
            transform: `translate(${previousPieces[index].left - nextPieces[index].rect.left}px, ${previousPieces[index].top - nextPieces[index].rect.top}px)`,
            opacity: previousPieces[index].opacity,
          },
          { transform: "translate(0px, 0px)", opacity: nextPieces[index].opacity },
        ], options));
        const pill = active.animate([{ clipPath: previousClip }, { clipPath: nextClip }], options);
        animations.push(pill);
        animations.forEach((animation) => { animation.startTime = startTime; });
        const epoch = motionEpoch;
        pill.onfinish = () => {
          if (epoch !== motionEpoch || !root.isConnected) return;
          // Clear every owned effect before accepting another interaction.
          // A queued finish event from an interrupted run cannot clear the next run.
          cancelMotion();
          positionActiveTab(root);
          revealSelectedTab(root);
        };
      } else {
        revealSelectedTab(root);
      }
      const key = root.dataset.projectFilterKey;
      if (key && value) {
        try { sessionStorage.setItem(`project-filter:${key}`, value); } catch { /* Filtering does not require storage. */ }
      }
    };
    root.addEventListener("click", (event) => {
      const tab = event.target instanceof Element ? event.target.closest<HTMLButtonElement>("[data-project-filter-value]") : null;
      if (tab && tabs.includes(tab)) select(tab, event.detail > 0);
    }, { signal });
    root.addEventListener("keydown", (event) => {
      const index = tabs.indexOf(event.target as HTMLButtonElement);
      if (index < 0) return;
      let next: number;
      switch (event.key) {
        case "ArrowRight": next = (index + 1) % tabs.length; break;
        case "ArrowLeft": next = (index + tabs.length - 1) % tabs.length; break;
        case "Home": next = 0; break;
        case "End": next = tabs.length - 1; break;
        default: return;
      }
      event.preventDefault();
      select(tabs[next]);
      tabs[next].focus({ preventScroll: true });
      revealSelectedTab(root);
    }, { signal });
    reduce.addEventListener("change", () => {
      if (!reduce.matches) return;
      cancelMotion();
      positionActiveTab(root);
      revealSelectedTab(root);
    }, { signal });
    root.projectFiltersCleanup = () => {
      controller.abort();
      cancelMotion();
      resizeObserver.disconnect();
      delete root.projectFiltersCleanup;
    };
  });
};

initializeProjectFilters();
document.addEventListener("astro:page-load", initializeProjectFilters);
document.addEventListener("astro:before-swap", (event) => {
  document.querySelectorAll<ProjectFiltersElement>("[data-project-filters]").forEach((root) => root.projectFiltersCleanup?.());
  // Restore the filtered geometry before Astro captures the returning cover's destination.
  event.newDocument.querySelectorAll<HTMLElement>("[data-project-filters]").forEach((root) => {
    restorePanelSpace(root);
    applyCategory(root, selectedCategory(root));
  });
});

export {};
