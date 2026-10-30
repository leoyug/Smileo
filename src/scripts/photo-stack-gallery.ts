import { uiText } from "../i18n/runtime";
import type { PhotoStackPhoto } from "../lib/photo-stack-types";
import { cssTimeToMilliseconds } from "../lib/css-time";

function initializePhotoStacks() {
  document.querySelectorAll<HTMLElement>("[data-photo-stack-gallery]").forEach((root) => {
    if (root.dataset.ready) return;
    const trigger = root.querySelector<HTMLElement>("[data-stack-trigger]");
    const preview = root.querySelector<HTMLButtonElement>("[data-stack-preview]");
    const template = root.querySelector<HTMLTemplateElement>("[data-stack-template]");
    const data = root.querySelector<HTMLScriptElement>("[data-stack-data]");
    if (!trigger || !preview || !template || !data) return;
    const dialog = template.content.firstElementChild?.cloneNode(true) as HTMLDialogElement | undefined;
    if (!dialog) return;
    const photos = JSON.parse(data.textContent ?? "[]") as PhotoStackPhoto[];
    const stage = dialog.querySelector<HTMLElement>("[data-stack-stage]")!;
    const detail = dialog.querySelector<HTMLElement>("[data-stack-detail]")!;
    const media = dialog.querySelector<HTMLElement>("[data-stack-media]")!;
    const image = dialog.querySelector<HTMLImageElement>("[data-stack-image]")!;
    const caption = dialog.querySelector<HTMLElement>("[data-stack-caption]")!;
    const error = dialog.querySelector<HTMLElement>("[data-stack-error]")!;
    const control = dialog.querySelector<HTMLButtonElement>(".photo-stack-gallery__control")!;
    const controlLabel = dialog.querySelector<HTMLElement>("[data-stack-control-label]")!;
    const cards = [...dialog.querySelectorAll<HTMLButtonElement>("[data-stack-card]")];
    const frames = cards.map((card) => card.querySelector<HTMLElement>(".photo-stack-gallery__frame")!);
    const compacts = [...preview.querySelectorAll<HTMLElement>(".photo-stack-gallery__compact")];
    const surface = dialog.querySelector<HTMLElement>(".photo-stack-gallery__surface")!;
    const reduced = matchMedia("(prefers-reduced-motion: reduce)");
    const abort = new AbortController();
    const { signal } = abort;
    const animations = new Set<Animation>();
    const travelers = new Set<HTMLElement>();
    let view: "rest" | "preview" | "gallery" | "detail" = "rest";
    let busy = false;
    let closing = false;
    let selected = -1;
    let motionEpoch = 0;
    let imageEpoch = 0;
    let hideTimer: ReturnType<typeof setTimeout> | undefined;
    let savedOverflow = "";
    let savedPadding = "";
    let scrollLocked = false;

    root.dataset.ready = "true";
    preview.setAttribute("aria-haspopup", "dialog");
    preview.setAttribute("aria-controls", dialog.id);
    preview.hidden = false;
    document.body.append(dialog);

    const timing = (token: string) => cssTimeToMilliseconds(getComputedStyle(root).getPropertyValue(token));
    const easing = () => getComputedStyle(root).getPropertyValue("--ease-smooth-out").trim();
    const animate = (element: HTMLElement, keys: Keyframe[], duration: number, delay = 0) => {
      const animation = element.animate(keys, { duration: reduced.matches ? 0 : duration, delay: reduced.matches ? 0 : delay, easing: easing(), fill: "both" });
      animations.add(animation);
      return animation;
    };
    const positionPreview = () => {
      const rect = trigger.getBoundingClientRect();
      const width = preview.offsetWidth;
      const ideal = rect.left + rect.width / 2 - width / 2;
      const safeGutter = Number.parseFloat(getComputedStyle(root).getPropertyValue("--space-3")) * Number.parseFloat(getComputedStyle(document.documentElement).fontSize);
      // Keep the complete stack inside the viewport, including at a wrapped line's edge.
      const left = Math.max(safeGutter, Math.min(ideal, innerWidth - width - safeGutter));
      root.style.setProperty("--stack-offset", `${left - ideal}px`);
      root.dataset.placement = rect.top < preview.offsetHeight ? "below" : "above";
    };
    const showPreview = () => {
      clearTimeout(hideTimer);
      if (dialog.open || closing) return;
      positionPreview();
      view = "preview";
      root.dataset.preview = "true";

    };
    const hidePreview = () => {
      clearTimeout(hideTimer);
      if (dialog.open) return;
      root.dataset.fanned = "false";
      view = "rest";
      root.dataset.preview = "false";

    };
    const warmGallery = () => photos.forEach((photo) => { const warm = new Image(); warm.src = photo.previewSrc; });
    const clearMotion = () => {
      motionEpoch++;
      animations.forEach((animation) => animation.cancel());
      animations.clear();
      travelers.forEach((traveler) => traveler.remove());
      travelers.clear();
      frames.forEach((frame, index) => {
        if (view === "detail" && index === selected) frame.style.visibility = "hidden";
        else frame.style.removeProperty("visibility");
      });
      media.style.removeProperty("visibility");
      preview.style.removeProperty("visibility");
      delete root.dataset.returning;
      busy = false;
      dialog.removeAttribute("data-moving");
    };
    const beginMotion = () => {
      clearMotion();
      busy = true;
      dialog.dataset.moving = "true";
      return motionEpoch;
    };
    const finishMotion = async (epoch: number, done: () => void, cleanup = true) => {
      await Promise.allSettled([...animations].map((animation) => animation.finished));
      if (epoch !== motionEpoch || signal.aborted) return;
      if (cleanup) clearMotion();
      done();
    };
    const fly = (frame: HTMLElement, from: DOMRect, to: DOMRect, fromRotation: number, toRotation: number, duration: number, options: { fadeIn?: boolean; dissolve?: boolean; layer?: number } = {}) => {
      if (reduced.matches) return;
      const traveler = frame.cloneNode(true) as HTMLElement;
      traveler.classList.add("photo-stack-gallery__traveler");
      traveler.setAttribute("aria-hidden", "true");
      traveler.style.removeProperty("visibility");
      Object.assign(traveler.style, { left: `${to.left + to.width / 2}px`, top: `${to.top + to.height / 2}px`, width: `${to.width}px`, height: `${to.height}px`, zIndex: String(options.layer ?? 3) });
      travelers.add(traveler);
      dialog.append(traveler);
      const dx = from.left + from.width / 2 - to.left - to.width / 2;
      const dy = from.top + from.height / 2 - to.top - to.height / 2;
      const radiusRatio = Number.parseFloat(getComputedStyle(root).getPropertyValue("--photo-stack-radius-ratio"));
      // Resize the clipping window itself: the image keeps its natural ratio,
      // and the corner radius follows the shorter edge throughout the motion.
      const fromTransform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) rotate(${fromRotation}deg)`;
      const endTransform = `translate(-50%, -50%) rotate(${toRotation}deg)`;
      animate(traveler, [
        { transform: fromTransform, width: `${from.width}px`, height: `${from.height}px`, borderRadius: `${Math.min(from.width, from.height) * radiusRatio}px`, opacity: options.fadeIn ? 0 : 1 },
        { transform: endTransform, width: `${to.width}px`, height: `${to.height}px`, borderRadius: `${Math.min(to.width, to.height) * radiusRatio}px`, opacity: 1 },
      ], duration);
      if (options.dissolve) {
        // Let the original three photos form the compact stack before dissolving together.
        const dissolveDuration = timing("--duration-quick");
        animate(traveler, [{ opacity: 1, filter: "blur(0px)" }, { opacity: 0, filter: `blur(${getComputedStyle(root).getPropertyValue("--space-1").trim()})` }], dissolveDuration, Math.max(0, duration - dissolveDuration));
      }
    };
    const compactRotation = [-9, 1, 9];
    const rotation = (frame: HTMLElement) => { const matrix = new DOMMatrixReadOnly(getComputedStyle(frame).transform); return Math.atan2(matrix.b, matrix.a) * 180 / Math.PI; };
    const measureFrame = (frame: HTMLElement) => {
      const bounds = frame.getBoundingClientRect();
      const matrix = new DOMMatrixReadOnly(getComputedStyle(frame).transform);
      const width = frame.offsetWidth * Math.hypot(matrix.a, matrix.b);
      const height = frame.offsetHeight * Math.hypot(matrix.c, matrix.d);
      // A rotated bounding box includes its corners; use the actual card size.
      return new DOMRect(bounds.left + (bounds.width - width) / 2, bounds.top + (bounds.height - height) / 2, width, height);
    };
    const cardRotation = [-4, 4, 3, -3, -5, 3];
    const labelControl = (label: string) => { controlLabel.textContent = label; control.setAttribute("aria-label", label); };
    const lockScroll = () => {
      if (scrollLocked) return;
      savedOverflow = document.documentElement.style.overflow;
      savedPadding = document.documentElement.style.paddingRight;
      const scrollbar = innerWidth - document.documentElement.clientWidth;
      const existingPadding = Number.parseFloat(getComputedStyle(document.documentElement).paddingRight) || 0;
      document.documentElement.style.overflow = "hidden";
      if (scrollbar) document.documentElement.style.paddingRight = `${existingPadding + scrollbar}px`;
      scrollLocked = true;
    };
    const unlockScroll = () => {
      if (!scrollLocked) return;
      document.documentElement.style.overflow = savedOverflow;
      document.documentElement.style.paddingRight = savedPadding;
      scrollLocked = false;
    };
    const finishClose = (restoreFocus = true) => {
      // Settle the concealed preview before releasing animation visibility.
      // Native dialog closing and focus restoration must not reveal it again.
      closing = true;
      root.dataset.returning = "true";
      root.dataset.preview = "false";
      root.dataset.fanned = "false";
      preview.getBoundingClientRect();
      clearMotion();
      imageEpoch++;
      if (dialog.open) dialog.close();
      unlockScroll();
      stage.hidden = false;
      stage.inert = false;
      detail.hidden = true;
      dialog.dataset.view = "gallery";
      if (restoreFocus && root.isConnected) trigger.focus({ preventScroll: true });
      hidePreview();
      closing = false;
    };
    const openGallery = () => {
      if (dialog.open || busy) return;
      showPreview();
      const sources = compacts.map((compact) => measureFrame(compact.firstElementChild as HTMLElement));
      const sourceRotations = compacts.map((compact) => rotation(compact.firstElementChild as HTMLElement));
      const epoch = beginMotion();
      view = "gallery";
      closing = false;
      stage.hidden = false;
      stage.inert = false;
      detail.hidden = true;
      dialog.dataset.view = "gallery";
      labelControl(uiText("关闭照片图库", "Close photo gallery"));
      lockScroll();
      dialog.showModal();
      control.focus({ preventScroll: true });
      animate(surface, [{ opacity: 0 }, { opacity: 1 }], timing("--duration-project-attribute"));
      frames.forEach((frame, index) => {
        fly(frame, sources[index % 3], measureFrame(frame), sourceRotations[index % 3], cardRotation[index], timing("--duration-very-slow"), { fadeIn: index >= 3 });
        if (!reduced.matches) frame.style.visibility = "hidden";
      });
      void finishMotion(epoch, () => { root.dataset.preview = "false"; });
    };
    const showDetail = (index: number) => {
      if (busy || view !== "gallery") return;
      const photo = photos[index];
      if (!photo) return;
      const source = measureFrame(frames[index]);
      const sourceRotation = rotation(frames[index]);
      const epoch = beginMotion();
      const loadEpoch = ++imageEpoch;
      selected = index;
      view = "detail";
      dialog.dataset.view = "detail";
      media.style.setProperty("--photo-ratio", String(photo.width / photo.height));
      image.src = photo.previewSrc;
      image.alt = photo.alt;
      caption.textContent = photo.alt;
      error.hidden = true;
      media.dataset.imageLoading = "true";
      media.setAttribute("aria-busy", "true");
      detail.hidden = false;
      stage.hidden = false;
      stage.inert = true;
      labelControl(uiText("关闭照片详情", "Close photo details"));
      control.focus({ preventScroll: true });
      fly(frames[index], source, measureFrame(media), sourceRotation, 0, timing("--duration-very-slow"));
      frames[index].style.visibility = "hidden";
      if (!reduced.matches) media.style.visibility = "hidden";
      animate(caption, [{ opacity: 0 }, { opacity: 1 }], timing("--duration-project-attribute"));
      const full = new Image();
      full.src = photo.src;
      void full.decode().then(() => {
        if (loadEpoch === imageEpoch && view === "detail" && !signal.aborted) image.src = photo.src;
      }).catch(() => {
        if (loadEpoch === imageEpoch && view === "detail" && !signal.aborted) error.hidden = false;
      }).finally(() => {
        if (loadEpoch === imageEpoch && !signal.aborted) { delete media.dataset.imageLoading; media.setAttribute("aria-busy", "false"); }
      });
      void finishMotion(epoch, () => {});
    };
    const returnToGallery = () => {
      const source = measureFrame(media);
      const detailFrame = frames[selected].cloneNode(true) as HTMLElement;
      const detailImage = detailFrame.querySelector("img");
      if (detailImage) detailImage.src = image.src;
      const epoch = beginMotion();
      imageEpoch++;
      view = "gallery";
      dialog.dataset.view = "gallery";
      detail.hidden = true;
      stage.hidden = false;
      stage.inert = false;
      labelControl(uiText("关闭照片图库", "Close photo gallery"));
      control.focus({ preventScroll: true });
      fly(detailFrame, source, measureFrame(frames[selected]), 0, cardRotation[selected], timing("--duration-very-slow"));
      if (!reduced.matches) frames[selected].style.visibility = "hidden";
      void finishMotion(epoch, () => cards[selected].focus({ preventScroll: true }));
    };
    const closeGallery = () => {
      if (closing) { finishClose(); return; }
      const sources = frames.map(measureFrame);
      const sourceRotations = frames.map(rotation);
      const epoch = beginMotion();
      closing = true;
      root.dataset.returning = "true";
      root.dataset.fanned = "false";
      root.dataset.preview = "true";
      positionPreview();
      const targets = compacts.map((compact) => measureFrame(compact.firstElementChild as HTMLElement));
      preview.style.visibility = "hidden";
      frames.forEach((frame, index) => {
        if (index < 3) {
          fly(frame, sources[index], targets[index], sourceRotations[index], compactRotation[index], timing("--duration-photo-fan"), { dissolve: true, layer: [3, 5, 4][index] });
          if (!reduced.matches) frame.style.visibility = "hidden";
        } else {
          animate(frame, [{ opacity: 1 }, { opacity: 0 }], timing("--duration-quick"));
        }
      });
      animate(control, [{ opacity: 1 }, { opacity: 0 }], timing("--duration-quick"));
      animate(surface, [{ opacity: 1 }, { opacity: 0 }], timing("--duration-photo-fan"));
      void finishMotion(epoch, () => finishClose(), false);
    };
    const back = () => { if (view === "detail") returnToGallery(); else if (dialog.open) closeGallery(); else hidePreview(); };

    preview.addEventListener("pointerenter", () => { root.dataset.fanned = "true"; warmGallery(); }, { signal });
    preview.addEventListener("pointerleave", () => { if (document.activeElement !== preview) root.dataset.fanned = "false"; }, { signal });
    preview.addEventListener("focus", () => { root.dataset.fanned = "true"; warmGallery(); }, { signal });
    preview.addEventListener("blur", () => { if (!preview.matches(":hover")) root.dataset.fanned = "false"; }, { signal });
    preview.addEventListener("click", openGallery, { signal });
    // Closing restores text focus with the preview hidden. Tab reveals the card
    // control again before the browser chooses the next focusable element.
    trigger.addEventListener("keydown", (event) => {
      if (event.key === "Tab" && !event.shiftKey && !dialog.open) {
        event.preventDefault();
        showPreview();
        // Resolve the visibility change before moving focus to a hidden control.
        preview.getBoundingClientRect();
        preview.focus({ preventScroll: true });
      }
    }, { signal });
    root.addEventListener("pointerenter", (event) => { if (event.pointerType === "mouse" && matchMedia("(hover: hover) and (pointer: fine)").matches) showPreview(); }, { signal });
    root.addEventListener("pointerleave", () => { if (!root.contains(document.activeElement) || !document.activeElement?.matches(":focus-visible")) hideTimer = setTimeout(hidePreview, timing("--duration-quick")); }, { signal });
    root.addEventListener("focusin", showPreview, { signal });
    root.addEventListener("focusout", (event) => { if (!root.contains(event.relatedTarget as Node | null)) hideTimer = setTimeout(hidePreview, timing("--duration-quick")); }, { signal });
    document.addEventListener("pointerdown", (event) => { if (!dialog.open && !root.contains(event.target as Node)) hidePreview(); }, { signal });
    document.addEventListener("keydown", (event) => { if (event.key === "Escape" && !dialog.open && view === "preview") { event.preventDefault(); hidePreview(); trigger.focus({ preventScroll: true }); hidePreview(); } }, { signal });
    dialog.addEventListener("cancel", (event) => { event.preventDefault(); if (view !== "detail") back(); }, { signal });
    dialog.addEventListener("close", () => { if (!dialog.open && scrollLocked) finishClose(); }, { signal });
    control.addEventListener("click", back, { signal });
    cards.forEach((card, index) => card.addEventListener("click", () => showDetail(index), { signal }));
    window.addEventListener("scroll", () => { if (!dialog.open && !root.contains(document.activeElement)) hidePreview(); }, { passive: true, signal });
    window.addEventListener("resize", () => {
      if (dialog.open) { if (closing) finishClose(); else clearMotion(); }
      else if (view === "preview") positionPreview();
    }, { signal });
    reduced.addEventListener("change", () => { if (closing) finishClose(); else clearMotion(); }, { signal });
    document.addEventListener("astro:before-swap", () => { finishClose(false); abort.abort(); dialog.remove(); }, { once: true, signal });
  });
}

initializePhotoStacks();
document.addEventListener("astro:page-load", initializePhotoStacks);
