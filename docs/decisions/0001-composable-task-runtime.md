# ADR 0001: Static composable task runtime

- Status: accepted
- Date: 2026-08-14
- Scope: product tasks that coordinate existing Rune capabilities

## Context

Rune already has strict import, compiler, runtime-preflight, review, persistence, and export boundaries. The first operating-review experience nevertheless asks a person to operate those capabilities as separate tools: import a file, confirm it, find a task action, then choose the same source again. Implementing every future task by adding more component state to `RuneWorkbench` would make cancellation, stale revisions, continuation, and test coverage increasingly expensive.

[Cordis](https://github.com/cordiverse/cordis) models scoped contexts, declared services, lifecycle states, reversible effects, and a declarative entry tree. [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) applies those ideas at product scale: session events are durable facts, capability seams have explicit provider/consumer roles, UI areas are registered through typed slots, components receive narrow stores/actions, responsive columns are solved by a pure function, and repository scripts reject illegal dependency edges.

Rune needs the composability and auditability of these ideas, but not a general agent plugin platform. Our primary experience is a source-linked Office workspace, not a conversation/session shell.

## Decision

We introduce a pure, static task runtime with three layers:

```text
Task definition
  id · accepted file capability · accepted Artifact kinds · required source label
          ↓
Task session
  explicit phase · captured workspace revision · exact imported ids
          ↓
Workbench assembly
  picker · converter · reviewed transaction · focused task dialog
```

The task runtime may validate and return the next session; it cannot perform I/O or own React state. Existing capability owners remain authoritative:

- import adapters convert bytes into readable Artifacts;
- import review owns the proposed workspace and atomic confirmation;
- operating-review compiler owns field validation and generated relationships;
- mutation/runtime gates own downstream correctness;
- the workbench owns UI assembly and device persistence.

A continuation is granted only when the current workspace matches the captured revision, the exact review still validates, imported ids retain their order and identity, and the preferred Artifact retains an accepted kind. Failure returns no session and no write.

## UI consequences

- Empty and onboarding surfaces lead with a real outcome rather than an inventory of tools.
- Intermediate review says what will happen next and keeps the exact selected source visible.
- The next task surface opens only after the existing import confirmation succeeds.
- A compatible existing Artifact may enter `configuring` directly through the same registry and captured revision; this never bypasses the compiler or transaction review.
- Independent Import remains a separate action and always clears abandoned task context.
- Task transitions reuse the same mounted workbench and canonical state; they do not create a second workspace store.

These choices also follow Harness's useful interaction details without copying its appearance: retain context across panel changes, expose progressive states instead of generic loading, keep geometry/state solvers pure, and let components write only through declared actions.

## Rejected alternatives

### Add Cordis/Harness as a dependency now

Rejected. Both projects solve a much broader dynamic plugin/session problem, and Harness explicitly remains developer-preview software. Adopting their full runtime would increase package, lifecycle, migration, and UI-shell cost before Rune has enough distinct task implementations to justify it.

### Put the complete flow in one React component

Rejected. Revision and identity checks would become tied to modal mount order, hard to exercise without a browser, and easy to bypass when a second entry is added.

### Import first and infer the continuation afterward

Rejected. The task would be unable to prove that the imported Artifact came from its own reviewed source selection, and an incompatible import could change the workspace before the task refuses it.

## Enforcement

`tests/task-runtime.test.mjs` exercises every lifecycle transition, direct compatible-Artifact entry, and stale/mismatched failure. `tests/task-architecture.test.mjs` rejects React, persistence, browser, and network dependencies in the task runtime and verifies that the workbench consumes the declared file capability and exact preferred source continuation.

v0.83 adds `document-briefing` beside `operating-review` without duplicating the import lifecycle. Future command registries or dynamic UI slots may replace the static assembly only when at least three independent Rune tasks demonstrate repeated registration needs. Until then, static typed composition is the lower-cost architecture.
