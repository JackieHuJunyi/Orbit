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
import { runeUICopy, type RuneLocale } from "../lib/localization";
import { formatInteger } from "../lib/number-format";
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
  return formatInteger(value);
}

export function ImportReviewDialog({
  sourceName,
  artifacts,
  warnings,
  error,
  locale,
  onCancel,
  onConfirm,
}: {
  sourceName: string;
  artifacts: WorkspaceArtifact[];
  warnings: string[];
  error?: string;
  locale: RuneLocale;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const uniqueWarnings = [...new Set(warnings)];
  const copy = runeUICopy(locale);

  return (
    <ReviewDialog
      dialogId="import-review"
      kicker={<><ShieldCheck aria-hidden="true" /> {copy.importReview.kicker}</>}
      title={copy.importReview.title}
      description={copy.importReview.description(sourceName, artifacts.length)}
      detailsLabel={copy.importReview.details}
      locale={locale}
      onCancel={onCancel}
      footer={(
        <>
          <div><ShieldCheck aria-hidden="true" /> {copy.importReview.atomic}</div>
          <span>
            <button className="button ghost-button" onClick={onCancel}>{copy.common.cancel}</button>
            <button className="button primary-button" onClick={onConfirm}><Check aria-hidden="true" /> {copy.importReview.importSources(artifacts.length)}</button>
          </span>
        </>
      )}
    >
          {uniqueWarnings.length ? (
            <section className="import-warning-panel" aria-labelledby="import-warning-title">
              <div className="import-warning-heading">
                <TriangleAlert aria-hidden="true" />
                <h3 id="import-warning-title">{copy.importReview.fidelityNotes}</h3>
                <span>{uniqueWarnings.length}</span>
              </div>
              <ul>{uniqueWarnings.map((warning) => <li key={warning}>{warning}</li>)}</ul>
            </section>
          ) : (
            <div className="import-review-clear"><CheckCircle2 aria-hidden="true" /> {copy.importReview.noOmissions}</div>
          )}

          {error && <div className="import-review-error" role="alert">{error}</div>}

          <div className="import-review-files" aria-label={copy.importReview.generatedPreviews}>
            {artifacts.map((artifact) => {
              const preview = createImportSourcePreview(artifact.source);
              return (
                <article className="import-review-file" key={artifact.id}>
                  <header>
                    <span className={`artifact-icon ${artifact.kind}`}><ArtifactIcon kind={artifact.kind} /></span>
                    <div>
                      <strong>{artifact.name}</strong>
                      <small>{artifact.language} · {copy.importReview.sourceStats(readableNumber(preview.lineCount), readableNumber(preview.charCount))}</small>
                    </div>
                  </header>
                  <pre><code>{preview.text}</code></pre>
                  {preview.truncated && <p>{copy.importReview.previewCapped}</p>}
                </article>
              );
            })}
          </div>
    </ReviewDialog>
  );
}
