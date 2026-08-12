"use client";

import { AlertTriangle, Check, LoaderCircle } from "lucide-react";
import { createLineDiffPreview } from "../lib/patches";
import type {
  VisualDocumentBlockStructureAction,
} from "../lib/visual-document-block-structure";
import { ReviewDialog } from "./review-dialog";

const ACTION_TITLES: Record<VisualDocumentBlockStructureAction, string> = {
  "insert-before": "Insert block before",
  "insert-after": "Insert block after",
  "move-up": "Move block up",
  "move-down": "Move block down",
  delete: "Delete block",
};

export function DocumentStructureReviewDialog({
  artifactName,
  targetLabel,
  action,
  beforeSource,
  nextSource,
  warnings,
  error,
  submitting,
  onCancel,
  onConfirm,
}: {
  artifactName: string;
  targetLabel: string;
  action: VisualDocumentBlockStructureAction;
  beforeSource: string;
  nextSource: string;
  warnings: string[];
  error: string;
  submitting: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const diff = createLineDiffPreview(beforeSource, nextSource, 24);
  const destructive = action === "delete";
  return (
    <ReviewDialog
      dialogId="document-structure-review"
      kicker={<>Document structure · revision-bound</>}
      title={ACTION_TITLES[action]}
      description={<>Review the exact canonical-source change for <strong>{targetLabel}</strong>. Nothing is written until you confirm.</>}
      detailsLabel={`Source change for ${artifactName}`}
      onCancel={onCancel}
      footer={(
        <>
          <span>One atomic device write · a checkpoint is created first</span>
          <div>
            <button className="button ghost-button" type="button" data-dialog-initial-focus={destructive ? true : undefined} disabled={submitting} onClick={onCancel}>Cancel</button>
            <button
              className={`button primary-button ${destructive ? "danger-button" : ""}`.trim()}
              type="button"
              data-dialog-initial-focus={destructive ? undefined : true}
              disabled={submitting}
              onClick={onConfirm}
            >
              {submitting ? <LoaderCircle className="agent-spinner" aria-hidden="true" /> : <Check aria-hidden="true" />}
              {submitting ? "Verifying…" : destructive ? "Delete block" : "Apply structure change"}
            </button>
          </div>
        </>
      )}
    >
      {warnings.map((warning) => (
        <div className="document-structure-warning" key={warning}>
          <AlertTriangle aria-hidden="true" />
          <span>{warning}</span>
        </div>
      ))}
      {error && <div className="import-review-error" role="alert">{error}</div>}
      <article className="document-structure-diff">
        <header><span>Canonical source diff</span><strong>{artifactName}</strong></header>
        <pre>{diff.map((line, index) => (
          <code className={line.kind} key={`${line.kind}-${index}`}>
            <span>{line.kind === "addition" ? "+" : line.kind === "removal" ? "−" : " "}</span>{line.text || " "}
          </code>
        ))}</pre>
      </article>
    </ReviewDialog>
  );
}
