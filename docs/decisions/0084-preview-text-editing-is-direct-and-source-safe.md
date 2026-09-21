# ADR 0084: Preview text editing is direct and source-safe

- Status: Accepted
- Date: 2026-09-20
- Release: Orbit v1.65

## Context

Document Preview already mapped rendered headings, paragraphs, quotes, lists, tables, code, and inline fragments back to exact canonical Markdown ranges. Editing nevertheless required selecting a block, finding a pencil, and moving into a separate two-pane editor. That interaction protected source authority but felt unlike a document editor and made ordinary wording changes unnecessarily indirect.

The model picker had the opposite problem: its reasoning control was functionally direct, but the browser's neutral range styling did not communicate increasing strength as clearly as the Codex control. On macOS, closing the final window also closed Orbit's private loopback server while leaving the application process alive, so a later Dock activation could reuse a dead server object.

## Decision

An ordinary rendered heading, paragraph, quote, or list is always a borderless native `contenteditable` surface at its exact proven block; clicking does not swap in another component or alter its geometry. Basic inline emphasis, code, strike, and links serialize back to Markdown; metric fragments remain visible as non-editable binding text and serialize to their original source tokens.

While the Preview has focus, `NativeDocumentBlockEditor` owns its DOM. Stable Markdown renderer identities and a focused-child snapshot prevent asynchronous query or parent renders from replacing the browser's selection. `compositionstart` suspends synchronization and `compositionend` publishes the completed phrase, so macOS Chinese, Japanese, and Korean input methods keep their candidate and marked-text lifecycle. Ordinary keystrokes project a complete-source direct draft into the existing Source textarea without changing its scroll position, highlighting it, or making it read-only. A first click in Source therefore transfers focus normally and remains immediately editable.

On blur, the exact block passes through the unchanged block compiler, live-binding byte check, workspace validation, checkpoint, and atomic device write. `Esc` restores the pre-focus DOM and canonical Source. Tables, fenced code, images, oversized blocks, and structural mutations keep their existing controlled editors.

CSV and flat JSON Data cells use the same direct-draft transaction through native borderless inputs. The original scalar type remains authoritative where possible, while invalid number or boolean text becomes an explicit string instead of a hidden coercion. `Tab` follows native cell order, `Enter` moves down the same column, `Esc` restores the original scalar, and the existing compact locate control still opens the exact canonical source range.

Semantic HTML slides expose only proven text ranges as editable inside their existing preview frame. The frame keeps scripts disabled and uses `allow-same-origin` solely so Orbit can observe its isolated DOM. Each editable element maps back to an exact inner-HTML range in the original `<section>`; saving patches only those ranges, so live bindings, charts, images, SVG, canvas, audio, video, attributes, and surrounding whitespace stay byte-stable. Input events plus an iframe-owned `MutationObserver` cover Chromium, Firefox, WebKit, and IME DOM mutations. Text that cannot be mapped unambiguously remains locked and the complete controlled HTML editor remains available.

While Source owns keyboard focus, `ArtifactPreview` defers same-file source revisions and memoizes both workspace and Document compilation. The textarea therefore accepts the urgent keystroke before Markdown parsing, binding resolution, target derivation, and Preview reconciliation continue as interruptible work. A different artifact identity bypasses this deferral so file switching does not gain a second waiting phase.

The reasoning range publishes its current position, color, and glow as local CSS variables. The filled track grows from left to right, the theme color mixes progressively toward the interface ink at stronger levels, and the thumb plus active localized label transition with the draft choice. Only effort values returned by the selected model are rendered, and committing still occurs through the existing account/profile validation path.

On macOS, closing the final window no longer closes the private server because the application intentionally remains alive. Windows and Linux continue to close the server and quit together.

## Consequences

- Ordinary wording changes now begin with one click in the document itself.
- Preview typing does not rerender per keystroke, change line metrics, intercept the next pointer action, or lock Source.
- IME composition is committed only after the operating system finishes the marked-text sequence.
- Source keystrokes no longer synchronously own the complete Preview compilation cost.
- CSV/JSON cells behave as stable spreadsheet cells instead of expanding into mini forms.
- Safe HTML text behaves like PowerPoint text on every slide, while individual binding and media nodes remain locked.
- Canonical Markdown and binding tokens remain authoritative; direct editing does not create a second document model.
- Fine-grained source selection remains available through the block locate control and section navigator.
- Rich structures keep explicit editors until their round-trip serializers can preserve every supported semantic field.
- The reasoning control communicates strength without implying access to an unsupported tier.
- Reopening Orbit from Dock or Spotlight reuses a live stable origin instead of displaying an unresponsive window.
