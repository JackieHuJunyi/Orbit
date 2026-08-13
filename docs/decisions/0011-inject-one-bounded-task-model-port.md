# ADR 0011: Inject one bounded task-model port

## Status

Accepted — Rune v0.93.

## Context

Operating Review and Document-to-Presentation each had a narrow server route and pure compiler, but the React workbench still duplicated their client orchestration: exact source lookup, model-mode checks, source-size ceilings, fetch construction, JSON parsing, evidence recomputation, dynamic output validation, provider labels, usage normalization, and fallback. A third task would have copied the same state machine again inside an already large assembly component.

A broad plugin host would remove some switch statements but would also introduce runtime registration, ordering, replacement, and lifecycle behavior that two product tasks do not need. Directly importing provider credentials or mutation APIs into a shared client would make the abstraction smaller on paper while widening its authority.

## Decision

Rune uses one static discriminated client port, `task-model-planning.ts`. The workbench supplies the network function explicitly. Each task branch declares its exact source identity/kind, input, source ceiling, same-origin route, evidence compiler, and output validator.

The port reads at most 128 KB from a successful response stream and treats provider names, model labels, and token counts as untrusted bounded metadata. It returns either a validated task-specific narrative/outline with planner metadata or one of three deterministic outcomes: local mode, source too large, or unavailable. It never returns canonical source, patches, creations, target identities, or write instructions.

The module may import task evidence and validation contracts. It may not import React, credential storage, browser persistence, workspace mutation, checkpoints, filesystem adapters, or Apply handlers. Server routes retain credential and provider-protocol ownership; pure task compilers retain file authorship; the transaction pipeline retains write authority.

## Consequences

- Adding a third model-assisted task extends one typed union and one tested branch instead of copying a React request state machine.
- Local-only mode can be proven to make zero network calls because the network capability is injected and observable in tests.
- Client responses now have an explicit byte ceiling in addition to the server/provider ceilings.
- Server, client port, and pure compiler still independently validate dynamic evidence bindings.
- Static composition remains deliberate; Rune can add a runtime plugin host only after multiple independently shipped tasks prove registration or third-party replacement is required.
