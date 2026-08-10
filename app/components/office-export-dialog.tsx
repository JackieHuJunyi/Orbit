"use client";

import {
  Check,
  ChevronRight,
  FileArchive,
  ShieldCheck,
  TriangleAlert,
} from "lucide-react";
import type { OfficeExportResult } from "../lib/office-export";
import { ReviewDialog } from "./review-dialog";

function readableBytes(bytes: number) {
  if (bytes < 1_024) return `${bytes} B`;
  if (bytes < 1_048_576) return `${(bytes / 1_024).toFixed(1)} KB`;
  return `${(bytes / 1_048_576).toFixed(1)} MB`;
}

export function OfficeExportDialog({
  sourceName,
  result,
  error,
  onCancel,
  onConfirm,
}: {
  sourceName: string;
  result: OfficeExportResult;
  error?: string;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <ReviewDialog
      dialogId="office-export-review"
      kicker={<><ShieldCheck aria-hidden="true" /> Browser-local export · no upload</>}
      title="Review Office export"
      description={<><strong>{sourceName}</strong> will become a semantic <strong>{result.targetType.toUpperCase()}</strong> file after you confirm the download.</>}
      detailsLabel="Office export details"
      onCancel={onCancel}
      footer={(
        <>
          <div><ShieldCheck aria-hidden="true" /> No workspace or device draft changes</div>
          <span>
            <button className="button ghost-button" onClick={onCancel}>Cancel</button>
            <button className="button primary-button" onClick={onConfirm}><Check aria-hidden="true" /> Download {result.targetType.toUpperCase()}</button>
          </span>
        </>
      )}
    >
      <div className="office-export-route" aria-label="Office export route">
        <span>{sourceName}</span>
        <ChevronRight aria-hidden="true" />
        <strong>{result.fileName}</strong>
      </div>

      <section className="office-export-summary" aria-label="Generated Office package">
        <span className="office-export-icon"><FileArchive aria-hidden="true" /></span>
        <div>
          <strong>{result.fileName}</strong>
          <small>{result.targetType.toUpperCase()} · {readableBytes(result.bytes.length)} · deterministic OOXML ZIP</small>
        </div>
        <span className="office-export-ready">Ready</span>
      </section>

      <section className="import-warning-panel" aria-labelledby="office-export-warning-title">
        <div className="import-warning-heading">
          <TriangleAlert aria-hidden="true" />
          <h3 id="office-export-warning-title">Fidelity notes</h3>
          <span>{result.warnings.length}</span>
        </div>
        <ul>{result.warnings.map((warning) => <li key={warning}>{warning}</li>)}</ul>
      </section>

      {error && <div className="import-review-error" role="alert">{error}</div>}

      <div className="office-export-contract">
        <div><span>01</span><strong>Canonical source</strong><p>Rune exports the validated source and any referenced current workspace data.</p></div>
        <div><span>02</span><strong>Standard package</strong><p>The download uses standard Office Open XML parts and relationships.</p></div>
        <div><span>03</span><strong>Explicit handoff</strong><p>The browser starts one local download only after your confirmation.</p></div>
      </div>
    </ReviewDialog>
  );
}
