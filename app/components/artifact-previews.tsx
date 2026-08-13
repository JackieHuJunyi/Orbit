"use client";

import { Fragment, createContext, createElement, useCallback, useContext, useEffect, useMemo, useRef, useState, type CSSProperties, type ElementType, type KeyboardEvent, type MouseEvent as ReactMouseEvent, type ReactNode } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Components } from "react-markdown";
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  Bold,
  Braces,
  Check,
  CheckCircle2,
  Clock3,
  Code2,
  Columns3,
  Italic,
  Link2,
  List,
  ListOrdered,
  LoaderCircle,
  MousePointer2,
  PencilLine,
  Plus,
  Strikethrough,
  TextQuote,
  Rows3,
  Trash2,
  X,
} from "lucide-react";
import { parseDataSource, type DataCell, type WorkspaceArtifact } from "../lib/workspace";
import { runeUICopy, type RuneLocale, type RuneUICopy } from "../lib/localization";
import { compileArtifactSource, compiledSourceRangeToCanonical, queryMetricSourceIdsForArtifact } from "../lib/bindings";
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
  deriveDocumentBlockPreviewSourceTargets,
  deriveDocumentFragmentPreviewSourceTargets,
  derivePreviewSourceTargets,
  previewTargetIsActive,
  resolveDataPreviewSourceTargets,
  type DataCellPreviewSourceTarget,
  type DocumentBlockPreviewSourceTarget,
  type DocumentFragmentPreviewSourceTarget,
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
  MAX_VISUAL_DOCUMENT_BLOCK_CHARS,
  canVisualEditDocumentBlock,
  prepareVisualDocumentBlockEdit,
  visualDocumentBlockDraft,
  type VisualDocumentBlockEditInput,
} from "../lib/visual-document-block-edit";
import {
  MAX_VISUAL_DOCUMENT_INSERT_CHARS,
  documentBlockStructureCapabilities,
  prepareVisualDocumentBlockStructure,
  type VisualDocumentBlockStructureAction,
  type VisualDocumentBlockStructureInput,
} from "../lib/visual-document-block-structure";
import {
  applyDocumentFormatting,
  type DocumentFormattingCommand,
} from "../lib/document-formatting";
import {
  MAX_VISUAL_DECK_SLIDE_CHARS,
  VISUAL_DECK_LAYOUTS,
  canVisualEditDeckSlide,
  visualDeckSlideDraft,
  visualDeckSlidePreviewSource,
  type VisualDeckSlideEditInput,
} from "../lib/visual-deck-edit";
import {
  canVisualEditChartSpec,
  visualChartSourceFields,
  visualChartSpecDraft,
  visualChartSpecPreviewSource,
  type VisualChartSpecEditInput,
} from "../lib/visual-chart-edit";

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

export type DocumentBlockEditHandler = (
  artifact: WorkspaceArtifact,
  target: DocumentBlockPreviewSourceTarget,
  input: VisualDocumentBlockEditInput,
) => Promise<string | null>;

export type DocumentBlockStructureReviewHandler = (
  artifact: WorkspaceArtifact,
  target: DocumentBlockPreviewSourceTarget,
  input: VisualDocumentBlockStructureInput,
) => Promise<string | null>;

export type DeckSlideEditHandler = (
  artifact: WorkspaceArtifact,
  target: PreviewSourceTarget,
  input: VisualDeckSlideEditInput,
) => Promise<string | null>;

export type ChartSpecEditHandler = (
  artifact: WorkspaceArtifact,
  target: PreviewSourceTarget,
  input: VisualChartSpecEditInput,
) => Promise<string | null>;

type QueryRuntimeEntry =
  | { status: "loading" }
  | { status: "ready"; snapshot: WorkspaceQuerySnapshot }
  | { status: "error"; error: string };

type QueryRuntime = Record<string, QueryRuntimeEntry>;

const PreviewCopyContext = createContext<RuneUICopy["preview"]>(runeUICopy("en").preview);

function usePreviewCopy() {
  return useContext(PreviewCopyContext);
}

const DOCUMENT_FORMATTING_CONTROLS = [
  { command: "bold", label: "Bold", shortcut: "⌘/Ctrl B", Icon: Bold },
  { command: "italic", label: "Italic", shortcut: "⌘/Ctrl I", Icon: Italic },
  { command: "strikethrough", label: "Strikethrough", shortcut: "", Icon: Strikethrough },
  { command: "code", label: "Inline code", shortcut: "", Icon: Code2 },
  { command: "link", label: "Link", shortcut: "⌘/Ctrl K", Icon: Link2 },
  { command: "bullet-list", label: "Bulleted list", shortcut: "", Icon: List },
  { command: "numbered-list", label: "Numbered list", shortcut: "", Icon: ListOrdered },
  { command: "quote", label: "Quote", shortcut: "", Icon: TextQuote },
] satisfies Array<{
  command: DocumentFormattingCommand;
  label: string;
  shortcut: string;
  Icon: typeof Bold;
}>;

function documentBlockFormattingControls(blockType: DocumentBlockPreviewSourceTarget["blockType"]) {
  if (blockType === "code") return [];
  return DOCUMENT_FORMATTING_CONTROLS.filter(({ command }) => (
    ["bold", "italic", "strikethrough", "code", "link"].includes(command)
    || (blockType === "list" && ["bullet-list", "numbered-list"].includes(command))
  ));
}

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
  const copy = usePreviewCopy();
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
        <div><span>{copy.liveChart}{model.sourceArtifactKind === "query" ? ` · ${copy.queryOutput}` : ""}</span><strong>{model.spec.title}</strong></div>
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
                    copy.valueDatum(model.spec.title, datum.formatted),
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
                  aria-label={copy.openCellForAgent(valueSource?.target.label ?? "", valueSource?.sourceTargets.artifact.name ?? "")}
                  title={copy.openExactCell(valueSource?.target.column ?? "", valueSource?.sourceTargets.artifact.name ?? "")}
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
                    copy.categoryDatum(model.spec.title, datum.label),
                  )
                : undefined;
              return openCategory ? (
                <button
                  className="chart-source-cell chart-category-cell"
                  data-chart-source-cell="category"
                  data-chart-source-row={datum.sourceRowIndex}
                  key={datum.sourceRowIndex}
                  type="button"
                  aria-label={copy.openCellForAgent(categorySource?.target.label ?? "", categorySource?.sourceTargets.artifact.name ?? "")}
                  title={copy.openExactCell(categorySource?.target.column ?? "", categorySource?.sourceTargets.artifact.name ?? "")}
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
                copy.categoryDatum(model.spec.title, datum.label),
              )
            : undefined;
          const openValue = valueSource && onTargetSource
            ? () => onTargetSource(
                valueSource.sourceTargets.artifact,
                valueSource.target,
                copy.valueDatum(model.spec.title, datum.formatted),
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
                  aria-label={copy.openCellForAgent(categorySource?.target.label ?? "", categorySource?.sourceTargets.artifact.name ?? "")}
                  title={copy.openExactCell(categorySource?.target.column ?? "", categorySource?.sourceTargets.artifact.name ?? "")}
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
                  aria-label={copy.openCellForAgent(valueSource?.target.label ?? "", valueSource?.sourceTargets.artifact.name ?? "")}
                  title={copy.openExactCell(valueSource?.target.column ?? "", valueSource?.sourceTargets.artifact.name ?? "")}
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
      <footer><span>{model.spec.value}</span><span>{model.sourceArtifactName} · {copy.marks(model.data.length)}{hasTargetableCells ? ` · ${copy.clickExactDatum(model.spec.mark)}` : ""}</span></footer>
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
  const copy = usePreviewCopy();
  const chartArtifact = artifacts.find((artifact) => artifact.id === chartId && artifact.kind === "chart");
  if (!chartArtifact) return <div className="embedded-chart-error">{copy.chartNotFound(chartId)}</div>;
  const resolution = resolvePreviewChart(chartArtifact, artifacts, queryRuntime);
  if (!resolution.model) return <div className="embedded-chart-error">{copy.chartUnavailable(resolution.errors[0] ?? "")}</div>;
  return <ChartFigure model={resolution.model} artifacts={artifacts} embedded onTargetSource={onTargetSource} />;
}

