# ADR 0076: Panels use one contextual material hierarchy

- Status: accepted
- Date: 2026-09-02

## Context

Orbit accumulated correct individual surfaces but still mixed three interaction models: opaque review dialogs, anchored navigation popovers, and an Agent composer fixed to the Source footer. A pixel audit showed that most content panels were already legible, while several small inconsistencies—the native settings-button border, stale loading monogram, excessive entry blur, overlapping status feedback, and reduced-motion welcome position—made the whole product feel less deliberate. Preview selection also prepared exact Agent scope without providing a nearby way to use it.

## Decision

Orbit distinguishes three layers:

1. **Content:** Source, Preview, documents, data, forms, evidence, and review bodies use opaque standard materials.
2. **Navigation and controls:** toolbars, menus, scope switches, and contextual actions may use restrained translucent material over content.
3. **Modal commitment:** imports, exports, creation, tasks, and recovery use one dimmed backdrop, one opaque task surface, and one primary confirmation.

The existing Agent composer gains two presentations without gaining a second owner. Docked mode remains inside Source. Floating mode is a fixed supplementary panel with one move handle, one dock control, one close control, and the same free-text/model/scope content. The handle supports pointer dragging, Arrow-key fine movement, and Shift+Arrow coarse movement. A compact screen always presents floating mode as a bounded bottom sheet.

Preview selections expose one contextual action only after `prepareSourceNavigation` proves the exact current source range. Activating it opens the existing Agent in Selection scope. Pure functions in `agent-dock-layout.ts` own normalization, adjacent placement, dragging, and viewport clamping. Position and placement persist only as device presentation state. Model selection, prompt content, source identity, review ownership, and Apply semantics are unchanged.

## Consequences

- AI appears where work happens without automatically covering a selected block.
- People can compare Source and Preview while moving the Agent out of the way.
- Dock, float, context entry, and global Agent entry all share one state machine and one safety gate.
- Panel materials communicate semantic depth instead of adding blur or rounded cards everywhere.
- Reduced motion and compact layouts preserve function and geometry rather than falling back to a different composition.
- The complete surface inventory and remaining evidence questions are recorded in `docs/UI-PANEL-AUDIT.md`.
