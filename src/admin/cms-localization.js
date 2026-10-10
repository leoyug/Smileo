// Translate CMS interface strings only; never rewrite stored content or values.
const labels = new Map(Object.entries({
  "创造": "创建", "Create": "创建", "节省": "保存", "Save": "保存",
  "Reset": "重置", "Reset changes": "撤销未保存的修改",
  "Unsaved": "未保存", "Saving changes": "正在保存", "Creating entry": "正在创建",
  "Delete entry…": "删除内容", "Delete entry": "删除内容",
  "Copy entry": "复制内容", "Paste entry": "粘贴内容", "Duplicate entry…": "创建副本",
  "Preview": "预览", "View on GitHub": "在 GitHub 中查看",
  "Choose file": "选择文件", "Remove": "移除", "Download": "下载",
  "Regenerate": "重新生成", "regenerate": "重新生成",
  "Filename": "文件名", "File name": "文件名", "Image details": "图片信息",
  "Alt text": "替代文本", "Alternative text": "替代文本", "Title": "标题",
  "Width": "宽度", "Height": "高度", "Image URL": "图片网址",
  "theme": "切换主题", "Light": "浅色", "Dark": "深色", "System": "跟随系统",
  "透明": "清除",
  "Open app navigation": "打开导航", "Resize": "调整面板宽度", "show search": "展开搜索",
  "Loading Entries": "正在加载内容", "Loading Item": "正在加载内容",
  "Status": "状态", "Name": "名称", "Content": "内容", "Changed": "已修改",
  "Add": "添加", "Edit": "编辑", "Done": "完成", "Cancel": "取消",
  "Add item": "添加条目", "Edit item": "编辑条目",
  "Paragraph": "正文", "Text block": "文本样式", "Text Alignment": "文本对齐",
  "Bold": "加粗", "Italic": "斜体", "Strikethrough": "删除线", "Code": "行内代码",
  "Clear formatting": "清除格式", "Text formatting": "文字格式", "Formatting options": "格式选项",
  "Underline": "下划线", "Superscript": "上标", "Subscript": "下标",
  "Bullet list": "无序列表", "Bullet List": "无序列表",
  "Numbered list": "有序列表", "Numbered List": "有序列表", "Lists": "列表", "Blocks": "内容块",
  "Ordered list": "有序列表", "Blockquote": "引用", "Layout": "布局", "Layouts": "布局",
  "Divider": "分隔线", "Quote": "引用", "Code block": "代码块", "Table": "表格", "Image": "图片",
  "Text": "文字", "Link": "链接", "Unlink": "取消链接", "Language": "语言",
  "Code block language": "代码块语言", "Insert": "插入", "Insert block": "插入内容块", "Insert menu": "插入菜单",
  "Options": "选项", "Cell options": "单元格选项", "Header row": "表头行",
  "Select Column": "选择列", "Select Row": "选择行", "Select Table": "选择表格",
  "Delete row": "删除行", "Delete column": "删除列", "Insert row below": "在下方插入行", "Insert column right": "在右侧插入列",
  "Align left": "左对齐", "Align center": "居中", "Align right": "右对齐", "Justify": "两端对齐",
  "Empty list": "暂无条目", "Add the first item to see it here.": "添加条目后会显示在这里。",
  "Empty collection": "暂无内容", "There aren't any entries yet.": "还没有添加内容。",
  "Create the first entry": "创建第一条内容", "to see it here.": "后即可在这里查看。",
  "No results": "没有匹配结果", "No results…": "没有匹配结果",
  "No items selected…": "尚未选择条目", "Entry not found.": "内容不存在。",
  "Unable to load collection": "无法加载内容列表", "Failed to load shell": "无法加载管理界面",
  "Not found": "页面不存在", "Contains invalid fields. Please edit.": "有字段填写不正确，请编辑。",
  "Save and duplicate entry": "保存并创建副本",
  "Yes, delete": "确认删除", "Save and duplicate": "保存并创建副本",
  "You have unsaved changes. Save this entry to duplicate it.": "存在未保存的修改，请先保存，再创建副本。",
  "Are you sure? This action cannot be undone.": "确定删除这条内容吗？此操作无法撤销。",
  "Entry created": "内容已创建", "Entry updated": "内容已更新", "Entry deleted": "内容已删除",
  "Entry copied": "内容已复制", "Entry pasted": "内容已粘贴",
  "Start writing or press \"/\" for commands…": "开始写作，或按“/”插入内容…",
  "Start writing or press \"/\" for commands...": "开始写作，或按“/”插入内容…",
}));

const messages = new Set([
  "Empty list", "Add the first item to see it here.", "Empty collection",
  "There aren't any entries yet.", "to see it here.", "No results", "No results…",
  "No items selected…", "Entry not found.", "Unable to load collection",
  "Failed to load shell", "Contains invalid fields. Please edit.",
  "Entry created", "Entry updated", "Entry deleted", "Entry copied", "Entry pasted",
]);
const interfaceContext = 'button, a, label, option, [role="columnheader"], [role="tooltip"], [role="menu"], [role="listbox"], [role="dialog"], [role="alertdialog"], [role="alert"], .ProseMirror-placeholder';
const contentContext = 'input, textarea, pre, code, nav, #page-title, [role="gridcell"], [role="rowheader"], [contenteditable="true"]';

