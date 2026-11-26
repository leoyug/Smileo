type RotationRange = { min: number; max: number };
type Point = { x: number; y: number };
type Drag = {
  pointerId: number;
  pivot: Point;
  angle: number | undefined;
  time: number;
  speed: number;
};

const stepsPerTurn = 360;
const collisionStep = 2 * Math.PI / stepsPerTurn;
const coastDecay = 90; // Milliseconds for angular speed to fall to 1/e.
const minimumSpeed = .00009; // Radians per millisecond.

function angularClearance(from: number, direction: -1 | 1, fits: (angle: number) => boolean) {
  let clear = 0;
  for (let index = 1; index <= stepsPerTurn; index++) {
    const travel = index * collisionStep;
    if (fits(from + direction * travel)) {
      clear = travel;
      continue;
    }

    // Refine the contact point to well below a CSS pixel at the photo's farthest corner.
    let blocked = travel;
    for (let step = 0; step < 8; step++) {
      const middle = (clear + blocked) / 2;
      if (fits(from + direction * middle)) clear = middle;
      else blocked = middle;
    }
    return from + direction * clear;
  }
  return direction * Infinity;
}

function pointerAngle(event: PointerEvent, pivot: Point) {
  const x = event.clientX - pivot.x;
  const y = event.clientY - pivot.y;
  return Math.hypot(x, y) < 8 ? undefined : Math.atan2(y, x);
}

