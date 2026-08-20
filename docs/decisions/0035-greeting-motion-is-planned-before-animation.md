# ADR 0035: Greeting motion is planned before animation

- Status: accepted
- Date: 2026-08-21
- Scope: Welcome typography, motion timing, and RTL shaping

## Context

The first spectrum-ink writer drew each glyph outline and settled its fill, but its visible pen appeared only on the final flourish. The main word therefore still read as an outline effect rather than one directional gesture. Arabic correctly remained a single connected SVG text run, yet the same one-unit count also shortened its writing, settle, and finish schedule as if the complete word were one glyph.

Adding another component timer or measuring system-font geometry through Canvas would create a second motion authority and make hydration, locale cycling, and reduced-motion behavior harder to reason about. Splitting Arabic into letters would break shaping.

## Decision

`planGreetingMotion` is a React-free pure boundary. It accepts a canvas width, writing direction, shaping-unit count, and the displayed string, then returns a frozen bounded path, visible motion count, unit duration, ink-settle delay, and finish delay. Non-finite geometry or counts normalize to safe presentation values.

LTR timing follows the existing grapheme staggering. RTL keeps its one complete SVG text run but counts visible non-whitespace, non-combining symbols for duration only; its motion path starts at the right and ends at the left. The planner has no DOM, Canvas, localization, timer, storage, network, provider, credential, Artifact, or mutation dependency.

`HandwrittenGreeting` projects the plan into CSS custom properties. A luminous write head moves once across the word, its nib passes through six bounded pressure phases, and the spectrum edge/glow changes stroke width during the same sequence. Ink settles behind the active writing and the flourish starts only near the planned finish. The existing locale-cycle timer remains the only scheduler.

Reduced motion and forced colors remove the write head, traces, and flourish and immediately show complete system-color text. Unit tests cover LTR, RTL, immutable output, and non-finite input. Browser tests inspect mounted animation names and prove the Arabic path moves from right to left without splitting the shaping run.

## Consequences

- The visible pen now explains where the colorful trace comes from instead of appearing only after the word is complete.
- Arabic receives a word-length-aware schedule while native font shaping remains intact.
- The path is a restrained directional gesture rather than exact font centerline geometry; Rune still uses system script faces and does not copy Apple glyph paths or assets.
- The entire system remains in the deferred welcome chunk, leaving the initial Workbench at 489,283 bytes.
