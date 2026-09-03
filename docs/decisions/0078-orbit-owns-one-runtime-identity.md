# ADR 0078: Orbit owns one runtime identity

- Status: accepted; supersedes the compatibility decision in ADR 0072 and the desktop bootstrap portion of ADR 0074
- Date: 2026-09-03

## Context

The public rename previously preserved the former pre-release namespaces so existing local data would continue to work. On macOS this required the desktop process to start under the former application name before reading its `safeStorage` master key. The resulting Keychain prompt exposed the abandoned product identity, and ad-hoc QA signatures could cause macOS to ask again after a rebuild.

Private testing has not begun, so preserving that compatibility now costs more product clarity than a clean reset. The product owner explicitly chose one Orbit identity and accepted configuring model connections again.

## Decision

Orbit uses one namespace across its desktop profile, Keychain access, encrypted model-vault environment, model-runtime flag, preload bridge and IPC channels, browser persistence, IndexedDB, local asset protocol and folder, CSS design tokens, exported symbols, core Workbench component, fixtures, and generated QA artifacts.

The desktop process sets `Orbit` before any `safeStorage` call and uses `~/Library/Application Support/Orbit`. It never reads, decrypts, copies, migrates, renames, or deletes the former profile or Keychain material. A tester therefore starts with a clean Orbit profile and adds a model connection once. Old data remains available for manual recovery until the owner deliberately removes it.

Local packages are internal evidence, not distributable releases. Their ZIP and DMG filenames and mounted volume say `internal-qa`, and their manifest says `distributionReady: false`. Only the fail-closed Developer ID, hardened-runtime, notarization, stapling, Gatekeeper, and version-matched tag path may produce a release-channel artifact.

## Consequences

- macOS can only present `Orbit Safe Storage` for current credentials; Orbit never triggers the former Keychain entry.
- Pre-release onboarding, workspace, model profiles, appearance, Agent thread, linked folders, and local assets do not migrate automatically.
- A valid, consistent Developer ID signature is still required to prevent Keychain re-prompts across distributed updates and to avoid Gatekeeper's unsigned-app path.
- Historical release notes and ADRs retain the former name as facts; they are not runtime compatibility contracts.
