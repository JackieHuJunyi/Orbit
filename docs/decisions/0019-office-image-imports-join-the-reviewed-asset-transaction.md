# ADR 0019: Office image imports join the reviewed asset transaction

## Status

Accepted — Rune v1.00.

## Context

Rune could insert, preview, folder-sync, and export verified local images, but compatibility imports still discarded image bytes from DOCX, PPTX, ODT, and ODP. That made the canonical workspace incomplete after opening a normal Office file and created pressure for each parser to invent its own storage and hashing behavior.

DeepSeek Harness reinforces two useful boundaries here: a capability needs a definition, provider, and consumer; a reversible effect must unwind when its owning operation fails. Rune does not need Harness's dynamic plugin tree, but image import needs those same explicit roles.

## Decision

OOXML and ODF parsers remain package-format owners. In asset-aware mode they expand only bounded `word/media`, `ppt/media`, or `Pictures/` entries and translate internal image relationships into converter-owned candidates. They do not hash, persist, render, or trust declared extensions.

The shared `imported-images` port owns candidate finalization. It validates PNG, JPEG, WebP, or GIF magic bytes and dimensions through the existing local-asset contract, enforces the 8 MB per-image, 40-image, and 64 MB batch limits, computes SHA-256 identities, deduplicates identical bytes, replaces each unique placeholder exactly once with readable `rune-asset:sha256:<digest>` Markdown, and removes invalid candidates with an explicit fidelity warning. A missing, repeated, foreign, or escaped placeholder rejects the conversion.

DOCX and ODT keep supported images in canonical Document reading order when the source exposes that order. PPTX and ODP map one supported image to the original slide when it does not conflict with a table; additional or table-conflicting images become adjacent image slides while the 40-slide ceiling permits. Exact crop, overlap, wrapping, and coordinates remain disclosed semantic approximations.

The import review now owns both generated artifacts and their deduplicated prepared assets. When assets are present, their ids must exactly close the references in the imported sources. Confirmation stores or deduplicates every asset first and persists the complete workspace second. If any asset write or the source write fails, Rune deletes only assets newly created by that attempt; pre-existing identical assets are never removed. Cancel and stale-context rejection perform no writes.

The synchronous text-only converters remain available for deterministic semantic round-trip tests and non-product consumers. The Workbench and Rune Desktop compatibility path use only the asset-aware asynchronous adapters.

## Consequences

Compatibility imports now enter the same media authority as manual insertion, folder Pull/Push, preview, and every exporter. Parser packages stay replaceable, IndexedDB remains the only device byte store, and React coordinates one reviewed effect instead of owning package or hashing rules. Unsupported and corrupt media still cannot become active workspace assets, and import remains semantic rather than a promise of pixel-perfect Office reconstruction.
