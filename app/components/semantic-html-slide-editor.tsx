"use client";

import { AlertTriangle, Check, LoaderCircle, X } from "lucide-react";
import { useMemo, useState } from "react";
import type { OrbitUICopy } from "../lib/localization";
import type { PreviewSourceTarget } from "../lib/preview-targets";
import {
  MAX_VISUAL_SEMANTIC_HTML_SLIDE_CHARS,
  projectVisualSemanticHtmlSlideDraft,
  visualSemanticHtmlSlideDraft,
  visualSemanticHtmlSlidePreview,
  type VisualSemanticHtmlSlideEditInput,
} from "../lib/visual-semantic-html-slide-edit";
import type { WorkspaceArtifact } from "../lib/workspace";
import { PresentationFrame } from "./presentation-frame";
import {
  useVisualSourceDraftMirror,
  type VisualSourceDraft,
  type VisualSourceDraftHandler,
} from "./use-visual-source-draft";

export function SemanticHtmlSlideEditor({
  artifact,
  copy,
  onClose,
  onSave,
  onVisualSourceDraftChange,
  resolveLocalAssetUrl,
  target,
}: {
  artifact: WorkspaceArtifact;
  copy: OrbitUICopy["preview"];
  onClose: () => void;
  onSave: (
    artifact: WorkspaceArtifact,
    target: PreviewSourceTarget,
    input: VisualSemanticHtmlSlideEditInput,
  ) => Promise<string | null>;
  onVisualSourceDraftChange?: VisualSourceDraftHandler;
  resolveLocalAssetUrl?: (reference: string) => string | null;
  target: PreviewSourceTarget;
}) {
  const initial = useMemo(() => visualSemanticHtmlSlideDraft(artifact, target), [artifact, target]);
  const [draft, setDraft] = useState(initial?.draft ?? "");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const input = useMemo<VisualSemanticHtmlSlideEditInput>(() => ({ draft }), [draft]);
  const projection = useMemo(
    () => projectVisualSemanticHtmlSlideDraft(artifact, target, input),
    [artifact, input, target],
  );
  const preview = useMemo(
    () => visualSemanticHtmlSlidePreview(artifact, target, input, resolveLocalAssetUrl),
    [artifact, input, resolveLocalAssetUrl, target],
  );
  const previewError = preview.errors[0] ?? projection.errors[0] ?? "";

  const visualSourceDraft = useMemo<VisualSourceDraft>(
    () => ({
      artifactId: artifact.id,
      sourceRevision: artifact.source,
      ...projection,
    }),
    [artifact.id, artifact.source, projection],
  );
  useVisualSourceDraftMirror(visualSourceDraft, onVisualSourceDraftChange);

  async function submit() {
    if (submitting || previewError) return;
    setError("");
    setSubmitting(true);
    const nextError = await onSave(artifact, target, input);
    if (nextError) {
      setError(nextError);
      setSubmitting(false);
      return;
    }
    onClose();
  }

  return (
    <form
      className="visual-deck-editor semantic-html-slide-editor"
      aria-busy={submitting}
      onSubmit={(event) => {
        event.preventDefault();
        void submit();
      }}
    >
      <header>
        <div>
          <span>{copy.editingSlide(target.index + 1)}</span>
          <strong>{target.label}</strong>
        </div>
        <small>
          {draft.length.toLocaleString(copy.numberLocale)} /{" "}
          {MAX_VISUAL_SEMANTIC_HTML_SLIDE_CHARS.toLocaleString(copy.numberLocale)}
        </small>
      </header>
      <div className="visual-deck-editor-grid">
        <div className="visual-deck-fields">
          <label className="visual-deck-markdown-field">
            <span>{copy.slideHtml}</span>
            <textarea
              autoFocus
              aria-label={`${copy.slideHtml} · ${target.label}`}
              value={draft}
              disabled={submitting}
              maxLength={MAX_VISUAL_SEMANTIC_HTML_SLIDE_CHARS}
              spellCheck={false}
              onChange={(event) => {
                setDraft(event.target.value);
                setError("");
              }}
              onKeyDown={(event) => {
                if (event.key === "Escape") {
                  event.preventDefault();
                  onClose();
                } else if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
                  event.preventDefault();
                  void submit();
                }
              }}
            />
          </label>
        </div>
        <section className="visual-deck-draft" aria-label={copy.slideDraft(target.label)}>
          <span>{copy.sandboxedSlide}</span>
          {preview.html && !previewError ? (
            <PresentationFrame srcDoc={preview.html} sandbox="" title={copy.slideDraft(target.label)} />
          ) : (
            <div className="visual-deck-draft-error">
              <AlertTriangle aria-hidden="true" />
              <p>{previewError || copy.validHtmlSlide}</p>
            </div>
          )}
        </section>
      </div>
      {error && (
        <p className="visual-deck-error" role="alert">
          {error}
        </p>
      )}
      <footer>
        <p>{copy.htmlSlideContract}</p>
        <div>
          <button type="button" disabled={submitting} onClick={onClose}>
            <X />
            {copy.cancel}
          </button>
          <button type="submit" disabled={submitting || !draft.trim() || Boolean(previewError)}>
            {submitting ? <LoaderCircle className="agent-spinner" /> : <Check />}
            {copy.saveHtmlSlide}
          </button>
        </div>
      </footer>
    </form>
  );
}
