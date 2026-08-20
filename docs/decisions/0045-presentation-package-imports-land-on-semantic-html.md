# ADR 0045: Presentation package imports land on semantic HTML

## Status

Accepted for Rune v1.29. This completes the temporary import boundary recorded in ADR 0044.

## Context

Rune's product contract is PowerPoint → HTML, but v1.28 still converted PPTX and ODP into Deck Markdown. That branch preserved embedded pictures safely because the existing `rune-asset:sha256:<digest>` reference, local IndexedDB bytes, reviewed import transaction, folder closure, and Office/ODF/PDF exporters already understood Deck images. Converting only the filename and text to HTML would have discarded that proven media behavior.

The remaining gap was therefore an asset-reference and consumer contract, not another presentation parser or media store.

## Decision

- PPTX and ODP package adapters continue to parse into Rune's strict temporary Deck model so title, paragraph, bullet, table, image-placement, slide-count, and hostile-package limits stay shared.
- After embedded image candidates have been verified, content-hashed, deduplicated, and placed exactly once, the complete temporary Deck is compiled into `presentation-v1` semantic HTML. The temporary Deck is never exposed as the imported canonical artifact.
- A canonical HTML picture uses ordinary readable markup: `<img src="rune-asset:sha256:<digest>" alt="…">`. Image bytes remain exclusively in the existing local asset store and connected-folder `.rune-assets` closure; canonical HTML never contains base64.
- Preview resolves only that exact scheme to a bounded `blob:` URL. Standalone HTML export resolves the same references to reviewed `data:` URLs, adds a restrictive content-security policy, and rejects executable elements, event attributes, CSS resource loads, links, and unapproved `src` values.
- The existing semantic-HTML-to-Deck handoff recognizes at most one verified local image per slide and restores the same readable Markdown image reference in its immutable temporary projection. PPTX, ODP, legacy PPT, and fixed PDF writers therefore keep their strict input model and existing image geometry.
- Manual image insertion is available for a compiler-proven semantic HTML section. Rune inserts immediately before that section's closing tag, allows one primary local image, shows the exact source change in the existing review, checkpoints, stores asset and source atomically, and compensates a failed persistence attempt.
- Existing `.deck.md` remains supported and editable. No stored workspace is force-migrated.

## Consequences

- The main presentation import path now fulfills PPTX/ODP → readable `.html` without dropping supported embedded images.
- Imported pages immediately receive continuous preview, exact Source ↔ Preview navigation, direct section editing, Agent HTML operations, and HTML/PPTX/ODP/PDF handoff through the same canonical format as Rune-authored presentations.
- One content hash, one asset store, one reviewed import transaction, and one exporter projection remain authoritative; there is no HTML-only blob database or hidden package representation.
- Exact positioning, crop, overlap, master styling, transitions, animation, notes, objects, and live Office charts remain explicit fidelity losses. Multiple images may become adjacent semantic HTML slides within the existing forty-slide budget.
- Package round-trip tests must prove PPTX/ODP with real media reimports as `Semantic HTML`, retains exact verified bytes and a readable hash reference, validates as a complete artifact, and can return through the deterministic handoff.
