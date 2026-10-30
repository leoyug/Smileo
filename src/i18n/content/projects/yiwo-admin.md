---
title: "Yiwo Renovation Admin"
description: "Streamlining proposals, materials and data"
role: "Information architecture, interaction and visual design"
---
Yiwo Renovation Admin supports the day-to-day management of design proposals, materials and related business work at renovation companies. As features accumulated, older pages developed scattered entry points, unclear information hierarchy and inconsistent visual rules.

I worked on proposal management, material management, marketing management and analytics, owning information architecture, interaction and visual design. The improvements centered on three tasks: **act after finding a proposal, see the effect while configuring materials, and identify what matters when reviewing data.**

The screens are project design deliverables used to explain the proposed design and interactions.

![Part of the proposal workspace, with business navigation on the left and floor-plan previews and proposal information on the right](/media/projects/yiwo-admin/case-study/01-workspace.webp)

*Floor-plan previews support recognition; names and tags provide additional context.*

## Put frequent actions beside their target

When browsing proposals, users first need to recognize the project, then edit it or view its gallery. I made the floor-plan preview the main content of each card and standardized the positions of names, tags and supporting information to make successive cards easier to compare.

Once the target is found, hovering exposes Edit and Gallery, with other actions grouped under More. Frequent actions sit directly beside their target instead of requiring a menu first.

> The resting state supports recognition; the hover state reveals actions.

![A proposal card on hover, showing Edit, Gallery and More](/media/projects/yiwo-admin/case-study/02-plan-actions.webp)

*Bring editing and the gallery forward while preserving enough space for the floor plan.*

This limits the number of permanent buttons, but also makes discovery depend on hover. Further testing should examine whether first-time users can find the actions and whether repeated work causes accidental clicks.

## Give material settings a clear hierarchy and a visual reference

Material editing combines business information with specialist parameters. I separated the form by information type and organized complex settings into three areas.

- **Basic attributes:** category, brand, specification and style establish what the material is.
- **Product information:** images, prices, links and descriptions supply presentation details.
- **Advanced parameters:** UV, metallic properties and highlights control the finer visual effect.

Grouping reduces the amount shown at once, but adds switching. The material name and completion action therefore stay outside the groups, helping people keep track of what they are editing.

![Material editor with grouped forms on the left and a material preview and specification textures on the right](/media/projects/yiwo-admin/case-study/03-material-editor.webp)

*Settings and previews share one field of view, connecting parameter entry with observation.*

The preview provides a visual reference, while real-time rendering is designed to connect parameters and effects more directly. Its actual speed and accuracy need verification in a working version.

## Connect different tasks through shared rules

Browsing proposals, completing forms and checking data call for different densities. I standardized navigation and common controls while preserving the distinct roles of cards, forms, tables and charts.

- **Give content room:** quiet navigation backgrounds and clear selection states establish location; expanded and collapsed states accommodate the content area.
- **Preserve what matters in tables:** rules for long text, sorting and narrow screens keep full information accessible in compact layouts.
- **Create hierarchy in reports:** connect time, measures and charts, with overviews and detail for different depths of reading.

![Shared controls including breadcrumbs, group switching, search, and primary and secondary buttons](/media/projects/yiwo-admin/case-study/04-shared-controls.webp)

*Make consistency concrete: where I am, what to read, how to find it and what to do next.*

Brand green marks selection and primary actions; neutrals carry most content and boundaries. Shared layout, typography and control rules give the modules a stable visual foundation.

## Reflection

The design organizes scattered actions, complex settings and dense data into clearer working paths. My focus expanded from individual screens to information priorities and interaction rules across modules.

For further testing, I would prioritize finding a specified proposal and opening the editor, completing a material configuration and confirming the preview, and locating and checking a record in the leads table. Completion, time, errors and requests for help would show whether the designs actually support the work.

**A good admin interface makes information visible when people need to judge, and actions discoverable when they are ready to act.**
