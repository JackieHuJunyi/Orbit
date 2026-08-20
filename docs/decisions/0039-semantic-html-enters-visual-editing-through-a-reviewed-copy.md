# ADR 0039: Semantic HTML enters visual editing through a reviewed copy

Status: accepted

## Context

Rune can prove outer semantic HTML slide sections, preview them continuously, navigate exact source ranges in both directions, and hand them off through the controlled Deck model. Direct visual editing remains limited to strict Deck Markdown because arbitrary HTML structure, CSS, browser error correction, external media, and active content cannot safely become typed slide mutations.

Leaving every imported HTML presentation permanently read-only is nevertheless a product dead end. Users need a clear way to preserve the original compatibility source and continue in Rune's controlled visual editor.

## Decision

A valid semantic HTML Preview exposes one explicit action to create an editable Deck Markdown presentation. The workbench dynamically loads `semantic-html-editable-copy.ts`; the React-free helper requires the exact current workspace object and source revision, reruns the existing bounded semantic HTML → Deck projection, and submits the candidate to `prepareWorkspaceImportReview` with purpose `editable-copy`.

The existing conflict resolver exclusively assigns the new id and filename. The review shows the complete readable candidate and every fidelity warning, including a leading statement that the original HTML remains unchanged and later edits are not synchronized. Only confirmation runs the existing additive device-persistence transaction and selects the new Deck artifact. The HTML artifact remains byte-for-byte intact.

The helper has no persistence, network, download, provider, credential, local-image, React, or direct mutation capability. Scripts, malformed or oversized HTML, stale identity, invalid Deck output, workspace changes, cancellation, and persistence failure all produce zero source writes.

## Consequences

- Compatibility HTML gains a reachable path into right-side slide editing without granting arbitrary DOM write authority.
- The result is an explicitly independent derivative, not a hidden replacement or a falsely live-linked representation.
- Export and editable-copy paths reuse one semantic projection, so supported structure and fidelity warnings cannot drift.
- Unit tests cover deterministic conversion, collision naming, immutable originals, stale/unsafe refusal, and review purpose. Browser tests cover the full import → Preview action → review → editable Deck → original HTML preservation path.
