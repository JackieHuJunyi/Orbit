# ADR 0041: Semantic HTML sections edit canonical source directly

## Status

Accepted for Rune v1.25.

## Context

Rune can prove outer `<section>` slide ranges in one bounded semantic HTML `<main>`, preview each page in an isolated sandbox, navigate between Preview and exact Source, hand off to PPTX/ODP/PDF, and create a reviewed independent Deck Markdown copy. The copy boundary is correct when users want Rune's typed Deck layouts, but it does not satisfy the simpler job of correcting the canonical HTML presentation itself. Requiring a conversion for every text or markup correction makes HTML feel like a second-class import format.

Reading or mutating iframe DOM is not an acceptable answer. Browser error correction, computed structure, CSS, duplicate visible text, and embedded content cannot establish canonical source identity. A safe direct editor must remain attached to one compiler-proven source range and use the existing atomic visual-write transaction.

## Decision

`visual-semantic-html-slide-edit.ts` is a React-free exact-revision compiler for one current `deck-slide` target belonging to a `.html` or `.htm` Slides artifact with language `Semantic HTML`. It extracts the exact outer section, exposes it as a controlled text draft, normalizes only newline convention, and projects a complete candidate by replacing that range alone.

The compiler accepts at most 16,000 draft characters and requires the draft to compile as exactly one outer `<section>`. Scripts, wrappers, extra sections, changed slide count, stale artifact/target identity, non-identical content outside the range, altered live `{{ ... }}` binding tokens, unsafe complete source, and no-op persistence all fail closed. The full candidate is recompiled through `compileLegacyHtmlSlides`; its isolated document and original shared styles supply the draft preview. Neither the compiler nor UI reads iframe DOM.

During a valid draft, `SemanticHtmlSlideEditor` sends the complete projected source through the existing visual-source mirror, so the left pane displays the exact proposed HTML read-only. Save delegates to `commitVisualSourceEdit`, which re-resolves the current revision, validates the complete workspace, runs impacted runtime preflight, creates one checkpoint, persists once, and synchronizes selection and focus. No new writer or state owner is introduced.

The existing reviewed Deck-copy action remains available. It is an optional semantic projection for users who need typed Deck layouts and structured editing, not a prerequisite for canonical HTML corrections.

## Consequences

- Proven semantic HTML sections are directly editable without pretending arbitrary rendered DOM is canonical.
- Left and right panes share one complete proposed source during editing, and cancellation leaves every Artifact unchanged.
- Section insertion, deletion, reordering, wrapper changes, scripts, binding changes, and unproven HTML remain Source or reviewed-Agent operations.
- Unit tests cover exact preservation, isolated draft documents, no-op refusal, stale/unsafe/binding/size failure, immutability, and CRLF normalization. Real Chromium starts from reviewed file import, edits one section from Preview, proves the complete left mirror and draft sandbox, saves, reopens the canonical HTML, and then exercises the optional Deck-copy path.
