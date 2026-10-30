import { cssTimeToMilliseconds } from "../lib/css-time";

const resetTimers = new Set<ReturnType<typeof setTimeout>>();

const initializeCodeBlocks = () => {
  if (!navigator.clipboard?.writeText) return;
  document.querySelectorAll<HTMLButtonElement>("[data-code-copy]").forEach(button => {
    button.hidden = false;
  });
};

document.addEventListener("click", async (event) => {
  const button = event.target instanceof Element
    ? event.target.closest<HTMLButtonElement>("[data-code-copy]")
    : null;
  if (!button || button.disabled || button.dataset.feedback) return;
  const block = button.closest(".code-block");
  const code = block?.querySelector("pre code")?.textContent;
  const status = block?.querySelector<HTMLElement>("[data-code-status]");
  if (code === undefined || code === null || !status) return;

  button.disabled = true;
  let copied = false;
  try {
    await navigator.clipboard.writeText(code);
    copied = true;
  } catch {
    // Keep the original selectable code available when clipboard permission fails.
  }
  if (!button.isConnected) return;
  button.disabled = false;
  button.dataset.feedback = copied ? "success" : "error";
  button.textContent = copied ? "已复制" : "复制失败";
  status.textContent = copied ? "代码已复制" : "复制失败，请选中代码手动复制。";

  const delay = cssTimeToMilliseconds(getComputedStyle(document.documentElement).getPropertyValue("--copy-feedback-duration"));
  const timer = setTimeout(() => {
    button.textContent = "复制代码";
    delete button.dataset.feedback;
    status.textContent = "";
    resetTimers.delete(timer);
  }, delay);
  resetTimers.add(timer);
});

document.addEventListener("astro:before-swap", () => {
  resetTimers.forEach(clearTimeout);
  resetTimers.clear();
});
document.addEventListener("astro:page-load", initializeCodeBlocks);
initializeCodeBlocks();
