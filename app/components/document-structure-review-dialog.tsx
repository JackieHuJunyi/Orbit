"use client";

import { AlertTriangle, Check, LoaderCircle } from "lucide-react";
import { runeUICopy, type RuneLocale } from "../lib/localization";
import { createLineDiffPreview } from "../lib/patches";
import type {
  VisualDocumentBlockStructureAction,
} from "../lib/visual-document-block-structure";
import { ReviewDialog } from "./review-dialog";

export function DocumentStructureReviewDialog({
  artifactName,
  targetLabel,
  action,
  beforeSource,
  nextSource,
  warnings,
  error,
  submitting,
  locale,
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
  locale: RuneLocale;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const diff = createLineDiffPreview(beforeSource, nextSource, 24);
  const destructive = action === "delete";
  const copy = runeUICopy(locale);
  return (
    <ReviewDialog
      dialogId="document-structure-review"
      kicker={copy.documentStructure.kicker}
      title={copy.documentStructure.actionTitles[action]}
      description={copy.documentStructure.description(targetLabel)}
      detailsLabel={copy.documentStructure.details(artifactName)}
      locale={locale}
      onCancel={onCancel}
      footer={(
        <>
          <span>{copy.documentStructure.atomic}</span>
          <div>
            <button className="button ghost-button" type="button" data-dialog-initial-focus={destructive ? true : undefined} disabled={submitting} onClick={onCancel}>{copy.common.cancel}</button>
            <button
              className={`button primary-button ${destructive ? "danger-button" : ""}`.trim()}
              type="button"
              data-dialog-initial-focus={destructive ? undefined : true}
              disabled={submitting}
              onClick={onConfirm}
            >
              {submitting ? <LoaderCircle className="agent-spinner" aria-hidden="true" /> : <Check aria-hidden="true" />}
              {submitting ? copy.documentStructure.verifying : destructive ? copy.documentStructure.deleteBlock : copy.documentStructure.apply}
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
        <header><span>{copy.documentStructure.diff}</span><strong>{artifactName}</strong></header>
        <pre>{diff.map((line, index) => (
          <code className={line.kind} key={`${line.kind}-${index}`}>
            <span>{line.kind === "addition" ? "+" : line.kind === "removal" ? "−" : " "}</span>{line.text || " "}
          </code>
        ))}</pre>
      </article>
    </ReviewDialog>
  );
}
