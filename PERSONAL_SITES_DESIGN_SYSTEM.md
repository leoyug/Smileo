# 个人网站 HTML/CSS 结构与可复用设计系统

## 文章正文标题

文章正文中的二级至六级标题统一使用寒蝉锦书宋 Compact Bold（`--font-heading`、`--weight-bold`），复用已自托管的 700 字重子集，不使用合成粗体。二级标题按 Figma `16473:8706` 保持 20px / 28px；字号、间距与主题文字色沿用既有规则。此规则仅作用于文章正文，文章页主标题与项目详情继续按各自规范呈现。

## 正文代码显示

文章与项目中的 Markdown 代码块、设计系统预览中的 Astro `Code` 统一使用 `src/lib/code-highlighting.mjs`。Shiki 在构建时生成 GitHub Light Default / Dark Default 双主题，跟随网站 `data-theme` 切换，不加载客户端高亮库。容器使用 `--color-code-*` 语义 token、12px 圆角与单层细边框；代码使用 Geist Mono、14px / 24px，横向留白在 16–24px 之间自适应，块前后留 24px。

顶部展示语言与 44px 高的复制操作；复制后提示「已复制」，权限失败时保留可选中的原文并提供手动复制提示，离开页面清理反馈计时器。不支持 Clipboard API 或禁用 JavaScript 时隐藏复制按钮，代码仍完整显示。长行保留缩进与原始换行，只在代码区横向滚动；代码区可通过 Tab 聚焦并用方向键滚动，焦点与滚动条随主题映射。行内代码使用浅底与小圆角，不继承代码块的布局。示例见开发环境 `/design-system` 的「代码块」。

> 采样日期：2026-08-15。数据来自页面 DOM、服务端 HTML、浏览器计算样式，以及 1440px 桌面与 390px 窄屏检查。动态效果、登录态和 A/B 内容可能随时间变化；文中尺寸是当前页面的实测值或由响应式类名推导的近似值。

## 1. 总体结论

这 12 个网站可归为四种骨架：

1. **窄栏文章索引**：Kieran、Jakub、Jace、Minsang。内容宽度约 510–644px，以行式列表代替重卡片。
2. **编辑部/侧栏布局**：Poolside、Floguo、Hannah。桌面保留导航或身份侧栏，主内容独立滚动或自然向下延展。
3. **沉浸式作品集**：Jackie、Nicole。用全屏段落、媒体、拟物小组件和独立滚动区表达个性。
4. **纸张式个人主页**：Ian、Sue、Bao。暖白背景、低对比文本、衬线或手写展示字、非常轻的边框和阴影。

它们共同遵循这些规律：

- 正文不追求大字号：常见为 14–16px，行高 1.45–1.65。
- 桌面正文阅读宽度多为 560–640px；作品展示区才扩大到 800–1000px。
- 页面背景不是纯白时，多使用暖灰纸张色；正文接近黑但很少用纯黑。
- 列表项比传统 Card 更常见：靠间距、日期、分隔线和 hover 反馈建立层级。
- 阴影很少用于大容器，只用于可操作的小对象、预览浮层和拟物元素。
- 移动端通常不缩小字体，而是收窄边距、隐藏侧栏、把横向行改为纵向堆叠。

## 2. 逐站结构与样式摘要

### Kieran Zhang — https://kieran.build/zh/

- **HTML 骨架**：`header[sticky] > nav + language/theme`，随后 `main > intro + blog section + projects section`，最后 `footer > copyright + nav`。
- **布局**：桌面外层 `max-width: 640px`，24px 内边距后实际内容宽 592px；header 高 64px。移动端宽 390px 时保持 24px gutter，内容宽 342px。
- **排版**：系统无衬线栈；正文 16/24，文章标题 15px，页面姓名仅约 16.8px/21、600 weight，刻意不做“大英雄标题”。
- **颜色**：背景 `oklch(0.98 0.006 60)` 暖白；正文 `oklch(0 0 0 / .87)`；辅助灰来自 Zinc 色阶；状态色为低饱和绿。
- **组件**：文章行为 `display:flex; justify-content:space-between; gap:32px; padding:8px 0`；圆形 icon button 44×44；项目卡约 12px 圆角但没有明显阴影。
- **响应式**：桌面文字导航在小屏隐藏，替换为 44px 菜单按钮；顶部内容间距由 112px 降到 96px；文章日期保持右对齐，长标题自然换行。

### Jakub Krehel — https://jakub.kr/

