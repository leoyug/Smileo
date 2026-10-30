---
order: 7
draft: false
title: 为什么颜色在 Figma 和浏览器里看起来不同，以及如何修复
subtitle: 同一个 HEX，为什么 Figma 和浏览器里的橙色不一样？
description: 要复现设计中的颜色，需要把颜色数值和它所属的空间一起交给浏览器。
publishedAt: 2026-09-16
category: 设计工程
tags: [Figma, CSS, 色彩空间]
readingMinutes: 3
featured: false
---

在 Figma 里选了一个明亮、纯净的橙色，写进代码后，却发现浏览器里的颜色更深、更暗。你重新核对 HEX，一个字符都没变。颜色怎么还是对不上？

我在做 WEBLOOM 时就遇到了这个问题。设计稿中的品牌橙很好看，到了浏览器里，总觉得少了点鲜艳感。

这时，有一个信息值得先检查：色彩空间。

## 到底发生了什么？

Figma 的设计文件可以使用 sRGB，也可以使用 Display-P3。浏览器里的 CSS HEX，比如 `#FF760E`，则明确按 sRGB 解释。[Figma 颜色配置说明](https://help.figma.com/hc/en-us/articles/360039825114-Manage-color-profiles-in-design-files)、[CSS HEX 规范](https://www.w3.org/TR/css-color-4/#hex-notation)

如果设计文件使用 P3，直接复制 HEX 到 CSS，就可能让同样的数字变成另一种颜色。

P3 能表示一些超出 sRGB 范围的鲜艳颜色。在我的例子里，这种差异表现为橙色看起来更深、更暗。具体变化取决于颜色和显示环境，不能简单概括为“P3 总是更亮”。

要复现设计中的颜色，需要把颜色数值和它所属的空间一起交给浏览器。

## 怎么修复？在 CSS 中明确颜色空间

先检查 Figma 文件的颜色配置。这个项目使用 Display-P3，所以我们把品牌橙的 P3 定义写进共享颜色变量：

```css
:root {
  --color-brand: #FF760E;
}

@supports (color: color(display-p3 1 1 1)) {
  :root {
    --color-brand: color(display-p3 1 0.4627 0.0549);
  }
}
```

按钮、标签等组件引用 `var(--color-brand)` 即可。品牌 SVG 也保留 P3 声明，让页面和资源使用一致的定义。

这里的 P3 分量来自项目的设计定义；`#FF760E` 是选定的 sRGB 回退，两者不应视为精确等价的颜色。任意 sRGB HEX 的通道除以 255，再套进 `display-p3`，也不能完成保留外观的转换。

改完后，浏览器里的橙色与 Figma 几乎一样了。我又用保持默认设置的 Snipaste 分别取色，得到相同的 `#FF760E`。

![浏览器修复后的 Snipaste 取色记录，面板显示 #ff760e；截图由另一款工具保存](/media/articles/figma-browser-color-space/snipaste-browser.png)

这次修复在我的设备上达到了预期。复核时仍要保持同一取色工具、设置和显示环境：Snipaste 的 macOS 版允许设置取色色彩空间；浏览器能解析 P3，也不等于屏幕能够完整显示它。[Snipaste 更新记录](https://www.snipaste.com/download.html)、[MDN 色域检测说明](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/At-rules/@media/color-gamut)

如果你的设计文件使用 sRGB，代码也可以继续使用 sRGB。下次颜色对不上时，先核对文件的颜色配置，再检查浏览器最终生效的声明。交付颜色时，把色彩空间一起写下来，会省下不少来回调整的时间。
