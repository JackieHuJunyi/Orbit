# ADR 0061: Checkpoint restore is a reviewed atomic write

## Status

Accepted for Rune v1.45.

## Context

Rune persisted bounded per-Artifact checkpoints and made Agent, visual, import, and task changes reviewable before writing. Checkpoint Restore and Undo were an exception: selecting a historical source immediately appended a safety checkpoint in React state and called the ordinary source editor update. The restored source and safety history reached localStorage only through a later debounced save.

That path exposed no exact diff, did not validate the complete proposed workspace or affected Query runtime, and could leave the safety history and restored source outside one explicit persistence boundary. A recovery capability must not have weaker guarantees than the write it is intended to recover.

## Decision

1. `checkpoint-restore.ts` is a React-free planner. It resolves one exact checkpoint to one Artifact, rejects unknown, unchanged, oversized, or invalid restoration, runs the normal complete-workspace static validator, captures the complete source revision, and returns a bounded exact line diff.
2. Restore and Undo both call that same planner and open one deferred `CheckpointRestoreDialog`. The shared modal boundary focuses Cancel first, traps focus, supports Escape, and performs no mutation or persistence.
3. Confirmation rechecks the captured workspace revision, re-resolves the exact checkpoint id and source bytes from current bounded history, and prepares the plan again. Reviewed strings are never trusted as write authority.
4. Data, Query, or Chart restores cross the existing browser-local runtime impact preflight before confirmation can write. A second complete revision check follows asynchronous verification.
5. Rune appends the current source as a restore-safety checkpoint and writes the next checkpoint map plus restored workspace in one `persistDeviceWorkspace` call. React state advances only after persistence succeeds.
6. Cancel, Escape, missing or changed history, stale workspace, static/runtime validation failure, and persistence failure keep both canonical sources and checkpoint state unchanged.
7. Planner and dialog remain dynamic entries so first run and ordinary editing do not pay for the low-frequency recovery surface. Copy is complete across all nine interface locales, with human-curated non-Chinese critical-flow text.

## Consequences

- Device history now follows Rune's review-before-write and zero-partial-write promise instead of bypassing it.
- Undo is deliberately reviewable; it is no longer an immediate hidden mutation.
- Restoring an old Data or Query cannot silently invalidate a current Chart, metric, report, or presentation.
- The bounded checkpoint store remains device-local and is not promoted into Git, collaboration, or cloud history.
- Unit tests own planner failures and immutability; render tests own lazy/presentation authority; real Chromium owns Cancel, Confirm, safety checkpoint, and reload persistence.
