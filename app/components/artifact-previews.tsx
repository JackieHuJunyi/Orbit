"use client";

import { useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  AlertTriangle,
  Braces,
  CheckCircle2,
  Clock3,
  Columns3,
  LoaderCircle,
  Rows3,
} from "lucide-react";
import { parseDataSource, type DataCell, type WorkspaceArtifact } from "../lib/workspace";
import { compileArtifactSource } from "../lib/bindings";
import type { QueryCell, WorkspaceQueryResult } from "../lib/duckdb-client";

type GridCell = DataCell | QueryCell;

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

function ResultGrid({
  columns,
  rows,
  badges,
  footnote,
}: {
  columns: string[];
  rows: GridCell[][];
  badges: Array<{ icon: "rows" | "columns" | "format" | "time"; label: string }>;
  footnote: string;
}) {
  const icons = {
    rows: <Rows3 aria-hidden="true" />,
    columns: <Columns3 aria-hidden="true" />,
    format: <Braces aria-hidden="true" />,
    time: <Clock3 aria-hidden="true" />,
  };

  return (
    <div className="data-stage">
      <div className="data-summary" aria-label="Result summary">
        {badges.map((badge) => <span key={`${badge.icon}-${badge.label}`}>{icons[badge.icon]} {badge.label}</span>)}
      </div>
      <div className="data-grid-wrap">
        <table className="data-grid">
          <thead>
            <tr>
              <th className="row-index">#</th>
              {columns.map((column, columnIndex) => <th key={`${column}-${columnIndex}`}>{column}</th>)}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, rowIndex) => (
              <tr key={rowIndex}>
                <th className="row-index">{rowIndex + 1}</th>
                {columns.map((column, columnIndex) => {
                  const value = row[columnIndex];
                  const numeric = typeof value === "number";
                  return <td key={`${column}-${columnIndex}`} className={numeric ? "numeric" : undefined}>{value == null ? "—" : String(value)}</td>;
                })}
              </tr>
            ))}
          </tbody>
        </table>
        {!rows.length && <div className="empty-grid-result">Query completed with no rows.</div>}
      </div>
      <div className="data-footnote"><CheckCircle2 aria-hidden="true" /> {footnote}</div>
    </div>
  );
}

function DataPreview({ source }: { source: string }) {
  const parsed = parseDataSource(source);
  if (parsed.errors.length) return <EmptyPreview message={parsed.errors[0]} />;
  return (
    <ResultGrid
      columns={parsed.columns}
      rows={parsed.rows.map((row) => parsed.columns.map((column) => row[column]))}
      badges={[
        { icon: "rows", label: `${parsed.rows.length} rows` },
        { icon: "columns", label: `${parsed.columns.length} columns` },
        { icon: "format", label: parsed.format },
      ]}
      footnote="Parsed locally — no rows left this device."
    />
  );
}

type QueryState =
  | { status: "loading"; result?: undefined; error?: undefined }
  | { status: "ready"; result: WorkspaceQueryResult; error?: undefined }
  | { status: "error"; result?: undefined; error: string };

function QueryPreview({ source, dataArtifact }: { source: string; dataArtifact?: WorkspaceArtifact }) {
  const [state, setState] = useState<QueryState>({ status: "loading" });

  useEffect(() => {
    let active = true;
    const timer = window.setTimeout(() => {
      if (!dataArtifact) {
        setState({ status: "error", error: "Add a CSV or JSON artifact before running SQL." });
        return;
      }
      setState({ status: "loading" });
      const dataFormat = dataArtifact.source.trim().startsWith("[") || dataArtifact.source.trim().startsWith("{")
        ? "JSON"
        : "CSV";
      void import("../lib/duckdb-client")
        .then(({ runWorkspaceQuery }) => runWorkspaceQuery(source, dataArtifact.source, dataFormat))
        .then((result) => { if (active) setState({ status: "ready", result }); })
        .catch((error: unknown) => {
          if (!active) return;
          const message = error instanceof Error ? error.message : "DuckDB could not run this query.";
          setState({ status: "error", error: message.replace(/^Error:\s*/i, "") });
        });
    }, 350);

    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [dataArtifact, source]);

  if (state.status === "loading") {
    return (
      <div className="query-loading" role="status">
        <span><LoaderCircle aria-hidden="true" /></span>
        <strong>Running locally</strong>
        <p>Loading the canonical dataset into DuckDB-Wasm…</p>
      </div>
    );
  }
  if (state.status === "error") return <EmptyPreview message={state.error} />;

  const { result } = state;
  return (
    <ResultGrid
      columns={result.columns}
      rows={result.rows}
      badges={[
        { icon: "rows", label: `${result.rows.length}${result.truncated ? "+" : ""} rows` },
        { icon: "columns", label: `${result.columns.length} columns` },
        { icon: "time", label: `${Math.max(1, Math.round(result.elapsedMs))} ms` },
      ]}
      footnote={`${result.engine} · workspace_data stayed in this browser${result.truncated ? " · preview limited to 500 rows" : ""}.`}
    />
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
  if (artifact.kind === "query") {
    return <QueryPreview source={artifact.source} dataArtifact={artifacts.find((item) => item.kind === "data")} />;
  }
  return <SlidesPreview source={compiled.source} />;
}
