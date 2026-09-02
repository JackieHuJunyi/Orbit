# ADR 0073: Orbit is one wordmark with one two-planet symbol

- Status: accepted
- Date: 2026-09-02

## Context

Orbit v1.55 paired the English product name with a Chinese translation in its primary lockup and retained a compact letter tile. The bilingual lockup made the interface wider, visually uneven across locales, and less recognizable as one international product. The letter tile described the first character of the name but not the product idea: people and AI working together around one traceable source.

## Decision

The only public product wordmark is **Orbit**. It is always written left to right, never translated, and never receives a localized suffix. Interface locales may translate the words around it, such as “Welcome to” or “欢迎来到”, while preserving the exact product name.

The canonical symbol contains two equal circular bodies aligned side by side inside one thin tilted ellipse. The bodies represent a person and AI as peers; the shared path represents one source and one reviewable workflow. The mark is geometric, contains no letter, and uses no decorative gradient. In application chrome it is SVG, monochrome-first, and may give the companion body the current restrained accent color. The browser icon uses the same geometry on a light rounded field in graphite and coral.

One `OrbitMark` React component owns the in-product geometry. First-run chrome and Workbench chrome consume that component rather than duplicating paths. `app/icon.svg` is the static browser representation. Marketing raster artwork may reproduce the geometry, but it is derivative and does not define the product mark.

The legacy `rune-*` storage, asset, IPC, environment, theme, and exported-code contracts established in ADR 0072 remain unchanged.

## Consequences

- Every locale shares one stable, compact product identity.
- Header width and bidirectional layout no longer depend on a translated suffix.
- The mark remains crisp, theme-aware, and inexpensive to revise at any interface size.
- Tests prohibit the retired bilingual lockup in current interface source and prove that exactly two planets appear in both reusable and static mark definitions.
