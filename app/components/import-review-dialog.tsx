"use client";

import {
  BarChart3,
  Check,
  CheckCircle2,
  Database,
  FileText,
  Presentation,
  ShieldCheck,
  TableProperties,
  TriangleAlert,
  X,
} from "lucide-react";
import { useEffect, useRef } from "react";
import { createImportSourcePreview } from "../lib/imports";
import type { ArtifactKind, WorkspaceArtifact } from "../lib/workspace";

function ArtifactIcon({ kind }: { kind: ArtifactKind }) {
  if (kind === "document") return <FileText aria-hidden="true" />;
  if (kind === "data") return <TableProperties aria-hidden="true" />;
  if (kind === "query") return <Database aria-hidden="true" />;
  if (kind === "chart") return <BarChart3 aria-hidden="true" />;
  return <Presentation aria-hidden="true" />;
}

function readableNumber(value: number) {
  return new Intl.NumberFormat("en-US").format(value);
}

export function ImportReviewDialog({
  sourceName,
  artifacts,
  warnings,
  error,
  onCancel,
  onConfirm,
}: {
  sourceName: string;
  artifacts: WorkspaceArtifact[];
  warnings: string[];
  error?: string;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const dialogRef = useRef<HTMLElement>(null);
  const cancelRef = useRef(onCancel);
  const uniqueWarnings = [...new Set(warnings)];

  useEffect(() => {
    cancelRef.current = onCancel;
  }, [onCancel]);

  useEffect(() => {
    const dialog = dialogRef.current;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const focusableSelector = "button:not([disabled]), [href], input:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex='-1'])";
    const focusables = dialog ? [...dialog.querySelectorAll<HTMLElement>(focusableSelector)] : [];
    focusables[0]?.focus();

    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        cancelRef.current();
        return;
      }
      if (event.key !== "Tab" || !dialog) return;
      const current = [...dialog.querySelectorAll<HTMLElement>(focusableSelector)];
      if (!current.length) return;
      const first = current[0];
      const last = current[current.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
      previousFocus?.focus();
    };
  }, []);

  return (
    <div className="import-review-backdrop">
      <section
        ref={dialogRef}
        className="import-review-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="import-review-title"
        aria-describedby="import-review-description"
      >
        <header className="import-review-header">
          <div>
            <span className="import-review-kicker"><ShieldCheck aria-hidden="true" /> Local conversion · no upload</span>
            <h2 id="import-review-title">Review imported sources</h2>
            <p id="import-review-description">
              <strong>{sourceName}</strong> produced {artifacts.length} readable {artifacts.length === 1 ? "artifact" : "artifacts"}. Nothing is written until you confirm.
            </p>
          </div>
          <button className="icon-button" onClick={onCancel} aria-label="Cancel import review" title="Cancel import"><X /></button>
        </header>

        <div className="import-review-body" role="region" aria-label="Import details" tabIndex={0}>
          {uniqueWarnings.length ? (
            <section className="import-warning-panel" aria-labelledby="import-warning-title">
              <div className="import-warning-heading">
                <TriangleAlert aria-hidden="true" />
                <h3 id="import-warning-title">Fidelity notes</h3>
                <span>{uniqueWarnings.length}</span>
              </div>
              <ul>{uniqueWarnings.map((warning) => <li key={warning}>{warning}</li>)}</ul>
            </section>
          ) : (
            <div className="import-review-clear"><CheckCircle2 aria-hidden="true" /> The adapter reported no semantic omissions.</div>
          )}

          {error && <div className="import-review-error" role="alert">{error}</div>}

          <div className="import-review-files" aria-label="Generated source previews">
            {artifacts.map((artifact) => {
              const preview = createImportSourcePreview(artifact.source);
              return (
                <article className="import-review-file" key={artifact.id}>
                  <header>
                    <span className={`artifact-icon ${artifact.kind}`}><ArtifactIcon kind={artifact.kind} /></span>
                    <div>
                      <strong>{artifact.name}</strong>
                      <small>{artifact.language} · {readableNumber(preview.lineCount)} lines · {readableNumber(preview.charCount)} chars</small>
                    </div>
                  </header>
                  <pre><code>{preview.text}</code></pre>
                  {preview.truncated && <p>Preview capped · the complete validated source will be imported.</p>}
                </article>
              );
            })}
          </div>
        </div>

        <footer className="import-review-actions">
          <div><ShieldCheck aria-hidden="true" /> One atomic device write after confirmation</div>
          <span>
            <button className="button ghost-button" onClick={onCancel}>Cancel</button>
            <button className="button primary-button" onClick={onConfirm}><Check aria-hidden="true" /> Import {artifacts.length} {artifacts.length === 1 ? "source" : "sources"}</button>
          </span>
        </footer>
      </section>
    </div>
  );
}
