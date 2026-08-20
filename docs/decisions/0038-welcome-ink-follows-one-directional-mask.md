# ADR 0038: Welcome ink follows one directional mask

Status: accepted

## Context

Rune's first-run greeting already used system writing faces, spectrum SVG, a visible nib, and a frozen directional motion plan. The primary word was still rendered as animated font outlines with delayed per-character fills. At large size that reads as hollow contour drawing followed by character pops, while the nib can appear only loosely related to the ink that remains.

The product goal is the quiet startup ritual and progressive handwritten feel associated with premium device setup, without copying Apple artwork, glyph paths, animation files, or remote fonts. The same mechanism must remain direction-aware, bounded across nine interface locales, accessible, and isolated from application state.

## Decision

`WelcomeExperience` remains the sole owner of the greeting sequence, locale, cycle timer, and setup transition. `greeting-motion.ts` remains React-free and returns one frozen LTR/RTL path plus write, settle, and finish timing from bounded presentation inputs.

`HandwrittenGreeting` uses that path twice: once as a broad round SVG mask that progressively reveals the filled system-font word, and once as the offset path for the visible pressure-responsive nib. A crisp final fill settles near completion and a restrained finish path begins only after the main gesture. The spectrum is a local nine-stop gradient. Arabic stays one connected RTL text run; visible non-mark symbol count controls its timing.

The greeting occupies a centered area above the copy and language decision on wide screens. Responsive layout preserves the semantic order `greeting → copy → language` on narrow screens.

Reduced motion immediately completes the mask, removes transient light and pen layers, and shows the final word. Forced colors removes decorative layers and uses `CanvasText`.

## Consequences

- Filled ink now follows the same direction and duration as the visible nib instead of relying on animated glyph outlines.
- Every script continues to use installed system writing faces; Rune ships no copied font paths or third-party startup animation.
- The component remains in the deferred welcome chunk and gains no timer, DOM measurement, Canvas, storage, provider, credential, Artifact, or write authority.
- Unit tests must prove bounded immutable LTR/RTL planning; source and browser gates must prove the mask, nib, pressure, settle, and finish animations plus nine-locale responsive containment.
