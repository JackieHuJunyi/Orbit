# ADR 0068: calm contextual surfaces share one cascade

- Status: Accepted
- Date: 2026-09-01
- Release: Rune v1.52

## Context

Rune had accumulated high-quality individual surfaces but still behaved like several interface generations at once. `globals.css` and the modular design system were loaded as peers, leaving authority implicit. An empty file retained five desktop grid tracks, so its primary canvas stopped before the right edge. Split/Source/Preview controls repeated inside panes, idle Agent and status chrome stayed permanently present, and compact screens preserved the visual weight of a desktop split workspace. First-run platform glyphs and an empty inline style also left avoidable server/client rendering risk. A numeric JSX condition could render `0` in model setup. Multilingual copy was complete, but language-row placement, RTL isolation, and CJK wrapping were not yet one optical contract.

The desired interaction direction is Apple-informed restraint and Prism-like task clarity: one prominent current action, stable geometry, motion only as causal feedback, and complexity disclosed by context. Those references guide proportions and hierarchy; Rune still owns its visual identity, source-first workflow, implementation, and redistributable assets.

## Decision

1. `app/layout.tsx` imports only `app/styles/index.css`. That entry declares one cascade order and places `globals.css` in the lowest `legacy` layer. Tokens, shell, content, overlays, onboarding, motion, and responsive modules own their named responsibilities; compatibility selectors may remain while they are migrated, but they cannot become a second authority.
2. Empty workspace is a frame state. It consumes every track after the visible navigation rails on desktop and the complete remaining track on compact screens. One `Open files` action is primary; outcome tasks and blank/sample choices are secondary.
3. Split/Source/Preview is one top-bar segmented control. At 960 px and below Split is unavailable and exactly one Source or Preview pane is visible. Activating an exact Preview target reveals Source on compact screens and Split on desktop before selecting and centering the proven UTF-16 range.
4. Agent and status chrome are contextual. The idle Agent renders one compact focus affordance and expands on explicit click, shortcut, exact preview/source scope, or active proposal/error. Status feedback is a temporary non-blocking floating pill. Neither change alters planning, review, persistence, or operation ownership.
5. Source and Preview retain compiler-derived identity. A new counterpart centers; repeated movement inside the same target uses nearest-edge recovery. Both exact counterparts receive the same 820 ms confirmation animation, removed entirely under reduced motion.
6. First-run server and first-client output must be byte-stable for platform copy, must not emit empty inline style attributes, and must expose `data-rune-hydrated` only as an observable interaction-readiness fact. Model-profile conditions use explicit booleans and compact onboarding never renders count values. Personal keys remain encrypted HttpOnly credentials when the server vault is configured.
7. All nine registered interfaces share the same geometry tests at 1440×900 and 390×844. Arabic keeps logical RTL layout with the Rune name isolated LTR; Japanese and Korean receive script-aware line breaking; the selected language aligns to complete rows. Touch controls remain at least 44 px on compact screens.
8. The release gate adds fresh/reload hydration collection, full-track empty geometry, contextual Agent disclosure, and compact Preview-to-Source centering. The complete 61-scenario suite runs unchanged in Chromium, Firefox, and WebKit.
9. WebKit presentation `srcdoc` recovery is one global serial queue rather than independent timer retries. Each frame completes an isolated blank navigation, loads the same compiler-proven bytes, exposes readiness only from the final load event, and then releases the next frame. Chromium and Firefox remain on the native path. The queue has no source, persistence, network, provider, credential, or iframe-DOM authority.

## Consequences

Rune now has one explicit migration path instead of a growing specificity contest. The workbench presents fewer persistent controls and a compact screen behaves as a focused editor rather than a squeezed desktop. Contextual disclosure introduces state transitions that tests must observe after client hydration; the explicit marker makes those boundaries testable without granting product authority. Apple and Prism remain quality references, not claims of pixel identity. Real-user comprehension, preference, and recurrence still require external evidence beyond these engineering gates.
