# ADR 0047: Visual editors share one complete-source draft bridge

## Status

Accepted for Rune v1.31.

## Context

Rune's controlled Preview editors already projected a Document section or block, Data cell, Chart spec, Deck Markdown slide, or semantic HTML slide into a complete candidate source. The Workbench displayed that candidate read-only on the left, while the editor rendered a local draft on the right and made the candidate canonical only after validation, checkpoint, and persistence.

Each Preview surface still published and cleared its candidate through a separate pair of React effects. That duplication made one of Rune's defining product contracts difficult to audit and extend. The Deck surface also mounts a child semantic-HTML editor: the parent must stop publishing without clearing the child's candidate, which is different from having no draft. Automated evidence for the complete interaction was strong for semantic HTML, but Document, Data, and Chart paths were still represented mostly by pure compiler tests and source assertions.

## Decision

All controlled Preview editors publish through `useVisualSourceDraftMirror`. A published value contains only the artifact id, exact source revision, complete next source, replaced range, and compiler errors. `null` explicitly clears the mirror. `undefined` explicitly yields ownership without changing the current mirror; the Deck parent uses this while its semantic-HTML child owns the live candidate. Unmounting releases the shared mirror.

The hook does not create or validate source, inspect rendered content, read iframe DOM, mutate an Artifact, persist state, call a provider, or create a checkpoint. Typed projection functions remain the only producers. The Workbench remains the only surface that renders the complete candidate in Source and the only owner of the later validated save transaction.

Real Chromium proves the interaction, not just the projection helpers:

- direct canonical edits to Markdown, CSV, and semantic HTML immediately recompile the visible Document, Data grid, and Presentation Preview without an explicit refresh;
- a Markdown section edit mirrors the complete `.md` source and local rendered draft, Cancel restores the exact original, and Save commits the same candidate;
- an exact CSV scalar edit mirrors the complete row in Source, Cancel writes nothing, and Save updates the canonical grid;
- a Chart title edit mirrors strict Chart JSON and the runtime-validated chart draft before Save; and
- the existing semantic HTML flow continues to mirror a complete presentation while recompiling one isolated slide, then commits through the same transaction boundary.

## Consequences

- A new controlled visual editor reuses one publication lifecycle instead of copying effects into another large component.
- Parent/child editor ownership is explicit and testable; transient clearing is not inferred from mount timing.
- Draft Source remains visibly complete but read-only, so right-side editing cannot race an independent left-side temporary document.
- Cancel and invalid drafts remain zero-write outcomes. Save still requires exact revision/range proof, whole-workspace validation, runtime preflight where applicable, checkpoint, and one persistence operation.
- This does not make arbitrary Preview DOM editable or establish a second canonical document model.
