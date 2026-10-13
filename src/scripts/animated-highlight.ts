type AnimatedHighlightElement = HTMLElement & { highlightCleanup?: () => void };

const initializeHighlights = () => {
  document.querySelectorAll<AnimatedHighlightElement>("[data-animated-highlight]").forEach((root) => {
    if (root.highlightCleanup) return;
    const paths = [...root.querySelectorAll<SVGPathElement>("path")];
    const controller = new AbortController();
    const options = { signal: controller.signal };
    const reduced = matchMedia("(prefers-reduced-motion: reduce)");
    const hoverable = matchMedia("(hover: hover) and (pointer: fine)");
    const animations = new Map<SVGPathElement, Animation>();
    let hovering = false;
    let active = false;
    const timing = (name: string) => Number.parseFloat(getComputedStyle(root).getPropertyValue(name)) || 0;

    const cancelAll = () => {
      animations.forEach((animation) => animation.cancel());
      animations.clear();
    };
    const update = () => {
      const keyboardFocus = root.matches(":focus-visible");
      const nextActive = hovering || keyboardFocus;
      if (reduced.matches || keyboardFocus) {
        active = nextActive;
        cancelAll();
        return;
      }
      if (nextActive === active) return;
      const fresh = nextActive && animations.size === 0;
      active = nextActive;
      paths.forEach((path, index) => {
        // Sample before cancellation: leave/re-enter starts at the visible stroke.
        const style = getComputedStyle(path);
        const from = fresh ? { strokeDashoffset: "1", opacity: "0" } : {
          strokeDashoffset: style.strokeDashoffset,
          opacity: style.opacity,
        };
        animations.get(path)?.cancel();
        const duration = nextActive ? timing(index === 0 ? "--duration-highlight-draw" : "--duration-highlight-glint") : timing("--duration-quick");
        const delay = fresh && index > 0 ? Number.parseFloat(style.getPropertyValue("--draw-delay")) || 0 : 0;
        const animation = path.animate([from, { strokeDashoffset: "0", opacity: "1" }], {
          duration,
          delay,
          easing: getComputedStyle(root).getPropertyValue(nextActive ? "--ease-highlight-draw" : "--ease-smooth-out").trim(),
          fill: "both",
        });
        animations.set(path, animation);
        void animation.finished.then(() => {
          if (animations.get(path) !== animation) return;
          animations.delete(path);
          animation.cancel();
        }).catch(() => {});
      });
    };
    root.addEventListener("pointerenter", (event) => {
      if (event.pointerType === "touch" || !hoverable.matches) return;
      hovering = true;
      update();
    }, options);
    root.addEventListener("pointerleave", () => { hovering = false; update(); }, options);
    root.addEventListener("focus", update, options);
    root.addEventListener("blur", update, options);
    reduced.addEventListener("change", update, options);
    root.highlightCleanup = () => {
      controller.abort();
      cancelAll();
      delete root.highlightCleanup;
    };
  });
};

initializeHighlights();
document.addEventListener("astro:page-load", initializeHighlights);
document.addEventListener("astro:before-swap", () => {
  document.querySelectorAll<AnimatedHighlightElement>("[data-animated-highlight]").forEach((root) => root.highlightCleanup?.());
});

export {};
