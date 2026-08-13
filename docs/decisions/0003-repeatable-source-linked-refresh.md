# ADR 0003: Repeatable source-linked presentation refresh

- Status: accepted
- Date: 2026-08-14
- Scope: refreshing generated presentations without duplicate artifacts or implicit synchronization

## Context

Creating a source-linked presentation once proves generation, but not reuse. A weekly or monthly workflow must update the same deliverable without guessing by filename, silently overwriting it, or creating `briefing-2`, `briefing-3`, and similar copies. The existing `origin` edge already identifies the exact Document; the missing contract is a reviewed in-place refresh.

At the same time, the workbench had begun importing each task compiler directly. That is manageable for two tasks but creates a growing consumer dependency surface. DeepSeek Harness's declared provider/consumer seam is useful here without importing its plugin runtime.

## Decision

`document-briefing` accepts an optional exact target Artifact id. Without a target it creates one collision-safe Deck as before. With a target, the pure compiler requires all of the following before returning a plan:

- the target exists and is Deck Markdown;
- its current source parses successfully;
- its declared `origin` equals the selected Document id;
- the selected Document contains enough bounded readable evidence;
- the generated source differs from the current target;
- the complete proposed workspace remains valid.

A valid refresh returns one `ArtifactSourcePatch`, never a creation. It preserves the target id, filename, Rune light/dark theme, and exact origin; recompiles the selected language, title, audience, purpose, and 4/6/8 slides; and enters the unchanged runtime preflight, in-memory proposal preview, transaction review, checkpoint, revision check, and Apply boundary. `origin` remains lineage rather than automatic synchronization.

`task-providers.ts` is a static discriminated router for registered task inputs. It invokes the operating-review or document-briefing pure compiler and exposes neither React nor persistence/network/browser capabilities. It is a provider seam, not a dynamic extension host.

## UI consequences

- The setup surface shows an explicit destination: create a new presentation or refresh one of the Decks linked to the selected Document.
- Selecting a linked Deck in the workspace opens its exact Document and preselects in-place refresh.
- The live task summary states whether identity will be created or retained.
- Review shows the Document as input, the Deck as edited, and the `deck-origin` edge as retained.
- All new copy participates in the nine-locale static catalog and existing RTL/reduced-motion layout.

## Rejected alternatives

**Refresh every downstream Deck automatically when a Document changes.** Rejected because it creates a second writer, removes user intent, and turns one source edit into unreviewed content replacement.

**Resolve the target by title or filename.** Rejected because names can collide or change and do not prove the lineage relationship.

**Always create a new Deck.** Rejected because duplicate deliverables undermine recurring task identity, folder handoff, and user trust.

## Enforcement

- `tests/document-briefing.test.mjs` proves exact in-place identity, theme and origin retention, transaction lineage, no-op refusal, and missing/wrong-kind/unrelated target failures without input mutation.
- `tests/task-providers.test.mjs` proves both registered tasks route through the shared provider boundary.
- `tests/task-architecture.test.mjs` rejects React, browser, storage, persistence, and network dependencies in the task provider seam.
