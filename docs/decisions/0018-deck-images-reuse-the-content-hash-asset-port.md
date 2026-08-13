# ADR 0018: Deck images reuse the content-hash asset port

## Status

Accepted — Rune v0.99.

## Context

Rune Documents already keep image bytes out of canonical Markdown: a readable standalone image line carries a `rune-asset:sha256:<digest>` identity while verified PNG, JPEG, WebP, or GIF bytes live in the bounded device asset store and optional `.rune-assets` folder. Deck Markdown could render text, metrics, tables, and Charts, but could not use that media contract. Adding slide-specific uploads, storage keys, URLs, or exporter caches would create a second asset authority and make preview, folder sync, Office, OpenDocument, HTML, and PDF drift independently.

## Decision

Deck Markdown accepts the same standalone content-hash image syntax and no other image URL. A slide may contain one primary image, must use a non-`metrics` layout, and may not combine that image with a Chart or table. This is a deliberate one-primary-visual layout rule shared by every renderer, not an exporter-specific omission. Inline references, external Markdown images, repeated images, missing bytes, corrupt bytes, and references outside a proven slide range fail closed.

The workbench reuses the existing local-image review, SHA-256 identity, IndexedDB store, compensation path, blob URL resolver, and directory manifest closure. It adds no image database and no hidden slide metadata. Preview receives only an injected resolver and permits only ephemeral `blob:` or generated `data:image/*;base64` URLs.

Each handoff adapter consumes the same reverified byte map:

1. PPTX writes deterministic `ppt/media` parts, explicit slide relationships, and aspect-fit picture geometry inside the 16:9 canvas.
2. ODP writes deterministic `Pictures/` entries, MIME manifest records, and aspect-fit drawing frames.
3. standalone HTML converts only approved referenced assets to embedded data URLs, increases the final bounded file limit to 12 MB, and rejects every other `src` or `href` boundary.
4. PDF locally decodes the same verified assets and embeds them in the fixed primary-visual frame.

Canonical Deck Markdown never receives base64, blob URLs, package paths, or exporter identifiers. Raw source download remains source-only; folder Push/Pull carries the bytes through the already versioned asset manifest.

## Consequences

Rune gains a complete slide-image path without another storage or synchronization subsystem. The Deck parser remains the single layout authority, exporters fail before creating a misleading missing-image handoff, and identical source plus verified bytes produce deterministic packages. A slide cannot yet compose multiple independent media objects; richer layouts must first extend the typed Deck grammar and all five renderers together rather than bypassing this port in one UI.
