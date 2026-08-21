# ADR 0058: Export capabilities own menu presentation

## Status

Accepted for Rune v1.42.

## Context

Rune v1.38 established one frozen export capability registry and one lazy destination runtime. v1.39 added canonical readable source to the same reviewed handoff. The top-bar menu nevertheless repeated the format matrix with Artifact-kind checks and separate branches for CSV, JSON, Office, legacy Office, OpenDocument, HTML, and PDF. A new destination could therefore compile correctly while remaining absent, mislabeled, or incorrectly gated in the visible UI.

The popover declared ARIA menu roles but opening it left focus on the trigger. Arrow keys, Home, and End did not navigate items, and the shared Escape listener closed the popover without deliberately returning focus. This was an incomplete keyboard contract, especially when changing Artifact kind changed the item count.

## Decision

1. Each `WorkspaceFileExportCapability` carries frozen presentation metadata beside its destination and target: icon family, localized detail treatment, and a `desktopOnly` flag.
2. `WorkbenchExportMenu` is a controlled component. It receives the exact ordered capability list, current open/busy state, desktop compatibility availability, localized copy, and callbacks. It does not inspect Artifact kind or contain destination-specific visibility branches.
3. The component may filter a capability only when its own `desktopOnly` metadata is true and the isolated desktop bridge is unavailable. Every remaining item is rendered by one map.
4. Click and Arrow Down open at the first item; Arrow Up opens at the last. A layout effect transfers focus before paint. Arrow Up/Down wrap, Home/End jump, Tab closes without trapping focus, and Escape closes and restores the trigger.
5. The item-ref list is truncated to the current capability count before focus is resolved. Switching from Data's six web choices to Document's four cannot retain detached menu controls.
6. The component can request one destination only. Export preparation, evidence collection, local-asset reads, stale-workspace review, confirmation, object URL creation, and download remain owned by the Workbench and lazy export runtime.

## Consequences

- Adding a destination requires one capability contract instead of synchronized registry and Workbench render branches.
- Presentation metadata stays eager and React-free; converters and evidence ports remain behind the existing dynamic runtime boundary.
- Keyboard users receive deterministic focus without turning the popover into a modal or trapping Tab.
- The Workbench drops from 6,102 to 5,957 lines. The extracted menu is 170 lines and introduces no state or write authority.
- The minified eager Workbench is 525,719 bytes under the unchanged 530 KB limit.
- Unit tests protect frozen metadata and generic rendering; server-render tests protect the semantic HTML handoff; Chromium proves Document four-item, Data six-item, and contracted Document four-item focus behavior plus existing reviewed downloads.
