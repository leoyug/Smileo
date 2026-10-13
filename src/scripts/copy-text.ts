type CopyLink = HTMLAnchorElement & { copyTextCleanup?: () => void };

const milliseconds = (name: string) =>
  Number.parseFloat(getComputedStyle(document.documentElement).getPropertyValue(name)) || 0;

const initializeCopyLinks = () => {
  document.querySelectorAll<CopyLink>("[data-copy-text]").forEach((link) => {
    // The original mail link remains usable without Clipboard API support.
    if (link.dataset.copyReady === "true" || !navigator.clipboard?.writeText) return;
    const value = link.dataset.copyText;
    const label = link.querySelector<HTMLElement>("[data-copy-label]");
    const icon = link.querySelector<HTMLElement>(".t-icon-swap");
    const status = link.querySelector<HTMLElement>("[data-copy-status]");
    if (!value || !label || !icon || !status) return;

    const initialLabel = label.textContent ?? "邮件";
    const initialAriaLabel = link.getAttribute("aria-label");
    const controller = new AbortController();
    const options = { signal: controller.signal };
    const hoverable = matchMedia("(hover: hover) and (pointer: fine)");
    let hovering = hoverable.matches && link.matches(":hover");
    let pointer: { x: number; y: number } | undefined;
    let hoverRefresh = 0;
    let originBox: { left: number; right: number; top: number; bottom: number } | undefined;
    let feedbackBox: typeof originBox;
    let copying = false;
    let resetTimer: ReturnType<typeof setTimeout> | undefined;
    link.dataset.copyReady = "true";
    link.setAttribute("role", "button");
    link.setAttribute("aria-label", `复制邮箱地址：${value}`);

    // Persistent layers let CSS reverse an unfinished crossfade in place.
    const initialWidth = label.getBoundingClientRect().width;
    const layers = new Map<string, HTMLSpanElement>();
    [initialLabel, value, "已复制", "复制失败"].forEach((text) => {
      if (layers.has(text)) return;
      const layer = document.createElement("span");
      layer.textContent = text;
      layer.className = "text-link__copy-layer";
      layer.classList.toggle("is-current", text === initialLabel);
      layers.set(text, layer);
    });
    label.style.width = `${initialWidth}px`;
    label.setAttribute("aria-hidden", "true");
    label.replaceChildren(...layers.values());
    label.dataset.text = initialLabel;

    const softSwap = (next: string) => {
      if (label.dataset.text === next) return;
      const incoming = layers.get(next);
      if (!incoming) return;
      const nextWidth = incoming.getBoundingClientRect().width;
      label.dataset.text = next;
      layers.forEach((layer) => layer.classList.toggle("is-current", layer === incoming));
      label.style.width = `${nextWidth}px`;
    };

    const captureHitbox = (name: "origin" | "feedback") => {
      const rect = link.getBoundingClientRect();
      const size = Number.parseFloat(getComputedStyle(link, "::before").height);
      const width = Math.max(rect.width, size);
      const left = rect.left - (width - rect.width) / 2;
      const top = rect.top - (size - rect.height) / 2;
      const box = { left, right: left + width, top, bottom: top + size };
      if (name === "origin") originBox = box;
      else feedbackBox = box;
      link.style.setProperty(`--copy-${name}-left`, `${left}px`);
      link.style.setProperty(`--copy-${name}-top`, `${top}px`);
      link.style.setProperty(`--copy-${name}-width`, `${width}px`);
    };

    const containsPoint = (box: typeof originBox, x: number, y: number) =>
      !!box && x >= box.left && x <= box.right && y >= box.top && y <= box.bottom;
    const retainsPointer = (x: number, y: number) => {
      if (containsPoint(originBox, x, y) || containsPoint(feedbackBox, x, y)) return true;
      const rect = link.getBoundingClientRect();
      const size = Number.parseFloat(getComputedStyle(link, "::before").height);
      const inlineInset = Math.max(0, (size - rect.width) / 2);
      const blockInset = Math.max(0, (size - rect.height) / 2);
      return containsPoint({ left: rect.left - inlineInset, right: rect.right + inlineInset, top: rect.top - blockInset, bottom: rect.bottom + blockInset }, x, y);
    };
    const blockedByDialog = () => {
      const dialog = document.querySelector<HTMLDialogElement>("dialog[open]");
      return !!dialog && !dialog.contains(link);
    };

    const updateLabel = () => {
      const state = link.dataset.copyState;
      const previewing = hovering || link.matches(":focus-visible");
      softSwap(state === "copied" ? "已复制" : state === "error" ? "复制失败" : previewing ? value : initialLabel);
    };

    const setState = (state: "idle" | "copied" | "error") => {
      // Repeated clicks must retain the address footprint, including its line.
      if (hovering && state !== "idle" && (link.dataset.copyState === "idle" || !link.dataset.copyFeedbackHitbox)) {
        captureHitbox("feedback");
        link.dataset.copyFeedbackHitbox = "true";
      }
      link.dataset.copyState = state;
      icon.dataset.state = state === "copied" ? "b" : "a";
      updateLabel();
      link.setAttribute("aria-label", state === "copied" ? `已复制邮箱地址：${value}` : `复制邮箱地址：${value}`);
      status.textContent = state === "copied" ? "邮箱地址已复制" : state === "error" ? "复制失败，请重试" : "";
    };

    const beginHover = () => {
      if (hovering && link.dataset.copyHovering) return;
      captureHitbox("origin");
      hovering = true;
      link.dataset.copyHovering = "true";
      updateLabel();
    };
    const endHover = () => {
      hovering = false;
      pointer = undefined;
      originBox = undefined;
      feedbackBox = undefined;
      delete link.dataset.copyHovering;
      delete link.dataset.copyFeedbackHitbox;
      for (const name of ["origin", "feedback"]) {
        for (const property of ["left", "top", "width"]) link.style.removeProperty(`--copy-${name}-${property}`);
      }
      updateLabel();
    };
    link.addEventListener("pointerenter", (event) => {
      if (event.pointerType === "touch" || !hoverable.matches) return;
      pointer = { x: event.clientX, y: event.clientY };
      beginHover();
    }, options);
    link.addEventListener("pointermove", (event) => {
      if (event.pointerType === "touch" || !hoverable.matches) return;
      pointer = { x: event.clientX, y: event.clientY };
      if (!hovering) beginHover();
    }, options);
    // Inline wrapping can emit leave without a physical pointer movement.
    link.addEventListener("pointerleave", (event) => {
      if (blockedByDialog() || !retainsPointer(event.clientX, event.clientY)) endHover();
    }, options);
    document.addEventListener("pointermove", (event) => {
      if (!hovering || event.pointerType === "touch") return;
      const target = event.target instanceof Element ? event.target.closest("a, button, input, select, textarea, [role=button]") : null;
      if (blockedByDialog() || (target && !link.contains(target))) { endHover(); return; }
      pointer = { x: event.clientX, y: event.clientY };
      if (!retainsPointer(event.clientX, event.clientY)) endHover();
    }, options);
    document.addEventListener("click", (event) => {
      if (!hovering || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      if (blockedByDialog()) { endHover(); return; }
      const target = event.target;
      if (!(target instanceof Element) || link.contains(target) || !retainsPointer(event.clientX, event.clientY)) return;
      if (target.closest("a, button, input, select, textarea, [role=button]")) return;
      // The retained origin remains clickable after the visible address wraps.
      event.preventDefault();
      link.click();
    }, { ...options, capture: true });
    const refreshHover = () => {
      const point = pointer;
      endHover();
      cancelAnimationFrame(hoverRefresh);
      if (!point) return;
      hoverRefresh = requestAnimationFrame(() => {
        const target = document.elementFromPoint(point.x, point.y);
        if (target && link.contains(target) && hoverable.matches) {
          pointer = point;
          beginHover();
        }
      });
    };
    window.addEventListener("scroll", refreshHover, { ...options, passive: true });
    window.addEventListener("resize", refreshHover, options);
    link.addEventListener("focus", updateLabel, options);
    link.addEventListener("blur", updateLabel, options);
    if (hovering) beginHover();
    updateLabel();

    link.addEventListener("click", async (event) => {
      if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      event.preventDefault();
      if (copying) return;
      copying = true;
      clearTimeout(resetTimer);
      try {
        await navigator.clipboard.writeText(value);
        if (controller.signal.aborted) return;
        setState("copied");
      } catch {
        if (controller.signal.aborted) return;
        setState("error");
      } finally {
        copying = false;
        if (!controller.signal.aborted) {
          resetTimer = setTimeout(() => setState("idle"), milliseconds("--copy-feedback-duration"));
        }
      }
    }, options);

    link.addEventListener("keydown", (event) => {
      if (event.key !== " ") return;
      event.preventDefault();
      if (!event.repeat) link.click();
    }, options);

    link.copyTextCleanup = () => {
      controller.abort();
      clearTimeout(resetTimer);
      cancelAnimationFrame(hoverRefresh);
      endHover();
      label.textContent = initialLabel;
      delete label.dataset.text;
      label.removeAttribute("aria-hidden");
      label.style.removeProperty("width");
      icon.dataset.state = "a";
      link.dataset.copyState = "idle";
      status.textContent = "";
      link.removeAttribute("role");
      if (initialAriaLabel === null) link.removeAttribute("aria-label");
      else link.setAttribute("aria-label", initialAriaLabel);
      delete link.dataset.copyReady;
    };
  });
};

initializeCopyLinks();
document.addEventListener("astro:page-load", initializeCopyLinks);
document.addEventListener("astro:before-swap", () => {
  document.querySelectorAll<CopyLink>("[data-copy-text]").forEach((link) => link.copyTextCleanup?.());
});
