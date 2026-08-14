# ADR 0008: Models choose bounded evidence questions; Rune owns live numbers

- Status: Accepted
- Date: 2026-08-14

## Context

Rune's operating-review task already compiled an exact Data → Query → Chart → Document/Presentation transaction, but its review prompts were deterministic templates. Giving a model the complete report or Deck would improve phrasing at the cost of a second file author, copied values that become stale, and an unnecessarily broad source/persistence capability.

DeepSeek Harness provides a useful architectural comparison. Its published architecture treats model adapters, tools, session facts, and UI contributions as replaceable capability seams; its Web UI renders from stable snapshots, keeps panel subtrees mounted through geometry changes, and coalesces non-essential visual alignment with animation frames. Rune should adopt those boundary and interaction principles where they reduce iteration cost, without importing a dynamic plugin tree, append-only agent session runtime, or chat-first product shell that Rune does not yet need.

## Decision

The operating-review model surface is a narrow question-planning capability, not a source-generation capability.

1. Rune parses the selected exact Data artifact and deterministically derives at most twenty aggregate evidence rows in the same order as the generated Query.
2. The active explicit provider receives the task intent, selected field identities, and those bounded aggregate rows. It does not receive the complete workspace or any credential in model input.
3. The provider may return at most two qualitative prompts. Each prompt must select one unique request-local `result-N` row and may select one different comparison row. It cannot return category labels, digits, currencies, percentages, dates, Markdown, HTML, binding syntax, artifact identity, source, patches, creations, or a write instruction.
4. Rune validates the dynamic result-id set and qualitative text after provider output, again in the browser against the captured workspace, and again in the pure operating-review compiler.
5. Rune—not the model—converts each selected result into a live four-argument Query metric binding:

   ```text
   {{ metric("query-id", "column", "currency", "0") }}
   ```

   The optional quoted fourth argument is a zero-based result-row index from 0 through 499. Three-argument scalar bindings retain their existing exact-one-row behavior.

6. A row-specific binding still requires one exact Query, one exact output column, a current non-truncated snapshot, an existing result row, and one finite numeric value. Pending, stale, missing, ambiguous, truncated, or nonnumeric results fail closed.
7. Report and presentation identity, SQL, Chart JSON, live bindings, complete source, collision handling, runtime preflight, candidate preview, checkpoint, persistence, and Apply remain Rune-owned.
8. A saved operating-review rerun rewrites generated temporary Query/Chart references back to the saved exact identities before validation. It never creates duplicate outputs merely because model assistance is enabled.
9. Local-only, unconfigured, unavailable, invalid, or oversized model paths retain the deterministic compiler and disclose the actual planner in compact task status. Every locale receives the same planner/fallback contract.

## Architecture consequence

Rune now has three explicit task layers:

- task definition/session: accepted inputs and short-lived lifecycle facts;
- optional bounded model contract: advisory structured judgment with no write capability;
- pure task compiler: complete Rune-owned canonical mutation proposal.

This is the static equivalent of a capability seam and keeps the next task cheap to add. A dynamic plugin/slot runtime remains deferred until at least three real tasks require runtime registration, third-party replacement, or independently unloadable UI contributions. React continues to assemble capabilities, not define source authority.

## Interaction consequence

Task setup names the active planner before execution, preparation uses one compact live status instead of a blocking stream of internal steps, and the review card names whether a model narrative or deterministic planner actually produced the candidate. Source and preview stay mounted under the existing focus modes, so task status changes do not reset editor/preview identity. Motion remains presentational and respects reduced-motion preferences.

## Consequences

- Model judgment can improve which operating questions are asked without creating stale copied metrics.
- Changing Data or rerunning the Query updates the bound numbers everywhere the candidate compiles.
- Provider failure does not remove the business workflow.
- The model cannot name categories in its prose, so Rune intentionally favors durable generic questions over polished but stale assertions.
- Multi-row scalar access becomes a reusable compiler feature, but only through an explicit row index and the same current-snapshot safety gate.
- The operating-review route and model contract add one task-specific seam; provider transports remain shared.

## References

- [DeepSeek Harness architecture](https://github.com/deepseek-ai/deepseek-harness/blob/master/docs/architecture.md)
- [DeepSeek Harness Web UI layout package](https://github.com/deepseek-ai/deepseek-harness/tree/master/packages/client/ui-layout)
- [DeepSeek Harness conversation UI package](https://github.com/deepseek-ai/deepseek-harness/tree/master/packages/client/ui-conversation)
