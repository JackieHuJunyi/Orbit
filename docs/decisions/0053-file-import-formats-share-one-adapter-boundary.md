# ADR 0053: File import formats share one adapter boundary

## Status

Accepted for Rune v1.37.

## Context

Rune accepts readable source, legacy Office through the desktop bridge, modern OOXML, OpenDocument, and PDF with an optional explicit OCR step. The Workbench previously owned filename patterns and byte limits, then repeated the same conversion branches once for ordinary import and again after OCR selection. Adding or changing a format therefore required coordinated edits to the picker, oversize messages, PDF analysis, and two conversion loops. A missed branch could make the same file behave differently after OCR or silently drop warnings and prepared image assets.

Moving every parser eagerly into a generic registry would fix duplication by regressing startup cost. Turning imports into runtime plugins would also give third-party code an authority boundary the product has not justified.

## Decision

`workspace-file-import.ts` owns one ordered closed list of import adapters. Each adapter declares its accepted extensions, case-insensitive matcher, byte limit and label, and one async converter. Legacy Office, OOXML, OpenDocument, and PDF converters remain dynamic imports; readable source is the final fallback and must still pass the canonical Artifact detector. The list generates the file-picker `accept` string and every pre-read size decision.

The shared batch converter preserves file order and returns only Artifact candidates, filename-prefixed fidelity warnings, and prepared content-hash assets. Ordinary import calls it directly. OCR continuation calls the same function with a map keyed by original file index plus the abort signal and progress callbacks. PDF scan analysis remains a separate adapter-owned read before the user authorizes pixels.

The adapter cannot resolve identity collisions, bind a focused task, approve review, validate a proposed workspace, store assets, persist, or mutate UI state. Those authorities remain in the existing import compiler and Workbench transaction. Unsupported source fails closed rather than receiving a guessed Artifact kind.

## Consequences

Adding a format now changes one adapter definition and its focused contracts instead of several Workbench branches. Picker affordance, byte policy, ordinary conversion, and OCR continuation share one fact. Heavy compatibility runtimes remain outside the startup graph; the minified Workbench entry is 527,519 bytes under the existing 530 KB gate. The Workbench shrinks from 6,381 to 6,255 lines without changing its review, stale-context, compensation, or persistence behavior.

This remains a compile-time product registry, not an extension marketplace. New adapters still need explicit format limits, fidelity semantics, hostile-input tests, atomic review evidence, and an approved product reason.
