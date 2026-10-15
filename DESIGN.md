---
name: "Smileo V0.4.0"
description: "暖纸画布中的一条安静个人出版栏，把工作、写作与摄影收进同一套长期记录。"
colors:
  paper-canvas: "#f3eee8"
  pill-surface: "#fbf8f4"
  raised-surface: "#ebe4dc"
  primary-ink: "#262320"
  copy-ink: "#4e4943"
  muted-ink: "#65615c"
  faint-ink: "#817b74"
  border: "#d6cec5"
  quiet-line: "#d9d2ca"
  shadow-warm: "rgb(55 45 36 / 16%)"
  primary-accent: "#00a894"
  primary-accent-soft: "#cfe8e1"
typography:
  display:
    fontFamily: "Chill Jinshu Song Compact, PingFang SC, system-ui, sans-serif"
    fontSize: "2rem"
    fontWeight: 500
    lineHeight: 1.2
    letterSpacing: "-0.025em"
  page-title:
    fontFamily: "Chill Jinshu Song Compact, PingFang SC, system-ui, sans-serif"
    fontSize: "1.25rem"
    fontWeight: 500
    lineHeight: 1.4
    letterSpacing: "-0.015em"
  resume-name:
    fontFamily: "Chill Jinshu Song Text, PingFang SC, system-ui, sans-serif"
    fontSize: "2.25rem"
    fontWeight: 400
    lineHeight: "2.75rem"
  body:
    fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, Noto Sans SC, PingFang SC, Microsoft YaHei, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: "1.5rem"
    letterSpacing: "0"
  lead:
    fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, Noto Sans SC, PingFang SC, Microsoft YaHei, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.45
    letterSpacing: "0"
  metadata:
    fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, Noto Sans SC, PingFang SC, Microsoft YaHei, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 400
    lineHeight: 1.45
    letterSpacing: "0"
  detail-title:
    fontFamily: "Geist Mono, PingFang SC, system-ui, sans-serif"
    fontSize: "1.5rem"
    fontWeight: 500
    lineHeight: 1.3333
    letterSpacing: "-0.015em"
  mobile-detail-title:
    fontFamily: "Geist Mono, PingFang SC, system-ui, sans-serif"
    fontSize: "1.75rem"
    fontWeight: 500
    lineHeight: 1.1429
    letterSpacing: "-0.02em"
  mono:
    fontFamily: "Geist Mono, ui-monospace, SFMono-Regular, monospace"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: "1.5rem"
    letterSpacing: "0"
rounded:
  xxs: "2px"
  xs: "0.25rem"
  sm: "0.5rem"
  md: "0.75rem"
  lg: "1rem"
  xl: "1.5rem"
  pill: "9999px"
spacing:
  1: "0.25rem"
  2: "0.5rem"
  3: "0.75rem"
  4: "1rem"
  5: "1.25rem"
  6: "1.5rem"
  8: "2rem"
  12: "3rem"
  16: "4rem"
  20: "5rem"
  24: "6rem"
  32: "8rem"
components:
  button-primary:
    backgroundColor: "{colors.primary-ink}"
    textColor: "{colors.deep-canvas}"
    typography: "{typography.body}"
    rounded: "{rounded.pill}"
    padding: "0 1rem"
    height: "2.75rem"
  button-secondary:
    backgroundColor: "{colors.pill-surface}"
    textColor: "{colors.primary-ink}"
    typography: "{typography.body}"
    rounded: "{rounded.pill}"
    padding: "0 1rem"
    height: "2.75rem"
  floating-navigation:
    backgroundColor: "{colors.pill-surface}"
    textColor: "{colors.muted-ink}"
    rounded: "{rounded.pill}"
    padding: "1rem 1.5rem"
    width: "17.5rem"
    height: "3.5rem"
  project-card-visual:
    backgroundColor: "rgb(255 255 255 / 10%)"
    textColor: "{colors.primary-ink}"
    rounded: "{rounded.sm}"
    padding: "0.6875rem"
    height: "12.0625rem"
  input:
    backgroundColor: "{colors.pill-surface}"
    textColor: "{colors.primary-ink}"
    typography: "{typography.body}"
    rounded: "{rounded.sm}"
    padding: "0.7rem 1rem"
    height: "2.75rem"
---

# Design System: Smileo V0.4.0

## Overview

**Creative North Star: "暖纸上的一条安静出版栏"**

V0.4.0 是一份在暖纸画布上自然展开的中文个人出版物。它把工作、写作、摄影与个人履历放在同一条克制的阅读轴线上：内容先出现，界面退后，手写 Leo 标记留下作者温度。它以低饱和的纸张色、暖墨色和真实内容建立轻盈而可信的全站视觉世界。

