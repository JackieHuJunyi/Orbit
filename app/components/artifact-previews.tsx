"use client";

import { Fragment, useEffect, useState, type CSSProperties, type KeyboardEvent, type MouseEvent } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  AlertTriangle,
  Braces,
  CheckCircle2,
  Clock3,
  Columns3,
  LoaderCircle,
  MousePointer2,
  Rows3,
} from "lucide-react";
import { parseDataSource, type DataCell, type WorkspaceArtifact } from "../lib/workspace";
import { compileArtifactSource } from "../lib/bindings";
import {
  renderChartReferencesToHtml,
  resolveChartModel,
  tokenizeChartReferences,
  type ChartModel,
} from "../lib/charts";
import { compileDeckSource, isDeckMarkdownArtifact } from "../lib/deck";
import type { QueryCell, WorkspaceQueryResult } from "../lib/duckdb-client";
import {
  derivePreviewSourceTargets,
  previewTargetIsActive,
  resolveDataRowPreviewTargets,
  type PreviewSourceTarget,
} from "../lib/preview-targets";
import type { SourceSelection } from "../lib/source-selection";

type GridCell = DataCell | QueryCell;
type PreviewTargetHandler = (
  artifact: WorkspaceArtifact,
  target: PreviewSourceTarget,
  viaLabel?: string,
) => void;

function EmptyPreview({ message }: { message: string }) {
  return (
    <div className="empty-preview">
      <AlertTriangle aria-hidden="true" />
      <p>{message}</p>
    </div>
  );
}

function ChartFigure({
  model,
  artifacts,
  embedded = false,
  onTargetSource,
}: {
  model: ChartModel;
  artifacts: WorkspaceArtifact[];
  embedded?: boolean;
  onTargetSource?: PreviewTargetHandler;
}) {
  const sourceRows = resolveDataRowPreviewTargets(model.sourceArtifactId, artifacts);
  const rows = model.data.map((datum) => ({
    datum,
    target: sourceRows?.targets.find((target) => target.index === datum.sourceRowIndex),
  }));
  const hasTargetableRows = Boolean(onTargetSource && sourceRows && rows.some((row) => row.target));
  return (
    <figure
      className={`chart-card ${embedded ? "embedded" : ""}`}
      style={{ "--chart-accent": model.spec.color } as CSSProperties}
      aria-label={model.spec.title}
    >
      <figcaption>
        <div><span>Live chart</span><strong>{model.spec.title}</strong></div>
        <p>{model.spec.description || `${model.spec.value} by ${model.spec.category}`}</p>
      </figcaption>
      <div className="chart-bars">
        {rows.map(({ datum, target }) => {
          const openSource = sourceRows && target && onTargetSource
            ? () => onTargetSource(
                sourceRows.artifact,
                target,
                `${model.spec.title} · ${datum.label}`,
              )
            : undefined;
          return (
            <div
              className={`chart-bar-row ${openSource ? "preview-chart-target" : ""}`.trim()}
              data-chart-source-row={datum.sourceRowIndex}
              key={datum.sourceRowIndex}
              role={openSource ? "button" : undefined}
              tabIndex={openSource ? 0 : undefined}
              aria-label={openSource ? `Open ${target?.label} in ${sourceRows?.artifact.name} as Agent context` : undefined}
              title={openSource ? `Open canonical row in ${sourceRows?.artifact.name}` : undefined}
              onClick={openSource}
              onKeyDown={openSource ? (event) => activateTargetFromKeyboard(event, openSource) : undefined}
            >
              <span title={datum.label}>{datum.label}</span>
              <div className="chart-bar-track"><i style={{ width: `${datum.ratio * 100}%` }} /></div>
              <strong>{datum.formatted}</strong>
            </div>
          );
        })}
      </div>
      <footer><span>{model.spec.value}</span><span>{model.sourceArtifactName} · {model.data.length} marks{hasTargetableRows ? " · Click a bar to open its canonical data row" : ""}</span></footer>
    </figure>
  );
}

function EmbeddedChart({
  chartId,
  artifacts,
  onTargetSource,
}: {
  chartId: string;
  artifacts: WorkspaceArtifact[];
  onTargetSource?: PreviewTargetHandler;
}) {
  const chartArtifact = artifacts.find((artifact) => artifact.id === chartId && artifact.kind === "chart");
  if (!chartArtifact) return <div className="embedded-chart-error">Chart not found · {chartId}</div>;
  const resolution = resolveChartModel(chartArtifact, artifacts, parseDataSource);
  if (!resolution.model) return <div className="embedded-chart-error">Chart unavailable · {resolution.errors[0]}</div>;
  return <ChartFigure model={resolution.model} artifacts={artifacts} embedded onTargetSource={onTargetSource} />;
}

