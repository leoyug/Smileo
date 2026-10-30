---
version: 1
slug: "src-scripts-site-title-ts"
primary_target: "src/scripts/site-title.ts"
related_targets: ["src/pages/en/[...path].astro","src/i18n/render.ts","src/components/SiteHeader.astro"]
---

# Bilingual publishing

Mode: Read. The user confirmed full English coverage, including articles and project cases. Preserve Chinese originals and stable addresses; expose equivalent static English pages under /en/.

## Direction contract

THESIS: A visitor can read the same publication in either language and remain on the equivalent page.

OWN-WORLD: Existing surfaces, tokens, fonts and components remain authoritative. English uses the existing sans text voice and readable line lengths. No new decorative UI or translated artwork.

STORY: Select 中文 or English from the existing preferences panel; content, navigation, accessibility labels, metadata, feeds and photo controls agree with that language. Remember the choice and preserve query/hash and page position.

FIRST VIEWPORT: Keep incumbent layout at desktop and 390px. Long English titles wrap without horizontal overflow; English labels fit the existing dock and preferences surface.

FORM: Ordinary extension of existing language controls; code-led, seed: none (unavailable). Build translated HTML from the shared page output with a structured catalog and separate English Markdown, preserving all IDs and interaction hooks.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