系统的密度接近一份长期维护的私人刊物：正文安静、字号偏小、层级靠色阶和留白建立。全站只有一个 280×56px 图标胶囊导航，固定在屏幕底部持续提供方向；页面顶部不再重复文字导航。项目用真实内容图像形成有限的视觉停顿；摄影网格使用两种固定卡片比例，灯箱展示完整照片。

**Key Characteristics:**

- 带粉感的暖纸画布与微亮的胶囊表面，辅以青绿色的稀少状态色。
- 以 37rem（592px）内容栏为主轴，页面沿自然文档流纵向展开。
- 唯一的 280×56px 图标胶囊固定在屏幕底部，并为内容预留净空；所有链接保持 44×44px 目标。
- 14px 中文正文与克制的中等字重标题，不靠巨型字制造层级。
- 手写 Leo 标记与 Figma 原作导航图标是身份资产，不用通用图标替代。
- 项目卡展示真实内容图像，摄影卡片使用固定比例，灯箱展示照片的完整比例。
- 移动端回到单列，44px 交互目标、可见焦点与 reduced-motion 始终保留。

## Colors

色彩以一组带暖意的浅色中性层级为底；暖墨色负责阅读，青绿色只负责状态和细小强调。

### Primary

- **主色青绿：**主色 `#00a894`，用于焦点轮廓、少量状态、时间线节点、元数据强调与选择反馈；稀少才让它有效。
- **深绿余光：**`#14352f`，用于文字选择、局部柔和强调和低强度主色底，不承担大面积品牌铺色。

### Neutral

- **暖纸画布：**全站页面与浏览器主题色，是 V0.4.0 的默认世界。
- **浅纸胶囊：**固定底部导航、按钮、输入等需要独立操作表面的区域。
- **抬升纸灰：**局部结构、预览内部和需要轻微层级差的次级表面。
- **暖黑墨色：**主要标题、正文和高优先级图形。
- **关键次级文字：**导航、辅助说明、履历描述和其他仍需稳定阅读的次级信息使用 `muted-ink`。
- **可舍弃元数据：**日期、计数和最低优先级出版信息使用 `faint-ink`；它不能承载理解页面所必需的内容。
- **静默边线：**输入、卡片和分隔所需的最低对比结构线。

**The Paper Canvas Rule.** 暖纸画布是全站默认；通过轻微的纸色阶和留白，而不是大片纯白或卡片，建立结构。

**The Rare Accent Rule.** 青绿色只出现在状态、焦点与极少量元数据中，不用于大面积装饰或正文层级。

**The Theme Pair Rule.** 亮色是默认；深色模式是同一组语义 token 的重映射，不是简单反相。用户可在底部 dock 的偏好入口选择亮色、跟随系统或深色，选择只保存在本机。

**The Paper Neutral Rule.** V0.4.0 严格使用三层文字色：主文字 #262320、正文 #4e4943、说明与元数据 #817b74。页面不自行引入新的灰阶。

### Semantic Theme Map

颜色按角色维护，组件不得直接引用固定色值；完整的实时 token 列表与当前计算值以开发环境的 `/design-system` 为准。

| 层级 | 语义 token | 亮色 | 深色 |
| --- | --- | --- | --- |
| 基础表面 | `canvas` / `surface` / `surface-2` | `#f3eee8` / `#fbf8f4` / `#ebe4dc` | `#191918` / `#13120f` / `#232323` |
| 内容 | `ink` / `copy` / `muted` / `faint` | `#262320` / `#4e4943` / `#65615c` / `#817b74` | `#fafafa` / `#d0cecb` / `#808080` / `#808080` |
| 边界 | `line` / `line-subtle` / `leader` | `#d6cec5` / 线与 surface 的 55% 混合 / `#d9d2ca` | `#343331` / 线与 surface 的 55% 混合 / `#353231` |
| 强调 | `accent` / `accent-soft` | `#00a894` / `#cfe8e1` | `#00a894` / `#14352f` |
| 控件 | `control-idle` / `control-emphasis` / `control-selected` | `muted` / `ink` / `ink` | `muted` / `ink` / `ink` |

## Typography

**Display Font:** Chill Jinshu Song Compact（中文标题：Bold 用于大标题，Regular 用于小标题）
**Resume Name Font:** Chill Jinshu Song Text Regular（仅用于在线履历中的姓名）
**Body Font:** Geist Mono（拉丁、数字）+ PingFang SC（中文）
**Label/Mono Font:** 日期、数字和英文统一使用 Geist Mono

