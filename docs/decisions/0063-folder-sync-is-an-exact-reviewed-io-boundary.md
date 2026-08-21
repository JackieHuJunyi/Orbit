# ADR 0063: Folder sync is an exact reviewed I/O boundary

## Status

Accepted for Rune v1.47.

## Context

Connected-folder Pull, Push, and empty-folder initialization used three native `window.confirm` prompts. The prompts were English-only, described only aggregate intent, did not list exact file or image outcomes, and were not bound to the folder revision they described. A folder or the device workspace could change after the initial read and before the confirmed operation. Pull kept per-file checkpoints but did not preserve the complete pre-pull selection, task recipes, and evidence as one recoverable state.

The browser File System Access API also provides individual writable file handles, not a multi-file compare-and-swap transaction. Rune therefore needs to distinguish what it can guarantee before opening I/O from what the operating system cannot make atomic after a multi-file write starts.

## Decision

1. Pull, Push, and initialization share one deferred `DirectorySyncReviewDialog`. It receives an immutable plan plus callbacks, focuses Cancel first, supports Escape/focus trapping through `ReviewDialog`, and imports no filesystem, persistence, asset-store, or browser authority.
2. React-free `directory-sync.ts` validates operation direction, both canonical workspaces, case/Unicode-normalized filename collisions, and content-hash image facts. It returns explicit source/image add, update, remove, retain, and unchanged outcomes plus exact before/after counts.
3. Every plan binds four authorities: the complete serialized device state, exact ordered Artifact sources, referenced local-image facts, and the exact `DirectoryReadResult` including its manifest/scan/empty mode and errors.
4. Confirmation rereads the complete device state, current referenced image assets, and folder. It compares exact snapshots, prepares the plan again, and opens the Workbench-owned application capability only when the rebuilt identity matches the reviewed identity.
5. Cancel, Escape, invalid input, device drift, folder drift, a changed operation direction, missing local images, or preparation failure opens no folder or source write.
6. Pull validates that the complete pre-pull device snapshot fits the existing 12 MB recovery bound. Its single device persistence write stores the pulled workspace and the complete pre-pull state as `resetRecovery`; React advances only after persistence succeeds. Newly imported image bytes are compensated if device persistence fails.
7. Push and initialization use the already validated current Artifact and asset values supplied by the commit service. The existing directory writer verifies image hashes, writes referenced assets and sources, and writes `rune.workspace.json` last. Folder-only files remain untouched and are visibly marked as retained outside the new manifest.
8. Rune does not label browser folder writes atomic. Exact reread prevents known stale plans from starting I/O, but another process can still modify files after that reread, and permission or storage failure can interrupt sequential writes. The manifest-last order and stopped-file error are the available browser boundary; stronger atomicity requires a future desktop filesystem transaction or repository protocol.
9. English, Simplified Chinese, Traditional Chinese, French, Spanish, Russian, Arabic RTL, Japanese, and Korean use the same review geometry. Critical non-Chinese safety and action copy is human-reviewed.
10. The dialog and planner remain typed on-demand entries. `RuneWorkbench` remains the sole owner of handles, local assets, persistence, React state, delivery evidence, and all I/O capabilities.

## Consequences

- Users can see the exact direction and bounded outcomes before connected-folder I/O begins.
- A review is an expiring capability: any device or folder drift requires a new review.
- Pull becomes recoverable as one complete device workspace, not only as scattered source checkpoints.
- Folder-only files and images are retained physically but intentionally excluded from the next Rune manifest after Push.
- A successful browser folder write is deterministic and manifest-last, but it is not an OS-level multi-file atomic transaction. Product copy and documentation must preserve that distinction.
- Unit tests own planning, collision, frozen-input, drift, and failure boundaries; render tests own lazy/presentation authority and responsive RTL geometry; Chromium owns initialization, Cancel, Pull recovery, external drift rejection, and reviewed Push.