export function bindAvatarPortrait(dialog: HTMLDialogElement) {
  const photo = dialog.querySelector<HTMLImageElement>(".avatar-lightbox__photo");
  const orbit = dialog.querySelector<HTMLElement>(".avatar-lightbox__portrait-orbit");
  const art = orbit?.parentElement;
  const pin = art?.querySelector<HTMLElement>(".avatar-lightbox__pin-head");
  if (!photo || !orbit || !art || !pin) return;

  const obstacles = [...dialog.querySelectorAll<HTMLElement>(
    ".avatar-lightbox__card, .avatar-lightbox__location, .avatar-lightbox__close-hint, .avatar-lightbox__close",
  )];
  const listeners = new AbortController();
  const options = { signal: listeners.signal };
  const reduced = matchMedia("(prefers-reduced-motion: reduce)");

  let rotation = 0;
  let renderedRotation = 0;
  let drag: Drag | undefined;
  let limits: RotationRange = { min: -Infinity, max: Infinity };
  let frame = 0;
  let speed = 0;
  let lastFrame = 0;

  const measure = () => {
    const artRect = art.getBoundingClientRect();
    const pinRect = pin.getBoundingClientRect();
    const pivot = { x: pinRect.left + pinRect.width / 2, y: pinRect.top + pinRect.height / 2 };
    const centerX = artRect.left + artRect.width / 2 - pivot.x;
    const centerY = artRect.top + artRect.height / 2 - pivot.y;
    const scale = artRect.width / art.offsetWidth;
    const halfWidth = photo.offsetWidth * scale / 2;
    const halfHeight = photo.offsetHeight * scale / 2;
    const photoTransform = new DOMMatrixReadOnly(getComputedStyle(photo).transform);
    const restingAngle = Math.atan2(photoTransform.b, photoTransform.a);
    const dialogRect = dialog.getBoundingClientRect();
    const photoRect = photo.getBoundingClientRect();
    const left = dialogRect.left;
    const right = left + dialog.clientWidth;
    // Scrolling can already crop the print. Allow it back in without increasing the crop.
    const top = Math.min(dialogRect.top, photoRect.top);
    const bottom = Math.max(dialogRect.top + dialog.clientHeight, photoRect.bottom);
    const cards = obstacles.map((obstacle) => obstacle.getBoundingClientRect())
      .filter((rect) => rect.width > 0 && rect.height > 0)
      .map((rect) => ({
        x: rect.left + rect.width / 2,
        y: rect.top + rect.height / 2,
        halfWidth: rect.width / 2,
        halfHeight: rect.height / 2,
      }));

    function fits(angle: number) {
      const sin = Math.sin(angle);
      const cos = Math.cos(angle);
      const x = pivot.x + centerX * cos - centerY * sin;
      const y = pivot.y + centerX * sin + centerY * cos;
      const photoSin = Math.sin(restingAngle + angle);
      const photoCos = Math.cos(restingAngle + angle);
      const absSin = Math.abs(photoSin);
      const absCos = Math.abs(photoCos);
      const extentX = halfWidth * absCos + halfHeight * absSin;
      const extentY = halfWidth * absSin + halfHeight * absCos;

      if (x - extentX < left || x + extentX > right || y - extentY < top || y + extentY > bottom) return false;

      // Look for a separating axis along either the card's edges or the print's edges.
      return cards.every((card) => {
        const dx = card.x - x;
        const dy = card.y - y;
        return Math.abs(dx) >= extentX + card.halfWidth
          || Math.abs(dy) >= extentY + card.halfHeight
          || Math.abs(dx * photoCos + dy * photoSin) >= halfWidth + card.halfWidth * absCos + card.halfHeight * absSin
          || Math.abs(-dx * photoSin + dy * photoCos) >= halfHeight + card.halfWidth * absSin + card.halfHeight * absCos;
      });
    }

    // Recover a clear pose if a responsive reflow moved a card into the rotated print.
    const from = !fits(rotation) && fits(0)
      ? angularClearance(0, rotation < 0 ? -1 : 1, fits)
      : rotation;
    return {
      pivot,
      from,
      range: { min: angularClearance(from, -1, fits), max: angularClearance(from, 1, fits) },
    };
  };

  const render = () => {
    if (renderedRotation === rotation) return;
    orbit.style.transform = `rotate(${rotation}rad)`;
    renderedRotation = rotation;
  };

  const releaseCapture = () => {
    if (!drag) return;
    const { pointerId } = drag;
    drag = undefined;
    photo.removeAttribute("data-dragging");
    if (photo.hasPointerCapture(pointerId)) photo.releasePointerCapture(pointerId);
  };

  function stop() {
    cancelAnimationFrame(frame);
    frame = 0;
    speed = 0;
    rotation = renderedRotation;
    releaseCapture();
  }

  const canTurn = () => dialog.open && !dialog.hasAttribute("data-closing");
  const clamp = (angle: number) => Math.min(limits.max, Math.max(limits.min, angle));

  function draw(now: number) {
    frame = 0;
    if (!canTurn()) {
      stop();
      return;
    }
    if (speed) {
      const elapsed = Math.max(0, now - lastFrame);
      const decay = Math.exp(-elapsed / coastDecay);
      const target = rotation + speed * coastDecay * (1 - decay);
      rotation = clamp(target);
      speed = rotation === target && Math.abs(speed * decay) >= minimumSpeed ? speed * decay : 0;
      lastFrame = now;
    }
    render();
    if (speed) frame = requestAnimationFrame(draw);
  }

  function queueDraw() {
    if (!frame) frame = requestAnimationFrame(draw);
  }

  photo.addEventListener("pointerdown", (event) => {
    if (event.button !== 0 || !event.isPrimary || drag || !canTurn()) return;
    stop();
    const { pivot, from, range } = measure();
    limits = range;
    rotation = from;
    drag = { pointerId: event.pointerId, pivot, angle: pointerAngle(event, pivot), time: event.timeStamp, speed: 0 };
    photo.setPointerCapture(event.pointerId);
    photo.setAttribute("data-dragging", "");
    queueDraw();
    event.preventDefault();
  }, options);

  photo.addEventListener("pointermove", (event) => {
    if (drag?.pointerId !== event.pointerId) return;
    const angle = pointerAngle(event, drag.pivot);
    const elapsed = event.timeStamp - drag.time;
    if (angle !== undefined && drag.angle !== undefined) {
      const difference = angle - drag.angle;
      const delta = Math.atan2(Math.sin(difference), Math.cos(difference));
      const target = rotation + delta;
      rotation = clamp(target);
      const sample = Math.min(.006, Math.max(-.006, delta / Math.max(1, elapsed)));
      drag.speed = rotation === target ? sample + (drag.speed - sample) * Math.exp(-elapsed / 32) : 0;
      queueDraw();
    } else {
      drag.speed = 0;
    }
    drag.angle = angle;
    drag.time = event.timeStamp;
  }, options);

  photo.addEventListener("pointerup", (event) => {
    if (drag?.pointerId !== event.pointerId) return;
    const idle = event.timeStamp - drag.time;
    speed = !reduced.matches && idle < 80 ? drag.speed * Math.exp(-idle / 45) : 0;
    speed = Math.abs(speed) >= minimumSpeed ? speed : 0;
    lastFrame = performance.now();
    releaseCapture();
    queueDraw();
  }, options);

  for (const event of ["pointercancel", "lostpointercapture"] as const) {
    photo.addEventListener(event, ({ pointerId }) => {
      if (drag?.pointerId === pointerId) stop();
    }, options);
  }

  photo.addEventListener("keydown", (event) => {
    const direction = event.key === "ArrowLeft" ? -1 : event.key === "ArrowRight" ? 1 : 0;
    if (!canTurn() || (direction === 0 && event.key !== "Home")) return;
    event.preventDefault();
    stop();
    if (direction === 0) rotation = 0;
    else {
      const { from, range } = measure();
      limits = range;
      rotation = clamp(from + direction * Math.PI / 18);
    }
    render();
  }, options);

  window.addEventListener("resize", stop, options);
  dialog.addEventListener("scroll", stop, { ...options, passive: true });
  reduced.addEventListener("change", stop, options);
  document.addEventListener("visibilitychange", () => { if (document.hidden) stop(); }, options);
  dialog.addEventListener("close", () => {
    stop();
    rotation = 0;
    render();
  }, options);
  document.addEventListener("astro:before-swap", () => {
    stop();
    listeners.abort();
  }, { ...options, once: true });

  return stop;
}