**Character:** 中文标题使用寒蝉宋体，Regular 与 Bold 分别承载小标题和大标题；正文维持系统中文无衬线，日期、数字和英文使用 Geist Mono，形成克制且清晰的字形对比。手写 Kaiti 字形只属于 Leo 标记和少量作者批注，不能扩展为界面字体。

### Hierarchy

- **Display**（中等字重，紧凑行高）：只用于少数最高层级表达，不作为每页必备英雄标题。
- **Page Title**（中等字重）：索引页和详情页标题；克制、可平衡换行。
- **Lead**（常规字重）：首页介绍与较重要的引导正文。
- **Body**（常规字重）：全站默认 14px 中文正文、列表和组件标题；基础行盒为 24px。
- **Metadata**（常规字重）：日期、年份、状态和说明；数字使用 tabular numerals 保持稳定。

**The Quiet Type Rule.** 重要性来自位置、字重、墨色和留白，不通过突然放大的字号、全大写或高对比装饰建立。

**The Mixed Script Rule.** 中文界面共享系统中文 sans，拉丁、数字统一回退到自托管 Geist Mono；script 只保留给作者标记。

## Layout

37rem（592px）内容栏是首页、项目、写作、摄影、关于和页尾的主轴；照片灯箱根据 1440px、960px 与 480px 画板分别扩展。所有页面在 768px 以下使用 1rem（16px）移动端 gutter，并在视口内水平居中。

页面顶部不提供文字导航。唯一的 280×56px 图标胶囊以 40 层级固定在视口底部并水平居中，距视口底部恒定 24px。它在 DOM 中位于 skip link 之后、主内容之前，随后才是页脚，但固定定位使其不占据文档流。

正文仍依次自然向下展开，所有页面首段统一在顶部留 5rem（80px），主要章节之间使用 5rem 的呼吸距离。块末端滚动留白覆盖“56px dock + 24px 底部间隔 + 32px 呼吸距离”，页脚标记距页面底部保持 80px。

首页按照 Figma V0.3.2 依次呈现作者标记、三段介绍、最近写作、精选项目、摄影和联系方式，不在介绍后额外增加按钮。`/resume` 使用同一 37rem（592px）内容栏，依次编排介绍、联系入口、工作时间线、项目、三组技能和教育信息。

项目在可用宽度内采用两列，39.999rem 以下切为单列；摄影首页预览为三列，移动端仍保留三幅并缩短高度。完整摄影网格在 688px 以下切为使用全站 16px 移动端 gutter 的两列，沿用高、矮两种固定卡片比例并均衡分列。关于页的文字和相片在桌面并置、窄屏回到单列。文章与项目详情在 688px 以下使用方形封面和两列元数据；照片详情始终作为摄影页上的顶层灯箱出现。正文不因窄屏整体缩小。

当前 shipped 基线已完成桌面与 390px 手机终检，所有关键交互的 44px 最小目标均通过。

**The One Reading Axis Rule.** 默认页面只围绕 592px 中央阅读轴组织；宽栏必须由灯箱媒体的真实需要来证明。

**The Persistent Dock Rule.** 全站只有一个固定在屏幕底部的图标 dock；不得再增加顶部文字导航或把 dock 放回页面末尾。安全区、内容净空与滚动留白是这个固定控件不可分割的一部分。

## Elevation & Depth

系统以扁平和色调分层为默认。页面结构依靠画布、留白、低对比边线和图像自身建立，不给每段内容套卡片。阴影只用于确实抬升的表面：项目预览内部、胶囊导航与真正浮层。

### Shadow Vocabulary

- **Hairline：**单像素般的低对比轮廓，用于浅纸表面需要从画布中被识别时。
- **Card：**紧凑的双层暗影，只用于项目预览或明确独立的控件表面。
- **Float：**更深、更远的暗影，用于固定底部 dock 和真正浮层。

**The Flat-by-Default Rule.** 普通内容行、页面区块和摄影图像保持平面；只有操作层级或真实抬升关系可以使用阴影。

**The Top-Layer Rule.** 固定 dock 使用常规堆叠上下文中的 40 层级；原生 `dialog` 进入浏览器 top layer 后必须覆盖 dock，不通过继续抬高 dock 的 `z-index` 与模态层竞争。

## Shapes

形状语言由轻微裁切和明确操作轮廓组成。内容图像多用 0.25–0.5rem 的小圆角，常规容器最多使用 0.75rem；1rem 以上只属于大媒体裁切。导航、按钮和圆形控制使用完整胶囊，以区分“操作”与“内容”。

**The Content Before Container Rule.** 文章和项目索引优先使用开放内容行；只有媒体裁切、复杂操作或明确独立表面需要卡片容器。

