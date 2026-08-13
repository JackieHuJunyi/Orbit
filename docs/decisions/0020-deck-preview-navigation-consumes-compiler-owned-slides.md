# ADR 0020: Deck preview navigation consumes compiler-owned slides

## Status

Accepted — Rune v1.01.

## Context

Deck Markdown compiled into one complete sandboxed HTML document. That is the correct portable handoff, but it is the wrong interaction unit for a source-linked editor: the outer workbench cannot reliably move an opaque sandbox to one internal slide, and clicks inside that iframe cannot select an exact canonical source range. The page strip could highlight, yet the visible slide and the source editor were not one provable navigation state.

Creating a second React slide renderer would make the preview easier to control while introducing a second interpretation of Deck layout, escaping, images, numbering, and Chart tokens. Giving the sandbox scripts or same-origin access would weaken Rune's existing presentation security boundary.

## Decision

`compileDeckSource` remains the only Deck presentation compiler. One invocation now returns both the complete multi-slide HTML document used by portable handoff and an ordered list of standalone one-slide HTML documents derived from the same parsed slides, block compiler, theme, numbering, and escaping rules. Every preview slide retains its stable zero-based compiler index and original `NN / total` label. Neither result contains script.

The workbench consumes only the currently visible one-slide document, then resolves live Chart tokens for that page. It does not reimplement slide markup or eagerly resolve all forty possible pages. The page strip changes the visible compiler result; an exact source-linked Deck target takes priority over local page-strip state. Proposal previews can still navigate pages without gaining source-selection authority.

The visible slide sits in a primary preview wrapper carrying the exact `PreviewSourceTarget` id. Source-to-preview navigation prefers that primary wrapper over duplicate navigation labels. When canonical interaction is enabled, one transparent accessible hit target covers the scriptless slide: activating it calls the existing `onTargetSource` capability, which validates the current artifact revision, reveals Split view when needed, focuses the textarea, selects the exact UTF-16 range, and centers it with reduced-motion support. The overlay owns no mutation, persistence, iframe access, or target derivation.

Legacy semantic HTML remains one compatibility iframe because it has no compiler-proven slide ranges. Full Deck HTML export keeps the same scriptless handoff contract and continues to include every slide.

## Consequences

Deck Markdown now satisfies the same two-way source-navigation contract as Documents and Data without relaxing the sandbox or adding another renderer. Compiler output, target identity, navigation state, and presentation remain separate owners. The cost is additional deterministic preview strings in memory, bounded by the existing forty-slide and 120,000-character source ceilings; only the current page performs live Chart resolution and browser rendering.
