import "./keystatic-upload.css";
import { savePendingUpload } from "./upload-storage.js";
import { createElement } from "react";
import { createRoot } from "react-dom/client";
import { flushSync } from "react-dom";
import { Text } from "@keystar/ui/typography";
import { DirectionIndicator } from "@keystar/ui/overlays";
import { localizeCMS, updateEditorBreadcrumb } from "./cms-localization.js";

const categoryLabels = { project: "项目", article: "写作", photo: "摄影" };
const acceptedFiles = {
  project: ".md,.mdx,.docx,.json,.jpg,.jpeg,.png,.webp,.avif",
  article: ".md,.mdx,.docx,.json,.jpg,.jpeg,.png,.webp,.avif",
  photo: ".json,.jpg,.jpeg,.png,.webp,.avif",
};
const dashboardCollections = {
  projects: "project",
  articles: "article",
  photos: "photo",
};
const tooltipHeaders = new WeakSet();
let disabledTooltip;
let disabledTooltipButton;
let disabledTooltipRoot;
let disabledTooltipTimer;

function hideDisabledTooltip() {
  clearTimeout(disabledTooltipTimer);
  disabledTooltipTimer = undefined;
  disabledTooltipRoot?.unmount();
  disabledTooltipRoot = undefined;
  disabledTooltip?.remove();
  disabledTooltip = undefined;
  disabledTooltipButton = undefined;
}

function disabledActionDescription(button) {
  const label = (button.getAttribute("aria-labelledby") ?? "").split(" ")
    .map((id) => document.getElementById(id)?.textContent ?? "").join(" ").trim()
    || button.getAttribute("aria-label") || button.textContent.trim();
  return label === "撤销未保存的修改" ? "暂无未保存的修改，无需撤销" : `${label}：当前不可用`;
}

function showDisabledTooltip(toolbar, button) {
  if (!button.isConnected || !button.disabled) return hideDisabledTooltip();
  disabledTooltip = document.createElement("div");
  disabledTooltip.className = "local-editor-tooltip";
  disabledTooltip.setAttribute("role", "tooltip");
  (toolbar.closest(".kui-theme") ?? document.body).append(disabledTooltip);
  // Reuse the CMS's text trimming and arrow geometry, rather than approximating
  // them with inherited text and a rotated square. React owns only this portal.
  disabledTooltipRoot = createRoot(disabledTooltip);
  flushSync(() => disabledTooltipRoot.render(createElement("div", { className: "local-editor-tooltip-content" },
    createElement(Text, { size: "small", color: "inherit" }, disabledActionDescription(button)),
    createElement(DirectionIndicator, {
      fill: "inverse", size: "xsmall", placement: "bottom",
      style: { left: "var(--tooltip-arrow-left)" },
    }),
  )));
  const rect = button.getBoundingClientRect();
  const gap = parseFloat(getComputedStyle(disabledTooltip).getPropertyValue("--kui-size-space-regular")) || 8;
  const center = rect.left + rect.width / 2;
  const width = disabledTooltip.getBoundingClientRect().width;
  const left = Math.max(gap, Math.min(center - width / 2, innerWidth - width - gap));
  disabledTooltip.style.left = `${left}px`;
  disabledTooltip.style.top = `${rect.bottom + gap}px`;
  disabledTooltip.style.setProperty("--tooltip-arrow-left", `${center - left}px`);
  const tooltip = disabledTooltip;
  requestAnimationFrame(() => { if (tooltip.isConnected) tooltip.dataset.open = "true"; });
}

function addDisabledTooltips(toolbar) {
  if (disabledTooltipButton && (!disabledTooltipButton.isConnected || !disabledTooltipButton.disabled)) {
    hideDisabledTooltip();
  }
  for (const button of toolbar.querySelectorAll('[role="toolbar"] button')) {
    if (button.disabled) {
      const description = disabledActionDescription(button);
      if (button.getAttribute("aria-description") !== description) button.setAttribute("aria-description", description);
    } else if (button.hasAttribute("aria-description")) {
      button.removeAttribute("aria-description");
    }
  }
  if (tooltipHeaders.has(toolbar)) return;
  tooltipHeaders.add(toolbar);
  toolbar.addEventListener("pointermove", (event) => {
    if (event.pointerType === "touch") return;
    // Disabled buttons do not receive the upstream hover events. Hit-test their
    // bounds from the toolbar without enabling or reparenting React's buttons.
    const button = [...toolbar.querySelectorAll('[role="toolbar"] button:disabled')].find((button) => {
      const rect = button.getBoundingClientRect();
      return event.clientX >= rect.left && event.clientX <= rect.right && event.clientY >= rect.top && event.clientY <= rect.bottom;
    });
    if (!button) return hideDisabledTooltip();
    if (disabledTooltipButton === button) return;
    hideDisabledTooltip();
    disabledTooltipButton = button;
    // Match Keystar TooltipTrigger's mouse-rest delay.
    disabledTooltipTimer = setTimeout(() => showDisabledTooltip(toolbar, button), 600);
  });
  toolbar.addEventListener("pointerleave", hideDisabledTooltip);
}

