"use client";

import {
  BarChart3,
  Check,
  CheckCircle2,
  ClipboardList,
  Database,
  FileText,
  Presentation,
  ShieldCheck,
  TableProperties,
  TriangleAlert,
} from "lucide-react";
import { createImportSourcePreview, type WorkspaceImportReview } from "../lib/imports";
import { localizeRuneCopy, runeUICopy, type RuneLocale } from "../lib/localization";
import { formatInteger } from "../lib/number-format";
import type { RuneTaskId } from "../lib/task-runtime";
import type { ArtifactKind, WorkspaceArtifact } from "../lib/workspace";
import { ReviewDialog } from "./review-dialog";

export const IMPORT_REVIEW_TASK_BASE_COPY = {
  "zh-CN": {
    confirm: "导入并设置汇报",
    nextStep: "下一步",
    nextTitle: "下一步：确认字段与交付物",
    nextBody: "确认这次导入后，Rune 会自动打开经营汇报设置，并预先选择这份数据。",
    briefingConfirm: "导入并设置演示",
    briefingTitle: "下一步：确认受众与演示重点",
    briefingBody: "确认这次导入后，Rune 会自动打开文档演示设置，并预先选择这份文档。",
  },
  en: {
    confirm: "Import and map review",
    nextStep: "Next step",
    nextTitle: "Next: choose fields and deliverables",
    nextBody:
      "After this reviewed import, Rune opens the operating-review setup with this Data source already selected.",
    briefingConfirm: "Import and shape presentation",
    briefingTitle: "Next: choose audience and presentation purpose",
    briefingBody:
      "After this reviewed import, Rune opens the document-presentation setup with this Document already selected.",
  },
} as const;

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
  busy = false,
  locale,
  continuationTask,
  purpose = "import",
  onCancel,
  onConfirm,
}: {
  sourceName: string;
  artifacts: WorkspaceArtifact[];
  warnings: string[];
  error?: string;
  busy?: boolean;
  locale: RuneLocale;
  continuationTask?: RuneTaskId;
  purpose?: WorkspaceImportReview["purpose"];
  onCancel: () => void;
  onConfirm: () => void | Promise<void>;
}) {
  const uniqueWarnings = [...new Set(warnings)];
  const copy = runeUICopy(locale);
  const taskCopy = localizeRuneCopy(locale, IMPORT_REVIEW_TASK_BASE_COPY.en, IMPORT_REVIEW_TASK_BASE_COPY["zh-CN"]);
  const continuesTask = Boolean(continuationTask);
  const continuesBriefing = continuationTask === "document-briefing";

  return (
    <ReviewDialog
      dialogId="import-review"
      kicker={
        <>
          <ShieldCheck aria-hidden="true" /> {copy.importReview.kicker}
        </>
      }
      title={copy.importReview.title}
      description={copy.importReview.description(sourceName, artifacts.length)}
      detailsLabel={copy.importReview.details}
      locale={locale}
      onCancel={onCancel}
      footer={
        <>
          <div>
            <ShieldCheck aria-hidden="true" /> {copy.importReview.atomic}
          </div>
          <span>
            <button className="button ghost-button" onClick={onCancel} disabled={busy}>
              {copy.common.cancel}
            </button>
            <button className="button primary-button" onClick={() => void onConfirm()} disabled={busy}>
              <Check aria-hidden="true" />{" "}
              {purpose === "editable-copy"
                ? copy.preview.createEditableDeck
                : continuesTask
                  ? continuesBriefing
                    ? taskCopy.briefingConfirm
                    : taskCopy.confirm
                  : copy.importReview.importSources(artifacts.length)}
            </button>
          </span>
        </>
      }
    >
      {continuesTask && (
        <section className="import-task-continuation" aria-label={taskCopy.nextStep}>
          {continuesBriefing ? <Presentation aria-hidden="true" /> : <ClipboardList aria-hidden="true" />}
          <div>
            <strong>{continuesBriefing ? taskCopy.briefingTitle : taskCopy.nextTitle}</strong>
            <p>{continuesBriefing ? taskCopy.briefingBody : taskCopy.nextBody}</p>
          </div>
        </section>
      )}
      {uniqueWarnings.length ? (
        <section className="import-warning-panel" aria-labelledby="import-warning-title">
          <div className="import-warning-heading">
            <TriangleAlert aria-hidden="true" />
            <h3 id="import-warning-title">{copy.importReview.fidelityNotes}</h3>
            <span>{uniqueWarnings.length}</span>
          </div>
          <ul>
            {uniqueWarnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        </section>
      ) : (
        <div className="import-review-clear">
          <CheckCircle2 aria-hidden="true" /> {copy.importReview.noOmissions}
        </div>
      )}

      {error && (
        <div className="import-review-error" role="alert">
          {error}
        </div>
      )}

      <div className="import-review-files" aria-label={copy.importReview.generatedPreviews}>
        {artifacts.map((artifact) => {
          const preview = createImportSourcePreview(artifact.source);
          return (
            <article className="import-review-file" key={artifact.id}>
              <header>
                <span className={`artifact-icon ${artifact.kind}`}>
                  <ArtifactIcon kind={artifact.kind} />
                </span>
                <div>
                  <strong>{artifact.name}</strong>
                  <small>
                    {artifact.language} ·{" "}
                    {copy.importReview.sourceStats(
                      readableNumber(preview.lineCount),
                      readableNumber(preview.charCount),
                    )}
                  </small>
                </div>
              </header>
              <pre>
                <code>{preview.text}</code>
              </pre>
              {preview.truncated && <p>{copy.importReview.previewCapped}</p>}
            </article>
          );
        })}
      </div>
    </ReviewDialog>
  );
}
