# ADR 0075: Agent composition is free-text first

- Status: accepted
- Date: 2026-09-02

## Context

The Workbench already mounted a controlled textarea, but it presented suggested actions before the one-line borderless field and labeled the surrounding surface as a change planner. People reasonably perceived the Agent as a fixed-choice panel rather than a place to express their own intent. Model selection lived in a separate settings surface, so comparing a fast model with a stronger model interrupted the task and obscured which connection would receive the next request.

## Decision

Free text is the first element in the expanded Agent composer. It has a visible localized label, begins at two lines, grows to a bounded height, accepts at most 2,000 characters, and remains editable while a model prepares the submitted instruction. Enter submits the current instruction, Shift+Enter inserts a newline, and IME composition never submits. Completion clears only the exact draft that was submitted; text entered while the model is working remains as the next draft. Suggested actions remain available only through a secondary disclosure and continue to use the same reviewed planning path.

The current draft is stored device-locally under the compatibility key `rune-agent-draft-v1` after a short debounce. A successful accepted plan clears it; an unfinished draft survives reload. It is never added to the workspace, evidence ledger, URL, exported file, or background telemetry.

The composer footer owns one native model picker populated from `GET /api/model-profiles`. Options contain only redacted profile name and model ID. A selection activates one existing personal profile, the deployment connection, or deterministic local tools through the existing model-profile route. The picker never receives, reads, or displays an API key. Model switching participates in the single Workbench operation gate, so it cannot race another review or write.

## Consequences

- Presets help people start but no longer define what they are allowed to ask.
- The next model is visible and switchable at the point of intent.
- Draft text survives accidental reload without becoming workspace content.
- A slow model response cannot erase a follow-up typed while it was working.
- Source changes remain proposals: free-form language does not bypass typed operations, compiler validation, review, or explicit Apply.
- All nine interface locales translate the field and model-picker labels while provider and model identifiers remain unchanged.
