# ADR 0043: Welcome ink is visible on the writing path

## Status

Accepted for Rune v1.27.

## Context

Rune v1.24 established ordered writing-system-aware strokes, and v1.26 made the moving nib and final settle quieter. The broad stroke remained a luminance mask, however, so people mostly saw a colored font being uncovered. The nib moved, but the fresh ink immediately behind it was not independently visible. More ambient glow, particles, or looping color would add spectacle without making the writing action more legible.

The intended startup rhythm is a greeting that visibly forms under a pen and then becomes still. Rune can learn from that device-onboarding choreography without copying Apple glyph paths, fonts, artwork, animation files, or brand identity.

## Decision

The frozen `greeting-motion.ts` output remains the only source of path geometry and scheduling. `HandwrittenGreeting` renders two additional copies of every planned stroke, both clipped to the final local SVG text shape:

- a wider, filtered spectrum bloom that suggests fresh ink without leaving the glyph; and
- a narrow, crisp spectrum core that makes the line directly behind the nib visible.

Both traces reuse the stroke's existing path, delay, and duration. They introduce no timer, layout measurement, or second motion plan. The reveal mask still uncovers the complete colored glyph, the pressure nib still follows the same CSS offset path, and the final system-font layer still restores exact shaping before the existing one-shot sheen.

The welcome copy and language card use the existing scene-entry animation with short 420ms and 560ms delays. This establishes the greeting before supporting controls compete for attention without adding a blocking splash state; mounted controls remain interactive.

Reduced-motion and forced-color modes hide both trace layers together with the nib and sheen and immediately show the complete static greeting. The component retains no storage, network, model, credential, Artifact, workspace, Canvas, remote-font, or mutation authority.

## Consequences

- The moving nib now has an explicit visual cause-and-effect relationship with the colored word left behind it.
- Latin/Cyrillic, Chinese, Japanese, Korean, and connected RTL Arabic continue to share one renderer while retaining their separate immutable path strategies.
- The extra SVG paths are bounded by the existing maximum of twelve strokes, remain inside the deferred welcome chunk, and do not affect canonical product state.
- Source and browser gates require the progressive ink-trace contract, mounted trace animation, static accessibility fallback, and existing multilingual geometry containment.
