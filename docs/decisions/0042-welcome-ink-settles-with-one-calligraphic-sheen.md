# ADR 0042: Welcome ink settles with one calligraphic sheen

## Status

Accepted for Rune v1.26.

## Context

Rune v1.24 replaced a broad wipe with ordered writing-system-aware strokes. That fixed the sequence, direction, and pen-lift problem, but the final visual transition could still feel like a technical mask followed by a complete font layer. Adding particles, looping color motion, or a bright cursor would make the opening more effect-heavy and more like generic AI product decoration.

The desired reference is the restraint of a device-startup greeting: the word should feel drawn, hold attention briefly, and then become quiet so language selection remains the real action. Rune must learn from that choreography without copying Apple glyph paths, fonts, artwork, animation files, or brand identity.

## Decision

The immutable `greeting-motion.ts` plan remains unchanged and authoritative. Every script-specific stroke still controls the reveal mask and its spectrum ink head through one shared path, delay, and duration. `HandwrittenGreeting` adds only two presentation details:

- a small highlight inside the existing pressure-responsive ink head, which makes the moving mark read as a soft calligraphic nib rather than a cursor; and
- one narrow completion sheen whose start time derives from the existing settle time and whose travel distance derives from the bounded canvas width.

The sheen is a rectangle clipped by the complete local SVG text glyphs and masked by the completed stroke reveal. It therefore cannot leave the word, infer layout from the DOM, or expose a new source of identity. It runs once, fades to zero, and never loops. The nine-stop spectrum, system writing faces, original Rune motion paths, Arabic shaping, locale order, and onboarding state stay unchanged.

The drawing component still has no timer, Canvas, remote font, copied asset, storage, network, model, credential, Artifact, workspace, or mutation authority. `WelcomeExperience` remains the only owner of the language cycle. Reduced-motion and forced-color modes remove the nib and sheen and immediately show the complete static word.

## Consequences

- The transition from active stroke to settled word has a visible but restrained material finish.
- Animation remains decorative and non-blocking; language and setup controls are available from the first frame.
- Every supported writing system retains its own direction and stroke schedule without a second motion planner.
- Source checks require the calligraphic mask, spectrum fill, pressure head, glyph-clipped one-shot sheen, and accessibility fallbacks. The release browser gate verifies mounted animation names plus the existing nine-locale desktop/compact containment matrix.
