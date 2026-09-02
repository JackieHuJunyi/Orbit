# ADR 0074: Desktop model readiness is end to end

- Status: accepted
- Date: 2026-09-02

## Context

Orbit's first desktop release after the public rename retained the former `Rune` user-data directory but changed Electron's application identity before opening the encrypted credential-vault master key. On macOS, Electron `safeStorage` obtains application-scoped encryption material from Keychain. The existing master-key file therefore remained present but could no longer be decrypted under the new bootstrap identity; the model API correctly failed closed with `vaultAvailable: false` before contacting a provider.

The setup flow also treated one successful model-catalog request as sufficient proof that a connection could power the Agent. That checks endpoint reachability and authentication, not the structured-output protocol Orbit needs. DeepSeek V4 enables thinking by default, while its Anthropic-compatible endpoint rejects Orbit's forced named `tool_choice` in that mode. The catalog could succeed even though the first real plan failed with HTTP 400.

## Decision

The desktop process retains `Rune` only as a pre-window safe-storage compatibility identity. After `app.whenReady()`, it decrypts or creates the existing master key under that identity, immediately changes the public application name to `Orbit`, installs the Orbit Dock icon, and only then creates a window. The user-data directory, credential file, cookie AAD, IPC channels, and environment variables remain unchanged. No key or credential is copied, logged, exposed to React, or silently discarded.

First-run discovered-connection setup now has three ordered gates:

1. import exactly the user-selected credential from the desktop bridge;
2. authenticate and obtain a non-empty provider model catalog;
3. request one minimal `{ ready: true }` structured response through the selected protocol.

Only after all three succeed does Orbit encrypt, save, and activate the profile. The probe contains no Artifact, filename, prompt, workspace text, or user data.

For DeepSeek over the Anthropic-compatible endpoint, Orbit sends `thinking: { type: "disabled" }` on its single forced typed-tool planning request. This retains one deterministic tool payload and the existing Zod compiler/safety gates while avoiding the provider's unsupported thinking-plus-forced-tool combination. Other Anthropic-compatible providers keep their existing request unchanged.

## Consequences

- A rename cannot turn an existing on-device master key into a permanently unavailable vault.
- “Verify & use” means the connection can perform Orbit's required protocol, not merely list models.
- DeepSeek V4 Flash and Pro can produce reviewable typed plans through a CC Switch Anthropic connection.
- The readiness probe incurs one deliberately small provider request after the user explicitly confirms the connection.
- Provider output remains untrusted and cannot write source until the existing local compiler, validation, review, and Apply sequence succeeds.
