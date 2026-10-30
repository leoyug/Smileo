---
title: "Zhaichangxiang App"
description: "An all-in-one platform for renovation companies"
projectType: "Phone / Tablet / Web"
role: "UI design, design system"
---
Zhaichangxiang supports small and medium-sized home renovation companies with design proposals, visual presentations and client communication. I joined in September 2021, collaborating with two other designers through ongoing iterations.

**My responsibilities** — I independently owned the creation flow, renovation editor, cross-platform adaptation and design system, contributed to the home screen, and followed development through release acceptance.

The screens in this case study are design deliverables used to explain decisions and interactions.

## Starting point: make operations support conversation

During a sales conversation, staff need to find a floor plan, try renovation options and generate renderings to discuss with clients. Unclear creation options, indistinguishable proposals and cumbersome rendering steps can all interrupt that conversation.

My focus was to help people know where to start, what to compare and what happens next at every step.

> Support the immediate task first, then reveal complex operations as needed.

## Make creation an explicit starting point

For the home screen, we considered a top shortcut area and a floating creation button at the bottom. I proposed exposing the main creation options directly: a floor plan must exist before renovation and rendering can continue.

The final design emphasizes floor-plan search and places import and freehand drawing alongside it. Short explanations help people choose based on the materials they have. Giving these entry points more space above the fold was a trade-off in favor of the core task.

![The old plus menu compared with the new home screen, which directly exposes search, import and freehand drawing](/media/projects/Zhaichangxiang-App/case-study/03-create-entry.webp)

*From opening a menu to find a function, to recognizing creation options directly on the home screen.*

## Make differences between proposals visible

Some users reported that several proposals looked alike and were hard to choose between. I focused comparison on specific changes: retain the complete floor plan as a reference and mark differences in furniture placement and layout with green dashed lines.

Style selection offers large previews, while local proposals include reasons for the recommendation, letting images and explanations support the decision together.

![Two layouts retain a complete floor-plan reference, with green dashed lines marking local differences](/media/projects/Zhaichangxiang-App/case-study/07-layout-difference.webp)

*Guide comparison toward the areas that changed, reducing repeated searches across the entire image.*

## Separate basic rendering from detailed settings

To reduce rendering steps and make the entry point easier to find, I brought room selection and image quality into a bottom sheet while keeping the canvas visible. Camera-position adjustments sit one level deeper and open only when needed.

1. **Set up**

   Choose the rooms and image quality.
2. **Submit**

   Show task status and estimated time.
3. **Finish**

   Open the rendering and continue the conversation.

*Camera-position adjustment is an optional branch rather than a mandatory step for every rendering.*

![Rendering settings, optional camera-position adjustment and completion feedback](/media/projects/Zhaichangxiang-App/case-study/08-render-flow.webp)

*Basic operations stay together while detailed control remains available. The middle step is optional; the three screens illustrate functional states.*

## Explain why the redesign is worth implementing

The editor's bottom toolbar was the hardest change to move forward. The old design showed first- and second-level functions together, and restructuring it required changes to both organization and development effort. In requirements discussions, I explained the need through visual hierarchy and functional grouping, then followed development and release acceptance.

![Hierarchy and grouping in the old floating controls compared with the new fixed bottom toolbar](/media/projects/Zhaichangxiang-App/case-study/12-editor-toolbar.webp)

*Ground the rationale in specific interface choices: which functions are peers, how they are grouped and how primary actions appear.*

Cross-platform adaptation followed the same task-oriented approach. The design system supplied shared visual and component rules across devices.

- **Phone**

  Fast creation and selection, focused on the main entry points.
- **Tablet**

  Face-to-face presentations and adjustments using landscape split views.
- **Web**

  Detailed design and parameter editing in a denser workspace.

## Outcomes and value

Following the broader product and operational changes, core measures such as customer conversion and seven-day retention met the expectations set before the redesign.

Architectural improvements and usability changes strengthened engagement. A simpler workflow supported decisions, reduced drop-off and increased rendering activity. Multi-device support and intelligent features helped improve customer conversion.

Customer-service follow-ups and on-site product conversations indicated that satisfaction rose by 60% and the number of active users by 23% after the overall redesign.

![Five redesign measures: seven-day retention up 15%, active users up 23%, operation paths shortened by 37%, customer conversion up 18% and rendering activity up 22%](/media/projects/Zhaichangxiang-App/case-study/13-outcomes.webp)

*Design proposals supported business goals across retention, activity, task paths, conversion and rendering.*

## Delivery and next steps

Cross-device handoff, cloud saving, prompts and recommendations, AI explanations and quotations have launched. I continued to own core flows and cross-platform design and followed their implementation.

The recommendation module remains a regret: the release schedule left too little room for refinement after delivery. Next, I would check when recommendations appear, whether their reasons are clear and how people continue comparing, so they better support the conversation happening at that moment.
