"use client";

import { Fragment, useEffect, useMemo, useState, type CSSProperties } from "react";
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
import { compileArtifactSource, queryMetricSourceIdsForArtifact } from "../lib/bindings";
import {
  chartQuerySourceIdsForArtifact,
  parseChartSource,
  renderChartReferencesToHtml,
  resolveChartModel,
  tokenizeChartReferences,
  type ChartCellProvenance,
  type ChartModel,
  type ChartResolution,
} from "../lib/charts";
import { compileDeckSource, isDeckMarkdownArtifact } from "../lib/deck";
import type {
  QueryCell,
  WorkspaceQuerySnapshot,
} from "../lib/query-snapshot";
import { resolveQueryDataArtifact } from "../lib/query-source";
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

type QueryRuntimeEntry =
  | { status: "loading" }
  | { status: "ready"; snapshot: WorkspaceQuerySnapshot }
  | { status: "error"; error: string };

type QueryRuntime = Record<string, QueryRuntimeEntry>;

function usePreviewQueryRuntime(
  artifact: WorkspaceArtifact,
  artifacts: WorkspaceArtifact[],
): QueryRuntime {
  const requiredQueryIds = useMemo(() => {
    if (artifact.kind === "query") return [artifact.id];
    const ids = new Set([
      ...chartQuerySourceIdsForArtifact(artifact, artifacts),
      ...queryMetricSourceIdsForArtifact(artifact.source),
    ]);
    return artifacts
      .filter((candidate) => candidate.kind === "query" && ids.has(candidate.id))
      .map((candidate) => candidate.id);
  }, [artifact, artifacts]);
  const queryArtifacts = useMemo(() => requiredQueryIds.flatMap((queryId) => {
    const query = artifacts.find((candidate) => candidate.id === queryId && candidate.kind === "query");
    return query ? [query] : [];
  }), [artifacts, requiredQueryIds]);
  const queryBindings = useMemo(() => queryArtifacts.map((query) => ({
    query,
    resolution: resolveQueryDataArtifact(query, artifacts),
  })), [artifacts, queryArtifacts]);
  const revisionKey = useMemo(() => JSON.stringify({
    queries: queryBindings.map(({ query, resolution }) => [
      query.id,
      query.source,
      resolution.artifact?.id ?? null,
      resolution.artifact?.source ?? null,
      resolution.errors,
    ]),
  }), [queryBindings]);
  const [runtime, setRuntime] = useState<{ revisionKey: string; entries: QueryRuntime }>({
    revisionKey: "",
    entries: {},
  });

  useEffect(() => {
    if (!queryBindings.length) return;
    let active = true;
    const timer = window.setTimeout(() => {
      const blockedEntries = queryBindings.flatMap(({ query, resolution }) => (
        resolution.artifact ? [] : [[query.id, {
          status: "error" as const,
          error: resolution.errors[0] ?? "Add a CSV or JSON artifact before running SQL.",
        }] as const]
      ));
      const runnableBindings = queryBindings.filter(({ resolution }) => Boolean(resolution.artifact));
      if (!runnableBindings.length) {
        setRuntime({ revisionKey, entries: Object.fromEntries(blockedEntries) });
        return;
      }
      void import("../lib/duckdb-client")
        .then(async ({ runWorkspaceQuerySnapshot }) => Promise.all(runnableBindings.map(async ({ query, resolution }) => {
          if (!resolution.artifact) throw new Error("The Query Data source changed before execution.");
          try {
            return [query.id, {
              status: "ready",
              snapshot: await runWorkspaceQuerySnapshot(query, resolution.artifact),
            }] as const;
          } catch (error) {
            return [query.id, {
              status: "error",
              error: error instanceof Error
                ? error.message.replace(/^Error:\s*/i, "")
                : "DuckDB could not run this query.",
            }] as const;
          }
        })))
        .then((entries) => {
          if (active) setRuntime({ revisionKey, entries: Object.fromEntries([...blockedEntries, ...entries]) });
        })
        .catch((error: unknown) => {
          if (!active) return;
          const message = error instanceof Error
            ? error.message.replace(/^Error:\s*/i, "")
            : "DuckDB could not load in this browser.";
          setRuntime({
            revisionKey,
            entries: Object.fromEntries([
              ...blockedEntries,
              ...runnableBindings.map(({ query }) => [query.id, { status: "error", error: message }] as const),
            ]),
          });
        });
    }, 350);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [queryBindings, revisionKey]);

  if (!queryBindings.length) return {};
  if (runtime.revisionKey !== revisionKey) {
    return Object.fromEntries(queryBindings.map(({ query }) => [query.id, { status: "loading" }]));
  }
  return Object.fromEntries(queryBindings.map(({ query }) => [
    query.id,
    runtime.entries[query.id] ?? { status: "loading" },
  ]));
}

function resolvePreviewChart(
  chartArtifact: WorkspaceArtifact,
  artifacts: WorkspaceArtifact[],
  queryRuntime: QueryRuntime,
): ChartResolution {
  const spec = parseChartSource(chartArtifact.source).spec;
  const source = spec ? artifacts.find((candidate) => candidate.id === spec.source) : undefined;
  if (source?.kind === "query") {
    const entry = queryRuntime[source.id];
    if (!entry || entry.status === "loading") return { errors: [`Running query source locally: ${source.name}`] };
    if (entry.status === "error") return { errors: [`Query source: ${entry.error}`] };
    return resolveChartModel(chartArtifact, artifacts, parseDataSource, [entry.snapshot]);
  }
  return resolveChartModel(chartArtifact, artifacts, parseDataSource);
}

function readyQuerySnapshots(queryRuntime: QueryRuntime) {
  return Object.values(queryRuntime).flatMap((entry) => (
    entry.status === "ready" ? [entry.snapshot] : []
  ));
}

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
  const provenanceArtifactIds = new Set(model.data.flatMap((datum) => (
    [datum.categoryProvenance?.artifactId, datum.valueProvenance?.artifactId]
      .filter((artifactId): artifactId is string => Boolean(artifactId))
  )));
  const sourceTargetsByArtifact = new Map([...provenanceArtifactIds].flatMap((artifactId) => {
    const targets = resolveDataPreviewSourceTargets(artifactId, artifacts);
    return targets ? [[artifactId, targets] as const] : [];
  }));
  const resolveProvenance = (provenance: ChartCellProvenance | null) => {
    if (!provenance) return null;
    const sourceTargets = sourceTargetsByArtifact.get(provenance.artifactId);
    const target = sourceTargets?.cells.find((candidate) => (
      candidate.rowIndex === provenance.sourceRowIndex
      && candidate.column === provenance.sourceColumn
    ));
    return sourceTargets && target ? { sourceTargets, target } : null;
  };
  const rows = model.data.map((datum) => ({
    datum,
    categorySource: resolveProvenance(datum.categoryProvenance),
    valueSource: resolveProvenance(datum.valueProvenance),
  }));
  const hasTargetableCells = Boolean(onTargetSource && rows.some((row) => (
    row.categorySource || row.valueSource
  )));
  return (
    <figure
      className={`chart-card ${embedded ? "embedded" : ""}`}
      style={{ "--chart-accent": model.spec.color } as CSSProperties}
      aria-label={model.spec.title}
    >
      <figcaption>
        <div><span>Live chart{model.sourceArtifactKind === "query" ? " · Query output" : ""}</span><strong>{model.spec.title}</strong></div>
        <p>{model.spec.description || `${model.spec.value} by ${model.spec.category}`}</p>
      </figcaption>
      <div className="chart-bars">
        {rows.map(({ datum, categorySource, valueSource }) => {
          const openCategory = categorySource && onTargetSource
            ? () => onTargetSource(
                categorySource.sourceTargets.artifact,
                categorySource.target,
                `${model.spec.title} · category ${datum.label}`,
              )
            : undefined;
          const openValue = valueSource && onTargetSource
            ? () => onTargetSource(
                valueSource.sourceTargets.artifact,
                valueSource.target,
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
                  aria-label={`Open ${categorySource?.target.label} in ${categorySource?.sourceTargets.artifact.name} as Agent context`}
                  title={`Open exact ${categorySource?.target.column} source cell in ${categorySource?.sourceTargets.artifact.name}`}
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
                  aria-label={`Open ${valueSource?.target.label} in ${valueSource?.sourceTargets.artifact.name} as Agent context`}
                  title={`Open exact ${valueSource?.target.column} source cell in ${valueSource?.sourceTargets.artifact.name}`}
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
  queryRuntime,
  onTargetSource,
}: {
  chartId: string;
  artifacts: WorkspaceArtifact[];
  queryRuntime: QueryRuntime;
  onTargetSource?: PreviewTargetHandler;
}) {
  const chartArtifact = artifacts.find((artifact) => artifact.id === chartId && artifact.kind === "chart");
  if (!chartArtifact) return <div className="embedded-chart-error">Chart not found · {chartId}</div>;
  const resolution = resolvePreviewChart(chartArtifact, artifacts, queryRuntime);
  if (!resolution.model) return <div className="embedded-chart-error">Chart unavailable · {resolution.errors[0]}</div>;
  return <ChartFigure model={resolution.model} artifacts={artifacts} embedded onTargetSource={onTargetSource} />;
}

function MarkdownSource({
  source,
  artifacts,
  queryRuntime,
  onTargetSource,
}: {
  source: string;
  artifacts: WorkspaceArtifact[];
  queryRuntime: QueryRuntime;
  onTargetSource?: PreviewTargetHandler;
}) {
  const parts = tokenizeChartReferences(source);
  return (
    <>
      {parts.map((part, index) => (
        <Fragment key={`${part.type}-${index}`}>
          {part.type === "source"
            ? <ReactMarkdown remarkPlugins={[remarkGfm]}>{part.value}</ReactMarkdown>
            : <EmbeddedChart chartId={part.value} artifacts={artifacts} queryRuntime={queryRuntime} onTargetSource={onTargetSource} />}
        </Fragment>
      ))}
    </>
  );
}

function DocumentPreview({
  artifact,
  artifacts,
  queryRuntime,
  targets,
  activeSelection,
  onTargetSource,
}: {
  artifact: WorkspaceArtifact;
  artifacts: WorkspaceArtifact[];
  queryRuntime: QueryRuntime;
  targets: PreviewSourceTarget[];
  activeSelection?: SourceSelection | null;
  onTargetSource?: PreviewTargetHandler;
}) {
  const compiled = compileArtifactSource(
    artifact.source,
    artifacts,
    readyQuerySnapshots(queryRuntime),
  );
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
          <MarkdownSource source={compiled.source} artifacts={artifacts} queryRuntime={queryRuntime} onTargetSource={onTargetSource} />
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
  cellTargetRows,
  targetArtifact,
  targetViaLabel,
  activeSelection,
  onTargetSource,
}: {
  columns: string[];
  rows: GridCell[][];
  badges: Array<{ icon: "rows" | "columns" | "format" | "time"; label: string }>;
  footnote: string;
  rowTargets?: Array<PreviewSourceTarget | undefined>;
  cellTargets?: DataCellPreviewSourceTarget[];
  cellTargetRows?: Array<Array<PreviewSourceTarget | null | undefined>>;
  targetArtifact?: WorkspaceArtifact;
  targetViaLabel?: string;
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
                ? () => onTargetSource(targetArtifact, target, targetViaLabel)
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
                  const cellTarget = cellTargetRows
                    ? cellTargetRows[rowIndex]?.[columnIndex]
                    : cellsByCoordinate.get(`${rowIndex}:${columnIndex}`);
                  const activateCell = cellTarget && targetArtifact && onTargetSource
                    ? () => onTargetSource(targetArtifact, cellTarget, targetViaLabel)
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
                          title={`Select the exact canonical source cell · ${cellTarget?.label}`}
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

function QueryPreview({
  artifact,
  dataArtifact,
  runtimeEntry,
  onTargetSource,
}: {
  artifact: WorkspaceArtifact;
  dataArtifact?: WorkspaceArtifact;
  runtimeEntry?: QueryRuntimeEntry;
  onTargetSource?: PreviewTargetHandler;
}) {
  if (!runtimeEntry || runtimeEntry.status === "loading") {
    return (
      <div className="query-loading" role="status">
        <span><LoaderCircle aria-hidden="true" /></span>
        <strong>Running locally</strong>
        <p>Loading the bound Data artifact into DuckDB-Wasm…</p>
      </div>
    );
  }
  if (runtimeEntry.status === "error") return <EmptyPreview message={runtimeEntry.error} />;

  const { result } = runtimeEntry.snapshot;
  const sourceTargets = dataArtifact ? deriveDataPreviewSourceTargets(dataArtifact) : { rows: [], cells: [] };
  const rowsByIndex = new Map(sourceTargets.rows.map((target) => [target.index, target] as const));
  const cellsByCoordinate = new Map(sourceTargets.cells.map((target) => (
    [`${target.rowIndex}\u0000${target.column}`, target] as const
  )));
  const rowTargets = result.sourceRowIndices.map((sourceRowIndex) => (
    sourceRowIndex == null ? undefined : rowsByIndex.get(sourceRowIndex)
  ));
  const cellTargetRows = result.cellLineage.map((row) => row.map((lineage) => (
    lineage
      ? cellsByCoordinate.get(`${lineage.sourceRowIndex}\u0000${lineage.sourceColumn}`) ?? null
      : null
  )));
  return (
    <ResultGrid
      columns={result.columns}
      rows={result.rows}
      badges={[
        { icon: "rows", label: `${result.rows.length}${result.truncated ? "+" : ""} rows` },
        { icon: "columns", label: `${result.columns.length} columns` },
        { icon: "time", label: `${Math.max(1, Math.round(result.elapsedMs))} ms` },
      ]}
      footnote={`${result.engine} · ${dataArtifact?.name ?? "workspace_data"} stayed in this browser${result.lineageMode === "direct" ? " · result row numbers and direct fields, when present, open canonical source; derived cells stay read-only" : " · this query shape stays read-only because no one-to-one lineage was proven"}${result.truncated ? " · preview limited to 500 rows" : ""}.`}
      rowTargets={rowTargets}
      cellTargetRows={cellTargetRows}
      targetArtifact={dataArtifact}
      targetViaLabel={`Query result · ${artifact.name}`}
      onTargetSource={onTargetSource}
    />
  );
}

function ChartPreview({
  artifact,
  artifacts,
  queryRuntime,
  onTargetSource,
}: {
  artifact: WorkspaceArtifact;
  artifacts: WorkspaceArtifact[];
  queryRuntime: QueryRuntime;
  onTargetSource?: PreviewTargetHandler;
}) {
  const resolution = resolvePreviewChart(artifact, artifacts, queryRuntime);
  if (!resolution.model) return <EmptyPreview message={resolution.errors[0] ?? "The chart could not compile."} />;
  return <div className="chart-stage"><ChartFigure model={resolution.model} artifacts={artifacts} onTargetSource={onTargetSource} /></div>;
}

function SlidesPreview({
  artifact,
  source,
  artifacts,
  queryRuntime,
  targets,
  activeSelection,
  onTargetSource,
}: {
  artifact: WorkspaceArtifact;
  source: string;
  artifacts: WorkspaceArtifact[];
  queryRuntime: QueryRuntime;
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
      ? resolvePreviewChart(chartArtifact, artifacts, queryRuntime)
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
  const queryRuntime = usePreviewQueryRuntime(artifact, artifacts);
  if (!artifact.source.trim()) return <EmptyPreview message="Start writing to compile a preview." />;
  const compiled = compileArtifactSource(
    artifact.source,
    artifacts,
    readyQuerySnapshots(queryRuntime),
  );
  if (artifact.kind === "data") {
    const targets = deriveDataPreviewSourceTargets(artifact);
    return <DataPreview artifact={artifact} rowTargets={targets.rows} cellTargets={targets.cells} activeSelection={activeSelection} onTargetSource={onTargetSource} />;
  }
  const targets = derivePreviewSourceTargets(artifact);
  if (artifact.kind === "document") return <DocumentPreview artifact={artifact} artifacts={artifacts} queryRuntime={queryRuntime} targets={targets} activeSelection={activeSelection} onTargetSource={onTargetSource} />;
  if (artifact.kind === "query") {
    const dataArtifact = resolveQueryDataArtifact(artifact, artifacts).artifact;
    return <QueryPreview artifact={artifact} dataArtifact={dataArtifact} runtimeEntry={queryRuntime[artifact.id]} onTargetSource={onTargetSource} />;
  }
  if (artifact.kind === "chart") return <ChartPreview artifact={artifact} artifacts={artifacts} queryRuntime={queryRuntime} onTargetSource={onTargetSource} />;
  return <SlidesPreview artifact={artifact} source={compiled.source} artifacts={artifacts} queryRuntime={queryRuntime} targets={targets} activeSelection={activeSelection} onTargetSource={onTargetSource} />;
}
