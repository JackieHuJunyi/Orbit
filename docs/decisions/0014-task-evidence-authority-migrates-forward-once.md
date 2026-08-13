# ADR 0014: Task evidence authority migrates forward once

- Status: accepted
- Date: 2026-08-14

## Context

Rune v0.95 introduced a task-neutral device evidence ledger, but Document to Presentation was its only writer. Operating Review still appended applied/stopped runs and handoff judgments inside each saved workflow. Keeping both paths would make every task consumer choose an evidence schema, preserve two delivery validators, and eventually encourage a third task to copy whichever path was easiest.

The old Operating Review records cannot be converted into exact-revision evidence. They predate source and output revision fields, so assigning today's revisions to an earlier run would manufacture proof that Rune never recorded.

## Decision

`RuneTaskEvidence` advances from storage version 1 to version 2. Loading a valid version-1 ledger preserves and normalizes its existing exact runs and deliveries, then returns version 2. All new Operating Review and Document-to-Presentation runs use this ledger. A successful Apply persists the workspace, checkpoints, saved task recipe, and exact task run together; validation, runtime, stale, persistence, and review-cancellation stops use the same bounded stopped-run path. Saved Operating Review objects remain recipe owners only.

Operating Review's former per-workflow runs and delivery outcomes remain readable under a collapsed “Earlier device records” disclosure. Production code no longer appends or confirms against them. They do not contribute to the current applied rate or delivery usability rate, because their schema cannot prove exact source and output revisions.

A handoff judgment now requires the applied run's current source revision and every output revision to match—not only the exported Document or Deck. This matters for Operating Review because Query and Chart outputs can change the rendered deliverable without changing its Markdown source. Missing, changed, foreign, or stopped outputs fail closed. The shared ledger remains bounded, content-free, device-local, and subordinate to the existing mutation authority.

## Consequences

- Both focused tasks have one current run, token, timing, stop, identity, and delivery contract.
- A future task consumes one evidence port instead of choosing or copying a task-specific schema.
- Older evidence is preserved honestly without being upgraded into stronger proof or kept as a second writer.
- Users must rerun an older Operating Review once before Rune can request a new exact delivery judgment.
- Changing any generated Query, Chart, report, or presentation invalidates that run's delivery eligibility until the complete task is reviewed and applied again.
- This migration changes evidence authority, not source authority: no task evidence can create, patch, Apply, export, or publish an Artifact.
