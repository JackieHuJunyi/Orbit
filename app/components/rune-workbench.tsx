"use client";

import {
  BarChart3,
  BookOpen,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  CircleDot,
  ClipboardList,
  Code2,
  Columns2,
  Database,
  Download,
  Ellipsis,
  Eye,
  FileArchive,
  FileCode2,
  FilePlus2,
  FileOutput,
  FileText,
  FolderOpen,
  History,
  LayoutGrid,
  ImagePlus,
  Link2,
  LoaderCircle,
  PanelLeftClose,
  PanelLeftOpen,
  Palette,
  Pin,
  Play,
  Presentation,
  RotateCcw,
  RefreshCw,
  Save,
  Settings,
  Sparkles,
  TableProperties,
  Undo2,
  Upload,
  X,
} from "lucide-react";
import { ChangeEvent, KeyboardEvent, SyntheticEvent, useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from "react";
import {
  ArtifactPreview,
  type ChartSpecEditHandler,
  type DataCellEditHandler,
  type DeckSlideEditHandler,
  type DocumentBlockEditHandler,
  type DocumentBlockStructureReviewHandler,
  type DocumentSectionEditHandler,
  type VisualSourceDraft,
} from "./artifact-previews";
import { DocumentStructureReviewDialog } from "./document-structure-review-dialog";
import { LocalImageReviewDialog, localImageCopy } from "./local-image-review-dialog";
import { EmptyWorkspace } from "./empty-workspace";
import { ExportReviewDialog } from "./export-review-dialog";
import { ImportReviewDialog } from "./import-review-dialog";
import { NewArtifactDialog } from "./new-artifact-dialog";
import { OperatingReviewDialog } from "./operating-review-dialog";
import {
  PdfOcrSetupDialog,
  type PdfOcrCandidate,
  type PdfOcrSelection,
} from "./pdf-ocr-setup-dialog";
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
  validateArtifact,
  type ArtifactKind,
  type WorkspaceArtifact,
} from "../lib/workspace";
import { planLocalWorkspaceAgentChange } from "../lib/local-workspace-agent";
import { planLocalSelectionChange } from "../lib/local-selection-agent";
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
import {
  deriveSourceLinkedPreviewTargets,
  resolveSourceLinkedPreviewTarget,
  type DocumentBlockPreviewSourceTarget,
  type PreviewSourceTarget,
} from "../lib/preview-targets";
import { buildWorkspaceTransactionReview } from "../lib/transaction-review";
import {
  MAX_AGENT_SELECTION_CHARS,
  sourceOutsideSelectionIsUnchanged,
  sourceSelectionError,
  type SourceSelection,
} from "../lib/source-selection";
import { formatInteger } from "../lib/number-format";
import type { PdfOcrProgress } from "../lib/pdf-import";
import {
  createRuneGuideArtifact,
  detectPreferredLocale,
  localeDirection,
  localizeRuneStatus,
  normalizeRuneLocale,
  runeQuickCommands,
  runeText,
  runeUICopy,
  workspaceSplitValueLabel,
  RUNE_GUIDE_ID,
  RUNE_LOCALE_STORAGE_KEY,
  RUNE_ONBOARDING_STORAGE_KEY,
  type RuneLocale,
  type RuneUICopy,
} from "../lib/localization";
import {
  normalizeRuneModelMode,
  RUNE_MODEL_MODE_STORAGE_KEY,
  type RuneModelMode,
} from "../lib/model-preference";
import {
  normalizeRuneAppearanceTheme,
  RUNE_APPEARANCE_STORAGE_KEY,
  RUNE_APPEARANCE_THEMES,
  type RuneAppearanceTheme,
} from "../lib/appearance";
import {
  buildRuneImageInsertion,
  deleteRuneImageAsset,
  extractRuneAssetIds,
  getRuneImageBlob,
  getRuneImageAsset,
  parseRuneAssetReference,
  prepareRuneImageAsset,
  putRuneImageAsset,
  runeImageAltFromName,
  RUNE_IMAGE_ACCEPT,
  type PreparedRuneImageAsset,
  type RuneImageInsertion,
} from "../lib/local-assets";
import {
  clampWorkspaceSourcePercent,
  DEFAULT_WORKSPACE_SOURCE_PERCENT,
  normalizeRuneWorkspaceView,
  normalizeWorkspaceSourcePercent,
  RUNE_WORKSPACE_SPLIT_STORAGE_KEY,
  RUNE_WORKSPACE_VIEW_STORAGE_KEY,
  workspaceViewFromKeyboardShortcut,
  workspaceSplitTracks,
  type RuneWorkspaceView,
} from "../lib/workspace-layout";
import { prepareVisualDataCellEdit } from "../lib/visual-data-edit";
import { prepareVisualDocumentSectionEdit } from "../lib/visual-document-edit";
import { prepareVisualDocumentBlockEdit } from "../lib/visual-document-block-edit";
import {
  prepareVisualDocumentBlockStructure,
  type PreparedVisualDocumentBlockStructure,
  type VisualDocumentBlockStructureInput,
} from "../lib/visual-document-block-structure";
import { prepareVisualDeckSlideEdit } from "../lib/visual-deck-edit";
import { prepareVisualChartSpecEdit } from "../lib/visual-chart-edit";
import {
  appendOperatingReviewRun,
  createSavedOperatingReview,
  MAX_SAVED_OPERATING_REVIEWS,
  normalizeSavedOperatingReviews,
  prepareOperatingReviewWorkflow,
  prepareSavedOperatingReviewRerun,
  summarizeOperatingReviewRuns,
  type OperatingReviewInput,
  type SavedOperatingReview,
} from "../lib/operating-review";
import {
  convertLegacyOfficeFile,
  legacyOfficeFileName,
  MAX_LEGACY_OFFICE_IMPORT_BYTES,
  supportsLegacyOfficeDesktopExport,
} from "../lib/desktop-bridge";

const STORAGE_KEY = "rune-workspace-v0";
const MAX_SOURCE_IMPORT_BYTES = 2 * 1024 * 1024;
const MAX_OFFICE_IMPORT_BYTES = 12 * 1024 * 1024;
const MAX_PDF_IMPORT_BYTES = 12 * 1024 * 1024;
const OFFICE_IMPORT_PATTERN = /\.(?:docx|xlsx|pptx)$/i;
const ODF_IMPORT_PATTERN = /\.(?:odt|ods|odp)$/i;
const PDF_IMPORT_PATTERN = /\.pdf$/i;

async function importLegacyOfficeThroughDesktop(file: File) {
  const converted = await convertLegacyOfficeFile(file);
  const { convertOfficeFile } = await import("../lib/office-import");
  const result = convertOfficeFile(converted.fileName, converted.bytes);
  return {
    ...result,
    warnings: [
      converted.warning,
      ...result.warnings,
    ],
  };
}

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

type ActiveSourceCursor = SourceSelection & {
  artifactId: string;
  sourceRevision: string;
};

type PendingChange = {
  prompt: string;
  provider: string;
  scope: AgentScope;
  selection?: SourceSelection;
  baseRevision: WorkspaceSourceRevision;
  summary: string;
  detail: string;
  patches: ArtifactSourcePatch[];
  creations: ArtifactCreationChange[];
  selectAfterApplyArtifactId?: string;
  runtimeRepair?: Pick<AgentRuntimeRepair, "attempt" | "failure">;
  runtimePreflight?: RuntimeImpactPreflight;
  savedOperatingReviewAfterApply?: SavedOperatingReview;
  preparedAt?: number;
  usage?: { inputTokens: number | null; outputTokens: number | null };
};

type PendingPdfOcr = {
  files: File[];
  baseArtifacts: WorkspaceArtifact[];
  sourceName: string;
  candidates: PdfOcrCandidate[];
};

type PendingExport = {
  sourceArtifactName: string;
  baseArtifacts: WorkspaceArtifact[];
  result: ArtifactExportResult;
};

type PendingDocumentStructure = {
  targetArtifact: WorkspaceArtifact;
  target: DocumentBlockPreviewSourceTarget;
  input: VisualDocumentBlockStructureInput;
  prepared: PreparedVisualDocumentBlockStructure;
  error: string;
  submitting: boolean;
};

type PendingLocalImage = {
  artifact: WorkspaceArtifact;
  asset: PreparedRuneImageAsset;
  insertion: RuneImageInsertion;
  offset: number;
  alt: string;
  error: string;
  submitting: boolean;
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
  profileName?: string;
  plan?: unknown;
  queryArtifactIds?: string[];
  repairAttempt?: number;
  usage?: { inputTokens?: unknown; outputTokens?: unknown };
};

function normalizeAgentUsage(value: RemoteAgentResponse["usage"]) {
  const token = (candidate: unknown) => Number.isInteger(candidate) && Number(candidate) >= 0
    ? Number(candidate)
    : null;
  return { inputTokens: token(value?.inputTokens), outputTokens: token(value?.outputTokens) };
}

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
  copy,
  onClearPins,
  onSelect,
}: {
  artifacts: WorkspaceArtifact[];
  graph: WorkspaceDependencyGraph;
  contextArtifacts: WorkspaceArtifact[];
  pinnedArtifactIds: string[];
  selectedArtifactId: string;
  copy: RuneUICopy["workbench"];
  onClearPins: () => void;
  onSelect: (artifactId: string) => void;
}) {
  const artifactById = new Map(artifacts.map((artifact) => [artifact.id, artifact] as const));
  const contextIds = new Set(contextArtifacts.map((artifact) => artifact.id));
  const pinnedIds = new Set(pinnedArtifactIds);
  const connectedIds = new Set(graph.edges.flatMap((edge) => [edge.fromArtifactId, edge.toArtifactId]));
  const unlinkedArtifacts = artifacts.filter((artifact) => !connectedIds.has(artifact.id));
  return (
    <aside className="file-rail dependency-rail" aria-label={copy.dependencyGraph}>
      <div className="file-rail-header">
        <div><span className="overline">{copy.liveContext}</span><strong>{copy.dependencyGraphTitle}</strong></div>
        <span className="dependency-count" aria-label={copy.dependencyEdges(graph.edges.length)}>{graph.edges.length}</span>
      </div>
      <section className="graph-context-card" aria-label={copy.agentContextPack}>
        <div className="graph-context-heading">
          <span>{copy.agentContext}</span>
          <span><strong>{contextArtifacts.length} / {artifacts.length}</strong>{pinnedArtifactIds.length > 0 && <button type="button" onClick={onClearPins}>{copy.clearPins}</button>}</span>
        </div>
        <p>{copy.contextExplanation}</p>
        <nav aria-label={copy.artifactsInContext}>
          {contextArtifacts.map((artifact) => (
            <button
              type="button"
              key={artifact.id}
              className={`${artifact.id === selectedArtifactId ? "active" : ""} ${pinnedIds.has(artifact.id) ? "pinned" : ""}`.trim() || undefined}
              onClick={() => onSelect(artifact.id)}
              aria-current={artifact.id === selectedArtifactId ? "page" : undefined}
              aria-label={copy.openContextArtifact(artifact.name, pinnedIds.has(artifact.id))}
            >
              <span className={`artifact-icon ${artifact.kind}`}><ArtifactIcon kind={artifact.kind} size={11} /></span>
              <span>{artifact.name}</span>
              {pinnedIds.has(artifact.id) && <Pin className="context-pin-marker" aria-hidden="true" />}
            </button>
          ))}
        </nav>
      </section>
      <div className="artifact-group-label"><span>{copy.sourceToConsumer}</span><span>{graph.edges.length}</span></div>
      <div className="dependency-edge-list" role="list" aria-label={copy.liveDependencies}>
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
              <button type="button" className="dependency-endpoint" onClick={() => onSelect(source.id)} aria-label={copy.openDependencySource(source.name)}>
                <span className={`artifact-icon ${source.kind}`}><ArtifactIcon kind={source.kind} size={11} /></span>
                <span>{source.name}</span>
              </button>
              <div className={`dependency-relation ${edge.kind}`} title={edge.references.join(", ")}>
                <DependencyKindIcon kind={edge.kind} />
                <span>{edge.label}</span>
                <ChevronRight aria-hidden="true" />
              </div>
              <button type="button" className="dependency-endpoint" onClick={() => onSelect(consumer.id)} aria-label={copy.openDependencyConsumer(consumer.name)}>
                <span className={`artifact-icon ${consumer.kind}`}><ArtifactIcon kind={consumer.kind} size={11} /></span>
                <span>{consumer.name}</span>
              </button>
            </div>
          );
        })}
        {!graph.edges.length && <p className="dependency-empty">{copy.noDependency}</p>}
      </div>
      {!!graph.issues.length && (
        <section className="dependency-issues" aria-label={copy.unresolvedDependencies}>
          <span className="overline">{copy.needsAttention(graph.issues.length)}</span>
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
        <section className="unlinked-artifacts" aria-label={copy.unlinkedArtifacts}>
          <span className="overline">{copy.unlinked}</span>
          <div>{unlinkedArtifacts.map((artifact) => (
            <button type="button" key={artifact.id} onClick={() => onSelect(artifact.id)}>{artifact.name}</button>
          ))}</div>
        </section>
      )}
      <div className="file-rail-spacer" />
      <div className="workspace-note graph-note">
        <Database aria-hidden="true" />
        <div><strong>{copy.noHiddenGraph}</strong><span>{copy.graphRecompiles}</span></div>
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

function legacyOfficeExportType(artifact: WorkspaceArtifact): "DOC" | "PPT" | null {
  if (artifact.kind === "document") return "DOC";
  if (artifact.kind === "slides" && isDeckMarkdownArtifact(artifact)) return "PPT";
  return null;
}

function odfExportType(artifact: WorkspaceArtifact): "ODT" | "ODS" | "ODP" | null {
  if (artifact.kind === "document") return "ODT";
  if (artifact.kind === "data") return "ODS";
  if (artifact.kind === "slides" && isDeckMarkdownArtifact(artifact)) return "ODP";
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

function checkpointTime(createdAt: string, locale: RuneLocale) {
  return new Intl.DateTimeFormat(locale, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })
    .format(new Date(createdAt));
}

