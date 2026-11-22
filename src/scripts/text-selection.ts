type SelectionEdges = { flushStart: boolean; flushEnd: boolean };
type Fragment = SelectionEdges & { rect: DOMRect; lineHeight: number };
type Line = SelectionEdges & { left: number; right: number; top: number; bottom: number; lineHeight: number };

const latin = /\p{Script=Latin}/u;
const otherLetter = /(?=\p{Letter})\P{Script=Latin}/u;
const trailingPunctuation = /^(?:(?![\p{Ps}\p{Pi}])\p{P})+/u;
const segmenter = typeof Intl.Segmenter === "function" ? new Intl.Segmenter("en", { granularity: "word" }) : null;
const nativeOnly = "input, textarea, select, button, [contenteditable], pre, svg, [data-selection-native]";
const textHost = "[data-selection-container], p, h1, h2, h3, h4, h5, h6, li, dt, dd, figcaption, td, th, blockquote, div";
const forcedColors = matchMedia("(forced-colors: active)");
const overlays = new Map<HTMLElement, HTMLSpanElement>();
let mouseSelection = false;
let pointerId: number | null = null;
let frame = 0;

function wordBoundary(node: Node, offset: number, end: boolean) {
  if (!segmenter || !(node instanceof Text)) return offset;
  const segments = segmenter.segment(node.data);
  let word = segments.containing(end ? offset - 1 : offset);
  while (word && !word.isWordLike && trailingPunctuation.exec(word.segment)?.[0] === word.segment) {
    word = segments.containing(word.index - 1);
  }
  if (!word?.isWordLike || !latin.test(word.segment) || otherLetter.test(word.segment)) return offset;
  if (!end) return word.index;

  return Math.max(offset, word.index + word.segment.length);
}

function wordHighlightRange(range: Range) {
  const { startContainer, endContainer, startOffset, endOffset } = range;
  const start = wordBoundary(startContainer, startOffset, false);
  const end = wordBoundary(endContainer, endOffset, true);
  if (start === startOffset && end === endOffset) return range;

  // Expand only the painted background. Native selection owns text color and copying.
  const highlight = range.cloneRange();
  highlight.setStart(startContainer, start);
  highlight.setEnd(endContainer, end);
  return highlight;
}

function* selectedTextNodes(range: Range) {
  const root = range.commonAncestorContainer;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  for (let node = root instanceof Text ? root : walker.nextNode(); node; node = walker.nextNode()) {
    if (!(node instanceof Text) || !range.intersectsNode(node)) continue;
    const start = node === range.startContainer ? range.startOffset : 0;
    const end = node === range.endContainer ? range.endOffset : node.length;
    if (start < end) yield { node, start, end };
  }
}

function trimSelection(range: Range) {
  if ([range.startContainer, range.endContainer].some((node) => node.parentElement?.closest("code"))) return range;
  const text = range.toString();
  const trimmed = text.trim();
  if (!trimmed || text === trimmed) return range;

  const first = text.length - text.trimStart().length;
  const last = first + trimmed.length;
  const result = range.cloneRange();
  let offset = 0;
  for (const { node, start, end } of selectedTextNodes(range)) {
    const next = offset + end - start;
    if (first >= offset && first < next) result.setStart(node, start + first - offset);
    if (last > offset && last <= next) {
      result.setEnd(node, start + last - offset);
      break;
    }
    offset = next;
  }
  return result;
}

