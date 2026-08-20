# ADR 0036: Semantic HTML sections own exact preview ranges

- Status: accepted
- Date: 2026-08-21
- Scope: Legacy presentation compatibility, continuous preview, and Source navigation

## Context

Deck Markdown already compiles into independent pages in one continuous Preview and carries exact source identity in both directions. Imported or hand-authored semantic `.html` presentations instead opened as one complete compatibility iframe. That preserved rendering but forced users to scroll inside a nested page, prevented comparison across slides, and could not connect a visible page to canonical Source.

Using browser DOM after parsing would not solve identity safely. Browsers repair malformed HTML, comments and raw-text elements can contain apparent tags, nested sections are not necessarily pages, and repeated rendered text cannot prove which source bytes produced one element. A permissive visual link would therefore be worse than no link.

## Decision

`compileLegacyHtmlSlides` is the sole semantic-HTML page authority. It is a React-free, quote-aware, bounded source scanner that accepts exactly one explicit `<main>` presentation root and treats only complete outer `<section>` elements inside it as pages. Comments and `style`, `title`, and `textarea` bodies cannot create tags; nested sections remain part of their outer page. Each accepted page owns its exact textarea-compatible UTF-16 `[start, end)` range and unchanged source slice.

The scanner rejects scripts, missing or duplicate roots, unmatched or unclosed presentation structure, self-closing slides, input above 120,000 characters, and more than 40 pages. It returns frozen results and has no DOM, React, persistence, network, provider, credential, or mutation dependency.

Each page compiles into an independent `srcDoc` containing the original `<html>` and `<main>` opening tags, shared inline styles outside the root, one exact section, a restrictive CSP, and no script. The iframe keeps an empty sandbox, so it has neither script execution nor same-origin authority. External resources are not enabled.

Preview places those documents in the existing `deck-slide-flow` and binds each canvas to the parser-derived `PreviewSourceTarget`. Existing Workbench navigation owns all focus, selection, view reveal, Agent scope, and scrolling effects. React does not inspect iframe DOM or recreate a source mapping. Controlled visual editing continues to require Deck Markdown; semantic HTML remains a compatibility source.

## Consequences

- Valid semantic HTML presentations now read as one light vertical narrative instead of one nested scrolling iframe.
- Preview activation selects and centers the complete exact section; a Source caret or selection reveals the same page through the existing revision-bound path.
- Unsupported or ambiguous HTML receives no false target and cannot gain edit authority.
- Shared inline styling is retained, but head markup, external assets, scripts, and cross-page DOM dependencies are intentionally not promised in isolated Preview pages.
- Parser fixtures cover comments, raw text, quoted delimiters, nested sections, labels, immutable exact ranges, malformed structure, scripts, and limits; a real browser import covers isolation and both navigation directions.
