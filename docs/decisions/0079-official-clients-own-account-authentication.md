# ADR 0079: Official clients own account authentication

- Status: accepted for private desktop testing
- Date: 2026-09-13

## Context

Orbit's first model setup treated every cloud model as an API connection. That duplicated configuration users had already completed in Codex, Claude Code, or Gemini CLI and exposed endpoint, model, and key concepts before a person could begin work. The product owner requires account sessions to be usable without copying tokens, while also preserving API keys, CC Switch, manual configuration, import, and local runtimes as equal valid paths.

## Decision

Orbit Desktop detects three bounded account runtimes: Codex signed in with ChatGPT, Claude Code signed in through first-party OAuth, and an installed Gemini CLI whose Google login is verified by the connection probe. Detection invokes only each client's status command where one exists. Orbit never parses its auth file, searches Keychain records, reads browser cookies, or receives an OAuth token.

After explicit review, Orbit imports a private loopback capability token derived from its existing Keychain-protected vault key. The ordinary encrypted profile stores that capability and a non-secret runtime name. Existing model-list, structured-output probe, routing, budget, schema, compiler, runtime-preflight, review, and Apply boundaries remain unchanged.

The stored profile does not treat an ephemeral loopback port as durable identity. On every desktop start, Orbit publishes its current validated `127.0.0.1` origin to the server runtime and rebinds account profiles to that port before model listing or generation. Provider identity and the private capability remain stable while stale ports are never contacted.

The loopback endpoint accepts only the capability token. It runs the official client without a shell, strips API keys and provider tokens from the child environment, bounds input/output and time, uses an empty temporary workspace, and disables tools and session persistence where the client supports it. Codex runs ephemerally with user configuration, rules, shell, browser, computer, apps, and hooks disabled. Claude Code runs in safe mode with an empty tool list and no session persistence. Gemini CLI runs headlessly in plan mode; the row stays unavailable when it is not installed, and a failed Google login never becomes a saved connection.

Production desktop discovery composes five connection families: official signed-in accounts, redacted known API/application configurations, read-only CC Switch entries, fixed Ollama/LM Studio loopback catalogs, and user-initiated manual API or configuration import. The UI groups account rows separately from configured API and local rows instead of replacing either group. Discovery never returns a secret; Orbit reads one credential only after the user reviews that exact candidate, verifies it, and then encrypts it in the existing vault.

## Consequences

- ChatGPT and Claude subscription access can power Orbit without an API key when their official clients are installed and signed in.
- Gemini follows the same bridge but cannot be claimed as locally proven until its CLI is installed and its own Google login succeeds.
- Orbit stores no provider OAuth credential and cannot silently refresh, export, or revoke an account session.
- Account calls can be slower than direct APIs because an official client starts for each bounded turn; connection state and errors must remain visible.
- Users can keep subscription-backed, API-backed, and device-local models together and switch among their saved redacted profiles.
- A future provider-native OAuth integration requires its own registered client, consent, revocation, and policy review rather than reusing another app's token.
