# ADR 0029: Folder observation never bypasses reviewed Pull

- Status: accepted
- Date: 2026-08-19
- Scope: Connected user-owned workspace folders

## Context

Rune already reads and writes a user-authorized folder through explicit, validated Pull and confirmed Push. A connected folder could change outside Rune, but the workbench learned about that only when the user manually opened Pull. Automatically applying filesystem events would make an operating-system notification a new canonical writer and would bypass current manifest, asset, dependency, checkpoint, and confirmation boundaries.

`FileSystemObserver` provides recursive change notifications in runtimes that expose it, but it is not universally available. A product contract cannot depend on that API silently existing.

## Decision

After the user explicitly grants a session-scoped File System Access directory handle, Rune starts one observation capability tied to that handle and component lifecycle. If `FileSystemObserver` exists, Rune observes recursively. Otherwise it polls every three seconds and compares a deterministic metadata fingerprint containing only the name, byte size, and available last-modified time of supported Rune source files and `.rune-assets` entries. The fingerprint is sorted, contains at most 128 entries, and never reads source or binary content.

Any non-empty native notification or changed polling fingerprint sets the directory state to `changed` and tells the user to review with Pull. The callback cannot invoke Pull, Push, provider calls, checkpoints, persistence, or workspace mutation. Pull remains the only external-to-device transition: it rereads bounded content, validates the manifest, assets, kinds, dependencies, and complete workspace, asks for confirmation, checkpoints current files, and then performs one device write.

An errored native record, rejected observer registration, revoked permission, or polling failure becomes a visible connection error. Switching handles or unmounting disconnects the native observer or clears the polling interval. Confirmed Rune Pushes mute change presentation for five seconds; polling still advances its baseline, so Rune's own writes are not presented as an external conflict.

The handle, absolute path, fingerprints, and events remain session-only and are not persisted in source, `rune.workspace.json`, local storage, task evidence, logs, or Git.

## Consequences

- Recurring folder users learn about external edits without polling manually.
- No filesystem event can overwrite a device draft or grant write authority.
- Runtimes without the native observer still receive bounded best-effort detection.
- Same-size edits require a usable `lastModified` value when native observation is unavailable; Pull remains available at all times as the authoritative check.
- Persistent directory permissions, background operation after Rune closes, atomic multi-file rename, and Git commits remain outside this browser-owned storage port.