function collectFragments(range: Range) {
  const groups = new Map<HTMLElement, Fragment[]>();
  const fragment = document.createRange();
  for (const { node, start, end } of selectedTextNodes(range)) {
    fragment.setStart(node, start);
    fragment.setEnd(node, end);
    const rects = Array.from(fragment.getClientRects()).filter((rect) => rect.width > 0 && rect.height > 0);
    if (!rects.length) continue;

    const parent = node.parentElement;
    if (!parent || parent.closest(nativeOnly)) return null;
    // Paint above the inline code background and below its text.
    const host = parent.closest("code") ?? parent.closest(textHost);
    if (!(host instanceof HTMLElement)) return null;
    // Inline code has its own compact background inside the surrounding line.
    const lineHeight = host.matches("code") ? 0 : Number.parseFloat(getComputedStyle(parent).lineHeight);
    const group = groups.get(host) ?? [];
    const selected = node.data.slice(start, end);
    const startsWithPunctuation = /^\p{P}/u.test(selected);
    const endsWithPunctuation = /\p{P}$/u.test(selected);
    for (const rect of rects) {
      group.push({
        rect,
        lineHeight,
        flushStart: rect === rects[0] && startsWithPunctuation,
        flushEnd: rect === rects.at(-1) && endsWithPunctuation,
      });
    }
    groups.set(host, group);
  }
  return groups;
}

function getLines(fragments: Fragment[], scaleY: number): Line[] {
  const lines: Line[] = [];
  for (const { rect, lineHeight: computedLineHeight, flushStart, flushEnd } of fragments) {
    const line = lines.at(-1);
    const lineHeight = computedLineHeight || rect.height / scaleY;
    const center = (rect.top + rect.bottom) / 2;
    if (line && center > line.top && center < line.bottom && rect.left <= line.right + 1 && rect.right >= line.left - 1) {
      if (rect.left < line.left) line.flushStart = flushStart;
      if (rect.right >= line.right) line.flushEnd = flushEnd;
      line.left = Math.min(line.left, rect.left);
      line.right = Math.max(line.right, rect.right);
      line.top = Math.min(line.top, rect.top);
      line.bottom = Math.max(line.bottom, rect.bottom);
      line.lineHeight = Math.max(line.lineHeight, lineHeight);
    } else {
      lines.push({ left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom, lineHeight, flushStart, flushEnd });
    }
  }
  return lines;
}

function removeOverlay(host: HTMLElement, overlay: HTMLSpanElement) {
  overlay.remove();
  delete host.dataset.selectionHost;
  overlays.delete(host);
}

function clearOverlays() {
  for (const [host, overlay] of overlays) removeOverlay(host, overlay);
}

function selectionScale(renderedSize: number, layoutSize: string) {
  const size = Number.parseFloat(layoutSize);
  // Computed sizes retain fractions, with minor rounding when serialized to CSS pixels.
  return size > 0 && renderedSize > 0 && Math.abs(renderedSize - size) >= 0.01 ? renderedSize / size : 1;
}

function drawSelection(groups: Map<HTMLElement, Fragment[]>) {
  for (const [host, overlay] of overlays) {
    if (!groups.has(host)) removeOverlay(host, overlay);
  }
  for (const host of groups.keys()) {
    if (overlays.has(host)) continue;
    const overlay = document.createElement("span");
    overlay.className = "text-selection-overlay";
    overlay.setAttribute("aria-hidden", "true");
    host.dataset.selectionHost = getComputedStyle(host).position === "static" ? "static" : "positioned";
    host.append(overlay);
    overlays.set(host, overlay);
  }
  const geometry = Array.from(overlays, ([host, overlay]) => {
    const origin = overlay.getBoundingClientRect();
    const { width, height } = getComputedStyle(overlay);
    const scaleY = selectionScale(origin.height, height);
    return {
      overlay, origin, lines: getLines(groups.get(host) ?? [], scaleY),
      scaleX: selectionScale(origin.width, width),
      scaleY,
    };
  });
  for (const { overlay, origin, lines, scaleX, scaleY } of geometry) {
    overlay.replaceChildren(...lines.map((line) => {
      const mark = document.createElement("span");
      const height = line.lineHeight <= 12 ? line.lineHeight * 0.9 : line.lineHeight - 2;
      const center = (line.top + line.bottom) / 2;
      mark.style.left = `${(line.left - origin.left) / scaleX}px`;
      mark.style.top = `${(center - origin.top) / scaleY - height / 2}px`;
      mark.style.width = `${(line.right - line.left) / scaleX}px`;
      mark.style.height = `${height}px`;
      mark.toggleAttribute("data-selection-flush-start", line.flushStart);
      mark.toggleAttribute("data-selection-flush-end", line.flushEnd);
      return mark;
    }));
  }
}

