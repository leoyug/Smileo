import { cssTimeToMilliseconds } from "../lib/css-time";

const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
const revealThreshold = 0.35;
const observer = "IntersectionObserver" in window
  ? new IntersectionObserver((entries, observer) => {
      for (const { target, intersectionRatio } of entries) {
        if (intersectionRatio < revealThreshold || !(target instanceof AppTimeline)) continue;
        observer.unobserve(target);
        target.play();
      }
    }, { threshold: revealThreshold })
  : undefined;

// Cubic ramps match the cruising speed where the end segments meet the middle.
const entryPosition = 24 / 592;
const exitPosition = 1 - entryPosition;
const edgeDuration = 180;
const cruiseDuration = 1360;
const drawDuration = edgeDuration + cruiseDuration;
const duration = drawDuration + edgeDuration;
const playbackRate = duration / 2000;
const travel = [
  { position: 0, offset: 0, easing: "cubic-bezier(.333333, 0, .666667, 0)" },
  { position: entryPosition, offset: edgeDuration / duration, easing: "linear" },
  { position: exitPosition, offset: drawDuration / duration, easing: "cubic-bezier(.333333, 1, .666667, 1)" },
  { position: 1, offset: 1 },
];
const scaleEasing = (() => {
  // Sample one damped response so the scale starts and settles at rest.
  const damping = 5.3;
  const cycle = 2 * Math.PI;
  const settled = 1 - Math.exp(-damping);
  const steps = 32;
  const stops = Array.from({ length: steps + 1 }, (_, index) => {
    const time = index / steps;
    const angle = cycle * time;
    const displacement = 1 - Math.exp(-damping * time) *
      (Math.cos(angle) + damping / cycle * Math.sin(angle));
    return (displacement / settled).toFixed(5);
  });
  const curve = `linear(${stops.join(", ")})`;
  return CSS.supports("animation-timing-function", curve) ? curve : "ease-out";
})();

class AppTimeline extends HTMLElement {
  #animations: Animation[] = [];
  #replay: HTMLButtonElement | null = null;

  connectedCallback() {
    this.#replay = this.querySelector<HTMLButtonElement>("[data-timeline-replay]");
    this.#replay?.addEventListener("click", this.#playAgain);
    if (!observer || reducedMotion.matches || !this.animate || this.dataset.timelineMotion) return;
    this.dataset.timelineMotion = "pending";
    observer.observe(this);
  }

  disconnectedCallback() {
    this.#replay?.removeEventListener("click", this.#playAgain);
    observer?.unobserve(this);
    if (this.dataset.timelineMotion === "pending") delete this.dataset.timelineMotion;
    if (this.#animations.length) this.#finish();
  }

  #finish = () => {
    this.dataset.timelineMotion = "played";
    reducedMotion.removeEventListener("change", this.#finish);
    for (const animation of this.#animations) {
      animation.onfinish = null;
      animation.cancel();
    }
    this.#animations = [];
    if (this.#replay) {
      this.#replay.hidden = false;
      this.#replay.removeAttribute("aria-disabled");
    }
  };

  #playAgain = () => {
    if (this.dataset.timelineMotion === "played" && !reducedMotion.matches) this.play();
  };

  play() {
    const state = this.dataset.timelineMotion;
    if (state !== "pending" && state !== "played") return;
    const line = this.querySelector<HTMLElement>(".app-timeline__line");
    const arrow = this.querySelector<HTMLElement>(".app-timeline__arrow");
    const nodes = [...this.querySelectorAll<HTMLElement>(".app-timeline__node")];
    const { left, width } = this.getBoundingClientRect();
    if (reducedMotion.matches || !line || !arrow || !nodes.length || !width) {
      this.#finish();
      return;
    }

    // Measure the layout boxes so a hovered node cannot alter replay timing.
    const geometry = nodes.map((node) => (node.parentElement ?? node).getBoundingClientRect());
    const diameter = geometry[geometry.length - 1].width;
    const leadTime = (x: number) => edgeDuration +
      ((x - left) / width - entryPosition) / (exitPosition - entryPosition) * cruiseDuration;
    const styles = getComputedStyle(this);
    const easing = styles.getPropertyValue("--primitive-ease-in-out").trim();
    const grow = cssTimeToMilliseconds(styles.getPropertyValue("--duration-fast"));
    const dim = cssTimeToMilliseconds(styles.getPropertyValue("--duration-quick"));
    const startTime = document.timeline.currentTime;
    const animate = (element: HTMLElement, frames: Keyframe[], timing: KeyframeAnimationOptions) => {
      const animation = element.animate(frames, { fill: "both", ...timing });
      animation.playbackRate = playbackRate;
      animation.startTime = startTime;
      this.#animations.push(animation);
      return animation;
    };

    this.dataset.timelineMotion = "playing";
    this.#replay?.setAttribute("aria-disabled", "true");
    animate(line, travel.map(({ position, ...timing }) => ({
      ...timing,
      clipPath: `inset(0 ${(1 - position) * 100}% 0 0)`,
    })), { duration });
    const arrowAnimation = animate(arrow, travel.map(({ position, ...timing }) => ({
      ...timing,
      opacity: 1,
      transform: `translateX(${(position - 1) * 100}%)`,
    })), { duration });

    nodes.forEach((node, index) => {
      const bounds = geometry[index];
      const peak = diameter / bounds.width;
      const arrival = leadTime(bounds.left);
      const appearance = { transform: `scale(${peak * 0.62})`, opacity: 0, easing: scaleEasing };
      const expanded = { transform: `scale(${peak})`, opacity: 1 };
      const highlight = node.querySelector<HTMLElement>(".app-timeline__face--lit");
      if (!highlight) {
        animate(node, [appearance, expanded], { delay: arrival, duration: grow });
        return;
      }

      // Settle only once the traveling tip has cleared the expanded circle.
      const departure = leadTime(bounds.left + (bounds.width + diameter) / 2);
      const settle = Math.max(grow, departure - arrival);
      const nodeDuration = settle + grow;
      animate(node, [
        appearance,
        { ...expanded, offset: grow / nodeDuration },
        { ...expanded, offset: settle / nodeDuration, easing: scaleEasing },
        { transform: "scale(1)", opacity: 1 },
      ], { delay: arrival, duration: nodeDuration });
      animate(highlight, [{ opacity: 1 }, { opacity: 0 }], {
        delay: arrival + nodeDuration,
        duration: dim,
        easing,
      });
    });

    reducedMotion.addEventListener("change", this.#finish, { once: true });
    arrowAnimation.onfinish = this.#finish;
  }
}

if (!customElements.get("app-timeline")) customElements.define("app-timeline", AppTimeline);
