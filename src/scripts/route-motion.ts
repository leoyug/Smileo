import { gsap } from "gsap";
import { cssTimeToMilliseconds } from "../lib/css-time";

declare global {
  interface Window {
    __incessantRouteMotionCleanup?: () => void;
  }
}

const durationInSeconds = (value: string) => cssTimeToMilliseconds(value) / 1000;

const getEntranceTargets = (main: HTMLElement) => {
  const targets = Array.from(main.querySelectorAll<HTMLElement>("[data-route-enter]"));
  main.querySelectorAll<HTMLElement>("[data-route-enter-group]").forEach((group) => {
    targets.push(...Array.from(group.children).filter((element): element is HTMLElement => element instanceof HTMLElement));
  });
  main.querySelectorAll<HTMLElement>("[data-route-enter-body]").forEach((body) => {
    // Treat lists, quotes and figures as single blocks, without moving children twice.
    targets.push(...Array.from(body.children).filter((element): element is HTMLElement => element instanceof HTMLElement));
  });

  if (targets.length > 0) {
    // Groups and individual items share one document-order sequence. Never
    // animate a parent and its child together (which would compound the blur).
    return [...new Set(targets)]
      .filter((target) => !target.matches(".is-transitioning, .is-writing-transition"))
      .filter((target) => !targets.some((other) => other !== target && other.contains(target)))
      .sort((left, right) => left.compareDocumentPosition(right) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1);
  }

  return Array.from(main.children)
    .filter((element): element is HTMLElement => element instanceof HTMLElement)
    .filter((element) => !element.hasAttribute("data-route-enter-exempt"))
    .slice(0, 6);
};

export function initRouteMotion() {
  window.__incessantRouteMotionCleanup?.();

  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  let targets: HTMLElement[] = [];
  let entrancePrepared = false;
  let entranceFrame = 0;
  let viewportObserver: IntersectionObserver | undefined;
  const pendingTargets = new Set<HTMLElement>();
  let motion = { duration: 0.84, stagger: 0.07, staggerMax: 0.42, distance: 16, blur: 4 };
  const entranceProps = "transform,visibility,opacity,filter";

  const resetEntrance = () => {
    entrancePrepared = false;
    cancelAnimationFrame(entranceFrame);
    viewportObserver?.disconnect();
    viewportObserver = undefined;
    pendingTargets.clear();
    if (targets.length > 0) {
      gsap.killTweensOf(targets);
      gsap.set(targets, { clearProps: entranceProps });
    }
  };

  const prepareEntrance = () => {
    resetEntrance();
    const { detailTransition } = document.documentElement.dataset;
    if (reducedMotion.matches) return;

    const main = document.querySelector<HTMLElement>("[data-route-main]");
    if (!main) return;

    // Inactive photo variants that are display:none keep their normal styles.
    targets = getEntranceTargets(main)
      .filter((target) => target.getClientRects().length > 0)
      // Opening a detail keeps the cover/title transition; its body enters independently.
      .filter((target) => detailTransition !== "open" || target.parentElement?.hasAttribute("data-route-enter-body"));
    if (targets.length === 0) return;
    const styles = getComputedStyle(document.documentElement);
    motion = {
      duration: durationInSeconds(styles.getPropertyValue("--duration-route-enter")),
      stagger: durationInSeconds(styles.getPropertyValue("--duration-route-stagger")),
      staggerMax: durationInSeconds(styles.getPropertyValue("--duration-route-stagger-max")),
      distance: detailTransition === "close" ? 0 : parseFloat(styles.getPropertyValue("--distance-route-enter")),
      blur: parseFloat(styles.getPropertyValue("--blur-route-enter")),
    };
    // Keep content present while it settles into focus; no blank loading phase.
    gsap.set(targets, { autoAlpha: 0.15, y: motion.distance, filter: `blur(${motion.blur}px)` });
    entrancePrepared = targets.length > 0;
  };

  const animateTargets = (batch: HTMLElement[]) => {
    if (batch.length === 0) return;
    gsap.to(batch, {
      autoAlpha: 1,
      y: 0,
      filter: "blur(0px)",
      duration: motion.duration,
      ease: "power3.out",
      stagger: Math.min(motion.stagger, motion.staggerMax / Math.max(1, batch.length - 1)),
      overwrite: "auto",
      clearProps: entranceProps,
    });
  };

  const playEntrance = () => {
    if (reducedMotion.matches || !entrancePrepared || targets.length === 0) return;
    entrancePrepared = false;

    const immediate: HTMLElement[] = [];
    for (const target of targets) {
      if (!target.closest("[data-route-enter-viewport]") || !("IntersectionObserver" in window)) {
        immediate.push(target);
        continue;
      }
      const bounds = target.getBoundingClientRect();
      if (bounds.bottom <= 0) {
        // History restoration must not leave already-passed content dimmed.
        gsap.set(target, { clearProps: entranceProps });
      } else if (bounds.top < window.innerHeight) {
        immediate.push(target);
      } else {
        pendingTargets.add(target);
      }
    }
    animateTargets(immediate);

    if (pendingTargets.size === 0) return;
    viewportObserver = new IntersectionObserver((entries) => {
      const visible = new Set(entries.filter((entry) => entry.isIntersecting).map((entry) => entry.target));
      // Preserve document order when several items cross the viewport together.
      const batch = targets.filter((target) => pendingTargets.has(target) && visible.has(target));
      for (const target of batch) {
        pendingTargets.delete(target);
        viewportObserver?.unobserve(target);
      }
      animateTargets(batch);
      if (pendingTargets.size === 0) {
        viewportObserver?.disconnect();
        viewportObserver = undefined;
      }
    });
    pendingTargets.forEach((target) => viewportObserver!.observe(target));
  };

  const onFocusIn = (event: FocusEvent) => {
    if (!(event.target instanceof Node)) return;
    for (const target of targets) {
      if (!target.contains(event.target)) continue;
      pendingTargets.delete(target);
      viewportObserver?.unobserve(target);
      gsap.killTweensOf(target);
      gsap.set(target, { clearProps: entranceProps });
    }
  };

  prepareEntrance();
  entranceFrame = requestAnimationFrame(playEntrance);
  document.addEventListener("astro:before-swap", resetEntrance);
  document.addEventListener("astro:after-swap", prepareEntrance);
  document.addEventListener("astro:page-load", playEntrance);
  document.addEventListener("focusin", onFocusIn);
  const onMotionPreferenceChange = () => {
    if (reducedMotion.matches) resetEntrance();
  };
  reducedMotion.addEventListener("change", onMotionPreferenceChange);

  window.__incessantRouteMotionCleanup = () => {
    document.removeEventListener("astro:before-swap", resetEntrance);
    document.removeEventListener("astro:after-swap", prepareEntrance);
    document.removeEventListener("astro:page-load", playEntrance);
    document.removeEventListener("focusin", onFocusIn);
    reducedMotion.removeEventListener("change", onMotionPreferenceChange);
    cancelAnimationFrame(entranceFrame);
    resetEntrance();
  };
}
