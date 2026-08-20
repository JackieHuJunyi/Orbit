# ADR 0044: Semantic HTML is the default presentation source

## Status

Accepted for Rune v1.28. The temporary PPTX/ODP import exception below is completed by [ADR 0045](0045-presentation-package-imports-land-on-semantic-html.md) in v1.29.

## Context

Rune's product contract is Word → Markdown, Excel → CSV/JSON, and PowerPoint → HTML: the canonical source should remain directly readable by people and models while a separate Preview renders the result continuously. Deck Markdown gave early Rune versions a small safe grammar, deterministic layout, local-image references, and reliable Office/PDF export. Later releases made bounded semantic HTML substantially more capable: one explicit `<main>` can be proven into exact outer `<section>` ranges, shown as independent scriptless pages, navigated in both directions, edited from Preview while Source mirrors the complete draft, and projected through a reviewed Deck handoff for PPTX, ODP, legacy PPT, and PDF.

Keeping Rune-created Presentations on `.deck.md` after those capabilities shipped made the implementation history override the product thesis. It also forced tasks and Agents to create a format the user did not choose, even though the corresponding HTML could already be edited and delivered safely.

Imported PPTX and ODP are a separate compatibility case. Their supported pictures currently use the portable `rune-asset:sha256:` Markdown contract. Moving those imports to HTML before an equally portable HTML asset reference exists would discard a proven capability merely to make extensions uniform.

## Decision

Semantic HTML becomes the default source for every Rune-authored Presentation:

- the shipped sample, New dialog, local Workspace Agent, Operating Review, Document-to-Presentation, and configured Workspace Agent create `.html` artifacts labeled `Semantic HTML`;
- each Rune-owned document has `data-rune-format="presentation-v1"` on its only explicit `<main>`, with bounded title, theme, language, optional Document origin/revision, audience, and purpose metadata;
- each slide is one complete outer `<section>` and retains readable headings, paragraphs, lists, tables, and literal `{{ metric(...) }}` / `{{ chart(...) }}` bindings;
- structural helpers replace, insert, or append only a compiler-proven section, reject scripts/wrappers/invalid counts, and deterministically normalize `data-slide-index` plus `NN / TT` source page labels;
- Agent operations use current zero-based compiled slide identity for semantic HTML and retain title-based operations for existing Deck Markdown;
- Document-to-Presentation refresh preserves the linked target's current source format instead of silently converting it;
- Chart embedding supports both formats through their own readable syntax.

Existing `.deck.md` remains a first-class compatibility and typed-layout source. At this decision's v1.28 boundary, PPTX/ODP imports continued to generate Deck Markdown while their local-picture contract depended on Markdown asset references. ADR 0045 later adds the equivalent semantic HTML content-hash reference and moves those imports to HTML without force-migrating existing Decks.

Office, OpenDocument, desktop PPT, and fixed PDF writers do not gain arbitrary-DOM authority. A valid semantic HTML artifact is revalidated and projected into a temporary strict Deck model inside the existing fidelity-review transaction. For Rune-owned HTML, the projection preserves source metadata, compiler metric grids, and literal live bindings while removing generated eyebrow/page-number chrome; generic imported HTML continues to receive explicit fidelity warnings. The temporary Deck never replaces canonical HTML.

## Consequences

- Rune's default presentation source now matches the original AI-native product thesis and can be read or edited without learning a private Markdown deck grammar.
- New, task-generated, and Agent-generated presentations use the same exact-section live editing and bidirectional source navigation as imported proven semantic HTML.
- Deck Markdown remains available without a forced migration, so old workspaces, local-image presentations, and compatibility imports do not regress.
- Presentation exporters still have one strict internal model and one review boundary rather than separate HTML interpreters in every writer.
- The sample/default filename, locale copy, SSR/render assertions, unit fixtures, and real-browser New flow must identify `.html` and `Semantic HTML`; explicit Deck tests use a stable compatibility fixture.
- PPTX/ODP migration is intentionally outside this decision and is specified and tested separately by ADR 0045.