function MarkdownSourcePart({
  source,
  sourceOffset,
  components,
}: {
  source: string;
  sourceOffset: number;
  components: Components;
}) {
  const contextualComponents = useMemo(() => Object.fromEntries(Object.entries(components).map(([tag, Component]) => [
    tag,
    (props: Record<string, unknown> & { node?: { position?: { start?: { offset?: number }; end?: { offset?: number } } } }) => {
      const node = props.node;
      const contextualNode = node ? {
        ...node,
        position: node.position ? {
          start: node.position.start ? {
            ...node.position.start,
            offset: node.position.start.offset == null ? undefined : node.position.start.offset + sourceOffset,
          } : undefined,
          end: node.position.end ? {
            ...node.position.end,
            offset: node.position.end.offset == null ? undefined : node.position.end.offset + sourceOffset,
          } : undefined,
        } : undefined,
      } : undefined;
      return createElement(Component as ElementType, { ...props, node: contextualNode });
    },
  ])) as Components, [components, sourceOffset]);
  return <ReactMarkdown components={contextualComponents} remarkPlugins={[remarkGfm]}>{source}</ReactMarkdown>;
}

function MarkdownSource({
  source,
  sourceOffsets,
  targetArtifact,
  artifacts,
  queryRuntime,
  documentBlockTargets,
  documentFragmentTargets,
  documentSectionTargets,
  activeSelection,
  onTargetSource,
  onEditDocumentBlock,
  onBeginDocumentBlockEdit,
  onBeginDocumentBlockStructure,
}: {
  source: string;
  sourceOffsets?: number[];
  targetArtifact?: WorkspaceArtifact;
  artifacts: WorkspaceArtifact[];
  queryRuntime: QueryRuntime;
  documentBlockTargets?: DocumentBlockPreviewSourceTarget[];
  documentFragmentTargets?: DocumentFragmentPreviewSourceTarget[];
  documentSectionTargets?: PreviewSourceTarget[];
  activeSelection?: SourceSelection | null;
  onTargetSource?: PreviewTargetHandler;
  onEditDocumentBlock?: DocumentBlockEditHandler;
  onBeginDocumentBlockEdit?: (target: DocumentBlockPreviewSourceTarget) => void;
  onBeginDocumentBlockStructure?: (
    target: DocumentBlockPreviewSourceTarget,
    action: VisualDocumentBlockStructureAction,
  ) => void;
}) {
  const copy = usePreviewCopy();
  const parts = tokenizeChartReferences(source);
  const blockByRange = useMemo(() => new Map((documentBlockTargets ?? []).map((target) => (
    [`${target.start}:${target.end}`, target]
  ))), [documentBlockTargets]);
  const fragmentByRange = useMemo(() => new Map((documentFragmentTargets ?? []).map((target) => (
    [`${target.start}:${target.end}`, target]
  ))), [documentFragmentTargets]);
  const sectionByFirstBlockId = useMemo(() => {
    const sections = new Map<string, PreviewSourceTarget>();
    (documentSectionTargets ?? []).forEach((section) => {
      const firstBlock = documentBlockTargets?.find((block) => (
        section.start <= block.start && block.end <= section.end
      ));
      if (firstBlock) sections.set(firstBlock.id, section);
    });
    return sections;
  }, [documentBlockTargets, documentSectionTargets]);

  const targetForNode = useCallback((node: { position?: { start?: { offset?: number }; end?: { offset?: number } } }) => {
    const compiledStart = node.position?.start?.offset;
    const compiledEnd = node.position?.end?.offset;
    if (compiledStart == null || compiledEnd == null) return undefined;
    const canonicalRange = sourceOffsets
      ? compiledSourceRangeToCanonical({ source, sourceOffsets }, compiledStart, compiledEnd)
      : { start: compiledStart, end: compiledEnd };
    return canonicalRange ? blockByRange.get(`${canonicalRange.start}:${canonicalRange.end}`) : undefined;
  }, [blockByRange, source, sourceOffsets]);

  const fragmentTargetForNode = useCallback((node: { position?: { start?: { offset?: number }; end?: { offset?: number } } }) => {
    const compiledStart = node.position?.start?.offset;
    const compiledEnd = node.position?.end?.offset;
    if (compiledStart == null || compiledEnd == null) return undefined;
    const canonicalRange = sourceOffsets
      ? compiledSourceRangeToCanonical({ source, sourceOffsets }, compiledStart, compiledEnd)
      : { start: compiledStart, end: compiledEnd };
    return canonicalRange ? fragmentByRange.get(`${canonicalRange.start}:${canonicalRange.end}`) : undefined;
  }, [fragmentByRange, source, sourceOffsets]);

  const interactiveFragment = useCallback((
    tag: "li" | "th" | "td" | "strong" | "em" | "del" | "code" | "a" | "img",
    props: Record<string, unknown> & { node?: Parameters<typeof fragmentTargetForNode>[0]; children?: ReactNode },
  ) => {
    const { node, children, ...elementProps } = props;
    const target = node ? fragmentTargetForNode(node) : undefined;
    const renderElement = (nextProps: Record<string, unknown>) => (
      tag === "img" ? createElement(tag, nextProps) : createElement(tag, nextProps, children)
    );
    if (!target || !targetArtifact || !onTargetSource) return renderElement(elementProps);
    const active = previewTargetIsActive(target, activeSelection);
    const inheritedClassName = typeof elementProps.className === "string" ? elementProps.className : "";
    const opensLink = tag === "a";
    const selectSource = () => onTargetSource(targetArtifact, target);
    return renderElement({
      ...elementProps,
      className: `${inheritedClassName} document-source-fragment targetable ${active ? "active" : ""}`.trim(),
      "data-preview-source-target": target.kind,
      "data-preview-source-id": target.id,
      "data-document-fragment-type": target.fragmentType,
      tabIndex: 0,
      role: ["strong", "em", "del", "code", "img"].includes(tag) ? "button" : undefined,
      "aria-label": opensLink ? copy.selectLinkExact(target.label) : copy.selectExact(target.label),
      "aria-pressed": ["strong", "em", "del", "code", "img"].includes(tag) ? active : undefined,
      title: opensLink ? copy.selectLinkExact(target.label) : copy.selectExact(target.label),
      onClick: (event: ReactMouseEvent<HTMLElement>) => {
        if (opensLink && (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey)) return;
        event.preventDefault();
        event.stopPropagation();
        selectSource();
      },
      onKeyDown: (event: KeyboardEvent<HTMLElement>) => {
        if (event.key === "Enter" && opensLink) return;
        if (event.key !== "Enter" && event.key !== " ") return;
        event.preventDefault();
        event.stopPropagation();
        selectSource();
      },
    });
  }, [activeSelection, copy, fragmentTargetForNode, onTargetSource, targetArtifact]);

  const interactiveBlock = useCallback((
    tag: "p" | "h1" | "h2" | "h3" | "h4" | "h5" | "h6" | "ul" | "ol" | "blockquote" | "pre" | "table" | "hr",
    props: Record<string, unknown> & { node?: Parameters<typeof targetForNode>[0]; children?: ReactNode },
  ) => {
    const { node, children, ...elementProps } = props;
    const target = node ? targetForNode(node) : undefined;
    if (!target || !targetArtifact || (!onTargetSource && !onBeginDocumentBlockEdit && !onBeginDocumentBlockStructure)) {
      return createElement(tag, elementProps, children);
    }
    const sectionTarget = sectionByFirstBlockId.get(target.id);
    const active = previewTargetIsActive(target, activeSelection)
      || Boolean(sectionTarget && previewTargetIsActive(sectionTarget, activeSelection));
    const editable = Boolean(
      onEditDocumentBlock
      && onBeginDocumentBlockEdit
      && canVisualEditDocumentBlock(targetArtifact, target),
    );
    const structure = onBeginDocumentBlockStructure
      ? documentBlockStructureCapabilities(targetArtifact, target)
      : null;
    const inheritedClassName = typeof elementProps.className === "string" ? elementProps.className : "";
    const selectSource = () => onTargetSource?.(targetArtifact, target);
    const block = createElement(tag, {
      ...elementProps,
      className: inheritedClassName || undefined,
    }, children);
    return createElement("div", {
      className: `document-source-block ${onTargetSource ? "targetable" : ""} ${editable ? "editable" : ""} ${structure?.available ? "structurable" : ""} ${active ? "active" : ""}`.trim(),
      "data-preview-source-target": target.kind,
      "data-preview-source-id": target.id,
      "data-preview-section-id": sectionTarget?.id,
      "data-document-block-type": target.blockType,
      "data-document-heading-level": target.headingLevel,
      title: onTargetSource ? copy.selectExact(target.label) : undefined,
      onClick: (event: ReactMouseEvent<HTMLElement>) => {
        const clicked = event.target;
        if (clicked instanceof Element && clicked.closest("a, button, summary, input, textarea, select, [contenteditable='true']")) return;
        selectSource();
      },
    }, block, createElement("span", {
      className: "document-block-actions",
      role: "group",
      "aria-label": copy.sourceActions(target.label),
    }, onTargetSource && createElement("button", {
      className: "document-block-locate",
      type: "button",
      "aria-label": copy.selectForAgent(target.label),
      "aria-pressed": active,
      "aria-keyshortcuts": editable ? "F2" : undefined,
      title: copy.selectExact(target.label),
      onClick: (event: ReactMouseEvent<HTMLButtonElement>) => {
        event.stopPropagation();
        selectSource();
      },
      onKeyDown: (event: KeyboardEvent<HTMLButtonElement>) => {
        if (!editable || event.key !== "F2") return;
        event.preventDefault();
        onBeginDocumentBlockEdit?.(target);
      },
    }, createElement(MousePointer2, { "aria-hidden": true })), editable && createElement("button", {
      className: "document-block-edit",
      type: "button",
      "aria-label": copy.editBlockTarget(target.label, target.blockType),
      title: `${copy.editExactBlock(target.blockType)} · F2`,
      onClick: (event: ReactMouseEvent<HTMLButtonElement>) => {
        event.stopPropagation();
        onBeginDocumentBlockEdit?.(target);
      },
    }, createElement(PencilLine, { "aria-hidden": true }))), structure?.available && createElement("details", {
      className: "document-block-structure-actions",
    }, createElement("summary", {
      "aria-label": copy.openStructureActions(target.label),
      title: copy.blockStructure,
    }, createElement(Rows3, { "aria-hidden": true })), createElement("span", {
      className: "document-block-structure-menu",
      role: "group",
      "aria-label": copy.structureActions(target.label),
    }, createElement("button", {
      className: "document-block-insert-before",
      type: "button",
      disabled: !structure.canInsertBefore,
      "aria-label": `${copy.insertBefore} · ${target.label}`,
      title: structure.canInsertBefore ? copy.insertBefore : copy.unsupportedBoundary,
      onClick: (event: ReactMouseEvent<HTMLButtonElement>) => {
        event.stopPropagation();
        const details = event.currentTarget.closest("details");
        if (details) details.open = false;
        onBeginDocumentBlockStructure?.(target, "insert-before");
      },
    }, createElement(Plus, { "aria-hidden": true })), createElement("button", {
      className: "document-block-move-up",
      type: "button",
      disabled: !structure.canMoveUp,
      "aria-label": `${copy.moveUp} · ${target.label}`,
      title: structure.canMoveUp ? copy.moveUp : copy.alreadyFirst,
      onClick: (event: ReactMouseEvent<HTMLButtonElement>) => {
        event.stopPropagation();
        const details = event.currentTarget.closest("details");
        if (details) details.open = false;
        onBeginDocumentBlockStructure?.(target, "move-up");
      },
    }, createElement(ArrowUp, { "aria-hidden": true })), createElement("button", {
      className: "document-block-move-down",
      type: "button",
      disabled: !structure.canMoveDown,
      "aria-label": `${copy.moveDown} · ${target.label}`,
      title: structure.canMoveDown ? copy.moveDown : copy.alreadyLast,
      onClick: (event: ReactMouseEvent<HTMLButtonElement>) => {
        event.stopPropagation();
        const details = event.currentTarget.closest("details");
        if (details) details.open = false;
        onBeginDocumentBlockStructure?.(target, "move-down");
      },
    }, createElement(ArrowDown, { "aria-hidden": true })), createElement("button", {
      className: "document-block-delete",
      type: "button",
      disabled: !structure.canDelete,
      "aria-label": `${copy.deleteBlock} · ${target.label}`,
      title: structure.canDelete ? copy.deleteBlock : copy.lastCannotDelete,
      onClick: (event: ReactMouseEvent<HTMLButtonElement>) => {
        event.stopPropagation();
        const details = event.currentTarget.closest("details");
        if (details) details.open = false;
        onBeginDocumentBlockStructure?.(target, "delete");
      },
    }, createElement(Trash2, { "aria-hidden": true })), createElement("button", {
      className: "document-block-insert-after",
      type: "button",
      disabled: !structure.canInsertAfter,
      "aria-label": `${copy.insertAfter} · ${target.label}`,
      title: structure.canInsertAfter ? copy.insertAfter : copy.unsupportedBoundary,
      onClick: (event: ReactMouseEvent<HTMLButtonElement>) => {
        event.stopPropagation();
        const details = event.currentTarget.closest("details");
        if (details) details.open = false;
        onBeginDocumentBlockStructure?.(target, "insert-after");
      },
    }, createElement(Plus, { "aria-hidden": true })))));
  }, [activeSelection, copy, onBeginDocumentBlockEdit, onBeginDocumentBlockStructure, onEditDocumentBlock, onTargetSource, sectionByFirstBlockId, targetArtifact, targetForNode]);

  const markdownComponents = useMemo(() => Object.fromEntries([
    ...[
      "p", "h1", "h2", "h3", "h4", "h5", "h6", "ul", "ol", "blockquote", "pre", "table", "hr",
    ].map((tag) => [tag, (props: Record<string, unknown>) => interactiveBlock(tag as Parameters<typeof interactiveBlock>[0], props)]),
    ...[
      "li", "th", "td", "strong", "em", "del", "code", "a", "img",
    ].map((tag) => [tag, (props: Record<string, unknown>) => interactiveFragment(tag as Parameters<typeof interactiveFragment>[0], props)]),
  ]) as Components, [interactiveBlock, interactiveFragment]);
  return (
    <>
      {parts.map((part, index) => (
        <Fragment key={`${part.type}-${index}`}>
          {part.type === "source"
            ? <MarkdownSourcePart
                key={`${part.type}-${index}`}
                source={part.value}
                sourceOffset={part.start}
                components={markdownComponents}
              />
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
  onEditDocumentBlock,
  onReviewDocumentBlockStructure,
}: {
  artifact: WorkspaceArtifact;
  artifacts: WorkspaceArtifact[];
  queryRuntime: QueryRuntime;
  targets: PreviewSourceTarget[];
  activeSelection?: SourceSelection | null;
  onTargetSource?: PreviewTargetHandler;
  onEditDocumentSection?: DocumentSectionEditHandler;
  onEditDocumentBlock?: DocumentBlockEditHandler;
  onReviewDocumentBlockStructure?: DocumentBlockStructureReviewHandler;
}) {
  const copy = usePreviewCopy();
  const compiled = compileArtifactSource(
    artifact.source,
    artifacts,
    readyQuerySnapshots(queryRuntime),
  );
  const blockTargets = useMemo(
    () => deriveDocumentBlockPreviewSourceTargets(artifact),
    [artifact],
  );
  const fragmentTargets = useMemo(
    () => deriveDocumentFragmentPreviewSourceTargets(artifact),
    [artifact],
  );
  const [editingSection, setEditingSection] = useState<{
    targetId: string;
    artifactId: string;
    sourceRevision: string;
    draft: string;
    error: string;
    submitting: boolean;
  } | null>(null);
  const [editingBlock, setEditingBlock] = useState<{
    targetId: string;
    artifactId: string;
    sourceRevision: string;
    draft: string;
    error: string;
    submitting: boolean;
  } | null>(null);
  const [insertingBlock, setInsertingBlock] = useState<{
    targetId: string;
    artifactId: string;
    sourceRevision: string;
    action: "insert-before" | "insert-after";
    draft: string;
    error: string;
    submitting: boolean;
  } | null>(null);
  const [structureError, setStructureError] = useState("");
  const sectionDraftRef = useRef<HTMLTextAreaElement>(null);
  const sectionSelectionRef = useRef({ start: 0, end: 0 });
  const blockEditorRef = useRef<HTMLFormElement>(null);
  const blockDraftRef = useRef<HTMLTextAreaElement>(null);
  const blockSelectionRef = useRef({ start: 0, end: 0 });
  const insertDraftRef = useRef<HTMLTextAreaElement>(null);
  const editingTarget = editingSection?.artifactId === artifact.id
    && editingSection.sourceRevision === artifact.source
    ? targets.find((target) => target.id === editingSection.targetId)
    : undefined;
  const editingBlockTarget = editingBlock?.artifactId === artifact.id
    && editingBlock.sourceRevision === artifact.source
    ? blockTargets.find((target) => target.id === editingBlock.targetId)
    : undefined;
  const insertingBlockTarget = insertingBlock?.artifactId === artifact.id
    && insertingBlock.sourceRevision === artifact.source
    ? blockTargets.find((target) => target.id === insertingBlock.targetId)
    : undefined;
  const draftSource = editingSection?.draft ?? "";
  const compiledDraft = compileArtifactSource(
    draftSource,
    artifacts,
    readyQuerySnapshots(queryRuntime),
  );
  const blockDraftSource = editingBlock?.draft ?? "";
  const compiledBlockDraft = compileArtifactSource(
    blockDraftSource,
    artifacts,
    readyQuerySnapshots(queryRuntime),
  );
  const blockFormattingControls = editingBlockTarget
    ? documentBlockFormattingControls(editingBlockTarget.blockType)
    : [];
  const preparedBlockDraft = editingBlock && editingBlockTarget
    ? prepareVisualDocumentBlockEdit(artifact, editingBlockTarget, { draft: editingBlock.draft })
    : null;
  const blockDraftError = preparedBlockDraft?.errors[0] === "The edited block is unchanged."
    ? ""
    : preparedBlockDraft?.errors[0] ?? "";
  const blockDraftCanSave = Boolean(preparedBlockDraft && !preparedBlockDraft.errors.length);
  const preparedInsertDraft = insertingBlock && insertingBlockTarget
    ? prepareVisualDocumentBlockStructure(artifact, insertingBlockTarget, {
        action: insertingBlock.action,
        draft: insertingBlock.draft,
      })
    : null;
  const insertDraftError = preparedInsertDraft?.errors[0] === "Write one new Markdown block before reviewing this structure change."
    ? ""
    : preparedInsertDraft?.errors[0] ?? "";
  const insertDraftCanReview = Boolean(preparedInsertDraft && !preparedInsertDraft.errors.length);

  useEffect(() => {
    if (!editingBlockTarget) return;
    const frame = window.requestAnimationFrame(() => {
      blockEditorRef.current?.scrollIntoView({ block: "nearest" });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [editingBlockTarget]);

  function beginSectionEdit(target: PreviewSourceTarget) {
    if (!onEditDocumentSection || !canVisualEditDocumentSection(artifact, target)) return;
    setEditingBlock(null);
    setInsertingBlock(null);
    setStructureError("");
    sectionSelectionRef.current = { start: 0, end: 0 };
    setEditingSection({
      targetId: target.id,
      artifactId: artifact.id,
      sourceRevision: artifact.source,
      draft: visualDocumentSectionDraft(artifact, target),
      error: "",
      submitting: false,
    });
  }

  function beginBlockEdit(target: DocumentBlockPreviewSourceTarget) {
    if (!onEditDocumentBlock || !canVisualEditDocumentBlock(artifact, target)) return;
    setEditingSection(null);
    setInsertingBlock(null);
    setStructureError("");
    blockSelectionRef.current = { start: 0, end: 0 };
    setEditingBlock({
      targetId: target.id,
      artifactId: artifact.id,
      sourceRevision: artifact.source,
      draft: visualDocumentBlockDraft(artifact, target),
      error: "",
      submitting: false,
    });
  }

  function beginBlockStructure(
    target: DocumentBlockPreviewSourceTarget,
    action: VisualDocumentBlockStructureAction,
  ) {
    if (!onReviewDocumentBlockStructure) return;
    setStructureError("");
    const capabilities = documentBlockStructureCapabilities(artifact, target);
    if (!capabilities.available) return;
    if (action === "insert-before" || action === "insert-after") {
      setEditingSection(null);
      setEditingBlock(null);
      setInsertingBlock({
        targetId: target.id,
        artifactId: artifact.id,
        sourceRevision: artifact.source,
        action,
        draft: "",
        error: "",
        submitting: false,
      });
      return;
    }
    void onReviewDocumentBlockStructure(artifact, target, { action }).then((error) => {
      if (error) setStructureError(error);
    });
  }

  async function submitBlockInsertion(target: DocumentBlockPreviewSourceTarget) {
    if (!insertingBlock || !onReviewDocumentBlockStructure || !insertDraftCanReview) return;
    setInsertingBlock((current) => current ? { ...current, error: "", submitting: true } : current);
    const error = await onReviewDocumentBlockStructure(artifact, target, {
      action: insertingBlock.action,
      draft: insertingBlock.draft,
    });
    if (error) {
      setInsertingBlock((current) => current ? { ...current, error, submitting: false } : current);
      return;
    }
    setInsertingBlock(null);
  }

  function rememberSectionSelection(textarea: HTMLTextAreaElement) {
    sectionSelectionRef.current = {
      start: textarea.selectionStart,
      end: textarea.selectionEnd,
    };
  }

  function rememberBlockSelection(textarea: HTMLTextAreaElement) {
    blockSelectionRef.current = {
      start: textarea.selectionStart,
      end: textarea.selectionEnd,
    };
  }

  function formatSectionDraft(command: DocumentFormattingCommand) {
    if (!editingSection || editingSection.submitting) return;
    const textarea = sectionDraftRef.current;
    const selection = textarea
      ? { start: textarea.selectionStart, end: textarea.selectionEnd }
      : sectionSelectionRef.current;
    const formatted = applyDocumentFormatting(
      editingSection.draft,
      command,
      selection.start,
      selection.end,
    );
    if (formatted.draft.length > MAX_VISUAL_DOCUMENT_SECTION_CHARS) {
      setEditingSection((current) => current ? {
        ...current,
        error: copy.sectionLimit(MAX_VISUAL_DOCUMENT_SECTION_CHARS.toLocaleString(copy.numberLocale)),
      } : current);
      return;
    }
    if (formatted.error) {
      setEditingSection((current) => current ? { ...current, error: formatted.error ?? "" } : current);
      textarea?.focus();
      return;
    }
    sectionSelectionRef.current = {
      start: formatted.selectionStart,
      end: formatted.selectionEnd,
    };
    setEditingSection((current) => current ? {
      ...current,
      draft: formatted.draft,
      error: "",
    } : current);
    window.requestAnimationFrame(() => {
      const currentTextarea = sectionDraftRef.current;
      if (!currentTextarea) return;
      currentTextarea.focus();
      currentTextarea.setSelectionRange(formatted.selectionStart, formatted.selectionEnd);
    });
  }

  function formatBlockDraft(command: DocumentFormattingCommand) {
    if (!editingBlock || editingBlock.submitting || !editingBlockTarget) return;
    if (!documentBlockFormattingControls(editingBlockTarget.blockType).some((control) => control.command === command)) return;
    const textarea = blockDraftRef.current;
    const selection = textarea
      ? { start: textarea.selectionStart, end: textarea.selectionEnd }
      : blockSelectionRef.current;
    const formatted = applyDocumentFormatting(
      editingBlock.draft,
      command,
      selection.start,
      selection.end,
    );
    if (formatted.draft.length > MAX_VISUAL_DOCUMENT_BLOCK_CHARS) {
      setEditingBlock((current) => current ? {
        ...current,
        error: copy.blockLimit(MAX_VISUAL_DOCUMENT_BLOCK_CHARS.toLocaleString(copy.numberLocale)),
      } : current);
      return;
    }
    if (formatted.error) {
      setEditingBlock((current) => current ? { ...current, error: formatted.error ?? "" } : current);
      textarea?.focus();
      return;
    }
    blockSelectionRef.current = {
      start: formatted.selectionStart,
      end: formatted.selectionEnd,
    };
    setEditingBlock((current) => current ? {
      ...current,
      draft: formatted.draft,
      error: "",
    } : current);
    window.requestAnimationFrame(() => {
      const currentTextarea = blockDraftRef.current;
      if (!currentTextarea) return;
      currentTextarea.focus();
      currentTextarea.setSelectionRange(formatted.selectionStart, formatted.selectionEnd);
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

  async function submitBlockEdit(target: DocumentBlockPreviewSourceTarget) {
    if (!editingBlock || !onEditDocumentBlock || !blockDraftCanSave) return;
    setEditingBlock((current) => current ? { ...current, error: "", submitting: true } : current);
    const error = await onEditDocumentBlock(artifact, target, { draft: editingBlock.draft });
    if (error) {
      setEditingBlock((current) => current ? { ...current, error, submitting: false } : current);
      return;
    }
    setEditingBlock(null);
  }

  return (
    <div className="document-stage">
      <article className="document-paper">
        <div className="paper-meta">
          <span>{copy.runeDocument}</span>
          <span>{copy.documentMode(onEditDocumentBlock && blockTargets.length ? "block" : onEditDocumentSection && targets.length ? "section" : onTargetSource && targets.length ? "select" : "live")}</span>
        </div>
        {onTargetSource && targets.length > 0 && (
          <nav className="document-targets" aria-label={copy.selectDocumentSection}>
            {targets.map((target) => {
              const active = previewTargetIsActive(target, activeSelection);
              const editable = Boolean(onEditDocumentSection && canVisualEditDocumentSection(artifact, target));
              const editing = editingTarget?.id === target.id;
              return (
                <span
                  className={`document-target ${active ? "active" : ""} ${editing ? "editing" : ""}`.trim()}
                  data-preview-source-id={target.id}
                  key={target.id}
                >
                  <button
                    className="document-target-select"
                    data-preview-source-target={target.kind}
                    type="button"
                    aria-label={copy.selectForAgent(target.label)}
                    aria-pressed={active}
                    title={copy.selectExact(target.label)}
                    onClick={() => onTargetSource(artifact, target)}
                  >
                    <MousePointer2 aria-hidden="true" /> <span>{target.label}</span>
                  </button>
                  {editable && (
                    <button
                      className="document-target-edit"
                      type="button"
                      aria-label={copy.editTarget(target.label)}
                      title={copy.editTarget(target.label)}
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
              <div><span>{copy.editingSection}</span><strong>{editingTarget.label}</strong></div>
              <small>{editingSection.draft.length.toLocaleString(copy.numberLocale)} / {MAX_VISUAL_DOCUMENT_SECTION_CHARS.toLocaleString(copy.numberLocale)}</small>
            </header>
            <div className="visual-document-editor-grid">
              <div className="visual-document-source">
                <div className="visual-document-source-label">
                  <label htmlFor={`visual-document-draft-${artifact.id}-${editingTarget.index}`}>{copy.sourceDraft}</label>
                  <em>{copy.syncedLive}</em>
                </div>
                <div className="visual-document-formatbar" role="toolbar" aria-label={copy.formatSection}>
                  {DOCUMENT_FORMATTING_CONTROLS.map(({ command, shortcut, Icon }) => {
                    const label = copy.formattingLabels[command];
                    return (
                    <button
                      key={command}
                      type="button"
                      disabled={editingSection.submitting}
                      aria-label={shortcut ? `${label} · ${shortcut}` : label}
                      title={shortcut ? `${label} · ${shortcut}` : label}
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => formatSectionDraft(command)}
                    >
                      <Icon aria-hidden="true" />
                    </button>
                    );
                  })}
                </div>
                <textarea
                  id={`visual-document-draft-${artifact.id}-${editingTarget.index}`}
                  ref={sectionDraftRef}
                  autoFocus
                  aria-label={copy.editMarkdownSection(editingTarget.label)}
                  value={editingSection.draft}
                  disabled={editingSection.submitting}
                  maxLength={MAX_VISUAL_DOCUMENT_SECTION_CHARS}
                  spellCheck
                  onChange={(event) => {
                    rememberSectionSelection(event.currentTarget);
                    setEditingSection((current) => current ? { ...current, draft: event.target.value, error: "" } : current);
                  }}
                  onSelect={(event) => rememberSectionSelection(event.currentTarget)}
                  onKeyDown={(event) => {
                    if (event.key === "Escape") {
                      event.preventDefault();
                      setEditingSection(null);
                    } else if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
                      event.preventDefault();
                      void submitSectionEdit(editingTarget);
                    } else if (event.metaKey || event.ctrlKey) {
                      const command = event.key.toLowerCase() === "b"
                        ? "bold"
                        : event.key.toLowerCase() === "i"
                          ? "italic"
                          : event.key.toLowerCase() === "k"
                            ? "link"
                            : null;
                      if (command) {
                        event.preventDefault();
                        formatSectionDraft(command);
                      }
                    }
                  }}
                />
              </div>
              <section aria-label={`${copy.draftPreview} · ${editingTarget.label}`}>
                <span>{copy.draftPreview}</span>
                <div className="visual-document-draft markdown-body">
                  {draftSource.trim()
                    ? <MarkdownSource source={compiledDraft.source} artifacts={artifacts} queryRuntime={queryRuntime} />
                    : <p className="visual-document-empty">{copy.sectionEmpty}</p>}
                </div>
              </section>
            </div>
            {editingSection.error && <p className="visual-document-error" role="alert">{editingSection.error}</p>}
            <footer>
              <p>{copy.sectionContract}</p>
              <div>
                <button type="button" disabled={editingSection.submitting} onClick={() => setEditingSection(null)}><X />{copy.cancel}</button>
                <button type="submit" disabled={editingSection.submitting || !editingSection.draft.trim()}>
                  {editingSection.submitting ? <LoaderCircle className="agent-spinner" /> : <Check />}{copy.saveSection}
                </button>
              </div>
            </footer>
          </form>
        )}
        {editingBlock && editingBlockTarget && (
          <form
            ref={blockEditorRef}
            className="visual-document-editor visual-document-block-editor"
            onSubmit={(event) => { event.preventDefault(); void submitBlockEdit(editingBlockTarget); }}
          >
            <header>
              <div><span>{copy.editingBlock(editingBlockTarget.blockType)}</span><strong>{editingBlockTarget.label}</strong></div>
              <small>{editingBlock.draft.length.toLocaleString(copy.numberLocale)} / {MAX_VISUAL_DOCUMENT_BLOCK_CHARS.toLocaleString(copy.numberLocale)}</small>
            </header>
            <div className="visual-document-editor-grid">
              <div className="visual-document-source">
                <div className="visual-document-source-label">
                  <label htmlFor={`visual-document-block-draft-${artifact.id}-${editingBlockTarget.index}`}>{copy.blockSource}</label>
                  <em>{copy.syncedLive}</em>
                </div>
                {blockFormattingControls.length > 0 && (
                  <div className="visual-document-formatbar" role="toolbar" aria-label={copy.formatBlock(editingBlockTarget.blockType)}>
                    {blockFormattingControls.map(({ command, shortcut, Icon }) => {
                      const label = copy.formattingLabels[command];
                      return (
                      <button
                        key={command}
                        type="button"
                        disabled={editingBlock.submitting}
                        aria-label={shortcut ? `${label} · ${shortcut}` : label}
                        title={shortcut ? `${label} · ${shortcut}` : label}
                        onMouseDown={(event) => event.preventDefault()}
                        onClick={() => formatBlockDraft(command)}
                      >
                        <Icon aria-hidden="true" />
                      </button>
                      );
                    })}
                  </div>
                )}
                <textarea
                  id={`visual-document-block-draft-${artifact.id}-${editingBlockTarget.index}`}
                  ref={blockDraftRef}
                  autoFocus
                  aria-label={copy.editMarkdownBlock(editingBlockTarget.label, editingBlockTarget.blockType)}
                  value={editingBlock.draft}
                  disabled={editingBlock.submitting}
                  maxLength={MAX_VISUAL_DOCUMENT_BLOCK_CHARS}
                  spellCheck
                  onChange={(event) => {
                    rememberBlockSelection(event.currentTarget);
                    setEditingBlock((current) => current ? { ...current, draft: event.target.value, error: "" } : current);
                  }}
                  onSelect={(event) => rememberBlockSelection(event.currentTarget)}
                  onKeyDown={(event) => {
                    if (event.key === "Escape") {
                      event.preventDefault();
                      setEditingBlock(null);
                    } else if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
                      event.preventDefault();
                      void submitBlockEdit(editingBlockTarget);
                    } else if (event.metaKey || event.ctrlKey) {
                      const command = event.key.toLowerCase() === "b"
                        ? "bold"
                        : event.key.toLowerCase() === "i"
                          ? "italic"
                          : event.key.toLowerCase() === "k"
                            ? "link"
                            : null;
                      if (command && blockFormattingControls.some((control) => control.command === command)) {
                        event.preventDefault();
                        formatBlockDraft(command);
                      }
                    }
                  }}
                />
              </div>
              <section aria-label={`${copy.blockPreview} · ${editingBlockTarget.label}`}>
                <span>{copy.blockPreview}</span>
                <div className="visual-document-draft markdown-body">
                  {blockDraftSource.trim()
                    ? <MarkdownSource source={compiledBlockDraft.source} artifacts={artifacts} queryRuntime={queryRuntime} />
                    : <p className="visual-document-empty">{copy.blockEmpty}</p>}
                </div>
              </section>
            </div>
            {(editingBlock.error || blockDraftError) && <p className="visual-document-error" role="alert">{editingBlock.error || blockDraftError}</p>}
            <footer>
              <p>{copy.blockContract(editingBlockTarget.blockType)}</p>
              <div>
                <button type="button" disabled={editingBlock.submitting} onClick={() => setEditingBlock(null)}><X />{copy.cancel}</button>
                <button type="submit" disabled={editingBlock.submitting || !blockDraftCanSave}>
                  {editingBlock.submitting ? <LoaderCircle className="agent-spinner" /> : <Check />}{copy.saveBlock}
                </button>
              </div>
            </footer>
          </form>
        )}
        {insertingBlock && insertingBlockTarget && (
          <form
            className="visual-document-insert-editor"
            onSubmit={(event) => { event.preventDefault(); void submitBlockInsertion(insertingBlockTarget); }}
          >
            <header>
              <div>
                <span>{insertingBlock.action === "insert-before" ? copy.newBefore : copy.newAfter}</span>
                <strong>{insertingBlockTarget.label}</strong>
              </div>
              <small>{insertingBlock.draft.length.toLocaleString(copy.numberLocale)} / {MAX_VISUAL_DOCUMENT_INSERT_CHARS.toLocaleString(copy.numberLocale)}</small>
            </header>
            <label htmlFor={`visual-document-insert-${artifact.id}-${insertingBlockTarget.index}`}>{copy.oneMarkdownBlock}</label>
            <textarea
              id={`visual-document-insert-${artifact.id}-${insertingBlockTarget.index}`}
              ref={insertDraftRef}
              autoFocus
              aria-label={`Write one new Markdown block ${insertingBlock.action === "insert-before" ? "before" : "after"} ${insertingBlockTarget.label}`}
              value={insertingBlock.draft}
              disabled={insertingBlock.submitting}
              maxLength={MAX_VISUAL_DOCUMENT_INSERT_CHARS}
              spellCheck
              placeholder={copy.blockPlaceholder}
              onChange={(event) => setInsertingBlock((current) => current ? {
                ...current,
                draft: event.target.value,
                error: "",
              } : current)}
              onKeyDown={(event) => {
                if (event.key === "Escape") {
                  event.preventDefault();
                  setInsertingBlock(null);
                } else if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
                  event.preventDefault();
                  void submitBlockInsertion(insertingBlockTarget);
                }
              }}
            />
            {(insertingBlock.error || insertDraftError) && (
              <p className="visual-document-error" role="alert">{insertingBlock.error || insertDraftError}</p>
            )}
            <footer>
              <p>{copy.insertionContract}</p>
              <div>
                <button type="button" disabled={insertingBlock.submitting} onClick={() => setInsertingBlock(null)}><X />{copy.cancel}</button>
                <button type="submit" disabled={insertingBlock.submitting || !insertDraftCanReview}>
                  {insertingBlock.submitting ? <LoaderCircle className="agent-spinner" /> : <Check />}{copy.reviewInsertion}
                </button>
              </div>
            </footer>
          </form>
        )}
        {structureError && <p className="visual-document-error document-structure-inline-error" role="alert">{structureError}</p>}
        <div className="markdown-body">
          <MarkdownSource
            source={compiled.source}
            sourceOffsets={compiled.sourceOffsets}
            targetArtifact={artifact}
            artifacts={artifacts}
            queryRuntime={queryRuntime}
            documentBlockTargets={blockTargets}
            documentFragmentTargets={fragmentTargets}
            documentSectionTargets={targets}
            activeSelection={activeSelection}
            onTargetSource={onTargetSource}
            onEditDocumentBlock={onEditDocumentBlock}
            onBeginDocumentBlockEdit={beginBlockEdit}
            onBeginDocumentBlockStructure={onReviewDocumentBlockStructure
              && !editingSection
              && !editingBlock
              && !insertingBlock
              ? beginBlockStructure
              : undefined}
          />
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
  const copy = usePreviewCopy();
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
      <div className="data-summary" aria-label={copy.resultSummary}>
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
                data-preview-source-id={target?.id}
                key={rowIndex}
              >
                <th className="row-index">
                  {activate ? (
                    <button
                      type="button"
                      data-preview-source-target={target?.kind}
                      aria-label={copy.selectForAgent(target?.label ?? "")}
                      aria-pressed={active}
                      title={copy.exactRow}
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
                      data-preview-source-id={cellTarget?.id}
                    >
                      {editing && editableCellTarget && editingCell ? (
                        <form
                          className="visual-cell-editor"
                          onSubmit={(event) => { event.preventDefault(); void submitCellEdit(editableCellTarget); }}
                        >
                          <div className="visual-cell-fields">
                            <select
                              aria-label={copy.valueType(editableCellTarget.label)}
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
                              {editableFormat === "CSV" ? <option value="auto">{copy.auto}</option> : (
                                <>
                                  <option value="string">{copy.text}</option>
                                  <option value="number">{copy.number}</option>
                                  <option value="boolean">{copy.boolean}</option>
                                  <option value="null">{copy.empty}</option>
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
                            <button type="submit" aria-label={copy.saveCell(editableCellTarget.label)} disabled={editingCell.submitting} title={copy.saveCanonical}>
                              {editingCell.submitting ? <LoaderCircle className="agent-spinner" /> : <Check />}
                            </button>
                            <button type="button" aria-label={copy.cancelCell} disabled={editingCell.submitting} onClick={() => setEditingCell(null)}><X /></button>
                          </div>
                          {editingCell.error && <small role="alert">{editingCell.error}</small>}
                        </form>
                      ) : activateCell ? (
                        <>
                          <button
                            className="preview-cell-select"
                            type="button"
                            data-preview-source-target={cellTarget?.kind}
                            aria-label={copy.selectForAgent(cellTarget?.label ?? "")}
                            aria-pressed={cellActive}
                            title={copy.selectCellTitle(cellTarget?.label ?? "", cellEditable)}
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
                              aria-label={copy.editTarget(editableCellTarget.label)}
                              title={copy.editCell}
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
        {!rows.length && <div className="empty-grid-result">{copy.noRows}</div>}
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
  const copy = usePreviewCopy();
  const parsed = parseDataSource(artifact.source);
  if (parsed.errors.length) return <EmptyPreview message={parsed.errors[0]} />;
  return (
    <ResultGrid
      columns={parsed.columns}
      rows={parsed.rows.map((row) => parsed.columns.map((column) => row[column]))}
      badges={[
        { icon: "rows", label: copy.rows(parsed.rows.length) },
        { icon: "columns", label: copy.columns(parsed.columns.length) },
        { icon: "format", label: parsed.format },
      ]}
      footnote={onEditDataCell && cellTargets.some((target) => canVisualEditDataCell(artifact, target))
        ? copy.dataFootnote("edit")
        : onTargetSource && cellTargets.length
          ? copy.dataFootnote("cell")
        : onTargetSource && rowTargets.length
          ? copy.dataFootnote("row")
          : copy.dataFootnote("none")}
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
  const copy = usePreviewCopy();
  if (!runtimeEntry || runtimeEntry.status === "loading") {
    return (
      <div className="query-loading" role="status">
        <span><LoaderCircle aria-hidden="true" /></span>
        <strong>{copy.runningLocally}</strong>
        <p>{copy.loadingDuckDB}</p>
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
        { icon: "rows", label: copy.rows(result.rows.length, result.truncated) },
        { icon: "columns", label: copy.columns(result.columns.length) },
        { icon: "time", label: `${Math.max(1, Math.round(result.elapsedMs))} ms` },
      ]}
      footnote={copy.queryFootnote(result.engine, dataArtifact?.name ?? "workspace_data", result.lineageMode === "direct", result.truncated)}
      rowTargets={rowTargets}
      cellTargetRows={cellTargetRows}
      targetArtifact={dataArtifact}
      targetViaLabel={copy.queryResultVia(artifact.name)}
      onTargetSource={onTargetSource}
    />
  );
}

function ChartPreview({
  artifact,
  artifacts,
  queryRuntime,
  targets,
  activeSelection,
  onTargetSource,
  onEditChartSpec,
}: {
  artifact: WorkspaceArtifact;
  artifacts: WorkspaceArtifact[];
  queryRuntime: QueryRuntime;
  targets: PreviewSourceTarget[];
  activeSelection?: SourceSelection | null;
  onTargetSource?: PreviewTargetHandler;
  onEditChartSpec?: ChartSpecEditHandler;
}) {
  const copy = usePreviewCopy();
  const [editingChart, setEditingChart] = useState<{
    artifactId: string;
    sourceRevision: string;
    targetId: string;
    input: VisualChartSpecEditInput;
    error: string;
    submitting: boolean;
  } | null>(null);
  const target = targets.find((candidate) => candidate.kind === "chart-spec");
  const editingTarget = editingChart?.artifactId === artifact.id
    && editingChart.sourceRevision === artifact.source
    && target?.id === editingChart.targetId
    ? target
    : undefined;
  const currentSpec = parseChartSource(artifact.source).spec;
  const sourceFields = currentSpec
    ? visualChartSourceFields(artifacts, currentSpec.source)
    : { sourceName: copy.unknownSource, columns: [], errors: [copy.chartInvalid] };
  const draftSource = editingChart
    ? visualChartSpecPreviewSource(artifact, editingChart.input)
    : null;
  const draftArtifact = draftSource && !draftSource.errors.length
    ? { ...artifact, source: draftSource.source }
    : null;
  const draftResolution = draftArtifact
    ? resolvePreviewChart(draftArtifact, artifacts, queryRuntime)
    : null;
  const draftError = draftSource?.errors[0]
    ?? sourceFields.errors[0]
    ?? draftResolution?.errors[0]
    ?? "";
  const resolution = resolvePreviewChart(artifact, artifacts, queryRuntime);
  if (!resolution.model) return <EmptyPreview message={resolution.errors[0] ?? copy.chartCouldNotCompile} />;

  function beginChartEdit() {
    if (!target || !onEditChartSpec || !canVisualEditChartSpec(artifact, target)) return;
    const input = visualChartSpecDraft(artifact);
    if (!input) return;
    setEditingChart({
      artifactId: artifact.id,
      sourceRevision: artifact.source,
      targetId: target.id,
      input,
      error: "",
      submitting: false,
    });
  }

  function updateChartInput<K extends keyof VisualChartSpecEditInput>(
    key: K,
    value: VisualChartSpecEditInput[K],
  ) {
    setEditingChart((current) => current ? {
      ...current,
      input: { ...current.input, [key]: value },
      error: "",
    } : current);
  }

  async function submitChartEdit() {
    if (!editingChart || !editingTarget || !onEditChartSpec) return;
    setEditingChart((current) => current ? { ...current, error: "", submitting: true } : current);
    const error = await onEditChartSpec(artifact, editingTarget, editingChart.input);
    if (error) {
      setEditingChart((current) => current ? { ...current, error, submitting: false } : current);
      return;
    }
    setEditingChart(null);
  }

  const targetActive = Boolean(target && previewTargetIsActive(target, activeSelection));
  return (
    <div className="chart-stage">
      {target && (onTargetSource || onEditChartSpec) && (
        <div className="chart-stage-toolbar" data-preview-source-id={target.id}>
          <div><span>{copy.boundChartSource}</span><strong>{sourceFields.sourceName}</strong></div>
          <div>
            {onTargetSource && (
              <button
                className={targetActive ? "active" : ""}
                data-preview-source-target="chart-spec"
                type="button"
                aria-pressed={targetActive}
                onClick={() => onTargetSource(artifact, target)}
                title={copy.completeChartSource}
              ><MousePointer2 aria-hidden="true" />{copy.source}</button>
            )}
            {onEditChartSpec && canVisualEditChartSpec(artifact, target) && (
              <button
                className={editingTarget ? "active" : ""}
                type="button"
                aria-expanded={Boolean(editingTarget)}
                onClick={beginChartEdit}
              ><PencilLine aria-hidden="true" />{copy.configure}</button>
            )}
          </div>
        </div>
      )}
      {editingChart && editingTarget && (
        <form
          className="visual-chart-editor"
          aria-busy={editingChart.submitting}
          onSubmit={(event) => { event.preventDefault(); void submitChartEdit(); }}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              event.preventDefault();
              setEditingChart(null);
            } else if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
              event.preventDefault();
              void submitChartEdit();
            }
          }}
        >
          <header>
            <div><span>{copy.editingChart}</span><strong>{editingChart.input.title || copy.untitledChart}</strong></div>
            <small>{copy.chartLocked}</small>
          </header>
          <div className="visual-chart-editor-grid">
            <div className="visual-chart-fields">
              <label className="visual-chart-field-wide">
                <span>{copy.title}</span>
                <input
                  autoFocus
                  aria-label={copy.editChartTitle}
                  value={editingChart.input.title}
                  disabled={editingChart.submitting}
                  maxLength={120}
                  onChange={(event) => updateChartInput("title", event.target.value)}
                />
              </label>
              <label className="visual-chart-field-wide">
                <span>{copy.description} <small>{copy.optional}</small></span>
                <textarea
                  aria-label={copy.editChartDescription}
                  value={editingChart.input.description}
                  disabled={editingChart.submitting}
                  maxLength={240}
                  onChange={(event) => updateChartInput("description", event.target.value)}
                />
              </label>
              <label>
                <span>{copy.mark}</span>
                <select value={editingChart.input.mark} disabled={editingChart.submitting} onChange={(event) => updateChartInput("mark", event.target.value as VisualChartSpecEditInput["mark"])}>
                  <option value="bar">{copy.bar}</option>
                  <option value="line">{copy.line}</option>
                </select>
              </label>
              <label>
                <span>{copy.sort}</span>
                <select value={editingChart.input.sort} disabled={editingChart.submitting} onChange={(event) => updateChartInput("sort", event.target.value as VisualChartSpecEditInput["sort"])}>
                  <option value="source">{copy.sourceOrder}</option>
                  <option value="ascending">{copy.ascending}</option>
                  <option value="descending">{copy.descending}</option>
                </select>
              </label>
              <label>
                <span>{copy.categoryField}</span>
                <select value={editingChart.input.category} disabled={editingChart.submitting} onChange={(event) => updateChartInput("category", event.target.value)}>
                  {sourceFields.columns.map((column) => <option value={column} key={column}>{column}</option>)}
                </select>
              </label>
              <label>
                <span>{copy.valueField}</span>
                <select value={editingChart.input.value} disabled={editingChart.submitting} onChange={(event) => updateChartInput("value", event.target.value)}>
                  {sourceFields.columns.map((column) => <option value={column} key={column}>{column}</option>)}
                </select>
              </label>
              <label>
                <span>{copy.numberFormat}</span>
                <select value={editingChart.input.format} disabled={editingChart.submitting} onChange={(event) => updateChartInput("format", event.target.value as VisualChartSpecEditInput["format"])}>
                  <option value="currency">{copy.currency}</option>
                  <option value="number">{copy.number}</option>
                  <option value="percent">{copy.percent}</option>
                </select>
              </label>
              <label>
                <span>{copy.visibleMarks} <output>{editingChart.input.maxItems}</output></span>
                <input
                  aria-label={copy.chooseVisibleMarks}
                  type="range"
                  min="1"
                  max="20"
                  value={editingChart.input.maxItems}
                  disabled={editingChart.submitting}
                  onChange={(event) => updateChartInput("maxItems", Number(event.target.value))}
                />
              </label>
              <label className="visual-chart-color-field visual-chart-field-wide">
                <span>{copy.accentColor}</span>
                <div>
                  <input
                    aria-label={copy.chooseAccentColor}
                    type="color"
                    value={/^#[0-9a-f]{6}$/iu.test(editingChart.input.color) ? editingChart.input.color.toLowerCase() : "#ff5c35"}
                    disabled={editingChart.submitting}
                    onChange={(event) => updateChartInput("color", event.target.value)}
                  />
                  <input
                    aria-label={copy.editAccentHex}
                    value={editingChart.input.color}
                    disabled={editingChart.submitting}
                    maxLength={7}
                    spellCheck={false}
                    onChange={(event) => updateChartInput("color", event.target.value)}
                  />
                </div>
              </label>
              <p className="visual-chart-source-lock">{copy.chartSourceLock(sourceFields.sourceName)}</p>
            </div>
            <section className="visual-chart-draft" aria-label={copy.chartDraft}>
              <span>{copy.runtimeDraft}</span>
              {draftResolution?.model && !draftError
                ? <ChartFigure model={draftResolution.model} artifacts={artifacts} embedded />
                : <div className="visual-chart-draft-error"><AlertTriangle aria-hidden="true" /><p>{draftError || copy.chooseChartProperties}</p></div>}
            </section>
          </div>
          {editingChart.error && <p className="visual-chart-error" role="alert">{editingChart.error}</p>}
          <footer>
            <p>{copy.chartContract}</p>
            <div>
              <button type="button" disabled={editingChart.submitting} onClick={() => setEditingChart(null)}><X />{copy.cancel}</button>
              <button type="submit" disabled={editingChart.submitting || Boolean(draftError) || !draftResolution?.model}>
                {editingChart.submitting ? <LoaderCircle className="agent-spinner" /> : <Check />}{copy.saveChart}
              </button>
            </div>
          </footer>
        </form>
      )}
      <ChartFigure model={resolution.model} artifacts={artifacts} onTargetSource={onTargetSource} />
    </div>
  );
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
  const copy = usePreviewCopy();
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
      <div className="slides-stage-meta"><span>{copy.slides(slideCount)}</span><span>{copy.deckMode(deckCompilation ? onEditDeckSlide ? "edit" : "sandbox" : "legacy")}</span></div>
      {(onTargetSource || onEditDeckSlide) && targets.length > 0 && (
        <nav className="slide-targets" aria-label={copy.selectDeckSlide}>
          {targets.map((target) => {
            const active = previewTargetIsActive(target, activeSelection);
            const editable = Boolean(onEditDeckSlide && canVisualEditDeckSlide(artifact, target));
            const editing = editingTarget?.id === target.id;
            return (
              <span
                className={`slide-target ${active ? "active" : ""} ${editing ? "editing" : ""}`.trim()}
                data-preview-source-id={target.id}
                key={target.id}
              >
                {onTargetSource && (
                  <button
                    className="slide-target-select"
                    data-preview-source-target={target.kind}
                    type="button"
                    aria-pressed={active}
                    onClick={() => onTargetSource(artifact, target)}
                    title={copy.selectExact(target.label)}
                  >
                    <span>{String(target.index + 1).padStart(2, "0")}</span>
                    <strong>{target.label}</strong>
                  </button>
                )}
                {editable && (
                  <button
                    className="slide-target-edit"
                    type="button"
                    aria-label={copy.editTarget(target.label)}
                    title={copy.editTarget(target.label)}
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
            <div><span>{copy.editingSlide(editingTarget.index + 1)}</span><strong>{editingTarget.label}</strong></div>
            <small>{editingSlide.draft.length.toLocaleString(copy.numberLocale)} / {MAX_VISUAL_DECK_SLIDE_CHARS.toLocaleString(copy.numberLocale)}</small>
          </header>
          <div className="visual-deck-editor-grid">
            <div className="visual-deck-fields">
              <div className="visual-deck-field-row">
                <label>
                  <span>{copy.layout}</span>
                  <select
                    aria-label={copy.chooseLayout(editingTarget.label)}
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
                  <span>{copy.eyebrow} <small>{copy.optional}</small></span>
                  <input
                    aria-label={copy.editEyebrow(editingTarget.label)}
                    value={editingSlide.eyebrow}
                    disabled={editingSlide.submitting}
                    maxLength={100}
                    onChange={(event) => setEditingSlide((current) => current ? { ...current, eyebrow: event.target.value, error: "" } : current)}
                  />
                </label>
              </div>
              <label className="visual-deck-markdown-field">
                <span>{copy.slideMarkdown}</span>
                <textarea
                  autoFocus
                  aria-label={copy.editSlideMarkdown(editingTarget.label)}
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
            <section className="visual-deck-draft" aria-label={copy.slideDraft(editingTarget.label)}>
              <span>{copy.sandboxedSlide}</span>
              {draftRenderedSource && !draftPreviewError
                ? <iframe srcDoc={draftRenderedSource} sandbox="" title={copy.slideDraft(editingTarget.label)} />
                : <div className="visual-deck-draft-error"><AlertTriangle aria-hidden="true" /><p>{draftPreviewError || copy.validSlideHeading}</p></div>}
            </section>
          </div>
          {editingSlide.error && <p className="visual-deck-error" role="alert">{editingSlide.error}</p>}
          <footer>
            <p>{copy.slideContract}</p>
            <div>
              <button type="button" disabled={editingSlide.submitting} onClick={() => setEditingSlide(null)}><X />{copy.cancel}</button>
              <button type="submit" disabled={editingSlide.submitting || !editingSlide.draft.trim() || Boolean(draftPreviewError)}>
                {editingSlide.submitting ? <LoaderCircle className="agent-spinner" /> : <Check />}{copy.saveSlide}
              </button>
            </div>
          </footer>
        </form>
      )}
      <iframe
        className="slides-frame"
        srcDoc={renderedSource}
        sandbox=""
        title={copy.renderedPresentation}
      />
    </div>
  );
}

export function ArtifactPreview({
  artifact,
  artifacts,
  locale,
  activeSelection,
  onTargetSource,
  onEditDataCell,
  onEditDocumentSection,
  onEditDocumentBlock,
  onReviewDocumentBlockStructure,
  onEditDeckSlide,
  onEditChartSpec,
}: {
  artifact: WorkspaceArtifact;
  artifacts: WorkspaceArtifact[];
  locale: RuneLocale;
  activeSelection?: SourceSelection | null;
  onTargetSource?: PreviewTargetHandler;
  onEditDataCell?: DataCellEditHandler;
  onEditDocumentSection?: DocumentSectionEditHandler;
  onEditDocumentBlock?: DocumentBlockEditHandler;
  onReviewDocumentBlockStructure?: DocumentBlockStructureReviewHandler;
  onEditDeckSlide?: DeckSlideEditHandler;
  onEditChartSpec?: ChartSpecEditHandler;
}) {
  const queryRuntime = usePreviewQueryRuntime(artifact, artifacts);
  const copy = useMemo(() => runeUICopy(locale).preview, [locale]);
  let content: ReactNode;
  if (!artifact.source.trim()) {
    content = <EmptyPreview message={copy.startWriting} />;
  } else {
    const compiled = compileArtifactSource(
      artifact.source,
      artifacts,
      readyQuerySnapshots(queryRuntime),
    );
    if (artifact.kind === "data") {
    const targets = deriveDataPreviewSourceTargets(artifact);
      content = <DataPreview artifact={artifact} rowTargets={targets.rows} cellTargets={targets.cells} activeSelection={activeSelection} onTargetSource={onTargetSource} onEditDataCell={onEditDataCell} />;
    } else {
      const targets = derivePreviewSourceTargets(artifact);
      if (artifact.kind === "document") content = <DocumentPreview key={artifact.id} artifact={artifact} artifacts={artifacts} queryRuntime={queryRuntime} targets={targets} activeSelection={activeSelection} onTargetSource={onTargetSource} onEditDocumentSection={onEditDocumentSection} onEditDocumentBlock={onEditDocumentBlock} onReviewDocumentBlockStructure={onReviewDocumentBlockStructure} />;
      else if (artifact.kind === "query") {
        const dataArtifact = resolveQueryDataArtifact(artifact, artifacts).artifact;
        content = <QueryPreview artifact={artifact} dataArtifact={dataArtifact} runtimeEntry={queryRuntime[artifact.id]} onTargetSource={onTargetSource} />;
      } else if (artifact.kind === "chart") content = <ChartPreview artifact={artifact} artifacts={artifacts} queryRuntime={queryRuntime} targets={targets} activeSelection={activeSelection} onTargetSource={onTargetSource} onEditChartSpec={onEditChartSpec} />;
      else content = <SlidesPreview artifact={artifact} source={compiled.source} artifacts={artifacts} queryRuntime={queryRuntime} targets={targets} activeSelection={activeSelection} onTargetSource={onTargetSource} onEditDeckSlide={onEditDeckSlide} />;
    }
  }
  return <PreviewCopyContext.Provider value={copy}>{content}</PreviewCopyContext.Provider>;
}
