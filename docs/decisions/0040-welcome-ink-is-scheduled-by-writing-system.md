# ADR 0040: Welcome ink is scheduled by writing system

## Status

Accepted for Rune v1.24.

## Context

The v1.22 welcome animation revealed a filled greeting through one very wide directional mask. It preserved text shaping and looked more complete than an outline animation, but its single wave crossed the entire word at once. The visible result was a horizontal wipe with a decorative cursor, not the ordered pen lifts, joins, pressure changes, and settling ink that make a device-startup greeting feel handwritten.

Apple's public [motion guidance](https://developer.apple.com/design/human-interface-guidelines/motion) describes purposeful, brief, optional motion, and its [SF Symbols Draw On behavior](https://developer.apple.com/sf-symbols/) uses layer-aware timing to evoke calligraphic movement. Rune should learn from those interaction principles without copying Apple's glyph paths, fonts, artwork, animation files, or product identity.

## Decision

`greeting-motion.ts` remains a React-free presentation planner, but it now returns an immutable ordered collection of strokes instead of one broad path. Every stroke contains only a bounded SVG path, width, delay, and duration. The planner selects one of five writing-system strategies:

- Latin and Cyrillic greetings use an opening stroke, a short cross stroke, and one connected body gesture.
- Simplified and Traditional Chinese use three brush-like passes per visible character.
- Japanese and Korean use bounded per-character horizontal, vertical, and finishing passes, capped at twelve total strokes.
- Arabic retains one complete RTL SVG text run while a right-to-left body stroke is followed by two bounded mark strokes.

`HandwrittenGreeting` keeps the final text as one SVG shaping run and uses the scheduled strokes only as a luminance mask. A small spectrum-colored ink head follows the same path and timing as each active mask stroke. There is no independent flourish, white cursor, whole-word rectangular clip, copied glyph outline, Canvas loop, remote font, DOM measurement, or second timer. After the final path completes, one crisp spectrum fill settles over the complete system-font word.

`WelcomeExperience` remains the only owner of greeting order, cycle timing, locale choice, and onboarding state. The deferred drawing component still has no storage, network, model, credential, Artifact, workspace, or mutation authority.

Reduced-motion and forced-color users receive the complete static word immediately. The existing setup action remains usable while the greeting writes, so the ceremony never blocks progress.

## Consequences

The opening now reads as a sequence of deliberate marks instead of a gradient wipe, and each supported interface language receives motion shaped for its writing system. Because the mask paths are original Rune geometry rather than exact glyph centerlines, the final settle is still required to restore every detail of the device font. This is an honest presentation compromise: it preserves local shaping across platforms while making the writing order perceptible.

Pure tests freeze exact bounds, stroke counts, ordering, timing, RTL direction, hostile inputs, and nested immutability. Source tests require the multi-stroke boundary and reject the retired single-path/flourish implementation. Real Chromium tests prove the CSS animations and offset paths are mounted, Arabic remains one shaped run, and the nine-locale desktop/compact geometry remains contained.
