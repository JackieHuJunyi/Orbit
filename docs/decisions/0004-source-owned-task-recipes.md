# ADR 0004: Source-owned task recipes

- Status: accepted
- Date: 2026-08-14
- Scope: portable configuration for recurring Document-to-Presentation tasks

## Context

Rune v0.84 can refresh one exact linked Deck, but part of the input remained transient. Title and slide count could be derived from the presentation; audience and purpose existed only in the dialog that produced it. Persisting another browser task record would let that record drift from a Deck moved through a user-owned folder, Git, import, or an AI editing workflow.

## Decision

Generated Deck Markdown owns the minimal recipe needed to prepare its next deterministic refresh. Its strict frontmatter may contain:

- exact Document `origin`;
- presentation `title` and `lang`;
- `audience` as `leadership`, `team`, or `customer`;
- one non-empty `purpose` of at most 180 characters.

The actual parsed slide count completes the recipe. When a linked Deck is selected, the setup surface restores title, audience, purpose, slide count, and presentation language from its current canonical source. Refresh still reads the current Document and Deck, compiles a proposal, and requires the normal transaction review and Apply.

The new recipe fields are optional so pre-v0.85 Decks remain valid. When present they are strictly validated; invalid values or undeclared fields make the Deck an invalid refresh target. Rune does not create a parallel localStorage record for this task.

## Consequences

- A task recipe travels with folder sync, Git, exportable source, import, and bounded Agent context.
- The UI has no second copy to migrate or reconcile with canonical source.
- Refreshing on an interface configured to another language preserves the linked Deck's declared presentation language.
- Recipe metadata grants no automatic synchronization or write authority.
- Device evidence such as run timing, provider usage, and delivery outcomes remains outside artifact source.

## Rejected alternatives

**Persist a saved Document briefing object in localStorage.** Rejected because it would be device-bound, require migration and reconciliation, and conflict with Rune's source-first portability.

**Infer audience and purpose from rendered slide prose.** Rejected because localized prose is not a stable identity contract and inference would be lossy.

**Automatically refresh when the origin Document changes.** Rejected because recipe metadata describes intent; it does not authorize a background write.

## Enforcement

- `tests/deck.test.mjs` covers valid, bounded, unknown, and backward-compatible frontmatter.
- `tests/document-briefing.test.mjs` covers exact recipe round-trip and source-owned refresh equivalence.
- `tests/task-architecture.test.mjs` verifies that the dialog restores source-derived recipe fields and presentation language.
