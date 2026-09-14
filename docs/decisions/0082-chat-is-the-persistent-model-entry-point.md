# ADR 0082: Chat is the persistent model entry point

- Status: Accepted
- Date: 2026-09-14
- Release: Orbit v1.63

## Context

First-run setup could discover account, API, CC Switch, and local-model connections, but choosing “local tools” stored `device-tools-only` and the later Chat picker read only saved profiles. A user who skipped setup therefore saw one local choice even though the same Mac still had usable model connections. The native `<select>` also flattened provider identity, model name, reasoning effort, connection state, and management into one clipped label.

Current ChatGPT Work guidance keeps model and reasoning choice in the composer so a user can balance speed and depth at the point of sending. Orbit needs that hierarchy across heterogeneous providers without implying that an unverified discovery row is already connected.

## Decision

Chat is always a complete model entry point. Opening the composer refreshes both redacted profile state and bounded desktop discovery. One custom picker groups:

1. connected profiles and exact account model/reasoning choices;
2. usable connections found on this device, plus installed accounts that still need sign-in;
3. deterministic local tools that make no model call.

Selecting a connected or local entry switches immediately. Selecting a discovered row is the explicit connection action and uses the same shared client transaction as onboarding: import only that selected credential/capability, verify a non-empty catalog, run the structured-output probe when required, then encrypt and save. A signed-out account opens Model settings, where manual API and configuration import remain available. Skipping setup means “use local tools now,” not “hide models later.”

The picker is composer-native and progressively disclosed: one quiet current-model button opens a viewport-aware surface with a horizontally swipeable provider/connection rail, a separate exact-model rail, and a draggable discrete effort control only when the selected model exposes multiple supported reasoning levels. Connected non-account profiles load their bounded catalogs lazily, and every exact model change is checked against the current server-side catalog before the encrypted profile is updated. Provider/source detail remains secondary; refresh and Manage remain available without competing with composition. The surface supports pointer, touch scroll, range drag, Arrow keys, Home/End, Escape, outside dismissal, compact screens, RTL, and every shipped interface locale.

## Consequences

- Welcome and Chat can no longer drift on connection verification order.
- No credential or account token enters React discovery state; only the selected row crosses the existing narrow desktop bridge.
- A device scan is read-only and non-blocking, while connection and activation remain serialized by the Workbench operation gate.
- Provider-specific catalogs remain session-only and are refreshed from the credential-owning server boundary; Orbit persists only the exact selected model, never a stale catalog snapshot.