- **HTML 骨架**：单一 `main`，依次是身份行、简介、Projects、Writing、Newsletter、页尾状态。
- **布局**：桌面 `main` 宽 644px、顶距 96px；390px 屏幕下左右 24px，内容宽 342px，顶距 48px。
- **排版**：Inter Variable；正文 16/26，标题同样是 16px/22、500 weight；靠留白而不是字号区分章节。
- **颜色**：背景约 `#fcfcfc`，正文近 `#1f1f1f`，辅助灰约 `#777`；大量颜色用 Lab 定义，便于获得均匀的明度梯度。
- **组件**：项目卡常见 16px 圆角；次级表面 8/12px 圆角；卡片用 6% 一像素描边加 4%–6% 的 1–4px 软阴影。Subscribe 为 48px 高、完全胶囊按钮。
- **响应式**：卡片在移动端改为单列并增加纵向高度；大章节间距桌面 96/128px、移动端 64px；Newsletter 输入框和按钮仍并排，输入框使用 `min-width:0` 防止溢出。

### Poolside Blog — https://poolside.ai/blog

- **HTML 骨架**：页面级 flex；`header/nav` 是左侧栏，`main` 是文章分组，`footer` 再复用侧栏式链接。
- **布局**：桌面外边距约 80px，左侧导航宽 160px，主区从 x=240 开始并占剩余 1120px；首屏特色文章为三列，下面列表为“分组标题 + 文章行”。
- **排版**：Untitled Sans 为主，JetBrains Mono 用于日期/元信息；正文 15–16px，列表标题 20/28，分组和特色标题 24/36。
- **颜色**：背景 `#fbfaf6`，正文 `#000`，辅助 `#6f6d69`，弱辅助 `#93908b`；交互强调使用高饱和蓝紫色。
- **组件**：几乎无传统卡片轮廓；信息密度靠列对齐、元信息字号和整齐的基线控制。圆角主要出现在媒体底部（约 12px）和圆形控制。
- **响应式**：`max-md` 隐藏桌面侧栏，改用移动导航；多列特色区降为单列或横向可滚动区域；主区取消 160px 偏移并使用页面 gutter。

### Ian Neo — https://ianneo.xyz/

- **HTML 骨架**：`main.page > header.hero + holder`；holder 内是 Highlights、Products、Columns、Practice、Footer。
- **布局**：390px 屏幕实测 16px gutter；主内容以 flex-column 组织，section 之间约 48px；移动端顶部留白较大（约 176px），保留“展览式”呼吸感。
- **排版**：系统无衬线，正文 14/21.7；大多数层级仍为 14px，只用颜色和间距区分；局部使用 Biro Script 手写体与 monospace。
- **颜色**：背景 `#f9f9f9`，正文 `#151618`，次级 `#60646f`，标签 `#858892`，表面约 `#efefef`。
- **组件**：40×40 圆形箭头；媒体/产品表面多为 12px 圆角；仅重要浮层使用 `0 10px 24px rgb(0 0 0 / .14)`。
- **响应式**：卡片和链接组在窄屏纵向排列；图片轮播保留横向轨道；桌面通过更大的中心容器和留白扩大，而不是把字号整体放大。

### Sue Park — https://suepark.xyz/

- **HTML 骨架**：`main > paper-grid-background + paper`；paper 内为 intro、project list、social links、footer。链接还带有 inline preview trigger/hit-area。
- **布局**：主阅读宽度固定在 560px。`>=1280px` 时显示“纸张 + 侧栏”构图，paper 使用自定义 `--sidebar-w` 偏移；内容顶部在不同宽度下从 80、96、120px 逐级增加，超宽屏使用 `clamp(100px, ..., 140px)`。
- **排版**：Biro Script 48/1.2 用于姓名；Inter Variable 用于正文；Crimson Pro 19/1.3 用于项目标题。字体混搭承担了绝大多数品牌表达。
- **颜色**：Stone/Zinc 暖灰体系；亮色纸张接近白，暗色为 `#18181b`；链接 hover 使用 orange-700 / dark orange-400。
- **组件**：项目行在桌面为“标题 ··· 日期”，中间用 2px 高点阵 leader；移动端改为标题和日期上下排列。交互链接扩大 4–5px 隐形点击区，active 缩放到 .97。
- **响应式**：640px 是项目行从堆叠变并排的关键点；1280px 才启用侧栏/纸张偏移。支持 `prefers-color-scheme`、焦点 ring 与 motion-safe 动画。

### Hannah Hearth — https://www.hannahhearth.com/

- **HTML 骨架**：`main > container > left nav + article section`，下接完整宽度 footer 和订阅表单。
- **布局**：1440px 下容器约 1280px；左栏宽约 387px，文章栏约 816px。文章是一串自然文档流 `<article>`，每项间距约 80–112px。
- **排版**：Be Vietnam Pro 14/21 为正文；Geist Pixel/Mono 31.5/35 用于文章标题，姓名约 26px。
- **颜色**：当前采样为深色：背景 Slate 900 `#0f172a`，文本 Slate 400 `#94a3b8`，footer Slate 800 `#1e293b`，输入表面 Slate 700 `#334155`。
- **组件**：文章条目没有卡片底板；输入仅 3.5px 圆角、1px 边框；主题按钮为 24px 圆形并用 inset shadow 表示月相。
- **响应式**：移动端左栏移至文章流顶部，双栏变单栏；文章标题从约 31.5px 降一级；容器 gutter 约 20px；文章间距由 112px 收敛为约 80px。

