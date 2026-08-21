# ADR 0059: Welcome writing uses one product timeline

## Status

Accepted for Rune v1.43.

## Context

Rune's first-run greeting already used original script-aware SVG masks, a finite spectrum treatment, and a centered startup-to-setup transition. The animation component planned its strokes, however, while `WelcomeExperience` separately estimated the phrase cycle and used a fixed completion fallback. Those clocks happened to align for current copy but could drift when a greeting, writing system, or speed changed.

[Chánh Đại's Apple Hello Effect](https://chanhdai.com/components/apple-hello-effect) demonstrates the useful interaction contract clearly: every path has explicit length, duration, delay, and one completion point. Its English, Spanish, Hindi, and Vietnamese paths are credited to another source, so Rune continues to borrow only the timing pattern—not glyph geometry, font data, or rendered assets. Rune also keeps CSS animation instead of adding Motion to the eager welcome graph.

The previous Rune renderer still stacked a thin secondary trail, clipped sheen, aura, textured reveal, settled fill, and a multi-part lit stroke head. Individually restrained layers became a heavier technical demonstration when combined.

## Decision

1. `greeting-motion.ts` owns the complete bounded clock: duration scale, ordered stroke timings, settle delay, settle duration, completion time, and phrase cycle.
2. `greeting-presentation.ts` is the React-free product adapter from one locale and greeting into direction, writing strategy, canvas geometry, and that frozen motion plan. All nine interface locales use this boundary.
3. `WelcomeExperience` consumes the plan's exact cycle and completion values. It no longer estimates them from character count or carries a fixed animation fallback.
4. `HandwrittenGreeting` becomes a presentation consumer of the plan. Every reveal path keeps normalized `pathLength="1"` plus its explicit delay and duration.
5. The visible stack is reduced to spectrum-filled masked ink, a faint glyph-shaped bloom, one textured settle, and one small path front. The duplicate trace, clipped sheen, and separate head bloom/highlight are removed.
6. The planner clamps speed to `0.6…1.6`, the phrase cycle to `5…7 seconds`, and freezes every result. Invalid geometry, counts, and scale cannot create an unbounded first-run animation.
7. Reduced motion still bypasses the timeline visually and presents the complete static localized word and setup controls immediately.

## Consequences

- Locale changes, writing completion, setup unfold, background crossfade, and greeting rotation now share one deterministic clock.
- The opening is lighter and easier to tune because a timing change has one owner and decorative layers no longer duplicate the same progress.
- Rune retains its nine-language spectrum identity and original geometry while keeping the reference's font/path assets and animation dependency out of the product.
- Unit tests must cover scale bounds, immutable complete timing, and every locale strategy. Server-first and real Chromium tests must continue to prove no-JavaScript first paint, ordered path animation, exact RTL Arabic motion, and setup completion.
