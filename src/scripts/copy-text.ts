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
    let copying = false;
    let resetTimer: ReturnType<typeof setTimeout> | undefined;
    let swapTimer: ReturnType<typeof setTimeout> | undefined;
    link.dataset.copyReady = "true";
    link.setAttribute("role", "button");
    link.setAttribute("aria-label", `复制邮箱地址：${value}`);

    const softSwap = (next: string) => {
      const previous = label.dataset.text ?? label.textContent ?? initialLabel;
      if (previous === next) return;
      clearTimeout(swapTimer);
      label.dataset.text = next;
      if (matchMedia("(prefers-reduced-motion: reduce)").matches) {
        label.textContent = next;
        label.classList.remove("is-swapping");
        label.style.removeProperty("width");
        return;
      }

      const outgoing = document.createElement("span");
      outgoing.className = "t-text-soft-old";
      outgoing.setAttribute("aria-hidden", "true");
      outgoing.textContent = previous;
      const incoming = document.createElement("span");
      incoming.className = "t-text-soft-new";
      incoming.textContent = next;
      const currentWidth = label.getBoundingClientRect().width;
      label.classList.remove("is-swapping");
      label.replaceChildren(outgoing, incoming);
      const nextWidth = incoming.getBoundingClientRect().width;
      label.style.width = `${currentWidth}px`;
      void label.offsetWidth;
      label.classList.add("is-swapping");
      label.style.width = `${nextWidth}px`;
      swapTimer = setTimeout(() => {
        label.classList.remove("is-swapping");
        label.style.removeProperty("width");
        label.textContent = next;
      }, Math.max(milliseconds("--text-soft-dur"), milliseconds("--text-soft-resize-dur")));
    };

    const updateLabel = () => {
      const state = link.dataset.copyState;
      const previewing = hovering || link.matches(":focus-visible");
      softSwap(state === "copied" ? "已复制" : state === "error" ? "复制失败" : previewing ? value : initialLabel);
    };

    const setState = (state: "idle" | "copied" | "error") => {
      // Keep the pointer target steady while the shorter feedback text appears.
      if (hovering && state !== "idle") {
        link.style.setProperty("--copy-hover-width", `${link.getBoundingClientRect().width}px`);
      }
      link.dataset.copyState = state;
      icon.dataset.state = state === "copied" ? "b" : "a";
      updateLabel();
      link.setAttribute("aria-label", state === "copied" ? `已复制邮箱地址：${value}` : `复制邮箱地址：${value}`);
      status.textContent = state === "copied" ? "邮箱地址已复制" : state === "error" ? "复制失败，请重试" : "";
    };

    link.addEventListener("pointerenter", (event) => {
      if (event.pointerType === "touch" || !hoverable.matches) return;
      hovering = true;
      updateLabel();
    }, options);
    link.addEventListener("pointerleave", () => {
      hovering = false;
      link.style.removeProperty("--copy-hover-width");
      updateLabel();
    }, options);
    link.addEventListener("focus", updateLabel, options);
    link.addEventListener("blur", updateLabel, options);
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
      clearTimeout(swapTimer);
      label.textContent = initialLabel;
      delete label.dataset.text;
      label.classList.remove("is-swapping");
      label.style.removeProperty("width");
      link.style.removeProperty("--copy-hover-width");
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
