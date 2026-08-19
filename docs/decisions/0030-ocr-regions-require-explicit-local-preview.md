# ADR 0030: OCR regions require explicit local preview

- Status: accepted
- Date: 2026-08-19
- Scope: Browser-local scanned-PDF import

## Context

Rune already requires an exact detected-page selection and language choice before browser-local OCR reads scanned PDF pixels. Whole-page recognition is safe but often includes headers, stamps, sidebars, or adjacent material the user does not want transcribed. Region selection needs a visual page preview, but rendering that preview automatically would weaken the existing consent boundary by reading pixels as soon as the setup dialog opens.

## Decision

Whole page remains the default for every selected scan page. The setup dialog does not render page pixels automatically. A user may explicitly choose **Preview and choose region**, after which PDF.js renders only the currently selected page into a bounded, device-local preview. The user can drag a rectangle over the exact paper canvas or enter Left, Top, Width, and Height percentages; each selected page owns an independent normalized region. Reset removes that page's crop and restores whole-page OCR.

Normalized coordinates must be finite, remain inside `[0, 1]`, and span at least 2% of the page in both directions. The conversion port reopens the PDF, revalidates the selected pages and every region, renders with the existing 2,400-pixel/eight-megapixel ceiling, and crops the canvas before Tesseract receives it. Regions for unselected, selectable, missing, zero-sized, non-finite, or out-of-page coordinates fail before recognition and produce no workspace write.

Selected-region output remains untrusted transcription. Its Markdown page marker, visible disclosure, and import-review warning include the normalized crop and confidence so a reviewer can compare it with the original page. Cancellation destroys preview/recognition canvases, PDF pages, loading tasks, and the OCR worker; it does not persist preview pixels, coordinates, recognized text, or workspace state.

## Consequences

- Users can exclude irrelevant page areas without uploading a PDF or introducing a new OCR service.
- Opening OCR setup still reads no page pixels; preview rendering and recognition remain separate explicit actions.
- Keyboard and assistive-technology users can enter the same bounded percentage coordinates without pointer input.
- Regions select one rectangle per page. Multiple disjoint regions, automatic layout segmentation, arbitrary OCR languages, and visual layout reconstruction remain separate future capabilities.
