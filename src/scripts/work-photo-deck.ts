import { uiText } from "../i18n/runtime";
import type { PhotoStackPhoto } from "../lib/photo-stack-types";
import { cssTimeToMilliseconds } from "../lib/css-time";

type DeckPhoto = Pick<PhotoStackPhoto, "src" | "alt" | "width" | "height">;

const offsets = [
  [0, 0, 0, 1],
  [5, 2, 6, .95],
  [-5, 2, -7, .91],
  [3, -4, 3, .89],
  [-3, -3, -4, .87],
] as const;

function pose(depth: number, x = 0, y = 0, tilt = 0) {
  const [left, top, rotation, scale] = offsets[Math.min(depth, offsets.length - 1)];
  return `translate3d(calc(${left}% + ${x}px), calc(${top}% + ${y}px), 0) rotate(${rotation + tilt}deg) scale(${scale})`;
}

export function initializeWorkPhotoDeck(root: HTMLElement, reduced: MediaQueryList, signal: AbortSignal) {
  const stack = root.querySelector<HTMLElement>("[data-deck-stack]")!;
  const status = root.querySelector<HTMLElement>("[data-deck-status]")!;
  const options = { signal };
  const animations = new Set<Animation>();
  let cards: HTMLDivElement[] = [];
  let active = 0;
  let gesture: { id: number; x: number; y: number; dx: number; dy: number; width: number; height: number } | undefined;
  let frame = 0;
  let settling = false;
  let revision = 0;

  const wrap = (index: number) => (index + cards.length) % cards.length;
  const depth = (index: number) => wrap(index - active);

  const render = () => cards.forEach((card, index) => {
    const layer = depth(index);
    card.style.transform = pose(layer);
    card.style.zIndex = String(cards.length - layer);
    card.setAttribute("aria-hidden", String(layer !== 0));
  });

  const announce = () => {
    status.textContent = `${active + 1} / ${cards.length} · ${cards[active].querySelector("img")!.alt}`;
  };

  const stop = () => {
    revision++;
    cancelAnimationFrame(frame);
    frame = 0;
    const pointer = gesture?.id;
    gesture = undefined;
    if (pointer !== undefined && stack.hasPointerCapture(pointer)) stack.releasePointerCapture(pointer);
    delete stack.dataset.dragging;
    animations.forEach((animation) => animation.cancel());
    animations.clear();
    settling = false;
  };

  const advance = () => {
    active = wrap(active + 1);
    render();
    announce();
  };

  const dragPose = (width: number, dx: number, dy: number) => {
    const tilt = Math.max(-11, Math.min(11, dx / width * 11));
    return pose(0, dx, dy, tilt);
  };

  const drawDrag = () => {
    frame = 0;
    if (!gesture || reduced.matches) return;
    cards[active].style.transform = dragPose(gesture.width, gesture.dx, gesture.dy);
  };

  const animate = (card: HTMLElement, from: string, to: string, token: string) => {
    const styles = getComputedStyle(root);
    const animation = card.animate([{ transform: from }, { transform: to }], {
      duration: cssTimeToMilliseconds(styles.getPropertyValue(token)),
      easing: styles.getPropertyValue("--ease-smooth-out").trim(),
    });
    card.style.transform = to;
    animations.add(animation);
    return animation.finished.catch(() => {}).finally(() => animations.delete(animation));
  };

  const settle = async (shouldAdvance: boolean, width: number, height: number, dx: number, dy: number) => {
    if (settling || !cards.length) return;
    if (reduced.matches) {
      if (shouldAdvance) advance();
      return;
    }
    const epoch = revision;
    settling = true;
    render();
    const index = active;
    const card = cards[index];
    const from = dragPose(width, dx, dy);
    if (shouldAdvance) {
      // Clear the stack along the drag direction before changing layers.
      const clearance = .84 / Math.hypot(dx / width, dy / height);
      const outside = clearance > 1 ? dragPose(width, dx * clearance, dy * clearance) : from;
      if (clearance > 1) await animate(card, from, outside, "--duration-quick");
      if (epoch !== revision) return;
      const before = cards.map((_, position) => pose(depth(position)));
      advance();
      await Promise.all(cards.map((photo, position) =>
        animate(photo, position === index ? outside : before[position], pose(depth(position)), "--duration-fast"),
      ));
    } else {
      await animate(card, from, pose(depth(index)), "--duration-quick");
    }
    if (epoch === revision) settling = false;
  };

  const finishGesture = (event: PointerEvent, commit: boolean) => {
    if (!gesture || gesture.id !== event.pointerId) return;
    const { width, height } = gesture;
    const dx = commit ? event.clientX - gesture.x : gesture.dx;
    const dy = commit ? event.clientY - gesture.y : gesture.dy;
    stop();
    const threshold = Math.min(64, width * .16);
    const shouldAdvance = commit && Math.hypot(dx, dy) >= threshold;
    void settle(shouldAdvance, width, height, dx, dy);
  };

  stack.addEventListener("pointerdown", (event) => {
    if (event.button !== 0 || !event.isPrimary || settling || gesture) return;
    gesture = {
      id: event.pointerId, x: event.clientX, y: event.clientY, dx: 0, dy: 0,
      width: stack.clientWidth, height: stack.clientHeight,
    };
    stack.setPointerCapture(event.pointerId);
    stack.dataset.dragging = "";
  }, options);
  stack.addEventListener("pointermove", (event) => {
    if (!gesture || gesture.id !== event.pointerId) return;
    gesture.dx = event.clientX - gesture.x;
    gesture.dy = event.clientY - gesture.y;
    if (!frame) frame = requestAnimationFrame(drawDrag);
  }, options);
  stack.addEventListener("pointerup", (event) => finishGesture(event, true), options);
  stack.addEventListener("pointercancel", (event) => finishGesture(event, false), options);
  stack.addEventListener("lostpointercapture", (event) => finishGesture(event, false), options);
  root.closest("dialog")?.addEventListener("keydown", (event) => {
    if (root.hidden || !cards.length || root.closest("[data-stack-detail]")?.hasAttribute("hidden")) return;
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    event.preventDefault();
    if (!settling && !gesture) advance();
  }, options);
  reduced.addEventListener("change", () => { stop(); render(); }, options);
  signal.addEventListener("abort", stop, { once: true });

  root.setAttribute("aria-label", uiText("展览照片", "Exhibition photos"));

  return {
    show(photos: readonly DeckPhoto[]) {
      stop();
      active = 0;
      cards = photos.map((photo) => {
        const card = document.createElement("div");
        card.dataset.deckCard = "";
        card.style.setProperty("--deck-ratio", String(photo.width / photo.height));
        const img = new Image(photo.width, photo.height);
        img.alt = photo.alt;
        img.draggable = false;
        img.decoding = "async";
        img.src = photo.src;
        card.append(img);
        return card;
      });
      stack.replaceChildren(...cards);
      root.hidden = false;
      render();
      announce();
    },
    hide() {
      stop();
      root.hidden = true;
      stack.replaceChildren();
      cards = [];
    },
  };
}
