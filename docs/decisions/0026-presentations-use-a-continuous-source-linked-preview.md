# ADR 0026: Presentations use a continuous source-linked preview

## Status

Accepted — Rune v1.07.

## Context

ADR 0020 established the correct security and provenance boundary: the Deck compiler owns both the complete export document and one standalone scriptless HTML document per slide, while React owns only presentation and Source navigation. Its first UI rendered one current page selected through a horizontal strip.

That player model is appropriate for presenting, but inefficient for editing. It hides the surrounding argument, makes comparison require repeated clicks, and turns a document-like authoring task into page navigation. Rune's primary Preview is an editing and review surface, so the full deck should be scannable with an ordinary vertical gesture.

At the same time, replacing the compiler output with a separate React slide renderer, giving iframe content script or same-origin access, or parsing arbitrary legacy HTML into guessed pages would weaken existing single-source and security contracts.

## Decision

For valid Deck Markdown, Preview renders every compiler-owned standalone slide document in source order inside one continuous vertical flow.

- Every slide keeps an independent 16:9 canvas and a sandboxed iframe with no script or same-origin privilege.
- Iframes use browser lazy loading so off-screen pages do not all compete for initial rendering.
- A quiet page number and compiler-derived label preserve page identity without turning the flow back into a player.
- The existing compact slide strip remains a jump/edit index. Activating an entry selects the same exact Source target, which in turn scrolls Preview to the matching page.
- Each actual page retains its keyboard-operable outer hit target. Activating it prepares an exact revision-bound Source navigation, reveals Split when required, focuses and centers the textarea range, and activates Selection Agent.
- Source caret movement resolves the same compiler-owned target and scrolls the shared Preview surface to that page with reduced-motion support.
- Chart tokens are still resolved from current canonical workspace facts before entering each no-script document. Export continues to use the complete compiler document and is unchanged.
- Legacy semantic HTML remains one compatibility iframe. Rune does not claim page identity where source ranges cannot be proven.

Preview selection and diagnostic repair also share one React-free `prepareSourceNavigation` contract. It validates artifact identity, source revision, range/reference bounds, and declares necessary effects without reading the DOM or gaining write authority. Workbench remains the sole owner of view changes, focus, selection, scrolling, Agent scope, history, and persistence.

## Consequences

- A deck can be read, compared, and reviewed with ordinary vertical scrolling.
- Source-to-Preview and Preview-to-Source navigation continue to use one exact identity system across all pages.
- Forty-page decks create forty bounded iframe elements, but lazy loading limits initial work; each document remains independent and scriptless.
- Proposal previews remain read-only because the absence of a target handler removes Source activation without changing layout.
- Presentation mode, thumbnails, or virtualized pages may be added later as separate consumers. They must not replace continuous editing Preview or create a second slide compiler.
- Arbitrary imported HTML cannot gain fabricated per-page navigation until a future importer converts it into canonical Deck Markdown through review.

## Rejected alternatives

- Keep one current page: compact, but slows editing, comparison, and whole-deck review.
- One tall multi-slide iframe: preserves export HTML, but the outer application cannot prove or control exact page focus without privileged messaging.
- React-render every slide from Markdown: duplicates the Deck compiler and risks preview/export drift.
- Enable iframe scripts or `allow-same-origin`: creates unnecessary execution and DOM-authority surface.
- Guess slide sections inside legacy HTML: gives untrusted compatibility markup false Source provenance.
