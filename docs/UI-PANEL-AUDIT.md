# Orbit functional-panel audit

Date: 2026-09-02

Release: Orbit v1.57

Reference frame: 1440×900 desktop, 390×844 compact, light and Space Black, reduced motion, all nine interface locales

## Design standard

Orbit applies four rules across every panel:

1. Content owns the visual field; controls and navigation may float above it.
2. Glass is reserved for transient navigation or direct manipulation. Documents, forms, reviews, and evidence remain opaque and readable.
3. One task has one obvious primary action. Secondary actions recede without losing keyboard access.
4. Motion explains origin, placement, and state. It never oscillates, delays work, or substitutes for hierarchy.

These rules interpret Apple Human Interface Guidelines for materials, layout, sidebars, popovers, panels, controls, motion, reduced transparency, and reduced motion. They do not copy Apple assets or claim platform-native implementation.

## Audited surfaces

| Surface                 | Pixel finding                                                                                                    | v1.57 result                                                                                                                       | Verification                                     |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------ |
| Top bar                 | Dense but hierarchy is stable; the product, view switch, and primary file actions remain separable               | Kept one global bar; no decorative card added                                                                                      | Render test, desktop/compact E2E                 |
| Activity and file rails | Appropriate two-level hierarchy; rows are compact without becoming icon-only                                     | Preserved hide/show and adaptive single-pane behavior                                                                              | Three-browser workspace tests                    |
| Source and Preview      | Content has the strongest contrast; Preview reading measure and Source line rhythm remain balanced               | No new glass in content; contextual Agent appears only after a proven selection                                                    | Source/Preview mutual-position tests             |
| Agent composer          | Fixed bottom placement competed with status, had no content-adjacent entry, and could not move                   | Added nearby selection action, viewport-bounded float, drag, dock, compact bottom sheet, persisted placement, and status clearance | Pure layout tests plus three-browser interaction |
| Settings                | Chromium exposed an unstyled native `2px outset` border on every action row                                      | Explicit zero-border custom controls; stronger opaque material and 11 px helper floor                                              | Computed-style E2E assertion                     |
| Export                  | Correct transient scope and direct anchor; hierarchy was already clear                                           | Retained popover, reduced entry blur, strengthened legibility                                                                      | Export keyboard and registry tests               |
| Command menu            | Correct modal search hierarchy, grouping, and keyboard ownership                                                 | Retained centered command surface and single active result                                                                         | Command-menu tests                               |
| New artifact            | Strong task title and one primary action; supporting type descriptions were too small                            | Raised type detail and format labels while retaining responsive grid                                                               | Dialog and creation tests                        |
| Import/export reviews   | Appropriate opaque task surface; backdrop and footer clearly separate irreversible confirmation                  | Retained content material, standardized loader mark and calmer background veil                                                     | Import/export atomicity tests                    |
| Model setup             | Clear sequence but must remain honest about web versus desktop capabilities                                      | Preserved end-to-end readiness gates and centered setup at reduced motion                                                          | Nine-locale geometry and real DeepSeek check     |
| Operating review        | Information-dense by necessity; secondary descriptions fell below the shared reading floor                       | Raised cadence, scope, and field helper copy without adding cards or steps                                                         | Task-form and runtime tests                      |
| Checkpoint history      | Correctly stays inside Source rather than becoming a modal                                                       | Preserved contextual strip and source ownership                                                                                    | Restore and persistence tests                    |
| Empty workspace         | Clear center action with task alternatives; already owns the complete available canvas                           | Preserved full-track desktop and compact layouts                                                                                   | Nine-locale geometry tests                       |
| Welcome                 | Normal choreography is centered; reduced-motion fallback inherited fixed positioning and stuck to the upper-left | Restored optical centering without reintroducing motion                                                                            | Desktop center assertion across nine locales     |
| Deferred surfaces       | Loading overlay used a stale letter tile and an overly white veil                                                | Uses the two-orbit mark, calmer neutral veil, and one bounded progress line                                                        | Render-source assertion                          |

## Contextual Agent contract

- Preview interaction first proves an exact canonical source range and performs existing bidirectional positioning.
- Only then does a compact **Ask Orbit about this** control appear near the selected block.
- Opening it uses Selection scope and places the floating panel beside the content when space allows.
- Pointer dragging and Arrow-key movement are presentation-only, clamped to the current viewport, and cannot mutate Artifact or selection identity. Shift+Arrow moves by a larger step.
- Dock returns the same composer to Source; it does not create another Agent instance or conversation state.
- At compact width the panel becomes a bottom sheet and ignores arbitrary desktop coordinates.
- Position is stored only in `rune-agent-dock-layout-v1`; source, prompts, credentials, and model output are excluded.

## Remaining product-design work

The panel system is internally consistent at this release. The next meaningful visual work should be evidence-led rather than another global restyle:

1. observe whether real users discover the content-adjacent Agent without instruction;
2. measure whether float or dock is preferred by task and screen size;
3. test the six icon candidates with people who have not seen the design brief;
4. package the macOS icon through Icon Composer before App Store distribution;
5. use real long filenames, translated provider names, and large task evidence to identify content-specific truncation rather than increasing every panel size.
