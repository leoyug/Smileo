---
title: "Wispora"
description: "A personal visual inspiration library"
projectType: "Chrome / Edge browser extension"
role: "Product design, UI design, design system and development"
tools: "Figma, Codex, Cursor"
period: "2026–present"
downloadLabel: "Download Wispora v0.8.0 for Chrome / Edge"
---
Wispora is a personal web inspiration library for design and development. I can save websites, articles and authors I want to follow, then find them again through covers, descriptions, tags and local search. Built with WXT, React and TypeScript, it stores data in the current browser without an account or a separate backend.

## Why I built it

While designing and developing, I often find things worth returning to: a beautifully typeset website, an article explaining a technical detail clearly, or an author worth following. Saving a link is easy. Later, I usually remember roughly what problem it could solve, but not its name or where I put it.

I wanted a tool that fit my way of working. Adding something should be simple and should not require a complete classification scheme first. Returning to it should let me recognize it through images and words, then narrow the field. My practical test is whether I can find something useful I previously saved within a minute of encountering a design or development need.

It is also a way to organize my taste and knowledge. Gathering scattered references makes recurring interests visible, along with the things I have saved but never actually used.

## About the application

I made Wispora a browser extension because most references turn up while browsing. Clicking its toolbar icon opens a quick-add panel on the current page; organizing and searching happen in the full workspace.

Content falls into websites, articles and followed sources, each emphasizing different information. Websites rely on covers and descriptions, articles on titles and sources, and followed sources on recognizable authors. Tags express subject, style, technology and purpose instead of cramming every dimension into an increasingly complicated taxonomy. Frequently used scopes and tag combinations can be saved as sidebar views.

The workspace offers detailed cards, compact cards, detailed lists and compact lists. Covers suit visual exploration; lists help scan larger collections. Details let me edit titles, descriptions, tags and covers, with the previous search and position preserved when I return.

Business data is stored in IndexedDB through Dexie; interface preferences and small configuration values use extension storage. Readability extracts article bodies, DOMPurify cleans them, and the result becomes a readable local snapshot. MiniSearch searches titles, descriptions, domains, tags and saved bodies without waiting for AI.

AI is an optional organizing assistant. With a personal API key configured, it can fill in descriptions and suggest tags, but links are saved first while organization continues in the background. A user's description takes priority, followed by the page's own description, with AI filling gaps last. Later automation does not overwrite manual edits. Adding, editing and searching all work without AI.

Visually, I wanted something comfortable for extended browsing: warm gray backgrounds, compact typography and a small amount of brand orange. Semantic tokens unify color, type, corners and interaction states, with shared components based on Intent UI and React Aria. Color consistency between Figma and the browser received specific attention, using Display-P3 as the authoritative definition with an sRGB fallback.

The project is currently v0.8.0. Core local flows work, with backup, restore and content briefings added. Daily summaries and weekly briefings use only saved local information and retain their contents as generated for later reading. Full Chrome and Edge release acceptance is still planned.

## Challenges

The difficult part was making addition light while keeping later processing reliable. A page's body may be inaccessible, its cover absent, or AI may time out. Putting all those steps before saving would make a routine action slow and fragile.

I separated saving from enrichment. The basic link, type and time enter the database first; other information is filled in gradually. Since an extension's background process can stop at any time, important tasks and states must be persisted rather than kept only in memory. These quiet details determine whether content survives closing the page or restarting the browser, and whether work can resume.

The quick-add panel also changed structure. An initial native browser popup clipped tag suggestions, while adjusting its height caused position jumps. I replaced it with a panel injected into the page on demand after a user click. Shadow DOM isolates its styles and lets suggestions extend beyond the panel. Keyboard interference, focus, closing and unloading also needed handling so the original page stayed usable.

Search presented another challenge. Behind one input are the workspace's applied conditions, the search panel's draft conditions and temporarily opened details. Mixing them would change the workspace when someone merely tried a search or inspected an item.

The search panel now lets people adjust type, time, tags and fields before previewing. Only View all results applies those conditions to the workspace. Canceling preserves the original context. The details need repeated refinement: whether input remains after returning, whether the list keeps its position, and which layer Escape closes first all affect continuity.

AI organization needs equally clear boundaries. Suggesting tags is easy; avoiding an expanding set of synonyms and protecting manual edits is harder. I track description sources, distinguish human and automated results, and allow retries. Otherwise automation simply creates more maintenance.

## Reflection

Wispora made me spend time asking how saved references can return to active work.

Covers help me recognize a reference, descriptions remind me why I added it, tags and search narrow the field, and body snapshots preserve what I read. These abilities need to work together for collecting to become useful accumulation.

Developing with Codex also let me test interactions and data flows beyond the design file. Many issues appear only in a working interface and real browsing: clipped suggestions, lost return positions and inconsistent colors across environments. A design system and clear product boundaries make those adjustments maintainable.

I want to make this local tool dependable first. Real browsers and sustained use still need to verify reliable saving, usable retrieval and how much organizing time AI actually saves. Those answers should guide the next features.
