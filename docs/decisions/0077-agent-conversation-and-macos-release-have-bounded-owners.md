# ADR 0077: Agent conversation and macOS release have bounded owners

Date: 2026-09-03

Status: Accepted

## Context

Orbit v1.57 could accept free text and prepare a safe source mutation, but every model turn had to become a patch. Follow-up questions had no durable context, the Workbench owned provider transport and evidence negotiation inline, and the Electron shell could run only from the repository. The same audit found real Word AppleScript failures, WebKit lifecycle/focus instability, and dependency gates that ignored moderate production issues and vulnerable build tooling.

## Decision

1. An Agent turn is either `answer` or `change`. An answer has one bounded message and no edits/actions. A change has a conversational message and the existing typed operation plan. Mixed turns fail server validation, and the only automatic runtime repair attempt must remain a change.
2. The device thread retains at most sixteen messages and twenty thousand characters. Only the last twelve normalized `user`/`assistant` role-content pairs enter a provider request. Message ids, timestamps, model labels, credentials, source, evidence, and storage metadata never enter model conversation context. The thread stays outside Artifacts, exports, task evidence, folders, and Git, and has one visible Clear action.
3. `agent-conversation.ts`, `use-agent-conversation.ts`, `agent-conversation.tsx`, `agent-dock-shell.tsx`, and `agent-client.ts` separately own normalization/persistence, presentation, dock geometry chrome, provider requests, Query-evidence negotiation, and remote-plan normalization. The Workbench retains source selection, operation ownership, runtime preflight, proposal review, Apply, and recovery.
4. Legacy Office automation opens exact POSIX files, waits for cold Office startup, suppresses compatibility prompts, rebinds Word documents after Save As, keeps temporary paths canonical, and quits only an Office process it can prove Orbit started. DOC and PPT release QA must complete the full modern→legacy→modern import round trip.
5. Release quality fails on moderate production findings and high tooling findings. The E2E origin proxies ordinary requests to Vinext but serves only the four exact DuckDB worker/manifest/part assets from verified build output with explicit type and length, removing WebKit's large static-stream cancellation race without introducing cross-origin behavior. WebKit reload waits for the current Query-backed runtime before navigation; menu Tab explicitly exits to the adjacent visible control; keyboard movement has a dedicated test that does not inherit a selected macOS text-input context.
6. macOS distribution uses Electron's documented manual packaging path instead of the current Forge graph because the latter introduced known high/critical build-chain advisories during this audit. The package allowlists only `dist`, `desktop`, package metadata, and third-party notices; embeds the ASAR header hash; explicitly configures every Electron 43 fuse; and produces architecture-specific ZIP, DMG, and SHA-256 manifests.
7. Local QA applies only an ad-hoc signature and records `signed: false`, `notarized: false`. A release build fails closed without Developer ID and notary credentials, signs the app with hardened runtime and Apple-events entitlement, notarizes/staples both app and DMG, verifies Gatekeeper, and publishes only when the Git tag exactly matches the package version.

## Consequences

- A user can ask, follow up, and then request a source change without losing the earlier reasoning or surrendering review-before-write.
- Conversation privacy and limits are visible and executable rather than implied.
- Provider and dock changes no longer require editing the Workbench's protocol parser or toolbar markup.
- A locally generated DMG is useful QA evidence but is never represented as a trusted public release.
- The first signed artifact still requires authorized Apple Developer credentials and a second-Mac Gatekeeper check; code and synthetic tests cannot manufacture either external fact.
