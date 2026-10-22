type ProjectFiltersElement = HTMLElement & { projectFiltersCleanup?: () => void };

const selectedCategory = (root: HTMLElement) => {
  const key = root.dataset.projectFilterKey;
  if (key) {
    try { return sessionStorage.getItem(`project-filter:${key}`) ?? "all"; } catch { /* Storage is optional. */ }
  }
  return "all";
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

// beUI's selected-icon tabs use this non-overshooting spring (MIT).
// Sample its response for native WAAPI playback without a frame-by-frame JS loop.
const springEasing = (duration: number) => {
  const stiffness = 245;
  const damping = 36;
  const mass = 1.2;
  const decay = damping / (2 * mass);
  const root = Math.sqrt(decay ** 2 - stiffness / mass);
  const slow = -decay + root;
  const fast = -decay - root;
  const response = (t: number) => 1 + (fast * Math.exp(slow * t) - slow * Math.exp(fast * t)) / (slow - fast);
  const end = response(duration / 1000);
  return `linear(${Array.from({ length: 41 }, (_, index) => (response(duration * index / 40000) / end).toFixed(5)).join(", ")})`;
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
    const slots = [...root.querySelectorAll<HTMLElement>("[data-project-filter-icon]")];
    const reduce = matchMedia("(prefers-reduced-motion: reduce)");
    const styles = getComputedStyle(root);
    const durationValue = styles.getPropertyValue("--duration-very-slow").trim();
    const duration = parseFloat(durationValue) * (durationValue.endsWith("ms") ? 1 : 1000);
    const spring = springEasing(duration);
    const easing = CSS.supports("animation-timing-function", spring) ? spring : styles.getPropertyValue("--ease-smooth-out").trim();
    let animations: Animation[] = [];
    let motionEpoch = 0;
    const cancelMotion = () => {
      motionEpoch++;
      const effects = new Set([
        ...animations,
        ...slots.flatMap((slot) => slot.getAnimations()),
        ...(active?.getAnimations() ?? []),
      ]);
      effects.forEach((animation) => {
        animation.onfinish = null;
        animation.cancel();
      });
      animations = [];
    };
    applyCategory(root, selectedCategory(root));
    positionActiveTab(root);
    const track = root.querySelector<HTMLElement>("[data-project-filter-track]");
    const resizeObserver = new ResizeObserver(() => {
      if (!animations.some((animation) => animation.playState === "running")) positionActiveTab(root);
    });
    if (track) resizeObserver.observe(track);

    const select = (tab: HTMLButtonElement, animate = false) => {
      if (tab.getAttribute("aria-selected") === "true") return;
      const shouldAnimate = animate && !matchMedia("(prefers-reduced-motion: reduce)").matches && active && typeof active.animate === "function";
      const previousClip = shouldAnimate ? getComputedStyle(active).clipPath : "";
      const previousSlots = shouldAnimate ? slots.map((slot) => {
        const style = getComputedStyle(slot);
        return { width: style.width, opacity: style.opacity };
      }) : [];
      // Capture the displayed values before cancelling an interrupted selection.
      cancelMotion();
      const value = applyCategory(root, tab.dataset.projectFilterValue ?? "all", true);
      positionActiveTab(root);
      if (track) track.dataset.motion = shouldAnimate ? "animate" : "instant";
      if (shouldAnimate) {
        const nextClip = getComputedStyle(active).clipPath;
        const nextSlots = slots.map((slot) => {
          const style = getComputedStyle(slot);
          return { width: style.width, opacity: style.opacity };
        });
        const options = { duration, easing };
        const startTime = document.timeline.currentTime;
        // Width intentionally changes the four-label flow, like the reference.
        // Layout is contained to this short track; labels and icons stay unscaled.
        animations = slots.map((slot, index) => slot.animate([previousSlots[index], nextSlots[index]], options));
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
  event.newDocument.querySelectorAll<HTMLElement>("[data-project-filters]").forEach((root) => applyCategory(root, selectedCategory(root)));
});

export {};