### Jackie Hu — https://jackiehu.design/

- **HTML 骨架**：Framer 生成的深层 div 结构，语义 landmark 较少；视觉上由 hero/桌面物件、当前项目、最近作品、其他作品、About 组成。
- **布局**：全宽沉浸式画布，媒体和“系统窗口”组件绝对/相对定位组合；作品区使用大图与叙事块交错。
- **排版**：基础 12px；IBM Plex Mono 为主要品牌字体，正文/系统控件混用 SF Pro 与 JetBrains Mono；常用 12/14/16/18/20px。
- **颜色**：暖纸背景 `#fffaf5`，正文黑，次级 `#69645e` / `#47443f`；系统蓝 `#007aff` 用于仿 macOS 控件。
- **组件**：8/10/12/16/24px 多级圆角；小窗口常用 `0 2px 10px 1px rgb(166 166 166 / .25)`；还使用彩色 glow 和内阴影制造实体感。
- **响应式**：桌面物件在窄屏重排或隐藏，项目内容转为单列；应为绝对定位元素设置容器级 breakpoint，避免按比例硬缩导致文字/点击目标过小。

### Floguo — https://www.floguo.com/artifacts/inline-favicons

- **HTML 骨架**：三段式：左侧 `nav`、中间 artifact index、右侧 `main > article`。右侧是独立的长文阅读区。
- **布局**：桌面左导航宽约 189px，中列约 603px，右 `main` 宽 800px、内边距 64px；文章正文实际宽约 352px，旁边保留演示/代码区域。
- **排版**：Zalando Sans 15/22.5；JetBrains Mono 14px 用于代码和 meta；STIX Two Text 36/40 用作集合标题。
- **颜色**：近白灰底、深紫灰正文；代码语法使用紫、蓝、红棕；边框透明度约 60%。
- **组件**：代码/工具表面 2/4/8/10px 圆角；导航按钮是 12px uppercase + letter spacing；阴影只用于可拖拽或立体演示对象。
- **响应式**：`md` 以下隐藏左导航，右主区使用 `100dvw`、顶部 80px、取消最小宽度；`xl` 以下文章与演示从横排变纵排，gap 从 96px 收敛到 48px。

### Jace — https://ja.mt/

- **HTML 骨架**：`main > .page-content > header + intro + work section + words section`；每个 section 是标题与重复 entry row。
- **布局**：外层最大宽 550px、左右 20px，实际内容宽 510px；桌面顶/底 padding 80px。
- **排版**：Inter Variable 16/24、约 450 weight；TF Exposure 可变衬线斜体 20/24 用于小节标题；元信息 12/14px。
- **颜色**：主色暖棕 `#73574a`，标题深棕 `#432818`，辅助使用主色 75% alpha。
- **组件**：行高约 58px、padding 12px 0、gap 20px；没有圆角卡片，靠极细 inset 线和 `0 1.5px 2px -0.25px rgb(0 0 0 / .18)` 表达分隔。
- **响应式**：容器天然 fluid，窄屏仍保留 20px gutter；行内容通过 `min-width:0`、截断或元信息换行适配，不需要大规模断点。

### Nicole Tang — https://www.nicoletang.design/

- **HTML 骨架**：左侧 profile/timeline/footer，右侧 `main.showcase`；showcase 内每个 case study 占一屏并在独立滚动容器中连续排列。
- **布局**：1440px 下左栏 450px，右栏 990px；每个 case study 高 1000px（当前 viewport 高度），header 固定/绝对在右栏顶部。
- **排版**：JetBrains Mono 14/20 负责界面和元信息；Instrument Serif 32/32 负责作品名；Inter 用于局部系统信息。
- **颜色**：纸张背景 `#f3eee8`，正文 `#181816`，辅助 `#878581`，强调 `#c4704b`；黑色以 6%/12% alpha 形成细边框和轨道。
- **组件**：timeline、case index、主题按钮、胶囊 tag；圆角以 pill 为主，局部 10/11/16px；小控件使用多层 inset highlight 和 0.5–3px 微阴影。
- **响应式**：桌面适合左右独立区；移动端应切成单一文档流：profile 在上、case study 在下，取消 viewport 锁高和独立滚动，媒体宽度 100%。

### Minsang Choi — https://minsangchoi.com/

- **HTML 骨架**：Framer 生成的单栏身份介绍与项目列表，语义标签较少。
- **布局**：桌面核心内容宽约 600px，居中；版面主要依靠大面积纯白留白。
- **排版**：Instrument Sans；正文/项目多为 15px，姓名 32/32、500；meta 10/12px。
- **颜色**：纯白背景、纯黑正文，辅助灰 `#888` / `#999`。
- **组件**：无可见圆角和阴影；作品条目是文字行/媒体块，hover 只改变透明度或颜色。
- **响应式**：600px 容器在小屏改为 `width:auto` + 20–24px gutter，媒体单列；字体基本保持不变。

