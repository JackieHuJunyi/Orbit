"use client";

import {
  Check,
  ChevronRight,
  FileArchive,
  FileCode2,
  FileText,
  ShieldCheck,
  TriangleAlert,
} from "lucide-react";
import type { ArtifactExportResult } from "../lib/export-contract";
import { runeUICopy, type RuneLocale } from "../lib/localization";
import { ReviewDialog } from "./review-dialog";

function readableBytes(bytes: number) {
  if (bytes < 1_024) return `${bytes} B`;
  if (bytes < 1_048_576) return `${(bytes / 1_024).toFixed(1)} KB`;
  return `${(bytes / 1_048_576).toFixed(1)} MB`;
}

export function ExportReviewDialog({
  sourceName,
  result,
  error,
  locale,
  onCancel,
  onConfirm,
}: {
  sourceName: string;
  result: ArtifactExportResult;
  error?: string;
  locale: RuneLocale;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const target = result.targetType.toUpperCase();
  const office = ["doc", "ppt", "docx", "xlsx", "pptx"].includes(result.targetType);
  const odf = ["odt", "ods", "odp"].includes(result.targetType);
  const pdf = result.targetType === "pdf";
  const data = ["csv", "json"].includes(result.targetType);
  const kind = office ? "office" : odf ? "odf" : pdf ? "pdf" : data ? "data" : "html";
  const copy = runeUICopy(locale);
  const reviewTitle = copy.exportReview.title(kind);
  const descriptor = copy.exportReview.descriptors[kind];
  const outputKind = office || odf ? copy.exportReview.outputKinds.semantic : pdf ? copy.exportReview.outputKinds.fixed : data ? copy.exportReview.outputKinds.portable : copy.exportReview.outputKinds.standalone;
  return (
    <ReviewDialog
      dialogId="artifact-export-review"
      kicker={<><ShieldCheck aria-hidden="true" /> {copy.exportReview.kicker}</>}
      title={reviewTitle}
      description={copy.exportReview.description(sourceName, outputKind, target)}
      detailsLabel={copy.exportReview.details(target)}
      locale={locale}
      onCancel={onCancel}
      footer={(
        <>
          <div><ShieldCheck aria-hidden="true" /> {copy.exportReview.noChanges}</div>
          <span>
            <button className="button ghost-button" onClick={onCancel}>{copy.common.cancel}</button>
            <button className="button primary-button" onClick={onConfirm}><Check aria-hidden="true" /> {copy.exportReview.download(target)}</button>
          </span>
        </>
      )}
    >
      <div className="office-export-route" aria-label={copy.exportReview.route(target)}>
        <span>{sourceName}</span>
        <ChevronRight aria-hidden="true" />
        <strong>{result.fileName}</strong>
      </div>

      <section className="office-export-summary" aria-label={copy.exportReview.generatedFile(target)}>
        <span className="office-export-icon">{office || odf ? <FileArchive aria-hidden="true" /> : pdf ? <FileText aria-hidden="true" /> : <FileCode2 aria-hidden="true" />}</span>
        <div>
          <strong>{result.fileName}</strong>
          <small>{target} · {readableBytes(result.bytes.length)} · {descriptor}</small>
        </div>
        <span className="office-export-ready">{copy.common.ready}</span>
      </section>

      <section className="import-warning-panel" aria-labelledby="artifact-export-warning-title">
        <div className="import-warning-heading">
          <TriangleAlert aria-hidden="true" />
          <h3 id="artifact-export-warning-title">{copy.exportReview.fidelityNotes}</h3>
          <span>{result.warnings.length}</span>
        </div>
        <ul>{result.warnings.map((warning) => <li key={warning}>{warning}</li>)}</ul>
      </section>

      {error && <div className="import-review-error" role="alert">{error}</div>}

      <div className="office-export-contract">
        <div><span>01</span><strong>{copy.exportReview.canonicalTitle}</strong><p>{copy.exportReview.canonicalBody}</p></div>
        <div><span>02</span><strong>{copy.exportReview.packageTitle(office || odf)}</strong><p>{copy.exportReview.packageBody(kind)}</p></div>
        <div><span>03</span><strong>{copy.exportReview.handoffTitle}</strong><p>{copy.exportReview.handoffBody}</p></div>
      </div>
    </ReviewDialog>
  );
}
