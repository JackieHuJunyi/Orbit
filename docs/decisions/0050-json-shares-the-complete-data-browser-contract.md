# ADR 0050: JSON shares the complete Data browser contract

## Status

Accepted for Rune v1.34.

## Context

Rune's Data adapter, target compiler, and visual cell compiler supported both CSV and flat JSON. Pure tests covered JSON lexical ranges, duplicate-key refusal, primitive types, nested-value read-only behavior, and exact scalar replacement. The real-browser proof for two-way positioning and right-side editing still exercised CSV only. That left the `Excel → CSV / JSON` product promise vulnerable to UI, focus, scroll, type-control, draft-mirroring, or persistence regressions that pure compilers could not detect.

## Decision

JSON receives two independent reviewed-import Chromium flows.

The positioning flow imports an 80-row typed array. Preview activation must select the exact quoted JSON token in canonical Source; a Source caret must activate and reveal the smallest current cell; moving the same caret after Preview is manually displaced must recover that existing target with nearest-edge scrolling.

The live-editing flow imports string, number, boolean, and null values. Direct canonical Source changes must immediately recompile the Data grid. Preview edits must expose and preserve an explicit JSON scalar type, publish one complete candidate source through the shared visual-draft bridge, keep Source read-only during the draft, restore exact prior bytes on Cancel, and persist the exact reviewed typed source only on Save. Reload is part of the proof.

Markdown, CSV, JSON, and semantic HTML E2E fixtures reuse one typed `e2e/helpers/workbench.ts` driver for hydration readiness, reviewed text import, workspace-file selection, and caret movement. The helper does not seed Artifacts, bypass review, mutate product state, or own assertions.

## Consequences

- CSV and JSON are independently protected at the browser interaction layer.
- Quoted JSON strings cannot silently regress to interior-only or display-text selection.
- Numeric and boolean edits cannot silently become JSON strings between Preview, Source, persistence, and reload.
- Shared E2E setup reduces false differences among artifact-family tests without adding a production abstraction.
- Nested values, duplicate keys, missing properties, and derived Query/Chart projections remain read-only unless their existing exact-source contracts prove otherwise.