export function translateCMSLabel(text) {
  if (text === " is required") return "为必填项";
  const value = text.trim();
  let translation = labels.get(value);
  if (!translation) {
    const heading = value.match(/^Heading ([1-6])$/);
    const required = value.match(/^(.+) is required\.?$/);
    const characters = value.match(/^(.+) must be (at least|no longer than) (\d+) characters(?: long)?$/);
    const limit = value.match(/^(.+) must be (at least|at most|a multiple of|after|no later than) (.+)$/);
    const slug = value.match(/^(.+) must (not be empty|be unique|not contain slashes|not start or end with spaces|not (?:be|contain) \.\.?)$/);
    const number = value.match(/^(.+) must be a number$/);
    const search = value.match(/^No items matching "(.*)" were found\.$/);
    if (heading) translation = `${heading[1]} 级标题`;
    else if (required) translation = `${required[1]}为必填项`;
    else if (characters) translation = `${characters[1]}${characters[2] === "at least" ? "至少需要" : "不能超过"}${characters[3]}个字符`;
    else if (limit) {
      const phrases = { "at least": "不能小于", "at most": "不能大于", "a multiple of": "必须为以下数值的倍数：", "after": "必须晚于", "no later than": "不能晚于" };
      translation = `${limit[1]}${phrases[limit[2]]}${limit[3]}`;
    } else if (slug) {
      const phrases = { "not be empty": "不能为空", "be unique": "已存在，请使用其他短名", "not contain slashes": "不能包含斜杠", "not start or end with spaces": "首尾不能包含空格" };
      translation = `${slug[1]}${phrases[slug[2]] ?? "不能包含单独的“.”或“..”路径段"}`;
    }
    else if (number) translation = `${number[1]}必须填写数字`;
    else if (search) translation = `没有找到与“${search[1]}”匹配的内容。`;
  }
  return translation ? text.replace(value, translation) : text;
}

function isContent(element) {
  if (element.closest('[data-has-items="false"]')) return false;
  if (!element.closest('[contenteditable="true"], input, textarea, pre, code') && element.closest('button, [role="button"]')) return false;
  return !!element.closest(contentContext) && !element.closest(".ProseMirror-placeholder");
}

// The native editor uses the stable URL slug in its breadcrumb. Present the
// editable content name while keeping that URL and the collection link intact.
export function updateEditorBreadcrumb() {
  const route = location.pathname.match(/^\/keystatic\/collection\/(projects|articles|photos)\/item\/[^/]+\/?$/);
  if (!route) return;
  const form = document.querySelector("#item-edit-form");
  const breadcrumb = document.querySelector('#keystatic-main-panel > header [aria-current="page"]');
  if (!form || !breadcrumb) return;
  const isPhoto = route[1] === "photos";
  const label = [...form.querySelectorAll("label")].find(element =>
    element.childNodes[0]?.textContent.trim() === (isPhoto ? "画面描述" : "标题"));
  const input = label && document.getElementById(label.htmlFor);
  if (!input || !("value" in input)) return;
  const name = input.value.trim() || (isPhoto ? "未填写画面描述" : "未填写标题");
  if (breadcrumb.textContent !== name) breadcrumb.textContent = name;
  if (breadcrumb.getAttribute("title") !== name) breadcrumb.setAttribute("title", name);
}

export function localizeCMS() {
  updateEditorBreadcrumb();
  const isPhotoEditor = /^\/keystatic\/collection\/photos\/(?:create|item\/[^/]+)\/?$/.test(location.pathname);
  const translateLabel = (text) => isPhotoEditor && /^(?:Regenerate|regenerate|重新生成)$/.test(text.trim())
    ? text.replace(text.trim(), "根据描述生成")
    : translateCMSLabel(text);
  const roots = document.querySelectorAll('#keystatic-main-panel, [id^="primary-pane-"], [role="tooltip"], [role="dialog"], [role="alertdialog"], [role="menu"], [role="listbox"], [role="alert"], [role="status"]');
  for (const root of roots) {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) {
      const node = walker.currentNode;
      const element = node.parentElement;
      if (!element || isContent(element)) continue;
      const text = node.nodeValue;
      // Field validation can be split across text nodes by the native UI.
      const validation = /(?: is required| must (?:be|not))/.test(text);
      if (!element.closest(interfaceContext) && !messages.has(text.trim()) && !validation) continue;
      const translated = translateLabel(text);
      if (translated !== text) node.nodeValue = translated;
    }
    for (const element of root.querySelectorAll("[aria-label], [title], [placeholder]")) {
      if (element.closest('[contenteditable="true"], nav') || (element.closest('[role="gridcell"], [role="rowheader"]') && !element.closest('button, [role="button"]'))) continue;
      for (const attribute of ["aria-label", "title", "placeholder"]) {
        const value = element.getAttribute(attribute);
        if (!value) continue;
        const translated = translateLabel(value);
        if (translated !== value) element.setAttribute(attribute, translated);
      }
    }
  }
}
