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
  onCancel,
  onConfirm,
}: {
  sourceName: string;
  result: ArtifactExportResult;
  error?: string;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const target = result.targetType.toUpperCase();
  const office = ["docx", "xlsx", "pptx"].includes(result.targetType);
  const odf = ["odt", "ods", "odp"].includes(result.targetType);
  const pdf = result.targetType === "pdf";
  const reviewTitle = office ? "Review Office export" : odf ? "Review OpenDocument export" : pdf ? "Review PDF export" : "Review HTML export";
  const descriptor = office ? "deterministic OOXML ZIP" : odf ? "deterministic ODF ZIP" : pdf ? "fixed-layout PDF" : "self-contained scriptless file";
  const outputKind = office || odf ? "semantic" : pdf ? "fixed-layout" : "standalone";
  return (
    <ReviewDialog
      dialogId="artifact-export-review"
      kicker={<><ShieldCheck aria-hidden="true" /> Browser-local export · no upload</>}
      title={reviewTitle}
      description={<><strong>{sourceName}</strong> will become a {outputKind} <strong>{target}</strong> file after you confirm the download.</>}
      detailsLabel={`${target} export details`}
      onCancel={onCancel}
      footer={(
        <>
          <div><ShieldCheck aria-hidden="true" /> No workspace or device draft changes</div>
          <span>
            <button className="button ghost-button" onClick={onCancel}>Cancel</button>
            <button className="button primary-button" onClick={onConfirm}><Check aria-hidden="true" /> Download {target}</button>
          </span>
        </>
      )}
    >
      <div className="office-export-route" aria-label={`${target} export route`}>
        <span>{sourceName}</span>
        <ChevronRight aria-hidden="true" />
        <strong>{result.fileName}</strong>
      </div>

      <section className="office-export-summary" aria-label={`Generated ${target} file`}>
        <span className="office-export-icon">{office || odf ? <FileArchive aria-hidden="true" /> : pdf ? <FileText aria-hidden="true" /> : <FileCode2 aria-hidden="true" />}</span>
        <div>
          <strong>{result.fileName}</strong>
          <small>{target} · {readableBytes(result.bytes.length)} · {descriptor}</small>
        </div>
        <span className="office-export-ready">Ready</span>
      </section>

      <section className="import-warning-panel" aria-labelledby="artifact-export-warning-title">
        <div className="import-warning-heading">
          <TriangleAlert aria-hidden="true" />
          <h3 id="artifact-export-warning-title">Fidelity notes</h3>
          <span>{result.warnings.length}</span>
        </div>
        <ul>{result.warnings.map((warning) => <li key={warning}>{warning}</li>)}</ul>
      </section>

      {error && <div className="import-review-error" role="alert">{error}</div>}

      <div className="office-export-contract">
        <div><span>01</span><strong>Canonical source</strong><p>Rune exports the validated source and any referenced current workspace data.</p></div>
        <div><span>02</span><strong>{office || odf ? "Standard package" : "Portable output"}</strong><p>{office ? "The download uses standard Office Open XML parts and relationships." : odf ? "The download uses standard OpenDocument content, styles, MIME, and manifest parts." : pdf ? "The download embeds its layout, Unicode font, and current data snapshots in a standard PDF." : "The download contains its layout, theme, metrics, and charts without external assets."}</p></div>
        <div><span>03</span><strong>Explicit handoff</strong><p>The browser starts one local download only after your confirmation.</p></div>
      </div>
    </ReviewDialog>
  );
}