function uploadIcon() {
  const namespace = "http://www.w3.org/2000/svg";
  const icon = document.createElementNS(namespace, "svg");
  icon.setAttribute("viewBox", "0 0 24 24");
  icon.setAttribute("fill", "none");
  icon.setAttribute("stroke", "currentColor");
  icon.setAttribute("stroke-width", "2");
  icon.setAttribute("stroke-linecap", "round");
  icon.setAttribute("stroke-linejoin", "round");
  icon.setAttribute("aria-hidden", "true");
  const path = document.createElementNS(namespace, "path");
  path.setAttribute("d", "M12 16V4m0 0L7 9m5-5 5 5M4 15v4a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-4");
  icon.append(path);
  return icon;
}

function chooseFiles(category, trigger) {
  const input = document.createElement("input");
  input.type = "file";
  input.multiple = true;
  input.accept = acceptedFiles[category];
  input.hidden = true;
  input.addEventListener("change", async () => {
    const files = [...(input.files ?? [])];
    if (!files.length) {
      input.remove();
      return;
    }
    if (trigger) trigger.disabled = true;
    try {
      const id = await savePendingUpload(category, files);
      window.location.assign(`/content-import?upload=${encodeURIComponent(id)}`);
    } catch (error) {
      window.alert(error.message || "准备文件失败，请重试。");
      if (trigger) trigger.disabled = false;
    } finally {
      input.remove();
    }
  }, { once: true });
  input.addEventListener("cancel", () => input.remove(), { once: true });
  document.body.append(input);
  input.click();
}

function makeUploadButton(category, { compact = false } = {}) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = compact
    ? "local-content-upload local-content-upload--compact"
    : "local-content-upload local-content-upload--toolbar";
  button.dataset.localContentUpload = "";
  button.dataset.uploadCategory = category;
  const actionLabel = compact ? "上传" : "导入";
  button.setAttribute("aria-label", `${actionLabel}${categoryLabels[category]}文件`);
  button.title = `${actionLabel}${categoryLabels[category]}文件`;
  if (compact) button.append(uploadIcon());
  else button.append(document.createTextNode("导入"));
  button.addEventListener("click", () => chooseFiles(category, button));
  return button;
}

function addDashboardUploads() {
  if (!/^\/keystatic\/?$/.test(window.location.pathname)) return;
  const panel = document.querySelector("#keystatic-main-panel");
  if (panel?.querySelector("#page-title")?.textContent.trim() !== "仪表板") return;
  const contentSection = [...panel.querySelectorAll("section")]
    .find((section) => section.querySelector("h2")?.textContent.trim() === "内容");
  if (!contentSection) return;

  for (const [collection, category] of Object.entries(dashboardCollections)) {
    const addLink = contentSection.querySelector(`a[role="button"][href="/keystatic/collection/${collection}/create"]`);
    const actions = addLink?.parentElement;
    if (!addLink || !actions || actions.querySelector("[data-local-content-upload]")) continue;
    actions.insertBefore(makeUploadButton(category, { compact: true }), addLink);
  }
}

function addCollectionToolbarUpload() {
  const match = window.location.pathname.match(/^\/keystatic\/collection\/(projects|articles|photos)\/?$/);
  if (!match) return;
  const category = { projects: "project", articles: "article", photos: "photo" }[match[1]];
  const toolbar = document.querySelector("#keystatic-main-panel > header");
  if (!toolbar || toolbar.querySelector("[data-local-content-upload]")) return;
  const addLink = [...toolbar.querySelectorAll('a[role="button"]')].find((link) => link.textContent.trim() === "添加");
  if (!addLink) return;

  addLink.before(makeUploadButton(category));
}

// Keep the upstream controls and their event handlers; only translate UI copy.
function localizeEditorToolbar() {
  localizeCMS();
  const toolbar = document.querySelector("#keystatic-main-panel > header");
  if (!toolbar) return;
  addDisabledTooltips(toolbar);
}

