import gsap from "gsap";
import { uiText } from "../i18n/runtime";

type ZoomDialog = HTMLDialogElement & { imageZoomCleanup?: () => void };
type ZoomState = "closed" | "opening" | "open" | "closing";
type ImageRequest = { preview: HTMLImageElement; src: string };

const initializeImageZoom = () => {
  document.querySelectorAll<ZoomDialog>("[data-article-image-zoom]").forEach((dialog) => {
    if (dialog.imageZoomCleanup) return;
    const selector = dialog.dataset.imageSelector;
    const view = dialog.querySelector<HTMLButtonElement>(".article-image-zoom__view");
    const enlarged = view?.querySelector<HTMLImageElement>("img");
    const backdrop = dialog.querySelector<HTMLElement>(".article-image-zoom__backdrop");
    const error = dialog.querySelector<HTMLElement>(".article-image-zoom__error");
    const retry = dialog.querySelector<HTMLButtonElement>("[data-image-zoom-retry]");
    if (!selector || !view || !enlarged || !backdrop || !error || !retry) return;

    const controller = new AbortController();
    const { signal } = controller;
    const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
    const styles = getComputedStyle(document.documentElement);
    const seconds = (token: string) => {
      const value = styles.getPropertyValue(token).trim();
      return parseFloat(value) / (value.endsWith("ms") ? 1000 : 1);
    };
    const openDuration = seconds("--duration-article-image-open");
    const closeDuration = seconds("--duration-article-image-close");
    const pressDuration = seconds("--duration-micro");
    const pressScale = parseFloat(styles.getPropertyValue("--scale-article-image-press"));
    const zoomFactor = parseFloat(styles.getPropertyValue("--article-image-zoom-factor"));
    const previewWidth = Number(dialog.dataset.previewWidth) || 0;
    const triggers: Array<{ button: HTMLButtonElement; image: HTMLImageElement; media: HTMLElement; frame: HTMLElement | null }> = [];
    let state: ZoomState = "closed";
    let animation: gsap.core.Timeline | null = null;
    let active: typeof triggers[number] | null = null;
    let pressed: HTMLButtonElement | null = null;
    let sourceVisibility = "";
    let sourceRadius = "";
    let base = { width: 0, height: 0 };
    let layout = { x: 0, y: 0, width: 0, height: 0 };
    let imageRequest: ImageRequest | null = null;
    let disposed = false;

    const setState = (next: ZoomState) => {
      state = next;
      dialog.dataset.state = next;
    };
    setState("closed");

    const placeView = () => {
      const gutter = parseFloat(getComputedStyle(dialog).paddingLeft);
      const scale = Math.min(previewWidth ? 1 : zoomFactor, (dialog.clientWidth - 2 * gutter) / base.width, (dialog.clientHeight - 2 * gutter) / base.height);
      const width = base.width * scale;
      const height = base.height * scale;
      layout = { x: (dialog.clientWidth - width) / 2, y: (dialog.clientHeight - height) / 2, width, height };
      // Keep the final layout in place and transform it only during motion.
      Object.assign(view.style, {
        left: `${layout.x}px`,
        top: `${layout.y}px`,
        width: `${width}px`,
        height: `${height}px`,
        borderRadius: sourceRadius.replace(/[\d.]+px/g, (radius) => `${parseFloat(radius) * scale}px`),
      });
    };

    const setImageState = (next: "ready" | "loading" | "error") => {
      dialog.toggleAttribute("data-image-error", next === "error");
      if (next === "loading") dialog.dataset.imageLoading = "true";
      else delete dialog.dataset.imageLoading;
      view.setAttribute("aria-busy", String(next === "loading"));
      error.hidden = next !== "error";
    };

    const loadZoom = async (request: ImageRequest) => {
      setImageState("loading");
      const image = request.preview.cloneNode(false) as HTMLImageElement;
      image.src = request.src;
      try {
        await image.decode();
      } catch {
        if (imageRequest === request) setImageState("error");
        return;
      }
      if (imageRequest !== request) return;
      request.preview.replaceWith(image);
      imageRequest = null;
      setImageState("ready");
    };

    const finishOpen = () => {
      animation = null;
      gsap.set(view, { clearProps: "transform" });
      setState("open");
    };

    const resetPress = (button: HTMLButtonElement) => {
      gsap.to(button, {
        scale: 1,
        duration: reducedMotion.matches ? 0 : pressDuration,
        ease: "power2.out",
        overwrite: true,
        clearProps: "transform",
      });
      if (pressed === button) pressed = null;
    };

    const finishClose = (restoreFocus = true) => {
      animation?.kill();
      animation = null;
      gsap.killTweensOf(view);
      imageRequest = null;
      const sourceButton = active?.button;
      if (active) {
        (active.frame ?? active.image).style.visibility = sourceVisibility;
        active.button.setAttribute("aria-expanded", "false");
      }
      dialog.close();
      if (view.firstElementChild !== enlarged) view.replaceChildren(enlarged);
      setImageState("ready");
      document.documentElement.classList.remove("has-article-image-zoom");
      if (restoreFocus && sourceButton?.isConnected) sourceButton.focus({ preventScroll: true });
      active = null;
      setState("closed");
    };

    const close = () => {
      if (!active || state === "closed" || state === "closing") return;
      if (reducedMotion.matches || !dialog.open) {
        finishClose();
        return;
      }
      animation?.kill();
      gsap.killTweensOf(view);
      imageRequest = null;
      setState("closing");
      const destination = (active.frame ?? active.image).getBoundingClientRect();
      if (!destination.width || !destination.height) {
        finishClose();
        return;
      }
      animation = gsap.timeline({ onComplete: () => finishClose() });
      animation.to(view, {
        x: destination.left - layout.x,
        y: destination.top - layout.y,
        scaleX: destination.width / layout.width,
        scaleY: destination.height / layout.height,
        duration: closeDuration,
        ease: "power3.inOut",
      }, 0);
      animation.to(backdrop, { opacity: 0, duration: closeDuration, ease: "power2.out" }, 0);
    };

    const open = async (entry: typeof triggers[number]) => {
      if (state !== "closed" || !entry.image.complete || !entry.image.naturalWidth) return;
      const sourceElement = entry.frame ?? entry.image;
      setState("opening");
      active = entry;
      sourceVisibility = sourceElement.style.visibility;
      const imageStyle = getComputedStyle(entry.image);
      const previewFrame = entry.frame?.cloneNode(true) as HTMLElement | undefined;
      const previewImage = previewFrame?.querySelector("img") ?? enlarged;
      const thumbnailSrc = entry.image.currentSrc || entry.image.src;
      const zoomSrc = entry.image.dataset.zoomSrc;
      previewImage.removeAttribute("srcset");
      previewImage.loading = "eager";
      previewImage.src = thumbnailSrc;
      previewImage.alt = entry.image.alt;
      previewImage.style.objectFit = imageStyle.objectFit;
      previewImage.style.objectPosition = imageStyle.objectPosition;
      sourceRadius = getComputedStyle(sourceElement).borderTopLeftRadius;

      await previewImage.decode().catch(() => undefined);
      if (disposed || dialog.dataset.state !== "opening" || !dialog.isConnected) return;

      const pressedBounds = sourceElement.getBoundingClientRect();
      gsap.killTweensOf(entry.button);
      gsap.set(entry.button, { clearProps: "transform" });
      pressed = null;
      const source = sourceElement.getBoundingClientRect();
      if (!source.width || !source.height) {
        finishClose();
        return;
      }
      const width = previewWidth || source.width;
      base = { width, height: width * source.height / source.width };
      if (previewFrame) view.replaceChildren(previewFrame);
      dialog.showModal();
      document.documentElement.classList.add("has-article-image-zoom");
      placeView();
      sourceElement.style.visibility = "hidden";
      entry.button.setAttribute("aria-expanded", "true");
      if (zoomSrc) {
        imageRequest = { preview: previewImage, src: zoomSrc };
        void loadZoom(imageRequest);
      }
      if (!reducedMotion.matches) {
        gsap.set(view, {
          x: pressedBounds.left - layout.x,
          y: pressedBounds.top - layout.y,
          scaleX: pressedBounds.width / layout.width,
          scaleY: pressedBounds.height / layout.height,
        });
        gsap.set(backdrop, { opacity: 0 });
        animation = gsap.timeline({ onComplete: finishOpen });
        animation.to(view, { x: 0, y: 0, scale: 1, duration: openDuration, ease: "power3.inOut" }, 0);
        animation.to(backdrop, { opacity: 1, duration: openDuration, ease: "power2.out" }, 0);
      } else {
        gsap.set(backdrop, { opacity: 1 });
        finishOpen();
      }
    };

    document.querySelectorAll<HTMLImageElement>(selector).forEach((image) => {
      if (!image.alt || image.closest("a, button, [data-no-image-zoom]")) return;
      const frame = image.closest<HTMLElement>("[data-zoom-frame]");
      const media = frame ?? image.closest("picture") ?? image;
      const button = document.createElement("button");
      button.type = "button";
      button.className = "article-image-zoom-trigger";
      button.setAttribute("aria-label", uiText(`放大图片：${image.alt}`, `Enlarge image: ${image.alt}`));
      button.setAttribute("aria-haspopup", "dialog");
      button.setAttribute("aria-expanded", "false");
      media.before(button);
      button.append(media);
      const entry = { button, image, media, frame };
      triggers.push(entry);

      button.addEventListener("pointerdown", (event) => {
        if (event.button !== 0 || !event.isPrimary || state !== "closed" || reducedMotion.matches) return;
        pressed = button;
        gsap.to(button, { scale: pressScale, duration: pressDuration, ease: "power2.out", overwrite: true });
      }, { signal });
      button.addEventListener("pointerleave", () => { if (pressed === button) resetPress(button); }, { signal });
      button.addEventListener("pointercancel", () => resetPress(button), { signal });
      button.addEventListener("click", () => { void open(entry); }, { signal });
      button.addEventListener("dragstart", (event) => event.preventDefault(), { signal });
    });

    window.addEventListener("pointerup", () => {
      requestAnimationFrame(() => { if (!disposed && state === "closed" && pressed) resetPress(pressed); });
    }, { signal });
    view.addEventListener("pointerdown", (event) => {
      if (event.button !== 0 || !event.isPrimary || state !== "open" || reducedMotion.matches) return;
      gsap.to(view, {
        x: layout.width * (1 - pressScale) / 2,
        y: layout.height * (1 - pressScale) / 2,
        scale: pressScale,
        duration: pressDuration,
        ease: "power2.out",
        overwrite: true,
      });
    }, { signal });
    const resetViewPress = () => {
      if (state === "open") gsap.to(view, { x: 0, y: 0, scale: 1, duration: reducedMotion.matches ? 0 : pressDuration, overwrite: true, clearProps: "transform" });
    };
    view.addEventListener("pointerleave", resetViewPress, { signal });
    view.addEventListener("pointercancel", resetViewPress, { signal });
    dialog.addEventListener("click", close, { signal });
    dialog.addEventListener("cancel", (event) => { event.preventDefault(); close(); }, { signal });
    retry.addEventListener("click", (event) => {
      event.stopPropagation();
      if (!imageRequest || error.hidden) return;
      view.focus({ preventScroll: true });
      void loadZoom(imageRequest);
    }, { signal });
    window.addEventListener("resize", () => {
      if (!dialog.open) return;
      if (state === "closing") { finishClose(); return; }
      if (state === "opening") animation?.progress(1);
      gsap.killTweensOf(view);
      placeView();
      gsap.set(view, { clearProps: "transform" });
    }, { signal });
    reducedMotion.addEventListener("change", () => {
      if (!reducedMotion.matches) return;
      if (pressed) resetPress(pressed);
      animation?.progress(1);
      if (state === "open") resetViewPress();
    }, { signal });

    dialog.imageZoomCleanup = () => {
      disposed = true;
      controller.abort();
      finishClose(false);
      triggers.forEach(({ button, media }) => {
        gsap.killTweensOf(button);
        button.replaceWith(media);
      });
      delete dialog.imageZoomCleanup;
    };
  });
};

initializeImageZoom();
document.addEventListener("astro:page-load", initializeImageZoom);
document.addEventListener("astro:before-swap", () => {
  document.querySelectorAll<ZoomDialog>("[data-article-image-zoom]").forEach((dialog) => dialog.imageZoomCleanup?.());
});
