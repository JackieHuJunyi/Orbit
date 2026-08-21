"use client";

import { ArchiveRestore, Files, History, LoaderCircle, RotateCcw, ShieldCheck } from "lucide-react";
import type { WorkspaceResetPlan } from "../lib/workspace-reset";
import { runeUICopy, type RuneLocale } from "../lib/localization";
import { ReviewDialog } from "./review-dialog";

export function WorkspaceResetDialog({
  plan,
  locale,
  error,
  submitting,
  onCancel,
  onConfirm,
}: {
  plan: WorkspaceResetPlan;
  locale: RuneLocale;
  error: string;
  submitting: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const copy = runeUICopy(locale).workspaceReset;
  const restoringRecovery = plan.mode === "recovery";
  const title = restoringRecovery ? copy.recoveryTitle : copy.sampleTitle;
  const description = restoringRecovery ? copy.recoveryDescription : copy.sampleDescription;
  const action = restoringRecovery ? copy.restorePrevious : copy.restoreSample;

  return (
    <ReviewDialog
      dialogId="workspace-reset-review"
      kicker={copy.kicker}
      title={title}
      description={description}
      detailsLabel={copy.details}
      dialogClassName="workspace-reset-dialog"
      locale={locale}
      onCancel={onCancel}
      footer={
        <>
          <span>{copy.atomic}</span>
          <div>
            <button
              className="button ghost-button"
              type="button"
              data-dialog-initial-focus
              disabled={submitting}
              onClick={onCancel}
            >
              {runeUICopy(locale).common.cancel}
            </button>
            <button className="button primary-button" type="button" disabled={submitting} onClick={onConfirm}>
              {submitting ? (
                <LoaderCircle className="agent-spinner" aria-hidden="true" />
              ) : restoringRecovery ? (
                <ArchiveRestore aria-hidden="true" />
              ) : (
                <RotateCcw aria-hidden="true" />
              )}
              {submitting ? copy.saving : action}
            </button>
          </div>
        </>
      }
    >
      <div className="workspace-reset-route" aria-label={copy.transition}>
        <div>
          <span aria-hidden="true">
            <Files />
          </span>
          <small>{copy.current}</small>
          <strong>
            {plan.current.artifactCount} {copy.filesLabel}
          </strong>
        </div>
        <span aria-hidden="true">→</span>
        <div>
          <span aria-hidden="true">{restoringRecovery ? <ArchiveRestore /> : <RotateCcw />}</span>
          <small>{restoringRecovery ? copy.previous : copy.sample}</small>
          <strong>
            {plan.target.artifactCount} {copy.filesLabel}
          </strong>
        </div>
      </div>
      <div className="workspace-reset-facts">
        <span>
          <History aria-hidden="true" />
          {plan.current.checkpointCount} {copy.checkpointsLabel}
        </span>
        <span>
          {plan.current.savedTaskCount} {copy.savedTasksLabel} · {plan.current.taskRunCount} {copy.taskRunsLabel}
        </span>
      </div>
      <div className="workspace-reset-files">
        <span>{copy.targetFiles}</span>
        <ul>
          {plan.target.artifactNames.map((name) => (
            <li key={name}>{name}</li>
          ))}
          {plan.target.hiddenArtifactCount > 0 && (
            <li>
              +{plan.target.hiddenArtifactCount} {copy.moreFiles}
            </li>
          )}
        </ul>
      </div>
      <div className="document-structure-warning workspace-reset-safety">
        <ShieldCheck aria-hidden="true" />
        <span>{restoringRecovery ? copy.recoverySafety : copy.sampleSafety}</span>
      </div>
      <p className="workspace-reset-folder-note">{copy.folderSafety}</p>
      {error && (
        <div className="import-review-error" role="alert">
          {error}
        </div>
      )}
    </ReviewDialog>
  );
}