function arrangePhotoFields() {
  if (!/^\/keystatic\/collection\/photos\/(?:item\/[^/]+|create)\/?$/.test(window.location.pathname)) return;
  const form = document.querySelector("#item-edit-form, #item-create-form");
  if (!form) return;
  const orderLabel = [...form.querySelectorAll("label")].find((label) => label.childNodes[0]?.textContent.trim() === "展示顺序");
  const layoutLabel = [...form.querySelectorAll("label")].find((label) => label.childNodes[0]?.textContent.trim() === "卡片比例");
  if (!orderLabel || !layoutLabel) return;
  // Custom fields can add wrappers. Find the shared field grid by its contents
  // rather than relying on the native number input's fixed nesting depth.
  let grid = orderLabel.parentElement;
  while (grid && !grid.contains(layoutLabel)) grid = grid.parentElement;
  if (!grid || grid === form || !form.contains(grid)) return;
  for (const previous of form.querySelectorAll("[data-local-photo-fields]")) {
    if (previous !== grid) delete previous.dataset.localPhotoFields;
  }
  grid.dataset.localPhotoFields = "";

  const pairedLabels = new Set(["卡片比例", "照片方向"]);
  for (const field of grid.children) {
    const label = field.querySelector("label");
    const name = label?.childNodes[0]?.textContent.trim();
    field.dataset.localPhotoField = pairedLabels.has(name) ? "paired" : "full";
    if (pairedLabels.has(name) || name === "展示顺序") {
      label.parentElement.dataset.localPhotoControl = name === "展示顺序" ? "order" : "paired";
    }
  }
}

function localizeCollectionList() {
  if (!/^\/keystatic\/collection\/(?:projects|articles|photos)\/?$/.test(window.location.pathname)) return;
  const header = document.querySelector('#keystatic-main-panel [role="columnheader"][data-key="draft"]');
  const grid = header?.closest('[role="grid"]');
  const column = header?.getAttribute("aria-colindex");
  if (!grid || !column) return;

  // Keep the collection's boolean values for saving and sorting; localize only
  // the displayed text, including accessible names and hover titles.
  const replacements = new Map([
    ["Slug", "稳定短名"],
    ["草稿", "发布状态"], ["草稿（不公开）", "发布状态"],
    ["true", "草稿"], ["false", "已发布"],
  ]);
  function replaceText(root, labels = replacements) {
    const nodes = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    while (nodes.nextNode()) {
      const node = nodes.currentNode;
      const value = node.nodeValue.trim();
      if (labels.has(value)) node.nodeValue = node.nodeValue.replace(value, labels.get(value));
    }
    for (const element of root.querySelectorAll("[title]")) {
      const value = element.getAttribute("title");
      if (labels.has(value)) element.setAttribute("title", labels.get(value));
    }
  }
  const slugHeader = grid.querySelector('[role="columnheader"][data-key="@@slug"]');
  if (slugHeader) replaceText(slugHeader);
  replaceText(header);
  for (const cell of grid.querySelectorAll(`[role="rowheader"][aria-colindex="${column}"], [role="gridcell"][aria-colindex="${column}"]`)) {
    const value = cell.textContent.trim();
    const status = value === "true" || value === "草稿" ? "draft"
      : value === "false" || value === "已发布" ? "published" : undefined;
    if (!status) continue;
    cell.dataset.localPublicationStatus = status;
    // A localized cell must stay stable when the observer runs again.
    if (value === "true" || value === "false") replaceText(cell);
  }

  const featuredHeader = grid.querySelector('[role="columnheader"][data-key="featured"]');
  const featuredColumn = featuredHeader?.getAttribute("aria-colindex");
  if (!featuredHeader || !featuredColumn) return;
  replaceText(featuredHeader, new Map([["首页及项目页精选", "精选"]]));
  const featuredDescription = "是否在首页和项目页的精选区域展示";
  for (const label of featuredHeader.querySelectorAll("[title]")) {
    if (label.getAttribute("title") !== featuredDescription) label.setAttribute("title", featuredDescription);
  }
  const featuredLabels = new Map([["true", "已精选"], ["false", "未精选"]]);
  for (const cell of grid.querySelectorAll(`[role="rowheader"][aria-colindex="${featuredColumn}"], [role="gridcell"][aria-colindex="${featuredColumn}"]`)) {
    const value = cell.textContent.trim();
    const status = value === "true" || value === "已精选" ? "true"
      : value === "false" || value === "未精选" ? "false" : undefined;
    if (!status) continue;
    cell.dataset.localFeatured = status;
    if (value === "true" || value === "false") replaceText(cell, featuredLabels);
  }
}

let collectionTableGrid;
let collectionTableResizeObserver;

