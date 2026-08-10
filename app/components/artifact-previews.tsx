"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { AlertTriangle, Braces, CheckCircle2, Columns3, Rows3 } from "lucide-react";
import { parseDataSource, type WorkspaceArtifact } from "../lib/workspace";
import { compileArtifactSource } from "../lib/bindings";

function EmptyPreview({ message }: { message: string }) {
  return (
    <div className="empty-preview">
      <AlertTriangle aria-hidden="true" />
      <p>{message}</p>
    </div>
  );
}

function DocumentPreview({ source }: { source: string }) {
  return (
    <div className="document-stage">
      <article className="document-paper">
        <div className="paper-meta">
          <span>Rune document</span>
          <span>Live compilation</span>
        </div>
        <div className="markdown-body">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{source}</ReactMarkdown>
        </div>
      </article>
    </div>
  );
}

function DataPreview({ source }: { source: string }) {
  const parsed = parseDataSource(source);
  if (parsed.errors.length) return <EmptyPreview message={parsed.errors[0]} />;

  return (
    <div className="data-stage">
      <div className="data-summary" aria-label="Data summary">
        <span><Rows3 aria-hidden="true" /> {parsed.rows.length} rows</span>
        <span><Columns3 aria-hidden="true" /> {parsed.columns.length} columns</span>
        <span><Braces aria-hidden="true" /> {parsed.format}</span>
      </div>
      <div className="data-grid-wrap">
        <table className="data-grid">
          <thead>
            <tr>
              <th className="row-index">#</th>
              {parsed.columns.map((column) => <th key={column}>{column}</th>)}
            </tr>
          </thead>
          <tbody>
            {parsed.rows.map((row, rowIndex) => (
              <tr key={rowIndex}>
                <th className="row-index">{rowIndex + 1}</th>
                {parsed.columns.map((column) => {
                  const value = row[column];
                  const numeric = typeof value === "number";
                  return <td key={column} className={numeric ? "numeric" : undefined}>{value == null ? "—" : String(value)}</td>;
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="data-footnote"><CheckCircle2 aria-hidden="true" /> Parsed locally — no rows left this device.</div>
    </div>
  );
}

function SlidesPreview({ source }: { source: string }) {
  const slideCount = source.match(/<section[\s>]/gi)?.length ?? 0;
  return (
    <div className="slides-stage">
      <div className="slides-stage-meta"><span>{slideCount} slides</span><span>Sandboxed HTML runtime</span></div>
      <iframe
        className="slides-frame"
        srcDoc={source}
        sandbox=""
        title="Rendered presentation preview"
      />
    </div>
  );
}

export function ArtifactPreview({ artifact, artifacts }: { artifact: WorkspaceArtifact; artifacts: WorkspaceArtifact[] }) {
  if (!artifact.source.trim()) return <EmptyPreview message="Start writing to compile a preview." />;
  const compiled = compileArtifactSource(artifact.source, artifacts);
  if (artifact.kind === "document") return <DocumentPreview source={compiled.source} />;
  if (artifact.kind === "data") return <DataPreview source={artifact.source} />;
  return <SlidesPreview source={compiled.source} />;
}
