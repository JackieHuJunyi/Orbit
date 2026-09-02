# ADR 0071: DeepSeek is explicit and setup navigation is spatial

- Status: Accepted
- Date: 2026-09-02
- Release: Rune v1.54

## Context

Rune v1.53 could read a DeepSeek credential already used by Claude Code or CC Switch, but it classified the service as a generic custom endpoint. The setup surface therefore failed the user's mental model: a valid local DeepSeek configuration appeared not to have been found, even though a compatible client record was present. The same page placed Back in the upper-right chrome beside Skip or Close while the forward choices lived below the content. That split navigation hierarchy made a simple setup step feel like two unrelated control systems.

DeepSeek exposes compatible OpenAI and Anthropic transports under the same service identity. Treating transport compatibility as provider identity would continue to mislabel the connection and would construct the wrong model-catalog URL for an Anthropic-compatible `/anthropic` generation prefix.

## Decision

DeepSeek is a first-class `ModelProviderKind`. Direct `DEEPSEEK_API_KEY`, `DEEPSEEK_AUTH_TOKEN`, `DEEPSEEK_BASE_URL`, and `DEEPSEEK_MODEL` settings resolve to that provider. A known Claude, Codex, or CC Switch record whose validated hostname is exactly `api.deepseek.com` also resolves to DeepSeek while retaining the compatible transport declared by that client. Provider identity and wire protocol are separate facts.

Model-list verification for any DeepSeek profile targets the service origin's canonical `/models` resource and uses Bearer authentication, even when generation uses Anthropic Messages under `/anthropic`. Generation continues through the selected protocol adapter. The desktop scan collapses candidates only when provider, protocol, endpoint, model, and credential bytes are equal; source ordering prefers the current read-only CC Switch record over a duplicate app setting. The sanitized scan still exposes no credential. Explicit review, private import, verification, and encrypted persistence remain separate steps.

The web build continues to say that it cannot inspect other applications. It does not imitate discovery by asking a server to scan the user's machine, nor does the renderer gain arbitrary filesystem access.

Setup navigation now follows one spatial rule: escape actions remain in the upper chrome, while Back and forward decisions share one bottom action row. The Back label remains visible on compact screens, every control retains at least a 44 px target, and RTL flips directional icons without changing semantic order. The shared row aligns its controls to one bottom baseline across variable-height model choices and all nine interface languages.

## Consequences

- Users see one explicit DeepSeek connection instead of a generic or duplicate result.
- Adding another compatible transport does not require inventing another provider identity.
- A service-specific catalog rule stays inside the provider adapter rather than leaking into React or desktop discovery.
- The renderer still cannot enumerate credentials, request arbitrary configuration paths, or save an unverified profile.
- Back is no longer visually grouped with Skip or Close, and setup steps reuse one responsive navigation geometry.

## Rejected alternatives

**Keep DeepSeek as Custom.** Rejected because a technically routable connection is not a usable discovery result when its service identity is hidden.

**Classify by client app.** Rejected because Claude and Codex are compatible clients in this case, not the service receiving data.

**Append `/models` to every generation base URL.** Rejected because `https://api.deepseek.com/anthropic/models` is not the canonical catalog resource.

**Scan shell profiles or the whole home directory.** Rejected because more apparent coverage would execute user code or broaden filesystem access beyond the explicit discovery contract.

**Leave Back in the global chrome.** Rejected because it mixes step navigation with dismissal and separates it from the decision it reverses.
