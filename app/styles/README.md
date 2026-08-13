# Rune interface architecture

`app/globals.css` is the frozen compatibility layer for the existing component inventory. New interface work belongs in this directory and is loaded once by `index.css` after the compatibility layer.

The load order is a dependency order, not a place to hide overrides:

1. `tokens.css` — spacing, type, curves, content geometry, motion timings, and the only authoritative layer scale.
2. `shell.css` — top bar, workspace grid, rails, panes, and RTL physical edges.
3. `content.css` — source editor, compiled preview typography, and pane-local disclosure anchors.
4. `overlays.css` — global menus and modal surfaces; it may consume layer tokens but cannot define page layout.
5. `onboarding.css` — full-screen setup and locale-specific optical typography.
6. `motion.css` — state-revealing transitions and reduced-motion fallbacks; it cannot define geometry.
7. `responsive.css` — breakpoint changes to the preceding semantic rules; it cannot introduce a second component design.

Rules:

- Never add a new versioned “cascade seal” to `globals.css`.
- Never write a numeric `z-index` outside `tokens.css` in the modular system.
- A component consumes semantic tokens; it does not invent a local spacing, radius, duration, or layer scale without extending tokens first.
- Global overlays must remain under `.topbar` or a future portal root and use `--rune-layer-global-float`; pane disclosures use `--rune-layer-pane-float`; blocking reviews and onboarding use their own tiers.
- Do not animate a structural ancestor with `forwards`, because the retained transform creates a stacking context. Entry motion uses `backwards`, leaving the settled element untransformed.
- Test desktop, 960px stacked, 680px compact, short-height, RTL, and reduced-motion boundaries before publishing UI changes.
