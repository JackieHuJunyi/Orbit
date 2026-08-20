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

A follow-up keeps that ownership model while making the material more visibly handwritten. One deterministic SVG turbulence/displacement filter gives the filled ink a restrained paper edge, each existing stroke gains one glyph-clipped dry-brush bristle, and the nib gains two tiny split fibers. The nine spectrum stops make one bounded transition during the existing write duration and then become still; they never run as ambient infinite motion. The backdrop aurora is reduced so color remains concentrated in the mark rather than becoming a generic AI gradient.

The welcome copy and language card remain mounted but hidden during the `writing` act. Final ink settle owns the normal transition into `ready`, with a 4.15-second browser-event fallback for the longest bounded scripts and an immediate fallback under reduced motion. This keeps the greeting as the first visual act without adding a persisted splash step or removing access to setup controls after the animation.

Reduced-motion and forced-color modes hide both trace layers together with the nib and sheen and immediately show the complete static greeting. The component retains no storage, network, model, credential, Artifact, workspace, Canvas, remote-font, or mutation authority.

## Consequences

- The moving nib now has an explicit visual cause-and-effect relationship with the colored word left behind it.
- Latin/Cyrillic, Chinese, Japanese, Korean, and connected RTL Arabic continue to share one renderer while retaining their separate immutable path strategies.
- The extra SVG paths are bounded by the existing maximum of twelve strokes, remain inside the deferred welcome chunk, and do not affect canonical product state.
- Ink texture, bristles, and spectrum motion reuse the same bounded SVG and CSS timeline; there is no Canvas loop or ambient color cycle.
- Source and browser gates require the progressive ink-trace contract, mounted trace animation, static accessibility fallback, and existing multilingual geometry containment.
