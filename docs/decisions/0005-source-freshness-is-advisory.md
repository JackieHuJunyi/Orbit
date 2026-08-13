# ADR 0005: Source freshness is advisory

- Status: accepted
- Date: 2026-08-14
- Scope: detecting when a source-linked presentation may be refreshed

## Context

An exact `origin` proves which Document produced a Deck, and source-owned recipe fields reconstruct how it was produced. Neither tells the user whether that Document changed after the last compile. Modification times are unavailable for browser-created artifacts, unreliable across folder sync, and absent from canonical source. Automatically rewriting every downstream Deck would violate Rune's review-before-write model.

## Decision

A task-generated Deck records an optional `origin_revision` in strict frontmatter. The value is a versioned, bounded token over the exact UTF-8 bytes of the Document source used for the compile:

`r1-<base36 byte length>-<16 lowercase hexadecimal FNV-1a digits>`

The pure target resolver derives the same token from the current exact origin Document and reports:

- `current` when both tokens match;
- `changed` when a stored token differs;
- `unknown` when an older Deck has no stored token.

The file rail shows a quiet refresh affordance only for `changed`. The setup destination and live summary expose all three states. Refreshing an `unknown` Deck through the normal reviewed transaction adds the current baseline.

## Security and authority boundary

The token is a fast portable change detector, not a cryptographic hash, identity, integrity guarantee, or capability. It cannot authorize a write and does not participate in mutation safety. Every refresh still resolves exact Artifact ids, captures and compares complete workspace source revisions, parses the current Deck, checks its exact origin, compiles from the complete current Document, validates the proposed workspace, shows the transaction, checkpoints the old source, and requires Apply.

## Rejected alternatives

**Automatically refresh linked Decks.** Rejected because a source change is information, not user intent to overwrite a deliverable.

**Store timestamps in localStorage.** Rejected because they do not travel with user-owned files, can drift across devices, and duplicate source truth.

**Make the task compiler asynchronous solely for Web Crypto SHA-256.** Rejected because freshness is advisory; widening every provider and React call boundary would add complexity without strengthening write safety.

**Treat missing metadata as changed.** Rejected because Rune has no evidence that a legacy Deck is either current or stale. `unknown` is explicit and recoverable.

## Enforcement

- `tests/source-revision.test.mjs` proves deterministic, bounded UTF-8 change tokens.
- `tests/deck.test.mjs` enforces token grammar, origin coupling, optional backward compatibility, and strict unknown-field rejection.
- `tests/document-briefing.test.mjs` proves current → changed → current transitions and the unknown migration path.
- `tests/task-architecture.test.mjs` verifies that the workbench consumes compiler-derived freshness rather than independent persistence state.