function persistDeviceWorkspace(
  artifacts: WorkspaceArtifact[],
  selectedId: string,
  checkpoints: CheckpointMap,
  savedOperatingReviews: SavedOperatingReview[],
) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ artifacts, selectedId, checkpoints, savedOperatingReviews }));
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
  const [savedAt, setSavedAt] = useState("");
  const [fileRailOpen, setFileRailOpen] = useState(true);
  const [railView, setRailView] = useState<"workspace" | "graph">("workspace");
  const [workspacePinnedArtifactIds, setWorkspacePinnedArtifactIds] = useState<string[]>([]);
  const [prompt, setPrompt] = useState("");
  const [pendingChange, setPendingChange] = useState<PendingChange | null>(null);
  const [pendingReviewId, setPendingReviewId] = useState("");
  const [sourceSelection, setSourceSelection] = useState<ActiveSourceSelection | null>(null);
  const [sourceCursor, setSourceCursor] = useState<ActiveSourceCursor | null>(null);
  const [newArtifactOpen, setNewArtifactOpen] = useState(false);
  const [newArtifactError, setNewArtifactError] = useState("");
  const [operatingReviewOpen, setOperatingReviewOpen] = useState(false);
  const [operatingReviewError, setOperatingReviewError] = useState("");
  const [operatingReviewState, setOperatingReviewState] = useState<"idle" | "checking">("idle");
  const [savedOperatingReviews, setSavedOperatingReviews] = useState<SavedOperatingReview[]>([]);
  const [editingOperatingReviewId, setEditingOperatingReviewId] = useState("");
  const [pendingImport, setPendingImport] = useState<WorkspaceImportReview | null>(null);
  const [importError, setImportError] = useState("");
  const [importState, setImportState] = useState<"idle" | "reading">("idle");
  const [pendingPdfOcr, setPendingPdfOcr] = useState<PendingPdfOcr | null>(null);
  const [pdfOcrProcessing, setPdfOcrProcessing] = useState(false);
  const [pdfOcrProgress, setPdfOcrProgress] = useState<PdfOcrProgress | null>(null);
  const [pdfOcrActiveFileName, setPdfOcrActiveFileName] = useState("");
  const [pdfOcrError, setPdfOcrError] = useState("");
  const [pendingExport, setPendingExport] = useState<PendingExport | null>(null);
  const [pendingDocumentStructure, setPendingDocumentStructure] = useState<PendingDocumentStructure | null>(null);
  const [pendingLocalImage, setPendingLocalImage] = useState<PendingLocalImage | null>(null);
  const [localAssetUrls, setLocalAssetUrls] = useState<Record<string, string>>({});
  const [exportError, setExportError] = useState("");
  const [exportState, setExportState] = useState<"idle" | "office" | "legacy-office" | "odf" | "html" | "pdf" | "csv" | "json">("idle");
  const [exportMenuOpen, setExportMenuOpen] = useState(false);
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
  const [appearanceTheme, setAppearanceTheme] = useState<RuneAppearanceTheme>("mist-blue");
  const [toolsMenuOpen, setToolsMenuOpen] = useState(false);
  const [workspaceSourcePercent, setWorkspaceSourcePercent] = useState(DEFAULT_WORKSPACE_SOURCE_PERCENT);
  const [workspaceView, setWorkspaceView] = useState<RuneWorkspaceView>("split");
  const [emptyWorkspace, setEmptyWorkspace] = useState(false);
  const [visualEditState, setVisualEditState] = useState<"idle" | "checking">("idle");
  const [visualSourceDraft, setVisualSourceDraft] = useState<VisualSourceDraft | null>(null);
  const workspaceRef = useRef<HTMLDivElement>(null);
  const gutterRef = useRef<HTMLPreElement>(null);
  const sourceEditorRef = useRef<HTMLTextAreaElement>(null);
  const sourceDraftMirrorRef = useRef<HTMLPreElement>(null);
  const exportMenuRef = useRef<HTMLDivElement>(null);
  const toolsMenuRef = useRef<HTMLDivElement>(null);
  const promptRef = useRef<HTMLTextAreaElement>(null);
  const previewScrollRef = useRef<HTMLDivElement>(null);
  const previewSelectionNoticeRef = useRef<PreviewSourceTarget | null>(null);
  const importRef = useRef<HTMLInputElement>(null);
  const imageImportRef = useRef<HTMLInputElement>(null);
  const importInFlightRef = useRef(false);
  const localImageInFlightRef = useRef(false);
  const pdfOcrAbortRef = useRef<AbortController | null>(null);
  const exportInFlightRef = useRef(false);
  const visualEditInFlightRef = useRef(false);
  const artifactsRef = useRef(artifacts);
  const checkpointsRef = useRef(checkpoints);
  const savedOperatingReviewsRef = useRef(savedOperatingReviews);
  const recordedStoppedReviewIdsRef = useRef(new Set<string>());
  artifactsRef.current = artifacts;
  checkpointsRef.current = checkpoints;
  savedOperatingReviewsRef.current = savedOperatingReviews;
  const ui = useMemo(() => runeUICopy(locale).workbench, [locale]);
  const visibleNotice = useMemo(() => localizeRuneStatus(locale, notice), [locale, notice]);

  useEffect(() => {
    document.documentElement.lang = locale;
    document.documentElement.dir = localeDirection(locale);
    document.documentElement.dataset.locale = locale;
  }, [locale]);

  useEffect(() => {
    document.documentElement.dataset.theme = appearanceTheme;
    if (!hydrated) return;
    try {
      localStorage.setItem(RUNE_APPEARANCE_STORAGE_KEY, appearanceTheme);
    } catch {
      // Appearance stays available in memory when device preference persistence is unavailable.
    }
  }, [appearanceTheme, hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    const referencedIds = [...new Set(artifacts.flatMap((artifact) => extractRuneAssetIds(artifact.source)))];
    let cancelled = false;
    const nextUrls: Record<string, string> = {};
    void Promise.all(referencedIds.map(async (id) => {
      try {
        const blob = await getRuneImageBlob(id);
        if (blob && !cancelled) nextUrls[id] = URL.createObjectURL(blob);
      } catch {
        // A missing or unavailable device asset remains an explicit preview placeholder.
      }
    })).then(() => {
      if (cancelled) {
        Object.values(nextUrls).forEach((url) => URL.revokeObjectURL(url));
        return;
      }
      setLocalAssetUrls((current) => {
        Object.values(current).forEach((url) => URL.revokeObjectURL(url));
        return nextUrls;
      });
    });
    return () => { cancelled = true; };
  }, [artifacts, hydrated]);

  useEffect(() => () => {
    Object.values(localAssetUrls).forEach((url) => URL.revokeObjectURL(url));
  }, [localAssetUrls]);

  const resolveLocalAssetUrl = useCallback((reference: string) => {
    const id = parseRuneAssetReference(reference);
    return id ? localAssetUrls[id] ?? null : null;
  }, [localAssetUrls]);

  useEffect(() => () => {
    document.body.classList.remove("workspace-resizing");
  }, []);

  useEffect(() => {
    if (!exportMenuOpen && !toolsMenuOpen) return;
    const closeOutside = (event: globalThis.PointerEvent) => {
      if (!exportMenuRef.current?.contains(event.target as Node)) setExportMenuOpen(false);
      if (!toolsMenuRef.current?.contains(event.target as Node)) setToolsMenuOpen(false);
    };
    const closeOnEscape = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") {
        setExportMenuOpen(false);
        setToolsMenuOpen(false);
      }
    };
    window.addEventListener("pointerdown", closeOutside);
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      window.removeEventListener("pointerdown", closeOutside);
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [exportMenuOpen, toolsMenuOpen]);
  const setPreferredModelMode = useCallback((nextMode: RuneModelMode) => {
    setModelMode(nextMode);
    try {
      localStorage.setItem(RUNE_MODEL_MODE_STORAGE_KEY, nextMode);
    } catch {
      // This preference contains no credential; in-memory mode remains available.
    }
  }, []);

  const handleVisualSourceDraftChange = useCallback((draft: VisualSourceDraft | null) => {
    setVisualSourceDraft((current) => {
      if (!current || !draft) return current === draft ? current : draft;
      return current.artifactId === draft.artifactId
        && current.sourceRevision === draft.sourceRevision
        && current.nextSource === draft.nextSource
        && current.start === draft.start
        && current.end === draft.end
        && current.errors.length === draft.errors.length
        && current.errors.every((error, index) => error === draft.errors[index])
        ? current
        : draft;
    });
    if (!draft) return;
    window.requestAnimationFrame(() => {
      const editor = sourceEditorRef.current;
      if (!editor || editor.value !== draft.nextSource) return;
      editor.setSelectionRange(draft.start, draft.end, "forward");
      const line = draft.nextSource.slice(0, draft.start).split("\n").length;
      editor.scrollTop = Math.max(0, (line - 3) * 20.4);
      if (gutterRef.current) gutterRef.current.scrollTop = editor.scrollTop;
      if (sourceDraftMirrorRef.current) sourceDraftMirrorRef.current.scrollTop = editor.scrollTop;
    });
  }, []);

  const selectedArtifact = artifacts.find((artifact) => artifact.id === selectedId) ?? artifacts[0];
  const activeVisualSourceDraft = selectedArtifact
    && visualSourceDraft?.artifactId === selectedArtifact.id
    && visualSourceDraft.sourceRevision === selectedArtifact.source
    ? visualSourceDraft
    : null;
  const editorSource = activeVisualSourceDraft?.nextSource ?? selectedArtifact?.source ?? "";
  const selectedOfficeExportType = selectedArtifact ? officeExportType(selectedArtifact) : null;
  const selectedLegacyOfficeExportType = selectedArtifact ? legacyOfficeExportType(selectedArtifact) : null;
  const legacyOfficeExportAvailable = hydrated && selectedLegacyOfficeExportType
    ? supportsLegacyOfficeDesktopExport()
    : false;
  const selectedOdfExportType = selectedArtifact ? odfExportType(selectedArtifact) : null;
  const selectedHtmlExport = Boolean(selectedArtifact?.kind === "slides" && isDeckMarkdownArtifact(selectedArtifact));
  const selectedPdfExport = Boolean(selectedArtifact?.kind === "document" || selectedArtifact?.kind === "data" || selectedHtmlExport);
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
  const currentSourceCursor = sourceCursor?.artifactId === selectedArtifact?.id
    && sourceCursor.sourceRevision === selectedArtifact?.source
    ? sourceCursor
    : null;
  const sourceLinkedPreviewTargets = useMemo(
    () => selectedArtifact ? deriveSourceLinkedPreviewTargets(selectedArtifact) : [],
    [selectedArtifact],
  );
  const activePreviewTarget = useMemo(
    () => selectedArtifact && currentSourceCursor
      ? resolveSourceLinkedPreviewTarget(selectedArtifact, currentSourceCursor, sourceLinkedPreviewTargets)
      : null,
    [currentSourceCursor, selectedArtifact, sourceLinkedPreviewTargets],
  );
  const activePreviewTargetId = activePreviewTarget?.id ?? "";
  const activePreviewTargetKind = activePreviewTarget?.kind ?? null;
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
    () => Array.from({ length: editorSource.split("\n").length || 1 }, (_, index) => index + 1).join("\n"),
    [editorSource],
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
    || Boolean(pendingPdfOcr)
    || Boolean(pendingExport)
    || Boolean(pendingDocumentStructure)
    || Boolean(pendingLocalImage)
    || operatingReviewOpen
    || operatingReviewState !== "idle"
    || visualEditState !== "idle"
    || Boolean(activeVisualSourceDraft);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        const detected = detectPreferredLocale(navigator.languages?.length ? navigator.languages : [navigator.language]);
        const storedLocale = normalizeRuneLocale(localStorage.getItem(RUNE_LOCALE_STORAGE_KEY));
        const storedModelMode = normalizeRuneModelMode(localStorage.getItem(RUNE_MODEL_MODE_STORAGE_KEY));
        const storedAppearance = normalizeRuneAppearanceTheme(localStorage.getItem(RUNE_APPEARANCE_STORAGE_KEY));
        const storedWorkspaceSplit = normalizeWorkspaceSourcePercent(localStorage.getItem(RUNE_WORKSPACE_SPLIT_STORAGE_KEY));
        const storedWorkspaceView = normalizeRuneWorkspaceView(localStorage.getItem(RUNE_WORKSPACE_VIEW_STORAGE_KEY));
        setDetectedLocale(detected);
        setLocale(storedLocale ?? detected);
        setModelMode(storedModelMode ?? "auto");
        setAppearanceTheme(storedAppearance ?? "mist-blue");
        setWorkspaceSourcePercent(storedWorkspaceSplit ?? DEFAULT_WORKSPACE_SOURCE_PERCENT);
        setWorkspaceView(storedWorkspaceView ?? "split");
        setWelcomeOpen(localStorage.getItem(RUNE_ONBOARDING_STORAGE_KEY) !== "complete");
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
          const parsed = JSON.parse(stored) as { artifacts?: unknown; selectedId?: unknown; checkpoints?: unknown; savedOperatingReviews?: unknown };
          const restoredArtifacts = normalizeWorkspaceArtifacts(parsed.artifacts);
          const restoredId = typeof parsed.selectedId === "string"
            && restoredArtifacts.some((artifact) => artifact.id === parsed.selectedId)
            ? parsed.selectedId
            : restoredArtifacts[0].id;
          setArtifacts(restoredArtifacts);
          setSelectedId(restoredId);
          setCheckpoints(normalizeCheckpointMap(parsed.checkpoints));
          setSavedOperatingReviews(normalizeSavedOperatingReviews(parsed.savedOperatingReviews));
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

  const setPreferredWorkspaceSplit = useCallback((value: number) => {
    const next = clampWorkspaceSourcePercent(value);
    setWorkspaceSourcePercent(next);
    try {
      localStorage.setItem(RUNE_WORKSPACE_SPLIT_STORAGE_KEY, String(next));
    } catch {
      // The presentation-only split remains usable in memory.
    }
  }, []);

  const setPreferredWorkspaceView = useCallback((view: RuneWorkspaceView) => {
    setWorkspaceView(view);
    try {
      localStorage.setItem(RUNE_WORKSPACE_VIEW_STORAGE_KEY, view);
    } catch {
      // The presentation-only view remains usable in memory.
    }
  }, []);

  const resizeWorkspaceFromPointer = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0 || window.matchMedia("(max-width: 960px)").matches) return;
    const workspace = workspaceRef.current;
    if (!workspace) return;
    const sourcePane = workspace.querySelector<HTMLElement>(":scope > .source-pane");
    const previewPane = workspace.querySelector<HTMLElement>(":scope > .preview-pane");
    if (!sourcePane || !previewPane) return;
    const sourceRect = sourcePane.getBoundingClientRect();
    const previewRect = previewPane.getBoundingClientRect();
    const start = Math.min(sourceRect.left, previewRect.left);
    const end = Math.max(sourceRect.right, previewRect.right);
    const width = end - start;
    if (width <= 0) return;
    document.body.classList.add("workspace-resizing");
    event.currentTarget.setPointerCapture(event.pointerId);
    const onMove = (moveEvent: PointerEvent) => {
      const physicalPercent = ((moveEvent.clientX - start) / width) * 100;
      setWorkspaceSourcePercent(clampWorkspaceSourcePercent(document.documentElement.dir === "rtl" ? 100 - physicalPercent : physicalPercent));
    };
    const onEnd = () => {
      document.body.classList.remove("workspace-resizing");
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onEnd);
      window.removeEventListener("pointercancel", onEnd);
      setWorkspaceSourcePercent((current) => {
        try { localStorage.setItem(RUNE_WORKSPACE_SPLIT_STORAGE_KEY, String(current)); } catch { /* memory-only */ }
        return current;
      });
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onEnd);
    window.addEventListener("pointercancel", onEnd);
  }, []);

  const resizeWorkspaceFromKeyboard = useCallback((event: KeyboardEvent<HTMLDivElement>) => {
    const direction = document.documentElement.dir === "rtl" ? -1 : 1;
    const step = event.shiftKey ? 5 : 2;
    if (event.key === "Home") {
      event.preventDefault();
      setPreferredWorkspaceSplit(DEFAULT_WORKSPACE_SOURCE_PERCENT);
    } else if (event.key === "ArrowLeft") {
      event.preventDefault();
      setPreferredWorkspaceSplit(workspaceSourcePercent - step * direction);
    } else if (event.key === "ArrowRight") {
      event.preventDefault();
      setPreferredWorkspaceSplit(workspaceSourcePercent + step * direction);
    }
  }, [setPreferredWorkspaceSplit, workspaceSourcePercent]);

  useEffect(() => {
    if (!hydrated) return;
    const timer = window.setTimeout(() => {
      try {
        persistDeviceWorkspace(artifacts, selectedId, checkpoints, savedOperatingReviews);
        setSaveState("saved");
        setSavedAt(new Intl.DateTimeFormat(locale, { hour: "2-digit", minute: "2-digit" }).format(new Date()));
      } catch {
        setSaveState("error");
        setNotice("Device storage is full — download the source before leaving");
      }
    }, 450);
    return () => window.clearTimeout(timer);
  }, [artifacts, checkpoints, hydrated, locale, savedOperatingReviews, selectedId]);

  useEffect(() => {
    if (!activePreviewTargetId || workspaceView === "source") return;
    const frame = window.requestAnimationFrame(() => {
      const linkedElements = [...(previewScrollRef.current?.querySelectorAll<HTMLElement>(
        "[data-preview-source-id], [data-preview-section-id]",
      ) ?? [])];
      const linkedElement = linkedElements.find((element) => (
        activePreviewTargetKind === "document-section"
        && element.dataset.previewSectionId === activePreviewTargetId
      )) ?? linkedElements.find((element) => (
        element.dataset.previewSourceId === activePreviewTargetId
      ));
      if (!linkedElement) return;
      linkedElement.scrollIntoView({
        block: "center",
        inline: "nearest",
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
      });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [activePreviewTargetId, activePreviewTargetKind, selectedArtifact?.id, workspaceView]);

  useEffect(() => {
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (visualEditState !== "idle"
        || activeVisualSourceDraft
        || pendingDocumentStructure
        || pendingLocalImage
        || operatingReviewOpen
        || newArtifactOpen
        || welcomeOpen
        || pendingImport
        || pendingPdfOcr
        || pendingExport
        || pendingChange) return;
      const shortcutView = workspaceViewFromKeyboardShortcut(event);
      if (shortcutView && !emptyWorkspace) {
        event.preventDefault();
        setPreferredWorkspaceView(shortcutView);
        setNotice(shortcutView === "split" ? ui.showSplitView : shortcutView === "source" ? ui.showSourceView : ui.showPreviewView);
        return;
      }
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
        setSourceCursor(null);
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
        persistDeviceWorkspace(artifacts, selectedId, next, savedOperatingReviews);
        setCheckpoints(next);
        setSaveState("saved");
        setSavedAt("");
        setNotice(next === checkpoints ? "Current source is already checkpointed" : "Manual checkpoint saved on this device");
      } catch {
        setSaveState("error");
        setNotice("Device storage is full — checkpoint was not saved");
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [activeVisualSourceDraft, artifacts, checkpoints, emptyWorkspace, newArtifactOpen, operatingReviewOpen, pendingChange, pendingDocumentStructure, pendingExport, pendingImport, pendingLocalImage, pendingPdfOcr, savedOperatingReviews, selectedId, setPreferredWorkspaceView, ui.showPreviewView, ui.showSourceView, ui.showSplitView, visualEditState, welcomeOpen]);

  if (!selectedArtifact) return null;

  function selectArtifact(id: string) {
    if (activeVisualSourceDraft) return;
    setSaveState("saving");
    setSelectedId(id);
    setEmptyWorkspace(false);
    setSourceSelection(null);
    setSourceCursor(null);
    setVisualSourceDraft(null);
    if (agentScope === "selection") setAgentScope("artifact");
    setAgentError("");
    setNotice("Switched artifact context");
  }

  function closeCurrentArtifact() {
    if (activeVisualSourceDraft) return;
    setEmptyWorkspace(true);
    setHistoryOpen(false);
    setSourceSelection(null);
    setSourceCursor(null);
    setVisualSourceDraft(null);
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

  function updateSource(source: string, cursor?: SourceSelection) {
    if (pendingDocumentStructure || activeVisualSourceDraft) return;
    setSaveState("saving");
    setArtifacts((current) => current.map((artifact) => (
      artifact.id === selectedArtifact.id ? { ...artifact, source } : artifact
    )));
    setSourceSelection(null);
    setSourceCursor(cursor ? {
      artifactId: selectedArtifact.id,
      sourceRevision: source,
      ...cursor,
    } : null);
    if (agentScope === "selection") setAgentScope("artifact");
    if (pendingChange) setPendingChange(null);
  }

  async function prepareLocalImage(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    const targetArtifact = artifactsRef.current.find((artifact) => artifact.id === selectedId);
    if (!targetArtifact || targetArtifact.kind !== "document") {
      setNotice("Local images can currently be inserted into Markdown Documents");
      return;
    }
    if (pendingChange || pendingImport || pendingPdfOcr || pendingExport || pendingDocumentStructure || pendingLocalImage || activeVisualSourceDraft) {
      setNotice("Finish or cancel the current review before inserting an image");
      return;
    }
    const editor = sourceEditorRef.current;
    const offset = editor ? editor.selectionEnd : targetArtifact.source.length;
    setSaveState("saving");
    setNotice("Reading and verifying the image locally");
    try {
      const asset = await prepareRuneImageAsset(file.name, file.type, await file.arrayBuffer());
      const alt = runeImageAltFromName(asset.name);
      const insertion = buildRuneImageInsertion(targetArtifact.source, offset, alt, asset.id);
      setPendingLocalImage({ artifact: targetArtifact, asset, insertion, offset, alt, error: "", submitting: false });
      setSaveState("saved");
      setNotice("Local image ready for source review");
    } catch (error) {
      setSaveState("saved");
      setNotice(error instanceof Error ? error.message : "Rune could not verify this image");
    }
  }

  function updatePendingLocalImageAlt(alt: string) {
    setPendingLocalImage((current) => {
      if (!current) return current;
      try {
        return {
          ...current,
          alt,
          insertion: buildRuneImageInsertion(current.artifact.source, current.offset, alt, current.asset.id),
          error: "",
        };
      } catch (error) {
        return { ...current, alt, error: error instanceof Error ? error.message : "The Markdown image reference is invalid." };
      }
    });
  }

  function cancelPendingLocalImage() {
    if (pendingLocalImage?.submitting) return;
    setPendingLocalImage(null);
    setNotice("Image insertion cancelled — the workspace is unchanged");
  }

  async function confirmPendingLocalImage() {
    const pending = pendingLocalImage;
    if (!pending || pending.submitting || localImageInFlightRef.current) return;
    const currentArtifacts = artifactsRef.current;
    const currentArtifact = currentArtifacts.find((artifact) => artifact.id === pending.artifact.id);
    if (!currentArtifact || currentArtifact.source !== pending.artifact.source) {
      setPendingLocalImage({ ...pending, error: "The Document changed after this review opened. Choose the image again from the current source." });
      return;
    }
    if (!canCheckpointSource(currentArtifact.source)) {
      setPendingLocalImage({ ...pending, error: "This Document is too large for a safe pre-insertion checkpoint." });
      return;
    }
    let insertion: RuneImageInsertion;
    try {
      insertion = buildRuneImageInsertion(currentArtifact.source, pending.offset, pending.alt, pending.asset.id);
    } catch (error) {
      setPendingLocalImage({ ...pending, error: error instanceof Error ? error.message : "The Markdown image reference is invalid." });
      return;
    }
    const patch: ArtifactSourcePatch = {
      artifactId: currentArtifact.id,
      summary: `Insert ${pending.asset.name}`,
      detail: "Store one device-local image by content hash and insert its readable Markdown reference.",
      nextSource: insertion.nextSource,
      operationCount: 1,
    };
    const prepared = prepareWorkspaceMutation(currentArtifacts, [patch], []);
    if (prepared.errors.length) {
      setPendingLocalImage({ ...pending, insertion, error: prepared.errors.slice(0, 3).join(" ") });
      return;
    }
    const checkpoint = createCheckpoint(currentArtifact, `Before image · ${pending.asset.name}`, "manual");
    const nextCheckpoints = appendCheckpoint(checkpointsRef.current, checkpoint);
    localImageInFlightRef.current = true;
    setPendingLocalImage({ ...pending, insertion, error: "", submitting: true });
    setSaveState("saving");
    setNotice("Saving the image and Markdown reference atomically");
    let created = false;
    try {
      created = await putRuneImageAsset(pending.asset);
      try {
        persistDeviceWorkspace(prepared.nextArtifacts, currentArtifact.id, nextCheckpoints, savedOperatingReviewsRef.current);
      } catch {
        if (created) await deleteRuneImageAsset(pending.asset.id).catch(() => undefined);
        setSaveState("error");
        setPendingLocalImage((value) => value ? { ...value, error: "Device storage is full, so Rune kept the Document unchanged.", submitting: false } : value);
        return;
      }
      const selection: ActiveSourceSelection = {
        artifactId: currentArtifact.id,
        sourceRevision: insertion.nextSource,
        start: insertion.start,
        end: insertion.end,
      };
      setArtifacts(prepared.nextArtifacts);
      setSelectedId(currentArtifact.id);
      setCheckpoints(nextCheckpoints);
      setSourceSelection(selection);
      setSourceCursor(selection);
      setAgentScope("selection");
      setPendingChange(null);
      setPendingLocalImage(null);
      setSaveState("saved");
      setSavedAt("");
      setNotice(`${pending.asset.name} inserted as a device-local content-hash asset`);
      window.requestAnimationFrame(() => window.requestAnimationFrame(() => {
        sourceEditorRef.current?.focus({ preventScroll: true });
        sourceEditorRef.current?.setSelectionRange(selection.start, selection.end, "forward");
      }));
    } catch (error) {
      if (created) await deleteRuneImageAsset(pending.asset.id).catch(() => undefined);
      setSaveState("saved");
      setPendingLocalImage((value) => value ? {
        ...value,
        error: error instanceof Error ? error.message : "Rune could not store this image locally.",
        submitting: false,
      } : value);
    } finally {
      localImageInFlightRef.current = false;
    }
  }

  async function commitVisualSourceEdit({
    targetArtifact,
    targetLabel,
    targetNoun,
    detail,
    verificationNotice,
    compile,
    expectedNextSource,
    allowDocumentStructureReview,
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
    expectedNextSource?: string;
    allowDocumentStructureReview?: boolean;
  }): Promise<string | null> {
    if (visualEditInFlightRef.current) return "Another visual edit is still being verified.";
    if (pendingChange
      || pendingImport
      || pendingPdfOcr
      || pendingExport
      || (pendingDocumentStructure && !allowDocumentStructureReview)
      || agentState === "planning") {
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
    if (expectedNextSource != null && compiled.nextSource !== expectedNextSource) {
      return `The reviewed ${targetNoun} change no longer matches the current compiler result.`;
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
        persistDeviceWorkspace(prepared.nextArtifacts, currentArtifact.id, nextCheckpoints, savedOperatingReviewsRef.current);
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
      setSourceCursor(selection);
      setAgentScope("selection");
      setCheckpoints(nextCheckpoints);
      setPendingChange(null);
      setSaveState("saved");
      setSavedAt("");
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

  const commitVisualDocumentBlockEdit: DocumentBlockEditHandler = async (
    targetArtifact,
    target,
    input,
  ) => commitVisualSourceEdit({
    targetArtifact,
    targetLabel: target.label,
    targetNoun: `${target.blockType} block`,
    detail: `Replace one revision-bound Markdown ${target.blockType} block through the visual Document editor.`,
    verificationNotice: `Verifying ${target.label} against the complete workspace…`,
    compile: (currentArtifact) => prepareVisualDocumentBlockEdit(currentArtifact, target, input),
  });

  const reviewVisualDocumentBlockStructure: DocumentBlockStructureReviewHandler = async (
    targetArtifact,
    target,
    input,
  ) => {
    if (visualEditInFlightRef.current || visualEditState !== "idle") {
      return "Another visual edit is still being verified.";
    }
    if (pendingChange || pendingImport || pendingPdfOcr || pendingExport || pendingDocumentStructure || pendingLocalImage || agentState === "planning") {
      return "Finish or cancel the current review before changing Document structure.";
    }
    const currentArtifact = artifactsRef.current.find((artifact) => artifact.id === targetArtifact.id);
    if (!currentArtifact || currentArtifact.source !== targetArtifact.source) {
      return "The Document block no longer matches the current workspace revision.";
    }
    const prepared = prepareVisualDocumentBlockStructure(currentArtifact, target, input);
    if (prepared.errors.length || !prepared.nextTarget) {
      return prepared.errors[0] ?? "Rune could not compile this Document structure change.";
    }
    setPendingDocumentStructure({
      targetArtifact: currentArtifact,
      target,
      input,
      prepared,
      error: "",
      submitting: false,
    });
    setNotice("Document structure change ready for exact source review");
    return null;
  };

  async function confirmVisualDocumentBlockStructure() {
    const pending = pendingDocumentStructure;
    if (!pending || pending.submitting) return;
    setPendingDocumentStructure((current) => current ? { ...current, error: "", submitting: true } : current);
    const actionLabel = pending.input.action === "delete"
      ? "Delete"
      : pending.input.action.startsWith("insert")
        ? "Insert near"
        : pending.input.action === "move-up"
          ? "Move up"
          : "Move down";
    const error = await commitVisualSourceEdit({
      targetArtifact: pending.targetArtifact,
      targetLabel: pending.target.label,
      targetNoun: "Document structure",
      detail: `${actionLabel} one revision-bound Markdown block after explicit source-diff review.`,
      verificationNotice: `Verifying the reviewed structure change for ${pending.target.label}…`,
      compile: (currentArtifact) => prepareVisualDocumentBlockStructure(
        currentArtifact,
        pending.target,
        pending.input,
      ),
      expectedNextSource: pending.prepared.nextSource,
      allowDocumentStructureReview: true,
    });
    if (error) {
      setPendingDocumentStructure((current) => current ? { ...current, error, submitting: false } : current);
      return;
    }
    setPendingDocumentStructure(null);
  }

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
    if (activeVisualSourceDraft) return;
    const start = event.currentTarget.selectionStart;
    const end = event.currentTarget.selectionEnd;
    const sourceRevision = event.currentTarget.value;
    const previewTarget = previewSelectionNoticeRef.current;
    previewSelectionNoticeRef.current = null;
    const cursor: ActiveSourceCursor = {
      artifactId: selectedArtifact.id,
      sourceRevision,
      start,
      end,
    };
    setSourceCursor(cursor);
    const sourceArtifact = sourceRevision === selectedArtifact.source
      ? selectedArtifact
      : { ...selectedArtifact, source: sourceRevision };
    const linkedTarget = resolveSourceLinkedPreviewTarget(
      sourceArtifact,
      cursor,
      sourceArtifact === selectedArtifact
        ? sourceLinkedPreviewTargets
        : deriveSourceLinkedPreviewTargets(sourceArtifact),
    );
    if (start >= end) {
      setSourceSelection(null);
      if (agentScope === "selection") {
        setAgentScope("artifact");
        setNotice(linkedTarget
          ? `${linkedTarget.label} linked in preview · Current-file Agent scope enabled`
          : "Selection cleared · Current-file Agent scope enabled");
      } else if (linkedTarget) {
        setNotice(`${linkedTarget.label} linked from canonical source`);
      }
      return;
    }
    const nextSelection: ActiveSourceSelection = {
      artifactId: selectedArtifact.id,
      sourceRevision,
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
      : linkedTarget
        ? `${formatInteger(end - start)} source characters selected · ${linkedTarget.label} linked in preview · Selection Agent ready`
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
      setSourceCursor(null);
      if (agentScope === "selection") setAgentScope("artifact");
      setAgentError("The preview target artifact is no longer in this workspace.");
      setNotice("Preview target is too large or no longer matches the current source");
      return;
    }
    const error = sourceSelectionError(currentTargetArtifact.source, target);
    if (error) {
      setSourceSelection(null);
      setSourceCursor(null);
      if (agentScope === "selection") setAgentScope("artifact");
      setAgentError(error);
      setNotice("Preview target is too large or no longer matches the current source");
      return;
    }
    const contextLabel = viaLabel ? `${target.label} · via ${viaLabel}` : target.label;
    const changesArtifact = currentTargetArtifact.id !== selectedArtifact.id;
    const revealsSource = workspaceView === "preview";
    const selection: ActiveSourceSelection = {
      artifactId: currentTargetArtifact.id,
      sourceRevision: currentTargetArtifact.source,
      start: target.start,
      end: target.end,
    };
    if (changesArtifact) setSelectedId(currentTargetArtifact.id);
    if (revealsSource) setPreferredWorkspaceView("split");
    setSourceSelection(selection);
    setSourceCursor(selection);
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
      if (changesArtifact || revealsSource) window.requestAnimationFrame(focusSelection);
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
      persistDeviceWorkspace(artifacts, selectedId, next, savedOperatingReviews);
      setCheckpoints(next);
      setSaveState("saved");
      setSavedAt("");
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

  async function collectWorkspaceLocalAssets(sourceArtifacts = artifactsRef.current) {
    const ids = [...new Set(sourceArtifacts.flatMap((artifact) => extractRuneAssetIds(artifact.source)))];
    const assets: PreparedRuneImageAsset[] = [];
    for (const id of ids) {
      const asset = await getRuneImageAsset(id);
      if (!asset) throw new Error(`Referenced local image is missing or corrupt: ${id}`);
      assets.push(asset);
    }
    return assets;
  }

  async function applyDirectoryWorkspace(handle: DirectoryWorkspaceHandle, result: DirectoryReadResult) {
    if (result.errors.length) throw new Error(result.errors[0]);
    if (!result.artifacts.length) throw new Error("The selected folder does not contain a Rune workspace yet.");
    if (!window.confirm(`Replace this device draft with ${result.artifacts.length} validated source files from “${handle.name}”? A checkpoint of every current file will be kept.`)) {
      setNotice("Folder pull cancelled — the device draft is unchanged");
      return false;
    }
    const importedAssetIds: string[] = [];
    try {
      for (const asset of result.assets) {
        if (await putRuneImageAsset(asset)) importedAssetIds.push(asset.id);
      }
    } catch (error) {
      await Promise.all(importedAssetIds.map((id) => deleteRuneImageAsset(id).catch(() => undefined)));
      throw error;
    }
    const nextCheckpoints = checkpointWorkspaceBeforeFolderPull();
    const nextSelectedId = result.artifacts.some((artifact) => artifact.id === selectedId)
      ? selectedId
      : result.artifacts[0].id;
    const nextSavedReviews = savedOperatingReviews.filter((workflow) => (
      result.artifacts.some((artifact) => artifact.id === workflow.input.dataArtifactId)
      && Object.values(workflow.artifactIds).every((artifactId) => result.artifacts.some((artifact) => artifact.id === artifactId))
    ));
    try {
      persistDeviceWorkspace(result.artifacts, nextSelectedId, nextCheckpoints, nextSavedReviews);
    } catch (error) {
      await Promise.all(importedAssetIds.map((id) => deleteRuneImageAsset(id).catch(() => undefined)));
      throw error;
    }
    setArtifacts(result.artifacts);
    setSelectedId(nextSelectedId);
    setWorkspacePinnedArtifactIds([]);
    setSourceSelection(null);
    setSourceCursor(null);
    if (agentScope === "selection") setAgentScope("artifact");
    setCheckpoints(nextCheckpoints);
    setSavedOperatingReviews(nextSavedReviews);
    setPendingChange(null);
    setHistoryOpen(false);
    setSaveState("saved");
    setSavedAt("");
    setDirectoryHandle(handle);
    setDirectoryState("connected");
    setNotice(`Pulled ${result.artifacts.length} source files${result.assets.length ? ` and ${result.assets.length} local images` : ""} from ${handle.name} · ${result.source}`);
    return true;
  }

  async function connectWorkspaceFolder() {
    if (directoryState === "syncing" || pendingDocumentStructure) return;
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
        const localAssets = await collectWorkspaceLocalAssets(artifacts);
        await writeWorkspaceDirectory(handle, artifacts, localAssets);
        setDirectoryHandle(handle);
        setDirectoryState("connected");
        setNotice(`Connected ${handle.name} · wrote ${artifacts.length} readable source files`);
        return;
      }
      if (!(await applyDirectoryWorkspace(handle, result))) setDirectoryState(directoryHandle ? "connected" : "disconnected");
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
      if (!(await applyDirectoryWorkspace(directoryHandle, result))) setDirectoryState("connected");
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
      const localAssets = await collectWorkspaceLocalAssets(artifacts);
      await writeWorkspaceDirectory(directoryHandle, artifacts, localAssets);
      setDirectoryState("connected");
      setNotice(`Pushed ${artifacts.length} source files${localAssets.length ? ` and ${localAssets.length} local images` : ""} with rune.workspace.json to ${directoryHandle.name}`);
    } catch (error) {
      setDirectoryState("error");
      setNotice(error instanceof Error ? error.message : "Rune could not push that folder");
    }
  }

  function restoreCheckpoint(checkpoint: WorkspaceCheckpoint) {
    if (activeVisualSourceDraft) return;
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
    if (!instruction || agentState === "planning" || visualEditState !== "idle" || activeVisualSourceDraft || pendingDocumentStructure) return;
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
            provider: payload.provider ?? "openai",
            scope,
            selection: scope === "selection" ? targetSelection ?? undefined : undefined,
            baseRevision: targetRevision,
            ...remotePlan,
            usage: normalizeAgentUsage(payload.usage),
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

  function recordStoppedOperatingReview(
    workflow: SavedOperatingReview | undefined,
    stopReason: "validation" | "runtime" | "stale" | "persistence" | "cancelled",
    startedAt: number,
    changeCount = 0,
    runtimePreflight?: RuntimeImpactPreflight,
  ) {
    if (!workflow) return;
    const runIdentity = `${workflow.id}:${startedAt}:${stopReason}`;
    if (recordedStoppedReviewIdsRef.current.has(runIdentity)) return;
    recordedStoppedReviewIdsRef.current.add(runIdentity);
    const stopped = appendOperatingReviewRun(workflow, {
      version: 1,
      id: `run:${workflow.id}:stopped:${Date.now()}`,
      completedAt: new Date().toISOString(),
      period: workflow.input.period,
      status: "stopped",
      stopReason,
      provider: "local",
      changedFileCount: changeCount,
      queryCount: runtimePreflight?.queryCount ?? 0,
      chartConsumerCount: runtimePreflight?.chartConsumerCount ?? 0,
      durationMs: Math.max(0, Date.now() - startedAt),
      inputTokens: null,
      outputTokens: null,
    });
    const nextSavedReviews = savedOperatingReviewsRef.current.map((item) => (
      item.id === stopped.id ? stopped : item
    ));
    try {
      persistDeviceWorkspace(artifactsRef.current, selectedId, checkpointsRef.current, nextSavedReviews);
      setSavedOperatingReviews(nextSavedReviews);
    } catch {
      // A stopped run is evidence only; it must never weaken the zero-source-write guarantee.
    }
  }

  function applyPendingChange() {
    if (!pendingChange) return;
    if (!workspaceMatchesSourceRevision(artifacts, pendingChange.baseRevision)) {
      recordStoppedOperatingReview(
        pendingChange.savedOperatingReviewAfterApply,
        "stale",
        pendingChange.preparedAt ?? Date.now(),
        pendingChange.patches.length + pendingChange.creations.length,
        pendingChange.runtimePreflight,
      );
      setAgentError("The workspace changed while this Agent plan was being prepared. Discard it and plan again from the current source revision.");
      setNotice("Patch held for review — workspace source revision changed");
      return;
    }
    const targetArtifacts = pendingChange.patches.flatMap((patch) => {
      const artifact = artifacts.find((item) => item.id === patch.artifactId);
      return artifact ? [artifact] : [];
    });
    if (targetArtifacts.length !== pendingChange.patches.length) {
      recordStoppedOperatingReview(
        pendingChange.savedOperatingReviewAfterApply,
        "stale",
        pendingChange.preparedAt ?? Date.now(),
        pendingChange.patches.length + pendingChange.creations.length,
        pendingChange.runtimePreflight,
      );
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
      recordStoppedOperatingReview(
        pendingChange.savedOperatingReviewAfterApply,
        "validation",
        pendingChange.preparedAt ?? Date.now(),
        pendingChange.patches.length + pendingChange.creations.length,
        pendingChange.runtimePreflight,
      );
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

    const nextSelectedId = pendingChange.selectAfterApplyArtifactId
      ?? pendingChange.creations[0]?.artifact.id
      ?? selectedId;
    const completedWorkflow = pendingChange.savedOperatingReviewAfterApply
      ? appendOperatingReviewRun(pendingChange.savedOperatingReviewAfterApply, {
          version: 1,
          id: `run:${pendingChange.savedOperatingReviewAfterApply.id}:${Date.now()}`,
          completedAt: new Date().toISOString(),
          period: pendingChange.savedOperatingReviewAfterApply.input.period,
          status: "applied",
          stopReason: null,
          provider: pendingChange.provider === "local" ? "local" : "openai",
          changedFileCount: pendingChange.patches.length + pendingChange.creations.length,
          queryCount: pendingChange.runtimePreflight?.queryCount ?? 0,
          chartConsumerCount: pendingChange.runtimePreflight?.chartConsumerCount ?? 0,
          durationMs: pendingChange.preparedAt == null ? 0 : Math.max(0, Date.now() - pendingChange.preparedAt),
          inputTokens: pendingChange.usage?.inputTokens ?? null,
          outputTokens: pendingChange.usage?.outputTokens ?? null,
        })
      : undefined;
    const nextSavedReviews = completedWorkflow
      ? [
          completedWorkflow,
          ...savedOperatingReviews.filter((workflow) => workflow.id !== pendingChange.savedOperatingReviewAfterApply?.id),
        ].slice(0, MAX_SAVED_OPERATING_REVIEWS)
      : savedOperatingReviews;
    try {
      persistDeviceWorkspace(prepared.nextArtifacts, nextSelectedId, nextCheckpoints, nextSavedReviews);
    } catch {
      setSaveState("error");
      setAgentError("Device storage is full, so Rune kept every source unchanged.");
      setNotice("Nothing applied — atomic persistence failed");
      recordStoppedOperatingReview(
        pendingChange.savedOperatingReviewAfterApply,
        "persistence",
        pendingChange.preparedAt ?? Date.now(),
        pendingChange.patches.length + pendingChange.creations.length,
        pendingChange.runtimePreflight,
      );
      return;
    }

    setArtifacts(prepared.nextArtifacts);
    setSelectedId(nextSelectedId);
    setSourceSelection(null);
    setSourceCursor(null);
    if (pendingChange.scope === "selection") setAgentScope("artifact");
    setCheckpoints(nextCheckpoints);
    setSavedOperatingReviews(nextSavedReviews);
    setSaveState("saved");
    setSavedAt("");
    setPendingChange(null);
    setAgentError("");
    const changeCount = pendingChange.patches.length + pendingChange.creations.length;
    const creationNotice = pendingChange.creations.length
      ? ` · ${pendingChange.creations.length} new ${pendingChange.creations.length === 1 ? "file" : "files"}`
      : " · checkpoints are ready";
    setNotice(`${changeCount} ${changeCount === 1 ? "file change" : "file changes"} applied atomically${creationNotice}${directoryHandle ? " · Push when ready" : ""}`);
  }

  function discardPendingChange() {
    if (!pendingChange) return;
    recordStoppedOperatingReview(
      pendingChange.savedOperatingReviewAfterApply,
      "cancelled",
      pendingChange.preparedAt ?? Date.now(),
      pendingChange.patches.length + pendingChange.creations.length,
      pendingChange.runtimePreflight,
    );
    setPendingChange(null);
    setNotice(runeText(locale, "Review cancelled — every source stayed unchanged", "已取消审核 — 所有源内容保持不变"));
  }

  function undoLastAgentChange() {
    const previous = [...selectedCheckpoints].reverse().find((checkpoint) => checkpoint.source !== selectedArtifact.source);
    if (!previous) return;
    restoreCheckpoint(previous);
  }

  function resetWorkspace() {
    if (pendingDocumentStructure) return;
    if (!window.confirm("Reset this device draft to the Rune sample workspace?")) return;
    const defaults = cloneDefaultArtifacts();
    setSaveState("saving");
    setArtifacts(defaults);
    setSelectedId(defaults[0].id);
    setEmptyWorkspace(false);
    setWorkspacePinnedArtifactIds([]);
    setSourceSelection(null);
    setSourceCursor(null);
    if (agentScope === "selection") setAgentScope("artifact");
    setCheckpoints({});
    setSavedOperatingReviews([]);
    setEditingOperatingReviewId("");
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

  function openOperatingReview() {
    setOperatingReviewError("");
    setEditingOperatingReviewId("");
    setOperatingReviewOpen(true);
    setNotice(runeText(locale, "Choose the evidence, measure, and deliverables before Rune prepares the full review chain", "先选择数据、口径和交付物，再生成整条汇报链"));
  }

  function openSavedOperatingReview(workflow: SavedOperatingReview) {
    setOperatingReviewError("");
    setEditingOperatingReviewId(workflow.id);
    setOperatingReviewOpen(true);
    setNotice(runeText(locale, `Preparing to rerun “${workflow.input.title}”`, `正在准备重新运行「${workflow.input.title}」`));
  }

  async function prepareOperatingReview(input: OperatingReviewInput) {
    if (operatingReviewState !== "idle" || pendingChange) return;
    setOperatingReviewError("");
    setOperatingReviewState("checking");
    const baseArtifacts = artifactsRef.current;
    const baseRevision = captureWorkspaceSourceRevision(baseArtifacts);
    try {
      const savedWorkflow = savedOperatingReviewsRef.current.find((workflow) => workflow.id === editingOperatingReviewId);
      const prepared = savedWorkflow
        ? prepareSavedOperatingReviewRerun(baseArtifacts, savedWorkflow, input)
        : prepareOperatingReviewWorkflow(baseArtifacts, input);
      if (!prepared.plan || prepared.errors.length) {
        setOperatingReviewError(prepared.errors[0] ?? "Rune could not prepare this operating review.");
        return;
      }
      const transaction = prepareWorkspaceMutation(
        baseArtifacts,
        prepared.plan.patches,
        prepared.plan.creations,
      );
      if (transaction.errors.length) {
        setOperatingReviewError(transaction.errors.slice(0, 3).join(" "));
        return;
      }
      const runtimePreflight = await preflightRuntimeMutation(
        baseArtifacts,
        prepared.plan.patches,
        prepared.plan.creations,
      );
      if (!workspaceMatchesSourceRevision(artifactsRef.current, baseRevision)) {
        setOperatingReviewError(runeText(locale, "The workspace changed during validation. Prepare the review again from the current data.", "验证期间工作区已发生变化。请按当前数据重新准备。"));
        setNotice(runeText(locale, "Review not prepared — workspace revision changed", "汇报未生成 — 工作区版本已变化"));
        return;
      }
      const preferredArtifact = [...prepared.plan.creations]
        .reverse()
        .find((creation) => creation.artifact.kind === "document")
        ?? [...prepared.plan.creations].reverse().find((creation) => creation.artifact.kind === "slides")
        ?? prepared.plan.creations.at(-1);
      const savedOperatingReviewAfterApply: SavedOperatingReview | undefined = savedWorkflow
        ? { ...savedWorkflow, input: { ...input, deliverables: [...input.deliverables] } }
        : createSavedOperatingReview(input, prepared.plan);
      setPendingChange({
        prompt: input.focus,
        provider: "local",
        scope: "workspace",
        baseRevision,
        selectAfterApplyArtifactId: preferredArtifact?.artifact.id
          ?? savedOperatingReviewAfterApply?.artifactIds.document
          ?? savedOperatingReviewAfterApply?.artifactIds.slides
          ?? savedOperatingReviewAfterApply?.artifactIds.chart,
        savedOperatingReviewAfterApply,
        preparedAt: Date.now(),
        ...prepared.plan,
        runtimePreflight,
      });
      setPendingReviewId(prepared.plan.creations[0]?.artifact.id ?? prepared.plan.patches[0]?.artifactId ?? "");
      setAgentMode("local");
      setOperatingReviewOpen(false);
      setEditingOperatingReviewId("");
      setEmptyWorkspace(false);
      setNotice(runeText(locale, `${prepared.plan.patches.length + prepared.plan.creations.length} linked files prepared; nothing writes until you approve the transaction`, `已准备 ${prepared.plan.patches.length + prepared.plan.creations.length} 个互相绑定的文件；审核后才会写入`));
    } catch (error) {
      const message = error instanceof Error ? error.message : "Rune could not validate this operating review.";
      setOperatingReviewError(message);
      setNotice(runeText(locale, "Review not prepared — runtime validation failed", "汇报未生成 — 运行验证未通过"));
    } finally {
      setOperatingReviewState("idle");
    }
  }

  async function createNewArtifact(input: ArtifactCreationInput, embedArtifactId?: string) {
    if (pendingDocumentStructure) return;
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
      (committedArtifacts, nextSelectedId) => persistDeviceWorkspace(committedArtifacts, nextSelectedId, nextCheckpoints, savedOperatingReviews),
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
    setSourceCursor(null);
    if (agentScope === "selection") setAgentScope("artifact");
    setHistoryOpen(false);
    setPendingChange(null);
    setAgentError("");
    setCheckpoints(nextCheckpoints);
    setSaveState("saved");
    setSavedAt("");
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
    if (!files.length || importInFlightRef.current || exportInFlightRef.current || pendingImport || pendingPdfOcr || pendingExport || pendingDocumentStructure || exportState !== "idle") return;
    if (files.length > 20) {
      setNotice("Import up to 20 files in one review transaction");
      return;
    }
    const oversized = files.find((file) => file.size > (
      legacyOfficeFileName(file.name)
        ? MAX_LEGACY_OFFICE_IMPORT_BYTES
        : OFFICE_IMPORT_PATTERN.test(file.name)
        ? MAX_OFFICE_IMPORT_BYTES
        : ODF_IMPORT_PATTERN.test(file.name)
          ? MAX_OFFICE_IMPORT_BYTES
        : PDF_IMPORT_PATTERN.test(file.name)
          ? MAX_PDF_IMPORT_BYTES
          : MAX_SOURCE_IMPORT_BYTES
    ));
    if (oversized) {
      setNotice(legacyOfficeFileName(oversized.name)
        ? oversized.name + " exceeds the 12 MB desktop legacy Office import limit"
        : OFFICE_IMPORT_PATTERN.test(oversized.name)
        ? oversized.name + " exceeds the 12 MB Office import limit"
        : ODF_IMPORT_PATTERN.test(oversized.name)
          ? oversized.name + " exceeds the 12 MB OpenDocument import limit"
        : PDF_IMPORT_PATTERN.test(oversized.name)
          ? oversized.name + " exceeds the 12 MB PDF import limit"
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
      const ocrCandidates: PdfOcrCandidate[] = [];
      for (const [fileIndex, file] of files.entries()) {
        if (!PDF_IMPORT_PATTERN.test(file.name)) continue;
        const { analyzePdfFile } = await import("../lib/pdf-import-client");
        const analysis = await analyzePdfFile(file.name, await file.arrayBuffer());
        if (analysis.ocrCandidatePageNumbers.length) {
          ocrCandidates.push({ fileIndex, fileName: file.name, analysis });
        }
      }
      if (ocrCandidates.length) {
        setPendingPdfOcr({ files, baseArtifacts, sourceName, candidates: ocrCandidates });
        setPdfOcrError("");
        setPdfOcrProgress(null);
        setNotice(runeText(locale, `Choose scan pages and OCR language for ${ocrCandidates.length} ${ocrCandidates.length === 1 ? "PDF" : "PDFs"}`, `请确认 ${ocrCandidates.length} 份 PDF 的扫描页与 OCR 语言`));
        return;
      }
      const incoming: WorkspaceArtifact[] = [];
      const warnings: string[] = [];
      for (const file of files) {
        if (legacyOfficeFileName(file.name)) {
          const result = await importLegacyOfficeThroughDesktop(file);
          incoming.push(...result.artifacts);
          warnings.push(...result.warnings.map((warning) => file.name + ": " + warning));
          continue;
        }
        if (OFFICE_IMPORT_PATTERN.test(file.name)) {
          const { convertOfficeFile } = await import("../lib/office-import");
          const result = convertOfficeFile(file.name, await file.arrayBuffer());
          incoming.push(...result.artifacts);
          warnings.push(...result.warnings.map((warning) => file.name + ": " + warning));
          continue;
        }
        if (ODF_IMPORT_PATTERN.test(file.name)) {
          const { convertOdfFile } = await import("../lib/odf-import");
          const result = convertOdfFile(file.name, await file.arrayBuffer());
          incoming.push(...result.artifacts);
          warnings.push(...result.warnings.map((warning) => file.name + ": " + warning));
          continue;
        }
        if (PDF_IMPORT_PATTERN.test(file.name)) {
          const { convertPdfFile } = await import("../lib/pdf-import-client");
          const result = await convertPdfFile(file.name, await file.arrayBuffer());
          incoming.push(...result.artifacts);
          warnings.push(...result.warnings.map((warning) => file.name + ": " + warning));
          continue;
        }
        const artifact = detectArtifact(file.name, await file.text());
        if (!artifact) {
          throw new Error(file.name + ": choose Markdown, CSV, JSON, SQL, Deck Markdown, HTML, PDF, DOCX, XLSX, PPTX, ODT, ODS, or ODP. Legacy DOC/PPT requires Rune Desktop.");
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

  async function recognizePendingPdfPages(selections: PdfOcrSelection[]) {
    const pending = pendingPdfOcr;
    if (!pending || pdfOcrProcessing || importInFlightRef.current) return;
    if (artifacts !== pending.baseArtifacts) {
      setPdfOcrError(runeText(locale, "The workspace changed during OCR setup. Cancel and import again to review a fresh transaction.", "OCR 设置期间工作区已经变化。请取消并重新导入，以审核最新事务。"));
      return;
    }
    const selectionByIndex = new Map(selections.map((selection) => [selection.fileIndex, selection]));
    const abortController = new AbortController();
    pdfOcrAbortRef.current = abortController;
    importInFlightRef.current = true;
    setPdfOcrProcessing(true);
    setPdfOcrError("");
    setPdfOcrProgress({ stage: "loading-model", completedPages: 0, totalPages: selections.reduce((total, selection) => total + selection.pageNumbers.length, 0), progress: 0 });
    setImportState("reading");
    try {
      const incoming: WorkspaceArtifact[] = [];
      const warnings: string[] = [];
      for (const [fileIndex, file] of pending.files.entries()) {
        if (abortController.signal.aborted) throw new DOMException("OCR cancelled", "AbortError");
        setPdfOcrActiveFileName(file.name);
        if (legacyOfficeFileName(file.name)) {
          const result = await importLegacyOfficeThroughDesktop(file);
          incoming.push(...result.artifacts);
          warnings.push(...result.warnings.map((warning) => file.name + ": " + warning));
          continue;
        }
        if (OFFICE_IMPORT_PATTERN.test(file.name)) {
          const { convertOfficeFile } = await import("../lib/office-import");
          const result = convertOfficeFile(file.name, await file.arrayBuffer());
          incoming.push(...result.artifacts);
          warnings.push(...result.warnings.map((warning) => file.name + ": " + warning));
          continue;
        }
        if (ODF_IMPORT_PATTERN.test(file.name)) {
          const { convertOdfFile } = await import("../lib/odf-import");
          const result = convertOdfFile(file.name, await file.arrayBuffer());
          incoming.push(...result.artifacts);
          warnings.push(...result.warnings.map((warning) => file.name + ": " + warning));
          continue;
        }
        if (PDF_IMPORT_PATTERN.test(file.name)) {
          const selection = selectionByIndex.get(fileIndex);
          const { convertPdfFile, convertPdfFileWithOcr } = await import("../lib/pdf-import-client");
          const result = selection
            ? await convertPdfFileWithOcr(file.name, await file.arrayBuffer(), selection, {
              signal: abortController.signal,
              onProgress: setPdfOcrProgress,
            })
            : await convertPdfFile(file.name, await file.arrayBuffer());
          incoming.push(...result.artifacts);
          warnings.push(...result.warnings.map((warning) => file.name + ": " + warning));
          continue;
        }
        const artifact = detectArtifact(file.name, await file.text());
        if (!artifact) {
          throw new Error(file.name + ": choose Markdown, CSV, JSON, SQL, Deck Markdown, HTML, PDF, DOCX, XLSX, PPTX, ODT, ODS, or ODP. Legacy DOC/PPT requires Rune Desktop.");
        }
        incoming.push(artifact);
      }
      const prepared = prepareWorkspaceImportReview(pending.baseArtifacts, incoming, pending.sourceName, warnings);
      if (prepared.errors.length) throw new Error(prepared.errors[0]);
      if (!prepared.review) throw new Error("Rune could not prepare an import review.");
      setPendingImport(prepared.review);
      setPendingPdfOcr(null);
      setNotice(runeText(locale, `Review ${prepared.review.importedArtifacts.length} generated ${prepared.review.importedArtifacts.length === 1 ? "source" : "sources"} and page-level OCR confidence before import`, `请在写入前审核 ${prepared.review.importedArtifacts.length} 份生成的源内容与逐页 OCR 置信度`));
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        setNotice(runeText(locale, "OCR stopped — the workspace is unchanged", "OCR 已停止 — 工作区保持不变"));
        setPendingPdfOcr(null);
      } else {
        setPdfOcrError(error instanceof Error ? error.message : runeText(locale, "Rune could not recognize those scanned pages.", "Rune 无法识别这些扫描页。"));
      }
    } finally {
      pdfOcrAbortRef.current = null;
      importInFlightRef.current = false;
      setPdfOcrProcessing(false);
      setPdfOcrProgress(null);
      setPdfOcrActiveFileName("");
      setImportState("idle");
    }
  }

  function cancelPendingPdfOcr() {
    if (!pendingPdfOcr) return;
    if (pdfOcrProcessing) {
      pdfOcrAbortRef.current?.abort();
      return;
    }
    setPendingPdfOcr(null);
    setPdfOcrError("");
    setPdfOcrProgress(null);
    setNotice(runeText(locale, "OCR cancelled — the workspace is unchanged", "已取消 OCR — 工作区保持不变"));
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
      persistDeviceWorkspace(pendingImport.nextArtifacts, firstImported.id, checkpoints, savedOperatingReviews);
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
    setSourceCursor(null);
    if (agentScope === "selection") setAgentScope("artifact");
    setSaveState("saved");
    setSavedAt("");
    setPendingImport(null);
    setImportError("");
    setNotice(`Imported ${importedCount} readable ${importedCount === 1 ? "source" : "sources"} from ${sourceName}${warningCount ? ` · ${warningCount} fidelity ${warningCount === 1 ? "note" : "notes"} reviewed` : ""}`);
  }

  async function prepareExport(destination: "office" | "legacy-office" | "odf" | "html" | "pdf" | "csv" | "json") {
    const targetType = destination === "office"
      ? selectedOfficeExportType
      : destination === "legacy-office"
        ? selectedLegacyOfficeExportType
      : destination === "odf"
        ? selectedOdfExportType
      : destination === "html"
        ? selectedHtmlExport ? "HTML" : null
        : destination === "pdf"
          ? selectedPdfExport ? "PDF" : null
          : selectedArtifact.kind === "data" ? destination.toUpperCase() : null;
    if (!targetType || exportState !== "idle" || activeVisualSourceDraft || pendingExport || pendingImport || pendingPdfOcr || pendingDocumentStructure || importInFlightRef.current || exportInFlightRef.current) return;
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
      const imageAssets = targetArtifact.kind === "document" && extractRuneAssetIds(targetArtifact.source).length
        ? await collectWorkspaceLocalAssets([targetArtifact])
        : [];
      if (destination === "csv" || destination === "json") {
        const { exportPortableDataArtifact } = await import("../lib/data-export");
        result = exportPortableDataArtifact(targetArtifact, destination);
      } else if (destination === "office" || destination === "legacy-office" || destination === "odf") {
        const compiled = targetArtifact.kind === "document" || targetArtifact.kind === "slides"
          ? compileArtifactSource(targetArtifact.source, baseArtifacts, querySnapshots)
          : null;
        if (compiled?.metricBindingErrors.length) throw new Error(compiled.metricBindingErrors[0]);
        if (compiled?.unresolved.length) throw new Error(`Resolve ${compiled.unresolved.length} missing metric ${compiled.unresolved.length === 1 ? "reference" : "references"} before ${destination === "odf" ? "OpenDocument" : "Office"} export.`);
        if (compiled?.unresolvedQueryMetrics.length) throw new Error(compiled.unresolvedQueryMetrics[0]);
        if (compiled?.pendingQueryMetrics.length) throw new Error(`Run ${compiled.pendingQueryMetrics[0]} before ${destination === "odf" ? "OpenDocument" : "Office"} export.`);
        if (compiled?.queryMetricRuntimeErrors.length) throw new Error(compiled.queryMetricRuntimeErrors[0]);
        if (compiled?.unresolvedCharts.length) throw new Error(`Resolve ${compiled.unresolvedCharts.length} missing chart ${compiled.unresolvedCharts.length === 1 ? "reference" : "references"} before ${destination === "odf" ? "OpenDocument" : "Office"} export.`);
        const exportArtifact = compiled ? { ...targetArtifact, source: compiled.source } : targetArtifact;
        if (destination === "odf") {
          const { exportOdfArtifact } = await import("../lib/odf-export");
          result = exportOdfArtifact(exportArtifact, baseArtifacts, querySnapshots, imageAssets);
        } else {
          const { exportOfficeArtifact } = await import("../lib/office-export");
          const modernResult = exportOfficeArtifact(exportArtifact, baseArtifacts, querySnapshots, imageAssets);
          if (destination === "legacy-office") {
            const { exportLegacyOfficeFile } = await import("../lib/desktop-bridge");
            const legacy = await exportLegacyOfficeFile({ bytes: modernResult.bytes, fileName: modernResult.fileName });
            result = {
              bytes: legacy.bytes,
              fileName: legacy.fileName,
              mimeType: targetType === "DOC" ? "application/msword" : "application/vnd.ms-powerpoint",
              targetType: targetType === "DOC" ? "doc" : "ppt",
              warnings: [
                ...modernResult.warnings,
                legacy.warning,
                "Legacy Office output is a compatibility handoff, not Rune's canonical source. Verify the downloaded file in Microsoft Office before delivery.",
              ],
            };
          } else {
            result = modernResult;
          }
        }
      } else if (destination === "html") {
        const { exportDeckHtml } = await import("../lib/html-export");
        result = exportDeckHtml(targetArtifact, baseArtifacts, querySnapshots);
      } else {
        const { exportPdfArtifact } = await import("../lib/pdf-export");
        result = await exportPdfArtifact(targetArtifact, baseArtifacts, querySnapshots, undefined, imageAssets);
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
        : result.targetType === "csv" || result.targetType === "json"
          ? `portable ${result.targetType.toUpperCase()}`
        : `semantic ${result.targetType.toUpperCase()}`;
    setNotice(`Downloaded ${result.fileName} · ${exportLabel} export`);
  }

  function onPromptKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
      event.preventDefault();
      void runAgent();
    }
  }

  const artifactGroups = [
    { id: "sources", label: ui.sources, artifacts: artifacts.filter((artifact) => artifact.kind === "data") },
    { id: "analysis", label: ui.analysis, artifacts: artifacts.filter((artifact) => artifact.kind === "query" || artifact.kind === "chart") },
    { id: "deliverables", label: ui.deliverables, artifacts: artifacts.filter((artifact) => artifact.kind === "document" || artifact.kind === "slides") },
  ].filter((group) => group.artifacts.length > 0);
  const saveStatusLabel = saveState === "saved" ? ui.saved : saveState === "error" ? ui.storageFull : ui.saving;
  const saveStatusDetail = saveState === "error" ? ui.deviceStorageFull : ui.lastSaved(savedAt || ui.justNow);

  return (
    <main className="rune-shell">
      <header className="topbar">
        <div className="topbar-left">
          <button
            className="icon-button rail-toggle"
            onClick={() => setFileRailOpen((open) => !open)}
            aria-label={fileRailOpen ? ui.hideFiles : ui.showFiles}
            title={fileRailOpen ? ui.hideFiles : ui.showFiles}
          >
            {fileRailOpen ? <PanelLeftClose /> : <PanelLeftOpen />}
          </button>
          <div className="brand-mark" aria-hidden="true"><span>R</span></div>
          <div className="brand-copy"><strong>Rune</strong></div>
          <span className="project-separator" aria-hidden="true" />
          <div className="project-name">{directoryHandle?.name ?? ui.localWorkspace}</div>
        </div>
        <div className="topbar-actions">
          <div className={`save-indicator ${saveState}`} role="status" aria-label={`${saveStatusLabel} · ${saveStatusDetail}`} title={`${saveStatusLabel} · ${saveStatusDetail}`}>
            {saveState === "saved" ? <Check /> : <CircleDot />}
            <span className="visually-hidden">{saveStatusLabel}</span>
          </div>
          <button
            className="button ghost-button"
            onClick={openNewArtifact}
            disabled={artifactCreationDisabled}
          >
            <FilePlus2 aria-hidden="true" /> {ui.newArtifact}
          </button>
          <button className="button ghost-button" onClick={() => importRef.current?.click()} disabled={!hydrated || importState === "reading" || exportState !== "idle" || visualEditState !== "idle" || Boolean(activeVisualSourceDraft) || Boolean(pendingImport) || Boolean(pendingPdfOcr) || Boolean(pendingExport) || Boolean(pendingDocumentStructure)}>
            {importState === "reading" ? <LoaderCircle className="agent-spinner" aria-hidden="true" /> : <Upload aria-hidden="true" />} {ui.import}
          </button>
          {!emptyWorkspace && (
            <div className="export-menu" ref={exportMenuRef}>
              <button
                className={`button ghost-button export-menu-trigger ${exportMenuOpen ? "active" : ""}`.trim()}
                type="button"
                onClick={() => { setToolsMenuOpen(false); setExportMenuOpen((open) => !open); }}
                disabled={!hydrated || exportState !== "idle" || importState === "reading" || visualEditState !== "idle" || Boolean(activeVisualSourceDraft) || Boolean(pendingImport) || Boolean(pendingPdfOcr) || Boolean(pendingExport) || Boolean(pendingDocumentStructure)}
                aria-haspopup="menu"
                aria-expanded={exportMenuOpen}
              >
                {exportState === "idle" ? <FileOutput aria-hidden="true" /> : <LoaderCircle className="agent-spinner" aria-hidden="true" />}
                <span>{ui.exportMenu}</span><ChevronDown aria-hidden="true" />
              </button>
              {exportMenuOpen && (
                <div className="export-popover" role="menu" aria-label={ui.exportMenuBody}>
                  <div><span className="overline">{ui.exportMenu}</span><strong>{ui.exportMenuBody}</strong></div>
                  <button type="button" role="menuitem" onClick={() => { setExportMenuOpen(false); downloadArtifact(selectedArtifact); }}>
                    <Download aria-hidden="true" /><span><strong>{ui.canonicalSource}</strong><small>{selectedArtifact.name}</small></span>
                  </button>
                  {selectedArtifact.kind === "data" && (
                    <>
                      <button type="button" role="menuitem" onClick={() => { setExportMenuOpen(false); void prepareExport("csv"); }}><FileCode2 aria-hidden="true" /><span><strong>CSV</strong><small>{ui.exportAs("CSV")}</small></span></button>
                      <button type="button" role="menuitem" onClick={() => { setExportMenuOpen(false); void prepareExport("json"); }}><FileCode2 aria-hidden="true" /><span><strong>JSON</strong><small>{ui.exportAs("JSON")}</small></span></button>
                    </>
                  )}
                  {selectedOfficeExportType && <button type="button" role="menuitem" onClick={() => { setExportMenuOpen(false); void prepareExport("office"); }}><FileArchive aria-hidden="true" /><span><strong>{selectedOfficeExportType}</strong><small>{ui.exportAs(selectedOfficeExportType)}</small></span></button>}
                  {legacyOfficeExportAvailable && selectedLegacyOfficeExportType && <button type="button" role="menuitem" onClick={() => { setExportMenuOpen(false); void prepareExport("legacy-office"); }}><FileArchive aria-hidden="true" /><span><strong>{selectedLegacyOfficeExportType}</strong><small>{ui.exportAs(selectedLegacyOfficeExportType)} · Rune Desktop</small></span></button>}
                  {selectedOdfExportType && <button type="button" role="menuitem" onClick={() => { setExportMenuOpen(false); void prepareExport("odf"); }}><FileArchive aria-hidden="true" /><span><strong>{selectedOdfExportType}</strong><small>{ui.exportAsOpenDocument(selectedOdfExportType)}</small></span></button>}
                  {selectedHtmlExport && <button type="button" role="menuitem" onClick={() => { setExportMenuOpen(false); void prepareExport("html"); }}><FileCode2 aria-hidden="true" /><span><strong>HTML</strong><small>{ui.exportStandaloneHtml}</small></span></button>}
                  {selectedPdfExport && <button type="button" role="menuitem" onClick={() => { setExportMenuOpen(false); void prepareExport("pdf"); }}><FileText aria-hidden="true" /><span><strong>PDF</strong><small>{ui.exportFixedPdf}</small></span></button>}
                </div>
              )}
            </div>
          )}
          <div className="tools-menu" ref={toolsMenuRef}>
            <button
              className={`icon-button tools-menu-trigger ${toolsMenuOpen ? "active" : ""}`.trim()}
              type="button"
              onClick={() => { setExportMenuOpen(false); setToolsMenuOpen((open) => !open); }}
              aria-label={ui.moreTools}
              aria-expanded={toolsMenuOpen}
              aria-haspopup="menu"
              title={ui.moreTools}
            ><Ellipsis /></button>
            {toolsMenuOpen && (
              <div className="tools-popover" role="menu" aria-label={ui.workspaceTools}>
                <header><span className="overline">{ui.workspaceTools}</span><strong>{ui.workspaceToolsBody}</strong></header>
                <div className="tools-menu-actions">
                  <button type="button" role="menuitem" disabled={Boolean(activeVisualSourceDraft)} onClick={() => { setToolsMenuOpen(false); openWelcomeGuide(); }}><BookOpen aria-hidden="true" /><span><strong>{ui.help}</strong><small>{ui.brandSubtitle}</small></span></button>
                  <button type="button" role="menuitem" disabled={Boolean(activeVisualSourceDraft)} onClick={() => { setToolsMenuOpen(false); setWelcomeStartAt("model"); setWelcomeDismissible(true); setWelcomeOpen(true); }}><Settings aria-hidden="true" /><span><strong>{ui.models}</strong><small>{ui.localFirst}</small></span></button>
                  <button type="button" role="menuitem" disabled={directoryState === "syncing" || Boolean(activeVisualSourceDraft)} onClick={() => { setToolsMenuOpen(false); void connectWorkspaceFolder(); }}><FolderOpen aria-hidden="true" /><span><strong>{directoryHandle?.name ?? ui.openFolder}</strong><small>{ui.workspace}</small></span></button>
                  {directoryHandle && <button type="button" role="menuitem" disabled={directoryState === "syncing" || Boolean(activeVisualSourceDraft)} onClick={() => { setToolsMenuOpen(false); void pullWorkspaceFolder(); }}><RefreshCw aria-hidden="true" /><span><strong>{ui.pull}</strong><small>{directoryHandle.name}</small></span></button>}
                  {directoryHandle && <button type="button" role="menuitem" disabled={directoryState === "syncing" || Boolean(activeVisualSourceDraft)} onClick={() => { setToolsMenuOpen(false); void pushWorkspaceFolder(); }}><Save aria-hidden="true" /><span><strong>{ui.push}</strong><small>{directoryHandle.name}</small></span></button>}
                </div>
                <div className="tools-appearance-header"><Palette aria-hidden="true" /><span><strong>{ui.appearance}</strong><small>{ui.appearanceBody}</small></span></div>
                <div className="tools-theme-grid" aria-label={ui.appearanceBody}>
                  {RUNE_APPEARANCE_THEMES.map((theme) => (
                    <button
                      type="button"
                      role="menuitemradio"
                      aria-checked={appearanceTheme === theme.id}
                      className={appearanceTheme === theme.id ? "selected" : ""}
                      aria-label={runeText(locale, theme.english, theme.chinese)}
                      title={runeText(locale, theme.english, theme.chinese)}
                      onClick={() => setAppearanceTheme(theme.id)}
                      key={theme.id}
                    >
                      <span className="appearance-swatch" aria-hidden="true" style={{ background: `linear-gradient(145deg, ${theme.finish[0]}, ${theme.finish[1]})` }} />
                      <span className="tools-theme-name">{runeText(locale, theme.english, theme.chinese)}</span>
                      {appearanceTheme === theme.id && <Check aria-hidden="true" />}
                    </button>
                  ))}
                </div>
                <footer className="tools-version"><span>{ui.version}</span><strong>Rune 0.77</strong></footer>
              </div>
            )}
          </div>
          {!emptyWorkspace && (
            <span className="visually-hidden" aria-live="polite">{exportState === "idle" ? "" : `${ui.exportMenu} ${exportState}`}</span>
          )}
          <input ref={importRef} className="visually-hidden" type="file" multiple accept=".doc,.ppt,.docx,.xlsx,.pptx,.odt,.ods,.odp,.pdf,.deck.md,.md,.markdown,.csv,.json,.sql,.html,.htm" onChange={importFile} disabled={!hydrated || importState === "reading" || exportState !== "idle" || visualEditState !== "idle" || Boolean(activeVisualSourceDraft) || Boolean(pendingImport) || Boolean(pendingPdfOcr) || Boolean(pendingExport) || Boolean(pendingDocumentStructure)} />
          <input ref={imageImportRef} className="visually-hidden" type="file" accept={RUNE_IMAGE_ACCEPT} onChange={(event) => void prepareLocalImage(event)} disabled={!hydrated || selectedArtifact.kind !== "document" || visualEditState !== "idle" || Boolean(activeVisualSourceDraft) || Boolean(pendingChange) || Boolean(pendingImport) || Boolean(pendingPdfOcr) || Boolean(pendingExport) || Boolean(pendingDocumentStructure) || Boolean(pendingLocalImage)} />
        </div>
      </header>

      <div
        ref={workspaceRef}
        className={`workspace ${fileRailOpen ? "with-file-rail" : "without-file-rail"} view-${workspaceView}`}
        style={{
          "--workspace-source-track": workspaceSplitTracks(workspaceSourcePercent).source,
          "--workspace-preview-track": workspaceSplitTracks(workspaceSourcePercent).preview,
        } as CSSProperties}
      >
        <aside className="activity-rail" aria-label={ui.runeSections}>
          <div className="activity-group">
            <button
              className={`activity-button ${railView === "workspace" ? "active" : ""}`.trim()}
              onClick={() => { setRailView("workspace"); setFileRailOpen(true); }}
              aria-label={ui.workspaceFiles}
              aria-pressed={railView === "workspace"}
              title={ui.workspaceFiles}
            ><FolderOpen /></button>
            <button className="activity-button" onClick={openNewArtifact} disabled={artifactCreationDisabled} aria-label={ui.newArtifact} title={ui.newArtifact}><FilePlus2 /></button>
            <button
              className="activity-button"
              onClick={openOperatingReview}
              disabled={artifactCreationDisabled}
              aria-label={ui.createOperatingReview}
              title={ui.createOperatingReview}
            ><ClipboardList /></button>
            <button
              className="activity-button"
              onClick={() => { promptRef.current?.focus(); setNotice(ui.focusAgent); }}
              aria-label={ui.focusAgent}
              title={ui.focusAgent}
            ><Sparkles /></button>
            <button
              className={`activity-button ${railView === "graph" ? "active" : ""}`.trim()}
              onClick={() => { setRailView("graph"); setFileRailOpen(true); }}
              aria-label={ui.dataGraph}
              aria-pressed={railView === "graph"}
              title={ui.dataGraph}
            ><Database /></button>
          </div>
          <div className="activity-group">
            <button className="activity-button" onClick={resetWorkspace} aria-label={ui.resetSample} title={ui.resetSample}><RotateCcw /></button>
          </div>
        </aside>

        {fileRailOpen && (railView === "graph" ? (
          <DependencyGraphRail
            artifacts={artifacts}
            graph={dependencyGraph}
            contextArtifacts={workspaceAgentContext}
            pinnedArtifactIds={workspacePinnedArtifactIds}
            selectedArtifactId={selectedArtifact.id}
            copy={ui}
            onClearPins={clearWorkspaceContextPins}
            onSelect={selectArtifact}
          />
        ) : (
          <aside className="file-rail" aria-label={ui.workspace}>
            <div className="file-rail-header">
              <div><span className="overline">{ui.workspace}</span><strong>{directoryHandle?.name ?? ui.localWorkspace}</strong></div>
              <button className="tiny-icon-button" onClick={openNewArtifact} disabled={artifactCreationDisabled} aria-label={runeText(locale, "Create a new artifact", "新建内容")} title={ui.newArtifact}>+</button>
            </div>
            <nav className="artifact-groups" aria-label={ui.artifacts}>
              {artifactGroups.map((group) => (
                <section className={`artifact-group artifact-group-${group.id}`} aria-labelledby={`artifact-group-${group.id}`} key={group.id}>
                  <header className="artifact-group-label">
                    <h2 id={`artifact-group-${group.id}`}>{group.label}</h2>
                    <span>{group.artifacts.length}</span>
                  </header>
                  <div className="artifact-list">
                    {group.artifacts.map((artifact) => {
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
                            disabled={Boolean(activeVisualSourceDraft)}
                            onClick={() => selectArtifact(artifact.id)}
                          >
                            <span className={`artifact-icon ${artifact.kind}`}><ArtifactIcon kind={artifact.kind} /></span>
                            <span className="artifact-label"><strong>{artifact.name}</strong><small>{artifact.language}{referenceCount ? ` · ${ui.liveBindings(referenceCount)}` : ""}</small></span>
                          </button>
                          <button
                            type="button"
                            className={`artifact-context-pin ${pinned ? "active" : ""}`.trim()}
                            aria-label={ui.pinContext(artifact.name, pinned)}
                            aria-pressed={pinned}
                            title={pinned ? ui.removePin : ui.keepPin}
                            disabled={Boolean(activeVisualSourceDraft)}
                            onClick={() => toggleWorkspaceContextPin(artifact.id)}
                          >
                            <Pin aria-hidden="true" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </section>
              ))}
            </nav>
            {!!savedOperatingReviews.length && (
              <section className="saved-review-list" aria-label={ui.savedReviews}>
                <div className="artifact-group-label"><span>{ui.savedReviews}</span><span>{savedOperatingReviews.length}</span></div>
                {savedOperatingReviews.map((workflow) => {
                  const complete = artifacts.some((artifact) => artifact.id === workflow.input.dataArtifactId)
                    && Object.values(workflow.artifactIds).every((artifactId) => artifacts.some((artifact) => artifact.id === artifactId));
                  const latestRun = workflow.runs[0];
                  const runSummary = summarizeOperatingReviewRuns(workflow.runs);
                  return (
                    <article className="saved-review-card" key={workflow.id}>
                      <button
                        type="button"
                        className="saved-review-row"
                        onClick={() => openSavedOperatingReview(workflow)}
                        disabled={!complete || artifactCreationDisabled}
                        aria-label={ui.rerunReview(workflow.input.title)}
                      >
                        <ClipboardList aria-hidden="true" />
                        <span><strong>{workflow.input.title}</strong><small>{complete ? `${workflow.input.period} · ${ui.rerun}` : ui.reviewSourceMissing}</small></span>
                        <Play aria-hidden="true" />
                      </button>
                      <div className="saved-review-metrics">
                        <span>{ui.taskRuns(workflow.runs.length)}</span>
                        <span>{latestRun ? `${ui.lastRun} · ${latestRun.status === "applied" ? ui.runApplied : ui.runStopped} · ${ui.successRate(runSummary.successRate)}` : ui.noTaskRuns}</span>
                        {latestRun && <span>{ui.averageReviewTime(runSummary.averageDurationMs)} · {ui.runImpact(latestRun.changedFileCount, latestRun.queryCount, latestRun.chartConsumerCount)}</span>}
                        {latestRun && <span>{latestRun.provider === "local" ? ui.localPlanner : "Model"} · {ui.tokenUse(latestRun.inputTokens, latestRun.outputTokens)}</span>}
                      </div>
                      {!!workflow.runs.length && (
                        <details className="saved-review-history">
                          <summary>{ui.runHistory}</summary>
                          <ol>
                            {workflow.runs.map((run) => (
                              <li key={run.id}>
                                <span className={run.status}>{run.status === "applied" ? ui.runApplied : ui.runStopped}</span>
                                <strong>{run.period}</strong>
                                <small>{run.completedAt.slice(0, 10)} · {ui.runImpact(run.changedFileCount, run.queryCount, run.chartConsumerCount)}</small>
                                <small>{run.status === "stopped" && run.stopReason ? ui.stopReasons[run.stopReason] : ui.tokenUse(run.inputTokens, run.outputTokens)}</small>
                              </li>
                            ))}
                          </ol>
                        </details>
                      )}
                    </article>
                  );
                })}
              </section>
            )}
            <div className="file-rail-spacer" />
            {workspacePinnedArtifactIds.length > 0 && (
              <div className="context-pin-summary">
                <Pin aria-hidden="true" />
                <span><strong>{ui.temporaryPins(workspacePinnedArtifactIds.length)}</strong><small>{ui.includedUpstream}</small></span>
                <button type="button" onClick={clearWorkspaceContextPins}>{ui.clear}</button>
              </div>
            )}
            <div className="workspace-note">
              <LayoutGrid aria-hidden="true" />
              <div><strong>{ui.oneWorkspace}</strong><span>{ui.oneWorkspaceBody}</span></div>
            </div>
            <div className="local-badge"><span className="pulse-dot" /> {ui.localFirst}</div>
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
        <section className="source-pane" aria-label={ui.sourceEditor}>
          <header className="pane-header">
            <div className="pane-title">
              <span className={`artifact-icon ${selectedArtifact.kind}`}><ArtifactIcon kind={selectedArtifact.kind} /></span>
              <div><span className="overline">{ui.source}</span><strong>{selectedArtifact.name}</strong></div>
            </div>
            <div className="pane-actions">
              {selectedArtifact.kind === "document" && (
                <button
                  type="button"
                  className="icon-button small insert-local-image-button"
                  onClick={() => imageImportRef.current?.click()}
                  disabled={!hydrated || visualEditState !== "idle" || Boolean(activeVisualSourceDraft) || Boolean(pendingChange) || Boolean(pendingImport) || Boolean(pendingPdfOcr) || Boolean(pendingExport) || Boolean(pendingDocumentStructure) || Boolean(pendingLocalImage)}
                  aria-label={localImageCopy(locale).insertLocal}
                  title={localImageCopy(locale).insertLocalAtCursor}
                ><ImagePlus aria-hidden="true" /></button>
              )}
              <div className="workspace-view-switch" role="group" aria-label={ui.workspaceView}>
                <button type="button" className={workspaceView === "split" ? "active" : ""} aria-pressed={workspaceView === "split"} aria-label={ui.showSplitView} aria-keyshortcuts="Meta+Alt+1 Control+Alt+1" title={`${ui.showSplitView} · ⌘⌥1 / Ctrl Alt 1`} onClick={() => setPreferredWorkspaceView("split")}><Columns2 aria-hidden="true" /><span>{ui.splitView}</span></button>
                <button type="button" className={workspaceView === "source" ? "active" : ""} aria-pressed={workspaceView === "source"} aria-label={ui.showSourceView} aria-keyshortcuts="Meta+Alt+2 Control+Alt+2" title={`${ui.showSourceView} · ⌘⌥2 / Ctrl Alt 2`} onClick={() => setPreferredWorkspaceView("source")}><Code2 aria-hidden="true" /><span>{ui.sourceView}</span></button>
                <button type="button" className={workspaceView === "preview" ? "active" : ""} aria-pressed={workspaceView === "preview"} aria-label={ui.showPreviewView} aria-keyshortcuts="Meta+Alt+3 Control+Alt+3" title={`${ui.showPreviewView} · ⌘⌥3 / Ctrl Alt 3`} onClick={() => setPreferredWorkspaceView("preview")}><Eye aria-hidden="true" /><span>{ui.previewView}</span></button>
              </div>
              <button
                className={`history-trigger source-version-trigger ${historyOpen ? "active" : ""}`}
                onClick={() => setHistoryOpen((open) => !open)}
                aria-expanded={historyOpen}
                aria-label={ui.sourceVersions}
                title={ui.sourceVersions}
              ><Code2 aria-hidden="true" /><span>{selectedArtifact.language}</span><i aria-hidden="true" /><History aria-hidden="true" /><span>{selectedCheckpoints.length}</span><ChevronDown className="source-version-chevron" aria-hidden="true" /></button>
              <button
                className="icon-button small close-file-button"
                onClick={closeCurrentArtifact}
                aria-label={ui.closeFile}
                title={`${ui.closeFile} (⌘ W)`}
              ><X /></button>
            </div>
          </header>

          {historyOpen && (
            <section className="checkpoint-panel" aria-label={ui.checkpoints}>
              <div className="checkpoint-panel-header">
                <div><span className="overline">{ui.sourceVersions}</span><strong>{ui.checkpointCount(selectedCheckpoints.length)}</strong><small>{selectedArtifact.language}</small></div>
                <div className="checkpoint-panel-actions">
                  <button
                    className="icon-button small"
                    onClick={undoLastAgentChange}
                    disabled={!selectedCheckpoints.some((checkpoint) => checkpoint.source !== selectedArtifact.source)}
                    aria-label={ui.restoreLatestDifferent}
                    title={ui.restoreLatest}
                  ><Undo2 /></button>
                  <button className="button checkpoint-save" onClick={saveManualCheckpoint}><Check aria-hidden="true" /> {ui.saveCurrent}</button>
                </div>
              </div>
              {selectedCheckpoints.length ? (
                <div className="checkpoint-list">
                  {[...selectedCheckpoints].reverse().map((checkpoint) => {
                    const current = checkpoint.source === selectedArtifact.source;
                    return (
                      <div className={`checkpoint-row ${current ? "current" : ""}`} key={checkpoint.id}>
                        <span className="checkpoint-node" aria-hidden="true" />
                        <div><strong>{checkpoint.label}</strong><small>{ui.checkpointReasons[checkpoint.reason]} · {checkpointTime(checkpoint.createdAt, locale)}</small></div>
                        {current
                          ? <span className="checkpoint-current">{ui.current}</span>
                          : <button disabled={Boolean(activeVisualSourceDraft)} onClick={() => restoreCheckpoint(checkpoint)}>{ui.restore}</button>}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="checkpoint-empty">{ui.checkpointEmpty}</p>
              )}
            </section>
          )}

          <div className="editor-wrap">
            <pre ref={gutterRef} className={`line-gutter ${activeVisualSourceDraft ? "visual-source-draft" : ""}`.trim()} aria-hidden="true">{lineNumbers}</pre>
            {activeVisualSourceDraft && (
              <div className={`visual-source-sync-state ${activeVisualSourceDraft.errors.length ? "has-error" : "valid"}`} role="status">
                <span>{ui.unsavedVisualDraft}</span>
                <strong>{activeVisualSourceDraft.errors.length
                  ? ui.draftNeedsFix
                  : activeVisualSourceDraft.nextSource === activeVisualSourceDraft.sourceRevision
                    ? ui.draftUnchanged
                    : ui.draftReady}</strong>
              </div>
            )}
            <textarea
              ref={sourceEditorRef}
              className={`source-editor ${activeVisualSourceDraft ? "visual-source-draft" : ""}`.trim()}
              value={editorSource}
              onChange={(event) => updateSource(event.target.value, {
                start: event.currentTarget.selectionStart,
                end: event.currentTarget.selectionEnd,
              })}
              onSelect={captureSourceSelection}
              onScroll={(event) => {
                if (gutterRef.current) gutterRef.current.scrollTop = event.currentTarget.scrollTop;
                if (sourceDraftMirrorRef.current) {
                  sourceDraftMirrorRef.current.scrollTop = event.currentTarget.scrollTop;
                  sourceDraftMirrorRef.current.scrollLeft = event.currentTarget.scrollLeft;
                }
              }}
              spellCheck={false}
              readOnly={Boolean(activeVisualSourceDraft)}
              disabled={visualEditState !== "idle" || Boolean(pendingDocumentStructure)}
              aria-busy={visualEditState !== "idle" || Boolean(pendingDocumentStructure)}
              aria-readonly={Boolean(activeVisualSourceDraft)}
              aria-label={activeVisualSourceDraft ? ui.syncedDraftSource(selectedArtifact.name) : ui.editSource(selectedArtifact.name)}
            />
            {activeVisualSourceDraft && (
              <pre ref={sourceDraftMirrorRef} className="source-draft-mirror" aria-hidden="true">
                {editorSource.slice(0, activeVisualSourceDraft.start)}
                <mark>{editorSource.slice(activeVisualSourceDraft.start, activeVisualSourceDraft.end) || "\u200b"}</mark>
                {editorSource.slice(activeVisualSourceDraft.end)}
              </pre>
            )}
          </div>

          <div className="agent-dock">
            {pendingChange && (
              <div className="patch-card">
                <div className="patch-icon"><History aria-hidden="true" /></div>
                <div className="patch-copy">
                  <span className="overline">{ui.proposedChange(pendingChange.scope === "workspace" ? "workspace" : pendingChange.scope === "selection" ? "selection" : "file")} · {pendingChange.provider === "openai" ? ui.typedOperations(pendingOperationCount) : ui.localPlan}{pendingChange.runtimeRepair ? ` · ${ui.repairedOnce}` : ""}</span>
                  <strong>{pendingChange.summary}</strong>
                  <p>{pendingChange.detail}</p>
                  {pendingChange.runtimeRepair && (
                    <div className="runtime-repair" aria-label={ui.repairPassed}>
                      <RefreshCw aria-hidden="true" />
                      <span>
                        <strong>{ui.recovered}</strong>
                        <small>{ui.firstUnapplied} · {pendingChange.runtimeRepair.failure}</small>
                      </span>
                    </div>
                  )}
                  {pendingChange.runtimePreflight && (
                    <div className="runtime-preflight" aria-label={ui.runtimePassed}>
                      <CheckCircle2 aria-hidden="true" />
                      <span>
                        <strong>{ui.runtimePassed}</strong>
                        <small>{pendingChange.runtimePreflight.dataCount > 0 ? `${pendingChange.runtimePreflight.dataCount} proposed Data ${pendingChange.runtimePreflight.dataCount === 1 ? "source" : "sources"} · ` : ""}{pendingChange.runtimePreflight.queryCount > 0 ? `${pendingChange.runtimePreflight.queryCount} impacted ${pendingChange.runtimePreflight.queryCount === 1 ? "Query" : "Queries"} executed locally` : "no SQL execution required"} · {pendingChange.runtimePreflight.legacyMetricConsumerCount} legacy metric {pendingChange.runtimePreflight.legacyMetricConsumerCount === 1 ? "consumer" : "consumers"} · {pendingChange.runtimePreflight.scalarConsumerCount} SQL scalar {pendingChange.runtimePreflight.scalarConsumerCount === 1 ? "consumer" : "consumers"} · {pendingChange.runtimePreflight.chartConsumerCount} {pendingChange.runtimePreflight.chartConsumerCount === 1 ? "chart" : "charts"} · {[...pendingChange.runtimePreflight.dataNames, ...pendingChange.runtimePreflight.queryNames].join(", ")}</small>
                      </span>
                    </div>
                  )}
                  {pendingTransactionReview && !pendingTransactionReview.errors.length && (
                    <TransactionReviewMap
                      review={pendingTransactionReview}
                      activeArtifactId={selectedPendingStat?.artifact.id ?? ""}
                      locale={locale}
                      onSelect={setPendingReviewId}
                    />
                  )}
                  <div className="diff-summary"><span>{ui.changedFiles(pendingStats.length)}</span><span className="additions">+{pendingTotals.additions}</span><span className="removals">−{pendingTotals.removals}</span><span>{ui.changedLines}</span></div>
                  <div className="patch-file-list" aria-label={ui.filesInPatch}>
                    {pendingStats.map(({ artifact, patch, additions, removals, isCreation }) => (
                      <button
                        key={artifact.id}
                        className={`patch-file-row ${artifact.id === selectedPendingStat?.artifact.id ? "active" : ""}`}
                        onClick={() => setPendingReviewId(artifact.id)}
                        aria-label={ui.reviewArtifact(artifact.name)}
                      >
                        <span className={`artifact-icon ${artifact.kind}`}><ArtifactIcon kind={artifact.kind} size={13} /></span>
                        <span className="patch-file-label"><strong>{artifact.name}{isCreation && <em className="new-file-badge">{ui.newFile}</em>}</strong><small>{patch.summary}{patch.operationCount ? ` · ${ui.typedOps(patch.operationCount)}` : ""}</small></span>
                        <span className="patch-file-diff"><b>+{additions}</b><i>−{removals}</i></span>
                      </button>
                    ))}
                  </div>
                  {selectedPendingStat ? (
                    <div className="patch-source-diff" aria-label={ui.sourceDiffFor(selectedPendingStat.artifact.name)}>
                      <div className="patch-source-diff-header"><span>{selectedPendingStat.isCreation ? ui.newSourceDiff : ui.sourceDiff}</span><strong>{selectedPendingStat.artifact.name}</strong></div>
                      <pre>{selectedDiffPreview.map((line, index) => (
                        <code className={line.kind} key={`${line.kind}-${index}`}><span>{line.kind === "addition" ? "+" : line.kind === "removal" ? "−" : " "}</span>{line.text || " "}</code>
                      ))}</pre>
                    </div>
                  ) : (
                    <p className="patch-review-hint">{ui.selectChangedFile}</p>
                  )}
                </div>
                <div className="patch-actions">
                  <button className="button primary-button" onClick={applyPendingChange}><Check aria-hidden="true" /> {pendingStats.length > 1 ? ui.applyAll : ui.apply}</button>
                  <button className="icon-button small" onClick={discardPendingChange} aria-label={ui.discardPatch} title={ui.discard}><X /></button>
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
                placeholder={agentScope === "workspace" ? ui.askWorkspace : agentScope === "selection" ? ui.askSelection : ui.askFile}
                rows={1}
                aria-label={agentScope === "workspace" ? ui.describeWorkspaceChange : agentScope === "selection" ? ui.describeSelectionChange : ui.describeArtifactChange}
              />
              <button className="run-button" onClick={() => void runAgent()} disabled={!prompt.trim() || agentState === "planning" || visualEditState !== "idle" || Boolean(activeVisualSourceDraft) || (agentScope === "selection" && !validSourceSelection)} aria-label={ui.planChange} title={`${ui.planChange} (⌘ Enter)`}>{agentState === "planning" || visualEditState !== "idle" ? <LoaderCircle className="agent-spinner" /> : <Play />}</button>
            </div>
            <div className="agent-context-row">
              <div className="agent-scope-switch" role="group" aria-label={ui.agentScope}>
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
                    disabled={agentState === "planning" || visualEditState !== "idle" || Boolean(activeVisualSourceDraft) || (scope === "selection" && !validSourceSelection)}
                    aria-pressed={agentScope === scope}
                  >
                    {scope === "selection" ? ui.selection : scope === "artifact" ? ui.file : ui.workspaceScope}
                  </button>
                ))}
              </div>
              <details className="agent-suggestions">
                <summary><Sparkles aria-hidden="true" /><span>{ui.suggestedActions}</span><ChevronDown aria-hidden="true" /></summary>
                <div className="quick-commands" aria-label={ui.suggestedActions}>
                  {runeQuickCommands(locale, agentScope, selectedArtifact.kind).map((command) => (
                    <button key={command} onClick={() => void runAgent(command)} disabled={agentState === "planning" || visualEditState !== "idle" || Boolean(activeVisualSourceDraft)}>{command}</button>
                  ))}
                </div>
                {agentScope === "workspace" && workspaceAgentQueryCount > 0 && (
                  <p className="agent-evidence-hint">{ui.queryEvidence(workspaceAgentQueryCount)}</p>
                )}
              </details>
              <span className={`local-planner-badge ${agentMode}`}>{agentMode === "openai" ? ui.modelConnected : ui.localFallback}</span>
              <p className="agent-hint">{ui.planHint}</p>
            </div>
          </div>
        </section>

        <div
          className="workspace-splitter"
          role="separator"
          aria-orientation="vertical"
          aria-label={ui.resizeWorkspace}
          aria-valuemin={35}
          aria-valuemax={65}
          aria-valuenow={Math.round(workspaceSourcePercent)}
          aria-valuetext={workspaceSplitValueLabel(locale, Math.round(workspaceSourcePercent))}
          tabIndex={0}
          title={`${ui.resizeWorkspace} · ${ui.resetWorkspaceSplit}`}
          onPointerDown={resizeWorkspaceFromPointer}
          onKeyDown={resizeWorkspaceFromKeyboard}
          onDoubleClick={() => setPreferredWorkspaceSplit(DEFAULT_WORKSPACE_SOURCE_PERCENT)}
        ><span aria-hidden="true" /></div>

        <section className="preview-pane" aria-label={ui.preview}>
          <header className="pane-header preview-header">
            <div className="pane-title">
              <span className="preview-mark"><FileCode2 aria-hidden="true" /></span>
              <div><span className="overline">{ui.output}</span><strong>{ui.livePreview}</strong></div>
            </div>
            <div className="preview-actions">
              <div className="workspace-view-switch" role="group" aria-label={ui.workspaceView}>
                <button type="button" className={workspaceView === "split" ? "active" : ""} aria-pressed={workspaceView === "split"} aria-label={ui.showSplitView} aria-keyshortcuts="Meta+Alt+1 Control+Alt+1" title={`${ui.showSplitView} · ⌘⌥1 / Ctrl Alt 1`} onClick={() => setPreferredWorkspaceView("split")}><Columns2 aria-hidden="true" /><span>{ui.splitView}</span></button>
                <button type="button" className={workspaceView === "source" ? "active" : ""} aria-pressed={workspaceView === "source"} aria-label={ui.showSourceView} aria-keyshortcuts="Meta+Alt+2 Control+Alt+2" title={`${ui.showSourceView} · ⌘⌥2 / Ctrl Alt 2`} onClick={() => setPreferredWorkspaceView("source")}><Code2 aria-hidden="true" /><span>{ui.sourceView}</span></button>
                <button type="button" className={workspaceView === "preview" ? "active" : ""} aria-pressed={workspaceView === "preview"} aria-label={ui.showPreviewView} aria-keyshortcuts="Meta+Alt+3 Control+Alt+3" title={`${ui.showPreviewView} · ⌘⌥3 / Ctrl Alt 3`} onClick={() => setPreferredWorkspaceView("preview")}><Eye aria-hidden="true" /><span>{ui.previewView}</span></button>
              </div>
              <details className="preview-evidence">
                <summary aria-label={ui.previewDetails} title={ui.previewDetailsBody}>
                  {validationErrors.length ? (
                    <span className="validation-badge error"><X aria-hidden="true" /> {ui.issues(validationErrors.length)}</span>
                  ) : (
                    <span className="validation-badge"><CheckCircle2 aria-hidden="true" /> {ui.valid}</span>
                  )}
                  <ChevronDown className="preview-evidence-chevron" aria-hidden="true" />
                </summary>
                <div className="preview-evidence-popover">
                  <header><span className="overline">{ui.previewDetails}</span><strong>{ui.previewDetailsBody}</strong></header>
                  <div className="preview-evidence-badges">
                    {activePreviewTarget && (
                      <span className="source-link-badge" title={ui.sourceLinked(activePreviewTarget.label)}>
                        <CircleDot aria-hidden="true" /><span>{activePreviewTarget.label}</span>
                      </span>
                    )}
                    {selectedArtifact.kind === "query" && selectedQueryDataArtifact && <span className="binding-badge query"><Database aria-hidden="true" /> {ui.oneSource}</span>}
                    {selectedArtifact.kind === "chart" && selectedChartSourceArtifact && !selectedChartBindingErrors.length && <span className="binding-badge chart">{selectedChartSourceArtifact.kind === "query" ? <Database aria-hidden="true" /> : <TableProperties aria-hidden="true" />} {ui.oneSource}</span>}
                    {!!bindingState?.queryMetricReferences.length && <span className="binding-badge query"><Database aria-hidden="true" /> {ui.sqlMetricBadge(bindingState.queryMetricReferences.length)}</span>}
                    {!!bindingState?.chartReferences.length && <span className="binding-badge chart"><BarChart3 aria-hidden="true" /> {ui.chartBadge(bindingState.chartReferences.length)}</span>}
                    {!!bindingState?.references.length && <span className="binding-badge"><Link2 aria-hidden="true" /> {ui.liveBadge(bindingState.references.length)}</span>}
                    {validationErrors.length ? (
                      <span className="validation-badge error"><X aria-hidden="true" /> {ui.issues(validationErrors.length)}</span>
                    ) : (
                      <span className="validation-badge"><CheckCircle2 aria-hidden="true" /> {ui.valid}</span>
                    )}
                  </div>
                  <div className="preview-evidence-lineage">
                    {selectedArtifact.kind === "chart" && selectedChartSourceArtifact && !selectedChartBindingErrors.length && (
                      <div className="lineage-strip chart-lineage">
                        {selectedChartSourceArtifact.kind === "query" ? <Database aria-hidden="true" /> : <TableProperties aria-hidden="true" />}
                        <span>{selectedChartSourceArtifact.name}</span>
                        <ChevronRight aria-hidden="true" />
                        <span>{selectedArtifact.name}</span>
                        <strong>{selectedChartSourceArtifact.kind === "query" ? ui.browserQueryOutput : ui.canonicalDataLive}</strong>
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
                        <strong>{selectedQueryDataResolution?.explicit ? ui.explicitDataBinding : ui.legacyDataBinding}</strong>
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
                        <strong>{ui.scalarMetricsFromSql(bindingState.queryMetricReferences.length)}</strong>
                      </div>
                    )}
                    {!!bindingState?.references.length && (
                      <div className="lineage-strip">
                        <Database aria-hidden="true" />
                        <span>{canonicalDataArtifact?.name ?? ui.workspaceData}</span>
                        <ChevronRight aria-hidden="true" />
                        <span>{selectedArtifact.name}</span>
                        <strong>{ui.metricsCompiledLive(bindingState.references.length)}</strong>
                      </div>
                    )}
                    {!!bindingState?.chartReferences.length && (
                      <div className="lineage-strip chart-lineage">
                        <BarChart3 aria-hidden="true" />
                        <span>{bindingState.chartReferences.map((id) => artifacts.find((artifact) => artifact.id === id)?.name ?? id).join(", ")}</span>
                        <ChevronRight aria-hidden="true" />
                        <span>{selectedArtifact.name}</span>
                        <strong>{ui.chartsCompiledLive(bindingState.chartReferences.length)}</strong>
                      </div>
                    )}
                  </div>
                </div>
              </details>
            </div>
          </header>
          <div className="preview-body">
            <div className="preview-scroll" ref={previewScrollRef}>
              <ArtifactPreview
                artifact={selectedArtifact}
                artifacts={artifacts}
                locale={locale}
                activeSelection={activePreviewTarget}
                onTargetSource={focusPreviewTarget}
                onEditDataCell={visualEditState === "idle" ? commitVisualDataCellEdit : undefined}
                onEditDocumentSection={visualEditState === "idle" ? commitVisualDocumentSectionEdit : undefined}
                onEditDocumentBlock={visualEditState === "idle" ? commitVisualDocumentBlockEdit : undefined}
                onReviewDocumentBlockStructure={visualEditState === "idle" && !pendingDocumentStructure ? reviewVisualDocumentBlockStructure : undefined}
                onEditDeckSlide={visualEditState === "idle" ? commitVisualDeckSlideEdit : undefined}
                onEditChartSpec={visualEditState === "idle" ? commitVisualChartSpecEdit : undefined}
                onVisualSourceDraftChange={handleVisualSourceDraftChange}
                resolveLocalAssetUrl={resolveLocalAssetUrl}
              />
            </div>
          </div>
        </section>
          </>
        )}
      </div>

      <footer className="statusbar">
        <div><span className="status-agent-dot" /> {visibleNotice}</div>
        <div className="statusbar-right"><span>{artifactStats(selectedArtifact)}</span></div>
      </footer>

      {newArtifactOpen && (
        <NewArtifactDialog
          artifacts={artifacts}
          error={newArtifactError}
          locale={locale}
          onCancel={() => {
            setNewArtifactOpen(false);
            setNewArtifactError("");
            setNotice(ui.newCancelled);
          }}
          onCreate={createNewArtifact}
        />
      )}
      {operatingReviewOpen && (
        <OperatingReviewDialog
          key={editingOperatingReviewId || "new-operating-review"}
          artifacts={artifacts}
          locale={locale}
          error={operatingReviewError}
          initialInput={savedOperatingReviews.find((workflow) => workflow.id === editingOperatingReviewId)?.input}
          onCancel={() => {
            if (operatingReviewState !== "idle") return;
            setOperatingReviewOpen(false);
            setOperatingReviewError("");
            setEditingOperatingReviewId("");
            setNotice(runeText(locale, "Operating review cancelled — the workspace is unchanged", "已取消经营汇报 — 工作区保持不变"));
          }}
          onPrepare={prepareOperatingReview}
        />
      )}
      {pendingImport && (
        <ImportReviewDialog
          sourceName={pendingImport.sourceName}
          artifacts={pendingImport.importedArtifacts}
          warnings={pendingImport.warnings}
          error={importError}
          locale={locale}
          onCancel={cancelPendingImport}
          onConfirm={applyPendingImport}
        />
      )}
      {pendingPdfOcr && (
        <PdfOcrSetupDialog
          key={pendingPdfOcr.candidates.map((candidate) => `${candidate.fileIndex}:${candidate.analysis.ocrCandidatePageNumbers.join(",")}`).join("|")}
          candidates={pendingPdfOcr.candidates}
          locale={locale}
          processing={pdfOcrProcessing}
          progress={pdfOcrProgress}
          activeFileName={pdfOcrActiveFileName}
          error={pdfOcrError}
          onCancel={cancelPendingPdfOcr}
          onRecognize={(selections) => void recognizePendingPdfPages(selections)}
        />
      )}
      {pendingExport && (
        <ExportReviewDialog
          sourceName={pendingExport.sourceArtifactName}
          result={pendingExport.result}
          error={exportError}
          locale={locale}
          onCancel={cancelExport}
          onConfirm={confirmExport}
        />
      )}
      {pendingDocumentStructure && (
        <DocumentStructureReviewDialog
          artifactName={pendingDocumentStructure.targetArtifact.name}
          targetLabel={pendingDocumentStructure.target.label}
          action={pendingDocumentStructure.input.action}
          beforeSource={pendingDocumentStructure.targetArtifact.source}
          nextSource={pendingDocumentStructure.prepared.nextSource}
          warnings={pendingDocumentStructure.prepared.warnings}
          error={pendingDocumentStructure.error}
          submitting={pendingDocumentStructure.submitting}
          locale={locale}
          onCancel={() => {
            if (pendingDocumentStructure.submitting) return;
            setPendingDocumentStructure(null);
            setNotice(ui.structureCancelled);
          }}
          onConfirm={() => void confirmVisualDocumentBlockStructure()}
        />
      )}
      {pendingLocalImage && (
        <LocalImageReviewDialog
          asset={pendingLocalImage.asset}
          artifactName={pendingLocalImage.artifact.name}
          insertion={pendingLocalImage.insertion}
          alt={pendingLocalImage.alt}
          error={pendingLocalImage.error}
          submitting={pendingLocalImage.submitting}
          locale={locale}
          onAltChange={updatePendingLocalImageAlt}
          onCancel={cancelPendingLocalImage}
          onConfirm={() => void confirmPendingLocalImage()}
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
