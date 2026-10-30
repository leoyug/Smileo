---
title: "Fixing color differences between Figma and the browser"
description: "To reproduce a design color, give the browser both its values and its color space."
subtitle: "The same HEX, a different orange in Figma and the browser?"
category: "Design engineering"
---
You choose a bright, clean orange in Figma, put it into code and find the browser version darker and duller. You check the HEX again. Not a character has changed. Why does the color still not match?

I ran into this while working on WEBLOOM. The brand orange looked good in the design file, but seemed less vivid in the browser.

One thing is worth checking first: the color space.

## What happened?

A Figma design file can use sRGB or Display-P3. A CSS HEX value such as `#FF760E`, however, is explicitly interpreted as sRGB. [Figma's color profile documentation](https://help.figma.com/hc/en-us/articles/360039825114-Manage-color-profiles-in-design-files), [CSS HEX specification](https://www.w3.org/TR/css-color-4/#hex-notation)

If the file uses P3, copying its HEX directly into CSS can turn the same numbers into a different color.

P3 can represent vivid colors outside the sRGB gamut. In my example, the orange looked darker and duller. The specific difference depends on the color and display environment; it cannot be reduced to P3 always being brighter.

To reproduce a design color, give the browser both its values and its color space.

## The fix: declare the color space in CSS

First check the Figma file's color profile. This project uses Display-P3, so we placed the P3 definition of brand orange in the shared color variable:

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

Buttons, tags and other components can reference `var(--color-brand)`. Brand SVGs retain the P3 declaration too, keeping page and asset definitions consistent.

The P3 components here come from the project's design definition. `#FF760E` is the chosen sRGB fallback, not an exactly equivalent color. Dividing an arbitrary sRGB HEX's channels by 255 and placing them into `display-p3` does not perform an appearance-preserving conversion.

Afterward, the browser orange looked almost identical to Figma. Sampling both with Snipaste at its default settings returned the same `#FF760E`.

![Snipaste's browser color sample after the fix, with the panel showing #ff760e; the screenshot was saved using a different tool](/media/articles/figma-browser-color-space/snipaste-browser.png)

This met expectations on my device. Verification still needs the same sampling tool, settings and display environment: Snipaste on macOS allows choosing a sampling color space, and a browser's ability to parse P3 does not mean the screen can display its full range. [Snipaste release notes](https://www.snipaste.com/download.html), [MDN color-gamut documentation](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/At-rules/@media/color-gamut)

If your design file uses sRGB, the code can keep using sRGB. Next time colors disagree, check the file's profile before inspecting the browser's final declaration. Including the color space when handing off colors can save a good deal of adjustment.
