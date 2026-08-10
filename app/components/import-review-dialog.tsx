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
} from "lucide-react";
import { createImportSourcePreview } from "../lib/imports";
import type { ArtifactKind, WorkspaceArtifact } from "../lib/workspace";
import { ReviewDialog } from "./review-dialog";

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
  const uniqueWarnings = [...new Set(warnings)];

  return (
    <ReviewDialog
      dialogId="import-review"
      kicker={<><ShieldCheck aria-hidden="true" /> Local conversion · no upload</>}
      title="Review imported sources"
      description={<><strong>{sourceName}</strong> produced {artifacts.length} readable {artifacts.length === 1 ? "artifact" : "artifacts"}. Nothing is written until you confirm.</>}
      detailsLabel="Import details"
      onCancel={onCancel}
      footer={(
        <>
          <div><ShieldCheck aria-hidden="true" /> One atomic device write after confirmation</div>
          <span>
            <button className="button ghost-button" onClick={onCancel}>Cancel</button>
            <button className="button primary-button" onClick={onConfirm}><Check aria-hidden="true" /> Import {artifacts.length} {artifacts.length === 1 ? "source" : "sources"}</button>
          </span>
        </>
      )}
    >
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
    </ReviewDialog>
  );
}
