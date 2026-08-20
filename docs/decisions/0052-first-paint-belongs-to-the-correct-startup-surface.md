# ADR 0052: First paint belongs to the correct startup surface

## Status

Accepted for Rune v1.36.

## Context

Rune previously server-rendered the sample workbench with `welcomeOpen = false`. After hydration, an asynchronous device-state effect read localStorage, opened the lazy welcome entry, and temporarily showed a `Preparing Rune…` fallback. A legacy backdrop fade also began at zero opacity. Frame captures therefore exposed the workbench before the intended device-startup handwriting, even though post-hydration interaction tests passed.

The server cannot infer browser localStorage, but rendering neither startup surface correctly is not an acceptable first-frame compromise. Eagerly showing onboarding to every returning user would merely reverse the flash. Moving workspace or credential data into a cookie would widen the trust boundary for a presentation decision.

## Decision

The complete handwritten welcome and language decision are part of the server and initial client graph. The root HTML starts with `data-rune-onboarding="pending"`. One fixed inline head bootstrap reads only whether `rune-onboarding-v1` equals `complete`, then sets that root attribute to `complete` or `pending` before the body can paint. It reads no workspace content, task evidence, provider state, credential, file handle, or user-authored value and performs no network or persistence write.

The server always includes the welcome markup. The pending state leaves its immediately opaque backdrop visible for a first-run device. The complete state hides it through CSS so a returning device sees the already server-rendered workbench. During hydration, one layout effect reads the same marker, reconciles `welcomeOpen`, and removes the transient attribute. Explicitly reopening onboarding happens after that gate is gone and remains visible.

The backdrop has no opacity entrance animation; only the window contents and Rune-original handwriting move. `WelcomeExperience` is eager, but model status, provider icons, and `ModelProfileManager` move into the lazy `WelcomeModelStep`, which is requested only after Continue. The minified initial Workbench remains under the existing 530 KB gate.

## Consequences

- A new user's first server-rendered frame is the actual handwriting canvas, not a workbench or loading surrogate.
- A returning user's pre-hydration frame is the workbench, not a welcome flash.
- Disabling all client JavaScript still leaves the first-run ritual visible; aborting external JavaScript still lets the inline marker select the returning-user surface.
- The fixed pre-paint script is intentionally narrow and must not become a general localStorage hydration channel.
- Model setup gains its own typed loading boundary and still owns no workspace mutation authority.
- The startup entry grows only within the existing budget; future first-frame work must split post-opening features instead of raising the cap.