function updateSelection() {
  frame = 0;
  const selection = document.getSelection();
  const root = document.documentElement;
  if (!mouseSelection || forcedColors.matches || !selection?.rangeCount || selection.isCollapsed) {
    root.removeAttribute("data-selection-blank");
    clearOverlays();
    return;
  }
  const highlight = wordHighlightRange(trimSelection(selection.getRangeAt(0)));
  const groups = collectFragments(highlight);
  const blank = !!groups && /^en(?:-|$)/i.test(root.lang) && !/[\p{L}\p{N}]/u.test(highlight.toString())
    && !Array.from(groups.keys()).some((host) => host.matches("code"));
  root.toggleAttribute("data-selection-blank", blank);
  if (!blank && groups?.size) drawSelection(groups);
  else clearOverlays();
}

function scheduleUpdate() {
  if (!frame && (mouseSelection || overlays.size)) frame = requestAnimationFrame(updateSelection);
}

function useNativeSelection() {
  mouseSelection = false;
  pointerId = null;
  document.documentElement.removeAttribute("data-selection-blank");
  clearOverlays();
}

function prepareInlineCode() {
  for (const code of document.querySelectorAll("code:not(pre code)")) {
    if (code.querySelector(":scope > [data-inline-code-text]")) continue;
    const text = document.createElement("span");
    text.setAttribute("data-inline-code-text", "");
    text.append(...code.childNodes);
    code.append(text);
  }
}

prepareInlineCode();
document.addEventListener("astro:page-load", prepareInlineCode);

document.addEventListener("pointerdown", (event) => {
  if (event.button !== 0 || !(event.target instanceof Element)) return;
  if (event.target.closest("[data-preferences-toggle], [data-preferences-panel]")) return;
  useNativeSelection();
  if (event.pointerType !== "mouse" || forcedColors.matches || event.target.closest(nativeOnly)) return;
  mouseSelection = true;
  pointerId = event.pointerId;
}, true);

document.addEventListener("pointerup", (event) => {
  if (event.pointerId !== pointerId) return;
  pointerId = null;
  const selection = document.getSelection();
  if (selection?.rangeCount && !selection.isCollapsed) {
    const range = selection.getRangeAt(0);
    const trimmed = trimSelection(range);
    if (trimmed !== range && collectFragments(trimmed)?.size) {
      const { startContainer, startOffset, endContainer, endOffset } = trimmed;
      const forward = selection.anchorNode === range.startContainer && selection.anchorOffset === range.startOffset;
      if (forward) selection.setBaseAndExtent(startContainer, startOffset, endContainer, endOffset);
      else selection.setBaseAndExtent(endContainer, endOffset, startContainer, startOffset);
    }
  }
  scheduleUpdate();
}, true);

document.addEventListener("selectionchange", scheduleUpdate);
document.addEventListener("keydown", (event) => {
  if (event.target instanceof Element && event.target.closest("[data-preferences-toggle], [data-preferences-panel]")) return;
  if (/^(Arrow|Home$|End$|Page)/.test(event.key) ||
    ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "a")) useNativeSelection();
}, true);
document.addEventListener("pointercancel", useNativeSelection);
document.addEventListener("astro:before-swap", useNativeSelection);
window.addEventListener("blur", () => {
  // Losing focus can interrupt a drag without clearing the text selection.
  pointerId = null;
});
window.addEventListener("resize", scheduleUpdate);
document.fonts.addEventListener("loadingdone", scheduleUpdate);
forcedColors.addEventListener("change", useNativeSelection);
