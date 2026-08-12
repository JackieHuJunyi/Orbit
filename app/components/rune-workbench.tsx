"use client";

import {
  BarChart3,
  BookOpen,
  Bot,
  Check,
  CheckCircle2,
  ChevronRight,
  CircleDot,
  Code2,
  Database,
  Download,
  FileCode2,
  FilePlus2,
  FileOutput,
  FileText,
  FolderOpen,
  History,
  LayoutGrid,
  Link2,
  LoaderCircle,
  PanelLeftClose,
  PanelLeftOpen,
  Pin,
  Play,
  Presentation,
  RotateCcw,
  RefreshCw,
  Save,
  Sparkles,
  TableProperties,
  Undo2,
  Upload,
  X,
} from "lucide-react";
import { ChangeEvent, KeyboardEvent, SyntheticEvent, useEffect, useMemo, useRef, useState } from "react";
import {
  ArtifactPreview,
  type ChartSpecEditHandler,
  type DataCellEditHandler,
  type DeckSlideEditHandler,
  type DocumentSectionEditHandler,
} from "./artifact-previews";
import { EmptyWorkspace } from "./empty-workspace";
import { ExportReviewDialog } from "./export-review-dialog";
import { ImportReviewDialog } from "./import-review-dialog";
import { NewArtifactDialog } from "./new-artifact-dialog";
import { TransactionReviewMap } from "./transaction-review-map";
import { WelcomeExperience, type WelcomeAction, type WelcomeStep } from "./welcome-experience";
import {
  commitPreparedArtifactCreation,
  prepareArtifactCreation,
  type ArtifactCreationInput,
} from "../lib/artifact-creation";
import {
  artifactStats,
  cloneDefaultArtifacts,
  detectArtifact,
  normalizeWorkspaceArtifacts,
  planLocalChange,
  parseDataSource,
  quickCommands,
  validateArtifact,
  workspaceQuickCommands,
  type ArtifactKind,
  type WorkspaceArtifact,
} from "../lib/workspace";
import { planLocalWorkspaceAgentChange } from "../lib/local-workspace-agent";
import { planLocalSelectionChange, selectionQuickCommands } from "../lib/local-selection-agent";
import {
  compileArtifactSource,
  findMetricReferences,
  findQueryMetricReferences,
  queryMetricSourceIdsForArtifact,
} from "../lib/bindings";
import {
  chartQuerySourceIdsForArtifact,
  findChartReferences,
  parseChartSource,
  validateChartSourceBinding,
} from "../lib/charts";
import { prepareChartEmbedding } from "../lib/chart-embedding";
import { isDeckMarkdownArtifact } from "../lib/deck";
import {
  appendCheckpoint,
  canCheckpointSource,
  createCheckpoint,
  normalizeCheckpointMap,
  type CheckpointMap,
  type CheckpointReason,
  type WorkspaceCheckpoint,
} from "../lib/checkpoints";
import {
  captureWorkspaceSourceRevision,
  createLineDiffPreview,
  prepareWorkspaceMutation,
  workspaceMatchesSourceRevision,
  type ArtifactCreationChange,
  type ArtifactSourcePatch,
  type WorkspaceSourceRevision,
} from "../lib/patches";
import {
  prepareWorkspaceImportReview,
  validateWorkspaceImportReview,
  type WorkspaceImportReview,
} from "../lib/imports";
import {
  chooseWorkspaceDirectory,
  readWorkspaceDirectory,
  supportsDirectoryWorkspace,
  writeWorkspaceDirectory,
  type DirectoryReadResult,
  type DirectoryWorkspaceHandle,
} from "../lib/directory-workspace";
import type { ArtifactExportResult } from "../lib/export-contract";
import type { WorkspaceQuerySnapshot } from "../lib/query-snapshot";
import type { RuntimeImpactPreflight } from "../lib/query-preflight";
import { buildAgentRuntimeRepair, type AgentRuntimeRepair } from "../lib/agent-repair";
import { resolveQueryDataArtifact } from "../lib/query-source";
import {
  MAX_WORKSPACE_AGENT_ARTIFACT_CHARS,
  MAX_WORKSPACE_AGENT_PINS,
  buildWorkspaceDependencyGraph,
  selectWorkspaceAgentContext,
  workspaceAgentContextFitsSourceLimits,
  workspaceAgentContextIsClosed,
  type WorkspaceDependencyGraph,
  type WorkspaceDependencyKind,
} from "../lib/dependency-graph";
import type { PreviewSourceTarget } from "../lib/preview-targets";
import { buildWorkspaceTransactionReview } from "../lib/transaction-review";
import {
  MAX_AGENT_SELECTION_CHARS,
  sourceOutsideSelectionIsUnchanged,
  sourceSelectionError,
  type SourceSelection,
} from "../lib/source-selection";
import { formatInteger } from "../lib/number-format";
import {
  createRuneGuideArtifact,
  detectPreferredLocale,
  normalizeRuneLocale,
  RUNE_GUIDE_ID,
  RUNE_LOCALE_STORAGE_KEY,
  RUNE_ONBOARDING_STORAGE_KEY,
  type RuneLocale,
} from "../lib/localization";
import {
  normalizeRuneModelMode,
  RUNE_MODEL_MODE_STORAGE_KEY,
  type RuneModelMode,
} from "../lib/model-preference";
import { prepareVisualDataCellEdit } from "../lib/visual-data-edit";
import { prepareVisualDocumentSectionEdit } from "../lib/visual-document-edit";
import { prepareVisualDeckSlideEdit } from "../lib/visual-deck-edit";
import { prepareVisualChartSpecEdit } from "../lib/visual-chart-edit";

const STORAGE_KEY = "rune-workspace-v0";
const MAX_SOURCE_IMPORT_BYTES = 2 * 1024 * 1024;
const MAX_OFFICE_IMPORT_BYTES = 12 * 1024 * 1024;
const OFFICE_IMPORT_PATTERN = /\.(?:docx|xlsx|pptx)$/i;

async function preflightRuntimeMutation(
  artifacts: WorkspaceArtifact[],
  patches: ArtifactSourcePatch[],
  creations: ArtifactCreationChange[],
) {
  const changesRuntimeSource = patches.some((patch) => (
    ["data", "query", "chart"].includes(
      artifacts.find((artifact) => artifact.id === patch.artifactId)?.kind ?? "",
    )
  )) || creations.some((creation) => ["data", "query", "chart"].includes(creation.artifact.kind));
  if (!changesRuntimeSource) return undefined;
  const { preflightAgentRuntimeImpact } = await import("../lib/query-preflight");
  let queryRuntime: Promise<typeof import("../lib/duckdb-client")> | null = null;
  return await preflightAgentRuntimeImpact(
    artifacts,
    patches,
    creations,
    async (queryArtifact, dataArtifact) => {
      queryRuntime ??= import("../lib/duckdb-client");
      const { runWorkspaceQuerySnapshot } = await queryRuntime;
      return runWorkspaceQuerySnapshot(queryArtifact, dataArtifact);
    },
  ) ?? undefined;
}

type AgentScope = "selection" | "artifact" | "workspace";

type ActiveSourceSelection = SourceSelection & {
  artifactId: string;
  sourceRevision: string;
};

type PendingChange = {
  prompt: string;
  provider: "openai" | "local";
  scope: AgentScope;
  selection?: SourceSelection;
  baseRevision: WorkspaceSourceRevision;
  summary: string;
  detail: string;
  patches: ArtifactSourcePatch[];
  creations: ArtifactCreationChange[];
  runtimeRepair?: Pick<AgentRuntimeRepair, "attempt" | "failure">;
  runtimePreflight?: RuntimeImpactPreflight;
};

type PendingExport = {
  sourceArtifactName: string;
  baseArtifacts: WorkspaceArtifact[];
  result: ArtifactExportResult;
};

type RemoteFilePlan = ArtifactSourcePatch & { operationCount: number };
type RemoteSinglePlan = Omit<RemoteFilePlan, "artifactId">;
type RemoteCreationPlan = ArtifactCreationChange & { operationCount: number };
type RemoteWorkspacePlan = {
  summary: string;
  detail: string;
  patches: RemoteFilePlan[];
  creations: RemoteCreationPlan[];
};

type RemoteAgentResponse = {
  error?: string;
  code?: string;
  provider?: string;
  model?: string;
  plan?: unknown;
  queryArtifactIds?: string[];
  repairAttempt?: number;
};

function isRemoteSinglePlan(value: unknown): value is RemoteSinglePlan {
  return Boolean(
    value && typeof value === "object"
    && typeof (value as RemoteSinglePlan).nextSource === "string"
    && typeof (value as RemoteSinglePlan).summary === "string"
    && typeof (value as RemoteSinglePlan).detail === "string"
    && Number.isInteger((value as RemoteSinglePlan).operationCount)
    && (value as RemoteSinglePlan).operationCount > 0
  );
}

function isRemoteWorkspacePlan(value: unknown): value is RemoteWorkspacePlan {
  if (!value || typeof value !== "object") return false;
  const plan = value as RemoteWorkspacePlan;
  const patchesValid = Array.isArray(plan.patches)
    && plan.patches.every((patch) => typeof patch.artifactId === "string"
      && typeof patch.nextSource === "string"
      && typeof patch.summary === "string"
      && typeof patch.detail === "string"
      && Number.isInteger(patch.operationCount)
      && patch.operationCount > 0);
  const creationsValid = Array.isArray(plan.creations)
    && plan.creations.every((creation) => {
      const artifact = creation.artifact;
      return Boolean(artifact)
        && typeof artifact.id === "string"
        && typeof artifact.name === "string"
        && ["document", "data", "query", "chart", "slides"].includes(artifact.kind)
        && typeof artifact.language === "string"
        && typeof artifact.source === "string"
        && typeof creation.summary === "string"
        && typeof creation.detail === "string"
        && Number.isInteger(creation.operationCount)
        && creation.operationCount >= 0
        && creation.operationCount <= 8;
    });
  const actionCount = (plan.patches?.length ?? 0) + (plan.creations?.length ?? 0);
  return typeof plan.summary === "string"
    && typeof plan.detail === "string"
    && patchesValid
    && creationsValid
    && actionCount > 0
    && actionCount <= 4;
}

function ArtifactIcon({ kind, size = 16 }: { kind: ArtifactKind; size?: number }) {
  if (kind === "document") return <FileText size={size} aria-hidden="true" />;
  if (kind === "data") return <TableProperties size={size} aria-hidden="true" />;
  if (kind === "query") return <Database size={size} aria-hidden="true" />;
  if (kind === "chart") return <BarChart3 size={size} aria-hidden="true" />;
  return <Presentation size={size} aria-hidden="true" />;
}

function DependencyKindIcon({ kind }: { kind: WorkspaceDependencyKind }) {
  if (kind === "query" || kind === "query-metric") return <Database aria-hidden="true" />;
  if (kind === "chart-data" || kind === "chart-query" || kind === "chart-embed") return <BarChart3 aria-hidden="true" />;
  return <Link2 aria-hidden="true" />;
}

function DependencyGraphRail({
  artifacts,
  graph,
  contextArtifacts,
  pinnedArtifactIds,
  selectedArtifactId,
  onClearPins,
  onSelect,
}: {
  artifacts: WorkspaceArtifact[];
  graph: WorkspaceDependencyGraph;
  contextArtifacts: WorkspaceArtifact[];
  pinnedArtifactIds: string[];
  selectedArtifactId: string;
  onClearPins: () => void;
  onSelect: (artifactId: string) => void;
}) {
  const artifactById = new Map(artifacts.map((artifact) => [artifact.id, artifact] as const));
  const contextIds = new Set(contextArtifacts.map((artifact) => artifact.id));
  const pinnedIds = new Set(pinnedArtifactIds);
  const connectedIds = new Set(graph.edges.flatMap((edge) => [edge.fromArtifactId, edge.toArtifactId]));
  const unlinkedArtifacts = artifacts.filter((artifact) => !connectedIds.has(artifact.id));
  return (
    <aside className="file-rail dependency-rail" aria-label="Workspace dependency graph">
      <div className="file-rail-header">
        <div><span className="overline">Live context</span><strong>Dependency graph</strong></div>
        <span className="dependency-count" aria-label={`${graph.edges.length} dependency edges`}>{graph.edges.length}</span>
      </div>
      <section className="graph-context-card" aria-label="Workspace Agent context pack">
        <div className="graph-context-heading">
          <span>Agent context</span>
          <span><strong>{contextArtifacts.length} / {artifacts.length}</strong>{pinnedArtifactIds.length > 0 && <button type="button" onClick={onClearPins}>Clear pins</button>}</span>
        </div>
        <p>Current bindings and temporary pins choose a bounded, revision-live context pack.</p>
        <nav aria-label="Artifacts in Agent context">
          {contextArtifacts.map((artifact) => (
            <button
              type="button"
              key={artifact.id}
              className={`${artifact.id === selectedArtifactId ? "active" : ""} ${pinnedIds.has(artifact.id) ? "pinned" : ""}`.trim() || undefined}
              onClick={() => onSelect(artifact.id)}
              aria-current={artifact.id === selectedArtifactId ? "page" : undefined}
              aria-label={`Open ${artifact.name}${pinnedIds.has(artifact.id) ? ", manually pinned in Agent context" : ""}`}
            >
              <span className={`artifact-icon ${artifact.kind}`}><ArtifactIcon kind={artifact.kind} size={11} /></span>
              <span>{artifact.name}</span>
              {pinnedIds.has(artifact.id) && <Pin className="context-pin-marker" aria-hidden="true" />}
            </button>
          ))}
        </nav>
      </section>
      <div className="artifact-group-label"><span>Source → consumer</span><span>{graph.edges.length}</span></div>
      <div className="dependency-edge-list" role="list" aria-label="Live artifact dependencies">
        {graph.edges.map((edge) => {
          const source = artifactById.get(edge.fromArtifactId);
          const consumer = artifactById.get(edge.toArtifactId);
          if (!source || !consumer) return null;
          const active = source.id === selectedArtifactId || consumer.id === selectedArtifactId;
          return (
            <div
              className={`dependency-edge ${active ? "active" : ""}`.trim()}
              data-agent-context={contextIds.has(source.id) && contextIds.has(consumer.id) ? "true" : undefined}
              key={`${edge.fromArtifactId}-${edge.toArtifactId}-${edge.kind}`}
              role="listitem"
            >
              <button type="button" className="dependency-endpoint" onClick={() => onSelect(source.id)} aria-label={`Open dependency source ${source.name}`}>
                <span className={`artifact-icon ${source.kind}`}><ArtifactIcon kind={source.kind} size={11} /></span>
                <span>{source.name}</span>
              </button>
              <div className={`dependency-relation ${edge.kind}`} title={edge.references.join(", ")}>
                <DependencyKindIcon kind={edge.kind} />
                <span>{edge.label}</span>
                <ChevronRight aria-hidden="true" />
              </div>
              <button type="button" className="dependency-endpoint" onClick={() => onSelect(consumer.id)} aria-label={`Open dependency consumer ${consumer.name}`}>
                <span className={`artifact-icon ${consumer.kind}`}><ArtifactIcon kind={consumer.kind} size={11} /></span>
                <span>{consumer.name}</span>
              </button>
            </div>
          );
        })}
        {!graph.edges.length && <p className="dependency-empty">Add a metric, query, or chart binding to create the first live edge.</p>}
      </div>
      {!!graph.issues.length && (
        <section className="dependency-issues" aria-label="Unresolved dependencies">
          <span className="overline">Needs attention · {graph.issues.length}</span>
          {graph.issues.map((issue) => {
            const artifact = artifactById.get(issue.artifactId);
            return (
              <button type="button" key={`${issue.artifactId}-${issue.kind}-${issue.target}`} onClick={() => onSelect(issue.artifactId)}>
                <X aria-hidden="true" /><span>{artifact?.name ?? issue.artifactId}</span><small>{issue.message}</small>
              </button>
            );
          })}
        </section>
      )}
      {!!unlinkedArtifacts.length && (
        <section className="unlinked-artifacts" aria-label="Unlinked artifacts">
          <span className="overline">Unlinked</span>
          <div>{unlinkedArtifacts.map((artifact) => (
            <button type="button" key={artifact.id} onClick={() => onSelect(artifact.id)}>{artifact.name}</button>
          ))}</div>
        </section>
      )}
      <div className="file-rail-spacer" />
      <div className="workspace-note graph-note">
        <Database aria-hidden="true" />
        <div><strong>No hidden graph state</strong><span>Edges recompile from source; pins last only for this session.</span></div>
      </div>
    </aside>
  );
}

