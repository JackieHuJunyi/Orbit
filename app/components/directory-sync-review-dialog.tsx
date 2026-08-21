"use client";

import { ArrowDown, Check, FolderInput, FolderOutput, HardDrive, LoaderCircle, ShieldCheck } from "lucide-react";
import type { DirectorySyncPlan } from "../lib/directory-sync";
import { runeUICopy, type RuneLocale } from "../lib/localization";
import { ReviewDialog } from "./review-dialog";

const MAX_VISIBLE_CHANGES = 12;

export function DirectorySyncReviewDialog({
  plan,
  locale,
  error,
  submitting,
  onCancel,
  onConfirm,
}: {
  plan: DirectorySyncPlan;
  locale: RuneLocale;
  error: string;
  submitting: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const copy = runeUICopy(locale).directorySync;
  const pulling = plan.mode === "pull";
  const initializing = plan.mode === "initialize";
  const title = pulling ? copy.pullTitle : initializing ? copy.initializeTitle : copy.pushTitle;
  const description = pulling ? copy.pullDescription : initializing ? copy.initializeDescription : copy.pushDescription;
  const action = pulling ? copy.pull : initializing ? copy.initialize : copy.push;
  const source = pulling ? plan.folder : plan.device;
  const visibleChanges = plan.changes.filter((change) => change.kind !== "unchanged").slice(0, MAX_VISIBLE_CHANGES);
  const hiddenChanges = Math.max(
    0,
    plan.changes.filter((change) => change.kind !== "unchanged").length - visibleChanges.length,
  );
  const statusCopy = {
    add: copy.add,
    update: copy.update,
    remove: copy.remove,
    retain: copy.retain,
    unchanged: copy.unchanged,
  } as const;

  return (
    <ReviewDialog
      dialogId="directory-sync-review"
      kicker={copy.kicker}
      title={title}
      description={description}
      detailsLabel={copy.details}
      dialogClassName="directory-sync-dialog"
      locale={locale}
      onCancel={onCancel}
      footer={
        <>
          <span>{copy.exactRecheck}</span>
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
              ) : (
                <Check aria-hidden="true" />
              )}
              {submitting ? copy.syncing : action}
            </button>
          </div>
        </>
      }
    >
      <div className="directory-sync-route" aria-label={copy.afterSync}>
        <div>
          <span aria-hidden="true">{pulling ? <FolderInput /> : <HardDrive />}</span>
          <small>{pulling ? plan.directoryName : copy.device}</small>
          <strong>
            {source.artifactCount} {copy.filesLabel}
          </strong>
          <em>
            {source.assetCount} {copy.assetsLabel}
          </em>
        </div>
        <ArrowDown aria-hidden="true" />
        <div>
          <span aria-hidden="true">{pulling ? <HardDrive /> : <FolderOutput />}</span>
          <small>{pulling ? copy.device : plan.directoryName}</small>
          <strong>
            {plan.target.artifactCount} {copy.filesLabel}
          </strong>
          <em>
            {plan.target.assetCount} {copy.assetsLabel}
          </em>
        </div>
      </div>

      <section className="directory-sync-changes" aria-label={copy.changes}>
        <header>
          <strong>{copy.changes}</strong>
          <span>
            {plan.changedCount} · {plan.unchangedCount} {copy.unchanged}
          </span>
        </header>
        <ul>
          {visibleChanges.map((change) => (
            <li key={`${change.entryType}:${change.kind}:${change.name}`} data-sync-kind={change.kind}>
              <span>{statusCopy[change.kind]}</span>
              <code>
                <small>{change.entryType === "asset" ? copy.imageEntry : copy.fileEntry}</small>
                {change.name}
              </code>
            </li>
          ))}
          {hiddenChanges > 0 && (
            <li data-sync-kind="unchanged">
              <span>+{hiddenChanges}</span>
              <code>{copy.changes}</code>
            </li>
          )}
        </ul>
      </section>

      {plan.retainedCount > 0 && <p className="directory-sync-retained">{copy.retainedNote}</p>}
      <div className="document-structure-warning directory-sync-safety">
        <ShieldCheck aria-hidden="true" />
        <span>{pulling ? copy.pullSafety : initializing ? copy.initializeSafety : copy.pushSafety}</span>
      </div>
      {error && (
        <div className="import-review-error" role="alert">
          {error}
        </div>
      )}
    </ReviewDialog>
  );
}
