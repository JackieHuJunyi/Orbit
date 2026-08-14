# ADR 0025: Preview diagnostics separate facts, copy, and actions

## Status

Accepted — Rune v1.06.

## Context

Preview already counted source, metric, Query, and Chart failures, but the evidence disclosure did not render those facts or tell the user what to do next. Rendering raw compiler strings directly would couple product copy and localization to parser implementation details. Giving an error card an automatic repair path would instead grant presentation code model and mutation authority.

DeepSeek Harness demonstrates a useful narrower rule: stable facts and state transitions can remain pure while a shell executes explicit effects and a view only presents their projection. Rune needs that separation without adopting a session-first chat shell or a dynamic plugin runtime.

## Decision

`app/lib/artifact-diagnostics.ts` is the sole diagnostic preparation boundary. It accepts compiler-owned facts with an explicit category, classifies them into thirteen stable codes, preserves the original detail, deduplicates entries, and bounds the result to twelve items, 2,000 detail characters, and 200 reference characters. The returned list and entries are immutable.

The module is React-free and may not translate, render, read browser state, call providers, persist, create checkpoints, or mutate Artifact source. Parser, compiler, Query, Chart, and binding modules retain ownership of whether a fact is true.

The complete nine-locale interface catalog maps every stable code to a short title and repair direction. Exact compiler detail remains unchanged behind a native disclosure. The Workbench supplies one navigation effect: restore Split view when Source is hidden, focus the canonical textarea, and select and center the exact reference when it still exists, otherwise the first source line. This action creates no repair proposal and performs no write.

## Consequences

- Users receive an understandable next action without losing exact technical evidence.
- Parser wording may evolve without becoming the localization key or presentation hierarchy.
- Unusually large or repeated failures cannot make the popover unbounded.
- A future AI-assisted fix must still use the existing proposed-workspace, runtime-preflight, Review, checkpoint, and Apply boundaries.
- New diagnostic codes require catalog-shape coverage across all nine locales and focused classification tests.

## Rejected alternatives

- Show only an issue count: accurate but not actionable.
- Render raw compiler strings as primary copy: not localized and too tightly coupled.
- Let each component invent repair wording: duplicated, incomplete, and difficult to audit.
- Auto-run a model or mutate Source from the diagnostic card: violates review-before-write and capability ownership.