function officeExportType(artifact: WorkspaceArtifact): "DOCX" | "XLSX" | "PPTX" | null {
  if (artifact.kind === "document") return "DOCX";
  if (artifact.kind === "data") return "XLSX";
  if (artifact.kind === "slides" && isDeckMarkdownArtifact(artifact)) return "PPTX";
  return null;
}

function getDiffStats(before: string, after: string) {
  const beforeLines = new Set(before.split("\n"));
  const afterLines = new Set(after.split("\n"));
  let additions = 0;
  let removals = 0;
  afterLines.forEach((line) => { if (!beforeLines.has(line)) additions += 1; });
  beforeLines.forEach((line) => { if (!afterLines.has(line)) removals += 1; });
  return { additions, removals };
}

function checkpointReasonLabel(reason: CheckpointReason) {
  return { agent: "Agent", manual: "Manual", restore: "Restore safety" }[reason];
}

function checkpointTime(createdAt: string) {
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })
    .format(new Date(createdAt));
}

function persistDeviceWorkspace(artifacts: WorkspaceArtifact[], selectedId: string, checkpoints: CheckpointMap) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ artifacts, selectedId, checkpoints }));
}

function downloadArtifact(artifact: WorkspaceArtifact) {
  const mime = artifact.kind === "document"
    ? "text/markdown"
    : artifact.kind === "query"
      ? "application/sql"
      : artifact.kind === "slides" && isDeckMarkdownArtifact(artifact)
        ? "text/markdown"
      : artifact.name.endsWith(".json")
        ? "application/json"
        : artifact.kind === "data"
          ? "text/csv"
          : "text/html";
  const url = URL.createObjectURL(new Blob([artifact.source], { type: `${mime};charset=utf-8` }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = artifact.name;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function RuneWorkbench() {
  const [artifacts, setArtifacts] = useState<WorkspaceArtifact[]>(() => cloneDefaultArtifacts());
  const [selectedId, setSelectedId] = useState("q2-review");
  const [hydrated, setHydrated] = useState(false);
  const [saveState, setSaveState] = useState<"saved" | "saving" | "error">("saved");
  const [savedAt, setSavedAt] = useState("just now");
  const [fileRailOpen, setFileRailOpen] = useState(true);
  const [railView, setRailView] = useState<"workspace" | "graph">("workspace");
  const [workspacePinnedArtifactIds, setWorkspacePinnedArtifactIds] = useState<string[]>([]);
  const [prompt, setPrompt] = useState("");
  const [pendingChange, setPendingChange] = useState<PendingChange | null>(null);
  const [pendingReviewId, setPendingReviewId] = useState("");
  const [sourceSelection, setSourceSelection] = useState<ActiveSourceSelection | null>(null);
  const [newArtifactOpen, setNewArtifactOpen] = useState(false);
  const [newArtifactError, setNewArtifactError] = useState("");
  const [pendingImport, setPendingImport] = useState<WorkspaceImportReview | null>(null);
  const [importError, setImportError] = useState("");
  const [importState, setImportState] = useState<"idle" | "reading">("idle");
  const [pendingExport, setPendingExport] = useState<PendingExport | null>(null);
  const [exportError, setExportError] = useState("");
  const [exportState, setExportState] = useState<"idle" | "office" | "html" | "pdf">("idle");
  const [agentError, setAgentError] = useState("");
  const [agentState, setAgentState] = useState<"idle" | "planning">("idle");
  const [agentMode, setAgentMode] = useState<"openai" | "local">("local");
  const [agentScope, setAgentScope] = useState<AgentScope>("artifact");
  const [checkpoints, setCheckpoints] = useState<CheckpointMap>({});
  const [historyOpen, setHistoryOpen] = useState(false);
  const [directoryHandle, setDirectoryHandle] = useState<DirectoryWorkspaceHandle | null>(null);
  const [directoryState, setDirectoryState] = useState<"disconnected" | "syncing" | "connected" | "error">("disconnected");
  const [notice, setNotice] = useState("Local workspace ready");
  const [locale, setLocale] = useState<RuneLocale>("en");
  const [detectedLocale, setDetectedLocale] = useState<RuneLocale>("en");
  const [modelMode, setModelMode] = useState<RuneModelMode>("auto");
  const [welcomeOpen, setWelcomeOpen] = useState(false);
  const [welcomeStartAt, setWelcomeStartAt] = useState<WelcomeStep>("welcome");
  const [welcomeDismissible, setWelcomeDismissible] = useState(false);
  const [emptyWorkspace, setEmptyWorkspace] = useState(false);
  const [visualEditState, setVisualEditState] = useState<"idle" | "checking">("idle");
  const gutterRef = useRef<HTMLPreElement>(null);
  const sourceEditorRef = useRef<HTMLTextAreaElement>(null);
  const promptRef = useRef<HTMLTextAreaElement>(null);
  const previewSelectionNoticeRef = useRef<PreviewSourceTarget | null>(null);
  const importRef = useRef<HTMLInputElement>(null);
  const importInFlightRef = useRef(false);
  const exportInFlightRef = useRef(false);
  const visualEditInFlightRef = useRef(false);
  const artifactsRef = useRef(artifacts);
  const checkpointsRef = useRef(checkpoints);
  artifactsRef.current = artifacts;
  checkpointsRef.current = checkpoints;

  const selectedArtifact = artifacts.find((artifact) => artifact.id === selectedId) ?? artifacts[0];
  const selectedOfficeExportType = selectedArtifact ? officeExportType(selectedArtifact) : null;
  const selectedHtmlExport = Boolean(selectedArtifact?.kind === "slides" && isDeckMarkdownArtifact(selectedArtifact));
  const selectedPdfExport = Boolean(selectedArtifact?.kind === "document" || selectedHtmlExport);
  const selectedCheckpoints = checkpoints[selectedArtifact?.id] ?? [];
  const currentSourceSelection = sourceSelection?.artifactId === selectedArtifact?.id
    && sourceSelection.sourceRevision === selectedArtifact?.source
    ? sourceSelection
    : null;
  const currentSelectionError = currentSourceSelection && selectedArtifact
    ? sourceSelectionError(selectedArtifact.source, currentSourceSelection)
    : "Select source text in the editor first.";
  const validSourceSelection = currentSourceSelection && !currentSelectionError
    ? { start: currentSourceSelection.start, end: currentSourceSelection.end }
    : null;
  const selectedCharacterCount = validSourceSelection
    ? validSourceSelection.end - validSourceSelection.start
    : 0;
  const canonicalDataArtifact = artifacts.find((artifact) => artifact.kind === "data");
  const selectedQueryDataResolution = useMemo(
    () => selectedArtifact?.kind === "query"
      ? resolveQueryDataArtifact(selectedArtifact, artifacts)
      : null,
    [artifacts, selectedArtifact],
  );
  const selectedQueryDataArtifact = selectedQueryDataResolution?.artifact;
  const selectedChartBindingErrors = useMemo(
    () => selectedArtifact?.kind === "chart"
      ? validateChartSourceBinding(selectedArtifact, artifacts, parseDataSource)
      : [],
    [artifacts, selectedArtifact],
  );
  const selectedChartSourceArtifact = useMemo(() => {
    if (selectedArtifact?.kind !== "chart") return undefined;
    const sourceId = parseChartSource(selectedArtifact.source).spec?.source;
    return sourceId ? artifacts.find((artifact) => artifact.id === sourceId) : undefined;
  }, [artifacts, selectedArtifact]);
  const bindingState = useMemo(
    () => selectedArtifact ? compileArtifactSource(selectedArtifact.source, artifacts) : null,
    [artifacts, selectedArtifact],
  );
  const dependencyGraph = useMemo(
    () => buildWorkspaceDependencyGraph(artifacts),
    [artifacts],
  );
  const workspaceAgentContext = useMemo(
    () => selectWorkspaceAgentContext(
      artifacts,
      dependencyGraph,
      selectedArtifact?.id ?? artifacts[0]?.id ?? "",
      { pinnedArtifactIds: workspacePinnedArtifactIds },
    ),
    [artifacts, dependencyGraph, selectedArtifact?.id, workspacePinnedArtifactIds],
  );
  const workspaceAgentQueryCount = workspaceAgentContext
    .filter((artifact) => artifact.kind === "query").length;
  const validationErrors = useMemo(
    () => selectedArtifact
      ? [...new Set([
          ...validateArtifact(selectedArtifact),
          ...(bindingState?.metricBindingErrors ?? []),
          ...(bindingState?.unresolved.map((key) => `Unresolved metric: ${key}`) ?? []),
          ...(bindingState?.unresolvedQueryMetrics ?? []),
          ...(bindingState?.unresolvedCharts.map((key) => `Unresolved chart: ${key}`) ?? []),
          ...selectedChartBindingErrors,
          ...(selectedQueryDataResolution?.errors ?? []),
        ])]
      : ["No artifact selected."],
    [bindingState?.metricBindingErrors, bindingState?.unresolved, bindingState?.unresolvedCharts, bindingState?.unresolvedQueryMetrics, selectedArtifact, selectedChartBindingErrors, selectedQueryDataResolution?.errors],
  );
  const lineNumbers = useMemo(
    () => Array.from({ length: selectedArtifact?.source.split("\n").length ?? 1 }, (_, index) => index + 1).join("\n"),
    [selectedArtifact?.source],
  );
  const pendingStats = useMemo(() => {
    if (!pendingChange) return [];
    const patches = pendingChange.patches.flatMap((patch) => {
      const artifact = artifacts.find((item) => item.id === patch.artifactId);
      return artifact ? [{
        artifact,
        patch,
        beforeSource: artifact.source,
        isCreation: false,
        ...getDiffStats(artifact.source, patch.nextSource),
      }] : [];
    });
    const creations = pendingChange.creations.map((creation) => ({
      artifact: creation.artifact,
      patch: {
        artifactId: creation.artifact.id,
        summary: creation.summary,
        detail: creation.detail,
        nextSource: creation.artifact.source,
        operationCount: creation.operationCount,
      },
      beforeSource: "",
      isCreation: true,
      ...getDiffStats("", creation.artifact.source),
    }));
    return [...patches, ...creations];
  }, [artifacts, pendingChange]);
  const pendingTotals = useMemo(() => pendingStats.reduce(
    (total, patch) => ({
      additions: total.additions + patch.additions,
      removals: total.removals + patch.removals,
    }),
    { additions: 0, removals: 0 },
  ), [pendingStats]);
  const pendingOperationCount = pendingChange
    ? [...pendingChange.patches, ...pendingChange.creations].reduce(
      (total, change) => total + (change.operationCount ?? 0),
      0,
    )
    : 0;
  const pendingTransactionReview = useMemo(
    () => pendingChange
      ? buildWorkspaceTransactionReview(artifacts, pendingChange.patches, pendingChange.creations)
      : null,
    [artifacts, pendingChange],
  );
  const selectedPendingStat = pendingStats.find((change) => change.artifact.id === pendingReviewId)
    ?? pendingStats.find((change) => change.artifact.id === selectedArtifact?.id)
    ?? pendingStats[0];
  const selectedDiffPreview = useMemo(() => selectedPendingStat
    ? createLineDiffPreview(selectedPendingStat.beforeSource, selectedPendingStat.patch.nextSource)
    : [], [selectedPendingStat]);
  const artifactCreationDisabled = !hydrated
    || agentState === "planning"
    || importState === "reading"
    || exportState !== "idle"
    || Boolean(pendingChange)
    || Boolean(pendingImport)
    || Boolean(pendingExport)
    || visualEditState !== "idle";

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        const detected = detectPreferredLocale(navigator.languages?.length ? navigator.languages : [navigator.language]);
        const storedLocale = normalizeRuneLocale(localStorage.getItem(RUNE_LOCALE_STORAGE_KEY));
        const storedModelMode = normalizeRuneModelMode(localStorage.getItem(RUNE_MODEL_MODE_STORAGE_KEY));
        setDetectedLocale(detected);
        setLocale(storedLocale ?? detected);
        setModelMode(storedModelMode ?? "auto");
        setWelcomeOpen(localStorage.getItem(RUNE_ONBOARDING_STORAGE_KEY) !== "complete");
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
          const parsed = JSON.parse(stored) as { artifacts?: unknown; selectedId?: unknown; checkpoints?: unknown };
          const restoredArtifacts = normalizeWorkspaceArtifacts(parsed.artifacts);
          const restoredId = typeof parsed.selectedId === "string"
            && restoredArtifacts.some((artifact) => artifact.id === parsed.selectedId)
            ? parsed.selectedId
            : restoredArtifacts[0].id;
          setArtifacts(restoredArtifacts);
          setSelectedId(restoredId);
          setCheckpoints(normalizeCheckpointMap(parsed.checkpoints));
          setNotice("Restored the latest device draft");
        }
      } catch {
        const detected = detectPreferredLocale(navigator.languages?.length ? navigator.languages : [navigator.language]);
        setDetectedLocale(detected);
        setLocale(detected);
        setWelcomeOpen(true);
        setNotice("Started a fresh local workspace");
      } finally {
        setHydrated(true);
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    const timer = window.setTimeout(() => {
      try {
        persistDeviceWorkspace(artifacts, selectedId, checkpoints);
        setSaveState("saved");
        setSavedAt(new Intl.DateTimeFormat("en", { hour: "2-digit", minute: "2-digit" }).format(new Date()));
      } catch {
        setSaveState("error");
        setNotice("Device storage is full — download the source before leaving");
      }
    }, 450);
    return () => window.clearTimeout(timer);
  }, [artifacts, checkpoints, hydrated, selectedId]);

  useEffect(() => {
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (visualEditState !== "idle") return;
      if (!(event.metaKey || event.ctrlKey)) return;
      if (event.key.toLowerCase() === "o") {
        event.preventDefault();
        importRef.current?.click();
        return;
      }
      if (event.key.toLowerCase() === "w") {
        event.preventDefault();
        setEmptyWorkspace(true);
        setHistoryOpen(false);
        setSourceSelection(null);
        setNotice("Closed the current file — every source remains in the workspace");
        return;
      }
      if (event.key.toLowerCase() !== "s") return;
      event.preventDefault();
      const artifact = artifacts.find((item) => item.id === selectedId) ?? artifacts[0];
      if (!artifact) return;
      if (!canCheckpointSource(artifact.source)) {
        setNotice("This source is too large for device checkpoint history");
        return;
      }
      const checkpoint = createCheckpoint(artifact, "Manual checkpoint", "manual");
      const next = appendCheckpoint(checkpoints, checkpoint);
      try {
        persistDeviceWorkspace(artifacts, selectedId, next);
        setCheckpoints(next);
        setSaveState("saved");
        setSavedAt("just now");
        setNotice(next === checkpoints ? "Current source is already checkpointed" : "Manual checkpoint saved on this device");
      } catch {
        setSaveState("error");
        setNotice("Device storage is full — checkpoint was not saved");
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [artifacts, checkpoints, selectedId, visualEditState]);

  if (!selectedArtifact) return null;

  function selectArtifact(id: string) {
    setSaveState("saving");
    setSelectedId(id);
    setEmptyWorkspace(false);
    setSourceSelection(null);
    if (agentScope === "selection") setAgentScope("artifact");
    setAgentError("");
    setNotice("Switched artifact context");
  }

  function closeCurrentArtifact() {
    setEmptyWorkspace(true);
    setHistoryOpen(false);
    setSourceSelection(null);
    if (agentScope === "selection") setAgentScope("artifact");
    setAgentError("");
    setNotice("Closed the current file — every source remains safely in the workspace");
  }

  function setInterfaceLocale(nextLocale: RuneLocale) {
    const currentDefaultGuide = createRuneGuideArtifact(locale);
    const nextGuide = createRuneGuideArtifact(nextLocale);
    setLocale(nextLocale);
    try {
      localStorage.setItem(RUNE_LOCALE_STORAGE_KEY, nextLocale);
    } catch {
      // The in-memory choice still applies when browser preference storage is unavailable.
    }
    setArtifacts((current) => current.map((artifact) => (
      artifact.id === RUNE_GUIDE_ID && artifact.source === currentDefaultGuide.source
        ? nextGuide
        : artifact
    )));
  }

  function ensureLocalGuide(nextLocale = locale) {
    const guide = createRuneGuideArtifact(nextLocale);
    setArtifacts((current) => current.some((artifact) => artifact.id === RUNE_GUIDE_ID)
      ? current
      : [guide, ...current]);
    return guide;
  }

  function setPreferredModelMode(nextMode: RuneModelMode) {
    setModelMode(nextMode);
    try {
      localStorage.setItem(RUNE_MODEL_MODE_STORAGE_KEY, nextMode);
    } catch {
      // This preference contains no credential; in-memory mode remains available.
    }
  }

  function finishWelcome(action: WelcomeAction) {
    const guide = ensureLocalGuide();
    try {
      localStorage.setItem(RUNE_ONBOARDING_STORAGE_KEY, "complete");
      localStorage.setItem(RUNE_LOCALE_STORAGE_KEY, locale);
      localStorage.setItem(RUNE_MODEL_MODE_STORAGE_KEY, modelMode);
    } catch {
      // Onboarding remains complete for this session even without preference storage.
    }
    setWelcomeOpen(false);
    setWelcomeDismissible(true);
    setWelcomeStartAt("welcome");
    if (action === "guide") {
      setSelectedId(guide.id);
      setEmptyWorkspace(false);
      setNotice("Opened the editable Rune guide stored in this workspace");
      return;
    }
    if (action === "import") {
      setEmptyWorkspace(true);
      setNotice("Choose one or more files — Rune reads them locally before review");
      window.setTimeout(() => importRef.current?.click(), 0);
      return;
    }
    setSelectedId(artifacts.find((artifact) => artifact.id !== RUNE_GUIDE_ID)?.id ?? guide.id);
    setEmptyWorkspace(false);
    setNotice("Sample workspace ready · every result stays linked to readable source");
  }

  function openWelcomeGuide() {
    setWelcomeStartAt("welcome");
    setWelcomeDismissible(true);
    setWelcomeOpen(true);
  }

  function toggleWorkspaceContextPin(artifactId: string) {
    const artifact = artifacts.find((item) => item.id === artifactId);
    if (!artifact) return;
    if (workspacePinnedArtifactIds.includes(artifactId)) {
      setWorkspacePinnedArtifactIds((current) => current.filter((id) => id !== artifactId));
      setNotice(`${artifact.name} removed from temporary Agent context pins`);
      return;
    }
    if (workspacePinnedArtifactIds.length >= MAX_WORKSPACE_AGENT_PINS) {
      setNotice(`Workspace Agent supports up to ${MAX_WORKSPACE_AGENT_PINS} temporary context pins`);
      return;
    }
    setWorkspacePinnedArtifactIds((current) => [...current, artifactId]);
    setAgentError("");
    setNotice(`${artifact.name} pinned for the next Workspace Agent plan`);
  }

  function clearWorkspaceContextPins() {
    if (!workspacePinnedArtifactIds.length) return;
    setWorkspacePinnedArtifactIds([]);
    setNotice("Temporary Workspace Agent context pins cleared");
  }

  function updateSource(source: string) {
    setSaveState("saving");
    setArtifacts((current) => current.map((artifact) => (
      artifact.id === selectedArtifact.id ? { ...artifact, source } : artifact
    )));
    setSourceSelection(null);
    if (agentScope === "selection") setAgentScope("artifact");
    if (pendingChange) setPendingChange(null);
  }

  async function commitVisualSourceEdit({
    targetArtifact,
    targetLabel,
    targetNoun,
    detail,
    verificationNotice,
    compile,
  }: {
    targetArtifact: WorkspaceArtifact;
    targetLabel: string;
    targetNoun: string;
    detail: string;
    verificationNotice: string;
    compile: (artifact: WorkspaceArtifact) => {
      nextSource: string;
      nextTarget: PreviewSourceTarget | null;
      errors: string[];
    };
  }): Promise<string | null> {
    if (visualEditInFlightRef.current) return "Another visual edit is still being verified.";
    if (pendingChange || pendingImport || pendingExport || agentState === "planning") {
      return `Finish or cancel the current review before editing a preview ${targetNoun}.`;
    }
    const baseArtifacts = artifactsRef.current;
    const currentArtifact = baseArtifacts.find((artifact) => artifact.id === targetArtifact.id);
    if (!currentArtifact || currentArtifact.source !== targetArtifact.source) {
      return `The ${targetNoun} no longer matches the current workspace revision.`;
    }
    if (!canCheckpointSource(currentArtifact.source)) {
      return `${currentArtifact.name} is too large for a safe pre-edit checkpoint.`;
    }
    const compiled = compile(currentArtifact);
    if (compiled.errors.length || !compiled.nextTarget) {
      return compiled.errors[0] ?? "Rune could not compile this visual edit.";
    }
    const patch: ArtifactSourcePatch = {
      artifactId: currentArtifact.id,
      summary: `Edit ${targetLabel}`,
      detail,
      nextSource: compiled.nextSource,
      operationCount: 1,
    };
    const prepared = prepareWorkspaceMutation(baseArtifacts, [patch], []);
    if (prepared.errors.length) return prepared.errors.slice(0, 3).join(" ");
    const baseRevision = captureWorkspaceSourceRevision(baseArtifacts);

    visualEditInFlightRef.current = true;
    setVisualEditState("checking");
    setSaveState("saving");
    setAgentError("");
    setNotice(verificationNotice);
    try {
      let runtimePreflight: RuntimeImpactPreflight | undefined;
      try {
        runtimePreflight = await preflightRuntimeMutation(baseArtifacts, [patch], []);
      } catch (error) {
        const message = error instanceof Error ? error.message : "The downstream runtime could not verify this value.";
        setSaveState("saved");
        setNotice("Visual edit rejected — every source stayed unchanged");
        return `Runtime verification failed · ${message}`;
      }
      if (!workspaceMatchesSourceRevision(artifactsRef.current, baseRevision)) {
        setSaveState("saved");
        setNotice("Visual edit held — the workspace changed during verification");
        return `The workspace changed while Rune was verifying this ${targetNoun}. Try again from the current source.`;
      }

      const checkpoint = createCheckpoint(
        currentArtifact,
        `Before visual edit · ${targetLabel}`,
        "manual",
      );
      const nextCheckpoints = appendCheckpoint(checkpointsRef.current, checkpoint);
      try {
        persistDeviceWorkspace(prepared.nextArtifacts, currentArtifact.id, nextCheckpoints);
      } catch {
        setSaveState("error");
        setNotice("Visual edit rejected — device persistence failed");
        return "Device storage is full, so Rune kept every source unchanged.";
      }

      const selection: ActiveSourceSelection = {
        artifactId: currentArtifact.id,
        sourceRevision: compiled.nextSource,
        start: compiled.nextTarget.start,
        end: compiled.nextTarget.end,
      };
      setArtifacts(prepared.nextArtifacts);
      setSelectedId(currentArtifact.id);
      setSourceSelection(selection);
      setAgentScope("selection");
      setCheckpoints(nextCheckpoints);
      setPendingChange(null);
      setSaveState("saved");
      setSavedAt("just now");
      const runtimeSuffix = runtimePreflight
        ? ` · ${runtimePreflight.queryCount} impacted ${runtimePreflight.queryCount === 1 ? "Query" : "Queries"} verified`
        : " · workspace bindings verified";
      setNotice(`${targetLabel} updated in canonical source${runtimeSuffix}${directoryHandle ? " · Push when ready" : ""}`);
      window.requestAnimationFrame(() => window.requestAnimationFrame(() => {
        sourceEditorRef.current?.focus({ preventScroll: true });
        sourceEditorRef.current?.setSelectionRange(selection.start, selection.end, "forward");
      }));
      return null;
    } catch (error) {
      setSaveState("saved");
      setNotice("Visual edit rejected — every source stayed unchanged");
      return error instanceof Error ? error.message : "Rune could not finish this visual edit.";
    } finally {
      visualEditInFlightRef.current = false;
      setVisualEditState("idle");
    }
  }

  const commitVisualDataCellEdit: DataCellEditHandler = async (
    targetArtifact,
    target,
    input,
  ) => commitVisualSourceEdit({
    targetArtifact,
    targetLabel: target.label,
    targetNoun: "cell",
    detail: "Replace one proven scalar literal through the visual Data editor.",
    verificationNotice: `Verifying ${target.label} against every live Data consumer…`,
    compile: (currentArtifact) => prepareVisualDataCellEdit(currentArtifact, target, input),
  });

  const commitVisualDocumentSectionEdit: DocumentSectionEditHandler = async (
    targetArtifact,
    target,
    input,
  ) => commitVisualSourceEdit({
    targetArtifact,
    targetLabel: target.label,
    targetNoun: "section",
    detail: "Replace one revision-bound Markdown section through the visual Document editor.",
    verificationNotice: `Verifying ${target.label} against the complete workspace…`,
    compile: (currentArtifact) => prepareVisualDocumentSectionEdit(currentArtifact, target, input),
  });

  const commitVisualDeckSlideEdit: DeckSlideEditHandler = async (
    targetArtifact,
    target,
    input,
  ) => commitVisualSourceEdit({
    targetArtifact,
    targetLabel: target.label,
    targetNoun: "slide",
    detail: "Replace one revision-bound Deck slide through the controlled visual editor.",
    verificationNotice: `Verifying ${target.label} against the complete workspace…`,
    compile: (currentArtifact) => prepareVisualDeckSlideEdit(currentArtifact, target, input),
  });

  const commitVisualChartSpecEdit: ChartSpecEditHandler = async (
    targetArtifact,
    target,
    input,
  ) => commitVisualSourceEdit({
    targetArtifact,
    targetLabel: target.label,
    targetNoun: "Chart spec",
    detail: "Rewrite one complete strict Chart JSON spec through typed visual controls.",
    verificationNotice: `Running ${target.label} against its current source and every live consumer…`,
    compile: (currentArtifact) => prepareVisualChartSpecEdit(currentArtifact, target, input),
  });

  function captureSourceSelection(event: SyntheticEvent<HTMLTextAreaElement>) {
    const start = event.currentTarget.selectionStart;
    const end = event.currentTarget.selectionEnd;
    const previewTarget = previewSelectionNoticeRef.current;
    previewSelectionNoticeRef.current = null;
    if (start >= end) {
      setSourceSelection(null);
      if (agentScope === "selection") {
        setAgentScope("artifact");
        setNotice("Selection cleared · Current-file Agent scope enabled");
      }
      return;
    }
    const nextSelection: ActiveSourceSelection = {
      artifactId: selectedArtifact.id,
      sourceRevision: selectedArtifact.source,
      start,
      end,
    };
    setSourceSelection(nextSelection);
    setAgentError("");
    if (end - start > MAX_AGENT_SELECTION_CHARS) {
      if (agentScope === "selection") setAgentScope("artifact");
      setNotice(`Selection Agent is limited to ${formatInteger(MAX_AGENT_SELECTION_CHARS)} characters`);
      return;
    }
    if (agentState !== "planning") setAgentScope("selection");
    const previewLabel = previewTarget?.start === start && previewTarget.end === end
      ? previewTarget.label
      : "";
    setNotice(previewLabel
      ? `${previewLabel} selected from preview · Selection Agent ready`
      : `${formatInteger(end - start)} source characters selected · Selection Agent ready`);
  }

  function focusPreviewTarget(
    targetArtifact: WorkspaceArtifact,
    target: PreviewSourceTarget,
    viaLabel?: string,
  ) {
    previewSelectionNoticeRef.current = null;
    const currentTargetArtifact = artifacts.find((artifact) => artifact.id === targetArtifact.id);
    if (!currentTargetArtifact) {
      setSourceSelection(null);
      if (agentScope === "selection") setAgentScope("artifact");
      setAgentError("The preview target artifact is no longer in this workspace.");
      setNotice("Preview target is too large or no longer matches the current source");
      return;
    }
    const error = sourceSelectionError(currentTargetArtifact.source, target);
    if (error) {
      setSourceSelection(null);
      if (agentScope === "selection") setAgentScope("artifact");
      setAgentError(error);
      setNotice("Preview target is too large or no longer matches the current source");
      return;
    }
    const contextLabel = viaLabel ? `${target.label} · via ${viaLabel}` : target.label;
    const changesArtifact = currentTargetArtifact.id !== selectedArtifact.id;
    const selection: ActiveSourceSelection = {
      artifactId: currentTargetArtifact.id,
      sourceRevision: currentTargetArtifact.source,
      start: target.start,
      end: target.end,
    };
    if (changesArtifact) setSelectedId(currentTargetArtifact.id);
    setSourceSelection(selection);
    setAgentScope("selection");
    setPendingChange(null);
    setHistoryOpen(false);
    setAgentError("");
    setNotice(`${contextLabel} selected from preview · Selection Agent ready`);
    previewSelectionNoticeRef.current = { ...target, label: contextLabel };
    const focusSelection = () => {
      const editor = sourceEditorRef.current;
      if (!editor) return;
      editor.focus();
      editor.setSelectionRange(target.start, target.end, "forward");
    };
    window.requestAnimationFrame(() => {
      if (changesArtifact) window.requestAnimationFrame(focusSelection);
      else focusSelection();
    });
  }

  function saveManualCheckpoint() {
    if (!canCheckpointSource(selectedArtifact.source)) {
      setNotice("This source is too large for device checkpoint history");
      return;
    }
    const checkpoint = createCheckpoint(selectedArtifact, "Manual checkpoint", "manual");
    const next = appendCheckpoint(checkpoints, checkpoint);
    try {
      persistDeviceWorkspace(artifacts, selectedId, next);
      setCheckpoints(next);
      setSaveState("saved");
      setSavedAt("just now");
      setNotice(next === checkpoints ? "Current source is already checkpointed" : "Manual checkpoint saved on this device");
    } catch {
      setSaveState("error");
      setNotice("Device storage is full — checkpoint was not saved");
    }
  }

  function checkpointWorkspaceBeforeFolderPull() {
    const oversized = artifacts.find((artifact) => !canCheckpointSource(artifact.source));
    if (oversized) throw new Error(`${oversized.name} is too large for a safe pre-pull checkpoint.`);
    let next = checkpoints;
    const timestamp = Date.now();
    artifacts.forEach((artifact, index) => {
      next = appendCheckpoint(next, createCheckpoint(
        artifact,
        "Before folder pull",
        "manual",
        new Date(timestamp + index),
      ));
    });
    return next;
  }

  function applyDirectoryWorkspace(handle: DirectoryWorkspaceHandle, result: DirectoryReadResult) {
    if (result.errors.length) throw new Error(result.errors[0]);
    if (!result.artifacts.length) throw new Error("The selected folder does not contain a Rune workspace yet.");
    if (!window.confirm(`Replace this device draft with ${result.artifacts.length} validated source files from “${handle.name}”? A checkpoint of every current file will be kept.`)) {
      setNotice("Folder pull cancelled — the device draft is unchanged");
      return false;
    }
    const nextCheckpoints = checkpointWorkspaceBeforeFolderPull();
    const nextSelectedId = result.artifacts.some((artifact) => artifact.id === selectedId)
      ? selectedId
      : result.artifacts[0].id;
    persistDeviceWorkspace(result.artifacts, nextSelectedId, nextCheckpoints);
    setArtifacts(result.artifacts);
    setSelectedId(nextSelectedId);
    setWorkspacePinnedArtifactIds([]);
    setSourceSelection(null);
    if (agentScope === "selection") setAgentScope("artifact");
    setCheckpoints(nextCheckpoints);
    setPendingChange(null);
    setHistoryOpen(false);
    setSaveState("saved");
    setSavedAt("just now");
    setDirectoryHandle(handle);
    setDirectoryState("connected");
    setNotice(`Pulled ${result.artifacts.length} source files from ${handle.name} · ${result.source}`);
    return true;
  }

  async function connectWorkspaceFolder() {
    if (directoryState === "syncing") return;
    if (!supportsDirectoryWorkspace()) {
      setDirectoryState("error");
      setNotice("Folder workspaces require a browser with the File System Access API");
      return;
    }
    setDirectoryState("syncing");
    setAgentError("");
    try {
      const handle = await chooseWorkspaceDirectory();
      const result = await readWorkspaceDirectory(handle);
      if (result.errors.length) throw new Error(result.errors[0]);
      if (result.source === "empty") {
        if (!window.confirm(`“${handle.name}” has no supported source files. Write the current Rune workspace there? Existing unrelated files will stay untouched.`)) {
          setDirectoryState(directoryHandle ? "connected" : "disconnected");
          setNotice("Folder connection cancelled");
          return;
        }
        await writeWorkspaceDirectory(handle, artifacts);
        setDirectoryHandle(handle);
        setDirectoryState("connected");
        setNotice(`Connected ${handle.name} · wrote ${artifacts.length} readable source files`);
        return;
      }
      if (!applyDirectoryWorkspace(handle, result)) setDirectoryState(directoryHandle ? "connected" : "disconnected");
    } catch (error) {
      if (typeof DOMException !== "undefined" && error instanceof DOMException && error.name === "AbortError") {
        setDirectoryState(directoryHandle ? "connected" : "disconnected");
        setNotice("Folder picker cancelled");
        return;
      }
      setDirectoryState("error");
      setNotice(error instanceof Error ? error.message : "Rune could not connect that folder");
    }
  }

  async function pullWorkspaceFolder() {
    if (!directoryHandle || directoryState === "syncing") return;
    setDirectoryState("syncing");
    try {
      const result = await readWorkspaceDirectory(directoryHandle);
      if (!applyDirectoryWorkspace(directoryHandle, result)) setDirectoryState("connected");
    } catch (error) {
      setDirectoryState("error");
      setNotice(error instanceof Error ? error.message : "Rune could not pull that folder");
    }
  }

  async function pushWorkspaceFolder() {
    if (!directoryHandle || directoryState === "syncing") return;
    if (!window.confirm(`Write ${artifacts.length} current source files to “${directoryHandle.name}”? Files with the same names will be overwritten; unrelated files will stay untouched.`)) {
      setNotice("Folder push cancelled");
      return;
    }
    setDirectoryState("syncing");
    try {
      const written = await writeWorkspaceDirectory(directoryHandle, artifacts);
      setDirectoryState("connected");
      setNotice(`Pushed ${written.length - 1} source files and rune.workspace.json to ${directoryHandle.name}`);
    } catch (error) {
      setDirectoryState("error");
      setNotice(error instanceof Error ? error.message : "Rune could not push that folder");
    }
  }

  function restoreCheckpoint(checkpoint: WorkspaceCheckpoint) {
    if (checkpoint.artifactId !== selectedArtifact.id || checkpoint.source === selectedArtifact.source) {
      setNotice("That checkpoint already matches the current source");
      return;
    }
    if (!canCheckpointSource(selectedArtifact.source)) {
      setNotice("Download this large source before restoring an older checkpoint");
      return;
    }
    const safetyCheckpoint = createCheckpoint(
      selectedArtifact,
      `Before restoring ${checkpoint.label}`,
      "restore",
    );
    setCheckpoints((current) => appendCheckpoint(current, safetyCheckpoint));
    updateSource(checkpoint.source);
    setNotice(`Restored checkpoint · ${checkpoint.label}`);
  }

  async function runAgent(nextPrompt = prompt) {
    const instruction = nextPrompt.trim();
    if (!instruction || agentState === "planning" || visualEditState !== "idle") return;
    const scope = agentScope;
    const targetSelection = scope === "selection" ? validSourceSelection : null;
    if (scope === "selection" && !targetSelection) {
      setAgentError(currentSelectionError);
      setNotice("Selection Agent needs a current non-empty source selection");
      return;
    }
    const targetArtifact = selectedArtifact;
    const targetArtifacts = artifacts;
    const targetWorkspaceContext = scope === "workspace" ? workspaceAgentContext : [];
    const targetWorkspaceContextIds = new Set(targetWorkspaceContext.map((artifact) => artifact.id));
    const targetWorkspacePinnedArtifactIds = scope === "workspace"
      ? workspacePinnedArtifactIds.filter((artifactId) => targetWorkspaceContextIds.has(artifactId))
      : [];
    const targetWorkspaceGraph = scope === "workspace"
      ? buildWorkspaceDependencyGraph(targetWorkspaceContext)
      : null;
    const targetWorkspaceDependencies = scope === "workspace"
      ? (targetWorkspaceGraph?.edges ?? []).map((edge) => ({
          fromArtifactId: edge.fromArtifactId,
          toArtifactId: edge.toArtifactId,
          kind: edge.kind,
          references: edge.references,
        }))
      : [];
    const targetWorkspaceContextClosed = scope !== "workspace"
      || workspaceAgentContextIsClosed(dependencyGraph, targetWorkspaceContext);
    const targetWorkspaceContextResolved = scope !== "workspace"
      || targetWorkspaceGraph?.issues.length === 0;
    const targetWorkspacePinsIncluded = scope !== "workspace"
      || targetWorkspacePinnedArtifactIds.length === workspacePinnedArtifactIds.length;
    const targetRevision = captureWorkspaceSourceRevision(targetArtifacts);
    setAgentState("planning");
    setAgentError("");
    setPendingChange(null);
    setNotice(scope === "workspace"
      ? `Agent is coordinating ${targetWorkspaceContext.length} context sources${targetWorkspacePinnedArtifactIds.length ? ` · ${targetWorkspacePinnedArtifactIds.length} pinned` : ""}`
      : scope === "selection"
        ? "Agent is planning a patch confined to the selected source"
        : "Agent is planning a reviewable file patch");

    const metricEntries = Object.entries(bindingState?.metrics ?? {});
    const metricSourceId = metricEntries[0]?.[1].sourceArtifactId;
    const contextContainsMetricSource = scope !== "workspace"
      || !metricSourceId
      || targetWorkspaceContext.some((artifact) => artifact.id === metricSourceId);
    const metrics = Object.fromEntries(
      contextContainsMetricSource
        ? metricEntries.map(([key, metric]) => [key, metric.formatted])
        : [],
    );
    const remoteEligible = scope !== "workspace"
      ? targetArtifact.source.length <= MAX_WORKSPACE_AGENT_ARTIFACT_CHARS
      : workspaceAgentContextFitsSourceLimits(targetWorkspaceContext)
        && targetWorkspaceContextClosed
        && targetWorkspaceContextResolved
        && targetWorkspacePinsIncluded;
    let fallbackNotice = remoteEligible
      ? "Local patch ready · model provider unavailable"
      : scope === "workspace"
        ? targetWorkspaceContext.length < 2
          ? "Local patch ready · graph context needs at least two sources for the model"
          : !targetWorkspaceContextClosed
            ? "Local patch ready · graph context could not include every upstream source"
            : !targetWorkspacePinsIncluded
              ? "Local patch ready · a temporary pin could not fit in model context"
              : !targetWorkspaceContextResolved
                ? "Local patch ready · graph context contains an unresolved dependency"
                : "Local patch ready · graph context exceeds the model safety limit"
        : "Local patch ready · file exceeds the model context safety limit";

    async function preflightRuntimeImpact(
      patches: ArtifactSourcePatch[],
      creations: ArtifactCreationChange[],
    ) {
      try {
        return await preflightRuntimeMutation(targetArtifacts, patches, creations);
      } catch (error) {
        const message = error instanceof Error ? error.message : "The proposed runtime impact could not be verified.";
        throw new Error(`Runtime impact preflight failed · ${message}`);
      }
    }

    if (remoteEligible && modelMode === "auto") {
      try {
        const remoteRequest = {
          scope,
          artifact: targetArtifact,
          selection: scope === "selection" ? targetSelection : undefined,
          workspaceArtifacts: scope === "workspace" ? targetWorkspaceContext : undefined,
          workspaceDependencies: scope === "workspace" ? targetWorkspaceDependencies : undefined,
          workspacePinnedArtifactIds: scope === "workspace" ? targetWorkspacePinnedArtifactIds : undefined,
          prompt: instruction,
          metrics,
        };
        type RemoteRequestBody = typeof remoteRequest & {
          queryEvidence?: unknown;
          runtimeRepair?: AgentRuntimeRepair;
        };
        const sendRemoteRequest = (body: RemoteRequestBody) => fetch("/api/agent", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(body),
        });
        const normalizeRemotePlan = (candidate: unknown): RemoteWorkspacePlan | null => {
          if (scope === "workspace" && isRemoteWorkspacePlan(candidate)) return candidate;
          if (scope !== "workspace" && isRemoteSinglePlan(candidate)) {
            return {
              summary: candidate.summary,
              detail: candidate.detail,
              patches: [{ artifactId: targetArtifact.id, ...candidate }],
              creations: [],
            };
          }
          return null;
        };
        const stopRemoteRepair = (message: string) => {
          setPendingChange(null);
          setAgentError(message);
          setNotice("Nothing proposed — one automatic repair attempt stopped; every source stayed unchanged");
          setAgentState("idle");
        };
        let remoteBody: RemoteRequestBody = remoteRequest;
        let response = await sendRemoteRequest(remoteBody);
        let payload = await response.json().catch(() => ({})) as RemoteAgentResponse;
        let queryEvidenceCount = 0;

        if (scope === "workspace"
          && response.status === 428
          && payload.code === "QUERY_EVIDENCE_REQUIRED") {
          const expectedQueryIds = targetWorkspaceContext
            .filter((artifact) => artifact.kind === "query")
            .map((artifact) => artifact.id);
          if (!payload.queryArtifactIds
            || payload.queryArtifactIds.length !== expectedQueryIds.length
            || payload.queryArtifactIds.some((artifactId, index) => artifactId !== expectedQueryIds[index])) {
            throw new Error("The model provider requested stale Query evidence.");
          }
          setNotice(`Agent is inspecting ${expectedQueryIds.length} current Query ${expectedQueryIds.length === 1 ? "result" : "results"} locally`);
          const [{ collectWorkspaceAgentQueryEvidence }, { runWorkspaceQuerySnapshot }] = await Promise.all([
            import("../lib/agent-evidence"),
            import("../lib/duckdb-client"),
          ]);
          const queryEvidence = await collectWorkspaceAgentQueryEvidence(
            targetWorkspaceContext,
            runWorkspaceQuerySnapshot,
          );
          queryEvidenceCount = queryEvidence.length;
          remoteBody = { ...remoteRequest, queryEvidence };
          response = await sendRemoteRequest(remoteBody);
          payload = await response.json().catch(() => ({})) as RemoteAgentResponse;
        }

        let remotePlan = response.ok ? normalizeRemotePlan(payload.plan) : null;
        if (remotePlan) {
          let runtimePreflight: RuntimeImpactPreflight | undefined;
          let runtimeRepair: PendingChange["runtimeRepair"];
          try {
            runtimePreflight = await preflightRuntimeImpact(remotePlan.patches, remotePlan.creations);
          } catch (firstError) {
            let repairFeedback: AgentRuntimeRepair;
            try {
              repairFeedback = buildAgentRuntimeRepair(
                targetArtifacts,
                remotePlan.patches,
                remotePlan.creations,
                firstError,
              );
            } catch (feedbackError) {
              const message = feedbackError instanceof Error
                ? feedbackError.message
                : "Rune could not safely bound the compiler feedback.";
              stopRemoteRepair(`Automatic repair could not start · ${message}`);
              return;
            }
            setNotice("Agent is using the local compiler failure to prepare one replacement plan");
            let repairResponse: Response;
            let repairPayload: RemoteAgentResponse;
            try {
              repairResponse = await sendRemoteRequest({ ...remoteBody, runtimeRepair: repairFeedback });
              repairPayload = await repairResponse.json().catch(() => ({})) as RemoteAgentResponse;
            } catch {
              stopRemoteRepair("Automatic repair stopped after one attempt · the model provider could not be reached.");
              return;
            }
            const replacementPlan = repairResponse.ok
              && repairPayload.repairAttempt === 1
              ? normalizeRemotePlan(repairPayload.plan)
              : null;
            if (!replacementPlan) {
              const reason = repairPayload.error
                ?? (repairPayload.repairAttempt !== 1
                  ? "The replacement response did not match Rune's repair request."
                  : "The model did not return a valid replacement plan.");
              stopRemoteRepair(`Automatic repair stopped after one attempt · ${reason}`);
              return;
            }
            try {
              runtimePreflight = await preflightRuntimeImpact(
                replacementPlan.patches,
                replacementPlan.creations,
              );
            } catch (secondError) {
              const message = secondError instanceof Error
                ? secondError.message
                : "The replacement runtime impact could not be verified.";
              stopRemoteRepair(`Automatic repair stopped after one attempt · ${message}`);
              return;
            }
            remotePlan = replacementPlan;
            payload = repairPayload;
            runtimeRepair = { attempt: 1, failure: repairFeedback.failure };
          }
          setPendingChange({
            prompt: instruction,
            provider: "openai",
            scope,
            selection: scope === "selection" ? targetSelection ?? undefined : undefined,
            baseRevision: targetRevision,
            ...remotePlan,
            runtimeRepair,
            runtimePreflight,
          });
          setAgentMode("openai");
          setPrompt("");
          const repairSuffix = runtimeRepair ? " · repaired once from local compiler feedback" : "";
          if (scope === "workspace") {
            const changeCount = remotePlan.patches.length + remotePlan.creations.length;
            setNotice(`Model prepared ${changeCount} coordinated file ${changeCount === 1 ? "change" : "changes"} from ${targetWorkspaceContext.length}-file context${queryEvidenceCount ? ` · inspected ${queryEvidenceCount} Query ${queryEvidenceCount === 1 ? "result" : "results"}` : ""}${targetWorkspacePinnedArtifactIds.length ? ` · ${targetWorkspacePinnedArtifactIds.length} pinned` : ""}${repairSuffix}${payload.model ? ` · ${payload.model}` : ""}`);
          } else {
            setNotice(`${scope === "selection" ? "Model prepared a selection-confined patch" : "Model prepared a file patch"}${repairSuffix}${payload.model ? ` · ${payload.model}` : ""}`);
          }
          setAgentState("idle");
          return;
        }
        fallbackNotice = payload.code === "MODEL_UNCONFIGURED"
          ? "Local patch ready · model provider not configured"
          : "Local patch ready · model provider unavailable";
      } catch {
        fallbackNotice = "Local patch ready · network fallback active";
      }
    }

    if (modelMode === "local") fallbackNotice = "Local patch ready · local-only mode selected";

    try {
      if (scope === "workspace") {
        const localPlan = planLocalWorkspaceAgentChange(targetArtifacts, instruction, targetWorkspaceContext);
        const runtimePreflight = await preflightRuntimeImpact(localPlan.patches, localPlan.creations);
        setPendingChange({
          prompt: instruction,
          provider: "local",
          scope,
          baseRevision: targetRevision,
          ...localPlan,
          runtimePreflight,
        });
        const changeCount = localPlan.patches.length + localPlan.creations.length;
        setNotice(`${fallbackNotice} · ${changeCount} ${changeCount === 1 ? "file" : "files"} prepared`);
      } else {
        const localPlan = scope === "selection" && targetSelection
          ? planLocalSelectionChange(targetArtifact, targetSelection, instruction)
          : planLocalChange(targetArtifact, instruction);
        const localPatch = { artifactId: targetArtifact.id, ...localPlan };
        if (scope === "selection") {
          const prepared = prepareWorkspaceMutation(targetArtifacts, [localPatch], []);
          if (prepared.errors.length) throw new Error(prepared.errors[0]);
        }
        const runtimePreflight = await preflightRuntimeImpact([localPatch], []);
        setPendingChange({
          prompt: instruction,
          provider: "local",
          scope,
          selection: scope === "selection" ? targetSelection ?? undefined : undefined,
          baseRevision: targetRevision,
          summary: localPlan.summary,
          detail: localPlan.detail,
          patches: [localPatch],
          creations: [],
          runtimePreflight,
        });
        setNotice(fallbackNotice);
      }
      setAgentMode("local");
      setPrompt("");
    } catch (error) {
      setPendingChange(null);
      const message = error instanceof Error ? error.message : "Rune could not plan that change.";
      setAgentError(message);
      setNotice(message.startsWith("Runtime impact preflight failed")
        ? "Nothing proposed — runtime impact preflight failed; every source stayed unchanged"
        : "Agent needs a more specific instruction");
    } finally {
      setAgentState("idle");
    }
  }

  function applyPendingChange() {
    if (!pendingChange) return;
    if (!workspaceMatchesSourceRevision(artifacts, pendingChange.baseRevision)) {
      setAgentError("The workspace changed while this Agent plan was being prepared. Discard it and plan again from the current source revision.");
      setNotice("Patch held for review — workspace source revision changed");
      return;
    }
    const targetArtifacts = pendingChange.patches.flatMap((patch) => {
      const artifact = artifacts.find((item) => item.id === patch.artifactId);
      return artifact ? [artifact] : [];
    });
    if (targetArtifacts.length !== pendingChange.patches.length) {
      setAgentError("The plan references a file that is no longer in this workspace.");
      setNotice("Patch held for review — workspace context changed");
      return;
    }
    if (pendingChange.scope === "selection") {
      const target = targetArtifacts[0];
      const patch = pendingChange.patches[0];
      if (!pendingChange.selection
        || !target
        || !patch
        || pendingChange.patches.length !== 1
        || pendingChange.creations.length !== 0
        || !sourceOutsideSelectionIsUnchanged(target.source, patch.nextSource, pendingChange.selection)) {
        setAgentError("The proposed patch is not confined to the exact source selection used for this plan.");
        setNotice("Nothing applied — selection boundary verification failed");
        return;
      }
    }
    const oversized = targetArtifacts.find((artifact) => !canCheckpointSource(artifact.source));
    if (oversized) {
      setAgentError(`${oversized.name} is too large for safe device history. Download it before applying this patch.`);
      setNotice("Patch held for review — every changed file needs a safety checkpoint");
      return;
    }

    const prepared = prepareWorkspaceMutation(
      artifacts,
      pendingChange.patches,
      pendingChange.creations,
    );
    if (prepared.errors.length) {
      setAgentError(prepared.errors.slice(0, 3).join(" "));
      setNotice("Nothing applied — the complete workspace did not pass validation");
      return;
    }

    let nextCheckpoints = checkpoints;
    const checkpointTimestamp = Date.now();
    pendingChange.patches.forEach((patch, index) => {
      const artifact = artifacts.find((item) => item.id === patch.artifactId);
      if (!artifact) return;
      const checkpoint = createCheckpoint(
        artifact,
        `${pendingChange.scope === "workspace"
          ? "Before workspace patch"
          : pendingChange.scope === "selection"
            ? "Before selection patch"
            : "Before agent patch"} · ${patch.summary}`,
        "agent",
        new Date(checkpointTimestamp + index),
      );
      nextCheckpoints = appendCheckpoint(nextCheckpoints, checkpoint);
    });

    const nextSelectedId = pendingChange.creations[0]?.artifact.id ?? selectedId;
    try {
      persistDeviceWorkspace(prepared.nextArtifacts, nextSelectedId, nextCheckpoints);
    } catch {
      setSaveState("error");
      setAgentError("Device storage is full, so Rune kept every source unchanged.");
      setNotice("Nothing applied — atomic persistence failed");
      return;
    }

    setArtifacts(prepared.nextArtifacts);
    setSelectedId(nextSelectedId);
    setSourceSelection(null);
    if (pendingChange.scope === "selection") setAgentScope("artifact");
    setCheckpoints(nextCheckpoints);
    setSaveState("saved");
    setSavedAt("just now");
    setPendingChange(null);
    setAgentError("");
    const changeCount = pendingChange.patches.length + pendingChange.creations.length;
    const creationNotice = pendingChange.creations.length
      ? ` · ${pendingChange.creations.length} new ${pendingChange.creations.length === 1 ? "file" : "files"}`
      : " · checkpoints are ready";
    setNotice(`${changeCount} ${changeCount === 1 ? "file change" : "file changes"} applied atomically${creationNotice}${directoryHandle ? " · Push when ready" : ""}`);
  }

  function undoLastAgentChange() {
    const previous = [...selectedCheckpoints].reverse().find((checkpoint) => checkpoint.source !== selectedArtifact.source);
    if (!previous) return;
    restoreCheckpoint(previous);
  }

  function resetWorkspace() {
    if (!window.confirm("Reset this device draft to the Rune sample workspace?")) return;
    const defaults = cloneDefaultArtifacts();
    setSaveState("saving");
    setArtifacts(defaults);
    setSelectedId(defaults[0].id);
    setEmptyWorkspace(false);
    setWorkspacePinnedArtifactIds([]);
    setSourceSelection(null);
    if (agentScope === "selection") setAgentScope("artifact");
    setCheckpoints({});
    setHistoryOpen(false);
    setNewArtifactOpen(false);
    setNewArtifactError("");
    setPendingChange(null);
    localStorage.removeItem(STORAGE_KEY);
    setNotice("Sample workspace restored");
  }

  function openNewArtifact() {
    setNewArtifactError("");
    setNewArtifactOpen(true);
  }

  async function createNewArtifact(input: ArtifactCreationInput, embedArtifactId?: string) {
    setNewArtifactError("");
    const prepared = prepareArtifactCreation(artifacts, input);
    if (!prepared.artifact || prepared.errors.length) {
      setNewArtifactError(prepared.errors[0] ?? "Rune could not create that artifact.");
      return;
    }
    let nextArtifacts = prepared.nextArtifacts;
    let nextCheckpoints = checkpoints;
    let embeddedTargetName = "";
    const creation: ArtifactCreationChange = {
      artifact: prepared.artifact,
      summary: `Create ${prepared.artifact.name}`,
      detail: "Create one exact source-bound canonical artifact.",
    };
    let embeddingPatches: ArtifactSourcePatch[] = [];
    if (input.kind === "chart" && embedArtifactId) {
      const embedding = prepareChartEmbedding(
        prepared.nextArtifacts,
        prepared.artifact.id,
        embedArtifactId,
      );
      if (!embedding.artifactId || embedding.nextSource == null || embedding.errors.length) {
        setNewArtifactError(embedding.errors[0] ?? "Rune could not prepare that Chart embedding.");
        return;
      }
      const target = artifacts.find((artifact) => artifact.id === embedding.artifactId);
      if (!target) {
        setNewArtifactError("The selected Chart destination is no longer available.");
        return;
      }
      embeddingPatches = [{
          artifactId: embedding.artifactId,
          summary: `Embed ${prepared.artifact.name}`,
          detail: "Append one live Chart binding to the selected canonical source.",
          nextSource: embedding.nextSource,
        }];
      const mutation = prepareWorkspaceMutation(artifacts, embeddingPatches, [creation]);
      if (mutation.errors.length) {
        setNewArtifactError(mutation.errors[0]);
        return;
      }
      nextArtifacts = mutation.nextArtifacts;
      embeddedTargetName = target.name;
      nextCheckpoints = appendCheckpoint(
        nextCheckpoints,
        createCheckpoint(target, `Before embedding ${prepared.artifact.name}`, "manual"),
      );
    }
    try {
      setNotice(`Verifying ${prepared.artifact.name} against its live sources…`);
      await preflightRuntimeMutation(artifacts, embeddingPatches, [creation]);
    } catch (runtimeError) {
      const message = runtimeError instanceof Error ? runtimeError.message : "The new source could not be verified.";
      setNewArtifactError(`Runtime verification failed · ${message}`);
      setNotice("Nothing created — live source verification failed");
      return;
    }
    const commit = commitPreparedArtifactCreation(
      { ...prepared, nextArtifacts },
      (committedArtifacts, nextSelectedId) => persistDeviceWorkspace(committedArtifacts, nextSelectedId, nextCheckpoints),
    );
    if (!commit.committed) {
      setSaveState("error");
      setNewArtifactError(commit.error);
      setNotice("Nothing created — atomic device persistence failed");
      return;
    }
    setArtifacts(nextArtifacts);
    setSelectedId(prepared.artifact.id);
    setEmptyWorkspace(false);
    setSourceSelection(null);
    if (agentScope === "selection") setAgentScope("artifact");
    setHistoryOpen(false);
    setPendingChange(null);
    setAgentError("");
    setCheckpoints(nextCheckpoints);
    setSaveState("saved");
    setSavedAt("just now");
    setNewArtifactOpen(false);
    setNewArtifactError("");
    setNotice(`Created ${prepared.artifact.name}${embeddedTargetName ? ` and embedded it in ${embeddedTargetName}` : ""} on this device${directoryHandle ? " · Push when ready" : ""}`);
  }

  async function importFile(event: ChangeEvent<HTMLInputElement>) {
    const files = [...(event.target.files ?? [])];
    event.target.value = "";
    await prepareFileImport(files);
  }

  async function prepareFileImport(files: File[]) {
    if (!files.length || importInFlightRef.current || exportInFlightRef.current || pendingImport || pendingExport || exportState !== "idle") return;
    if (files.length > 20) {
      setNotice("Import up to 20 files in one review transaction");
      return;
    }
    const oversized = files.find((file) => file.size > (
      OFFICE_IMPORT_PATTERN.test(file.name) ? MAX_OFFICE_IMPORT_BYTES : MAX_SOURCE_IMPORT_BYTES
    ));
    if (oversized) {
      setNotice(OFFICE_IMPORT_PATTERN.test(oversized.name)
        ? oversized.name + " exceeds the 12 MB Office import limit"
        : oversized.name + " exceeds the 2 MB source import limit");
      return;
    }
    const baseArtifacts = artifacts;
    const sourceName = files.length === 1 ? files[0].name : String(files.length) + " local files";
    importInFlightRef.current = true;
    setImportState("reading");
    setImportError("");
    setNotice(files.length === 1 ? "Reading " + files[0].name + " locally…" : "Reading " + String(files.length) + " files locally…");
    try {
      const incoming: WorkspaceArtifact[] = [];
      const warnings: string[] = [];
      for (const file of files) {
        if (OFFICE_IMPORT_PATTERN.test(file.name)) {
          const { convertOfficeFile } = await import("../lib/office-import");
          const result = convertOfficeFile(file.name, await file.arrayBuffer());
          incoming.push(...result.artifacts);
          warnings.push(...result.warnings.map((warning) => file.name + ": " + warning));
          continue;
        }
        const artifact = detectArtifact(file.name, await file.text());
        if (!artifact) {
          throw new Error(file.name + ": choose Markdown, CSV, JSON, SQL, Deck Markdown, HTML, DOCX, XLSX, or PPTX.");
        }
        incoming.push(artifact);
      }
      const prepared = prepareWorkspaceImportReview(baseArtifacts, incoming, sourceName, warnings);
      if (prepared.errors.length) throw new Error(prepared.errors[0]);
      if (!prepared.review) throw new Error("Rune could not prepare an import review.");
      setPendingImport(prepared.review);
      setNotice("Review " + String(prepared.review.importedArtifacts.length) + " generated "
        + (prepared.review.importedArtifacts.length === 1 ? "source" : "sources") + " before importing " + sourceName);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Rune could not import those files");
    } finally {
      importInFlightRef.current = false;
      setImportState("idle");
    }
  }

  function cancelPendingImport() {
    if (!pendingImport) return;
    const sourceName = pendingImport.sourceName;
    setPendingImport(null);
    setImportError("");
    setNotice(`Import cancelled — ${sourceName} did not change the workspace`);
  }

  function applyPendingImport() {
    if (!pendingImport) return;
    const contextErrors = validateWorkspaceImportReview(artifacts, pendingImport);
    if (contextErrors.length) {
      setImportError(contextErrors[0]);
      setNotice("Import held for review — workspace context changed");
      return;
    }
    const firstImported = pendingImport.importedArtifacts[0];
    try {
      persistDeviceWorkspace(pendingImport.nextArtifacts, firstImported.id, checkpoints);
    } catch {
      setSaveState("error");
      setImportError("Device storage is full, so Rune kept every source unchanged. Download or remove drafts, then try again.");
      setNotice("Nothing imported — atomic persistence failed");
      return;
    }
    const importedCount = pendingImport.importedArtifacts.length;
    const sourceName = pendingImport.sourceName;
    const warningCount = pendingImport.warnings.length;
    setArtifacts(pendingImport.nextArtifacts);
    setSelectedId(firstImported.id);
    setEmptyWorkspace(false);
    setSourceSelection(null);
    if (agentScope === "selection") setAgentScope("artifact");
    setSaveState("saved");
    setSavedAt("just now");
    setPendingImport(null);
    setImportError("");
    setNotice(`Imported ${importedCount} readable ${importedCount === 1 ? "source" : "sources"} from ${sourceName}${warningCount ? ` · ${warningCount} fidelity ${warningCount === 1 ? "note" : "notes"} reviewed` : ""}`);
  }

  async function prepareExport(destination: "office" | "html" | "pdf") {
    const targetType = destination === "office"
      ? selectedOfficeExportType
      : destination === "html"
        ? selectedHtmlExport ? "HTML" : null
        : selectedPdfExport ? "PDF" : null;
    if (!targetType || exportState !== "idle" || pendingExport || pendingImport || importInFlightRef.current || exportInFlightRef.current) return;
    const targetArtifact = selectedArtifact;
    const baseArtifacts = artifacts;
    exportInFlightRef.current = true;
    setExportState(destination);
    setExportError("");
    setNotice(`Preparing ${targetType} locally from ${targetArtifact.name}…`);
    try {
      let result: ArtifactExportResult;
      const referencedQueryIds = new Set([
        ...chartQuerySourceIdsForArtifact(targetArtifact, baseArtifacts),
        ...queryMetricSourceIdsForArtifact(targetArtifact.source),
      ]);
      const querySourceIds = baseArtifacts
        .filter((artifact) => artifact.kind === "query" && referencedQueryIds.has(artifact.id))
        .map((artifact) => artifact.id);
      let querySnapshots: WorkspaceQuerySnapshot[] = [];
      if (querySourceIds.length) {
        const { runWorkspaceQuerySnapshot } = await import("../lib/duckdb-client");
        querySnapshots = await Promise.all(querySourceIds.map((queryId) => {
          const queryArtifact = baseArtifacts.find((artifact) => artifact.id === queryId && artifact.kind === "query");
          if (!queryArtifact) throw new Error(`Query source not found: ${queryId}`);
          const dataResolution = resolveQueryDataArtifact(queryArtifact, baseArtifacts);
          if (!dataResolution.artifact) throw new Error(dataResolution.errors[0] ?? `Data source not found for ${queryArtifact.name}`);
          return runWorkspaceQuerySnapshot(queryArtifact, dataResolution.artifact);
        }));
        const truncated = querySnapshots.find((snapshot) => snapshot.result.truncated);
        if (truncated) throw new Error(`Narrow ${truncated.queryArtifactName} to 500 rows or fewer before exporting its consumers.`);
      }
      if (destination === "office") {
        const compiled = targetArtifact.kind === "document" || targetArtifact.kind === "slides"
          ? compileArtifactSource(targetArtifact.source, baseArtifacts, querySnapshots)
          : null;
        if (compiled?.metricBindingErrors.length) throw new Error(compiled.metricBindingErrors[0]);
        if (compiled?.unresolved.length) throw new Error(`Resolve ${compiled.unresolved.length} missing metric ${compiled.unresolved.length === 1 ? "reference" : "references"} before Office export.`);
        if (compiled?.unresolvedQueryMetrics.length) throw new Error(compiled.unresolvedQueryMetrics[0]);
        if (compiled?.pendingQueryMetrics.length) throw new Error(`Run ${compiled.pendingQueryMetrics[0]} before Office export.`);
        if (compiled?.queryMetricRuntimeErrors.length) throw new Error(compiled.queryMetricRuntimeErrors[0]);
        if (compiled?.unresolvedCharts.length) throw new Error(`Resolve ${compiled.unresolvedCharts.length} missing chart ${compiled.unresolvedCharts.length === 1 ? "reference" : "references"} before Office export.`);
        const exportArtifact = compiled ? { ...targetArtifact, source: compiled.source } : targetArtifact;
        const { exportOfficeArtifact } = await import("../lib/office-export");
        result = exportOfficeArtifact(exportArtifact, baseArtifacts, querySnapshots);
      } else if (destination === "html") {
        const { exportDeckHtml } = await import("../lib/html-export");
        result = exportDeckHtml(targetArtifact, baseArtifacts, querySnapshots);
      } else {
        const { exportPdfArtifact } = await import("../lib/pdf-export");
        result = await exportPdfArtifact(targetArtifact, baseArtifacts, querySnapshots);
      }
      setPendingExport({ sourceArtifactName: targetArtifact.name, baseArtifacts, result });
      setNotice(`Review ${result.targetType.toUpperCase()} fidelity notes before downloading ${result.fileName}`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Rune could not prepare that export");
    } finally {
      exportInFlightRef.current = false;
      setExportState("idle");
    }
  }

  function cancelExport() {
    if (!pendingExport) return;
    const fileName = pendingExport.result.fileName;
    setPendingExport(null);
    setExportError("");
    setNotice(`Export cancelled — ${fileName} was not downloaded`);
  }

  function confirmExport() {
    if (!pendingExport) return;
    if (artifacts !== pendingExport.baseArtifacts) {
      setExportError("The workspace changed while this file was being generated. Cancel and export it again to review fresh output.");
      setNotice("Export held for review — workspace context changed");
      return;
    }
    const { result } = pendingExport;
    const bytes = new Uint8Array(result.bytes).buffer;
    const url = URL.createObjectURL(new Blob([bytes], { type: result.mimeType }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = result.fileName;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
    setPendingExport(null);
    setExportError("");
    const exportLabel = result.targetType === "html"
      ? "standalone HTML"
      : result.targetType === "pdf"
        ? "fixed PDF"
        : `semantic ${result.targetType.toUpperCase()}`;
    setNotice(`Downloaded ${result.fileName} · ${exportLabel} export`);
  }

  function onPromptKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
      event.preventDefault();
      void runAgent();
    }
  }

  return (
    <main className="rune-shell">
      <header className="topbar">
        <div className="topbar-left">
          <button
            className="icon-button rail-toggle"
            onClick={() => setFileRailOpen((open) => !open)}
            aria-label={fileRailOpen ? "Hide workspace files" : "Show workspace files"}
            title={fileRailOpen ? "Hide files" : "Show files"}
          >
            {fileRailOpen ? <PanelLeftClose /> : <PanelLeftOpen />}
          </button>
          <div className="brand-mark" aria-hidden="true"><span>R</span></div>
          <div className="brand-copy"><strong>Rune</strong><span>Artifact workspace</span></div>
          <ChevronRight className="breadcrumb-chevron" aria-hidden="true" />
          <div className="project-name"><span className="project-dot" /> Q2 operating review</div>
        </div>
        <div className="topbar-actions">
          <div className={`save-indicator ${saveState}`} title={saveState === "error" ? "Device storage is full" : `Last saved ${savedAt}`}>
            {saveState === "saved" ? <Check /> : <CircleDot />}
            <span>{saveState === "saved" ? "Saved on device" : saveState === "error" ? "Storage full" : "Saving"}</span>
          </div>
          <button className="icon-button help-button" onClick={openWelcomeGuide} aria-label="Open Rune welcome and guide" title="Welcome & guide">
            <BookOpen />
          </button>
          <button
            className="button ghost-button"
            onClick={openNewArtifact}
            disabled={artifactCreationDisabled}
          >
            <FilePlus2 aria-hidden="true" /> New
          </button>
          <button className="button ghost-button" onClick={() => importRef.current?.click()} disabled={!hydrated || importState === "reading" || exportState !== "idle" || visualEditState !== "idle" || Boolean(pendingImport) || Boolean(pendingExport)}>
            {importState === "reading" ? <LoaderCircle className="agent-spinner" aria-hidden="true" /> : <Upload aria-hidden="true" />} Import
          </button>
          <button
            className={`button ghost-button folder-button ${directoryState}`}
            onClick={() => void connectWorkspaceFolder()}
            disabled={directoryState === "syncing"}
            title={directoryHandle ? `Connected to ${directoryHandle.name}` : "Connect a folder workspace"}
          >
            <FolderOpen aria-hidden="true" /> <span>{directoryHandle?.name ?? "Open folder"}</span>
          </button>
          {directoryHandle && (
            <>
              <button className="icon-button" onClick={() => void pullWorkspaceFolder()} disabled={directoryState === "syncing"} aria-label={`Pull source files from ${directoryHandle.name}`} title="Pull folder changes"><RefreshCw /></button>
              <button className="icon-button" onClick={() => void pushWorkspaceFolder()} disabled={directoryState === "syncing"} aria-label={`Push source files to ${directoryHandle.name}`} title="Push workspace files"><Save /></button>
            </>
          )}
          {!emptyWorkspace && selectedOfficeExportType && (
            <button
              className="icon-button"
              onClick={() => void prepareExport("office")}
              disabled={!hydrated || exportState !== "idle" || importState === "reading" || visualEditState !== "idle" || Boolean(pendingImport) || Boolean(pendingExport)}
              aria-label={`Export ${selectedArtifact.name} as ${selectedOfficeExportType}`}
              title={`Export as ${selectedOfficeExportType}`}
            >
              {exportState === "office" ? <LoaderCircle className="agent-spinner" /> : <FileOutput />}
            </button>
          )}
          {!emptyWorkspace && selectedHtmlExport && (
            <button
              className="icon-button"
              onClick={() => void prepareExport("html")}
              disabled={!hydrated || exportState !== "idle" || importState === "reading" || visualEditState !== "idle" || Boolean(pendingImport) || Boolean(pendingExport)}
              aria-label={`Export ${selectedArtifact.name} as HTML`}
              title="Export as standalone HTML"
            >
              {exportState === "html" ? <LoaderCircle className="agent-spinner" /> : <FileCode2 />}
            </button>
          )}
          {!emptyWorkspace && selectedPdfExport && (
            <button
              className="icon-button"
              onClick={() => void prepareExport("pdf")}
              disabled={!hydrated || exportState !== "idle" || importState === "reading" || visualEditState !== "idle" || Boolean(pendingImport) || Boolean(pendingExport)}
              aria-label={`Export ${selectedArtifact.name} as PDF`}
              title="Export as fixed PDF"
            >
              {exportState === "pdf" ? <LoaderCircle className="agent-spinner" /> : <FileText />}
            </button>
          )}
          {!emptyWorkspace && (
            <button className="icon-button" onClick={() => downloadArtifact(selectedArtifact)} aria-label={`Download ${selectedArtifact.name}`} title="Download source">
              <Download />
            </button>
          )}
          <input ref={importRef} className="visually-hidden" type="file" multiple accept=".docx,.xlsx,.pptx,.deck.md,.md,.markdown,.csv,.json,.sql,.html,.htm" onChange={importFile} disabled={!hydrated || importState === "reading" || exportState !== "idle" || visualEditState !== "idle" || Boolean(pendingImport) || Boolean(pendingExport)} />
        </div>
      </header>

      <div className={`workspace ${fileRailOpen ? "with-file-rail" : "without-file-rail"}`}>
        <aside className="activity-rail" aria-label="Rune sections">
          <div className="activity-group">
            <button
              className={`activity-button ${railView === "workspace" ? "active" : ""}`.trim()}
              onClick={() => { setRailView("workspace"); setFileRailOpen(true); }}
              aria-label="Workspace files"
              aria-pressed={railView === "workspace"}
              title="Workspace files"
            ><FolderOpen /></button>
            <button className="activity-button" onClick={openNewArtifact} disabled={artifactCreationDisabled} aria-label="New artifact" title="New artifact"><FilePlus2 /></button>
            <button
              className="activity-button"
              onClick={() => { promptRef.current?.focus(); setNotice("Agent composer focused"); }}
              aria-label="Focus Rune Agent"
              title="Focus Rune Agent"
            ><Sparkles /></button>
            <button
              className={`activity-button ${railView === "graph" ? "active" : ""}`.trim()}
              onClick={() => { setRailView("graph"); setFileRailOpen(true); }}
              aria-label="Data graph"
              aria-pressed={railView === "graph"}
              title="Data graph"
            ><Database /></button>
          </div>
          <div className="activity-group">
            <button className="activity-button" onClick={resetWorkspace} aria-label="Reset sample workspace" title="Reset sample"><RotateCcw /></button>
          </div>
        </aside>

        {fileRailOpen && (railView === "graph" ? (
          <DependencyGraphRail
            artifacts={artifacts}
            graph={dependencyGraph}
            contextArtifacts={workspaceAgentContext}
            pinnedArtifactIds={workspacePinnedArtifactIds}
            selectedArtifactId={selectedArtifact.id}
            onClearPins={clearWorkspaceContextPins}
            onSelect={selectArtifact}
          />
        ) : (
          <aside className="file-rail" aria-label="Workspace files">
            <div className="file-rail-header">
              <div><span className="overline">Workspace</span><strong>Q2 review</strong></div>
              <button className="tiny-icon-button" onClick={openNewArtifact} disabled={artifactCreationDisabled} aria-label="Create a new artifact" title="New artifact">+</button>
            </div>
            <div className="artifact-group-label"><span>Artifacts</span><span>{artifacts.length}{workspacePinnedArtifactIds.length ? ` · ${workspacePinnedArtifactIds.length} pinned` : ""}</span></div>
            <nav className="artifact-list">
              {artifacts.map((artifact) => {
                const metricReferenceCount = findMetricReferences(artifact.source).length;
                const queryMetricReferenceCount = findQueryMetricReferences(artifact.source).length;
                const chartReferenceCount = findChartReferences(artifact.source).length;
                const referenceCount = metricReferenceCount + queryMetricReferenceCount + chartReferenceCount;
                const pinned = workspacePinnedArtifactIds.includes(artifact.id);
                const inAgentContext = workspaceAgentContext.some((contextArtifact) => contextArtifact.id === artifact.id);
                return (
                  <div
                    className={`artifact-row-shell ${inAgentContext ? "in-agent-context" : ""}`.trim()}
                    data-agent-context={inAgentContext ? "true" : undefined}
                    key={artifact.id}
                  >
                    <button
                      className={`artifact-row ${artifact.id === selectedArtifact.id ? "active" : ""}`}
                      onClick={() => selectArtifact(artifact.id)}
                    >
                      <span className={`artifact-icon ${artifact.kind}`}><ArtifactIcon kind={artifact.kind} /></span>
                      <span className="artifact-label"><strong>{artifact.name}</strong><small>{artifact.language}{referenceCount ? ` · ${referenceCount} live bindings` : ""}</small></span>
                      {artifact.id === selectedArtifact.id && <span className="active-notch" />}
                    </button>
                    <button
                      type="button"
                      className={`artifact-context-pin ${pinned ? "active" : ""}`.trim()}
                      aria-label={`${pinned ? "Remove" : "Pin"} ${artifact.name} ${pinned ? "from" : "in"} Workspace Agent context`}
                      aria-pressed={pinned}
                      title={pinned ? "Remove temporary Agent context pin" : "Keep this file in the next Workspace Agent context"}
                      onClick={() => toggleWorkspaceContextPin(artifact.id)}
                    >
                      <Pin aria-hidden="true" />
                    </button>
                  </div>
                );
              })}
            </nav>
            <div className="file-rail-spacer" />
            {workspacePinnedArtifactIds.length > 0 && (
              <div className="context-pin-summary">
                <Pin aria-hidden="true" />
                <span><strong>{workspacePinnedArtifactIds.length} temporary {workspacePinnedArtifactIds.length === 1 ? "pin" : "pins"}</strong><small>Included with required upstream sources.</small></span>
                <button type="button" onClick={clearWorkspaceContextPins}>Clear</button>
              </div>
            )}
            <div className="workspace-note">
              <LayoutGrid aria-hidden="true" />
              <div><strong>One workspace</strong><span>Every artifact stays readable to people and agents.</span></div>
            </div>
            <div className="local-badge"><span className="pulse-dot" /> Local-first prototype</div>
          </aside>
        ))}

        {emptyWorkspace ? (
          <EmptyWorkspace
            locale={locale}
            onChooseFiles={() => importRef.current?.click()}
            onCreate={openNewArtifact}
            onDropFiles={(files) => void prepareFileImport(files)}
            onOpenSample={() => {
              const sampleId = artifacts.find((artifact) => artifact.id !== RUNE_GUIDE_ID)?.id ?? artifacts[0].id;
              selectArtifact(sampleId);
            }}
          />
        ) : (
          <>
        <section className="source-pane" aria-label="Source editor">
          <header className="pane-header">
            <div className="pane-title">
              <span className={`artifact-icon ${selectedArtifact.kind}`}><ArtifactIcon kind={selectedArtifact.kind} /></span>
              <div><span className="overline">Canonical source</span><strong>{selectedArtifact.name}</strong></div>
            </div>
            <div className="pane-actions">
              <span className="language-badge"><Code2 aria-hidden="true" /> {selectedArtifact.language}</span>
              <button
                className={`history-trigger ${historyOpen ? "active" : ""}`}
                onClick={() => setHistoryOpen((open) => !open)}
                aria-expanded={historyOpen}
                aria-label="Show saved checkpoints"
                title="Checkpoint history"
              ><History /><span>{selectedCheckpoints.length}</span></button>
              <button
                className="icon-button small"
                onClick={undoLastAgentChange}
                disabled={!selectedCheckpoints.some((checkpoint) => checkpoint.source !== selectedArtifact.source)}
                aria-label="Restore latest different checkpoint"
                title="Restore latest checkpoint"
              ><Undo2 /></button>
              <button
                className="icon-button small close-file-button"
                onClick={closeCurrentArtifact}
                aria-label="Close current file"
                title="Close file (⌘ W)"
              ><X /></button>
            </div>
          </header>

          {historyOpen && (
            <section className="checkpoint-panel" aria-label="Checkpoint history">
              <div className="checkpoint-panel-header">
                <div><span className="overline">Device history</span><strong>{selectedCheckpoints.length} checkpoint{selectedCheckpoints.length === 1 ? "" : "s"}</strong></div>
                <button className="button checkpoint-save" onClick={saveManualCheckpoint}><Check aria-hidden="true" /> Save current</button>
              </div>
              {selectedCheckpoints.length ? (
                <div className="checkpoint-list">
                  {[...selectedCheckpoints].reverse().map((checkpoint) => {
                    const current = checkpoint.source === selectedArtifact.source;
                    return (
                      <div className={`checkpoint-row ${current ? "current" : ""}`} key={checkpoint.id}>
                        <span className="checkpoint-node" aria-hidden="true" />
                        <div><strong>{checkpoint.label}</strong><small>{checkpointReasonLabel(checkpoint.reason)} · {checkpointTime(checkpoint.createdAt)}</small></div>
                        {current
                          ? <span className="checkpoint-current">Current</span>
                          : <button onClick={() => restoreCheckpoint(checkpoint)}>Restore</button>}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="checkpoint-empty">Apply an Agent patch or press ⌘S to capture the current source.</p>
              )}
            </section>
          )}

          <div className="editor-wrap">
            <pre ref={gutterRef} className="line-gutter" aria-hidden="true">{lineNumbers}</pre>
            <textarea
              ref={sourceEditorRef}
              className="source-editor"
              value={selectedArtifact.source}
              onChange={(event) => updateSource(event.target.value)}
              onSelect={captureSourceSelection}
              onScroll={(event) => { if (gutterRef.current) gutterRef.current.scrollTop = event.currentTarget.scrollTop; }}
              spellCheck={false}
              disabled={visualEditState !== "idle"}
              aria-busy={visualEditState !== "idle"}
              aria-label={`Edit ${selectedArtifact.name} source`}
            />
          </div>

          <div className="agent-dock">
            <div className="agent-title-row">
              <div className="agent-identity"><span className="agent-avatar"><Bot aria-hidden="true" /></span><div><strong>Rune Agent</strong><small>{agentScope === "workspace" ? `${workspaceAgentContext.length} context sources${workspacePinnedArtifactIds.length ? ` · ${workspacePinnedArtifactIds.length} pinned` : ""}` : agentScope === "selection" ? `${formatInteger(selectedCharacterCount)} characters bound to this revision` : "Plans a patch before writing"}</small></div></div>
              <div className="agent-controls">
                <div className="agent-scope-switch" role="group" aria-label="Agent change scope">
                  {(["selection", "artifact", "workspace"] as const).map((scope) => (
                    <button
                      key={scope}
                      className={agentScope === scope ? "active" : ""}
                      onClick={() => {
                        setAgentScope(scope);
                        setPendingChange(null);
                        setAgentError("");
                        setNotice(scope === "workspace"
                          ? `Workspace Agent scope enabled · ${workspaceAgentContext.length} context sources${workspacePinnedArtifactIds.length ? ` · ${workspacePinnedArtifactIds.length} pinned` : ""}`
                          : scope === "selection"
                            ? `${formatInteger(selectedCharacterCount)} selected characters bound to Agent scope`
                            : "Current-file Agent scope enabled");
                      }}
                      disabled={agentState === "planning" || visualEditState !== "idle" || (scope === "selection" && !validSourceSelection)}
                      aria-pressed={agentScope === scope}
                    >
                      {scope === "selection" ? "Selection" : scope === "artifact" ? "File" : "Workspace"}
                    </button>
                  ))}
                </div>
                <span className={`local-planner-badge ${agentMode}`}>{agentMode === "openai" ? "Model connected" : "Local fallback"}</span>
              </div>
            </div>

            <div className="quick-commands" aria-label="Suggested commands">
              {(agentScope === "selection"
                ? selectionQuickCommands[selectedArtifact.kind]
                : agentScope === "workspace"
                  ? workspaceQuickCommands
                  : quickCommands[selectedArtifact.kind]).map((command) => (
                <button key={command} onClick={() => void runAgent(command)} disabled={agentState === "planning" || visualEditState !== "idle"}>{command}</button>
              ))}
            </div>

            {agentScope === "workspace" && workspaceAgentQueryCount > 0 && (
              <p className="agent-evidence-hint">
                A configured model can inspect {workspaceAgentQueryCount} bounded local Query {workspaceAgentQueryCount === 1 ? "result" : "results"} after you ask; evidence is not persisted.
              </p>
            )}

            {pendingChange && (
              <div className="patch-card">
                <div className="patch-icon"><History aria-hidden="true" /></div>
                <div className="patch-copy">
                  <span className="overline">Proposed {pendingChange.scope === "workspace" ? "workspace change" : pendingChange.scope === "selection" ? "selection-confined patch" : "file patch"} · {pendingChange.provider === "openai" ? `${pendingOperationCount} typed source ${pendingOperationCount === 1 ? "operation" : "operations"}` : "Local deterministic plan"}{pendingChange.runtimeRepair ? " · repaired once" : ""}</span>
                  <strong>{pendingChange.summary}</strong>
                  <p>{pendingChange.detail}</p>
                  {pendingChange.runtimeRepair && (
                    <div className="runtime-repair" aria-label="Compiler-guided repair passed">
                      <RefreshCw aria-hidden="true" />
                      <span>
                        <strong>Recovered after one compiler-guided repair</strong>
                        <small>First proposal stayed unapplied · {pendingChange.runtimeRepair.failure}</small>
                      </span>
                    </div>
                  )}
                  {pendingChange.runtimePreflight && (
                    <div className="runtime-preflight" aria-label="Runtime impact preflight passed">
                      <CheckCircle2 aria-hidden="true" />
                      <span>
                        <strong>Runtime impact preflight passed</strong>
                        <small>{pendingChange.runtimePreflight.dataCount > 0 ? `${pendingChange.runtimePreflight.dataCount} proposed Data ${pendingChange.runtimePreflight.dataCount === 1 ? "source" : "sources"} · ` : ""}{pendingChange.runtimePreflight.queryCount > 0 ? `${pendingChange.runtimePreflight.queryCount} impacted ${pendingChange.runtimePreflight.queryCount === 1 ? "Query" : "Queries"} executed locally` : "no SQL execution required"} · {pendingChange.runtimePreflight.legacyMetricConsumerCount} legacy metric {pendingChange.runtimePreflight.legacyMetricConsumerCount === 1 ? "consumer" : "consumers"} · {pendingChange.runtimePreflight.scalarConsumerCount} SQL scalar {pendingChange.runtimePreflight.scalarConsumerCount === 1 ? "consumer" : "consumers"} · {pendingChange.runtimePreflight.chartConsumerCount} {pendingChange.runtimePreflight.chartConsumerCount === 1 ? "chart" : "charts"} · {[...pendingChange.runtimePreflight.dataNames, ...pendingChange.runtimePreflight.queryNames].join(", ")}</small>
                      </span>
                    </div>
                  )}
                  {pendingTransactionReview && !pendingTransactionReview.errors.length && (
                    <TransactionReviewMap
                      review={pendingTransactionReview}
                      activeArtifactId={selectedPendingStat?.artifact.id ?? ""}
                      onSelect={setPendingReviewId}
                    />
                  )}
                  <div className="diff-summary"><span>{pendingStats.length} {pendingStats.length === 1 ? "file" : "files"}</span><span className="additions">+{pendingTotals.additions}</span><span className="removals">−{pendingTotals.removals}</span><span>changed lines</span></div>
                  <div className="patch-file-list" aria-label="Files in proposed patch">
                    {pendingStats.map(({ artifact, patch, additions, removals, isCreation }) => (
                      <button
                        key={artifact.id}
                        className={`patch-file-row ${artifact.id === selectedPendingStat?.artifact.id ? "active" : ""}`}
                        onClick={() => setPendingReviewId(artifact.id)}
                        aria-label={`Review ${artifact.name}`}
                      >
                        <span className={`artifact-icon ${artifact.kind}`}><ArtifactIcon kind={artifact.kind} size={13} /></span>
                        <span className="patch-file-label"><strong>{artifact.name}{isCreation && <em className="new-file-badge">New file</em>}</strong><small>{patch.summary}{patch.operationCount ? ` · ${patch.operationCount} typed ${patch.operationCount === 1 ? "op" : "ops"}` : ""}</small></span>
                        <span className="patch-file-diff"><b>+{additions}</b><i>−{removals}</i></span>
                      </button>
                    ))}
                  </div>
                  {selectedPendingStat ? (
                    <div className="patch-source-diff" aria-label={`Source diff for ${selectedPendingStat.artifact.name}`}>
                      <div className="patch-source-diff-header"><span>{selectedPendingStat.isCreation ? "New source diff" : "Source diff"}</span><strong>{selectedPendingStat.artifact.name}</strong></div>
                      <pre>{selectedDiffPreview.map((line, index) => (
                        <code className={line.kind} key={`${line.kind}-${index}`}><span>{line.kind === "addition" ? "+" : line.kind === "removal" ? "−" : " "}</span>{line.text || " "}</code>
                      ))}</pre>
                    </div>
                  ) : (
                    <p className="patch-review-hint">Select a changed file to inspect its source diff.</p>
                  )}
                </div>
                <div className="patch-actions">
                  <button className="button primary-button" onClick={applyPendingChange}><Check aria-hidden="true" /> {pendingStats.length > 1 ? "Apply all" : "Apply"}</button>
                  <button className="icon-button small" onClick={() => setPendingChange(null)} aria-label="Discard proposed patch" title="Discard"><X /></button>
                </div>
              </div>
            )}

            {agentError && <div className="agent-error" role="alert">{agentError}</div>}

            <div className="agent-composer">
              <Sparkles className="composer-spark" aria-hidden="true" />
              <textarea
                ref={promptRef}
                value={prompt}
                onChange={(event) => setPrompt(event.target.value)}
                onKeyDown={onPromptKeyDown}
                placeholder={agentScope === "workspace" ? `Ask Rune to coordinate these ${workspaceAgentContext.length} context sources…` : agentScope === "selection" ? `Ask Rune to change only these ${formatInteger(selectedCharacterCount)} characters…` : `Ask Rune to change ${selectedArtifact.name}…`}
                rows={1}
                aria-label={agentScope === "workspace" ? "Describe a workspace change" : agentScope === "selection" ? "Describe a selected-source change" : "Describe an artifact change"}
              />
              <button className="run-button" onClick={() => void runAgent()} disabled={!prompt.trim() || agentState === "planning" || visualEditState !== "idle" || (agentScope === "selection" && !validSourceSelection)} aria-label="Plan change" title="Plan change (⌘ Enter)">{agentState === "planning" || visualEditState !== "idle" ? <LoaderCircle className="agent-spinner" /> : <Play />}</button>
            </div>
            <p className="agent-hint">⌘ Enter to plan · {agentScope === "workspace" ? `${workspaceAgentContext.length} context files${workspacePinnedArtifactIds.length ? ` · ${workspacePinnedArtifactIds.length} pinned` : ""} · full workspace validates atomically` : agentScope === "selection" ? "Nothing outside the selected source may change" : "Every write is reviewable and undoable"}</p>
          </div>
        </section>

        <section className="preview-pane" aria-label="Compiled artifact preview">
          <header className="pane-header preview-header">
            <div className="pane-title">
              <span className="preview-mark"><FileCode2 aria-hidden="true" /></span>
              <div><span className="overline">Compiled output</span><strong>Live preview</strong></div>
            </div>
            <div className="preview-actions">
              {selectedArtifact.kind === "query" && selectedQueryDataArtifact && <span className="binding-badge query"><Database aria-hidden="true" /> 1 source</span>}
              {selectedArtifact.kind === "chart" && selectedChartSourceArtifact && !selectedChartBindingErrors.length && <span className="binding-badge chart">{selectedChartSourceArtifact.kind === "query" ? <Database aria-hidden="true" /> : <TableProperties aria-hidden="true" />} 1 source</span>}
              {!!bindingState?.queryMetricReferences.length && <span className="binding-badge query"><Database aria-hidden="true" /> {bindingState.queryMetricReferences.length} SQL metric{bindingState.queryMetricReferences.length > 1 ? "s" : ""}</span>}
              {!!bindingState?.chartReferences.length && <span className="binding-badge chart"><BarChart3 aria-hidden="true" /> {bindingState.chartReferences.length} chart{bindingState.chartReferences.length > 1 ? "s" : ""}</span>}
              {!!bindingState?.references.length && <span className="binding-badge"><Link2 aria-hidden="true" /> {bindingState.references.length} live</span>}
              {validationErrors.length ? (
                <span className="validation-badge error"><X aria-hidden="true" /> {validationErrors.length} issue{validationErrors.length > 1 ? "s" : ""}</span>
              ) : (
                <span className="validation-badge"><CheckCircle2 aria-hidden="true" /> Valid</span>
              )}
            </div>
          </header>
          <div className="preview-body">
            {selectedArtifact.kind === "chart" && selectedChartSourceArtifact && !selectedChartBindingErrors.length && (
              <div className="lineage-strip chart-lineage">
                {selectedChartSourceArtifact.kind === "query" ? <Database aria-hidden="true" /> : <TableProperties aria-hidden="true" />}
                <span>{selectedChartSourceArtifact.name}</span>
                <ChevronRight aria-hidden="true" />
                <span>{selectedArtifact.name}</span>
                <strong>{selectedChartSourceArtifact.kind === "query" ? "Browser-local query output" : "Canonical data compiled live"}</strong>
              </div>
            )}
            {selectedArtifact.kind === "query" && selectedQueryDataArtifact && (
              <div className="lineage-strip query-lineage">
                <TableProperties aria-hidden="true" />
                <span>{selectedQueryDataArtifact.name}</span>
                <ChevronRight aria-hidden="true" />
                <span>workspace_data</span>
                <ChevronRight aria-hidden="true" />
                <span>{selectedArtifact.name}</span>
                <strong>{selectedQueryDataResolution?.explicit ? "Explicit Data binding" : "Legacy first-Data binding"}</strong>
              </div>
            )}
            {!!bindingState?.queryMetricReferences.length && (
              <div className="lineage-strip query-lineage">
                <Database aria-hidden="true" />
                <span>{[...new Set(bindingState.queryMetricReferences.map((reference) => (
                  artifacts.find((artifact) => artifact.id === reference.queryArtifactId)?.name ?? reference.queryArtifactId
                )))].join(", ")}</span>
                <ChevronRight aria-hidden="true" />
                <span>{selectedArtifact.name}</span>
                <strong>{bindingState.queryMetricReferences.length} scalar metric{bindingState.queryMetricReferences.length > 1 ? "s" : ""} compiled from SQL</strong>
              </div>
            )}
            {!!bindingState?.references.length && (
              <div className="lineage-strip">
                <Database aria-hidden="true" />
                <span>{canonicalDataArtifact?.name ?? "workspace data"}</span>
                <ChevronRight aria-hidden="true" />
                <span>{selectedArtifact.name}</span>
                <strong>{bindingState.references.length} metrics compiled live</strong>
              </div>
            )}
            {!!bindingState?.chartReferences.length && (
              <div className="lineage-strip chart-lineage">
                <BarChart3 aria-hidden="true" />
                <span>{bindingState.chartReferences.map((id) => artifacts.find((artifact) => artifact.id === id)?.name ?? id).join(", ")}</span>
                <ChevronRight aria-hidden="true" />
                <span>{selectedArtifact.name}</span>
                <strong>{bindingState.chartReferences.length} chart{bindingState.chartReferences.length > 1 ? "s" : ""} compiled live</strong>
              </div>
            )}
            <div className="preview-scroll">
              <ArtifactPreview
                artifact={selectedArtifact}
                artifacts={artifacts}
                activeSelection={validSourceSelection}
                onTargetSource={focusPreviewTarget}
                onEditDataCell={visualEditState === "idle" ? commitVisualDataCellEdit : undefined}
                onEditDocumentSection={visualEditState === "idle" ? commitVisualDocumentSectionEdit : undefined}
                onEditDeckSlide={visualEditState === "idle" ? commitVisualDeckSlideEdit : undefined}
                onEditChartSpec={visualEditState === "idle" ? commitVisualChartSpecEdit : undefined}
              />
            </div>
          </div>
        </section>
          </>
        )}
      </div>

      <footer className="statusbar">
        <div><span className="status-agent-dot" /> {notice}</div>
        <div className="statusbar-right"><span>{artifactStats(selectedArtifact)}</span>{!!bindingState?.references.length && <span>{bindingState.references.length} legacy metrics</span>}{!!bindingState?.queryMetricReferences.length && <span>{bindingState.queryMetricReferences.length} SQL metrics</span>}{!!bindingState?.chartReferences.length && <span>{bindingState.chartReferences.length} linked chart{bindingState.chartReferences.length > 1 ? "s" : ""}</span>}<span>UTF-8</span><span>Rune v0.38</span></div>
      </footer>

      {newArtifactOpen && (
        <NewArtifactDialog
          artifacts={artifacts}
          error={newArtifactError}
          onCancel={() => {
            setNewArtifactOpen(false);
            setNewArtifactError("");
            setNotice("New artifact cancelled — the workspace is unchanged");
          }}
          onCreate={createNewArtifact}
        />
      )}
      {pendingImport && (
        <ImportReviewDialog
          sourceName={pendingImport.sourceName}
          artifacts={pendingImport.importedArtifacts}
          warnings={pendingImport.warnings}
          error={importError}
          onCancel={cancelPendingImport}
          onConfirm={applyPendingImport}
        />
      )}
      {pendingExport && (
        <ExportReviewDialog
          sourceName={pendingExport.sourceArtifactName}
          result={pendingExport.result}
          error={exportError}
          onCancel={cancelExport}
          onConfirm={confirmExport}
        />
      )}
      {welcomeOpen && hydrated && (
        <WelcomeExperience
          detectedLocale={detectedLocale}
          locale={locale}
          modelMode={modelMode}
          startAt={welcomeStartAt}
          dismissible={welcomeDismissible}
          onLocaleChange={setInterfaceLocale}
          onModelModeChange={setPreferredModelMode}
          onComplete={finishWelcome}
          onDismiss={() => setWelcomeOpen(false)}
        />
      )}
    </main>
  );
}
