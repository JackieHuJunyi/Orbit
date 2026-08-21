# ADR 0056: Startup color follows one centered writing act

## Status

Accepted for Rune v1.40.

## Context

Rune's first-run word already had script-aware masks, colored ink, pressure timing, and accessibility fallbacks. Successive visual additions had nevertheless accumulated duplicate glow trails, ribbons, bristles, bleed, wake, and terminal-drop layers. The code could prove that handwriting animation existed, but the combined result felt ornamental and visually busy. The eventual copy and language grid also continued to influence the writing-phase layout, so the opening word was only optically offset toward center rather than owning the exact device canvas.

The product intent is a short device-startup welcome: a person first sees one handwritten multilingual mark, then understands that the mark belongs to the setup interface. Color should make the stroke feel alive, not turn the background into an ambient AI gradient.

## Decision

`WelcomeExperience` retains the only `writing | ready` state. During `writing`, CSS collapses the chrome row, removes copy and language controls from layout, and gives the greeting a full-canvas centered grid. A low-opacity six-color wash runs once behind it. At settle, the stable setup grid returns and the same greeting follows one finite dock animation while chrome, copy, and controls reveal.

`HandwrittenGreeting` keeps the immutable script-specific mask plan and current-system-font shaping. Its active rendering stack is limited to:

1. one mask-revealed glyph fill;
2. one glyph-shaped soft spectrum bloom;
3. one narrow trace and small pressure-lit head on the exact mask path and clock;
4. one complete settled fill and bounded clipped sheen.

There are no duplicate glow trails, ribbon segments, bristles, bleed, wake, drop, particles, Canvas loop, remote font, or copied Apple artwork, glyph paths, or animation assets. The color stops are Rune-owned presentation constants. Arabic stays one connected RTL text run; Simplified Chinese, Traditional Chinese, Japanese, and Korean retain ordered brush plans; Latin and Cyrillic retain a connected body gesture.

Reduced motion skips the boot layout and displays the normal setup grid with a complete static word. Forced colors hides the background wash, bloom, trace, head, and sheen and uses `CanvasText`.

## Consequences

- The first act has one visual subject and exact center geometry.
- The transition explains where the greeting belongs instead of replacing it with unrelated UI.
- Removing decorative SVG nodes reduces startup DOM and lowers the minified eager Workbench while retaining the existing 530 KB budget.
- New writing systems still extend only the pure motion planner and font fallback contract; they do not need a second animation state machine.
- Browser release gates must inspect mounted write/bloom/settle/head animations, exact opening-center geometry, ready-state unfold, RTL direction, all nine desktop/compact layouts, reduced motion, and forced-color structure.