## Components

### Buttons

- **Shape:** 44px 最小高度的完整胶囊，左右内边距 1rem。
- **Primary:** 暖黑表面配浅纸文字，用于明确主动作，并使用紧凑卡片阴影。
- **Secondary:** 浅纸胶囊表面、静默边线与暖黑文字，适合低声量动作。
- **Ghost:** 透明背景，保留同样的目标尺寸和点击反馈。
- **Hover / Focus:** 背景与位移使用快速平滑过渡；按下缩放至 0.97；键盘焦点始终显示 2px 主色轮廓和 3px offset。

### Cards / Containers

- **Project Card:** 两列媒体卡，视觉区展示真实项目图像；纸灰预览框只负责托住内容，不用抽象占位插画取代真实资料。
- **Content Row:** 文章和归档的默认表达；标题、可选摘要、点状 leader 与右侧日期形成一条开放的出版行，hover 只让正文向右移动 4px。
- **Photo Tile:** 图片本身就是表面，竖图使用高卡片、横图使用矮卡片并裁切填充；灯箱展示完整照片。不加厚边或卡片阴影。支持悬停的设备上，图片以 500ms 平滑放大至 1.02 倍并按稳定分布向左或向右旋转 1°；四个 9.6px 角标以 250ms 从外侧边缘滑入 8px 内缩位置并停在 60% 透明度。键盘焦点提供同等状态，reduced-motion 下保留角标显隐但取消空间位移、缩放与旋转。

### Inputs / Fields

- **Style:** 44px 最小高度，浅纸表面、静默边线、0.5rem 圆角和 0.7rem × 1rem 内边距。
- **Focus:** 使用全站青绿色焦点轮廓，不以移除 outline 换取视觉干净。

### Navigation

- **Fixed Dock:** 全站唯一导航是固定在屏幕底部、水平居中的 344×56px 浅纸图标胶囊；五个链接与偏好按钮均为 44×44px 圆形目标。
- **Placement:** dock 距视口底部恒定 24px，层级为 40；块末端滚动留白同步覆盖 dock 高度、间隔与呼吸距离。
- **Assets:** 必须直接使用 `public/assets/figma/nav-home.svg`、`nav-writing.svg`、`nav-projects.svg`、`nav-photos.svg` 与 `nav-about.svg` 的作者版本，不替换为图标库近似品。
- **State:** 默认图标保持低亮；hover、focus 与当前页恢复完整亮度。悬停底板为 44px 半透明圆，tooltip 使用浅纸表面、低对比纸灰描边、4px 圆角和柔和暖灰阴影；当前页以 3px 底部圆点标识。偏好按钮悬停显示“偏好”，点击后在上方打开设置面板；语言与音效为清晰标示的禁用项，外观可选择亮色、跟随系统或深色。
- **Modal Relationship:** 原生照片 `dialog` 依靠浏览器 top layer 覆盖 dock；dock 不进入 top layer，也不提高到模态层之上。
- **Motion:** hover 不改变图标位置，只切换底板与 tooltip；所有状态尊重 reduced-motion。

### Online Resume

`/resume` 是 592px 内容栏内的结构化在线履历，而不是下载页或宣传落地页。它从 `resume` content 读取并按介绍、联系胶囊、工作时间线、项目经验、三组技能和教育经历的顺序呈现；工作时间线按日期、公司名、职位纵向阅读，职位位于公司名下方并保持 8px 间距；技能卡片与教育经历使用浅纸胶囊同级的纸灰表面，并叠加低对比细密网点，建立履历末段的共同材质；桌面时间线和技能可以分栏，390px 等手机宽度自然收为单列，联系入口保持 44px 最小高度。

### Domain Detail Pages

文章详情按 Figma 节点 `11516:4282` 排版：592px 主栏、592×328px 封面和 12px 圆角，封面后留 32px。标题使用寒蝉宋体 48px / 56px，副标题 16px / 28px；标题、副标题和元数据之间各留 16px，元数据底部留 20px 并使用浅色边线。日期和阅读时长数字使用 Geist Mono。正文在元数据后留 32px，采用 14px / 26px；连续段落间距 8px，小标题采用寒蝉宋体 20px / 28px，之前留 24px、之后留 8px。页脚在正文后留 80px，左侧为真实版权署名、右侧为 Figma 的 64×48px 签名。移动端标题改为 32px / 40px，内容两侧留 16px，封面保持横向比例；返回入口放在顶部留白中，目录和图片放大功能保留。

项目详情保持既有封面、32px / 44px 标题和四列元数据结构，顶部同步为 80px；688px 以下封面切为方形、元数据为两列，内容和页脚使用 16px 移动端 gutter。

