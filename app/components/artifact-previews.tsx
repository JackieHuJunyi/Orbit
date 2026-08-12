"use client";

import { Fragment, useEffect, useMemo, useState, type CSSProperties } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  AlertTriangle,
  Braces,
  Check,
  CheckCircle2,
  Clock3,
  Columns3,
  LoaderCircle,
  MousePointer2,
  PencilLine,
  Rows3,
  X,
} from "lucide-react";
import { parseDataSource, type DataCell, type WorkspaceArtifact } from "../lib/workspace";
import { compileArtifactSource, queryMetricSourceIdsForArtifact } from "../lib/bindings";
import {
  chartLinePoints,
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
import {
  MAX_VISUAL_DATA_CELL_CHARS,
  canVisualEditDataCell,
  visualDataCellDraft,
  visualDataCellValueType,
  type VisualDataCellEditInput,
  type VisualDataCellValueType,
} from "../lib/visual-data-edit";
import {
  MAX_VISUAL_DOCUMENT_SECTION_CHARS,
  canVisualEditDocumentSection,
  visualDocumentSectionDraft,
  type VisualDocumentSectionEditInput,
} from "../lib/visual-document-edit";
import {
  MAX_VISUAL_DECK_SLIDE_CHARS,
  VISUAL_DECK_LAYOUTS,
  canVisualEditDeckSlide,
  visualDeckSlideDraft,
  visualDeckSlidePreviewSource,
  type VisualDeckSlideEditInput,
} from "../lib/visual-deck-edit";

type GridCell = DataCell | QueryCell;
type PreviewTargetHandler = (
  artifact: WorkspaceArtifact,
  target: PreviewSourceTarget,
  viaLabel?: string,
) => void;

export type DataCellEditHandler = (
  artifact: WorkspaceArtifact,
  target: DataCellPreviewSourceTarget,
  input: VisualDataCellEditInput,
) => Promise<string | null>;

export type DocumentSectionEditHandler = (
  artifact: WorkspaceArtifact,
  target: PreviewSourceTarget,
  input: VisualDocumentSectionEditInput,
) => Promise<string | null>;

export type DeckSlideEditHandler = (
  artifact: WorkspaceArtifact,
  target: PreviewSourceTarget,
  input: VisualDeckSlideEditInput,
) => Promise<string | null>;

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
  const lineRows = chartLinePoints(model).map((point, index) => ({ ...rows[index], point }));
  const linePolyline = lineRows.map(({ point }) => (
    `${50 + point.x * 900},${24 + point.y * 172}`
  )).join(" ");
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
      {model.spec.mark === "line" ? (
        <div className="chart-line-shell">
          <div className="chart-line-plot">
            <svg viewBox="0 0 1000 220" aria-hidden="true" focusable="false">
              <g className="chart-line-grid">
                <line x1="50" y1="24" x2="950" y2="24" />
                <line x1="50" y1="110" x2="950" y2="110" />
                <line x1="50" y1="196" x2="950" y2="196" />
              </g>
              <polyline className="chart-line-series" points={linePolyline} />
            </svg>
            {lineRows.map(({ datum, point, valueSource }) => {
              const openValue = valueSource && onTargetSource
                ? () => onTargetSource(
                    valueSource.sourceTargets.artifact,
                    valueSource.target,
                    `${model.spec.title} · value ${datum.formatted}`,
                  )
                : undefined;
              const pointStyle = {
                left: `${5 + point.x * 90}%`,
                top: `${10.9 + point.y * 78.2}%`,
              };
              return openValue ? (
                <button
                  className="chart-line-point chart-source-cell"
                  data-chart-source-cell="value"
                  data-chart-source-row={datum.sourceRowIndex}
                  key={datum.sourceRowIndex}
                  style={pointStyle}
                  type="button"
                  aria-label={`Open ${valueSource?.target.label} in ${valueSource?.sourceTargets.artifact.name} as Agent context`}
                  title={`Open exact ${valueSource?.target.column} source cell in ${valueSource?.sourceTargets.artifact.name}`}
                  onClick={openValue}
                >
                  <i aria-hidden="true" />
                  <span>{datum.formatted}</span>
                </button>
              ) : (
                <div
                  className="chart-line-point"
                  data-chart-source-row={datum.sourceRowIndex}
                  key={datum.sourceRowIndex}
                  style={pointStyle}
                  title={`${datum.label}: ${datum.formatted}`}
                >
                  <i aria-hidden="true" />
                  <span>{datum.formatted}</span>
                </div>
              );
            })}
          </div>
          <div className="chart-line-labels" style={{ gridTemplateColumns: `repeat(${model.data.length}, minmax(0, 1fr))` }}>
            {lineRows.map(({ datum, categorySource }) => {
              const openCategory = categorySource && onTargetSource
                ? () => onTargetSource(
                    categorySource.sourceTargets.artifact,
                    categorySource.target,
                    `${model.spec.title} · category ${datum.label}`,
                  )
                : undefined;
              return openCategory ? (
                <button
                  className="chart-source-cell chart-category-cell"
                  data-chart-source-cell="category"
                  data-chart-source-row={datum.sourceRowIndex}
                  key={datum.sourceRowIndex}
                  type="button"
                  aria-label={`Open ${categorySource?.target.label} in ${categorySource?.sourceTargets.artifact.name} as Agent context`}
                  title={`Open exact ${categorySource?.target.column} source cell in ${categorySource?.sourceTargets.artifact.name}`}
                  onClick={openCategory}
                >
                  <span>{datum.label}</span>
                </button>
              ) : <span key={datum.sourceRowIndex} title={datum.label}>{datum.label}</span>;
            })}
          </div>
        </div>
      ) : <div className="chart-bars">
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
      </div>}
      <footer><span>{model.spec.value}</span><span>{model.sourceArtifactName} · {model.data.length} marks{hasTargetableCells ? ` · Click a label or ${model.spec.mark === "line" ? "point" : "bar"} to open its exact source cell` : ""}</span></footer>
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
  onEditDocumentSection,
}: {
  artifact: WorkspaceArtifact;
  artifacts: WorkspaceArtifact[];
  queryRuntime: QueryRuntime;
  targets: PreviewSourceTarget[];
  activeSelection?: SourceSelection | null;
  onTargetSource?: PreviewTargetHandler;
  onEditDocumentSection?: DocumentSectionEditHandler;
}) {
  const compiled = compileArtifactSource(
    artifact.source,
    artifacts,
    readyQuerySnapshots(queryRuntime),
  );
  const [editingSection, setEditingSection] = useState<{
    targetId: string;
    artifactId: string;
    sourceRevision: string;
    draft: string;
    error: string;
    submitting: boolean;
  } | null>(null);
  const editingTarget = editingSection?.artifactId === artifact.id
    && editingSection.sourceRevision === artifact.source
    ? targets.find((target) => target.id === editingSection.targetId)
    : undefined;
  const draftSource = editingSection?.draft ?? "";
  const compiledDraft = compileArtifactSource(
    draftSource,
    artifacts,
    readyQuerySnapshots(queryRuntime),
  );

  function beginSectionEdit(target: PreviewSourceTarget) {
    if (!onEditDocumentSection || !canVisualEditDocumentSection(artifact, target)) return;
    setEditingSection({
      targetId: target.id,
      artifactId: artifact.id,
      sourceRevision: artifact.source,
      draft: visualDocumentSectionDraft(artifact, target),
      error: "",
      submitting: false,
    });
  }

  async function submitSectionEdit(target: PreviewSourceTarget) {
    if (!editingSection || !onEditDocumentSection) return;
    setEditingSection((current) => current ? { ...current, error: "", submitting: true } : current);
    const error = await onEditDocumentSection(artifact, target, { draft: editingSection.draft });
    if (error) {
      setEditingSection((current) => current ? { ...current, error, submitting: false } : current);
      return;
    }
    setEditingSection(null);
  }

  return (
    <div className="document-stage">
      <article className="document-paper">
        <div className="paper-meta">
          <span>Rune document</span>
          <span>{onEditDocumentSection && targets.length ? "Select or edit one exact section" : onTargetSource && targets.length ? "Click a section for Agent" : "Live compilation"}</span>
        </div>
        {onTargetSource && targets.length > 0 && (
          <nav className="document-targets" aria-label="Select or edit a document section">
            {targets.map((target) => {
              const active = previewTargetIsActive(target, activeSelection);
              const editable = Boolean(onEditDocumentSection && canVisualEditDocumentSection(artifact, target));
              const editing = editingTarget?.id === target.id;
              return (
                <span className={`document-target ${active ? "active" : ""} ${editing ? "editing" : ""}`.trim()} key={target.id}>
                  <button
                    className="document-target-select"
                    data-preview-source-target={target.kind}
                    type="button"
                    aria-label={`Select ${target.label} in canonical source for Agent context`}
                    aria-pressed={active}
                    title={`Select exact ${target.label} source`}
                    onClick={() => onTargetSource(artifact, target)}
                  >
                    <MousePointer2 aria-hidden="true" /> <span>{target.label}</span>
                  </button>
                  {editable && (
                    <button
                      className="document-target-edit"
                      type="button"
                      aria-label={`Edit ${target.label}`}
                      title={`Edit exact ${target.label} section`}
                      onClick={() => beginSectionEdit(target)}
                    >
                      <PencilLine aria-hidden="true" />
                    </button>
                  )}
                </span>
              );
            })}
          </nav>
        )}
        {editingSection && editingTarget && (
          <form
            className="visual-document-editor"
            onSubmit={(event) => { event.preventDefault(); void submitSectionEdit(editingTarget); }}
          >
            <header>
              <div><span>Editing exact section</span><strong>{editingTarget.label}</strong></div>
              <small>{editingSection.draft.length.toLocaleString("en-US")} / {MAX_VISUAL_DOCUMENT_SECTION_CHARS.toLocaleString("en-US")}</small>
            </header>
            <div className="visual-document-editor-grid">
              <label>
                <span>Markdown section</span>
                <textarea
                  autoFocus
                  aria-label={`Edit ${editingTarget.label} Markdown section`}
                  value={editingSection.draft}
                  disabled={editingSection.submitting}
                  maxLength={MAX_VISUAL_DOCUMENT_SECTION_CHARS}
                  spellCheck
                  onChange={(event) => setEditingSection((current) => current ? { ...current, draft: event.target.value, error: "" } : current)}
                  onKeyDown={(event) => {
                    if (event.key === "Escape") {
                      event.preventDefault();
                      setEditingSection(null);
                    } else if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
                      event.preventDefault();
                      void submitSectionEdit(editingTarget);
                    }
                  }}
                />
              </label>
              <section aria-label={`Draft preview for ${editingTarget.label}`}>
                <span>Draft preview</span>
                <div className="visual-document-draft markdown-body">
                  {draftSource.trim()
                    ? <MarkdownSource source={compiledDraft.source} artifacts={artifacts} queryRuntime={queryRuntime} />
                    : <p className="visual-document-empty">This section cannot be empty.</p>}
                </div>
              </section>
            </div>
            {editingSection.error && <p className="visual-document-error" role="alert">{editingSection.error}</p>}
            <footer>
              <p>One revision-bound section · live bindings stay fixed · save writes canonical source</p>
              <div>
                <button type="button" disabled={editingSection.submitting} onClick={() => setEditingSection(null)}><X />Cancel</button>
                <button type="submit" disabled={editingSection.submitting || !editingSection.draft.trim()}>
                  {editingSection.submitting ? <LoaderCircle className="agent-spinner" /> : <Check />}Save section
                </button>
              </div>
            </footer>
          </form>
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
  editableFormat,
  onEditDataCell,
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
  editableFormat?: "CSV" | "JSON";
  onEditDataCell?: DataCellEditHandler;
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
  const [editingCell, setEditingCell] = useState<{
    key: string;
    sourceRevision: string;
    draft: string;
    valueType: VisualDataCellValueType;
    error: string;
    submitting: boolean;
  } | null>(null);

  function beginCellEdit(
    target: DataCellPreviewSourceTarget,
    value: GridCell,
  ) {
    if (!targetArtifact || !editableFormat || !onEditDataCell || !canVisualEditDataCell(targetArtifact, target)) return;
    const scalar = value == null || ["string", "number", "boolean"].includes(typeof value)
      ? value as DataCell
      : String(value);
    setEditingCell({
      key: `${target.rowIndex}:${target.columnIndex}`,
      sourceRevision: targetArtifact.source,
      draft: visualDataCellDraft(scalar),
      valueType: visualDataCellValueType(scalar, editableFormat),
      error: "",
      submitting: false,
    });
  }

  async function submitCellEdit(
    target: DataCellPreviewSourceTarget,
  ) {
    if (!editingCell || !targetArtifact || !onEditDataCell) return;
    setEditingCell((current) => current ? { ...current, error: "", submitting: true } : current);
    const error = await onEditDataCell(targetArtifact, target, {
      draft: editingCell.draft,
      valueType: editingCell.valueType,
    });
    if (error) {
      setEditingCell((current) => current ? { ...current, error, submitting: false } : current);
      return;
    }
    setEditingCell(null);
  }

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
                  const editableCellTarget = cellTarget?.kind === "data-cell" && "rowIndex" in cellTarget
                    ? cellTarget as DataCellPreviewSourceTarget
                    : undefined;
                  const cellEditable = Boolean(
                    editableCellTarget
                    && targetArtifact
                    && editableFormat
                    && onEditDataCell
                    && canVisualEditDataCell(targetArtifact, editableCellTarget),
                  );
                  const cellActive = Boolean(cellTarget && previewTargetIsActive(cellTarget, activeSelection));
                  const displayValue = value == null ? "—" : String(value);
                  const editKey = `${rowIndex}:${columnIndex}`;
                  const editing = Boolean(
                    cellTarget
                    && editingCell?.key === editKey
                    && editingCell.sourceRevision === targetArtifact?.source,
                  );
                  return (
                    <td
                      key={`${column}-${columnIndex}`}
                      className={`${numeric ? "numeric" : ""} ${activateCell ? "preview-data-cell" : ""} ${cellActive ? "active" : ""} ${cellEditable ? "editable" : ""} ${editing ? "editing" : ""}`.trim() || undefined}
                    >
                      {editing && editableCellTarget && editingCell ? (
                        <form
                          className="visual-cell-editor"
                          onSubmit={(event) => { event.preventDefault(); void submitCellEdit(editableCellTarget); }}
                        >
                          <div className="visual-cell-fields">
                            <select
                              aria-label={`Value type for ${editableCellTarget.label}`}
                              value={editingCell.valueType}
                              disabled={editingCell.submitting || editableFormat === "CSV"}
                              onChange={(event) => {
                                const valueType = event.target.value as VisualDataCellValueType;
                                setEditingCell((current) => current ? {
                                  ...current,
                                  valueType,
                                  draft: valueType === "null"
                                    ? ""
                                    : valueType === "boolean" && !["true", "false"].includes(current.draft)
                                      ? "true"
                                      : current.draft,
                                  error: "",
                                } : current);
                              }}
                            >
                              {editableFormat === "CSV" ? <option value="auto">Auto</option> : (
                                <>
                                  <option value="string">Text</option>
                                  <option value="number">Number</option>
                                  <option value="boolean">Boolean</option>
                                  <option value="null">Empty</option>
                                </>
                              )}
                            </select>
                            {editingCell.valueType === "boolean" ? (
                              <select
                                autoFocus
                                aria-label={`Edit ${editableCellTarget.label}`}
                                value={editingCell.draft}
                                disabled={editingCell.submitting}
                                onChange={(event) => setEditingCell((current) => current ? { ...current, draft: event.target.value, error: "" } : current)}
                              >
                                <option value="true">true</option>
                                <option value="false">false</option>
                              </select>
                            ) : editingCell.valueType === "null" ? (
                              <span className="visual-null-value">null</span>
                            ) : (
                              <input
                                autoFocus
                                aria-label={`Edit ${editableCellTarget.label}`}
                                value={editingCell.draft}
                                disabled={editingCell.submitting}
                                maxLength={MAX_VISUAL_DATA_CELL_CHARS}
                                onChange={(event) => setEditingCell((current) => current ? { ...current, draft: event.target.value, error: "" } : current)}
                                onKeyDown={(event) => {
                                  if (event.key === "Escape") {
                                    event.preventDefault();
                                    setEditingCell(null);
                                  }
                                }}
                              />
                            )}
                          </div>
                          <div className="visual-cell-actions">
                            <button type="submit" aria-label={`Save ${editableCellTarget.label}`} disabled={editingCell.submitting} title="Save to canonical source">
                              {editingCell.submitting ? <LoaderCircle className="agent-spinner" /> : <Check />}
                            </button>
                            <button type="button" aria-label="Cancel cell edit" disabled={editingCell.submitting} onClick={() => setEditingCell(null)}><X /></button>
                          </div>
                          {editingCell.error && <small role="alert">{editingCell.error}</small>}
                        </form>
                      ) : activateCell ? (
                        <>
                          <button
                            className="preview-cell-select"
                            type="button"
                            data-preview-source-target={cellTarget?.kind}
                            aria-label={`Select ${cellTarget?.label} in canonical source for Agent context`}
                            aria-pressed={cellActive}
                            title={`${cellEditable ? "Press Enter to edit · " : ""}Select the exact canonical source cell · ${cellTarget?.label}`}
                            onClick={activateCell}
                            onKeyDown={(event) => {
                              if (event.key !== "Enter" || !editableCellTarget || !cellEditable) return;
                              event.preventDefault();
                              beginCellEdit(editableCellTarget, value);
                            }}
                          >
                            <span>{displayValue}</span>
                          </button>
                          {cellEditable && editableCellTarget && (
                            <button
                              className="visual-cell-edit-trigger"
                              type="button"
                              aria-label={`Edit ${editableCellTarget.label}`}
                              title="Edit this canonical source cell"
                              onClick={() => beginCellEdit(editableCellTarget, value)}
                            >
                              <PencilLine aria-hidden="true" />
                            </button>
                          )}
                        </>
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
  onEditDataCell,
}: {
  artifact: WorkspaceArtifact;
  rowTargets: PreviewSourceTarget[];
  cellTargets: DataCellPreviewSourceTarget[];
  activeSelection?: SourceSelection | null;
  onTargetSource?: PreviewTargetHandler;
  onEditDataCell?: DataCellEditHandler;
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
      footnote={onEditDataCell && cellTargets.some((target) => canVisualEditDataCell(artifact, target))
        ? "Parsed locally — click selects exact source; press Enter or use the pencil to edit a proven scalar cell."
        : onTargetSource && cellTargets.length
          ? "Parsed locally — click a cell for exact Agent context, or a row number for the full record."
        : onTargetSource && rowTargets.length
          ? "Parsed locally — click a row number to bind the full record as Agent context."
          : "Parsed locally — no targetable rows left this device."}
      rowTargets={rowTargets}
      cellTargets={cellTargets}
      targetArtifact={artifact}
      activeSelection={activeSelection}
      onTargetSource={onTargetSource}
      editableFormat={parsed.format}
      onEditDataCell={onEditDataCell}
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
  onEditDeckSlide,
}: {
  artifact: WorkspaceArtifact;
  source: string;
  artifacts: WorkspaceArtifact[];
  queryRuntime: QueryRuntime;
  targets: PreviewSourceTarget[];
  activeSelection?: SourceSelection | null;
  onTargetSource?: PreviewTargetHandler;
  onEditDeckSlide?: DeckSlideEditHandler;
}) {
  const [editingSlide, setEditingSlide] = useState<{
    targetId: string;
    artifactId: string;
    sourceRevision: string;
    layout: VisualDeckSlideEditInput["layout"];
    eyebrow: string;
    draft: string;
    error: string;
    submitting: boolean;
  } | null>(null);
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
  const editingTarget = editingSlide?.artifactId === artifact.id
    && editingSlide.sourceRevision === artifact.source
    ? targets.find((target) => target.id === editingSlide.targetId)
    : undefined;
  const draftInput: VisualDeckSlideEditInput | null = editingSlide ? {
    layout: editingSlide.layout,
    eyebrow: editingSlide.eyebrow,
    draft: editingSlide.draft,
  } : null;
  const draftCandidate = draftInput
    ? visualDeckSlidePreviewSource(artifact, draftInput)
    : null;
  const draftBindings = draftCandidate && !draftCandidate.errors.length
    ? compileArtifactSource(draftCandidate.source, artifacts, readyQuerySnapshots(queryRuntime))
    : null;
  const draftCompilation = draftBindings ? compileDeckSource(draftBindings.source) : null;
  const draftRenderedSource = draftCompilation?.html
    ? renderChartReferencesToHtml(draftCompilation.html, (chartArtifactId) => {
      const chartArtifact = artifacts.find((candidate) => candidate.id === chartArtifactId && candidate.kind === "chart");
      return chartArtifact
        ? resolvePreviewChart(chartArtifact, artifacts, queryRuntime)
        : { errors: [`Chart not found: ${chartArtifactId}`] };
    })
    : null;
  const draftPreviewError = draftCandidate?.errors[0]
    ?? draftCompilation?.errors[0]
    ?? draftBindings?.metricBindingErrors[0]
    ?? draftBindings?.unresolvedQueryMetrics[0]
    ?? draftBindings?.queryMetricRuntimeErrors[0]
    ?? "";

  function beginSlideEdit(target: PreviewSourceTarget) {
    if (!onEditDeckSlide || !canVisualEditDeckSlide(artifact, target)) return;
    const draft = visualDeckSlideDraft(artifact, target);
    if (!draft) return;
    setEditingSlide({
      targetId: target.id,
      artifactId: artifact.id,
      sourceRevision: artifact.source,
      ...draft,
      error: "",
      submitting: false,
    });
  }

  async function submitSlideEdit(target: PreviewSourceTarget) {
    if (!editingSlide || !onEditDeckSlide) return;
    setEditingSlide((current) => current ? { ...current, error: "", submitting: true } : current);
    const error = await onEditDeckSlide(artifact, target, {
      layout: editingSlide.layout,
      eyebrow: editingSlide.eyebrow,
      draft: editingSlide.draft,
    });
    if (error) {
      setEditingSlide((current) => current ? { ...current, error, submitting: false } : current);
      return;
    }
    setEditingSlide(null);
  }

  return (
    <div className="slides-stage">
      <div className="slides-stage-meta"><span>{slideCount} slides</span><span>{deckCompilation ? onEditDeckSlide ? "Deck Markdown → select or edit one exact slide" : "Deck Markdown → sandboxed HTML" : "Legacy sandboxed HTML"}</span></div>
      {(onTargetSource || onEditDeckSlide) && targets.length > 0 && (
        <nav className="slide-targets" aria-label="Select or edit a Deck slide">
          {targets.map((target) => {
            const active = previewTargetIsActive(target, activeSelection);
            const editable = Boolean(onEditDeckSlide && canVisualEditDeckSlide(artifact, target));
            const editing = editingTarget?.id === target.id;
            return (
              <span className={`slide-target ${active ? "active" : ""} ${editing ? "editing" : ""}`.trim()} key={target.id}>
                {onTargetSource && (
                  <button
                    className="slide-target-select"
                    data-preview-source-target={target.kind}
                    type="button"
                    aria-pressed={active}
                    onClick={() => onTargetSource(artifact, target)}
                    title={`Select ${target.label} in canonical source`}
                  >
                    <span>{String(target.index + 1).padStart(2, "0")}</span>
                    <strong>{target.label}</strong>
                  </button>
                )}
                {editable && (
                  <button
                    className="slide-target-edit"
                    type="button"
                    aria-label={`Edit ${target.label}`}
                    title={`Edit exact ${target.label} slide`}
                    onClick={() => beginSlideEdit(target)}
                  >
                    <PencilLine aria-hidden="true" />
                  </button>
                )}
              </span>
            );
          })}
        </nav>
      )}
      {editingSlide && editingTarget && (
        <form
          className="visual-deck-editor"
          aria-busy={editingSlide.submitting}
          onSubmit={(event) => { event.preventDefault(); void submitSlideEdit(editingTarget); }}
        >
          <header>
            <div><span>Editing exact slide {editingTarget.index + 1}</span><strong>{editingTarget.label}</strong></div>
            <small>{editingSlide.draft.length.toLocaleString("en-US")} / {MAX_VISUAL_DECK_SLIDE_CHARS.toLocaleString("en-US")}</small>
          </header>
          <div className="visual-deck-editor-grid">
            <div className="visual-deck-fields">
              <div className="visual-deck-field-row">
                <label>
                  <span>Layout</span>
                  <select
                    aria-label={`Choose layout for ${editingTarget.label}`}
                    value={editingSlide.layout}
                    disabled={editingSlide.submitting}
                    onChange={(event) => setEditingSlide((current) => current ? {
                      ...current,
                      layout: event.target.value as VisualDeckSlideEditInput["layout"],
                      error: "",
                    } : current)}
                  >
                    {VISUAL_DECK_LAYOUTS.map((layout) => <option key={layout} value={layout}>{layout}</option>)}
                  </select>
                </label>
                <label>
                  <span>Eyebrow <small>optional</small></span>
                  <input
                    aria-label={`Edit eyebrow for ${editingTarget.label}`}
                    value={editingSlide.eyebrow}
                    disabled={editingSlide.submitting}
                    maxLength={100}
                    onChange={(event) => setEditingSlide((current) => current ? { ...current, eyebrow: event.target.value, error: "" } : current)}
                  />
                </label>
              </div>
              <label className="visual-deck-markdown-field">
                <span>Slide Markdown</span>
                <textarea
                  autoFocus
                  aria-label={`Edit ${editingTarget.label} slide Markdown`}
                  value={editingSlide.draft}
                  disabled={editingSlide.submitting}
                  maxLength={MAX_VISUAL_DECK_SLIDE_CHARS}
                  spellCheck
                  onChange={(event) => setEditingSlide((current) => current ? { ...current, draft: event.target.value, error: "" } : current)}
                  onKeyDown={(event) => {
                    if (event.key === "Escape") {
                      event.preventDefault();
                      setEditingSlide(null);
                    } else if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
                      event.preventDefault();
                      void submitSlideEdit(editingTarget);
                    }
                  }}
                />
              </label>
            </div>
            <section className="visual-deck-draft" aria-label={`Draft preview for ${editingTarget.label}`}>
              <span>Sandboxed one-slide preview</span>
              {draftRenderedSource && !draftPreviewError
                ? <iframe srcDoc={draftRenderedSource} sandbox="" title={`Draft preview for ${editingTarget.label}`} />
                : <div className="visual-deck-draft-error"><AlertTriangle aria-hidden="true" /><p>{draftPreviewError || "Add a valid # or ## slide heading."}</p></div>}
            </section>
          </div>
          {editingSlide.error && <p className="visual-deck-error" role="alert">{editingSlide.error}</p>}
          <footer>
            <p>One revision-bound slide · bindings stay fixed · save writes canonical source</p>
            <div>
              <button type="button" disabled={editingSlide.submitting} onClick={() => setEditingSlide(null)}><X />Cancel</button>
              <button type="submit" disabled={editingSlide.submitting || !editingSlide.draft.trim() || Boolean(draftPreviewError)}>
                {editingSlide.submitting ? <LoaderCircle className="agent-spinner" /> : <Check />}Save slide
              </button>
            </div>
          </footer>
        </form>
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
  onEditDataCell,
  onEditDocumentSection,
  onEditDeckSlide,
}: {
  artifact: WorkspaceArtifact;
  artifacts: WorkspaceArtifact[];
  activeSelection?: SourceSelection | null;
  onTargetSource?: PreviewTargetHandler;
  onEditDataCell?: DataCellEditHandler;
  onEditDocumentSection?: DocumentSectionEditHandler;
  onEditDeckSlide?: DeckSlideEditHandler;
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
    return <DataPreview artifact={artifact} rowTargets={targets.rows} cellTargets={targets.cells} activeSelection={activeSelection} onTargetSource={onTargetSource} onEditDataCell={onEditDataCell} />;
  }
  const targets = derivePreviewSourceTargets(artifact);
  if (artifact.kind === "document") return <DocumentPreview artifact={artifact} artifacts={artifacts} queryRuntime={queryRuntime} targets={targets} activeSelection={activeSelection} onTargetSource={onTargetSource} onEditDocumentSection={onEditDocumentSection} />;
  if (artifact.kind === "query") {
    const dataArtifact = resolveQueryDataArtifact(artifact, artifacts).artifact;
    return <QueryPreview artifact={artifact} dataArtifact={dataArtifact} runtimeEntry={queryRuntime[artifact.id]} onTargetSource={onTargetSource} />;
  }
  if (artifact.kind === "chart") return <ChartPreview artifact={artifact} artifacts={artifacts} queryRuntime={queryRuntime} onTargetSource={onTargetSource} />;
  return <SlidesPreview artifact={artifact} source={compiled.source} artifacts={artifacts} queryRuntime={queryRuntime} targets={targets} activeSelection={activeSelection} onTargetSource={onTargetSource} onEditDeckSlide={onEditDeckSlide} />;
}
