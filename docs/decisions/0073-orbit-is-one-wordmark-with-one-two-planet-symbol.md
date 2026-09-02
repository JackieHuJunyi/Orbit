# ADR 0073: Orbit is one wordmark with one two-planet symbol

- Status: accepted
- Date: 2026-09-02

## Context

Orbit v1.55 paired the English product name with a Chinese translation in its primary lockup and retained a compact letter tile. The bilingual lockup made the interface wider, visually uneven across locales, and less recognizable as one international product. The letter tile described the first character of the name but not the product idea: people and AI working together around one traceable source.

## Decision

The only public product wordmark is **Orbit**. It is always written left to right, never translated, and never receives a localized suffix. Interface locales may translate the words around it, such as “Welcome to” or “欢迎来到”, while preserving the exact product name.

The canonical symbol contains two equal circular bodies, each travelling on one ellipse. Both ellipses use the same size, weight, and angle, overlap, and intersect at two visible crossings. The bodies represent a person and AI as peers, while the parallel intersecting paths represent two independent actors meeting around one source and one reviewable workflow. The mark is geometric, contains no letter, and uses no decorative gradient. Product chrome draws the paths in the current foreground and both nodes in a stable Mist Blue finish. The application icon uses the same geometry on a continuous-corner Deep Space field (`#1D2834`) with Starlight paths (`#F4F2ED`) and equal Mist Blue nodes (`#9EBBCB`). One shared planet color reinforces peer status and keeps the palette at three tones.

One `OrbitMark` React component owns the in-product geometry. First-run chrome and Workbench chrome consume that component rather than duplicating paths. `icon-design/icon.svg` is the 1024-unit master; `app/icon.svg` is the static browser representation, and its transparent 512 px derivative is the Electron window and macOS Dock icon. The brief, rejected candidates, 512/64/32/16 px renders, and pixel-grounded critique remain beside the master so later work can revise one source instead of redrawing the brand. Marketing raster artwork may reproduce the geometry, but it is derivative and does not define the product mark.

The legacy `rune-*` storage, asset, IPC, environment, theme, and exported-code contracts established in ADR 0072 remain unchanged.

## Consequences

- Every locale shares one stable, compact product identity.
- Header width and bidirectional layout no longer depend on a translated suffix.
- The mark remains crisp, theme-aware, and inexpensive to revise at any interface size.
- The app icon uses a continuous-corner field instead of a circular-arc rounded rectangle and keeps its glyph within the current Apple icon grid by rendered inspection.
- Tests prohibit the retired bilingual lockup in current interface source and prove that exactly two planets and two intersecting paths appear in both reusable and static mark definitions.