### Bao To — https://www.baothiento.com/about

- **HTML 骨架**：顶栏/身份链接、about hero、经历或作品内容、多个可交互小卡/浮层；页面实现偏组件化，但语义 heading 很克制。
- **布局**：桌面主要内容约 868px 居中；标题区顶部约 144px。卡片在内容网格内排列。
- **排版**：系统无衬线 16/24；PP Mori 用于品牌标题，hero 30/30、500；标签 10/12/14px。
- **颜色**：暖白/纸张表面 `#fcfaf6`、`#f5f1ec`、`#ece5d6`；正文接近 `#2a2520`，大量使用 40%–80% alpha 控制层级。
- **组件**：10/14px 卡片圆角与 pill；卡片阴影多为 `0 1px 2px rgb(38 30 18 / .06), 0 4px 14px rgb(38 30 18 / .08)`，悬浮层可增至 20–24px blur。
- **响应式**：`md` 前后 hero 从约 24px 升到 30px；卡片网格在移动端单列，保留 16/24px gutter；低对比阴影在深色或小屏上需配合边框保证可见性。

## 3. 推荐的统一设计变量

以下不是逐字复制任何单站，而是把重复模式合并成一套可维护的 token：

```css
:root {
  color-scheme: light dark;

  /* Neutral paper palette */
  --color-canvas: oklch(98% 0.006 60);       /* 暖白页面 */
  --color-surface: oklch(99.2% 0.003 70);   /* 卡片/纸张 */
  --color-surface-2: oklch(95.5% 0.012 72); /* 次级表面 */
  --color-ink: oklch(20% 0.012 55);         /* 避免纯黑 */
  --color-muted: oklch(53% 0.014 55);
  --color-faint: oklch(68% 0.012 55);
  --color-line: oklch(20% 0.012 55 / 12%);
  --color-accent: oklch(65.6% 0.122 180);   /* 青绿色 #00a894 */
  --color-accent-contrast: #191918;

  /* Typography */
  --font-sans: Inter, ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif;
  --font-serif: "Instrument Serif", "Crimson Pro", Georgia, serif;
  --font-mono: "JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, monospace;
  --font-script: "Biro Script", "Segoe Print", "Bradley Hand", cursive;

  --text-xs: 0.75rem;    /* 12 */
  --text-sm: 0.875rem;   /* 14 */
  --text-ui: 0.9375rem;  /* 15 */
  --text-base: 1rem;     /* 16 */
  --text-lg: 1.1875rem;  /* 19 */
  --text-xl: 1.25rem;    /* 20 */
  --text-2xl: 1.5rem;    /* 24 */
  --text-3xl: 2rem;      /* 32 */
  --text-4xl: 2.25rem;   /* 36 */
  --text-display: 3rem;  /* 48 */

  --leading-tight: 1.1;
  --leading-title: 1.25;
  --leading-copy: 1.55;
  --leading-relaxed: 1.65;

  /* 4px base spacing */
  --space-1: 0.25rem;
  --space-2: 0.5rem;
  --space-3: 0.75rem;
  --space-4: 1rem;
  --space-5: 1.25rem;
  --space-6: 1.5rem;
  --space-8: 2rem;
  --space-12: 3rem;
  --space-16: 4rem;
  --space-20: 5rem;
  --space-24: 6rem;
  --space-32: 8rem;

  --radius-xs: 0.25rem;
  --radius-sm: 0.5rem;
  --radius-md: 0.75rem;
  --radius-lg: 1rem;
  --radius-xl: 1.5rem;
  --radius-pill: 9999px;
  --corner-smoothing: 0.6;

  --shadow-hairline: 0 0 0 1px rgb(30 24 18 / 6%);
  --shadow-card: 0 1px 2px rgb(38 30 18 / 6%), 0 4px 14px rgb(38 30 18 / 8%);
  --shadow-float: 0 10px 24px rgb(38 30 18 / 14%);

  --content-reading: 37rem; /* 592px */
  --content-wide: 54.25rem; /* 868px */
  --content-showcase: 62rem; /* 992px */
  --sidebar: 10rem;         /* 160px */
  --gutter: 1.5rem;
}

@media (prefers-color-scheme: dark) {
  :root {
    --color-canvas: oklch(18% 0.012 260);
    --color-surface: oklch(23% 0.014 260);
    --color-surface-2: oklch(28% 0.014 260);
    --color-ink: oklch(91% 0.008 80);
    --color-muted: oklch(70% 0.01 260);
    --color-faint: oklch(56% 0.01 260);
    --color-line: oklch(100% 0 0 / 12%);
  }
}
```

## 4. 通用 HTML 组件

