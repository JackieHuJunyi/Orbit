# ADR 0080: Discovery and slow work remain evidence-led and interruptible

- Status: accepted for private desktop testing
- Date: 2026-09-13
- Release: Orbit v1.61

## Context

Fixed provider rows implied that an unavailable service was a usable connection, while scanning only the Electron process missed API keys stored as literal exports in ordinary shell profiles. Ready account connections also repeated a complete structured generation after their official client had already reported a valid login. The same one-shot account CLI can take materially longer than a direct API, and large canonical documents made file selection wait behind Markdown and line-number rendering.

## Decision

Desktop discovery owns one explicit registry of provider environment names, compatible protocol, public base URL, and fallback model. It reads only bounded known files and literal environment assignments, never executes a shell, expands a command substitution, reads browser cookies, or returns a secret to React. Account clients are checked even when unavailable, but the public result contains only installed clients; API and local candidates appear only when a credential or live model catalog was actually found. Consumer applications such as Qwen, Yuanbao, or Doubao are not treated as callable merely because their app bundle exists; Orbit accepts their documented developer API path when configured.

Codex and Claude status commands authorize saving a ready account without a second generation. Gemini still uses the existing bounded response probe because its CLI exposes no stable read-only auth status. One shared account catalog maps a public choice id to an exact CLI model and effort argument. Switching that choice updates only the encrypted stored profile and preserves its private loopback capability.

Agent requests expose staged elapsed feedback and a Stop action. Browser cancellation propagates through the Agent route and provider fetch into the account-runtime process, which kills only the request it owns. CLI startup and provider inference latency remain visible rather than being represented as local UI work.

Workbench selection uses a deferred content id so the file row can acknowledge the click before expensive compilation. Artifact reference counts and grouping are memoized. Sources above the large-document threshold omit the decorative line-number DOM and compile a bounded quick-preview prefix; the complete canonical source remains editable and persisted without truncation.

## Consequences

- The model page stays compact and truthful as the provider registry grows.
- Installed consumer apps without a supported callable interface never become misleading Connect buttons.
- Direct API or local runtimes remain the low-latency choice; account-backed CLIs remain usable, measurable, and stoppable.
- Account users can trade latency for reasoning depth inside the message composer without reconnecting.
- Large sources preserve correctness while preview density adapts to keep navigation responsive.

## Verification

- Discovery tests cover literal shell parsing, command-substitution refusal, redaction, found-only accounts, nineteen unique provider records, CC Switch, and local catalogs.
- Account-runtime and profile-route tests cover exact model/effort arguments, legacy-profile migration, capability preservation, and invalid choice refusal.
- Chromium tests cover fast account connection, account model switching, Agent cancellation, and a 500 ms large-file selection-acknowledgement ceiling with no large line-number tree.