function alignCollectionTableScrollbar() {
  const grid = document.querySelector(".local-content-table");
  if (grid === collectionTableGrid && (!grid || collectionTableResizeObserver)) return;
  collectionTableResizeObserver?.disconnect();
  collectionTableResizeObserver = undefined;
  collectionTableGrid = grid;
  const body = grid?.querySelector(':scope > [role="rowgroup"]');
  const header = grid?.firstElementChild;
  if (!body || !header) return;
  const align = () => {
    const style = getComputedStyle(body);
    const borders = parseFloat(style.borderLeftWidth) + parseFloat(style.borderRightWidth);
    const scrollbar = Math.max(0, body.offsetWidth - body.clientWidth - borders);
    grid.style.setProperty("--local-table-scrollbar-width", `${scrollbar}px`);
    header.scrollLeft = body.scrollLeft;
  };
  collectionTableResizeObserver = new ResizeObserver(align);
  collectionTableResizeObserver.observe(body);
  collectionTableResizeObserver.observe(grid);
  align();
}

const composingStableSlugs = new WeakSet();

function isStableSlugInput(input) {
  if (!(input instanceof HTMLInputElement)
    || !/^\/keystatic\/collection\/(projects|articles|photos)\/(item|create)(\/|$)/.test(location.pathname)) return false;
  return Array.from(input.labels ?? []).some((label) =>
    /^稳定短名(?:（网址）)?$/.test(label.textContent.replace(/[\s*]/g, "")));
}

function replaceSlugSpaces(value) {
  // Consecutive keystrokes may already have turned the previous space into '-'.
  return value.replace(/[\s-]+/g, (separators) => /\s/.test(separators) ? "-" : separators);
}

function normalizeStableSlug(input) {
  const value = input.value;
  const normalized = replaceSlugSpaces(value);
  if (normalized === value) return false;
  const start = input.selectionStart;
  const end = input.selectionEnd;
  const direction = input.selectionDirection;
  // Bypass React's value tracker so its normal onChange receives the new slug.
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set;
  setter.call(input, normalized);
  if (start !== null && end !== null) {
    input.setSelectionRange(
      replaceSlugSpaces(value.slice(0, start)).length,
      replaceSlugSpaces(value.slice(0, end)).length,
      direction,
    );
  }
  return true;
}

// Capture before React's bubbling onChange; do not interrupt an IME composition.
document.addEventListener("input", (event) => {
  const input = event.target;
  if (isStableSlugInput(input) && !event.isComposing && !composingStableSlugs.has(input)) {
    normalizeStableSlug(input);
  }
}, true);
document.addEventListener("compositionstart", (event) => {
  if (isStableSlugInput(event.target)) composingStableSlugs.add(event.target);
}, true);
document.addEventListener("compositionend", (event) => {
  const input = event.target;
  if (!composingStableSlugs.has(input)) return;
  composingStableSlugs.delete(input);
  // Some browsers omit the final input event after committing a composition.
  queueMicrotask(() => {
    if (input.isConnected && !composingStableSlugs.has(input) && normalizeStableSlug(input)) {
      input.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText" }));
    }
  });
}, true);

function addUploadShortcuts() {
  localizeEditorToolbar();
  addEditorImageUploadHint();
  arrangePhotoFields();
  localizeCollectionList();
  alignCollectionTableScrollbar();
  addDashboardUploads();
  addCollectionToolbarUpload();
}

function addEditorImageUploadHint() {
  if (!/^\/keystatic\/collection\/(projects|articles)\/(?:create|item\/[^/]+)\/?$/.test(location.pathname)) return;
  for (const editor of document.querySelectorAll('[data-keystatic-editor="content"][contenteditable="true"]')) {
    if (editor.previousElementSibling?.classList.contains("local-editor-image-upload-hint")) continue;
    const hint = document.createElement("p");
    hint.className = "local-editor-image-upload-hint";
    hint.textContent = "图片可直接拖入正文，或在正文中按 ⌘V / Ctrl+V 粘贴。";
    editor.before(hint);
  }
}

const observer = new MutationObserver(addUploadShortcuts);
observer.observe(document.documentElement, {
  childList: true, characterData: true, subtree: true,
  attributes: true, attributeFilter: ["aria-label", "title", "placeholder", "disabled"],
});
window.addEventListener("popstate", addUploadShortcuts);
document.addEventListener("input", updateEditorBreadcrumb);
document.addEventListener("change", updateEditorBreadcrumb);
window.addEventListener("resize", hideDisabledTooltip);
document.addEventListener("scroll", hideDisabledTooltip, true);
document.addEventListener("pointerdown", hideDisabledTooltip, true);
document.addEventListener("focusin", hideDisabledTooltip);
document.addEventListener("keydown", (event) => { if (event.key === "Escape") hideDisabledTooltip(); });
addUploadShortcuts();