### 页面 Shell 与导航

```html
<div class="site-shell">
  <header class="site-header">
    <a class="brand" href="/">Name</a>
    <nav class="desktop-nav" aria-label="Primary">...</nav>
    <button class="icon-button mobile-menu" aria-label="Open menu">...</button>
  </header>
  <main id="main" class="reading-column">...</main>
  <footer class="site-footer">...</footer>
</div>
```

```css
.site-header {
  position: sticky;
  inset-block-start: 0;
  z-index: 20;
  min-height: 4rem;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-inline: max(var(--gutter), calc((100vw - var(--content-reading)) / 2));
  background: color-mix(in oklab, var(--color-canvas) 88%, transparent);
  backdrop-filter: blur(12px);
}

.reading-column {
  width: min(100% - 2 * var(--gutter), var(--content-reading));
  margin-inline: auto;
  padding-block: clamp(4rem, 8vw, 7rem) 6rem;
}

.icon-button {
  inline-size: 2.75rem;
  block-size: 2.75rem;
  display: inline-grid;
  place-items: center;
  border: 0;
  border-radius: var(--radius-pill);
  color: var(--color-muted);
  background: transparent;
}
```

### Button

```css
.button {
  min-height: 2.75rem;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  padding-inline: var(--space-4);
  border: 1px solid transparent;
  border-radius: var(--radius-pill);
  font: 500 var(--text-ui)/1 var(--font-sans);
  transition: transform 150ms cubic-bezier(.23, 1, .32, 1),
              background-color 150ms ease, color 150ms ease;
}

.button--primary { background: var(--color-ink); color: var(--color-accent-contrast); }
.button--secondary { background: var(--color-surface); color: var(--color-ink); border-color: var(--color-line); box-shadow: var(--shadow-hairline); }
.button:active { transform: scale(.97); }
.button:focus-visible { outline: 2px solid var(--color-accent); outline-offset: 3px; }
```

### Input 与订阅组合

```html
<form class="subscribe">
  <label class="sr-only" for="email">Email address</label>
  <input id="email" class="input" type="email" placeholder="you@example.com">
  <button class="button button--primary">Subscribe</button>
</form>
```

```css
.subscribe {
  display: flex;
  gap: var(--space-2);
  padding: var(--space-1);
  border: 1px solid var(--color-line);
  border-radius: var(--radius-pill);
  background: var(--color-surface);
  box-shadow: var(--shadow-card);
}
.input {
  min-width: 0;
  flex: 1;
  height: 2.5rem;
  padding-inline: var(--space-4);
  border: 0;
  outline: 0;
  background: transparent;
  color: var(--color-ink);
  font: 400 var(--text-base)/1 var(--font-sans);
}
```

### 文章/项目行（优先于重卡片）

```html
<a class="content-row" href="/work/project">
  <span class="content-row__body">
    <strong>Project title</strong>
    <small>Short description</small>
  </span>
  <span class="dot-leader" aria-hidden="true"></span>
  <time>2026</time>
</a>
```

```css
.content-row {
  display: flex;
  align-items: baseline;
  gap: var(--space-3);
  min-height: 3rem;
  padding-block: var(--space-2);
  color: var(--color-ink);
  text-decoration: none;
}
.content-row__body { min-width: 0; display: grid; gap: var(--space-1); }
.content-row small, .content-row time { color: var(--color-muted); font-size: var(--text-sm); }
.dot-leader {
  flex: 1;
  min-width: var(--space-6);
  height: 2px;
  color: var(--color-faint);
  background: radial-gradient(circle, currentColor 1px, transparent 1px) 0 0 / 5px 2px repeat-x;
}
.content-row:hover strong { color: var(--color-accent); }
```

### Card（只在需要表面层级时使用）

```css
.card {
  padding: var(--space-5);
  border: 1px solid var(--color-line);
  border-radius: var(--radius-md);
  background: var(--color-surface);
  box-shadow: var(--shadow-card);
}
.card--media { overflow: clip; padding: 0; border-radius: var(--radius-lg); }
.card--quiet { box-shadow: none; background: transparent; }
```

## 5. 页面模板

### A. 窄栏文章/作品索引

```html
<main class="reading-column">
  <header class="intro">...</header>
  <section class="section-stack">
    <h2 class="eyebrow">Writing</h2>
    <div class="content-list">...</div>
  </section>
</main>
```

适用于 Kieran、Jakub、Jace、Minsang。推荐阅读宽度 560–640px，section 间距移动端 64px、桌面 96–128px。

### B. 左侧导航 + 编辑内容

```css
.editorial-shell {
  display: grid;
  grid-template-columns: var(--sidebar) minmax(0, 1fr);
  gap: 0;
  width: min(100% - 10rem, 80rem);
  margin: 3rem auto;
}
.editorial-sidebar { position: sticky; top: 3rem; align-self: start; }
.editorial-main { min-width: 0; }
```

