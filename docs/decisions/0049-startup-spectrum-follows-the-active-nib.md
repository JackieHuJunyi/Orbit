# ADR 0049: Startup spectrum follows the active nib

## Status

Accepted for Rune v1.33.

## Context

Rune's first-run greeting already isolated the writing act, preserved nine local writing systems, and rendered finite spectrum ink, a pressure nib, wet edges, dry-brush texture, and one final settle. Latin and Cyrillic words still used one generic body curve after the capital entry. The curve could reveal several glyph regions at once and make the result read as a decorated gradient wipe rather than a word being written.

## Decision

The React-free motion planner now schedules a capital entry, its cross stroke, and one bounded gesture for each remaining letter-scale segment, capped at twelve total strokes for long words. Each segment has its own path, delay, duration, and pressure width. Chinese, Traditional Chinese, Japanese, and Korean keep their existing script-specific brush plans.

Arabic is intentionally different. Its visible word remains one local SVG shaping run and its main motion path remains one continuous right-to-left subpath with a single start, followed by bounded mark strokes. It is never split into graphemes for rendering or motion.

`HandwrittenGreeting` adds one narrow, glyph-clipped spectrum ribbon per planned stroke. The ribbon uses the exact reveal path and clock, travels with the existing pressure nib, and fades completely when that stroke ends. The revealed ink, wet edge, texture, and one-shot final settle remain the persistent material. There is no infinite color cycle, extra timer, Canvas loop, particle field, remote font, or copied Apple asset.

## Consequences

- Latin and Cyrillic greetings visibly progress through letter-scale pen gestures instead of one whole-word sweep.
- Color is strongest at the cause of the writing—the active nib—and becomes quiet behind it.
- Arabic motion cannot silently regress into disconnected Latin-style subpaths.
- Reduced motion and forced colors hide every transient ribbon and nib layer and show the complete static word immediately.
- Chromium fixtures lock script, direction, stroke count, mounted animation, and desktop/compact containment for all nine interface locales; perceptual quality still requires human visual review.