function MarkdownSource({
  source,
  artifacts,
  onTargetSource,
}: {
  source: string;
  artifacts: WorkspaceArtifact[];
  onTargetSource?: PreviewTargetHandler;
}) {
  const parts = tokenizeChartReferences(source);
  return (
    <>
      {parts.map((part, index) => (
        <Fragment key={`${part.type}-${index}`}>
          {part.type === "source"
            ? <ReactMarkdown remarkPlugins={[remarkGfm]}>{part.value}</ReactMarkdown>
            : <EmbeddedChart chartId={part.value} artifacts={artifacts} onTargetSource={onTargetSource} />}
        </Fragment>
      ))}
    </>
  );
}

function activateTargetFromContainer(
  event: MouseEvent<HTMLElement>,
  activate?: () => void,
) {
  if (!activate || (event.target as HTMLElement).closest("a, button, input")) return;
  activate();
}

function activateTargetFromKeyboard(
  event: KeyboardEvent<HTMLElement>,
  activate?: () => void,
) {
  if (!activate || (event.key !== "Enter" && event.key !== " ")) return;
  event.preventDefault();
  activate();
}

function DocumentPreview({
  artifact,
  artifacts,
  targets,
  activeSelection,
  onTargetSource,
}: {
  artifact: WorkspaceArtifact;
  artifacts: WorkspaceArtifact[];
  targets: PreviewSourceTarget[];
  activeSelection?: SourceSelection | null;
  onTargetSource?: PreviewTargetHandler;
}) {
  const compiled = compileArtifactSource(artifact.source, artifacts);
  return (
    <div className="document-stage">
      <article className="document-paper">
        <div className="paper-meta">
          <span>Rune document</span>
          <span>{onTargetSource && targets.length ? "Click a section for Agent" : "Live compilation"}</span>
        </div>
        {onTargetSource && targets.length > 0 && (
          <nav className="document-targets" aria-label="Select a document section as Agent context">
            {targets.map((target) => {
              const active = previewTargetIsActive(target, activeSelection);
              return (
                <button
                  className={active ? "active" : ""}
                  data-preview-source-target={target.kind}
                  key={target.id}
                  type="button"
                  aria-label={`Select ${target.label} in canonical source for Agent context`}
                  aria-pressed={active}
                  onClick={() => onTargetSource(artifact, target)}
                >
                  <MousePointer2 aria-hidden="true" /> <span>{target.label}</span>
                </button>
              );
            })}
          </nav>
        )}
        <div className="markdown-body">
          <MarkdownSource source={compiled.source} artifacts={artifacts} onTargetSource={onTargetSource} />
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
  rowTargets,
  targetArtifact,
  activeSelection,
  onTargetSource,
}: {
  columns: string[];
  rows: GridCell[][];
  badges: Array<{ icon: "rows" | "columns" | "format" | "time"; label: string }>;
  footnote: string;
  rowTargets?: PreviewSourceTarget[];
  targetArtifact?: WorkspaceArtifact;
  activeSelection?: SourceSelection | null;
  onTargetSource?: PreviewTargetHandler;
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
            {rows.map((row, rowIndex) => {
              const target = rowTargets?.[rowIndex];
              const activate = target && targetArtifact && onTargetSource
                ? () => onTargetSource(targetArtifact, target)
                : undefined;
              const selectable = Boolean(activate);
              const active = Boolean(target && previewTargetIsActive(target, activeSelection));
              return (
              <tr
                className={`${selectable ? "preview-data-target" : ""} ${active ? "active" : ""}`.trim() || undefined}
                key={rowIndex}
                tabIndex={selectable ? 0 : undefined}
                aria-label={selectable ? `Select ${target?.label} in canonical source for Agent context` : undefined}
                onClick={activate ? (event) => activateTargetFromContainer(event, activate) : undefined}
                onKeyDown={activate ? (event) => activateTargetFromKeyboard(event, activate) : undefined}
              >
                <th className="row-index">{rowIndex + 1}</th>
                {columns.map((column, columnIndex) => {
                  const value = row[columnIndex];
                  const numeric = typeof value === "number";
                  return <td key={`${column}-${columnIndex}`} className={numeric ? "numeric" : undefined}>{value == null ? "—" : String(value)}</td>;
                })}
              </tr>
              );
            })}
          </tbody>
        </table>
        {!rows.length && <div className="empty-grid-result">Query completed with no rows.</div>}
      </div>
      <div className="data-footnote"><CheckCircle2 aria-hidden="true" /> {footnote}</div>
    </div>
  );
}