适用于 Poolside、Floguo、Hannah。侧栏保持 160–400px，主区承担所有横向弹性。

### C. Profile + Showcase 双面板

```css
.portfolio-split {
  min-height: 100dvh;
  display: grid;
  grid-template-columns: minmax(20rem, 31.25vw) 1fr;
}
.portfolio-profile { padding: 2rem; }
.portfolio-showcase { min-width: 0; height: 100dvh; overflow-y: auto; }
.case-study { min-height: 100dvh; padding: 6.75rem 3rem 3rem; }
```

适用于 Nicole 和视觉导向更强的作品集。独立滚动只应在桌面开启。

### D. 纸张式个人主页

```css
.paper {
  width: min(100% - 2 * var(--gutter), 35rem);
  margin-inline: auto;
  padding-block: clamp(5rem, 10vw, 8.75rem) 2rem;
  background: var(--color-surface);
}
```

适用于 Sue、Ian、Bao。品牌感应主要来自字体、纸张色、点阵线、手写批注和轻微 hover，不要堆叠大阴影。

## 6. 统一响应式规则

```css
/* Mobile first */
:root { --gutter: 1.5rem; }
.desktop-nav, .editorial-sidebar { display: none; }
.mobile-menu { display: inline-grid; }

@media (min-width: 40rem) { /* 640px */
  .content-row { flex-direction: row; }
  .project-meta { display: inline-flex; }
}

@media (max-width: 39.999rem) {
  .content-row--stack-mobile { align-items: flex-start; flex-direction: column; gap: var(--space-1); }
  .content-row--stack-mobile .dot-leader { display: none; }
  .subscribe { border-radius: var(--radius-md); }
}

@media (min-width: 48rem) { /* 768px */
  .desktop-nav { display: flex; }
  .mobile-menu { display: none; }
  .editorial-sidebar { display: block; }
}

@media (max-width: 63.999rem) { /* <1024px */
  .editorial-shell, .portfolio-split { display: block; width: 100%; margin: 0; }
  .portfolio-showcase { height: auto; overflow: visible; }
  .case-study { min-height: auto; padding: 5rem var(--gutter); }
}

@media (min-width: 80rem) { /* 1280px */
  .paper-with-sidebar { margin-left: var(--sidebar); }
}

@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after { scroll-behavior: auto !important; animation-duration: .01ms !important; transition-duration: .01ms !important; }
}
```

### 实施原则

- `DashedUnderline` 的无特效版本保留静态虚线；启用任意特效时隐藏基础虚线，文字继续使用 `--color-link`，悬停、键盘聚焦及减少动态效果行为沿用原有实现。真实链接保留 `TextLink` 的实线下划线。
- JavaScript 读取动效时间 token 时使用 `src/lib/css-time.ts` 的 `cssTimeToMilliseconds`，同时兼容 `ms` 与 `s`；生产压缩可能把 `600ms` 改写为 `.6s`。WAAPI 和计时器使用毫秒，GSAP 需再除以 1000，不能直接用 `parseFloat` 丢弃单位。
- 小屏 gutter 优先使用 24px；信息密集型页面可降到 16–20px，但不要低于 16px。
- 44×44px 是交互区域的默认目标，主要操作、独立图标按钮和导航优先保持；紧凑分类标签、分段控件及正文内链接可按视觉密度与操作场景适当缩小，保持清晰的文字、键盘焦点与可辨认的点击边界，避免点击区域重叠或明显误触。
- 项目分类筛选 `ProjectFilters` 采用已确认的紧凑规格：按钮高度 32px、轨道高度 40px；保留原有触屏点击与键盘切换，不为满足统一 44px 而扩大筛选条。
- 不要通过整体缩放适配移动端；保留 14–16px 正文，改变的是列数、间距和信息排列。
- 只有沉浸式作品展示需要 `100dvh`；普通文章应允许自然文档流。
- 独立滚动容器仅在桌面启用，移动端统一回到 body 滚动。
- 支持 `prefers-color-scheme`、`prefers-reduced-motion` 和 `:focus-visible`。

## 7. 最值得复用的组合

如果要把这些站点的优点合成一个新个人网站，我会采用：

- Kieran/Jace 的 592px 窄栏与行式作品索引；
- Sue 的 serif + sans + script 三字体层级，但每页最多同时出现三种；
- Jakub/Bao 的 1px 低透明描边和两级轻阴影；
- Poolside/Floguo 的桌面侧栏，仅在内容确实需要多分区时启用；
- Nicole 的全屏 case study 只用于作品详情，不用于主页全部内容；
- Jackie 的拟物小组件作为 1–2 个记忆点，而不是全站基础视觉；
- 统一 4px 间距基准、24px 移动 gutter、默认 44px 点击目标与紧凑控件例外、640/768/1024/1280 四个断点。

这能得到一个既有个人气质、又能长期维护的系统：正文克制、布局稳定，个性集中在字体、少量颜色、一个核心互动和作品媒体上。

