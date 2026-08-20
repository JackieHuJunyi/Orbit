# ADR 0037: Semantic HTML handoff reuses the controlled Deck model

- Status: accepted
- Date: 2026-08-21
- Scope: Semantic HTML presentation export to PPTX, ODP, legacy PPT, and fixed PDF

## Context

Rune v1.20 can prove page identity for a bounded semantic HTML presentation, show every section in one continuous Preview, and navigate exactly between page and canonical source. The same valid artifact still exposes only source download: Office, OpenDocument, legacy desktop, and direct PDF export accept Deck Markdown presentations. A user can therefore import and edit a compatibility presentation but cannot complete the common handoff.

Teaching each writer to interpret arbitrary HTML would create three incompatible renderers and broaden their trust boundaries to CSS, repaired browser DOM, external resources, and unsupported executable or interactive elements. Rendering browser screenshots would hide text semantics and introduce a hosted or browser-print dependency.

## Decision

`convertSemanticHtmlPresentationToDeck` is a lazy React-free one-way compatibility boundary. It first calls `compileLegacyHtmlSlides`, so exactly the same one-`main`, complete outer-`section`, scriptless, 120,000-character, and 40-page rules govern Preview and export. It parses each already-proven section locally and projects supported facts into an immutable temporary Deck artifact:

- the first `h1` or `h2` becomes the page title;
- paragraphs, quotes, preformatted text, and captions become readable text blocks;
- ordered and unordered lists become bounded Deck bullets;
- rectangular tables become Markdown tables, bounded to 20 rows and 8 columns;
- irregular tables become readable row bullets;
- supported `data-layout`, bounded `data-eyebrow`, and a registered `<html lang>` are retained.

Markdown-significant literal characters are escaped before the strict Deck parser sees them. Rune's Deck compiler and semantic Office/OpenDocument parsers share the corresponding backslash-unescape contract, so literal source text cannot become a separator, heading, raw HTML tag, link, or image instruction by accident.

PPTX, ODP, legacy PPT, and fixed PDF reuse their existing deterministic Deck writers. The temporary artifact exists only for the pending reviewed export and never changes canonical HTML, checkpoints, device storage, or connected folders. The converter has no React, persistence, network, provider, credential, download, or mutation authority.

CSS, exact positioning, animation, forms, links, external images/video, and unsupported elements are explicitly disclosed as fidelity loss. Unverified media is omitted. Irregular and oversized tables receive deterministic bounded fallbacks. Malformed, scripted, or oversized HTML still fails closed before a file is prepared.

## Consequences

- A reviewed semantic HTML presentation now completes the practical import → preview/edit → PPTX/ODP/PPT/PDF handoff without replacing its canonical source.
- All presentation package and fixed-layout writers keep one controlled semantic input instead of acquiring arbitrary HTML behavior.
- The handoff preserves readable structure rather than CSS appearance; it is intentionally not pixel-fidelity HTML-to-PowerPoint conversion.
- Unit tests prove immutable deterministic conversion, escaping, warnings, and failure boundaries; package tests parse generated PPTX/ODP XML and PDF tests prove one fixed 16:9 page per source section.
- The real import browser flow proves the three reviewed handoff choices are reachable from a semantic HTML artifact.