function DataPreview({
  artifact,
  targets,
  activeSelection,
  onTargetSource,
}: {
  artifact: WorkspaceArtifact;
  targets: PreviewSourceTarget[];
  activeSelection?: SourceSelection | null;
  onTargetSource?: PreviewTargetHandler;
}) {
  const parsed = parseDataSource(artifact.source);
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
      footnote={onTargetSource && targets.length
        ? "Parsed locally — click a row to bind exact Agent context."
        : "Parsed locally — no rows left this device."}
      rowTargets={targets}
      targetArtifact={artifact}
      activeSelection={activeSelection}
      onTargetSource={onTargetSource}
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

function ChartPreview({
  artifact,
  artifacts,
  onTargetSource,
}: {
  artifact: WorkspaceArtifact;
  artifacts: WorkspaceArtifact[];
  onTargetSource?: PreviewTargetHandler;
}) {
  const resolution = resolveChartModel(artifact, artifacts, parseDataSource);
  if (!resolution.model) return <EmptyPreview message={resolution.errors[0] ?? "The chart could not compile."} />;
  return <div className="chart-stage"><ChartFigure model={resolution.model} artifacts={artifacts} onTargetSource={onTargetSource} /></div>;
}

function SlidesPreview({
  artifact,
  source,
  artifacts,
  targets,
  activeSelection,
  onTargetSource,
}: {
  artifact: WorkspaceArtifact;
  source: string;
  artifacts: WorkspaceArtifact[];
  targets: PreviewSourceTarget[];
  activeSelection?: SourceSelection | null;
  onTargetSource?: PreviewTargetHandler;
}) {
  const deckCompilation = isDeckMarkdownArtifact(artifact) ? compileDeckSource(source) : null;
  if (deckCompilation?.errors.length) return <EmptyPreview message={deckCompilation.errors[0]} />;
  const runtimeSource = deckCompilation?.html ?? source;
  const slideCount = deckCompilation?.slideCount ?? source.match(/<section[\s>]/gi)?.length ?? 0;
  const renderedSource = renderChartReferencesToHtml(runtimeSource, (chartArtifactId) => {
    const chartArtifact = artifacts.find((artifact) => artifact.id === chartArtifactId && artifact.kind === "chart");
    return chartArtifact
      ? resolveChartModel(chartArtifact, artifacts, parseDataSource)
      : { errors: [`Chart not found: ${chartArtifactId}`] };
  });
  return (
    <div className="slides-stage">
      <div className="slides-stage-meta"><span>{slideCount} slides</span><span>{deckCompilation ? "Deck Markdown → sandboxed HTML" : "Legacy sandboxed HTML"}</span></div>
      {onTargetSource && targets.length > 0 && (
        <nav className="slide-targets" aria-label="Select a slide as Agent context">
          {targets.map((target) => {
            const active = previewTargetIsActive(target, activeSelection);
            return (
              <button
                className={active ? "active" : ""}
                key={target.id}
                type="button"
                aria-pressed={active}
                onClick={() => onTargetSource(artifact, target)}
                title={`Select ${target.label} in canonical source`}
              >
                <span>{String(target.index + 1).padStart(2, "0")}</span>
                <strong>{target.label}</strong>
              </button>
            );
          })}
        </nav>
      )}
      <iframe
        className="slides-frame"
        srcDoc={renderedSource}
        sandbox=""
        title="Rendered presentation preview"
      />
    </div>
  );
}

export function ArtifactPreview({
  artifact,
  artifacts,
  activeSelection,
  onTargetSource,
}: {
  artifact: WorkspaceArtifact;
  artifacts: WorkspaceArtifact[];
  activeSelection?: SourceSelection | null;
  onTargetSource?: PreviewTargetHandler;
}) {
  if (!artifact.source.trim()) return <EmptyPreview message="Start writing to compile a preview." />;
  const compiled = compileArtifactSource(artifact.source, artifacts);
  const targets = derivePreviewSourceTargets(artifact);
  if (artifact.kind === "document") return <DocumentPreview artifact={artifact} artifacts={artifacts} targets={targets} activeSelection={activeSelection} onTargetSource={onTargetSource} />;
  if (artifact.kind === "data") return <DataPreview artifact={artifact} targets={targets} activeSelection={activeSelection} onTargetSource={onTargetSource} />;
  if (artifact.kind === "query") {
    return <QueryPreview source={artifact.source} dataArtifact={artifacts.find((item) => item.kind === "data")} />;
  }
  if (artifact.kind === "chart") return <ChartPreview artifact={artifact} artifacts={artifacts} onTargetSource={onTargetSource} />;
  return <SlidesPreview artifact={artifact} source={compiled.source} artifacts={artifacts} targets={targets} activeSelection={activeSelection} onTargetSource={onTargetSource} />;
}
