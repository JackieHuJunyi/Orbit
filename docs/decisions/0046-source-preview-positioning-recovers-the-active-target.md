# ADR 0046: Source–Preview positioning recovers the active target

## Status

Accepted for Rune v1.30.

## Context

Rune already derived exact `PreviewSourceTarget` ranges from canonical Markdown, CSV/JSON, Chart JSON, Deck Markdown, and proven semantic HTML. Preview clicks used one revision-bound plan to focus and center Source, while Source caret movement selected and centered the matching rendered target.

The Source-driven DOM effect still lived directly inside the large Workbench, and its dependencies ended at target id and kind. Once a target was active, a user could manually scroll Preview away and continue moving the Source caret within that same block, cell, or slide without triggering another positioning effect. Pure target tests and source-code assertions did not prove the complete browser behavior across the three primary Office families.

## Decision

`use-source-preview-scroll.ts` owns the single Source-to-Preview DOM effect. It receives the current artifact id, exact cursor offsets, one compiler/parser-derived target, an enabled presentation state, and the mounted Preview scroll ref. It queries only existing `data-preview-source-id` / `data-preview-section-id` attributes and delegates duplicate-node selection to the React-free `selectPreviewNavigationCandidate` helper. It never reads rendered text or iframe contents and cannot derive identity.

The first transition into a distinct artifact/target calls `scrollIntoView` with `block: "center"`. Later caret moves within that exact target call it with `block: "nearest"`. If the target is already visible, the browser does not move it; if the user manually displaced Preview, the next caret movement restores the closest edge without a second selection state or continuous pixel-ratio synchronization. Reduced motion switches smooth behavior to immediate behavior.

Preview-to-Source remains unchanged: `prepareSourceNavigation` validates artifact identity, revision, and UTF-16 range; the Workbench alone changes view/focus/selection, calculates the textarea scroll position, synchronizes the gutter, and activates Selection Agent scope. Neither direction writes an Artifact.

Real Chromium gates begin from reviewed imports and prove:

- a long Markdown section selects and centers its exact Source range, then Source movement restores the matching heading after manual Preview displacement;
- a long CSV cell selects its exact lexical token and supports the same reverse/recovery behavior; and
- a proven semantic HTML page keeps its existing page isolation, exact Preview-to-Source selection, Source-to-Preview positioning, and same-target recovery.

## Consequences

- The explicit Overleaf-like positioning requirement now has browser evidence across Documents, Data, and Presentations rather than only a presentation flow and pure helper tests.
- Adding another proven Preview renderer reuses one mounted effect and target attribute contract instead of adding Workbench scroll code.
- Cursor movement does not grant DOM, mutation, persistence, provider, credential, or Agent authority.
- Rune still does not infer identity from arbitrary rendered text, synchronize by scroll percentage, or expose unproven iframe/Query pixels as writable source.
