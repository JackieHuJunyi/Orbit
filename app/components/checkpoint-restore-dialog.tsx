"use client";

import { History, LoaderCircle, RotateCcw, ShieldCheck } from "lucide-react";
import type { CheckpointRestorePlan } from "../lib/checkpoint-restore";
import { orbitUICopy, type OrbitLocale } from "../lib/localization";
import { ReviewDialog } from "./review-dialog";

export function CheckpointRestoreDialog({
  plan,
  error,
  submitting,
  locale,
  onCancel,
  onConfirm,
}: {
  plan: CheckpointRestorePlan;
  error: string;
  submitting: boolean;
  locale: OrbitLocale;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const copy = orbitUICopy(locale);
  return (
    <ReviewDialog
      dialogId="checkpoint-restore-review"
      kicker={copy.checkpointRestore.kicker}
      title={copy.checkpointRestore.title}
      description={copy.checkpointRestore.description}
      detailsLabel={copy.checkpointRestore.details}
      dialogClassName="checkpoint-restore-dialog"
      locale={locale}
      onCancel={onCancel}
      footer={
        <>
          <span>{copy.checkpointRestore.atomic}</span>
          <div>
            <button
              className="button ghost-button"
              type="button"
              data-dialog-initial-focus
              disabled={submitting}
              onClick={onCancel}
            >
              {copy.common.cancel}
            </button>
            <button className="button primary-button" type="button" disabled={submitting} onClick={onConfirm}>
              {submitting ? (
                <LoaderCircle className="agent-spinner" aria-hidden="true" />
              ) : (
                <RotateCcw aria-hidden="true" />
              )}
              {submitting ? copy.checkpointRestore.verifying : copy.checkpointRestore.restore}
            </button>
          </div>
        </>
      }
    >
      <div className="checkpoint-restore-summary">
        <span aria-hidden="true">
          <History />
        </span>
        <div>
          <strong>{plan.checkpointLabel}</strong>
          <small>{plan.artifactName}</small>
        </div>
      </div>
      <div className="document-structure-warning checkpoint-restore-safety">
        <ShieldCheck aria-hidden="true" />
        <span>{copy.checkpointRestore.safety}</span>
      </div>
      {error && (
        <div className="import-review-error" role="alert">
          {error}
        </div>
      )}
      <article className="document-structure-diff">
        <header>
          <span>{copy.checkpointRestore.diff}</span>
          <strong>{plan.artifactName}</strong>
        </header>
        <pre>
          {plan.diff.map((line, index) => (
            <code className={line.kind} key={`${line.kind}-${index}`}>
              <span>{line.kind === "addition" ? "+" : line.kind === "removal" ? "−" : " "}</span>
              {line.text || " "}
            </code>
          ))}
        </pre>
      </article>
    </ReviewDialog>
  );
}