### 平滑圆角

偏好面板与项目媒体使用 corne.rs 同款 `@lisse/core` Squircle，平滑度由 `--corner-smoothing: .6` 控制，尺寸继续引用现有 `--radius-*`。交互容器只以 SVG 绘制背景、描边与浮层阴影，图片单独裁切；Dock、胶囊、圆形控件与正文列表沿用既有形状。无 JavaScript 或不支持路径裁切时回退为普通圆角。`/design-system` 提供同尺寸对比。

V0.4.6 的局部轮廓规格：偏好面板 16px 平滑圆角与实色背景；项目媒体外框为 12px 平滑圆角，精选项目图片使用 6px 圆角和 0.5px 半透明中灰描边。Dock 提示气泡为 10px 圆角、32px 高；亮色照片悬停气泡为 8px 圆角、28px 高，使用与模块小标题相同的字体和低对比 0.5px 内描边。

2026-10-06：写作与项目详情共用 `[data-detail-page]` 阅读样式、`detail-toc--reading` 文字目录及全站统一的完整页脚。项目元信息显示项目时间、项目类型与可选网址；文章元信息显示发布时间、文章分类和阅读时间，均使用圆点分隔的紧凑信息行。项目时间必填，支持年份或时间范围，网址未填写时连同分隔点一起隐藏；封面及有替代文本的正文图片复用图片放大组件。详情正文共用渐入，项目封面保留共享元素过渡，写作标题在列表与详情之间双向移动，返回时恢复入口滚动位置，标题文字快速交接以减轻重影；项目返回时保持入口页面的滚动位置，封面缩回原入口图片。详情标题与行高使用流式 token，视口从 640px 至 1280px 时字号由 32px 平滑增至 48px。

V0.5.13：页面介绍文字统一为 14px 字号、26px 行高与 8px 段落间距；文章和项目详情使用全站完整页脚；悬停精选项目卡片或键盘聚焦时，标题下划线从左至右展开。

V0.6.1：项目与文章详情返回上级页面时，入口内容仅渐显与模糊消散，不上移；保留文章标题与项目封面的共享回位，普通返回链接也触发详情退出过渡。亮色首页扇形照片的悬停文案读取画面描述，支持长文字换行与移动端边缘偏移；CMS 按照片勾选首页展示，按展示顺序最多选取 7 张已发布照片，少量照片居中，没有可展示照片时隐藏该区域。

V0.5.14：外部网站与邮件的 `TextLink` 保留下划线反馈，增加 Feather 右上箭头的展开动效；触屏与减少动态效果偏好下静态显示。关于页“设计工程师”使用 `AnimatedHighlight`，悬停或键盘聚焦时描绘鼠标图标并显示淡高亮，保留 Ruixen UI 的 MIT 许可。`DashedUnderline` 统一正文关键词强调，文字引用 `--color-link`、虚线引用 `--color-muted`。其 `selection` 效果用于 Figma：蓝框（`--color-selection-frame: #0d99ff`）与白色四角手柄立即显隐，悬停隐藏虚线，使用黑色白边光标与扩大后的稳定悬停区域。其 `pixel-person` 效果用于 Codex：使用作者提供的亮暗两版 SVG，在文字上方上移淡入、下移淡出，停留位置下移 8px，隐藏时暂停动画，减少动态效果下静态显示；两版头发为 `#1C1917`、衣服为 `#258F78`。头像 Canvas 与静态回退图同步随亮暗主题调整配色。组件名称、用法及示例同步至 `AGENTS.md` 与开发设计系统页。


V0.5.15：关于页“动效”启用蓝紫色波浪下划线，12px 波长、1.8px 线宽、550ms 循环，悬停与键盘聚焦时从左向右展开，离开恢复虚线。“AI”启用三枚 32px logo 的错开上移与扇形倾斜，采用透明轮廓轻阴影；Claude、ChatGPT 与新版 Cursor 图片按共享视觉数据配置，ChatGPT 额外旋转 180°，Cursor 保留新图原方向。“用心创作的事物”恢复普通正文。头像亮色使用海边插画、暗色使用像素肖像，主题切换重新采样粒子，减少动态效果下保留对应静态回退；头像指针影响范围为 144px，蝴蝶光标带低幅跟随与振翅，离开、失焦和后台时停止，亮色使用粉色且取消描边，暗色使用白色与低对比深色描边。同步组件说明、设计系统示例与字体子集。

V0.6.2：CMS 侧边栏新增「照片组件」分组，独立选择首页扇形、首页拖拽及文字悬停使用的已有照片；组件顺序与摄影页排序分开维护。摄影列表与三组组件列表的最左侧显示 32×32px 正方形缩略图，使用 Keystar 尺寸及圆角 token，保持原比例居中裁切，不拉伸图片。


