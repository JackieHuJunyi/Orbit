# ADR 0062: Workspace reset is a recoverable device swap

## Status

Accepted for Rune v1.46.

## Context

Rune's Activity rail exposed “Reset sample workspace” as a high-frequency icon. After a native `window.confirm`, it replaced React state and removed the complete persisted workspace. The user could lose canonical files, selection, source checkpoints, saved operating-review recipes, and task evidence with no product-level review or recovery route. The state change also depended on separate in-memory updates and storage deletion rather than one explicit commit.

That behavior contradicted Rune's review-before-write, zero-partial-write, and recoverability contracts. A sample is useful for learning and repair, but opening it must not make the user's current workspace disposable.

## Decision

1. Sample restore moves from the Activity rail to the low-frequency More Tools menu. After a recoverable switch exists, the same menu exposes Previous Workspace.
2. `workspace-reset.ts` is a React-free planner and application service. It accepts complete current and target device states containing Artifacts, selection, checkpoints, saved task recipes, and task evidence; rejects malformed, duplicate, unchanged, or over-12-MB snapshots; and captures exact serialized identities plus bounded review facts.
3. One deferred `WorkspaceResetDialog` compares current and target facts, lists at most eight target filenames, focuses Cancel first, and explains both recovery and connected-folder boundaries. It has no persistence or mutation capability. Critical copy exists in all nine interface locales.
4. Confirmation rereads the authoritative current and target states, compares both exact snapshots with the reviewed plan, and prepares the transition again. The dialog's strings and object references are not write authority.
5. One write to `rune-workspace-v0` persists the complete target state and the complete current state as nested `resetRecovery`. Artifacts, selection, checkpoints, saved recipes, task evidence, and recovery React state advance only after that write succeeds.
6. Restoring Previous Workspace uses the same planner and commit path, swapping current and recovery. The restoration is therefore reversible and the opposite side remains available after reload.
7. Connected folders are not part of the device snapshot and remain unchanged. Folder files can change only through the existing explicit Push action.
8. Cancel, Escape, stale current state, missing or changed target state, invalid/oversized snapshots, and persistence failure perform zero writes and leave caller state unchanged.
9. The planner, dialog, and complete Settings implementation remain on-demand entries. The small Activity-rail trigger stays eager; Settings mounts only while open.

## Consequences

- Opening the sample no longer destroys the user's last complete device workspace.
- Recovery protects the device-local working state, not connected folders, cloud history, Git, or collaboration state.
- Rune retains one complete opposing snapshot rather than an unbounded whole-workspace history; each swap replaces it with the state just left.
- The 12 MB bound excludes IndexedDB image bytes, which retain their content-hash lifecycle independently. Snapshot source references remain unchanged.
- Unit tests own normalization, exact identity, limits, stale/target/persistence failures, and input preservation; render tests own lazy and presentation authority; real Chromium owns Cancel, sample Confirm, reload, previous Confirm, and second reload.
