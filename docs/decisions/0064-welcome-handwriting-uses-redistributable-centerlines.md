# ADR 0064: Welcome handwriting uses redistributable centerlines

- Status: Accepted
- Date: 2026-08-21
- Release: Rune v1.48

## Context

Orbit's welcome should feel like a light device boot sequence: one dark stage, a pressure-sensitive spectrum line written in place, then a calm language setup surface. A text mask cannot reproduce the order, pressure, joins, or pencil texture of handwriting. The public `SF-Hello` reference has useful Apple-authored glyph data, but its own notice reserves Apple's rights and does not grant Orbit a redistribution license. Attribution alone is therefore not an authority to copy those assets into a public repository.

The nine interface locales also need their native scripts to receive the same treatment. A single Latin system font cannot honestly supply Chinese, Cyrillic, Arabic, Japanese, and Korean handwriting geometry or Arabic shaping.

## Decision

Orbit separates the welcome performance into three replaceable layers:

1. `greeting-presentation.ts` owns locale, direction, script, renderer choice, and the bounded transition fallback.
2. `greeting-font-bundles.ts` owns lazy font and shaping capabilities. Arabic loads HarfBuzz only when required.
3. `handwritten-greeting.tsx` owns visual performance only: centerline reveal, pressure width, taper, restrained wobble, spectrum ink, reduced motion, and a visible failure fallback.

Both visible lines in each locale use the same Tegaki font bundle: Caveat for Latin/Cyrillic, Ma Shan Zheng for Simplified Chinese, Iansui for Traditional Chinese, Klee One for Japanese, Nanum Pen Script for Korean, and Amiri for Arabic. Small OFL subsets include every character used by the greeting and translated welcome line. The second renderer mounts only after the first completes, explicitly restarts its timeline from zero, and uses one fixed bounded duration so setup never waits on a long phrase indefinitely.

The generated data, subset fonts, and all third-party notices ship in the repository. Apple-owned SF-Hello JSON and font files remain excluded unless a future contributor supplies a redistribution license that Orbit can verify.

## Consequences

- Every interface locale receives real progressive centerline handwriting rather than a clipped text reveal.
- Arabic retains connected shaping and right-to-left motion.
- The welcome renderer remains replaceable without moving onboarding state or timers into the drawing layer.
- Reduced-motion users see the completed mark and setup immediately.
- A font-module failure produces a readable spectrum fallback instead of a blank welcome screen.
- Orbit can publish and fork the repository without representing attribution as permission.

## Verification

- Pure presentation and architecture tests cover locale routing, renderer choice, timer bounds, and the absence of SF-Hello/Apple-owned data.
- Chromium tests observe live timeline progress, verify the second line starts after the first, compare the two font identities, cover Arabic shaping, and require complete glyph coverage in all nine locales at desktop and compact widths.
- Build and server-render tests ensure the writing system remains deterministic and script-specific font/shaper code stays deferred.