精选项目标签：`ProjectCard` 的 `badge` 支持 `personal`（个人项目）、`case-study`（设计案例）、`experiment`（实验探索），与项目上线状态分开。样式分别来自 Figma `17258:12246`、`17257:12236`、`17293:12277`：原始 16px 图标、4px 图文间距、12px / 20px 常规文字、4px × 10px 内边距、0.5px 描边与胶囊圆角；深色主题为 5% 白色背景、`#434343` 边线和白字，亮色使用现有表面、边线和正文色映射。标签保留现有悬停与键盘聚焦显现行为，减少动态效果下立即切换。`src/lib/project-badges.ts` 按稳定短名配置：Wispora 为个人项目，宅畅想 App 为设计案例；设计系统页展示三款示例。

项目页分类切换：移除项目页的精选模块，顶部提供「全部 / 项目 / 案例 / 实验」胶囊滑块切换，参考 [beUI Tabs](https://beui.dev/components/motion/tabs) 的「Icon on selected」：只有选中的分类展开图标，未选中项收起图标且不占位；「全部」使用收纳图标，「项目」使用代码文件夹图标；Tab 使用简短文案，项目标签仍保留完整分类名称。`ProjectFilters` 复用现有色彩、间距和字体 token；轨道无边框，使用专属 token `--color-project-tab-track`，亮色为次级表面，深色为比网页背景更深的 `#111`；选中胶囊在亮色主题沿用网页背景 `--color-canvas`，深色主题使用已有的更浅表面色 `--color-surface-2`（`#232323`），文字与图标随主题映射。滑块与文字通过同一裁切层同步切换，图标展开与胶囊宽度同步变化；使用原生 WAAPI、现有 250ms token 与 `--ease-smooth-out`；选中状态一次性完成布局，图标与文字从当前可见位置通过 transform / opacity 接续，避免逐帧改变宽度，胶囊裁切同步变化；键盘与减少动态效果下直接定位。筛选前为列表保留维持当前滚动位置所需的动态最小高度，并关闭该页面的滚动锚定，避免长短分类切换引起整页跳位；滚回顶部时释放留白，窗口变化时重新计算，从项目详情返回前恢复原分类与所需留白。组件保留 Astro 静态输出，不增加 React 或 Motion 运行依赖。按当前项目页规格，单个 Tab 使用 13px 字号、24px 行高，上下 4px、左 10px、右 12px 内边距，高度随内容为 32px；图标仍为 16px，所有图标使用 1px 描边，图文间距为 2px，相邻 Tab 间距为 0px，外层轨道与选中裁切层内边距均为 4px，可见轨道总高度保持 40px。滚动容器顶部无额外内边距，介绍文字到可见轨道沿用桌面 80px、移动端 64px 的模块间距；键盘焦点环位于预留区域内，避免裁切。支持方向键、Home / End、可见焦点和分类结果播报。项目列表即时筛选并保留原展示顺序，从详情返回时保留原分类及共享封面目标位置；无 JavaScript 时显示全部项目。分类配置统一为 Wispora 个人项目、宅畅想 App / 宅畅想官网 / 亦我家装后台设计案例，其余实验探索。首页精选模块保留，设计系统页提供独立筛选示例。

### 2026-10-22：Wispora 项目详情

Wispora 按 Figma `16473:8686` 展示原始品牌封面、标题、14px 简介与四列参数（职责、平台、时间、工具）；窄屏参数为两列。复用现有 592px 阅读栏、详情目录、32px 封面后间距、14px / 26px 正文与 20px / 28px 小标题，标题和小标题使用已有寒蝉宋体 Bold。`tools` 为可选内容字段，未填写的项目保持既有简洁参数行；目录图标通过 `DetailToc` 的 `backIcon` / `topIcon` 扩展，不影响其他详情页。项目继续使用稳定短名 `wanderland`，并保持草稿。

### 2026-10-24：共用详情目录

项目与文章详情的 `DetailToc` 文字目录按 Figma `16473:8721` 统一为 200px 宽、15px 寒蝉宋体 Bold、24px 行高和 12px 条目间距；中等宽度随侧栏空间收窄。当前章节、悬停和键盘聚焦使用 `--color-ink`，其他章节沿用 `--color-faint`，亮暗主题共用语义 token。按作者要求，长标题自然换行并完整显示；每项保留至少 44px 的点击高度，视觉节奏由点击区上下扩展维持。滚动高亮、返回入口、移动端布局与原有图标保持现有行为。

### 2026-10-24：统一项目详情版式

所有项目详情复用 Wispora 的简介、参数网格、粗体标题和正文小标题，以及返回与回到顶部图标；不再根据 `tools` 是否填写切换版式。职责、平台、时间、工具按已有内容展示，空字段隐藏；桌面保留四列网格，窄屏为两列，可选网址放在参数区之后。继续复用现有封面比例、阅读栏、目录、图片放大与返回过渡，不改变文章详情或项目内容。