### Static Photo Detail

照片详情使用原生 `dialog` 覆盖在原摄影页上，背景以 90% 暖黑墨色和 40px 模糊保留原页面语境。从摄影网格点击进入时，照片以单一共享元素图层从当前可见边界同步移动并放大，图层外框通过位置与真实宽高插值，由网格裁切比例连续变为照片完整比例，内部照片始终保持正确比例，不使用不同的横纵缩放；约 560ms 到达灯箱目标框。不继承缩略图的悬停缩放与旋转，也不使用双图层交叉淡化，避免额外缩小和闪屏。背景与模糊在 400ms 内渐入，底部参数从 260ms 起以 24ms 间隔依次出现，整体约 584ms 完成；直接访问照片地址时使用同节奏的居中放大替代，减少动态偏好下直接显示最终状态。1440px、960px、480px 画板分别使用 1280×778px、880×536px、432×268px 影像外框；下方公开元数据在窄屏自然换行。点击灯箱任意区域或按 `Esc` 关闭时，同一个照片图层会在约 400ms 内沿相同的宽高与位置路径直接缩回对应缩略图，不增加到达后的二次缩放，参数与背景同步退场，完成后再恢复原页面地址与位置；top-layer 灯箱完整覆盖固定导航。

### Leo Mark

手写 Leo 标记出现在首页开篇和页脚收束处，是全站唯一允许明显手写质感的身份元素。它保持原始比例和 4rem × 3rem 的呈现尺寸，不加底板或额外装饰。首页使用 `SignatureMark`，沿已确认笔顺以 1.5 秒自然节奏书写一次，进入首页与刷新时重播；边缘保留固定的轻微 Melt 纹理，减少动态效果时直接显示完整签名。颜色使用保留原资产色值的 `--color-signature`，尺寸继续由 `.hero__signature` 决定。页脚保持原静态签名。

### Particle Portrait

关于页头像固定为 248×280px，是该页唯一的焦点动效。静态像素肖像始终作为无 JavaScript、加载失败和减少动态偏好下的基础内容；增强路径用约 4px 间距的圆点采样图像，在进入视口时于 780ms 内从局部散开状态聚合为完整头像。精细指针只在头像范围内产生最大约 14px 的低幅弹性推挤，离开后带阻尼回位；触控设备不提供持续跟手替代。Canvas 离开视口或页面进入后台后停止绘制，不循环播放，也不延迟关于页正文出现。

## Do's and Don'ts

### Do:

- **Do** 让真实文章、项目图像和摄影承担视觉内容，不用占位装饰填满页面；照片完整比例在灯箱中呈现。
- **Do** 保持 592px 中央内容栏、16px 移动端 gutter 和正文自然文档流。
- **Do** 只保留固定在屏幕底部的 280×56px 图标 dock，并同步维护 safe area、内容净空和滚动留白；五个真实链接均满足 44×44px 最小目标。
- **Do** 使用低声量 14px 中文排版，通过留白、色阶与中等字重建立层级。
- **Do** 用 #9e9792 承载关键次级文字，只把 #8c8c8c 留给可舍弃元数据。
- **Do** 保留手写 Leo 标记和五枚 Figma 原作导航 SVG 的作者性。
- **Do** 保证交互目标至少 44×44px、`:focus-visible` 清晰可见，并尊重 `prefers-reduced-motion`。
- **Do** 让移动端项目与履历回到单列、内容自然堆叠，确保页脚和滚动目标不被 dock 遮挡，并让 top-layer `dialog` 覆盖 dock；终检同时覆盖桌面与 390px 手机。

### Don't:

- **Don't** 使用纯白页面、厚重纸张卡片或大面积高对比色块破坏暖纸的安静层级。
- **Don't** 增加顶部文字导航、吸顶栏或第二套导航；固定底部 dock 是唯一站点导航。
- **Don't** 把 dock 放回页面末尾，或省略底部安全区、内容净空与滚动留白。
- **Don't** 用高于模态层的 `z-index` 强行显示 dock；原生 top-layer `dialog` 必须完整覆盖它。
- **Don't** 用巨型英雄字、全屏口号、过度装饰或客户端动效延迟真实内容出现。
- **Don't** 用通用图标库、emoji 或临摹近似图替换 Figma 导航资产和 Leo 标记。
- **Don't** 把每一组内容包成圆角卡片，或用阴影代替留白和结构。
- **Don't** 在灯箱中按网格卡片比例裁切照片，或在移动端整体缩小正文来换取空间。
- **Don't** 把照片详情实现为脱离摄影页语境的独立详情版式。
