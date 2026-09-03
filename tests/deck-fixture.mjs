export const deckSourceFixture = `---
version: 1
title: Q2 Board Briefing
theme: orbit
ratio: 16:9
lang: en
---

<!-- layout: cover -->
<!-- eyebrow: Q2 · Board Briefing -->

# Growth became more durable.

A shared story compiled from the same source as the operating data and written report.

---

<!-- layout: metrics -->
<!-- eyebrow: The quarter at a glance -->

# Momentum with healthier economics.

| Q2 revenue | Quarter over quarter | Gross margin |
| --- | --- | --- |
| **{{ metric("regional-summary", "total_q2_revenue", "currency") }}** | **{{ metric("regional-summary", "qoq_growth_pct", "percent") }}** | **{{ metric("regional-summary", "gross_margin_pct", "percent") }}** |

---

<!-- layout: split -->
<!-- eyebrow: Regional signal -->

# {{ metric("top_region") }} is now the growth engine.

Partner distribution created a repeatable acquisition channel.

{{ chart("regional-revenue-chart") }}

---

<!-- layout: split -->
<!-- eyebrow: Query-backed signal -->

# Margin varies by region.

This chart is computed from readable DuckDB SQL, not copied into the deck.

{{ chart("regional-margin-chart") }}
`;

export function deckArtifactFixture(overrides = {}) {
  return {
    id: "board-briefing",
    name: "board-briefing.deck.md",
    kind: "slides",
    language: "Deck Markdown",
    source: deckSourceFixture,
    ...overrides,
  };
}
