# ADR 0081: PDF tools share one reviewed local runtime

- Status: accepted for private desktop testing
- Date: 2026-09-14
- Release: Orbit v1.62

## Context

PDF24 and iLovePDF expose overlapping collections of page organization, optimization, conversion, editing, security, and AI features. Copying their tool-card layouts would add another product shell and still leave binary operations disconnected from Orbit's source, review, and Agent contracts. Asking a language model to manipulate opaque PDF bytes would be slower and less reliable than deterministic libraries.

## Decision

`pdf-tool-registry.ts` is the complete product capability map. One lazy `PdfToolCenter` provides category navigation, search, file selection, exact options, progress, error, and result-before-download review for every entry. A small intent matcher may open that center from a chat request, but it never sends PDF bytes to a model or bypasses confirmation.

Direct page, creation, overlay, annotation, visible signature, and form operations use pdf-lib. qpdf runs in a dedicated Wasm Worker for lossless compression, linearization, repair, 256-bit encryption, and decryption. Ghostscript runs in a separate safer Wasm Worker for PDF/A-2 output. pdf.js performs bounded page rendering, embedded raster-image extraction, text comparison, and secure redaction; redacted pages are rebuilt from raster pixels so covered original text and drawing operators are not retained. Worker assets are generated from exact npm dependencies during `prepare:runtime`, served from the same origin, and excluded from the eager React graph.

Format conversions reuse Orbit's existing reviewed import/export adapters: PDF to Markdown/OCR enters canonical source first; Office/OpenDocument/HTML to PDF uses fixed export; PDF to Word/PowerPoint/Excel imports before its corresponding export. Summary and translation prepare an editable Agent request only after local extraction and still require the existing model/review boundary. Web-to-PDF is desktop-only: an isolated non-persistent Electron partition accepts one public HTTPS URL, denies popups, and produces a bounded print result.

## Consequences

- PDF tools feel like one Orbit capability rather than a copied external website.
- The original file remains unchanged; destructive transforms produce a new reviewed download.
- Heavy binary engines cannot block typing or ordinary file navigation.
- Consumer PDF content reaches a model only through an explicit source import and Agent request.
- Visible signatures are clearly not represented as cryptographic certificates.
- Exact rendering, PDF/A, encryption, and permanent redaction remain executable test boundaries rather than UI claims.

## Verification

- Pure tests require all thirty-six unique capabilities and exercise page parsing, merge/split/reorder/delete/extract/rotate/crop, watermark, numbering, edit, signature, forms, overlay, and creation.
- Chromium executes qpdf compression, protection/unlock, Ghostscript PDF/A, pdf.js page rendering/image extraction, permanent redaction, result downloads, and Agent-to-tool routing.
- Architecture and release tests keep workers same-origin, pinned, lazy, bounded, and licensed.
