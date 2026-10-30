---
version: 1
slug: "src-components-contactlinks-astro"
primary_target: "src/components/ContactLinks.astro"
related_targets: ["src/components/TooltipGroup.astro","src/pages/design-system.astro"]
---

# Contact previews

Mode: Read. Existing about-page contact links gain account context on hover and keyboard focus, without changing page composition. Use resume/main as the factual source and each linked account’s actual public avatar, stored locally. Keep email copying and mailto fallback.

## Direction contract

THESIS: Contact previews identify the destination before a visitor follows it.

OWN-WORLD: Inherit TooltipGroup surface, line, shadow, ten-pixel corner token and 150ms fade/scale. Theme tokens supply all colors; spacing uses the existing four-pixel scale.

STORY: Platform first, Leo's identity and account second, accurate action text last. Email substitutes recipient and postage for the avatar. Email hover/focus preserves its original label and reveals a trailing copy icon; successful copy still shows “已复制” briefly.

FIRST VIEWPORT: A 288px top-layer card floats above the contact link, clamped to a 16px viewport gutter; use the existing below-trigger fallback when space above is insufficient. Desktop and 390/320px widths preserve readable content.

FORM: Local extension based on user references 1–4. seed: none (unavailable). Reuse TooltipGroup with template content; no new visual world or animation library.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

## Verification and asset provenance

Account avatars: `public/assets/contact-avatars/{x,instagram,github}.jpg`, downloaded from the linked official account pages’ public `og:image` metadata on 2026-10-30. Source URLs and provenance are recorded in `src/data/contact-avatars.json`; no visual edits or generated replacements. Platform icons reuse `public/assets/figma/footer/`.

Visual review: ship for four dark cards, light theme and 390px mobile. Browser checks passed for account content, avatar loading, email clipboard copying, hover persistence, keyboard switching, Escape, outside click, 390/320px bounds, reduced motion, touch dismissal, original tool tooltip, main routes and mobile dock. Latest `npm run build` passed. DESIGN.md and its sidecar remain unchanged because this is an ordinary extension of their token and tooltip rules.
