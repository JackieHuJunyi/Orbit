# ADR 0007: Models shape tasks but do not own mutations

- Status: accepted
- Date: 2026-08-14
- Scope: model-assisted Document-to-Presentation planning

## Context

Rune's Document-to-Presentation task was source-linked, repeatable, and reviewable, but its content compiler was entirely deterministic. The configured personal model profiles were available only to the generic Selection/File/Workspace Agent. Calling that Agent to rewrite a generated Deck would add an unnecessary second planning step and would give a broad operation protocol more authority than this focused task needs.

The task needs narrative judgment without surrendering file identity, source lineage, deterministic fallback, or the single reviewed write boundary.

## Decision

Document briefing uses a task-specific structured outline contract before the existing pure compiler:

1. Rune derives exactly `slideCount - 2` bounded evidence units from the reviewed Document. Each receives a request-local `source-N` capability id.
2. In automatic model mode, a dedicated `/api/tasks/document-briefing` endpoint sends only the exact Document, bounded task settings, and those evidence excerpts through the already active explicit provider protocol.
3. The model may return only one plain-text title and one to four plain-text bullets for each exact source-unit id. It must use every unit exactly once. It cannot return Artifact ids, filenames, Deck metadata, bindings, source revisions, patches, creations, or writes.
4. The endpoint validates the dynamic evidence coverage after provider schema validation. The client repeats that validation against its captured workspace and the pure compiler repeats it again before generating Deck Markdown.
5. Rune owns the cover, conclusion, exact `origin`, `origin_revision`, task recipe, target identity, collision handling, theme retention, complete source validation, candidate preview, transaction map, checkpoints, and Apply.
6. Unconfigured, unavailable, invalid, oversized, or local-only model paths use the existing deterministic compiler. They do not cross to another provider and do not change the write contract.

The shared provider adapter accepts a task-specific structured-response description, so Responses, Chat Completions, Anthropic Messages, and Gemini can reuse one protocol layer without pretending every schema is an Agent source-operation plan.

## Rejected alternatives

**Ask the Workspace Agent to generate or rewrite the complete Deck.** Rejected because a focused task does not need broad patch/create authority and would make source evidence indirect.

**Let the model return complete Deck Markdown.** Rejected because it would let the model author frontmatter, lineage, bindings, separators, and executable syntax that Rune can own deterministically.

**Persist a model-generated outline separately.** Rejected because the reviewed Deck source and its source-owned recipe are the portable truth; a browser-only outline could drift.

**Fail the task when the model is unavailable.** Rejected because configured AI improves narrative shaping but must not remove a reliable local workflow.

## Enforcement

- `tests/document-briefing-route.test.mjs` verifies bounded personal-provider routing, no credential disclosure, exact evidence coverage, and explicit unconfigured behavior.
- `tests/document-briefing.test.mjs` verifies compiler-owned identity/lineage, exact source-unit coverage, executable-text refusal, and immutable inputs.
- `tests/task-architecture.test.mjs` keeps the model route outside mutation and persistence boundaries.
- Full task output still passes the existing workspace mutation, candidate preview, source-revision, and Apply gates.
