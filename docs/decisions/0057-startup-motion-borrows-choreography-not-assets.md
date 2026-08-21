# ADR 0057: Startup motion borrows choreography, not assets

## Status

Accepted for Rune v1.41.

## Context

The v1.40 greeting established the correct first-frame owner, exact center, script-aware writing plan, and restrained ink stack, but its surrounding canvas still felt static. The product needs enough full-screen motion to make the opening feel alive without returning to decorative AI-product gradients or competing with the word.

Four open-source references clarify different parts of the problem:

- [Aerial](https://github.com/JohnCoates/Aerial) uses full-bleed media, aspect-aware presentation, and cubic opacity keyframes around one foreground subject.
- [Brooklyn](https://github.com/pedrommcarrasco/Brooklyn) queues and loops local full-screen videos, but its README explicitly says the original animations and logo belong to Apple.
- [AppleCurveAnimation](https://github.com/jrenc2002/AppleCurveAnimation) documents sequential `stroke-dasharray` timing under MIT, but is an exploratory README rather than a reusable product component.
- [Chánh Đại's Apple Hello Effect](https://github.com/ncdai/chanhdai.com/tree/main/src/registry/components/apple-hello-effect) is an MIT React/Motion implementation with explicit path-length durations and delays. Its own documentation credits [SF-Hello](https://github.com/JaceThings/SF-Hello), whose README says its JSON files are owned by Apple and provides no repository license.

Copying the videos or credited glyph paths would therefore import an asset-rights problem even when surrounding wrapper code is MIT. Adding `motion/react`, a Canvas renderer, or MP4 files would also increase the eager startup graph without solving Rune's nine-script path ownership.

## Decision

Rune learns only from the references' choreography:

1. `WelcomeAmbientMotion` is a props-only inline-SVG presentation component rendered only during the welcome step.
2. Its geometry is Rune-original: two broad spectrum Bézier ribbons and one fine thread inside a radial vignette. No source path, wordmark, video frame, font, logo, or media file is copied.
3. The component receives the existing greeting cycle as a CSS custom property and is keyed by the current greeting. It owns no interval, timeout, animation frame, browser storage, locale lookup, or onboarding transition.
4. One finite timeline crossfades the field, moves each ribbon only a few percent, draws the thread once, and ends at zero opacity. The `ready` phase lowers the peak so controls remain the visual priority.
5. The field sits on the semantic canvas layer below the onboarding window, has `pointer-events: none`, and uses multiply blending in light themes and screen blending in Space Black.
6. Reduced motion, reduced transparency, increased contrast, and forced colors remove the entire ambient field. The existing static greeting and normal setup layout remain complete.

The handwriting itself keeps Rune's existing system-font shaping and original motion masks. Chánh Đại's English, Spanish, Hindi, and Vietnamese paths are not imported, and Rune does not add Motion as a dependency.

## Consequences

- The opening has a visible environment transition without a persistent ambient loop or a second visual subject.
- Each language change can replay one coherent background crossfade using the same parent-owned cycle.
- Server rendering includes the field on the first frame, while a returning user still bypasses onboarding before paint.
- The eager minified Workbench grows from 522,675 to 525,024 bytes and remains under the 530 KB budget.
- Architecture and browser tests must prove inline local rendering, three bounded paths, semantic layering, pointer transparency, finite CSS animations, first-frame presence, exact greeting center, and the existing accessibility fallbacks.
