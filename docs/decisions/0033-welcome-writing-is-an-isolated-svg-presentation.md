# ADR 0033: Welcome writing is an isolated SVG presentation

- Status: accepted
- Date: 2026-08-21
- Scope: Onboarding motion and multilingual typography

## Context

Rune's feathered per-character mask removed the harsh rectangular reveal, but it still made each glyph look uncovered as a block. Adding more glow or gradient could not create the quiet pen sequence expected from a device-opening greeting. A handcrafted path asset for every language would copy and freeze typography, while Canvas would add an imperative runtime and a second measurement state.

The greeting must continue to support nine complete interface locales, Arabic shaping and RTL direction, compact screens, reduced motion, forced colors, and the existing locale-length-aware cycle. It must not gain onboarding, credential, persistence, or workspace authority.

## Decision

`WelcomeExperience` remains the sole owner of greeting order, selected locale, cycle timing, and phase transitions. It passes exactly one value, locale, and duration into a props-only `HandwrittenGreeting` component.

The child renders three original inline SVG presentation layers from the current system writing face: rounded spectrum outline strokes animate by dash offset for each LTR grapheme, a delayed spectrum fill settles behind them, and one bounded path closes the gesture after the last unit. Arabic remains one unsplit RTL shaping run. A script-aware view-box estimate keeps short CJK greetings and longer Latin/Cyrillic greetings optically comparable without measuring or mutating layout at runtime.

The component contains no timer, remote font, copied glyph path, Canvas, network request, persistence, provider, credential, Artifact, or mutation import. `prefers-reduced-motion` removes trace and flourish layers and reveals the final fill immediately. Forced colors uses `CanvasText`.

## Consequences

- The visible sequence reads as outline being written, ink settling, and a single finish rather than text being wiped into view.
- Each greeting remounts under the existing locale-cycle key, so CSS animation restarts without a second scheduler.
- System fonts preserve native script shaping; exact glyph appearance may vary by platform, while geometry remains bounded by one responsive SVG stage.
- Browser release tests keep all nine locales inside desktop and compact geometry and assert that the write, settle, and flourish animations are mounted at runtime.
