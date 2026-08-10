"use client";

import { Fragment, useEffect, useState, type CSSProperties } from "react";
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
  deriveDataPreviewSourceTargets,
  derivePreviewSourceTargets,
  previewTargetIsActive,
  resolveDataPreviewSourceTargets,
  type DataCellPreviewSourceTarget,
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
  const sourceTargets = resolveDataPreviewSourceTargets(model.sourceArtifactId, artifacts);
  const cellsByCoordinate = new Map(sourceTargets?.cells.map((target) => (
    [`${target.rowIndex}\u0000${target.column}`, target] as const
  )));
  const rows = model.data.map((datum) => ({
    datum,
    categoryTarget: cellsByCoordinate.get(`${datum.sourceRowIndex}\u0000${model.spec.category}`),
    valueTarget: cellsByCoordinate.get(`${datum.sourceRowIndex}\u0000${model.spec.value}`),
  }));
  const hasTargetableCells = Boolean(onTargetSource && sourceTargets && rows.some((row) => (
    row.categoryTarget || row.valueTarget
  )));
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
        {rows.map(({ datum, categoryTarget, valueTarget }) => {
          const openCategory = sourceTargets && categoryTarget && onTargetSource
            ? () => onTargetSource(
                sourceTargets.artifact,
                categoryTarget,
                `${model.spec.title} · category ${datum.label}`,
              )
            : undefined;
          const openValue = sourceTargets && valueTarget && onTargetSource
            ? () => onTargetSource(
                sourceTargets.artifact,
                valueTarget,
                `${model.spec.title} · value ${datum.formatted}`,
              )
            : undefined;
          return (
            <div
              className="chart-bar-row"
              data-chart-source-row={datum.sourceRowIndex}
              key={datum.sourceRowIndex}
            >
              {openCategory ? (
                <button
                  className="chart-source-cell chart-category-cell"
                  data-chart-source-cell="category"
                  type="button"
                  aria-label={`Open ${categoryTarget?.label} in ${sourceTargets?.artifact.name} as Agent context`}
                  title={`Open exact ${model.spec.category} source cell in ${sourceTargets?.artifact.name}`}
                  onClick={openCategory}
                >
                  <span title={datum.label}>{datum.label}</span>
                </button>
              ) : <span title={datum.label}>{datum.label}</span>}
              {openValue ? (
                <button
                  className="chart-source-cell chart-value-cell"
                  data-chart-source-cell="value"
                  type="button"
                  aria-label={`Open ${valueTarget?.label} in ${sourceTargets?.artifact.name} as Agent context`}
                  title={`Open exact ${model.spec.value} source cell in ${sourceTargets?.artifact.name}`}
                  onClick={openValue}
                >
                  <span className="chart-bar-track"><i style={{ width: `${datum.ratio * 100}%` }} /></span>
                  <strong>{datum.formatted}</strong>
                </button>
              ) : (
                <>
                  <div className="chart-bar-track"><i style={{ width: `${datum.ratio * 100}%` }} /></div>
                  <strong>{datum.formatted}</strong>
                </>
              )}
            </div>
          );
        })}
      </div>
      <footer><span>{model.spec.value}</span><span>{model.sourceArtifactName} · {model.data.length} marks{hasTargetableCells ? " · Click a label or bar to open its exact source cell" : ""}</span></footer>
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
  cellTargets,
  targetArtifact,
  activeSelection,
  onTargetSource,
}: {
  columns: string[];
  rows: GridCell[][];
  badges: Array<{ icon: "rows" | "columns" | "format" | "time"; label: string }>;
  footnote: string;
  rowTargets?: PreviewSourceTarget[];
  cellTargets?: DataCellPreviewSourceTarget[];
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
  const cellsByCoordinate = new Map(cellTargets?.map((target) => (
    [`${target.rowIndex}:${target.columnIndex}`, target] as const
  )));

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
              const active = Boolean(target && previewTargetIsActive(target, activeSelection));
              return (
              <tr
                className={`${activate ? "preview-data-target" : ""} ${active ? "active" : ""}`.trim() || undefined}
                key={rowIndex}
              >
                <th className="row-index">
                  {activate ? (
                    <button
                      type="button"
                      data-preview-source-target={target?.kind}
                      aria-label={`Select ${target?.label} in canonical source for Agent context`}
                      aria-pressed={active}
                      title="Select the complete canonical row"
                      onClick={activate}
                    >
                      {rowIndex + 1}
                    </button>
                  ) : rowIndex + 1}
                </th>
                {columns.map((column, columnIndex) => {
                  const value = row[columnIndex];
                  const numeric = typeof value === "number";
                  const cellTarget = cellsByCoordinate.get(`${rowIndex}:${columnIndex}`);
                  const activateCell = cellTarget && targetArtifact && onTargetSource
                    ? () => onTargetSource(targetArtifact, cellTarget)
                    : undefined;
                  const cellActive = Boolean(cellTarget && previewTargetIsActive(cellTarget, activeSelection));
                  const displayValue = value == null ? "—" : String(value);
                  return (
                    <td
                      key={`${column}-${columnIndex}`}
                      className={`${numeric ? "numeric" : ""} ${activateCell ? "preview-data-cell" : ""} ${cellActive ? "active" : ""}`.trim() || undefined}
                    >
                      {activateCell ? (
                        <button
                          type="button"
                          data-preview-source-target={cellTarget?.kind}
                          aria-label={`Select ${cellTarget?.label} in canonical source for Agent context`}
                          aria-pressed={cellActive}
                          title={`Select the exact ${column} source cell`}
                          onClick={activateCell}
                        >
                          {displayValue}
                        </button>
                      ) : displayValue}
                    </td>
                  );
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
  rowTargets,
  cellTargets,
  activeSelection,
  onTargetSource,
}: {
  artifact: WorkspaceArtifact;
  rowTargets: PreviewSourceTarget[];
  cellTargets: DataCellPreviewSourceTarget[];
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
      footnote={onTargetSource && cellTargets.length
        ? "Parsed locally — click a cell for exact Agent context, or a row number for the full record."
        : onTargetSource && rowTargets.length
          ? "Parsed locally — click a row number to bind the full record as Agent context."
          : "Parsed locally — no targetable rows left this device."}
      rowTargets={rowTargets}
      cellTargets={cellTargets}
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
  if (artifact.kind === "data") {
    const targets = deriveDataPreviewSourceTargets(artifact);
    return <DataPreview artifact={artifact} rowTargets={targets.rows} cellTargets={targets.cells} activeSelection={activeSelection} onTargetSource={onTargetSource} />;
  }
  const targets = derivePreviewSourceTargets(artifact);
  if (artifact.kind === "document") return <DocumentPreview artifact={artifact} artifacts={artifacts} targets={targets} activeSelection={activeSelection} onTargetSource={onTargetSource} />;
  if (artifact.kind === "query") {
    return <QueryPreview source={artifact.source} dataArtifact={artifacts.find((item) => item.kind === "data")} />;
  }
  if (artifact.kind === "chart") return <ChartPreview artifact={artifact} artifacts={artifacts} onTargetSource={onTargetSource} />;
  return <SlidesPreview artifact={artifact} source={compiled.source} artifacts={artifacts} targets={targets} activeSelection={activeSelection} onTargetSource={onTargetSource} />;
}
