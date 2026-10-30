import { uiText } from "../i18n/runtime";
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
  button.textContent = copied ? uiText("已复制", "Copied") : uiText("复制失败", "Copy failed");
  status.textContent = copied ? uiText("代码已复制", "Code copied") : uiText("复制失败，请选中代码手动复制。", "Copy failed. Select and copy the code manually.");

  const delay = cssTimeToMilliseconds(getComputedStyle(document.documentElement).getPropertyValue("--copy-feedback-duration"));
  const timer = setTimeout(() => {
    button.textContent = uiText("复制代码", "Copy code");
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
