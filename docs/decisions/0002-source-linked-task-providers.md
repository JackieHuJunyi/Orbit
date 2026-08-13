# ADR 0002: Source-linked task providers

- Status: accepted
- Date: 2026-08-14
- Scope: deterministic task compilers and relationships between generated artifacts

## Context

The first task runtime proved that Rune can carry one reviewed import into a focused result setup without hidden state. A second task is the architecture test: if Document-to-Presentation needs its own import lifecycle, persistence rules, or ad hoc relationship metadata, the seam has failed.

DeepSeek Harness documents three useful boundaries: a capability has a declared interface, provider, and consumer; model-visible facts must be recoverable rather than ambient; and UI composition should preserve mounted identity while routing writes through narrow actions. Rune applies these principles to source-native Office work rather than adopting Harness's conversation log or plugin host.

## Decision

Each Rune outcome task has four independent roles:

```text
Task capability       accepted files and Artifact kinds
Task session          phase, source revision, reviewed ids, preferred source
Task provider         pure compiler from exact source + bounded user intent
Task consumer         focused UI that prepares the existing atomic transaction
```

`document-briefing` reuses the same `awaiting-source → reviewing-source → configuring` session as `operating-review`. It accepts Markdown, Word, ODT, and PDF imports; scanned PDF may pause at the existing explicit OCR selection, then resumes the same session only after the generated Document passes import review. A compatible Document already in the workspace can start at `configuring`, with its current revision captured.

The provider is deterministic and pure. It reads one exact Document id, derives bounded readable sections, and prepares one collision-safe Deck Markdown creation. It cannot read React state, storage, network, or model credentials. The UI runs the result through complete workspace validation, runtime preflight, in-memory proposal preview, and the existing Apply boundary.

## Source relationship

Generated Deck frontmatter may include one optional `origin` id. For this task it is mandatory and names the exact Document used by the compiler. The dependency compiler derives a `deck-origin` edge from that readable declaration. A missing or non-Document origin is a workspace mutation error, so a broken relationship cannot be written.

`origin` is lineage, not automatic content synchronization. Editing the Document does not silently rewrite the Deck. Re-running or asking an Agent to update the presentation remains a visible reviewed task. This avoids an ambiguous second writer while still giving transaction review, navigation, and bounded Agent context a durable relationship.

## UI consequences

- Welcome and Empty Workspace offer two concrete outcomes rather than a generic AI prompt.
- The persistent activity rail can open Document-to-Presentation from an existing Document.
- Import review names the exact next step for either registered task.
- Task setup uses the same review overlay and field geometry in all nine locales, including Arabic RTL.
- The workbench remains assembly code; task validation and generation remain unit-testable without a browser.

## Deferred boundary

Rune still does not need a runtime plugin loader. At three independent tasks, we will evaluate a typed task UI registry that supplies entry metadata and a setup renderer. We will not move canonical workspace state, persistence, compilers, or Apply authority into that registry. Dynamic third-party loading remains out of scope until there is a real extension and trust model.

## Enforcement

- `tests/task-runtime.test.mjs` proves both tasks share exact lifecycle rules.
- `tests/document-briefing.test.mjs` proves deterministic generation, nine locale metadata, sanitization, collision handling, frozen-input zero-write failures, exact lineage, transaction review, and unresolved-origin refusal.
- `tests/task-architecture.test.mjs` prevents UI, storage, provider, and network dependencies from entering either pure task boundary.
