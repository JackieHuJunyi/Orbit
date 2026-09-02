# ADR 0070: Desktop model discovery is redacted and explicit

- Status: Accepted
- Date: 2026-09-02
- Release: Rune v1.53

## Context

First-run model setup previously presented a saved/deployment status beside “connected” and “local” choices. That language collapsed three different capabilities into two vague modes: a cloud API, a model actually running on the device, and Rune's deterministic on-device parsing/conversion tools with no model. The web UI also could not truthfully claim to inspect model settings owned by other applications.

A desktop scan creates a second problem: returning every discovered profile to React would expose credentials before the user has chosen a connection. Broad shell-profile execution, Keychain enumeration, or arbitrary filesystem search would also trigger unnecessary permissions and create an unbounded trust surface.

## Decision

Rune uses a narrow Electron discovery capability with a two-step disclosure boundary:

1. `discoverModels()` returns at most 32 sanitized candidates. A candidate contains provider, source label, endpoint, model id, locality, and whether a credential exists; it never contains a key or credential value.
2. `importDiscoveredModel(id)` reads one private candidate only after the user selects **Review** and then confirms **Verify & use**. The renderer validates both bridge responses independently.
3. Rune verifies the selected model catalog before persistence. Only a successful verification is encrypted into the existing HttpOnly model vault and made active; cancellation or any error saves nothing.

Discovery is intentionally bounded to known, data-only sources: the process environment; Claude Code, Codex, and Gemini configuration files; the CC Switch provider database opened read-only with `query_only`; and the loopback Ollama and LM Studio model catalogs. Configuration files are capped at 256 KB, local probes abort after 650 ms, catalog/candidate counts are bounded, and shell files are never executed. Codex OAuth tokens and unrelated Keychain records are not discovery inputs.

Ollama and LM Studio use fixed loopback endpoints and are accepted only when `RUNE_DESKTOP_RUNTIME=1`. The web API rejects saving, activating, or routing these profiles. Their OpenAI-compatible requests omit `Authorization` when no key is required. Public custom endpoints retain the existing HTTPS/public-DNS SSRF boundary.

The product vocabulary is now explicit:

- **Model assistance** uses the selected cloud API or device model. Every proposed change still requires Rune's review boundary.
- **Runs on this device** describes an actual Ollama or LM Studio runtime.
- **Continue without a model** uses parsing, conversion, DuckDB, OCR, compilers, and other deterministic device tools and sends nothing to a model service.

The setup surface uses one responsive type and spacing hierarchy. All security and choice copy is human-reviewed in the nine supported interfaces; compact controls are at least 44 px, Arabic retains RTL order, and long Japanese/Korean labels cannot force the header into vertical text.

## Consequences

- Adding another discovery source requires one bounded data reader that returns the same private candidate shape; it does not change React, model routing, vault encryption, or provider planning.
- The renderer never receives an inventory of secret values and cannot request an arbitrary path or key name.
- Desktop users can reuse known configurations without copying a key, while web users receive an honest manual-setup explanation.
- Rune does not promise exhaustive system-wide discovery. Sources that need new permissions, OAuth semantics, or OS credential access require a separate decision and explicit user authorization.

## Rejected alternatives

**Return discovered profiles with keys in the first scan.** Rejected because rendering convenience is not authorization to disclose every credential.

**Execute `.zshrc`, `.bashrc`, or provider commands.** Rejected because configuration discovery must parse bounded data, not run user code.

**Call deterministic device tools “local model mode.”** Rejected because it falsely implies that a local language model is running.

**Allow loopback model profiles in the hosted app.** Rejected because server-side fetches would not refer to the user's device and would weaken the endpoint boundary.
