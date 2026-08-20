# ADR 0032: Interface locales load before synchronous use

- Status: accepted
- Date: 2026-08-21
- Scope: Interface localization and client delivery

## Context

Rune has one complete interface contract across nine locales, but the client previously imported every generated catalog, every human-reviewed override, and the full Traditional Chinese conversion table into the Workbench entry. A person using English therefore downloaded and parsed more than 800 KB of locale source that could never affect that session. Adding another language repeated every English lookup key and increased the initial cost for every user.

Localization still has to be synchronous while React renders and while pure task compilers produce reviewed copy. Allowing a missing catalog to fall back silently would create mixed-language UI and could make browser and task-service output disagree. Runtime translation is also outside Rune's local-first and deterministic boundary.

## Decision

English and Simplified Chinese remain built into the typed source contract. Traditional Chinese conversion data and the French, Spanish, Russian, Arabic, Japanese, and Korean catalogs are separate static same-origin modules. `loadRuneLocaleCatalog(locale)` is the only asynchronous boundary. The Workbench loads the stored or detected locale before setting locale state, language selection loads before switching, and task API routes load the validated request locale before calling synchronous compilers.

After that boundary, `runeText`, `runeUICopy`, guide generation, status localization, and task compilers stay synchronous. Calling them for an unloaded deferred locale fails loudly instead of returning English. Concurrent requests for one locale share one in-flight module promise; failed loads can be retried. Catalogs contain no executable remote content, credentials, workspace source, persistence, or write authority. Development-time source catalogs and human overrides are compiled into one deterministic module per locale, and CI rejects stale runtime modules.

## Consequences

- The initial minified Workbench chunk falls from about 1.4 MB to 699,297 bytes while retaining the complete nine-locale contract.
- A session downloads only its selected deferred catalog; changing language loads that local module once and then switches atomically.
- Adding another locale adds one independently cacheable module rather than increasing every user's initial JavaScript.
- Server and client task output share the same load-before-synchronous-use rule, so no second localization implementation is introduced.
- A 750 KB initial Workbench budget and manifest assertions make accidental eager catalog imports release failures.
