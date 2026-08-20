"use client";

import {
  BarChart3,
  BookOpen,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  CircleAlert,
  CircleDot,
  ClipboardList,
  Code2,
  Database,
  Download,
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
  Search,
  RefreshCw,
  Save,
  Settings,
  TableProperties,
  Undo2,
  Upload,
  X,
} from "lucide-react";
import {
  ChangeEvent,
  KeyboardEvent,
  lazy,
  Suspense,
  SyntheticEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import {
  ArtifactPreview,
  type ChartSpecEditHandler,
  type DataCellEditHandler,
  type DeckSlideEditHandler,
  type DocumentBlockEditHandler,
  type DocumentBlockStructureReviewHandler,
  type DocumentSectionEditHandler,
  type SemanticHtmlEditableCopyHandler,
  type VisualSourceDraft,
} from "./artifact-previews";
import { AgentComposer, type AgentScope } from "./agent-composer";
import { WorkbenchActivityRail } from "./workbench-activity-rail";
import { WorkbenchStatusBar } from "./workbench-statusbar";
import { EmptyWorkspace } from "./empty-workspace";
import { WorkspaceSplitter, WorkspaceViewSwitch } from "./workspace-frame-controls";
import type { PdfOcrCandidate, PdfOcrSelection } from "./pdf-ocr-setup-dialog";
import type { WelcomeAction, WelcomeStep } from "./welcome-experience";
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
import { prepareArtifactDiagnostics } from "../lib/artifact-diagnostics";
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
import { isDeckMarkdownArtifact, parseDeckSource } from "../lib/deck";
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
import { prepareWorkspaceProposalPreview } from "../lib/proposal-preview";
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
import { observeWorkspaceDirectory } from "../lib/directory-observer";
import type { ArtifactExportResult } from "../lib/export-contract";
import { prepareRunePilotEvidenceExport, type RunePilotEvidenceExport } from "../lib/pilot-evidence";
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
  derivePreviewSourceTargets,
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
  loadRuneLocaleCatalog,
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
import { normalizeRuneModelMode, RUNE_MODEL_MODE_STORAGE_KEY, type RuneModelMode } from "../lib/model-preference";
import {
  normalizeRuneAppearanceTheme,
  RUNE_APPEARANCE_STORAGE_KEY,
  RUNE_APPEARANCE_THEMES,
  type RuneAppearanceTheme,
} from "../lib/appearance";
import { RUNE_PRODUCT_VERSION } from "../lib/product-meta";
import {
  deferredSurfaceCopy,
  documentBriefingNoticeCopy,
  localImageActionCopy,
  operatingReviewNoticeCopy,
  pilotEvidenceNoticeCopy,
} from "../lib/workbench-surface-copy";
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
import { sourceSelectionScrollTop } from "../lib/source-editor-scroll";
import {
  prepareSourceNavigation,
  selectPreviewNavigationCandidate,
  type PreparedSourceNavigation,
} from "../lib/source-navigation";
import { portableSourceRevision } from "../lib/source-revision";
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
  createSavedOperatingReview,
  MAX_SAVED_OPERATING_REVIEWS,
  normalizeSavedOperatingReviews,
  prepareSavedOperatingReviewRerun,
  type OperatingReviewInput,
  type OperatingReviewNarrative,
  type SavedOperatingReview,
} from "../lib/operating-review";
import {
  documentBriefingSourceIdForPresentation,
  documentBriefingTargets,
  type DocumentBriefingInput,
} from "../lib/document-briefing";
import { prepareRuneTaskProvider } from "../lib/task-providers";
import { prepareRuneTaskModelAssistance } from "../lib/task-model-planning";
import {
  createRuneWorkbenchCommands,
  runeCommandMenuCopy,
  type RuneWorkbenchCommandId,
} from "../lib/workbench-commands";
import {
  EMPTY_RUNE_TASK_EVIDENCE,
  MAX_RUNE_TASK_DURATION_MS,
  appendRuneTaskRun,
  normalizeRuneTaskEvidence,
  recordRuneTaskDelivery,
  runeTaskRunsForIdentity,
  summarizeRuneTaskDeliveries,
  summarizeRuneTaskRuns,
  type RuneTaskDeliveryConfirmation,
  type RuneTaskDeliveryMethod,
  type RuneTaskDeliveryTarget,
  type RuneTaskEvidence,
  type RuneTaskRun,
  type RuneTaskStopReason,
} from "../lib/task-evidence";
import {
  bindRuneTaskImportReview,
  prepareRuneTaskAfterImport,
  RUNE_TASK_DEFINITIONS,
  startRuneTaskFromArtifact,
  startRuneTaskSession,
  type RuneTaskId,
  type RuneTaskSession,
} from "../lib/task-runtime";
import {
  convertLegacyOfficeFile,
  legacyOfficeFileName,
  MAX_LEGACY_OFFICE_IMPORT_BYTES,
  supportsLegacyOfficeDesktopExport,
} from "../lib/desktop-bridge";

const DocumentStructureReviewDialog = lazy(() =>
  import("./document-structure-review-dialog").then((module) => ({ default: module.DocumentStructureReviewDialog })),
);
const DeliveryOutcomeDialog = lazy(() =>
  import("./delivery-outcome-dialog").then((module) => ({ default: module.DeliveryOutcomeDialog })),
);
const DocumentBriefingDialog = lazy(() =>
  import("./document-briefing-dialog").then((module) => ({ default: module.DocumentBriefingDialog })),
);
const LocalImageReviewDialog = lazy(() =>
  import("./local-image-review-dialog").then((module) => ({ default: module.LocalImageReviewDialog })),
);
const ExportReviewDialog = lazy(() =>
  import("./export-review-dialog").then((module) => ({ default: module.ExportReviewDialog })),
);
const ImportReviewDialog = lazy(() =>
  import("./import-review-dialog").then((module) => ({ default: module.ImportReviewDialog })),
);
const NewArtifactDialog = lazy(() =>
  import("./new-artifact-dialog").then((module) => ({ default: module.NewArtifactDialog })),
);
const OperatingReviewDialog = lazy(() =>
  import("./operating-review-dialog").then((module) => ({ default: module.OperatingReviewDialog })),
);
const PilotEvidenceReviewDialog = lazy(() =>
  import("./pilot-evidence-review-dialog").then((module) => ({ default: module.PilotEvidenceReviewDialog })),
);
const WorkbenchCommandMenu = lazy(() =>
  import("./workbench-command-menu").then((module) => ({ default: module.WorkbenchCommandMenu })),
);
const PdfOcrSetupDialog = lazy(() =>
  import("./pdf-ocr-setup-dialog").then((module) => ({ default: module.PdfOcrSetupDialog })),
);
const TransactionReviewMap = lazy(() =>
  import("./transaction-review-map").then((module) => ({ default: module.TransactionReviewMap })),
);
const WelcomeExperience = lazy(() =>
  import("./welcome-experience").then((module) => ({ default: module.WelcomeExperience })),
);

function DeferredWorkbenchSurfaceFallback({
  locale,
  variant = "overlay",
}: {
  locale: RuneLocale;
  variant?: "inline" | "overlay" | "welcome";
}) {
  const copy = deferredSurfaceCopy(locale);
  const className =
    variant === "inline"
      ? "deferred-surface-inline"
      : variant === "welcome"
        ? "welcome-backdrop deferred-surface-backdrop deferred-surface-welcome"
        : "deferred-surface-backdrop";
  return (
    <div className={className} role="status" aria-live="polite" aria-atomic="true">
      <div className="deferred-surface-status">
        <span className="deferred-surface-mark" aria-hidden="true">
          R
        </span>
        <strong>{copy.preparing}</strong>
        <i aria-hidden="true" />
      </div>
    </div>
  );
}

const STORAGE_KEY = "rune-workspace-v0";
const MAX_SOURCE_IMPORT_BYTES = 2 * 1024 * 1024;
const MAX_OFFICE_IMPORT_BYTES = 12 * 1024 * 1024;
const MAX_PDF_IMPORT_BYTES = 12 * 1024 * 1024;
const OFFICE_IMPORT_PATTERN = /\.(?:docx|xlsx|pptx)$/i;
const ODF_IMPORT_PATTERN = /\.(?:odt|ods|odp)$/i;
const PDF_IMPORT_PATTERN = /\.pdf$/i;

async function importLegacyOfficeThroughDesktop(file: File) {
  const converted = await convertLegacyOfficeFile(file);
  const { convertOfficeFileWithAssets } = await import("../lib/office-import");
  const result = await convertOfficeFileWithAssets(converted.fileName, converted.bytes);
  return {
    ...result,
    warnings: [converted.warning, ...result.warnings],
  };
}

async function preflightRuntimeMutation(
  artifacts: WorkspaceArtifact[],
  patches: ArtifactSourcePatch[],
  creations: ArtifactCreationChange[],
) {
  const changesRuntimeSource =
    patches.some((patch) =>
      ["data", "query", "chart"].includes(artifacts.find((artifact) => artifact.id === patch.artifactId)?.kind ?? ""),
    ) || creations.some((creation) => ["data", "query", "chart"].includes(creation.artifact.kind));
  if (!changesRuntimeSource) return undefined;
  const { preflightAgentRuntimeImpact } = await import("../lib/query-preflight");
  let queryRuntime: Promise<typeof import("../lib/duckdb-client")> | null = null;
  return (
    (await preflightAgentRuntimeImpact(artifacts, patches, creations, async (queryArtifact, dataArtifact) => {
      queryRuntime ??= import("../lib/duckdb-client");
      const { runWorkspaceQuerySnapshot } = await queryRuntime;
      return runWorkspaceQuerySnapshot(queryArtifact, dataArtifact);
    })) ?? undefined
  );
}

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
  planningKind?: "task-outline" | "task-narrative";
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
  taskRun?: {
    taskId: RuneTaskId;
    sourceArtifactId: string;
    outputArtifactIds: string[];
  };
  preparedAt?: number;
  usage?: { inputTokens: number | null; outputTokens: number | null };
};

type PendingPdfOcr = {
  files: File[];
  baseArtifacts: WorkspaceArtifact[];
  sourceName: string;
  candidates: PdfOcrCandidate[];
  taskSession?: RuneTaskSession;
};

type PendingExport = {
  sourceArtifactId: string;
  sourceArtifactName: string;
  sourceRevision: string;
  baseArtifacts: WorkspaceArtifact[];
  result: ArtifactExportResult;
};

type PendingPilotEvidence = {
  baseEvidence: RuneTaskEvidence;
  result: RunePilotEvidenceExport;
};

type PendingDeliveryConfirmation = {
  runId: string;
  workflowTitle: string;
  taskSourceArtifactId: string;
  artifactId: string;
  artifactName: string;
  sourceRevision: string;
  method: RuneTaskDeliveryMethod;
  target: RuneTaskDeliveryTarget;
  handoffLabel: string;
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
  const token = (candidate: unknown) =>
    Number.isInteger(candidate) && Number(candidate) >= 0 ? Number(candidate) : null;
  return { inputTokens: token(value?.inputTokens), outputTokens: token(value?.outputTokens) };
}

function isRemoteSinglePlan(value: unknown): value is RemoteSinglePlan {
  return Boolean(
    value &&
    typeof value === "object" &&
    typeof (value as RemoteSinglePlan).nextSource === "string" &&
    typeof (value as RemoteSinglePlan).summary === "string" &&
    typeof (value as RemoteSinglePlan).detail === "string" &&
    Number.isInteger((value as RemoteSinglePlan).operationCount) &&
    (value as RemoteSinglePlan).operationCount > 0,
  );
}

function isRemoteWorkspacePlan(value: unknown): value is RemoteWorkspacePlan {
  if (!value || typeof value !== "object") return false;
  const plan = value as RemoteWorkspacePlan;
  const patchesValid =
    Array.isArray(plan.patches) &&
    plan.patches.every(
      (patch) =>
        typeof patch.artifactId === "string" &&
        typeof patch.nextSource === "string" &&
        typeof patch.summary === "string" &&
        typeof patch.detail === "string" &&
        Number.isInteger(patch.operationCount) &&
        patch.operationCount > 0,
    );
  const creationsValid =
    Array.isArray(plan.creations) &&
    plan.creations.every((creation) => {
      const artifact = creation.artifact;
      return (
        Boolean(artifact) &&
        typeof artifact.id === "string" &&
        typeof artifact.name === "string" &&
        ["document", "data", "query", "chart", "slides"].includes(artifact.kind) &&
        typeof artifact.language === "string" &&
        typeof artifact.source === "string" &&
        typeof creation.summary === "string" &&
        typeof creation.detail === "string" &&
        Number.isInteger(creation.operationCount) &&
        creation.operationCount >= 0 &&
        creation.operationCount <= 8
      );
    });
  const actionCount = (plan.patches?.length ?? 0) + (plan.creations?.length ?? 0);
  return (
    typeof plan.summary === "string" &&
    typeof plan.detail === "string" &&
    patchesValid &&
    creationsValid &&
    actionCount > 0 &&
    actionCount <= 4
  );
}

function ArtifactIcon({ kind, size = 16 }: { kind: ArtifactKind; size?: number }) {
  if (kind === "document") return <FileText size={size} aria-hidden="true" />;
  if (kind === "data") return <TableProperties size={size} aria-hidden="true" />;
  if (kind === "query") return <Database size={size} aria-hidden="true" />;
  if (kind === "chart") return <BarChart3 size={size} aria-hidden="true" />;
  return <Presentation size={size} aria-hidden="true" />;
}

function DependencyKindIcon({ kind }: { kind: WorkspaceDependencyKind }) {
  if (kind === "deck-origin") return <FileText aria-hidden="true" />;
  if (kind === "query" || kind === "query-metric") return <Database aria-hidden="true" />;
  if (kind === "chart-data" || kind === "chart-query" || kind === "chart-embed")
    return <BarChart3 aria-hidden="true" />;
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
        <div>
          <span className="overline">{copy.liveContext}</span>
          <strong>{copy.dependencyGraphTitle}</strong>
        </div>
        <span className="dependency-count" aria-label={copy.dependencyEdges(graph.edges.length)}>
          {graph.edges.length}
        </span>
      </div>
      <section className="graph-context-card" aria-label={copy.agentContextPack}>
        <div className="graph-context-heading">
          <span>{copy.agentContext}</span>
          <span>
            <strong>
              {contextArtifacts.length} / {artifacts.length}
            </strong>
            {pinnedArtifactIds.length > 0 && (
              <button type="button" onClick={onClearPins}>
                {copy.clearPins}
              </button>
            )}
          </span>
        </div>
        <p>{copy.contextExplanation}</p>
        <nav aria-label={copy.artifactsInContext}>
          {contextArtifacts.map((artifact) => (
            <button
              type="button"
              key={artifact.id}
              className={
                `${artifact.id === selectedArtifactId ? "active" : ""} ${pinnedIds.has(artifact.id) ? "pinned" : ""}`.trim() ||
                undefined
              }
              onClick={() => onSelect(artifact.id)}
              aria-current={artifact.id === selectedArtifactId ? "page" : undefined}
              aria-label={copy.openContextArtifact(artifact.name, pinnedIds.has(artifact.id))}
            >
              <span className={`artifact-icon ${artifact.kind}`}>
                <ArtifactIcon kind={artifact.kind} size={11} />
              </span>
              <span>{artifact.name}</span>
              {pinnedIds.has(artifact.id) && <Pin className="context-pin-marker" aria-hidden="true" />}
            </button>
          ))}
        </nav>
      </section>
      <div className="artifact-group-label">
        <span>{copy.sourceToConsumer}</span>
        <span>{graph.edges.length}</span>
      </div>
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
              <button
                type="button"
                className="dependency-endpoint"
                onClick={() => onSelect(source.id)}
                aria-label={copy.openDependencySource(source.name)}
              >
                <span className={`artifact-icon ${source.kind}`}>
                  <ArtifactIcon kind={source.kind} size={11} />
                </span>
                <span>{source.name}</span>
              </button>
              <div className={`dependency-relation ${edge.kind}`} title={edge.references.join(", ")}>
                <DependencyKindIcon kind={edge.kind} />
                <span>{edge.label}</span>
                <ChevronRight aria-hidden="true" />
              </div>
              <button
                type="button"
                className="dependency-endpoint"
                onClick={() => onSelect(consumer.id)}
                aria-label={copy.openDependencyConsumer(consumer.name)}
              >
                <span className={`artifact-icon ${consumer.kind}`}>
                  <ArtifactIcon kind={consumer.kind} size={11} />
                </span>
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
              <button
                type="button"
                key={`${issue.artifactId}-${issue.kind}-${issue.target}`}
                onClick={() => onSelect(issue.artifactId)}
              >
                <X aria-hidden="true" />
                <span>{artifact?.name ?? issue.artifactId}</span>
                <small>{issue.message}</small>
              </button>
            );
          })}
        </section>
      )}
      {!!unlinkedArtifacts.length && (
        <section className="unlinked-artifacts" aria-label={copy.unlinkedArtifacts}>
          <span className="overline">{copy.unlinked}</span>
          <div>
            {unlinkedArtifacts.map((artifact) => (
              <button type="button" key={artifact.id} onClick={() => onSelect(artifact.id)}>
                {artifact.name}
              </button>
            ))}
          </div>
        </section>
      )}
      <div className="file-rail-spacer" />
      <div className="workspace-note graph-note">
        <Database aria-hidden="true" />
        <div>
          <strong>{copy.noHiddenGraph}</strong>
          <span>{copy.graphRecompiles}</span>
        </div>
      </div>
    </aside>
  );
}

function officeExportType(artifact: WorkspaceArtifact): "DOCX" | "XLSX" | "PPTX" | null {
  if (artifact.kind === "document") return "DOCX";
  if (artifact.kind === "data") return "XLSX";
  if (artifact.kind === "slides") return "PPTX";
  return null;
}

function legacyOfficeExportType(artifact: WorkspaceArtifact): "DOC" | "PPT" | null {
  if (artifact.kind === "document") return "DOC";
  if (artifact.kind === "slides") return "PPT";
  return null;
}

function odfExportType(artifact: WorkspaceArtifact): "ODT" | "ODS" | "ODP" | null {
  if (artifact.kind === "document") return "ODT";
  if (artifact.kind === "data") return "ODS";
  if (artifact.kind === "slides") return "ODP";
  return null;
}

function getDiffStats(before: string, after: string) {
  const beforeLines = new Set(before.split("\n"));
  const afterLines = new Set(after.split("\n"));
  let additions = 0;
  let removals = 0;
  afterLines.forEach((line) => {
    if (!beforeLines.has(line)) additions += 1;
  });
  beforeLines.forEach((line) => {
    if (!afterLines.has(line)) removals += 1;
  });
  return { additions, removals };
}

function checkpointTime(createdAt: string, locale: RuneLocale) {
  return new Intl.DateTimeFormat(locale, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }).format(
    new Date(createdAt),
  );
}

function persistDeviceWorkspace(
  artifacts: WorkspaceArtifact[],
  selectedId: string,
  checkpoints: CheckpointMap,
  savedOperatingReviews: SavedOperatingReview[],
  taskEvidence: RuneTaskEvidence,
) {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({ artifacts, selectedId, checkpoints, savedOperatingReviews, taskEvidence }),
  );
}

function downloadArtifact(artifact: WorkspaceArtifact) {
  const mime =
    artifact.kind === "document"
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
  const [documentBriefingOpen, setDocumentBriefingOpen] = useState(false);
  const [documentBriefingError, setDocumentBriefingError] = useState("");
  const [documentBriefingState, setDocumentBriefingState] = useState<"idle" | "checking">("idle");
  const [preferredDocumentBriefingTargetId, setPreferredDocumentBriefingTargetId] = useState("");
  const [taskSession, setTaskSession] = useState<RuneTaskSession | null>(null);
  const [savedOperatingReviews, setSavedOperatingReviews] = useState<SavedOperatingReview[]>([]);
  const [taskEvidence, setTaskEvidence] = useState<RuneTaskEvidence>(EMPTY_RUNE_TASK_EVIDENCE);
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
  const [pendingPilotEvidence, setPendingPilotEvidence] = useState<PendingPilotEvidence | null>(null);
  const [pilotEvidenceError, setPilotEvidenceError] = useState("");
  const [pendingDeliveryConfirmation, setPendingDeliveryConfirmation] = useState<PendingDeliveryConfirmation | null>(
    null,
  );
  const [deliveryOutcomeError, setDeliveryOutcomeError] = useState("");
  const [deliveryOutcomeState, setDeliveryOutcomeState] = useState<"idle" | "recording">("idle");
  const [pendingDocumentStructure, setPendingDocumentStructure] = useState<PendingDocumentStructure | null>(null);
  const [pendingLocalImage, setPendingLocalImage] = useState<PendingLocalImage | null>(null);
  const [localAssetUrls, setLocalAssetUrls] = useState<Record<string, string>>({});
  const [exportError, setExportError] = useState("");
  const [exportState, setExportState] = useState<
    "idle" | "office" | "legacy-office" | "odf" | "html" | "pdf" | "csv" | "json"
  >("idle");
  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  const [agentError, setAgentError] = useState("");
  const [agentState, setAgentState] = useState<"idle" | "planning">("idle");
  const [agentMode, setAgentMode] = useState<"openai" | "local">("local");
  const [agentScope, setAgentScope] = useState<AgentScope>("artifact");
  const [checkpoints, setCheckpoints] = useState<CheckpointMap>({});
  const [historyOpen, setHistoryOpen] = useState(false);
  const [directoryHandle, setDirectoryHandle] = useState<DirectoryWorkspaceHandle | null>(null);
  const [directoryState, setDirectoryState] = useState<"disconnected" | "syncing" | "connected" | "changed" | "error">(
    "disconnected",
  );
  const directoryWriteMuteUntilRef = useRef(0);
  const [notice, setNotice] = useState("Local workspace ready");
  const [locale, setLocale] = useState<RuneLocale>("en");
  const [detectedLocale, setDetectedLocale] = useState<RuneLocale>("en");
  const localeRequestRef = useRef(0);
  const [modelMode, setModelMode] = useState<RuneModelMode>("auto");
  const [welcomeOpen, setWelcomeOpen] = useState(false);
  const [welcomeStartAt, setWelcomeStartAt] = useState<WelcomeStep>("welcome");
  const [welcomeDismissible, setWelcomeDismissible] = useState(false);
  const [appearanceTheme, setAppearanceTheme] = useState<RuneAppearanceTheme>("mist-blue");
  const [toolsMenuOpen, setToolsMenuOpen] = useState(false);
  const [commandMenuOpen, setCommandMenuOpen] = useState(false);
  const [workspaceSourcePercent, setWorkspaceSourcePercent] = useState(DEFAULT_WORKSPACE_SOURCE_PERCENT);
  const [workspaceView, setWorkspaceView] = useState<RuneWorkspaceView>("split");
  const [emptyWorkspace, setEmptyWorkspace] = useState(false);
  const [visualEditState, setVisualEditState] = useState<"idle" | "checking">("idle");
  const [visualSourceDraft, setVisualSourceDraft] = useState<VisualSourceDraft | null>(null);
  const workspaceRef = useRef<HTMLDivElement>(null);
  const shellRef = useRef<HTMLElement>(null);
  const gutterRef = useRef<HTMLPreElement>(null);
  const sourceEditorRef = useRef<HTMLTextAreaElement>(null);
  const sourceDraftMirrorRef = useRef<HTMLPreElement>(null);
  const exportMenuRef = useRef<HTMLDivElement>(null);
  const toolsMenuRef = useRef<HTMLDivElement>(null);
  const promptRef = useRef<HTMLTextAreaElement>(null);
  const previewScrollRef = useRef<HTMLDivElement>(null);
  const previewSelectionNoticeRef = useRef<PreviewSourceTarget | null>(null);
  const inspectSourceNavigationRef = useRef(false);
  const importRef = useRef<HTMLInputElement>(null);
  const taskImportRef = useRef<HTMLInputElement>(null);
  const taskImportIdRef = useRef<RuneTaskId>("operating-review");
  const imageImportRef = useRef<HTMLInputElement>(null);
  const importInFlightRef = useRef(false);
  const localImageInFlightRef = useRef(false);
  const pdfOcrAbortRef = useRef<AbortController | null>(null);
  const exportInFlightRef = useRef(false);
  const visualEditInFlightRef = useRef(false);
  const artifactsRef = useRef(artifacts);
  const checkpointsRef = useRef(checkpoints);
  const savedOperatingReviewsRef = useRef(savedOperatingReviews);
  const taskEvidenceRef = useRef(taskEvidence);
  const recordedStoppedTaskIdsRef = useRef(new Set<string>());
  artifactsRef.current = artifacts;
  checkpointsRef.current = checkpoints;
  savedOperatingReviewsRef.current = savedOperatingReviews;
  taskEvidenceRef.current = taskEvidence;
  const ui = useMemo(() => runeUICopy(locale).workbench, [locale]);
  const activeAppearance = useMemo(
    () => RUNE_APPEARANCE_THEMES.find((theme) => theme.id === appearanceTheme) ?? RUNE_APPEARANCE_THEMES[0],
    [appearanceTheme],
  );
  const visibleNotice = useMemo(() => localizeRuneStatus(locale, notice), [locale, notice]);
  const documentBriefingTargetsById = useMemo(
    () =>
      new Map(
        artifacts
          .filter((artifact) => artifact.kind === "document")
          .flatMap((artifact) => documentBriefingTargets(artifacts, artifact.id))
          .map((target) => [target.artifactId, target] as const),
      ),
    [artifacts],
  );

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
    const shell = shellRef.current;
    if (
      !shell ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches ||
      window.matchMedia("(pointer: coarse)").matches
    )
      return;
    let frame = 0;
    const moveMaterialLight = (event: globalThis.PointerEvent) => {
      if (frame) window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => {
        shell.style.setProperty("--rune-pointer-x", `${event.clientX}px`);
        shell.style.setProperty("--rune-pointer-y", `${event.clientY}px`);
        shell.style.setProperty("--rune-pointer-opacity", "1");
        frame = 0;
      });
    };
    const hideMaterialLight = () => shell.style.setProperty("--rune-pointer-opacity", "0");
    shell.addEventListener("pointermove", moveMaterialLight, { passive: true });
    shell.addEventListener("pointerleave", hideMaterialLight);
    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      shell.removeEventListener("pointermove", moveMaterialLight);
      shell.removeEventListener("pointerleave", hideMaterialLight);
    };
  }, []);

  // Scroll-driven chrome: the preview header gains a quiet shadow once its
  // content has scrolled, like the sticky bars on Apple product pages.
  useEffect(() => {
    if (!hydrated) return;
    const scroll = previewScrollRef.current;
    const pane = scroll?.closest<HTMLElement>(".preview-pane");
    if (!scroll || !pane) return;
    const onScroll = () => pane.toggleAttribute("data-scrolled", scroll.scrollTop > 8);
    onScroll();
    scroll.addEventListener("scroll", onScroll, { passive: true });
    return () => scroll.removeEventListener("scroll", onScroll);
  }, [hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    const referencedIds = [...new Set(artifacts.flatMap((artifact) => extractRuneAssetIds(artifact.source)))];
    let cancelled = false;
    const nextUrls: Record<string, string> = {};
    void Promise.all(
      referencedIds.map(async (id) => {
        try {
          const blob = await getRuneImageBlob(id);
          if (blob && !cancelled) nextUrls[id] = URL.createObjectURL(blob);
        } catch {
          // A missing or unavailable device asset remains an explicit preview placeholder.
        }
      }),
    ).then(() => {
      if (cancelled) {
        Object.values(nextUrls).forEach((url) => URL.revokeObjectURL(url));
        return;
      }
      setLocalAssetUrls((current) => {
        Object.values(current).forEach((url) => URL.revokeObjectURL(url));
        return nextUrls;
      });
    });
    return () => {
      cancelled = true;
    };
  }, [artifacts, hydrated]);

  useEffect(
    () => () => {
      Object.values(localAssetUrls).forEach((url) => URL.revokeObjectURL(url));
    },
    [localAssetUrls],
  );

  const resolveLocalAssetUrl = useCallback(
    (reference: string) => {
      const id = parseRuneAssetReference(reference);
      return id ? (localAssetUrls[id] ?? null) : null;
    },
    [localAssetUrls],
  );

  useEffect(
    () => () => {
      document.body.classList.remove("workspace-resizing");
    },
    [],
  );

  useEffect(() => {
    if (!exportMenuOpen && !toolsMenuOpen) return;
    const closeOutside = (event: globalThis.PointerEvent) => {
      // The settings gear lives outside the popover's DOM subtree, so keep it
      // from closing the panel on its own toggle click.
      if ((event.target as Element | null)?.closest?.("[data-settings-trigger]")) return;
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

  useEffect(() => {
    if (!directoryHandle) return;
    return observeWorkspaceDirectory(
      directoryHandle,
      () => {
        if (Date.now() < directoryWriteMuteUntilRef.current) return;
        setDirectoryState((current) => (current === "syncing" ? current : "changed"));
        setNotice(runeText(locale, "Folder changes detected · review with Pull", "检测到文件夹变化 · 请用“读取”审核"));
      },
      () => {
        setDirectoryState((current) => (current === "syncing" ? current : "error"));
        setNotice(runeText(locale, "Folder monitoring stopped · reconnect to resume", "文件夹监控已停止 · 请重新连接"));
      },
    );
  }, [directoryHandle, locale]);
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
      return current.artifactId === draft.artifactId &&
        current.sourceRevision === draft.sourceRevision &&
        current.nextSource === draft.nextSource &&
        current.start === draft.start &&
        current.end === draft.end &&
        current.errors.length === draft.errors.length &&
        current.errors.every((error, index) => error === draft.errors[index])
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
  const activeVisualSourceDraft =
    selectedArtifact &&
    visualSourceDraft?.artifactId === selectedArtifact.id &&
    visualSourceDraft.sourceRevision === selectedArtifact.source
      ? visualSourceDraft
      : null;
  const selectedOfficeExportType = selectedArtifact ? officeExportType(selectedArtifact) : null;
  const selectedLegacyOfficeExportType = selectedArtifact ? legacyOfficeExportType(selectedArtifact) : null;
  const legacyOfficeExportAvailable =
    hydrated && selectedLegacyOfficeExportType ? supportsLegacyOfficeDesktopExport() : false;
  const selectedOdfExportType = selectedArtifact ? odfExportType(selectedArtifact) : null;
  const selectedHtmlExport = Boolean(selectedArtifact?.kind === "slides" && isDeckMarkdownArtifact(selectedArtifact));
  const selectedPdfExport = Boolean(
    selectedArtifact?.kind === "document" || selectedArtifact?.kind === "data" || selectedArtifact?.kind === "slides",
  );
  const selectedCheckpoints = checkpoints[selectedArtifact?.id] ?? [];
  const currentSourceSelection =
    sourceSelection?.artifactId === selectedArtifact?.id && sourceSelection.sourceRevision === selectedArtifact?.source
      ? sourceSelection
      : null;
  const currentSelectionError =
    currentSourceSelection && selectedArtifact
      ? sourceSelectionError(selectedArtifact.source, currentSourceSelection)
      : "Select source text in the editor first.";
  const validSourceSelection =
    currentSourceSelection && !currentSelectionError
      ? { start: currentSourceSelection.start, end: currentSourceSelection.end }
      : null;
  const currentSourceCursor =
    sourceCursor?.artifactId === selectedArtifact?.id && sourceCursor.sourceRevision === selectedArtifact?.source
      ? sourceCursor
      : null;
  const sourceLinkedPreviewTargets = useMemo(
    () => (selectedArtifact ? deriveSourceLinkedPreviewTargets(selectedArtifact) : []),
    [selectedArtifact],
  );
  const activePreviewTarget = useMemo(
    () =>
      selectedArtifact && currentSourceCursor
        ? resolveSourceLinkedPreviewTarget(selectedArtifact, currentSourceCursor, sourceLinkedPreviewTargets)
        : null,
    [currentSourceCursor, selectedArtifact, sourceLinkedPreviewTargets],
  );
  const activePreviewTargetId = activePreviewTarget?.id ?? "";
  const activePreviewTargetKind = activePreviewTarget?.kind ?? null;
  const selectedCharacterCount = validSourceSelection ? validSourceSelection.end - validSourceSelection.start : 0;
  const canonicalDataArtifact = artifacts.find((artifact) => artifact.kind === "data");
  const selectedQueryDataResolution = useMemo(
    () => (selectedArtifact?.kind === "query" ? resolveQueryDataArtifact(selectedArtifact, artifacts) : null),
    [artifacts, selectedArtifact],
  );
  const selectedQueryDataArtifact = selectedQueryDataResolution?.artifact;
  const selectedChartBindingErrors = useMemo(
    () =>
      selectedArtifact?.kind === "chart"
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
    () => (selectedArtifact ? compileArtifactSource(selectedArtifact.source, artifacts) : null),
    [artifacts, selectedArtifact],
  );
  const dependencyGraph = useMemo(() => buildWorkspaceDependencyGraph(artifacts), [artifacts]);
  const workspaceAgentContext = useMemo(
    () =>
      selectWorkspaceAgentContext(artifacts, dependencyGraph, selectedArtifact?.id ?? artifacts[0]?.id ?? "", {
        pinnedArtifactIds: workspacePinnedArtifactIds,
      }),
    [artifacts, dependencyGraph, selectedArtifact?.id, workspacePinnedArtifactIds],
  );
  const workspaceAgentQueryCount = workspaceAgentContext.filter((artifact) => artifact.kind === "query").length;
  const validationDiagnostics = useMemo(
    () =>
      selectedArtifact
        ? prepareArtifactDiagnostics(selectedArtifact, [
            ...validateArtifact(selectedArtifact).map((detail) => ({ category: "source" as const, detail })),
            ...(bindingState?.metricBindingErrors.map((detail) => ({ category: "metric-binding" as const, detail })) ??
              []),
            ...(bindingState?.unresolved.map((reference) => ({
              category: "unresolved-metric" as const,
              detail: `Unresolved metric: ${reference}`,
              reference,
            })) ?? []),
            ...(bindingState?.unresolvedQueryMetrics.map((detail) => ({
              category: "query-metric-binding" as const,
              detail,
            })) ?? []),
            ...(bindingState?.unresolvedCharts.map((reference) => ({
              category: "unresolved-chart" as const,
              detail: `Unresolved chart: ${reference}`,
              reference,
            })) ?? []),
            ...selectedChartBindingErrors.map((detail) => ({ category: "chart-binding" as const, detail })),
            ...(selectedQueryDataResolution?.errors.map((detail) => ({ category: "query-binding" as const, detail })) ??
              []),
          ])
        : [],
    [
      bindingState?.metricBindingErrors,
      bindingState?.unresolved,
      bindingState?.unresolvedCharts,
      bindingState?.unresolvedQueryMetrics,
      selectedArtifact,
      selectedChartBindingErrors,
      selectedQueryDataResolution?.errors,
    ],
  );
  const pendingStats = useMemo(() => {
    if (!pendingChange) return [];
    const patches = pendingChange.patches.flatMap((patch) => {
      const artifact = artifacts.find((item) => item.id === patch.artifactId);
      return artifact
        ? [
            {
              artifact,
              patch,
              beforeSource: artifact.source,
              isCreation: false,
              ...getDiffStats(artifact.source, patch.nextSource),
            },
          ]
        : [];
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
  const proposalPreview = useMemo(
    () =>
      pendingChange
        ? prepareWorkspaceProposalPreview({
            artifacts,
            baseRevision: pendingChange.baseRevision,
            patches: pendingChange.patches,
            creations: pendingChange.creations,
            requestedArtifactId: pendingReviewId || undefined,
          })
        : null,
    [artifacts, pendingChange, pendingReviewId],
  );
  const proposalArtifact = proposalPreview?.artifact ?? null;
  const proposalReviewActive = Boolean(pendingChange);
  const proposalPreviewActive = Boolean(proposalArtifact);
  const presentedArtifact = proposalArtifact ?? selectedArtifact;
  const presentedArtifacts = proposalPreviewActive ? (proposalPreview?.artifacts ?? artifacts) : artifacts;
  const editorSource = activeVisualSourceDraft?.nextSource ?? presentedArtifact?.source ?? "";
  const lineNumbers = useMemo(
    () => Array.from({ length: editorSource.split("\n").length || 1 }, (_, index) => index + 1).join("\n"),
    [editorSource],
  );
  const pendingTotals = useMemo(
    () =>
      pendingStats.reduce(
        (total, patch) => ({
          additions: total.additions + patch.additions,
          removals: total.removals + patch.removals,
        }),
        { additions: 0, removals: 0 },
      ),
    [pendingStats],
  );
  const pendingOperationCount = pendingChange
    ? [...pendingChange.patches, ...pendingChange.creations].reduce(
        (total, change) => total + (change.operationCount ?? 0),
        0,
      )
    : 0;
  const pendingTransactionReview = useMemo(
    () =>
      pendingChange ? buildWorkspaceTransactionReview(artifacts, pendingChange.patches, pendingChange.creations) : null,
    [artifacts, pendingChange],
  );
  const selectedPendingStat =
    pendingStats.find((change) => change.artifact.id === proposalArtifact?.id) ??
    (!proposalArtifact ? pendingStats[0] : undefined);
  const selectedDiffPreview = useMemo(
    () =>
      selectedPendingStat
        ? createLineDiffPreview(selectedPendingStat.beforeSource, selectedPendingStat.patch.nextSource)
        : [],
    [selectedPendingStat],
  );
  const artifactCreationDisabled =
    !hydrated ||
    agentState === "planning" ||
    importState === "reading" ||
    exportState !== "idle" ||
    Boolean(pendingChange) ||
    Boolean(pendingImport) ||
    Boolean(pendingPdfOcr) ||
    Boolean(pendingExport) ||
    Boolean(pendingPilotEvidence) ||
    Boolean(pendingDeliveryConfirmation) ||
    Boolean(pendingDocumentStructure) ||
    Boolean(pendingLocalImage) ||
    operatingReviewOpen ||
    documentBriefingOpen ||
    operatingReviewState !== "idle" ||
    documentBriefingState !== "idle" ||
    visualEditState !== "idle" ||
    Boolean(activeVisualSourceDraft);
  const commandMenuCopy = useMemo(() => runeCommandMenuCopy(locale), [locale]);
  const pilotEvidenceUI = useMemo(() => pilotEvidenceNoticeCopy(locale), [locale]);
  const localImageUI = useMemo(() => localImageActionCopy(locale), [locale]);
  const workbenchCommands = useMemo(
    () =>
      createRuneWorkbenchCommands({
        ui,
        locale,
        artifactCreationDisabled,
        canCreateBriefing: artifacts.some((artifact) => artifact.kind === "document"),
        canUseWorkspace: hydrated && !emptyWorkspace,
        canCheckpoint: Boolean(selectedArtifact && canCheckpointSource(selectedArtifact.source)),
        canOpenFolder: hydrated && directoryState !== "syncing" && supportsDirectoryWorkspace(),
      }),
    [artifactCreationDisabled, artifacts, directoryState, emptyWorkspace, hydrated, locale, selectedArtifact, ui],
  );

  useEffect(() => {
    if (!proposalArtifact) return;
    const frame = window.requestAnimationFrame(() => {
      const editor = sourceEditorRef.current;
      if (!editor || editor.value !== proposalArtifact.source) return;
      editor.setSelectionRange(0, 0);
      editor.scrollTop = 0;
      editor.scrollLeft = 0;
      if (gutterRef.current) gutterRef.current.scrollTop = 0;
    });
    return () => window.cancelAnimationFrame(frame);
  }, [proposalArtifact]);

  useEffect(() => {
    let cancelled = false;
    const timer = window.setTimeout(() => {
      void (async () => {
        const detected = detectPreferredLocale(
          navigator.languages?.length ? navigator.languages : [navigator.language],
        );
        let nextLocale: RuneLocale = detected;
        try {
          nextLocale = normalizeRuneLocale(localStorage.getItem(RUNE_LOCALE_STORAGE_KEY)) ?? detected;
        } catch {
          // Device preference storage can be unavailable while the in-memory workspace remains usable.
        }
        try {
          await loadRuneLocaleCatalog(nextLocale);
        } catch {
          nextLocale = await loadRuneLocaleCatalog(detected)
            .then(() => detected)
            .catch(() => "en" as const);
        }
        if (cancelled) return;
        try {
          const storedModelMode = normalizeRuneModelMode(localStorage.getItem(RUNE_MODEL_MODE_STORAGE_KEY));
          const storedAppearance = normalizeRuneAppearanceTheme(localStorage.getItem(RUNE_APPEARANCE_STORAGE_KEY));
          const storedWorkspaceSplit = normalizeWorkspaceSourcePercent(
            localStorage.getItem(RUNE_WORKSPACE_SPLIT_STORAGE_KEY),
          );
          const storedWorkspaceView = normalizeRuneWorkspaceView(localStorage.getItem(RUNE_WORKSPACE_VIEW_STORAGE_KEY));
          setDetectedLocale(detected);
          setLocale(nextLocale);
          setModelMode(storedModelMode ?? "auto");
          setAppearanceTheme(storedAppearance ?? "mist-blue");
          setWorkspaceSourcePercent(storedWorkspaceSplit ?? DEFAULT_WORKSPACE_SOURCE_PERCENT);
          setWorkspaceView(storedWorkspaceView ?? "split");
          setWelcomeOpen(localStorage.getItem(RUNE_ONBOARDING_STORAGE_KEY) !== "complete");
          const stored = localStorage.getItem(STORAGE_KEY);
          if (stored) {
            const parsed = JSON.parse(stored) as {
              artifacts?: unknown;
              selectedId?: unknown;
              checkpoints?: unknown;
              savedOperatingReviews?: unknown;
              taskEvidence?: unknown;
            };
            const restoredArtifacts = normalizeWorkspaceArtifacts(parsed.artifacts);
            const restoredId =
              typeof parsed.selectedId === "string" &&
              restoredArtifacts.some((artifact) => artifact.id === parsed.selectedId)
                ? parsed.selectedId
                : restoredArtifacts[0].id;
            setArtifacts(restoredArtifacts);
            setSelectedId(restoredId);
            setCheckpoints(normalizeCheckpointMap(parsed.checkpoints));
            setSavedOperatingReviews(normalizeSavedOperatingReviews(parsed.savedOperatingReviews));
            setTaskEvidence(normalizeRuneTaskEvidence(parsed.taskEvidence));
            setNotice("Restored the latest device draft");
          }
        } catch {
          if (cancelled) return;
          setDetectedLocale(detected);
          setLocale(nextLocale);
          setWelcomeOpen(true);
          setNotice("Started a fresh local workspace");
        } finally {
          if (!cancelled) setHydrated(true);
        }
      })();
    }, 0);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
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
    const workspace = workspaceRef.current;
    const paneLeavingFocus =
      view === "preview"
        ? workspace?.querySelector<HTMLElement>(":scope > .source-pane")
        : view === "source"
          ? workspace?.querySelector<HTMLElement>(":scope > .preview-pane")
          : null;
    const moveFocus = Boolean(paneLeavingFocus?.contains(document.activeElement));
    setWorkspaceView(view);
    if (moveFocus) {
      window.requestAnimationFrame(() => {
        const visiblePane = workspace?.querySelector<HTMLElement>(
          view === "preview" ? ":scope > .preview-pane" : ":scope > .source-pane",
        );
        visiblePane
          ?.querySelector<HTMLButtonElement>(`[data-workspace-view-option="${view}"]`)
          ?.focus({ preventScroll: true });
      });
    }
    try {
      localStorage.setItem(RUNE_WORKSPACE_VIEW_STORAGE_KEY, view);
    } catch {
      // The presentation-only view remains usable in memory.
    }
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    const timer = window.setTimeout(() => {
      try {
        persistDeviceWorkspace(artifacts, selectedId, checkpoints, savedOperatingReviews, taskEvidence);
        setSaveState("saved");
        setSavedAt(new Intl.DateTimeFormat(locale, { hour: "2-digit", minute: "2-digit" }).format(new Date()));
      } catch {
        setSaveState("error");
        setNotice("Device storage is full — download the source before leaving");
      }
    }, 450);
    return () => window.clearTimeout(timer);
  }, [artifacts, checkpoints, hydrated, locale, savedOperatingReviews, selectedId, taskEvidence]);

  useEffect(() => {
    if (!activePreviewTargetId || workspaceView === "source") return;
    const frame = window.requestAnimationFrame(() => {
      const linkedElements = [
        ...(previewScrollRef.current?.querySelectorAll<HTMLElement>(
          "[data-preview-source-id], [data-preview-section-id]",
        ) ?? []),
      ];
      const linkedIndex = selectPreviewNavigationCandidate(
        { id: activePreviewTargetId, kind: activePreviewTargetKind ?? "" },
        linkedElements.map((element) => ({
          sourceId: element.dataset.previewSourceId,
          sectionId: element.dataset.previewSectionId,
          primary: element.dataset.previewSourcePrimary === "true",
        })),
      );
      const linkedElement = linkedElements[linkedIndex];
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
      if (
        visualEditState !== "idle" ||
        activeVisualSourceDraft ||
        commandMenuOpen ||
        pendingDocumentStructure ||
        pendingLocalImage ||
        operatingReviewOpen ||
        documentBriefingOpen ||
        newArtifactOpen ||
        welcomeOpen ||
        pendingImport ||
        pendingPdfOcr ||
        pendingExport ||
        pendingPilotEvidence ||
        pendingDeliveryConfirmation ||
        pendingChange
      )
        return;
      if ((event.metaKey || event.ctrlKey) && event.shiftKey && event.key.toLowerCase() === "p") {
        event.preventDefault();
        setExportMenuOpen(false);
        setToolsMenuOpen(false);
        setCommandMenuOpen(true);
        return;
      }
      const shortcutView = workspaceViewFromKeyboardShortcut(event);
      if (shortcutView && !emptyWorkspace) {
        event.preventDefault();
        setPreferredWorkspaceView(shortcutView);
        setNotice(
          shortcutView === "split"
            ? ui.showSplitView
            : shortcutView === "source"
              ? ui.showSourceView
              : ui.showPreviewView,
        );
        return;
      }
      if (!(event.metaKey || event.ctrlKey)) return;
      if (event.key.toLowerCase() === "o") {
        event.preventDefault();
        setTaskSession(null);
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
        persistDeviceWorkspace(artifacts, selectedId, next, savedOperatingReviews, taskEvidenceRef.current);
        setCheckpoints(next);
        setSaveState("saved");
        setSavedAt("");
        setNotice(
          next === checkpoints ? "Current source is already checkpointed" : "Manual checkpoint saved on this device",
        );
      } catch {
        setSaveState("error");
        setNotice("Device storage is full — checkpoint was not saved");
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [
    activeVisualSourceDraft,
    artifacts,
    checkpoints,
    commandMenuOpen,
    documentBriefingOpen,
    emptyWorkspace,
    newArtifactOpen,
    operatingReviewOpen,
    pendingChange,
    pendingDeliveryConfirmation,
    pendingDocumentStructure,
    pendingExport,
    pendingImport,
    pendingLocalImage,
    pendingPdfOcr,
    pendingPilotEvidence,
    savedOperatingReviews,
    selectedId,
    setPreferredWorkspaceView,
    ui.showPreviewView,
    ui.showSourceView,
    ui.showSplitView,
    visualEditState,
    welcomeOpen,
  ]);

  if (!selectedArtifact || !presentedArtifact) return null;

  function selectArtifact(id: string) {
    if (activeVisualSourceDraft) return;
    setSaveState("saving");
    setSelectedId(id);
    if (pendingChange) setPendingReviewId(id);
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

  async function setInterfaceLocale(nextLocale: RuneLocale) {
    const request = ++localeRequestRef.current;
    try {
      await loadRuneLocaleCatalog(nextLocale);
    } catch {
      if (request === localeRequestRef.current) setNotice("Rune could not load that local interface language");
      return;
    }
    if (request !== localeRequestRef.current) return;
    const currentDefaultGuide = createRuneGuideArtifact(locale);
    const nextGuide = createRuneGuideArtifact(nextLocale);
    setLocale(nextLocale);
    try {
      localStorage.setItem(RUNE_LOCALE_STORAGE_KEY, nextLocale);
    } catch {
      // The in-memory choice still applies when browser preference storage is unavailable.
    }
    setArtifacts((current) =>
      current.map((artifact) =>
        artifact.id === RUNE_GUIDE_ID && artifact.source === currentDefaultGuide.source ? nextGuide : artifact,
      ),
    );
  }

  function ensureLocalGuide(nextLocale = locale) {
    const guide = createRuneGuideArtifact(nextLocale);
    setArtifacts((current) =>
      current.some((artifact) => artifact.id === RUNE_GUIDE_ID) ? current : [guide, ...current],
    );
    return guide;
  }

  function beginStandardImport() {
    setTaskSession(null);
    importRef.current?.click();
  }

  function startRuneTaskFromSource(taskId: RuneTaskId) {
    taskImportIdRef.current = taskId;
    setTaskSession(startRuneTaskSession(taskId, artifactsRef.current));
    setOperatingReviewError("");
    setDocumentBriefingError("");
    setPreferredDocumentBriefingTargetId("");
    setEditingOperatingReviewId("");
    setEmptyWorkspace(true);
    setNotice(
      taskId === "document-briefing"
        ? runeText(
            locale,
            "Choose Word, Markdown, ODT, or PDF — Rune will review the import before shaping the presentation",
            "请选择 Word、Markdown、ODT 或 PDF — Rune 会先审核导入，再设置演示",
          )
        : runeText(
            locale,
            "Choose CSV, JSON, XLSX, or ODS — Rune will review the import before mapping the task",
            "请选择 CSV、JSON、XLSX 或 ODS — Rune 会先审核导入，再进入任务映射",
          ),
    );
    window.setTimeout(() => taskImportRef.current?.click(), 0);
  }

  function startOperatingReviewFromData() {
    startRuneTaskFromSource("operating-review");
  }

  function startDocumentBriefingFromDocument() {
    startRuneTaskFromSource("document-briefing");
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
    if (action === "review") {
      startOperatingReviewFromData();
      return;
    }
    if (action === "briefing") {
      startDocumentBriefingFromDocument();
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

  function openModelSettings() {
    setWelcomeStartAt("model");
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
    setArtifacts((current) =>
      current.map((artifact) => (artifact.id === selectedArtifact.id ? { ...artifact, source } : artifact)),
    );
    setSourceSelection(null);
    setSourceCursor(
      cursor
        ? {
            artifactId: selectedArtifact.id,
            sourceRevision: source,
            ...cursor,
          }
        : null,
    );
    if (agentScope === "selection") setAgentScope("artifact");
    if (pendingChange) setPendingChange(null);
  }

  async function prepareLocalImage(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    const targetArtifact = artifactsRef.current.find((artifact) => artifact.id === selectedId);
    const deckArtifact = Boolean(targetArtifact?.kind === "slides" && isDeckMarkdownArtifact(targetArtifact));
    if (!targetArtifact || (targetArtifact.kind !== "document" && !deckArtifact)) {
      setNotice("Local images can be inserted into Markdown Documents and Deck Markdown slides");
      return;
    }
    if (
      pendingChange ||
      pendingImport ||
      pendingPdfOcr ||
      pendingExport ||
      pendingDocumentStructure ||
      pendingLocalImage ||
      activeVisualSourceDraft
    ) {
      setNotice("Finish or cancel the current review before inserting an image");
      return;
    }
    const editor = sourceEditorRef.current;
    const offset = editor ? editor.selectionEnd : targetArtifact.source.length;
    if (deckArtifact) {
      const slide = derivePreviewSourceTargets(targetArtifact).find(
        (target) => target.kind === "deck-slide" && offset >= target.start && offset <= target.end,
      );
      if (!slide) {
        setNotice("Place the source cursor inside one Deck slide before inserting an image");
        return;
      }
    }
    setSaveState("saving");
    setNotice("Reading and verifying the image locally");
    try {
      const asset = await prepareRuneImageAsset(file.name, file.type, await file.arrayBuffer());
      const alt = runeImageAltFromName(asset.name);
      const insertion = buildRuneImageInsertion(targetArtifact.source, offset, alt, asset.id);
      if (deckArtifact) {
        const parsed = parseDeckSource(insertion.nextSource);
        if (!parsed.deck) throw new Error(parsed.errors[0] ?? "The image does not fit this Deck slide.");
      }
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
        return {
          ...current,
          alt,
          error: error instanceof Error ? error.message : "The Markdown image reference is invalid.",
        };
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
      setPendingLocalImage({
        ...pending,
        error: "The Document changed after this review opened. Choose the image again from the current source.",
      });
      return;
    }
    if (!canCheckpointSource(currentArtifact.source)) {
      setPendingLocalImage({ ...pending, error: "This Document is too large for a safe pre-insertion checkpoint." });
      return;
    }
    let insertion: RuneImageInsertion;
    try {
      insertion = buildRuneImageInsertion(currentArtifact.source, pending.offset, pending.alt, pending.asset.id);
      if (currentArtifact.kind === "slides" && isDeckMarkdownArtifact(currentArtifact)) {
        const parsed = parseDeckSource(insertion.nextSource);
        if (!parsed.deck) throw new Error(parsed.errors[0] ?? "The image does not fit this Deck slide.");
      }
    } catch (error) {
      setPendingLocalImage({
        ...pending,
        error: error instanceof Error ? error.message : "The Markdown image reference is invalid.",
      });
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
        persistDeviceWorkspace(
          prepared.nextArtifacts,
          currentArtifact.id,
          nextCheckpoints,
          savedOperatingReviewsRef.current,
          taskEvidenceRef.current,
        );
      } catch {
        if (created) await deleteRuneImageAsset(pending.asset.id).catch(() => undefined);
        setSaveState("error");
        setPendingLocalImage((value) =>
          value
            ? { ...value, error: "Device storage is full, so Rune kept the Document unchanged.", submitting: false }
            : value,
        );
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
      window.requestAnimationFrame(() =>
        window.requestAnimationFrame(() => {
          sourceEditorRef.current?.focus({ preventScroll: true });
          sourceEditorRef.current?.setSelectionRange(selection.start, selection.end, "forward");
        }),
      );
    } catch (error) {
      if (created) await deleteRuneImageAsset(pending.asset.id).catch(() => undefined);
      setSaveState("saved");
      setPendingLocalImage((value) =>
        value
          ? {
              ...value,
              error: error instanceof Error ? error.message : "Rune could not store this image locally.",
              submitting: false,
            }
          : value,
      );
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
    if (
      pendingChange ||
      pendingImport ||
      pendingPdfOcr ||
      pendingExport ||
      (pendingDocumentStructure && !allowDocumentStructureReview) ||
      agentState === "planning"
    ) {
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

      const checkpoint = createCheckpoint(currentArtifact, `Before visual edit · ${targetLabel}`, "manual");
      const nextCheckpoints = appendCheckpoint(checkpointsRef.current, checkpoint);
      try {
        persistDeviceWorkspace(
          prepared.nextArtifacts,
          currentArtifact.id,
          nextCheckpoints,
          savedOperatingReviewsRef.current,
          taskEvidenceRef.current,
        );
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
      setNotice(
        `${targetLabel} updated in canonical source${runtimeSuffix}${directoryHandle ? " · Push when ready" : ""}`,
      );
      window.requestAnimationFrame(() =>
        window.requestAnimationFrame(() => {
          sourceEditorRef.current?.focus({ preventScroll: true });
          sourceEditorRef.current?.setSelectionRange(selection.start, selection.end, "forward");
        }),
      );
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

  const commitVisualDataCellEdit: DataCellEditHandler = async (targetArtifact, target, input) =>
    commitVisualSourceEdit({
      targetArtifact,
      targetLabel: target.label,
      targetNoun: "cell",
      detail: "Replace one proven scalar literal through the visual Data editor.",
      verificationNotice: `Verifying ${target.label} against every live Data consumer…`,
      compile: (currentArtifact) => prepareVisualDataCellEdit(currentArtifact, target, input),
    });

  const commitVisualDocumentSectionEdit: DocumentSectionEditHandler = async (targetArtifact, target, input) =>
    commitVisualSourceEdit({
      targetArtifact,
      targetLabel: target.label,
      targetNoun: "section",
      detail: "Replace one revision-bound Markdown section through the visual Document editor.",
      verificationNotice: `Verifying ${target.label} against the complete workspace…`,
      compile: (currentArtifact) => prepareVisualDocumentSectionEdit(currentArtifact, target, input),
    });

  const commitVisualDocumentBlockEdit: DocumentBlockEditHandler = async (targetArtifact, target, input) =>
    commitVisualSourceEdit({
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
    if (
      pendingChange ||
      pendingImport ||
      pendingPdfOcr ||
      pendingExport ||
      pendingDocumentStructure ||
      pendingLocalImage ||
      agentState === "planning"
    ) {
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
    setPendingDocumentStructure((current) => (current ? { ...current, error: "", submitting: true } : current));
    const actionLabel =
      pending.input.action === "delete"
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
      compile: (currentArtifact) => prepareVisualDocumentBlockStructure(currentArtifact, pending.target, pending.input),
      expectedNextSource: pending.prepared.nextSource,
      allowDocumentStructureReview: true,
    });
    if (error) {
      setPendingDocumentStructure((current) => (current ? { ...current, error, submitting: false } : current));
      return;
    }
    setPendingDocumentStructure(null);
  }

  const commitVisualDeckSlideEdit: DeckSlideEditHandler = async (targetArtifact, target, input) =>
    commitVisualSourceEdit({
      targetArtifact,
      targetLabel: target.label,
      targetNoun: "slide",
      detail: "Replace one revision-bound Deck slide through the controlled visual editor.",
      verificationNotice: `Verifying ${target.label} against the complete workspace…`,
      compile: (currentArtifact) => prepareVisualDeckSlideEdit(currentArtifact, target, input),
    });

  const reviewSemanticHtmlEditableCopy: SemanticHtmlEditableCopyHandler = async (targetArtifact) => {
    if (
      importInFlightRef.current ||
      importState !== "idle" ||
      visualEditState !== "idle" ||
      pendingChange ||
      pendingImport ||
      pendingPdfOcr ||
      pendingExport ||
      pendingDocumentStructure ||
      pendingLocalImage ||
      agentState === "planning"
    )
      return;
    const baseArtifacts = artifactsRef.current;
    const currentArtifact = baseArtifacts.find((artifact) => artifact.id === targetArtifact.id);
    if (!currentArtifact || currentArtifact !== targetArtifact || currentArtifact.source !== targetArtifact.source) {
      setNotice("The semantic HTML source changed before Rune could prepare an editable copy");
      return;
    }
    importInFlightRef.current = true;
    setImportState("reading");
    setImportError("");
    setNotice(runeText(locale, "Verifying source…", "正在核验源内容…"));
    try {
      const { prepareSemanticHtmlEditableCopy } = await import("../lib/semantic-html-editable-copy");
      const prepared = prepareSemanticHtmlEditableCopy(baseArtifacts, currentArtifact);
      if (prepared.errors.length || !prepared.review) {
        throw new Error(prepared.errors[0] ?? "Rune could not prepare an editable presentation copy.");
      }
      setPendingImport(prepared.review);
      setTaskSession(null);
      setNotice(runeText(locale, "Create an editable Deck Markdown presentation", "创建可编辑的 Deck Markdown 演示"));
    } catch (error) {
      const message = error instanceof Error ? error.message : "Rune could not prepare an editable presentation copy.";
      setImportError(message);
      setNotice(message);
    } finally {
      importInFlightRef.current = false;
      setImportState("idle");
    }
  };

  const commitVisualChartSpecEdit: ChartSpecEditHandler = async (targetArtifact, target, input) =>
    commitVisualSourceEdit({
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
    if (inspectSourceNavigationRef.current) {
      inspectSourceNavigationRef.current = false;
      setSourceSelection(
        start < end
          ? {
              artifactId: selectedArtifact.id,
              sourceRevision,
              start,
              end,
            }
          : null,
      );
      return;
    }
    const sourceArtifact =
      sourceRevision === selectedArtifact.source ? selectedArtifact : { ...selectedArtifact, source: sourceRevision };
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
        setNotice(
          linkedTarget
            ? `${linkedTarget.label} linked in preview · Current-file Agent scope enabled`
            : "Selection cleared · Current-file Agent scope enabled",
        );
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
    const previewLabel = previewTarget?.start === start && previewTarget.end === end ? previewTarget.label : "";
    setNotice(
      previewLabel
        ? `${previewLabel} selected from preview · Selection Agent ready`
        : linkedTarget
          ? `${formatInteger(end - start)} source characters selected · ${linkedTarget.label} linked in preview · Selection Agent ready`
          : `${formatInteger(end - start)} source characters selected · Selection Agent ready`,
    );
  }

  function executeSourceNavigation(
    plan: PreparedSourceNavigation,
    options: Readonly<{
      notice: string;
      previewTarget?: PreviewSourceTarget;
    }>,
  ) {
    const selection: ActiveSourceSelection = {
      artifactId: plan.artifactId,
      sourceRevision: plan.sourceRevision,
      start: plan.start,
      end: plan.end,
    };
    if (plan.changesArtifact) setSelectedId(plan.artifactId);
    if (plan.revealsSource) setPreferredWorkspaceView("split");
    setSourceSelection(plan.start < plan.end ? selection : null);
    setSourceCursor(selection);
    setHistoryOpen(false);
    setNotice(options.notice);
    if (plan.activateSelectionAgent) {
      setAgentScope("selection");
      setPendingChange(null);
      setAgentError("");
    }
    previewSelectionNoticeRef.current = options.previewTarget ?? null;
    const focusSelection = () => {
      const editor = sourceEditorRef.current;
      if (!editor) return;
      inspectSourceNavigationRef.current = !plan.activateSelectionAgent;
      editor.focus({ preventScroll: true });
      editor.setSelectionRange(plan.start, plan.end, "forward");
      const editorStyle = window.getComputedStyle(editor);
      const rawLineHeight = Number.parseFloat(editorStyle.lineHeight);
      const fontSize = Number.parseFloat(editorStyle.fontSize);
      const safeLineHeight =
        Number.isFinite(rawLineHeight) && rawLineHeight > 0
          ? rawLineHeight < 5 && Number.isFinite(fontSize)
            ? rawLineHeight * fontSize
            : rawLineHeight
          : Number.isFinite(fontSize)
            ? fontSize * 1.72
            : 22;
      const nextScrollTop = sourceSelectionScrollTop({
        source: plan.sourceRevision,
        start: plan.start,
        end: plan.end,
        lineHeight: safeLineHeight,
        viewportHeight: editor.clientHeight,
        scrollHeight: editor.scrollHeight,
      });
      editor.scrollTo({
        top: nextScrollTop,
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
      });
      if (gutterRef.current) gutterRef.current.scrollTop = nextScrollTop;
      window.requestAnimationFrame(() => {
        if (Math.abs(editor.scrollTop - nextScrollTop) < 2) return;
        editor.scrollTo({ top: nextScrollTop, behavior: "auto" });
        if (gutterRef.current) gutterRef.current.scrollTop = nextScrollTop;
      });
      if (!plan.activateSelectionAgent) {
        window.setTimeout(() => {
          inspectSourceNavigationRef.current = false;
        }, 0);
      }
    };
    window.requestAnimationFrame(() => {
      if (plan.changesArtifact || plan.revealsSource) window.requestAnimationFrame(focusSelection);
      else focusSelection();
    });
  }

  function focusPreviewTarget(targetArtifact: WorkspaceArtifact, target: PreviewSourceTarget, viaLabel?: string) {
    previewSelectionNoticeRef.current = null;
    const contextLabel = viaLabel ? `${target.label} · via ${viaLabel}` : target.label;
    const navigation = prepareSourceNavigation({
      artifacts,
      selectedArtifactId: selectedArtifact.id,
      workspaceView,
      request: {
        origin: "preview",
        artifactId: targetArtifact.id,
        sourceRevision: targetArtifact.source,
        start: target.start,
        end: target.end,
        label: contextLabel,
      },
    });
    if (!navigation.plan) {
      setSourceSelection(null);
      setSourceCursor(null);
      if (agentScope === "selection") setAgentScope("artifact");
      setAgentError(navigation.error);
      setNotice("Preview target is too large or no longer matches the current source");
      return;
    }
    executeSourceNavigation(navigation.plan, {
      notice: `${contextLabel} selected from preview · Selection Agent ready`,
      previewTarget: { ...target, label: contextLabel },
    });
  }

  function openValidationIssueSource() {
    const diagnostic = validationDiagnostics[0];
    if (!diagnostic || !selectedArtifact) return;
    const navigation = prepareSourceNavigation({
      artifacts,
      selectedArtifactId: selectedArtifact.id,
      workspaceView,
      request: {
        origin: "diagnostic",
        artifactId: selectedArtifact.id,
        sourceRevision: selectedArtifact.source,
        reference: diagnostic.reference,
        label: ui.diagnostics.heading,
      },
    });
    if (!navigation.plan) {
      setNotice(navigation.error);
      return;
    }
    executeSourceNavigation(navigation.plan, { notice: ui.diagnostics.sourceFocused });
  }

  function saveManualCheckpoint() {
    if (!canCheckpointSource(selectedArtifact.source)) {
      setNotice("This source is too large for device checkpoint history");
      return;
    }
    const checkpoint = createCheckpoint(selectedArtifact, "Manual checkpoint", "manual");
    const next = appendCheckpoint(checkpoints, checkpoint);
    try {
      persistDeviceWorkspace(artifacts, selectedId, next, savedOperatingReviews, taskEvidenceRef.current);
      setCheckpoints(next);
      setSaveState("saved");
      setSavedAt("");
      setNotice(
        next === checkpoints ? "Current source is already checkpointed" : "Manual checkpoint saved on this device",
      );
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
      next = appendCheckpoint(
        next,
        createCheckpoint(artifact, "Before folder pull", "manual", new Date(timestamp + index)),
      );
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

  function openDeliveryConfirmationForArtifact(
    artifact: WorkspaceArtifact,
    method: RuneTaskDeliveryMethod,
    target: RuneTaskDeliveryTarget,
    handoffLabel: string,
  ) {
    const workflow = savedOperatingReviewsRef.current.find(
      (candidate) => candidate.artifactIds.document === artifact.id || candidate.artifactIds.slides === artifact.id,
    );
    const taskRun = taskEvidenceRef.current.runs.find((candidate) => {
      const taskSource = artifactsRef.current.find((item) => item.id === candidate.sourceArtifactId);
      const outputsAreCurrent = candidate.outputArtifactIds.every((artifactId) => {
        const output = artifactsRef.current.find((item) => item.id === artifactId);
        return (
          Boolean(output) && candidate.outputRevisions[artifactId] === portableSourceRevision(output?.source ?? "")
        );
      });
      return (
        candidate.status === "applied" &&
        candidate.outputArtifactIds.includes(artifact.id) &&
        outputsAreCurrent &&
        Boolean(taskSource) &&
        candidate.sourceRevision === portableSourceRevision(taskSource?.source ?? "")
      );
    });
    if (!taskRun) return;
    setDeliveryOutcomeError("");
    setPendingDeliveryConfirmation({
      runId: taskRun.id,
      workflowTitle: workflow?.input.title ?? artifact.name,
      taskSourceArtifactId: taskRun.sourceArtifactId,
      artifactId: artifact.id,
      artifactName: artifact.name,
      sourceRevision: artifact.source,
      method,
      target,
      handoffLabel,
    });
  }

  async function confirmDeliveryOutcome(confirmation: RuneTaskDeliveryConfirmation) {
    const pending = pendingDeliveryConfirmation;
    if (!pending || deliveryOutcomeState !== "idle") return;
    setDeliveryOutcomeState("recording");
    setDeliveryOutcomeError("");
    try {
      const currentOutput = artifactsRef.current.find((artifact) => artifact.id === pending.artifactId);
      if (!currentOutput || currentOutput.source !== pending.sourceRevision) {
        throw new Error("The deliverable changed after this confirmation opened. Export or hand it off again.");
      }
      const taskSource = artifactsRef.current.find((artifact) => artifact.id === pending.taskSourceArtifactId);
      if (!taskSource) throw new Error("The exact task source is no longer available.");
      const currentOutputRevisions = Object.fromEntries(
        taskEvidenceRef.current.runs
          .find((run) => run.id === pending.runId)
          ?.outputArtifactIds.flatMap((artifactId) => {
            const output = artifactsRef.current.find((artifact) => artifact.id === artifactId);
            return output ? [[artifactId, portableSourceRevision(output.source)] as const] : [];
          }) ?? [],
      );
      const nextEvidence = await recordRuneTaskDelivery({
        evidence: taskEvidenceRef.current,
        runId: pending.runId,
        artifactId: pending.artifactId,
        source: pending.sourceRevision,
        currentSourceRevision: portableSourceRevision(taskSource.source),
        currentOutputRevisions,
        method: pending.method,
        target: pending.target,
        rating: confirmation.rating,
        evaluation: confirmation.evaluation,
      });
      persistDeviceWorkspace(
        artifactsRef.current,
        selectedId,
        checkpointsRef.current,
        savedOperatingReviewsRef.current,
        nextEvidence,
      );
      setTaskEvidence(nextEvidence);
      setPendingDeliveryConfirmation(null);
      setNotice(ui.deliveryOutcomeRecorded);
    } catch (error) {
      setDeliveryOutcomeError(error instanceof Error ? error.message : ui.deliveryOutcomeFailed);
    } finally {
      setDeliveryOutcomeState("idle");
    }
  }

  async function applyDirectoryWorkspace(handle: DirectoryWorkspaceHandle, result: DirectoryReadResult) {
    if (result.errors.length) throw new Error(result.errors[0]);
    if (!result.artifacts.length) throw new Error("The selected folder does not contain a Rune workspace yet.");
    if (
      !window.confirm(
        `Replace this device draft with ${result.artifacts.length} validated source files from “${handle.name}”? A checkpoint of every current file will be kept.`,
      )
    ) {
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
    const nextSavedReviews = savedOperatingReviews.filter(
      (workflow) =>
        result.artifacts.some((artifact) => artifact.id === workflow.input.dataArtifactId) &&
        Object.values(workflow.artifactIds).every((artifactId) =>
          result.artifacts.some((artifact) => artifact.id === artifactId),
        ),
    );
    const pulledArtifactIds = new Set(result.artifacts.map((artifact) => artifact.id));
    const nextTaskEvidence = normalizeRuneTaskEvidence({
      ...taskEvidenceRef.current,
      runs: taskEvidenceRef.current.runs.filter(
        (run) =>
          pulledArtifactIds.has(run.sourceArtifactId) &&
          run.outputArtifactIds.every((artifactId) => pulledArtifactIds.has(artifactId)),
      ),
    });
    try {
      persistDeviceWorkspace(result.artifacts, nextSelectedId, nextCheckpoints, nextSavedReviews, nextTaskEvidence);
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
    setTaskEvidence(nextTaskEvidence);
    setPendingChange(null);
    setHistoryOpen(false);
    setSaveState("saved");
    setSavedAt("");
    setDirectoryHandle(handle);
    setDirectoryState("connected");
    setNotice(
      `Pulled ${result.artifacts.length} source files${result.assets.length ? ` and ${result.assets.length} local images` : ""} from ${handle.name} · ${result.source}`,
    );
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
        if (
          !window.confirm(
            `“${handle.name}” has no supported source files. Write the current Rune workspace there? Existing unrelated files will stay untouched.`,
          )
        ) {
          setDirectoryState(directoryHandle ? "connected" : "disconnected");
          setNotice("Folder connection cancelled");
          return;
        }
        const localAssets = await collectWorkspaceLocalAssets(artifacts);
        directoryWriteMuteUntilRef.current = Date.now() + 5_000;
        await writeWorkspaceDirectory(handle, artifacts, localAssets);
        setDirectoryHandle(handle);
        setDirectoryState("connected");
        setNotice(`Connected ${handle.name} · wrote ${artifacts.length} readable source files`);
        openDeliveryConfirmationForArtifact(selectedArtifact, "folder", "folder", `${handle.name} · ${ui.push}`);
        return;
      }
      if (!(await applyDirectoryWorkspace(handle, result)))
        setDirectoryState(directoryHandle ? "connected" : "disconnected");
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
    if (
      !window.confirm(
        `Write ${artifacts.length} current source files to “${directoryHandle.name}”? Files with the same names will be overwritten; unrelated files will stay untouched.`,
      )
    ) {
      setNotice("Folder push cancelled");
      return;
    }
    setDirectoryState("syncing");
    const handoffArtifact = selectedArtifact;
    try {
      const localAssets = await collectWorkspaceLocalAssets(artifacts);
      directoryWriteMuteUntilRef.current = Date.now() + 5_000;
      await writeWorkspaceDirectory(directoryHandle, artifacts, localAssets);
      setDirectoryState("connected");
      setNotice(
        `Pushed ${artifacts.length} source files${localAssets.length ? ` and ${localAssets.length} local images` : ""} with rune.workspace.json to ${directoryHandle.name}`,
      );
      openDeliveryConfirmationForArtifact(handoffArtifact, "folder", "folder", `${directoryHandle.name} · ${ui.push}`);
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
    const safetyCheckpoint = createCheckpoint(selectedArtifact, `Before restoring ${checkpoint.label}`, "restore");
    setCheckpoints((current) => appendCheckpoint(current, safetyCheckpoint));
    updateSource(checkpoint.source);
    setNotice(`Restored checkpoint · ${checkpoint.label}`);
  }

  async function runAgent(nextPrompt = prompt) {
    const instruction = nextPrompt.trim();
    if (
      !instruction ||
      agentState === "planning" ||
      visualEditState !== "idle" ||
      activeVisualSourceDraft ||
      pendingDocumentStructure
    )
      return;
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
    const targetWorkspacePinnedArtifactIds =
      scope === "workspace"
        ? workspacePinnedArtifactIds.filter((artifactId) => targetWorkspaceContextIds.has(artifactId))
        : [];
    const targetWorkspaceGraph = scope === "workspace" ? buildWorkspaceDependencyGraph(targetWorkspaceContext) : null;
    const targetWorkspaceDependencies =
      scope === "workspace"
        ? (targetWorkspaceGraph?.edges ?? []).map((edge) => ({
            fromArtifactId: edge.fromArtifactId,
            toArtifactId: edge.toArtifactId,
            kind: edge.kind,
            references: edge.references,
          }))
        : [];
    const targetWorkspaceContextClosed =
      scope !== "workspace" || workspaceAgentContextIsClosed(dependencyGraph, targetWorkspaceContext);
    const targetWorkspaceContextResolved = scope !== "workspace" || targetWorkspaceGraph?.issues.length === 0;
    const targetWorkspacePinsIncluded =
      scope !== "workspace" || targetWorkspacePinnedArtifactIds.length === workspacePinnedArtifactIds.length;
    const targetRevision = captureWorkspaceSourceRevision(targetArtifacts);
    setAgentState("planning");
    setAgentError("");
    setPendingChange(null);
    setPendingReviewId("");
    setNotice(
      scope === "workspace"
        ? `Agent is coordinating ${targetWorkspaceContext.length} context sources${targetWorkspacePinnedArtifactIds.length ? ` · ${targetWorkspacePinnedArtifactIds.length} pinned` : ""}`
        : scope === "selection"
          ? "Agent is planning a patch confined to the selected source"
          : "Agent is planning a reviewable file patch",
    );

    const metricEntries = Object.entries(bindingState?.metrics ?? {});
    const metricSourceId = metricEntries[0]?.[1].sourceArtifactId;
    const contextContainsMetricSource =
      scope !== "workspace" ||
      !metricSourceId ||
      targetWorkspaceContext.some((artifact) => artifact.id === metricSourceId);
    const metrics = Object.fromEntries(
      contextContainsMetricSource ? metricEntries.map(([key, metric]) => [key, metric.formatted]) : [],
    );
    const remoteEligible =
      scope !== "workspace"
        ? targetArtifact.source.length <= MAX_WORKSPACE_AGENT_ARTIFACT_CHARS
        : workspaceAgentContextFitsSourceLimits(targetWorkspaceContext) &&
          targetWorkspaceContextClosed &&
          targetWorkspaceContextResolved &&
          targetWorkspacePinsIncluded;
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

    async function preflightRuntimeImpact(patches: ArtifactSourcePatch[], creations: ArtifactCreationChange[]) {
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
        const sendRemoteRequest = (body: RemoteRequestBody) =>
          fetch("/api/agent", {
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
        let payload = (await response.json().catch(() => ({}))) as RemoteAgentResponse;
        let queryEvidenceCount = 0;

        if (scope === "workspace" && response.status === 428 && payload.code === "QUERY_EVIDENCE_REQUIRED") {
          const expectedQueryIds = targetWorkspaceContext
            .filter((artifact) => artifact.kind === "query")
            .map((artifact) => artifact.id);
          if (
            !payload.queryArtifactIds ||
            payload.queryArtifactIds.length !== expectedQueryIds.length ||
            payload.queryArtifactIds.some((artifactId, index) => artifactId !== expectedQueryIds[index])
          ) {
            throw new Error("The model provider requested stale Query evidence.");
          }
          setNotice(
            `Agent is inspecting ${expectedQueryIds.length} current Query ${expectedQueryIds.length === 1 ? "result" : "results"} locally`,
          );
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
          payload = (await response.json().catch(() => ({}))) as RemoteAgentResponse;
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
              const message =
                feedbackError instanceof Error
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
              repairPayload = (await repairResponse.json().catch(() => ({}))) as RemoteAgentResponse;
            } catch {
              stopRemoteRepair("Automatic repair stopped after one attempt · the model provider could not be reached.");
              return;
            }
            const replacementPlan =
              repairResponse.ok && repairPayload.repairAttempt === 1 ? normalizeRemotePlan(repairPayload.plan) : null;
            if (!replacementPlan) {
              const reason =
                repairPayload.error ??
                (repairPayload.repairAttempt !== 1
                  ? "The replacement response did not match Rune's repair request."
                  : "The model did not return a valid replacement plan.");
              stopRemoteRepair(`Automatic repair stopped after one attempt · ${reason}`);
              return;
            }
            try {
              runtimePreflight = await preflightRuntimeImpact(replacementPlan.patches, replacementPlan.creations);
            } catch (secondError) {
              const message =
                secondError instanceof Error
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
            selection: scope === "selection" ? (targetSelection ?? undefined) : undefined,
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
            setNotice(
              `Model prepared ${changeCount} coordinated file ${changeCount === 1 ? "change" : "changes"} from ${targetWorkspaceContext.length}-file context${queryEvidenceCount ? ` · inspected ${queryEvidenceCount} Query ${queryEvidenceCount === 1 ? "result" : "results"}` : ""}${targetWorkspacePinnedArtifactIds.length ? ` · ${targetWorkspacePinnedArtifactIds.length} pinned` : ""}${repairSuffix}${payload.model ? ` · ${payload.model}` : ""}`,
            );
          } else {
            setNotice(
              `${scope === "selection" ? "Model prepared a selection-confined patch" : "Model prepared a file patch"}${repairSuffix}${payload.model ? ` · ${payload.model}` : ""}`,
            );
          }
          setAgentState("idle");
          return;
        }
        fallbackNotice =
          payload.code === "MODEL_UNCONFIGURED"
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
        const localPlan =
          scope === "selection" && targetSelection
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
          selection: scope === "selection" ? (targetSelection ?? undefined) : undefined,
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
      setNotice(
        message.startsWith("Runtime impact preflight failed")
          ? "Nothing proposed — runtime impact preflight failed; every source stayed unchanged"
          : "Agent needs a more specific instruction",
      );
    } finally {
      setAgentState("idle");
    }
  }

  function runeTaskRunFromPendingChange(
    change: PendingChange,
    status: RuneTaskRun["status"],
    stopReason: RuneTaskStopReason | null,
  ): RuneTaskRun | undefined {
    if (!change.taskRun) return undefined;
    const completedAt = new Date();
    const sourceArtifact = change.baseRevision.find((artifact) => artifact.id === change.taskRun?.sourceArtifactId);
    const outputSources = Object.fromEntries(
      change.taskRun.outputArtifactIds.flatMap((artifactId) => {
        const patch = change.patches.find((candidate) => candidate.artifactId === artifactId);
        const creation = change.creations.find((candidate) => candidate.artifact.id === artifactId);
        const current = artifactsRef.current.find((artifact) => artifact.id === artifactId);
        const source = patch?.nextSource ?? creation?.artifact.source ?? current?.source;
        return source == null ? [] : [[artifactId, source]];
      }),
    );
    if (!sourceArtifact || Object.keys(outputSources).length !== change.taskRun.outputArtifactIds.length)
      return undefined;
    return {
      version: 1,
      id: `task-run:${change.taskRun.taskId}:${completedAt.getTime()}:${status}`,
      taskId: change.taskRun.taskId,
      completedAt: completedAt.toISOString(),
      status,
      stopReason,
      provider: change.provider || "local",
      sourceArtifactId: change.taskRun.sourceArtifactId,
      sourceRevision: portableSourceRevision(sourceArtifact.source),
      outputArtifactIds: [...change.taskRun.outputArtifactIds],
      outputRevisions: Object.fromEntries(
        Object.entries(outputSources).map(([artifactId, source]) => [artifactId, portableSourceRevision(source)]),
      ),
      changedFileCount: change.patches.length + change.creations.length,
      queryCount: change.runtimePreflight?.queryCount ?? 0,
      chartConsumerCount: change.runtimePreflight?.chartConsumerCount ?? 0,
      durationMs:
        change.preparedAt == null
          ? 0
          : Math.min(MAX_RUNE_TASK_DURATION_MS, Math.max(0, completedAt.getTime() - change.preparedAt)),
      inputTokens: change.usage?.inputTokens ?? null,
      outputTokens: change.usage?.outputTokens ?? null,
    };
  }

  function recordStoppedRuneTask(change: PendingChange, stopReason: RuneTaskStopReason) {
    const identity = `${change.taskRun?.taskId ?? "none"}:${change.preparedAt ?? 0}`;
    if (!change.taskRun || recordedStoppedTaskIdsRef.current.has(identity)) return;
    recordedStoppedTaskIdsRef.current.add(identity);
    const run = runeTaskRunFromPendingChange(change, "stopped", stopReason);
    if (!run) return;
    const nextEvidence = appendRuneTaskRun(taskEvidenceRef.current, run);
    try {
      persistDeviceWorkspace(
        artifactsRef.current,
        selectedId,
        checkpointsRef.current,
        savedOperatingReviewsRef.current,
        nextEvidence,
      );
      setTaskEvidence(nextEvidence);
    } catch {
      // Task evidence must never weaken the zero-source-write guarantee.
    }
  }

  function applyPendingChange() {
    if (!pendingChange) return;
    if (!workspaceMatchesSourceRevision(artifacts, pendingChange.baseRevision)) {
      recordStoppedRuneTask(pendingChange, "stale");
      setAgentError(
        "The workspace changed while this Agent plan was being prepared. Discard it and plan again from the current source revision.",
      );
      setNotice("Patch held for review — workspace source revision changed");
      return;
    }
    const targetArtifacts = pendingChange.patches.flatMap((patch) => {
      const artifact = artifacts.find((item) => item.id === patch.artifactId);
      return artifact ? [artifact] : [];
    });
    if (targetArtifacts.length !== pendingChange.patches.length) {
      recordStoppedRuneTask(pendingChange, "stale");
      setAgentError("The plan references a file that is no longer in this workspace.");
      setNotice("Patch held for review — workspace context changed");
      return;
    }
    if (pendingChange.scope === "selection") {
      const target = targetArtifacts[0];
      const patch = pendingChange.patches[0];
      if (
        !pendingChange.selection ||
        !target ||
        !patch ||
        pendingChange.patches.length !== 1 ||
        pendingChange.creations.length !== 0 ||
        !sourceOutsideSelectionIsUnchanged(target.source, patch.nextSource, pendingChange.selection)
      ) {
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

    const prepared = prepareWorkspaceMutation(artifacts, pendingChange.patches, pendingChange.creations);
    if (prepared.errors.length) {
      recordStoppedRuneTask(pendingChange, "validation");
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
        `${
          pendingChange.scope === "workspace"
            ? "Before workspace patch"
            : pendingChange.scope === "selection"
              ? "Before selection patch"
              : "Before agent patch"
        } · ${patch.summary}`,
        "agent",
        new Date(checkpointTimestamp + index),
      );
      nextCheckpoints = appendCheckpoint(nextCheckpoints, checkpoint);
    });

    const nextSelectedId =
      pendingChange.selectAfterApplyArtifactId ?? pendingChange.creations[0]?.artifact.id ?? selectedId;
    const completedTaskRun = runeTaskRunFromPendingChange(pendingChange, "applied", null);
    const nextTaskEvidence = completedTaskRun
      ? appendRuneTaskRun(taskEvidenceRef.current, completedTaskRun)
      : taskEvidenceRef.current;
    const nextSavedReviews = pendingChange.savedOperatingReviewAfterApply
      ? [
          pendingChange.savedOperatingReviewAfterApply,
          ...savedOperatingReviews.filter(
            (workflow) => workflow.id !== pendingChange.savedOperatingReviewAfterApply?.id,
          ),
        ].slice(0, MAX_SAVED_OPERATING_REVIEWS)
      : savedOperatingReviews;
    try {
      persistDeviceWorkspace(
        prepared.nextArtifacts,
        nextSelectedId,
        nextCheckpoints,
        nextSavedReviews,
        nextTaskEvidence,
      );
    } catch {
      setSaveState("error");
      setAgentError("Device storage is full, so Rune kept every source unchanged.");
      setNotice("Nothing applied — atomic persistence failed");
      recordStoppedRuneTask(pendingChange, "persistence");
      return;
    }

    setArtifacts(prepared.nextArtifacts);
    setSelectedId(nextSelectedId);
    setSourceSelection(null);
    setSourceCursor(null);
    if (pendingChange.scope === "selection") setAgentScope("artifact");
    setCheckpoints(nextCheckpoints);
    setSavedOperatingReviews(nextSavedReviews);
    setTaskEvidence(nextTaskEvidence);
    setSaveState("saved");
    setSavedAt("");
    setPendingChange(null);
    setPendingReviewId("");
    setAgentError("");
    const changeCount = pendingChange.patches.length + pendingChange.creations.length;
    const creationNotice = pendingChange.creations.length
      ? ` · ${pendingChange.creations.length} new ${pendingChange.creations.length === 1 ? "file" : "files"}`
      : " · checkpoints are ready";
    setNotice(
      `${changeCount} ${changeCount === 1 ? "file change" : "file changes"} applied atomically${creationNotice}${directoryHandle ? " · Push when ready" : ""}`,
    );
  }

  function discardPendingChange() {
    if (!pendingChange) return;
    recordStoppedRuneTask(pendingChange, "cancelled");
    setPendingChange(null);
    setPendingReviewId("");
    setNotice(runeText(locale, "Review cancelled — every source stayed unchanged", "已取消审核 — 所有源内容保持不变"));
  }

  function undoLastAgentChange() {
    const previous = [...selectedCheckpoints]
      .reverse()
      .find((checkpoint) => checkpoint.source !== selectedArtifact.source);
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
    setTaskEvidence(EMPTY_RUNE_TASK_EVIDENCE);
    setEditingOperatingReviewId("");
    setTaskSession(null);
    setOperatingReviewOpen(false);
    setOperatingReviewError("");
    setDocumentBriefingOpen(false);
    setDocumentBriefingError("");
    setPreferredDocumentBriefingTargetId("");
    setHistoryOpen(false);
    setNewArtifactOpen(false);
    setNewArtifactError("");
    setPendingChange(null);
    setPendingReviewId("");
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
    setTaskSession(null);
    setOperatingReviewOpen(true);
    setNotice(
      runeText(
        locale,
        "Choose the evidence, measure, and deliverables before Rune prepares the full review chain",
        "先选择数据、口径和交付物，再生成整条汇报链",
      ),
    );
  }

  function openDocumentBriefingForArtifact(entryArtifact: WorkspaceArtifact) {
    const selectedOriginId = documentBriefingSourceIdForPresentation(entryArtifact);
    const source =
      entryArtifact.kind === "document"
        ? entryArtifact
        : selectedOriginId
          ? artifactsRef.current.find((artifact) => artifact.id === selectedOriginId && artifact.kind === "document")
          : artifactsRef.current.find((artifact) => artifact.kind === "document");
    if (!source) {
      setNotice(
        runeText(
          locale,
          "Open or import a Document before creating a presentation",
          "请先打开或导入一份 Document，再创建演示",
        ),
      );
      return;
    }
    const prepared = startRuneTaskFromArtifact("document-briefing", artifactsRef.current, source.id);
    if (!prepared.session || prepared.errors.length) {
      setNotice(prepared.errors[0] ?? "Rune could not start this presentation task.");
      return;
    }
    setTaskSession(prepared.session);
    const targetId = selectedOriginId && source.id === selectedOriginId ? entryArtifact.id : "";
    setPreferredDocumentBriefingTargetId(targetId);
    setDocumentBriefingError("");
    setDocumentBriefingOpen(true);
    const targetFreshness = targetId
      ? documentBriefingTargets(artifactsRef.current, source.id).find((target) => target.artifactId === targetId)
          ?.freshness
      : undefined;
    setNotice(
      targetFreshness === "changed"
        ? `${ui.refreshAvailable} · ${source.name} → ${entryArtifact.name}`
        : runeText(
            locale,
            `Using ${source.name} as the exact presentation source`,
            `将 ${source.name} 作为演示的明确来源`,
          ),
    );
  }

  function openDocumentBriefing() {
    openDocumentBriefingForArtifact(selectedArtifact);
  }

  function reviewLinkedPresentationRefresh(artifactId: string) {
    const target = artifactsRef.current.find((artifact) => artifact.id === artifactId);
    const sourceId = target ? documentBriefingSourceIdForPresentation(target) : null;
    const targetFreshness = sourceId
      ? documentBriefingTargets(artifactsRef.current, sourceId).find((candidate) => candidate.artifactId === artifactId)
          ?.freshness
      : undefined;
    if (!target || targetFreshness !== "changed") {
      setNotice(ui.refreshNoLongerNeeded);
      return;
    }
    setSelectedId(target.id);
    setEmptyWorkspace(false);
    openDocumentBriefingForArtifact(target);
  }

  function openSavedOperatingReview(workflow: SavedOperatingReview) {
    setOperatingReviewError("");
    setEditingOperatingReviewId(workflow.id);
    setTaskSession(null);
    setOperatingReviewOpen(true);
    setNotice(
      runeText(locale, `Preparing to rerun “${workflow.input.title}”`, `正在准备重新运行「${workflow.input.title}」`),
    );
  }

  async function prepareOperatingReview(input: OperatingReviewInput) {
    if (operatingReviewState !== "idle" || pendingChange) return;
    const taskStartedAt = Date.now();
    setOperatingReviewError("");
    setOperatingReviewState("checking");
    const baseArtifacts = artifactsRef.current;
    const baseRevision = captureWorkspaceSourceRevision(baseArtifacts);
    const copy = operatingReviewNoticeCopy(locale);
    try {
      const savedWorkflow = savedOperatingReviewsRef.current.find(
        (workflow) => workflow.id === editingOperatingReviewId,
      );
      const compileReview = (narrative?: OperatingReviewNarrative) =>
        savedWorkflow
          ? prepareSavedOperatingReviewRerun(baseArtifacts, savedWorkflow, input, narrative)
          : prepareRuneTaskProvider(baseArtifacts, {
              taskId: "operating-review",
              input,
              ...(narrative ? { narrative } : {}),
            });
      let prepared = compileReview();
      if (!prepared.plan || prepared.errors.length) {
        setOperatingReviewError(prepared.errors[0] ?? "Rune could not prepare this operating review.");
        return;
      }
      let narrative: OperatingReviewNarrative | undefined;
      let provider = "local";
      let modelLabel = "";
      let usage: PendingChange["usage"];
      const assistance = await prepareRuneTaskModelAssistance(
        baseArtifacts,
        { taskId: "operating-review", input },
        { mode: modelMode, fetcher: fetch, onModelRequest: () => setNotice(copy.modelShaping) },
      );
      const fallbackNotice: string =
        assistance.outcome === "local"
          ? copy.localPrepared
          : assistance.outcome === "source-too-large"
            ? copy.sourceTooLargeFallback
            : copy.localFallback;
      if (assistance.narrative) {
        const modelPrepared = compileReview(assistance.narrative);
        if (modelPrepared.plan && !modelPrepared.errors.length) {
          narrative = assistance.narrative;
          prepared = modelPrepared;
          provider = assistance.provider;
          modelLabel = assistance.modelLabel;
          usage = assistance.usage;
        }
      }
      if (!prepared.plan || prepared.errors.length) {
        setOperatingReviewError(prepared.errors[0] ?? "Rune could not prepare this operating review.");
        return;
      }
      const reviewPlan = prepared.plan;
      const savedOperatingReviewAfterApply: SavedOperatingReview | undefined = savedWorkflow
        ? { ...savedWorkflow, input: { ...input, deliverables: [...input.deliverables] } }
        : createSavedOperatingReview(input, reviewPlan);
      if (!savedOperatingReviewAfterApply) {
        setOperatingReviewError("Rune could not resolve the exact outputs for this operating review.");
        return;
      }
      const pendingTaskChange: PendingChange = {
        prompt: input.focus,
        provider,
        ...(narrative ? { planningKind: "task-narrative" as const } : {}),
        scope: "workspace",
        baseRevision,
        savedOperatingReviewAfterApply,
        taskRun: {
          taskId: "operating-review",
          sourceArtifactId: input.dataArtifactId,
          outputArtifactIds: Object.values(savedOperatingReviewAfterApply.artifactIds),
        },
        preparedAt: taskStartedAt,
        usage,
        ...reviewPlan,
      };
      const transaction = prepareWorkspaceMutation(baseArtifacts, reviewPlan.patches, reviewPlan.creations);
      if (transaction.errors.length) {
        recordStoppedRuneTask(pendingTaskChange, "validation");
        setOperatingReviewError(transaction.errors.slice(0, 3).join(" "));
        return;
      }
      let runtimePreflight: RuntimeImpactPreflight | undefined;
      try {
        runtimePreflight = await preflightRuntimeMutation(baseArtifacts, reviewPlan.patches, reviewPlan.creations);
      } catch (error) {
        recordStoppedRuneTask(pendingTaskChange, "runtime");
        throw error;
      }
      if (!workspaceMatchesSourceRevision(artifactsRef.current, baseRevision)) {
        recordStoppedRuneTask({ ...pendingTaskChange, runtimePreflight }, "stale");
        setOperatingReviewError(
          runeText(
            locale,
            "The workspace changed during validation. Prepare the review again from the current data.",
            "验证期间工作区已发生变化。请按当前数据重新准备。",
          ),
        );
        setNotice(
          runeText(locale, "Review not prepared — workspace revision changed", "汇报未生成 — 工作区版本已变化"),
        );
        return;
      }
      const preferredArtifact =
        [...reviewPlan.creations].reverse().find((creation) => creation.artifact.kind === "document") ??
        [...reviewPlan.creations].reverse().find((creation) => creation.artifact.kind === "slides") ??
        reviewPlan.creations.at(-1);
      setPendingChange({
        ...pendingTaskChange,
        selectAfterApplyArtifactId:
          preferredArtifact?.artifact.id ??
          savedOperatingReviewAfterApply.artifactIds.document ??
          savedOperatingReviewAfterApply.artifactIds.slides ??
          savedOperatingReviewAfterApply.artifactIds.chart,
        runtimePreflight,
      });
      setPendingReviewId(reviewPlan.creations[0]?.artifact.id ?? reviewPlan.patches[0]?.artifactId ?? "");
      setAgentMode(narrative ? "openai" : "local");
      setOperatingReviewOpen(false);
      setEditingOperatingReviewId("");
      setTaskSession(null);
      setEmptyWorkspace(false);
      setNotice(
        narrative && modelLabel
          ? `${copy.modelPrepared} · ${modelLabel}`
          : narrative
            ? copy.modelPrepared
            : fallbackNotice,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : "Rune could not validate this operating review.";
      setOperatingReviewError(message);
      setNotice(runeText(locale, "Review not prepared — runtime validation failed", "汇报未生成 — 运行验证未通过"));
    } finally {
      setOperatingReviewState("idle");
    }
  }

  async function prepareDocumentBriefing(input: DocumentBriefingInput) {
    if (documentBriefingState !== "idle" || pendingChange) return;
    const taskStartedAt = Date.now();
    setDocumentBriefingError("");
    setDocumentBriefingState("checking");
    const baseArtifacts = artifactsRef.current;
    const baseRevision = captureWorkspaceSourceRevision(baseArtifacts);
    const copy = documentBriefingNoticeCopy(locale);
    try {
      const assistance = await prepareRuneTaskModelAssistance(
        baseArtifacts,
        { taskId: "document-briefing", input },
        { mode: modelMode, fetcher: fetch, onModelRequest: () => setNotice(copy.modelShaping) },
      );
      const outline = assistance.outline;
      const provider = assistance.provider;
      const modelLabel = assistance.modelLabel;
      const usage = assistance.usage;
      const fallbackNotice: string =
        assistance.outcome === "local"
          ? copy.localPrepared
          : assistance.outcome === "source-too-large"
            ? copy.sourceTooLargeFallback
            : copy.localFallback;

      const prepared = prepareRuneTaskProvider(baseArtifacts, {
        taskId: "document-briefing",
        input,
        ...(outline ? { outline } : {}),
      });
      if (!prepared.plan || prepared.errors.length) {
        setDocumentBriefingError(prepared.errors[0] ?? "Rune could not prepare this presentation.");
        return;
      }
      const outputArtifactId = prepared.plan.patches[0]?.artifactId ?? prepared.plan.creations[0]?.artifact.id;
      if (!outputArtifactId) {
        setDocumentBriefingError("Rune could not resolve the presentation output.");
        return;
      }
      const pendingTaskChange: PendingChange = {
        prompt: input.focus,
        provider,
        ...(outline ? { planningKind: "task-outline" as const } : {}),
        scope: "workspace",
        baseRevision,
        selectAfterApplyArtifactId: outputArtifactId,
        taskRun: {
          taskId: "document-briefing",
          sourceArtifactId: input.sourceArtifactId,
          outputArtifactIds: [outputArtifactId],
        },
        preparedAt: taskStartedAt,
        usage,
        ...prepared.plan,
      };
      const transaction = prepareWorkspaceMutation(baseArtifacts, prepared.plan.patches, prepared.plan.creations);
      if (transaction.errors.length) {
        recordStoppedRuneTask(pendingTaskChange, "validation");
        setDocumentBriefingError(transaction.errors.slice(0, 3).join(" "));
        return;
      }
      let runtimePreflight: RuntimeImpactPreflight | undefined;
      try {
        runtimePreflight = await preflightRuntimeMutation(
          baseArtifacts,
          prepared.plan.patches,
          prepared.plan.creations,
        );
      } catch (error) {
        recordStoppedRuneTask(pendingTaskChange, "runtime");
        throw error;
      }
      if (!workspaceMatchesSourceRevision(artifactsRef.current, baseRevision)) {
        recordStoppedRuneTask({ ...pendingTaskChange, runtimePreflight }, "stale");
        setDocumentBriefingError(
          runeText(
            locale,
            "The workspace changed during validation. Prepare the presentation again from the current document.",
            "验证期间工作区已发生变化。请按当前文档重新准备演示。",
          ),
        );
        setNotice(
          runeText(locale, "Presentation not prepared — workspace revision changed", "演示未生成 — 工作区版本已变化"),
        );
        return;
      }
      setPendingChange({
        ...pendingTaskChange,
        runtimePreflight,
      });
      setPendingReviewId(outputArtifactId);
      setAgentMode(outline ? "openai" : "local");
      setDocumentBriefingOpen(false);
      setPreferredDocumentBriefingTargetId("");
      setTaskSession(null);
      setEmptyWorkspace(false);
      setNotice(
        outline && modelLabel ? `${copy.modelPrepared} · ${modelLabel}` : outline ? copy.modelPrepared : fallbackNotice,
      );
    } catch (error) {
      setDocumentBriefingError(error instanceof Error ? error.message : "Rune could not validate this presentation.");
      setNotice(
        runeText(locale, "Presentation not prepared — runtime validation failed", "演示未生成 — 运行验证未通过"),
      );
    } finally {
      setDocumentBriefingState("idle");
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
      const embedding = prepareChartEmbedding(prepared.nextArtifacts, prepared.artifact.id, embedArtifactId);
      if (!embedding.artifactId || embedding.nextSource == null || embedding.errors.length) {
        setNewArtifactError(embedding.errors[0] ?? "Rune could not prepare that Chart embedding.");
        return;
      }
      const target = artifacts.find((artifact) => artifact.id === embedding.artifactId);
      if (!target) {
        setNewArtifactError("The selected Chart destination is no longer available.");
        return;
      }
      embeddingPatches = [
        {
          artifactId: embedding.artifactId,
          summary: `Embed ${prepared.artifact.name}`,
          detail: "Append one live Chart binding to the selected canonical source.",
          nextSource: embedding.nextSource,
        },
      ];
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
      (committedArtifacts, nextSelectedId) =>
        persistDeviceWorkspace(
          committedArtifacts,
          nextSelectedId,
          nextCheckpoints,
          savedOperatingReviews,
          taskEvidenceRef.current,
        ),
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
    setNotice(
      `Created ${prepared.artifact.name}${embeddedTargetName ? ` and embedded it in ${embeddedTargetName}` : ""} on this device${directoryHandle ? " · Push when ready" : ""}`,
    );
  }

  async function importFile(event: ChangeEvent<HTMLInputElement>) {
    const files = [...(event.target.files ?? [])];
    event.target.value = "";
    await prepareFileImport(files);
  }

  async function importTaskSource(event: ChangeEvent<HTMLInputElement>) {
    const files = [...(event.target.files ?? [])];
    event.target.value = "";
    const taskId = taskImportIdRef.current;
    const activeTaskSession =
      taskSession?.taskId === taskId && taskSession.phase === "awaiting-source"
        ? taskSession
        : startRuneTaskSession(taskId, artifactsRef.current);
    setTaskSession(activeTaskSession);
    await prepareFileImport(files, activeTaskSession);
  }

  async function prepareFileImport(files: File[], activeTaskSession: RuneTaskSession | null = null) {
    if (
      !files.length ||
      importInFlightRef.current ||
      exportInFlightRef.current ||
      pendingImport ||
      pendingPdfOcr ||
      pendingExport ||
      pendingDocumentStructure ||
      exportState !== "idle"
    )
      return;
    if (!activeTaskSession) {
      setTaskSession(null);
    }
    if (files.length > 20) {
      if (activeTaskSession) setTaskSession(null);
      setNotice("Import up to 20 files in one review transaction");
      return;
    }
    const oversized = files.find(
      (file) =>
        file.size >
        (legacyOfficeFileName(file.name)
          ? MAX_LEGACY_OFFICE_IMPORT_BYTES
          : OFFICE_IMPORT_PATTERN.test(file.name)
            ? MAX_OFFICE_IMPORT_BYTES
            : ODF_IMPORT_PATTERN.test(file.name)
              ? MAX_OFFICE_IMPORT_BYTES
              : PDF_IMPORT_PATTERN.test(file.name)
                ? MAX_PDF_IMPORT_BYTES
                : MAX_SOURCE_IMPORT_BYTES),
    );
    if (oversized) {
      if (activeTaskSession) setTaskSession(null);
      setNotice(
        legacyOfficeFileName(oversized.name)
          ? oversized.name + " exceeds the 12 MB desktop legacy Office import limit"
          : OFFICE_IMPORT_PATTERN.test(oversized.name)
            ? oversized.name + " exceeds the 12 MB Office import limit"
            : ODF_IMPORT_PATTERN.test(oversized.name)
              ? oversized.name + " exceeds the 12 MB OpenDocument import limit"
              : PDF_IMPORT_PATTERN.test(oversized.name)
                ? oversized.name + " exceeds the 12 MB PDF import limit"
                : oversized.name + " exceeds the 2 MB source import limit",
      );
      return;
    }
    const baseArtifacts = artifacts;
    const sourceName = files.length === 1 ? files[0].name : String(files.length) + " local files";
    importInFlightRef.current = true;
    setImportState("reading");
    setImportError("");
    setNotice(
      files.length === 1
        ? "Reading " + files[0].name + " locally…"
        : "Reading " + String(files.length) + " files locally…",
    );
    try {
      const ocrCandidates: PdfOcrCandidate[] = [];
      for (const [fileIndex, file] of files.entries()) {
        if (!PDF_IMPORT_PATTERN.test(file.name)) continue;
        const { analyzePdfFile } = await import("../lib/pdf-import-client");
        const analysis = await analyzePdfFile(file.name, await file.arrayBuffer());
        if (analysis.ocrCandidatePageNumbers.length) {
          ocrCandidates.push({ fileIndex, fileName: file.name, file, analysis });
        }
      }
      if (ocrCandidates.length) {
        if (activeTaskSession?.taskId === "operating-review") {
          throw new Error(
            runeText(
              locale,
              "This task starts from CSV, JSON, XLSX, or ODS. Import PDF separately first.",
              "此任务需要从 CSV、JSON、XLSX 或 ODS 开始。请先单独导入 PDF。",
            ),
          );
        }
        setPendingPdfOcr({
          files,
          baseArtifacts,
          sourceName,
          candidates: ocrCandidates,
          ...(activeTaskSession ? { taskSession: activeTaskSession } : {}),
        });
        setPdfOcrError("");
        setPdfOcrProgress(null);
        setNotice(
          runeText(
            locale,
            `Choose scan pages and OCR language for ${ocrCandidates.length} ${ocrCandidates.length === 1 ? "PDF" : "PDFs"}`,
            `请确认 ${ocrCandidates.length} 份 PDF 的扫描页与 OCR 语言`,
          ),
        );
        return;
      }
      const incoming: WorkspaceArtifact[] = [];
      const warnings: string[] = [];
      const assets: PreparedRuneImageAsset[] = [];
      for (const file of files) {
        if (legacyOfficeFileName(file.name)) {
          const result = await importLegacyOfficeThroughDesktop(file);
          incoming.push(...result.artifacts);
          assets.push(...result.assets);
          warnings.push(...result.warnings.map((warning) => file.name + ": " + warning));
          continue;
        }
        if (OFFICE_IMPORT_PATTERN.test(file.name)) {
          const { convertOfficeFileWithAssets } = await import("../lib/office-import");
          const result = await convertOfficeFileWithAssets(file.name, await file.arrayBuffer());
          incoming.push(...result.artifacts);
          assets.push(...result.assets);
          warnings.push(...result.warnings.map((warning) => file.name + ": " + warning));
          continue;
        }
        if (ODF_IMPORT_PATTERN.test(file.name)) {
          const { convertOdfFileWithAssets } = await import("../lib/odf-import");
          const result = await convertOdfFileWithAssets(file.name, await file.arrayBuffer());
          incoming.push(...result.artifacts);
          assets.push(...result.assets);
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
          throw new Error(
            file.name +
              ": choose Markdown, CSV, JSON, SQL, Deck Markdown, HTML, PDF, DOCX, XLSX, PPTX, ODT, ODS, or ODP. Legacy DOC/PPT requires Rune Desktop.",
          );
        }
        incoming.push(artifact);
      }
      const prepared = prepareWorkspaceImportReview(baseArtifacts, incoming, sourceName, warnings, assets);
      if (prepared.errors.length) throw new Error(prepared.errors[0]);
      if (!prepared.review) throw new Error("Rune could not prepare an import review.");
      if (activeTaskSession) {
        const boundTask = bindRuneTaskImportReview(activeTaskSession, baseArtifacts, prepared.review);
        if (!boundTask.session || boundTask.errors.length) {
          throw new Error(boundTask.errors[0] ?? "Rune could not bind this import to the task.");
        }
        setTaskSession(boundTask.session);
      }
      setPendingImport(prepared.review);
      setNotice(
        "Review " +
          String(prepared.review.importedArtifacts.length) +
          " generated " +
          (prepared.review.importedArtifacts.length === 1 ? "source" : "sources") +
          " before importing " +
          sourceName,
      );
    } catch (error) {
      if (activeTaskSession) setTaskSession(null);
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
      setPdfOcrError(
        runeText(
          locale,
          "The workspace changed during OCR setup. Cancel and import again to review a fresh transaction.",
          "OCR 设置期间工作区已经变化。请取消并重新导入，以审核最新事务。",
        ),
      );
      return;
    }
    const selectionByIndex = new Map(selections.map((selection) => [selection.fileIndex, selection]));
    const abortController = new AbortController();
    pdfOcrAbortRef.current = abortController;
    importInFlightRef.current = true;
    setPdfOcrProcessing(true);
    setPdfOcrError("");
    setPdfOcrProgress({
      stage: "loading-model",
      completedPages: 0,
      totalPages: selections.reduce((total, selection) => total + selection.pageNumbers.length, 0),
      progress: 0,
    });
    setImportState("reading");
    try {
      const incoming: WorkspaceArtifact[] = [];
      const warnings: string[] = [];
      const assets: PreparedRuneImageAsset[] = [];
      for (const [fileIndex, file] of pending.files.entries()) {
        if (abortController.signal.aborted) throw new DOMException("OCR cancelled", "AbortError");
        setPdfOcrActiveFileName(file.name);
        if (legacyOfficeFileName(file.name)) {
          const result = await importLegacyOfficeThroughDesktop(file);
          incoming.push(...result.artifacts);
          assets.push(...result.assets);
          warnings.push(...result.warnings.map((warning) => file.name + ": " + warning));
          continue;
        }
        if (OFFICE_IMPORT_PATTERN.test(file.name)) {
          const { convertOfficeFileWithAssets } = await import("../lib/office-import");
          const result = await convertOfficeFileWithAssets(file.name, await file.arrayBuffer());
          incoming.push(...result.artifacts);
          assets.push(...result.assets);
          warnings.push(...result.warnings.map((warning) => file.name + ": " + warning));
          continue;
        }
        if (ODF_IMPORT_PATTERN.test(file.name)) {
          const { convertOdfFileWithAssets } = await import("../lib/odf-import");
          const result = await convertOdfFileWithAssets(file.name, await file.arrayBuffer());
          incoming.push(...result.artifacts);
          assets.push(...result.assets);
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
          throw new Error(
            file.name +
              ": choose Markdown, CSV, JSON, SQL, Deck Markdown, HTML, PDF, DOCX, XLSX, PPTX, ODT, ODS, or ODP. Legacy DOC/PPT requires Rune Desktop.",
          );
        }
        incoming.push(artifact);
      }
      const prepared = prepareWorkspaceImportReview(
        pending.baseArtifacts,
        incoming,
        pending.sourceName,
        warnings,
        assets,
      );
      if (prepared.errors.length) throw new Error(prepared.errors[0]);
      if (!prepared.review) throw new Error("Rune could not prepare an import review.");
      if (pending.taskSession) {
        const boundTask = bindRuneTaskImportReview(pending.taskSession, pending.baseArtifacts, prepared.review);
        if (!boundTask.session || boundTask.errors.length) {
          throw new Error(boundTask.errors[0] ?? "Rune could not bind this OCR import to the task.");
        }
        setTaskSession(boundTask.session);
      }
      setPendingImport(prepared.review);
      setPendingPdfOcr(null);
      setNotice(
        runeText(
          locale,
          `Review ${prepared.review.importedArtifacts.length} generated ${prepared.review.importedArtifacts.length === 1 ? "source" : "sources"} and page-level OCR confidence before import`,
          `请在写入前审核 ${prepared.review.importedArtifacts.length} 份生成的源内容与逐页 OCR 置信度`,
        ),
      );
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        setNotice(runeText(locale, "OCR stopped — the workspace is unchanged", "OCR 已停止 — 工作区保持不变"));
        setPendingPdfOcr(null);
        if (pending.taskSession) setTaskSession(null);
      } else {
        setPdfOcrError(
          error instanceof Error
            ? error.message
            : runeText(locale, "Rune could not recognize those scanned pages.", "Rune 无法识别这些扫描页。"),
        );
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
    if (pendingPdfOcr.taskSession) setTaskSession(null);
    setPdfOcrError("");
    setPdfOcrProgress(null);
    setNotice(runeText(locale, "OCR cancelled — the workspace is unchanged", "已取消 OCR — 工作区保持不变"));
  }

  function cancelPendingImport() {
    if (!pendingImport || importInFlightRef.current) return;
    const sourceName = pendingImport.sourceName;
    setPendingImport(null);
    setImportError("");
    setTaskSession(null);
    setNotice(`Import cancelled — ${sourceName} did not change the workspace`);
  }

  async function applyPendingImport() {
    if (!pendingImport || importInFlightRef.current) return;
    const taskContinuation = taskSession ? prepareRuneTaskAfterImport(taskSession, artifacts, pendingImport) : null;
    if (taskContinuation?.errors.length || (taskSession && !taskContinuation?.session)) {
      setTaskSession(null);
      setImportError(taskContinuation?.errors[0] ?? "Rune could not continue this task from the reviewed import.");
      setNotice(
        runeText(locale, "Import held for review — task context changed", "导入仍在等待审核 — 任务上下文已变化"),
      );
      return;
    }
    const contextErrors = validateWorkspaceImportReview(artifacts, pendingImport);
    if (contextErrors.length) {
      setImportError(contextErrors[0]);
      setNotice("Import held for review — workspace context changed");
      return;
    }
    const firstImported = pendingImport.importedArtifacts[0];
    const importedAssetIds: string[] = [];
    importInFlightRef.current = true;
    setImportState("reading");
    try {
      for (const asset of pendingImport.assets) {
        if (await putRuneImageAsset(asset)) importedAssetIds.push(asset.id);
      }
      persistDeviceWorkspace(
        pendingImport.nextArtifacts,
        firstImported.id,
        checkpoints,
        savedOperatingReviews,
        taskEvidenceRef.current,
      );
    } catch (error) {
      await Promise.all(importedAssetIds.map((id) => deleteRuneImageAsset(id).catch(() => undefined)));
      setSaveState("error");
      setImportError(
        error instanceof Error
          ? `${error.message} Rune removed every image created by this attempt and kept all sources unchanged.`
          : "Device storage failed. Rune removed every image created by this attempt and kept all sources unchanged.",
      );
      setNotice("Nothing imported — atomic source and image persistence failed");
      importInFlightRef.current = false;
      setImportState("idle");
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
    importInFlightRef.current = false;
    setImportState("idle");
    if (taskContinuation?.session && taskContinuation.preferredArtifactId) {
      setTaskSession(taskContinuation.session);
      if (taskContinuation.session.taskId === "document-briefing") {
        setDocumentBriefingError("");
        setDocumentBriefingOpen(true);
        setNotice(
          runeText(
            locale,
            `Imported ${importedCount} readable ${importedCount === 1 ? "source" : "sources"}; choose the audience, purpose, and presentation length`,
            `已导入 ${importedCount} 份可读文档；请选择受众、重点与演示页数`,
          ),
        );
      } else {
        setOperatingReviewError("");
        setEditingOperatingReviewId("");
        setOperatingReviewOpen(true);
        setNotice(
          runeText(
            locale,
            `Imported ${importedCount} readable ${importedCount === 1 ? "source" : "sources"}; choose the fields and deliverables for the review`,
            `已导入 ${importedCount} 份可读数据；请选择汇报字段与交付物`,
          ),
        );
      }
      return;
    }
    setTaskSession(null);
    setNotice(
      `Imported ${importedCount} readable ${importedCount === 1 ? "source" : "sources"} from ${sourceName}${warningCount ? ` · ${warningCount} fidelity ${warningCount === 1 ? "note" : "notes"} reviewed` : ""}`,
    );
  }

  function downloadSelectedArtifactSource() {
    const artifact = selectedArtifact;
    downloadArtifact(artifact);
    const target: RuneTaskDeliveryTarget | null =
      artifact.kind === "document"
        ? "md"
        : artifact.kind === "slides" && isDeckMarkdownArtifact(artifact)
          ? "deck-md"
          : null;
    if (target)
      openDeliveryConfirmationForArtifact(artifact, "download", target, `${target.toUpperCase()} · ${ui.download}`);
  }

  async function prepareExport(destination: "office" | "legacy-office" | "odf" | "html" | "pdf" | "csv" | "json") {
    const targetType =
      destination === "office"
        ? selectedOfficeExportType
        : destination === "legacy-office"
          ? selectedLegacyOfficeExportType
          : destination === "odf"
            ? selectedOdfExportType
            : destination === "html"
              ? selectedHtmlExport
                ? "HTML"
                : null
              : destination === "pdf"
                ? selectedPdfExport
                  ? "PDF"
                  : null
                : selectedArtifact.kind === "data"
                  ? destination.toUpperCase()
                  : null;
    if (
      !targetType ||
      exportState !== "idle" ||
      activeVisualSourceDraft ||
      pendingExport ||
      pendingImport ||
      pendingPdfOcr ||
      pendingDocumentStructure ||
      importInFlightRef.current ||
      exportInFlightRef.current
    )
      return;
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
        querySnapshots = await Promise.all(
          querySourceIds.map((queryId) => {
            const queryArtifact = baseArtifacts.find(
              (artifact) => artifact.id === queryId && artifact.kind === "query",
            );
            if (!queryArtifact) throw new Error(`Query source not found: ${queryId}`);
            const dataResolution = resolveQueryDataArtifact(queryArtifact, baseArtifacts);
            if (!dataResolution.artifact)
              throw new Error(dataResolution.errors[0] ?? `Data source not found for ${queryArtifact.name}`);
            return runWorkspaceQuerySnapshot(queryArtifact, dataResolution.artifact);
          }),
        );
        const truncated = querySnapshots.find((snapshot) => snapshot.result.truncated);
        if (truncated)
          throw new Error(`Narrow ${truncated.queryArtifactName} to 500 rows or fewer before exporting its consumers.`);
      }
      const imageAssets =
        (targetArtifact.kind === "document" ||
          (targetArtifact.kind === "slides" && isDeckMarkdownArtifact(targetArtifact))) &&
        extractRuneAssetIds(targetArtifact.source).length
          ? await collectWorkspaceLocalAssets([targetArtifact])
          : [];
      if (destination === "csv" || destination === "json") {
        const { exportPortableDataArtifact } = await import("../lib/data-export");
        result = exportPortableDataArtifact(targetArtifact, destination);
      } else if (destination === "office" || destination === "legacy-office" || destination === "odf") {
        const compiled =
          targetArtifact.kind === "document" || targetArtifact.kind === "slides"
            ? compileArtifactSource(targetArtifact.source, baseArtifacts, querySnapshots)
            : null;
        if (compiled?.metricBindingErrors.length) throw new Error(compiled.metricBindingErrors[0]);
        if (compiled?.unresolved.length)
          throw new Error(
            `Resolve ${compiled.unresolved.length} missing metric ${compiled.unresolved.length === 1 ? "reference" : "references"} before ${destination === "odf" ? "OpenDocument" : "Office"} export.`,
          );
        if (compiled?.unresolvedQueryMetrics.length) throw new Error(compiled.unresolvedQueryMetrics[0]);
        if (compiled?.pendingQueryMetrics.length)
          throw new Error(
            `Run ${compiled.pendingQueryMetrics[0]} before ${destination === "odf" ? "OpenDocument" : "Office"} export.`,
          );
        if (compiled?.queryMetricRuntimeErrors.length) throw new Error(compiled.queryMetricRuntimeErrors[0]);
        if (compiled?.unresolvedCharts.length)
          throw new Error(
            `Resolve ${compiled.unresolvedCharts.length} missing chart ${compiled.unresolvedCharts.length === 1 ? "reference" : "references"} before ${destination === "odf" ? "OpenDocument" : "Office"} export.`,
          );
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
        result = exportDeckHtml(targetArtifact, baseArtifacts, querySnapshots, imageAssets);
      } else {
        const { exportPdfArtifact } = await import("../lib/pdf-export");
        result = await exportPdfArtifact(targetArtifact, baseArtifacts, querySnapshots, undefined, imageAssets);
      }
      setPendingExport({
        sourceArtifactId: targetArtifact.id,
        sourceArtifactName: targetArtifact.name,
        sourceRevision: targetArtifact.source,
        baseArtifacts,
        result,
      });
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
      setExportError(
        "The workspace changed while this file was being generated. Cancel and export it again to review fresh output.",
      );
      setNotice("Export held for review — workspace context changed");
      return;
    }
    const { result, sourceArtifactId, sourceRevision } = pendingExport;
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
    const exportLabel =
      result.targetType === "html"
        ? "standalone HTML"
        : result.targetType === "pdf"
          ? "fixed PDF"
          : result.targetType === "csv" || result.targetType === "json"
            ? `portable ${result.targetType.toUpperCase()}`
            : `semantic ${result.targetType.toUpperCase()}`;
    setNotice(`Downloaded ${result.fileName} · ${exportLabel} export`);
    const exportedArtifact = pendingExport.baseArtifacts.find(
      (artifact) => artifact.id === sourceArtifactId && artifact.source === sourceRevision,
    );
    if (exportedArtifact) {
      openDeliveryConfirmationForArtifact(
        exportedArtifact,
        "download",
        result.targetType,
        `${result.targetType.toUpperCase()} · ${ui.download}`,
      );
    }
  }

  function reviewPilotEvidenceExport() {
    setToolsMenuOpen(false);
    setPilotEvidenceError("");
    try {
      const baseEvidence = taskEvidenceRef.current;
      const result = prepareRunePilotEvidenceExport(baseEvidence);
      setPendingPilotEvidence({ baseEvidence, result });
      setNotice(`${pilotEvidenceUI.reviewNotice} · ${result.package.runs.length}`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : pilotEvidenceUI.prepareError);
    }
  }

  function cancelPilotEvidenceExport() {
    if (!pendingPilotEvidence) return;
    setPendingPilotEvidence(null);
    setPilotEvidenceError("");
    setNotice(pilotEvidenceUI.cancelNotice);
  }

  function confirmPilotEvidenceExport() {
    if (!pendingPilotEvidence) return;
    if (taskEvidenceRef.current !== pendingPilotEvidence.baseEvidence) {
      setPilotEvidenceError(pilotEvidenceUI.changedError);
      setNotice(pilotEvidenceUI.changedNotice);
      return;
    }
    const { result } = pendingPilotEvidence;
    const bytes = new Uint8Array(result.bytes).buffer;
    const url = URL.createObjectURL(new Blob([bytes], { type: `${result.mimeType};charset=utf-8` }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = result.fileName;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
    setPendingPilotEvidence(null);
    setPilotEvidenceError("");
    setNotice(`${pilotEvidenceUI.downloadedNotice} · ${result.fileName}`);
  }

  function onPromptKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
      event.preventDefault();
      void runAgent();
    }
  }

  function changeAgentScope(scope: AgentScope) {
    setAgentScope(scope);
    setPendingChange(null);
    setPendingReviewId("");
    setAgentError("");
    setNotice(
      scope === "workspace"
        ? `Workspace Agent scope enabled · ${workspaceAgentContext.length} context sources${workspacePinnedArtifactIds.length ? ` · ${workspacePinnedArtifactIds.length} pinned` : ""}`
        : scope === "selection"
          ? `${formatInteger(selectedCharacterCount)} selected characters bound to Agent scope`
          : "Current-file Agent scope enabled",
    );
  }

  function runWorkbenchCommand(commandId: RuneWorkbenchCommandId) {
    setCommandMenuOpen(false);
    setExportMenuOpen(false);
    setToolsMenuOpen(false);
    switch (commandId) {
      case "new-artifact":
        openNewArtifact();
        return;
      case "import-files":
        beginStandardImport();
        return;
      case "open-folder":
        void connectWorkspaceFolder();
        return;
      case "operating-review":
        openOperatingReview();
        return;
      case "document-briefing":
        openDocumentBriefing();
        return;
      case "focus-agent":
        window.requestAnimationFrame(() => promptRef.current?.focus({ preventScroll: true }));
        setNotice(ui.focusAgent);
        return;
      case "show-split":
      case "show-source":
      case "show-preview": {
        const view = commandId === "show-split" ? "split" : commandId === "show-source" ? "source" : "preview";
        setPreferredWorkspaceView(view);
        setNotice(view === "split" ? ui.showSplitView : view === "source" ? ui.showSourceView : ui.showPreviewView);
        return;
      }
      case "save-checkpoint":
        saveManualCheckpoint();
        return;
      case "close-file":
        closeCurrentArtifact();
        return;
      case "toggle-files":
        setFileRailOpen((open) => !open);
        return;
      case "open-guide":
        openWelcomeGuide();
        return;
      case "open-models":
        setWelcomeStartAt("model");
        setWelcomeDismissible(true);
        setWelcomeOpen(true);
        return;
    }
  }

  const artifactGroups = [
    { id: "sources", label: ui.sources, artifacts: artifacts.filter((artifact) => artifact.kind === "data") },
    {
      id: "analysis",
      label: ui.analysis,
      artifacts: artifacts.filter((artifact) => artifact.kind === "query" || artifact.kind === "chart"),
    },
    {
      id: "deliverables",
      label: ui.deliverables,
      artifacts: artifacts.filter((artifact) => artifact.kind === "document" || artifact.kind === "slides"),
    },
  ].filter((group) => group.artifacts.length > 0);
  const documentBriefingRuns = taskEvidence.runs.filter((run) => run.taskId === "document-briefing");
  const documentBriefingRunSummary = summarizeRuneTaskRuns(documentBriefingRuns);
  const documentBriefingDeliveries = taskEvidence.deliveries.filter(
    (delivery) => delivery.taskId === "document-briefing",
  );
  const documentBriefingDeliverySummary = summarizeRuneTaskDeliveries(documentBriefingDeliveries);
  const saveStatusLabel = saveState === "saved" ? ui.saved : saveState === "error" ? ui.storageFull : ui.saving;
  const saveStatusDetail = saveState === "error" ? ui.deviceStorageFull : ui.lastSaved(savedAt || ui.justNow);

  return (
    <main className="rune-shell" ref={shellRef}>
      <Suspense fallback={<DeferredWorkbenchSurfaceFallback locale={locale} />}>
        {commandMenuOpen && (
          <WorkbenchCommandMenu
            commands={workbenchCommands}
            locale={locale}
            direction={localeDirection(locale)}
            onClose={() => setCommandMenuOpen(false)}
            onRun={runWorkbenchCommand}
          />
        )}
      </Suspense>
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
          <div className="brand-mark" aria-hidden="true">
            <span>R</span>
          </div>
          <div className="brand-copy">
            <strong>Rune</strong>
          </div>
          <span className="project-separator" aria-hidden="true" />
          <div className="project-name">{directoryHandle?.name ?? ui.localWorkspace}</div>
        </div>
        <div className="topbar-actions">
          <div
            className={`save-indicator ${saveState}`}
            role="status"
            aria-label={`${saveStatusLabel} · ${saveStatusDetail}`}
            title={`${saveStatusLabel} · ${saveStatusDetail}`}
          >
            {saveState === "saved" ? <Check /> : <CircleDot />}
            <span className="visually-hidden">{saveStatusLabel}</span>
          </div>
          <button
            className="icon-button command-menu-trigger"
            type="button"
            onClick={() => {
              setExportMenuOpen(false);
              setToolsMenuOpen(false);
              setCommandMenuOpen(true);
            }}
            aria-label={`${commandMenuCopy.title} · ⌘ ⇧ P`}
            title={`${commandMenuCopy.title} · ⌘ ⇧ P / Ctrl Shift P`}
          >
            <Search aria-hidden="true" />
          </button>
          <button className="button ghost-button" onClick={openNewArtifact} disabled={artifactCreationDisabled}>
            <FilePlus2 aria-hidden="true" /> {ui.newArtifact}
          </button>
          <button
            className="button ghost-button"
            onClick={beginStandardImport}
            disabled={
              !hydrated ||
              importState === "reading" ||
              exportState !== "idle" ||
              visualEditState !== "idle" ||
              Boolean(activeVisualSourceDraft) ||
              Boolean(pendingImport) ||
              Boolean(pendingPdfOcr) ||
              Boolean(pendingExport) ||
              Boolean(pendingDocumentStructure)
            }
          >
            {importState === "reading" ? (
              <LoaderCircle className="agent-spinner" aria-hidden="true" />
            ) : (
              <Upload aria-hidden="true" />
            )}{" "}
            {ui.import}
          </button>
          {!emptyWorkspace && (
            <div className="export-menu" ref={exportMenuRef}>
              <button
                className={`button ghost-button export-menu-trigger ${exportMenuOpen ? "active" : ""}`.trim()}
                type="button"
                onClick={() => {
                  setToolsMenuOpen(false);
                  setExportMenuOpen((open) => !open);
                }}
                disabled={
                  !hydrated ||
                  exportState !== "idle" ||
                  importState === "reading" ||
                  visualEditState !== "idle" ||
                  Boolean(activeVisualSourceDraft) ||
                  Boolean(pendingImport) ||
                  Boolean(pendingPdfOcr) ||
                  Boolean(pendingExport) ||
                  Boolean(pendingDocumentStructure)
                }
                aria-haspopup="menu"
                aria-expanded={exportMenuOpen}
              >
                {exportState === "idle" ? (
                  <FileOutput aria-hidden="true" />
                ) : (
                  <LoaderCircle className="agent-spinner" aria-hidden="true" />
                )}
                <span>{ui.exportMenu}</span>
                <ChevronDown aria-hidden="true" />
              </button>
              {exportMenuOpen && (
                <div className="export-popover" role="menu" aria-label={ui.exportMenuBody}>
                  <div>
                    <span className="overline">{ui.exportMenu}</span>
                    <strong>{ui.exportMenuBody}</strong>
                  </div>
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setExportMenuOpen(false);
                      downloadSelectedArtifactSource();
                    }}
                  >
                    <Download aria-hidden="true" />
                    <span>
                      <strong>{ui.canonicalSource}</strong>
                      <small>{selectedArtifact.name}</small>
                    </span>
                  </button>
                  {selectedArtifact.kind === "data" && (
                    <>
                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => {
                          setExportMenuOpen(false);
                          void prepareExport("csv");
                        }}
                      >
                        <FileCode2 aria-hidden="true" />
                        <span>
                          <strong>CSV</strong>
                          <small>{ui.exportAs("CSV")}</small>
                        </span>
                      </button>
                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => {
                          setExportMenuOpen(false);
                          void prepareExport("json");
                        }}
                      >
                        <FileCode2 aria-hidden="true" />
                        <span>
                          <strong>JSON</strong>
                          <small>{ui.exportAs("JSON")}</small>
                        </span>
                      </button>
                    </>
                  )}
                  {selectedOfficeExportType && (
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setExportMenuOpen(false);
                        void prepareExport("office");
                      }}
                    >
                      <FileArchive aria-hidden="true" />
                      <span>
                        <strong>{selectedOfficeExportType}</strong>
                        <small>{ui.exportAs(selectedOfficeExportType)}</small>
                      </span>
                    </button>
                  )}
                  {legacyOfficeExportAvailable && selectedLegacyOfficeExportType && (
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setExportMenuOpen(false);
                        void prepareExport("legacy-office");
                      }}
                    >
                      <FileArchive aria-hidden="true" />
                      <span>
                        <strong>{selectedLegacyOfficeExportType}</strong>
                        <small>{ui.exportAs(selectedLegacyOfficeExportType)} · Rune Desktop</small>
                      </span>
                    </button>
                  )}
                  {selectedOdfExportType && (
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setExportMenuOpen(false);
                        void prepareExport("odf");
                      }}
                    >
                      <FileArchive aria-hidden="true" />
                      <span>
                        <strong>{selectedOdfExportType}</strong>
                        <small>{ui.exportAsOpenDocument(selectedOdfExportType)}</small>
                      </span>
                    </button>
                  )}
                  {selectedHtmlExport && (
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setExportMenuOpen(false);
                        void prepareExport("html");
                      }}
                    >
                      <FileCode2 aria-hidden="true" />
                      <span>
                        <strong>HTML</strong>
                        <small>{ui.exportStandaloneHtml}</small>
                      </span>
                    </button>
                  )}
                  {selectedPdfExport && (
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setExportMenuOpen(false);
                        void prepareExport("pdf");
                      }}
                    >
                      <FileText aria-hidden="true" />
                      <span>
                        <strong>PDF</strong>
                        <small>{ui.exportFixedPdf}</small>
                      </span>
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
          {!emptyWorkspace && (
            <span className="visually-hidden" aria-live="polite">
              {exportState === "idle" ? "" : `${ui.exportMenu} ${exportState}`}
            </span>
          )}
          <input
            ref={importRef}
            className="visually-hidden"
            type="file"
            multiple
            aria-label={ui.import}
            accept=".doc,.ppt,.docx,.xlsx,.pptx,.odt,.ods,.odp,.pdf,.deck.md,.md,.markdown,.csv,.json,.sql,.html,.htm"
            onChange={importFile}
            disabled={
              !hydrated ||
              importState === "reading" ||
              exportState !== "idle" ||
              visualEditState !== "idle" ||
              Boolean(activeVisualSourceDraft) ||
              Boolean(pendingImport) ||
              Boolean(pendingPdfOcr) ||
              Boolean(pendingExport) ||
              Boolean(pendingDocumentStructure)
            }
          />
          <input
            ref={taskImportRef}
            className="visually-hidden"
            type="file"
            multiple
            aria-label={ui.import}
            accept={RUNE_TASK_DEFINITIONS[taskSession?.taskId ?? "operating-review"].sourceAccept}
            onChange={importTaskSource}
            disabled={
              !hydrated ||
              importState === "reading" ||
              exportState !== "idle" ||
              visualEditState !== "idle" ||
              Boolean(activeVisualSourceDraft) ||
              Boolean(pendingImport) ||
              Boolean(pendingPdfOcr) ||
              Boolean(pendingExport) ||
              Boolean(pendingDocumentStructure)
            }
          />
          <input
            ref={imageImportRef}
            className="visually-hidden"
            type="file"
            aria-label={localImageUI.insertLocal}
            accept={RUNE_IMAGE_ACCEPT}
            onChange={(event) => void prepareLocalImage(event)}
            disabled={
              !hydrated ||
              !(
                selectedArtifact.kind === "document" ||
                (selectedArtifact.kind === "slides" && isDeckMarkdownArtifact(selectedArtifact))
              ) ||
              visualEditState !== "idle" ||
              Boolean(activeVisualSourceDraft) ||
              Boolean(pendingChange) ||
              Boolean(pendingImport) ||
              Boolean(pendingPdfOcr) ||
              Boolean(pendingExport) ||
              Boolean(pendingDocumentStructure) ||
              Boolean(pendingLocalImage)
            }
          />
        </div>
      </header>

      <div
        ref={workspaceRef}
        className={`workspace ${fileRailOpen ? "with-file-rail" : "without-file-rail"} view-${workspaceView}`}
        style={
          {
            "--workspace-source-track": workspaceSplitTracks(workspaceSourcePercent).source,
            "--workspace-preview-track": workspaceSplitTracks(workspaceSourcePercent).preview,
          } as CSSProperties
        }
      >
        <WorkbenchActivityRail
          railView={railView}
          sectionLabel={ui.runeSections}
          workspaceFilesLabel={ui.workspaceFiles}
          newArtifactLabel={ui.newArtifact}
          createOperatingReviewLabel={ui.createOperatingReview}
          documentBriefingLabel={runeText(
            locale,
            "Create or refresh presentation from document",
            "从文档创建或刷新演示",
          )}
          focusAgentLabel={ui.focusAgent}
          dataGraphLabel={ui.dataGraph}
          resetSampleLabel={ui.resetSample}
          settingsLabel={ui.moreTools}
          settingsExpanded={toolsMenuOpen}
          newArtifactDisabled={artifactCreationDisabled}
          operatingReviewDisabled={artifactCreationDisabled}
          documentBriefingDisabled={
            artifactCreationDisabled || !artifacts.some((artifact) => artifact.kind === "document")
          }
          onSelectWorkspace={() => {
            setRailView("workspace");
            setFileRailOpen(true);
          }}
          onSelectGraph={() => {
            setRailView("graph");
            setFileRailOpen(true);
          }}
          onNewArtifact={openNewArtifact}
          onOperatingReview={openOperatingReview}
          onDocumentBriefing={openDocumentBriefing}
          onFocusAgent={() => {
            promptRef.current?.focus();
            setNotice(ui.focusAgent);
          }}
          onReset={resetWorkspace}
          onToggleSettings={() => {
            setExportMenuOpen(false);
            setToolsMenuOpen((open) => !open);
          }}
        />

        {toolsMenuOpen && (
          <div className="tools-popover settings-popover" role="menu" aria-label={ui.workspaceTools} ref={toolsMenuRef}>
            <header>
              <span className="overline">{ui.workspaceTools}</span>
              <strong>{ui.workspaceToolsBody}</strong>
            </header>
            <div className="tools-menu-actions">
              <button
                type="button"
                role="menuitem"
                disabled={Boolean(activeVisualSourceDraft)}
                onClick={() => {
                  setToolsMenuOpen(false);
                  openWelcomeGuide();
                }}
              >
                <BookOpen aria-hidden="true" />
                <span>
                  <strong>{ui.help}</strong>
                  <small>{ui.brandSubtitle}</small>
                </span>
              </button>
              <button
                type="button"
                role="menuitem"
                disabled={Boolean(activeVisualSourceDraft)}
                onClick={() => {
                  setToolsMenuOpen(false);
                  openModelSettings();
                }}
              >
                <Settings aria-hidden="true" />
                <span>
                  <strong>{ui.models}</strong>
                  <small>{ui.localFirst}</small>
                </span>
              </button>
              <button
                type="button"
                role="menuitem"
                disabled={!taskEvidence.runs.length || Boolean(activeVisualSourceDraft)}
                onClick={reviewPilotEvidenceExport}
              >
                <FileCode2 aria-hidden="true" />
                <span>
                  <strong>{pilotEvidenceUI.menuTitle}</strong>
                  <small>{taskEvidence.runs.length ? pilotEvidenceUI.menuBody : pilotEvidenceUI.menuEmpty}</small>
                </span>
              </button>
              <button
                type="button"
                role="menuitem"
                disabled={directoryState === "syncing" || Boolean(activeVisualSourceDraft)}
                onClick={() => {
                  setToolsMenuOpen(false);
                  void connectWorkspaceFolder();
                }}
              >
                <FolderOpen aria-hidden="true" />
                <span>
                  <strong>{directoryHandle?.name ?? ui.openFolder}</strong>
                  <small>{ui.workspace}</small>
                </span>
              </button>
              {directoryHandle && (
                <button
                  type="button"
                  role="menuitem"
                  disabled={directoryState === "syncing" || Boolean(activeVisualSourceDraft)}
                  onClick={() => {
                    setToolsMenuOpen(false);
                    void pullWorkspaceFolder();
                  }}
                >
                  <RefreshCw aria-hidden="true" />
                  <span>
                    <strong>{ui.pull}</strong>
                    <small>
                      {directoryState === "changed"
                        ? runeText(locale, "Changes detected", "检测到变化")
                        : directoryHandle.name}
                    </small>
                  </span>
                </button>
              )}
              {directoryHandle && (
                <button
                  type="button"
                  role="menuitem"
                  disabled={directoryState === "syncing" || Boolean(activeVisualSourceDraft)}
                  onClick={() => {
                    setToolsMenuOpen(false);
                    void pushWorkspaceFolder();
                  }}
                >
                  <Save aria-hidden="true" />
                  <span>
                    <strong>{ui.push}</strong>
                    <small>{directoryHandle.name}</small>
                  </span>
                </button>
              )}
            </div>
            <div className="tools-appearance-header">
              <Palette aria-hidden="true" />
              <span>
                <strong>{ui.appearance}</strong>
                <small>{ui.appearanceBody}</small>
              </span>
            </div>
            <div className="tools-material-preview" aria-live="polite">
              <span
                className="appearance-swatch"
                aria-hidden="true"
                style={{
                  background: `linear-gradient(145deg, ${activeAppearance.finish[0]}, ${activeAppearance.finish[1]})`,
                }}
              />
              <span>
                <small>{ui.activeTheme}</small>
                <strong>{runeText(locale, activeAppearance.english, activeAppearance.chinese)}</strong>
              </span>
            </div>
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
                  <span
                    className="appearance-swatch"
                    aria-hidden="true"
                    style={{ background: `linear-gradient(145deg, ${theme.finish[0]}, ${theme.finish[1]})` }}
                  />
                  <span className="tools-theme-name">{runeText(locale, theme.english, theme.chinese)}</span>
                  {appearanceTheme === theme.id && <Check aria-hidden="true" />}
                </button>
              ))}
            </div>
            <footer className="tools-version">
              <span>{ui.version}</span>
              <strong>Rune {RUNE_PRODUCT_VERSION}</strong>
            </footer>
          </div>
        )}

        {fileRailOpen &&
          (railView === "graph" ? (
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
                <div>
                  <span className="overline">{ui.workspace}</span>
                  <strong>{directoryHandle?.name ?? ui.localWorkspace}</strong>
                </div>
                <button
                  className="tiny-icon-button"
                  onClick={openNewArtifact}
                  disabled={artifactCreationDisabled}
                  aria-label={runeText(locale, "Create a new artifact", "新建内容")}
                  title={ui.newArtifact}
                >
                  +
                </button>
              </div>
              <nav className="artifact-groups" aria-label={ui.artifacts}>
                {artifactGroups.map((group) => (
                  <section
                    className={`artifact-group artifact-group-${group.id}`}
                    aria-labelledby={`artifact-group-${group.id}`}
                    key={group.id}
                  >
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
                        const inAgentContext = workspaceAgentContext.some(
                          (contextArtifact) => contextArtifact.id === artifact.id,
                        );
                        const briefingFreshness = documentBriefingTargetsById.get(artifact.id)?.freshness;
                        return (
                          <div
                            className={`artifact-row-shell ${inAgentContext ? "in-agent-context" : ""} ${briefingFreshness === "changed" ? "has-refresh" : ""}`.trim()}
                            data-agent-context={inAgentContext ? "true" : undefined}
                            key={artifact.id}
                          >
                            <button
                              className={`artifact-row ${artifact.id === selectedArtifact.id ? "active" : ""}`}
                              disabled={Boolean(activeVisualSourceDraft)}
                              onClick={() => selectArtifact(artifact.id)}
                            >
                              <span className={`artifact-icon ${artifact.kind}`}>
                                <ArtifactIcon kind={artifact.kind} />
                              </span>
                              <span className="artifact-label">
                                <strong>{artifact.name}</strong>
                                <small>
                                  <span>
                                    {artifact.language}
                                    {referenceCount ? ` · ${ui.liveBindings(referenceCount)}` : ""}
                                  </span>
                                  {briefingFreshness === "changed" && (
                                    <span className="artifact-refresh-status">{ui.refreshAvailable}</span>
                                  )}
                                </small>
                              </span>
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
                            {briefingFreshness === "changed" && (
                              <button
                                type="button"
                                className="artifact-refresh-action"
                                aria-label={`${ui.reviewRefresh} · ${artifact.name}`}
                                title={ui.reviewRefresh}
                                disabled={artifactCreationDisabled}
                                onClick={() => reviewLinkedPresentationRefresh(artifact.id)}
                              >
                                <RefreshCw aria-hidden="true" />
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </section>
                ))}
              </nav>
              {!!savedOperatingReviews.length && (
                <section className="saved-review-list" aria-label={ui.savedReviews}>
                  <div className="artifact-group-label">
                    <span>{ui.savedReviews}</span>
                    <span>{savedOperatingReviews.length}</span>
                  </div>
                  {savedOperatingReviews.map((workflow) => {
                    const complete =
                      artifacts.some((artifact) => artifact.id === workflow.input.dataArtifactId) &&
                      Object.values(workflow.artifactIds).every((artifactId) =>
                        artifacts.some((artifact) => artifact.id === artifactId),
                      );
                    const workflowRuns = runeTaskRunsForIdentity(taskEvidence, {
                      taskId: "operating-review",
                      sourceArtifactId: workflow.input.dataArtifactId,
                      outputArtifactIds: Object.values(workflow.artifactIds),
                    });
                    const latestRun = workflowRuns[0];
                    const runSummary = summarizeRuneTaskRuns(workflowRuns);
                    const workflowRunIds = new Set(workflowRuns.map((run) => run.id));
                    const workflowDeliveries = taskEvidence.deliveries.filter(
                      (delivery) => delivery.taskId === "operating-review" && workflowRunIds.has(delivery.runId),
                    );
                    const deliverySummary = summarizeRuneTaskDeliveries(workflowDeliveries);
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
                          <span>
                            <strong>{workflow.input.title}</strong>
                            <small>
                              {complete ? `${workflow.input.period} · ${ui.rerun}` : ui.reviewSourceMissing}
                            </small>
                          </span>
                          <Play aria-hidden="true" />
                        </button>
                        <div className="saved-review-metrics">
                          <span>
                            {ui.operatingReviewTask} ·{" "}
                            {latestRun
                              ? `${ui.taskRuns(workflowRuns.length)} · ${ui.lastRun} ${latestRun.status === "applied" ? ui.runApplied : ui.runStopped}`
                              : ui.noTaskRuns}
                          </span>
                          {latestRun && (
                            <span>
                              {ui.successRate(runSummary.successRate)} ·{" "}
                              {ui.averageReviewTime(runSummary.averageDurationMs)}
                            </span>
                          )}
                          <span>
                            {deliverySummary.total
                              ? `${deliverySummary.total} ${ui.confirmedDeliverables} · ${deliverySummary.usableRate}% ${ui.usableDeliverables}`
                              : ui.noDeliveryOutcomes}
                          </span>
                          {!!deliverySummary.reviewedRealTasks && (
                            <span>
                              {deliverySummary.reviewedRealTasks} {ui.realTasksReviewed} ·{" "}
                              {deliverySummary.numberCorrectnessBelow4} {ui.numberChecksBelowFour}
                            </span>
                          )}
                        </div>
                        {!!workflowRuns.length && (
                          <details className="saved-review-history">
                            <summary>{ui.runHistory}</summary>
                            <ol>
                              {workflowRuns.map((run) => {
                                const runDeliveries = workflowDeliveries.filter(
                                  (delivery) => delivery.runId === run.id,
                                );
                                return (
                                  <li key={run.id}>
                                    <span className={run.status}>
                                      {run.status === "applied" ? ui.runApplied : ui.runStopped}
                                    </span>
                                    <strong>{workflow.input.period}</strong>
                                    <small>
                                      {run.completedAt.slice(0, 10)} ·{" "}
                                      {ui.runImpact(run.changedFileCount, run.queryCount, run.chartConsumerCount)}
                                    </small>
                                    <small>
                                      {ui.taskTime} {Math.max(1, Math.round(run.durationMs / 1000))}s · {run.provider}
                                    </small>
                                    <small>
                                      {run.status === "stopped" && run.stopReason
                                        ? ui.stopReasons[run.stopReason]
                                        : ui.tokenUse(run.inputTokens, run.outputTokens)}
                                    </small>
                                    {runDeliveries.map((delivery) => (
                                      <small key={delivery.id}>
                                        {ui.deliveryRatings[delivery.rating]} · {delivery.target.toUpperCase()}
                                        {delivery.evaluation
                                          ? ` · ${ui.numberScore} ${delivery.evaluation.rubric.numberCorrectness}/5`
                                          : ""}
                                      </small>
                                    ))}
                                  </li>
                                );
                              })}
                            </ol>
                          </details>
                        )}
                        {!!workflow.runs.length && (
                          <details className="saved-review-history legacy-task-evidence">
                            <summary>
                              {ui.earlierDeviceRecords} · {workflow.runs.length}
                            </summary>
                            <ol>
                              {workflow.runs.map((run) => {
                                const runDeliveries = workflow.deliveries.filter(
                                  (delivery) => delivery.runId === run.id,
                                );
                                return (
                                  <li key={run.id}>
                                    <span className={run.status}>
                                      {run.status === "applied" ? ui.runApplied : ui.runStopped}
                                    </span>
                                    <strong>{run.period}</strong>
                                    <small>
                                      {run.completedAt.slice(0, 10)} ·{" "}
                                      {ui.runImpact(run.changedFileCount, run.queryCount, run.chartConsumerCount)}
                                    </small>
                                    <small>
                                      {run.status === "stopped" && run.stopReason
                                        ? ui.stopReasons[run.stopReason]
                                        : ui.tokenUse(run.inputTokens, run.outputTokens)}
                                    </small>
                                    {runDeliveries.map((delivery) => (
                                      <small key={delivery.id}>
                                        {ui.deliveryRatings[delivery.rating]} · {delivery.target.toUpperCase()}
                                      </small>
                                    ))}
                                  </li>
                                );
                              })}
                            </ol>
                          </details>
                        )}
                      </article>
                    );
                  })}
                </section>
              )}
              {!!documentBriefingRuns.length && (
                <section className="saved-review-list task-evidence-list" aria-label={ui.recentTaskRuns}>
                  <div className="artifact-group-label">
                    <span>{ui.recentTaskRuns}</span>
                    <span>{documentBriefingRuns.length}</span>
                  </div>
                  <div className="saved-review-card">
                    <div className="saved-review-metrics task-evidence-summary">
                      <span>
                        {ui.documentBriefingTask} · {ui.successRate(documentBriefingRunSummary.successRate)}
                      </span>
                      <span>
                        {documentBriefingDeliverySummary.total
                          ? `${documentBriefingDeliverySummary.total} ${ui.confirmedDeliverables} · ${documentBriefingDeliverySummary.usableRate}% ${ui.usableDeliverables}`
                          : ui.noDeliveryOutcomes}
                      </span>
                      {!!documentBriefingDeliverySummary.reviewedRealTasks && (
                        <span>
                          {documentBriefingDeliverySummary.reviewedRealTasks} {ui.realTasksReviewed} ·{" "}
                          {documentBriefingDeliverySummary.numberCorrectnessBelow4} {ui.numberChecksBelowFour}
                        </span>
                      )}
                    </div>
                    <details className="saved-review-history">
                      <summary>{ui.runHistory}</summary>
                      <ol>
                        {documentBriefingRuns.map((run) => {
                          const source = artifacts.find((artifact) => artifact.id === run.sourceArtifactId);
                          const output = artifacts.find((artifact) => run.outputArtifactIds.includes(artifact.id));
                          const runDeliveries = documentBriefingDeliveries.filter(
                            (delivery) => delivery.runId === run.id,
                          );
                          const openArtifact = output ?? source;
                          return (
                            <li key={run.id}>
                              <span className={run.status}>
                                {run.status === "applied" ? ui.runApplied : ui.runStopped}
                              </span>
                              <button
                                type="button"
                                className="task-evidence-target"
                                disabled={!openArtifact || Boolean(activeVisualSourceDraft)}
                                onClick={() => openArtifact && selectArtifact(openArtifact.id)}
                              >
                                {output?.name ?? ui.documentBriefingTask}
                              </button>
                              <small>
                                {source?.name ?? run.sourceArtifactId} → {output?.name ?? run.outputArtifactIds[0]}
                              </small>
                              <small>
                                {run.completedAt.slice(0, 10)} · {ui.taskTime}{" "}
                                {Math.max(1, Math.round(run.durationMs / 1000))}s · {run.provider}
                              </small>
                              <small>
                                {run.status === "stopped" && run.stopReason
                                  ? ui.stopReasons[run.stopReason]
                                  : ui.tokenUse(run.inputTokens, run.outputTokens)}
                              </small>
                              {runDeliveries.map((delivery) => (
                                <small key={delivery.id}>
                                  {ui.deliveryRatings[delivery.rating]} · {delivery.target.toUpperCase()}
                                  {delivery.evaluation
                                    ? ` · ${ui.numberScore} ${delivery.evaluation.rubric.numberCorrectness}/5`
                                    : ""}
                                </small>
                              ))}
                            </li>
                          );
                        })}
                      </ol>
                    </details>
                  </div>
                </section>
              )}
              <div className="file-rail-spacer" />
              {workspacePinnedArtifactIds.length > 0 && (
                <div className="context-pin-summary">
                  <Pin aria-hidden="true" />
                  <span>
                    <strong>{ui.temporaryPins(workspacePinnedArtifactIds.length)}</strong>
                    <small>{ui.includedUpstream}</small>
                  </span>
                  <button type="button" onClick={clearWorkspaceContextPins}>
                    {ui.clear}
                  </button>
                </div>
              )}
              <div className="workspace-note">
                <LayoutGrid aria-hidden="true" />
                <div>
                  <strong>{ui.oneWorkspace}</strong>
                  <span>{ui.oneWorkspaceBody}</span>
                </div>
              </div>
              <div className="local-badge">
                <span className="pulse-dot" /> {ui.localFirst}
              </div>
            </aside>
          ))}

        {emptyWorkspace ? (
          <EmptyWorkspace
            locale={locale}
            onStartReview={startOperatingReviewFromData}
            onStartBriefing={startDocumentBriefingFromDocument}
            onChooseFiles={beginStandardImport}
            onCreate={openNewArtifact}
            onDropFiles={(files) => void prepareFileImport(files)}
            onOpenSample={() => {
              const sampleId = artifacts.find((artifact) => artifact.id !== RUNE_GUIDE_ID)?.id ?? artifacts[0].id;
              selectArtifact(sampleId);
            }}
          />
        ) : (
          <>
            <section
              className="source-pane"
              aria-label={ui.sourceEditor}
              aria-hidden={workspaceView === "preview" ? true : undefined}
              inert={workspaceView === "preview" ? true : undefined}
            >
              <header className="pane-header">
                <div className="pane-title">
                  <span className={`artifact-icon ${presentedArtifact.kind}`}>
                    <ArtifactIcon kind={presentedArtifact.kind} />
                  </span>
                  <div>
                    <span className="overline">{proposalReviewActive ? ui.proposalPreview : ui.source}</span>
                    <strong>{presentedArtifact.name}</strong>
                  </div>
                </div>
                <div className="pane-actions">
                  {!proposalReviewActive &&
                    (selectedArtifact.kind === "document" ||
                      (selectedArtifact.kind === "slides" && isDeckMarkdownArtifact(selectedArtifact))) && (
                      <button
                        type="button"
                        className="icon-button small insert-local-image-button"
                        onClick={() => imageImportRef.current?.click()}
                        disabled={
                          !hydrated ||
                          visualEditState !== "idle" ||
                          Boolean(activeVisualSourceDraft) ||
                          Boolean(pendingChange) ||
                          Boolean(pendingImport) ||
                          Boolean(pendingPdfOcr) ||
                          Boolean(pendingExport) ||
                          Boolean(pendingDocumentStructure) ||
                          Boolean(pendingLocalImage)
                        }
                        aria-label={localImageUI.insertLocal}
                        title={localImageUI.insertLocalAtCursor}
                      >
                        <ImagePlus aria-hidden="true" />
                      </button>
                    )}
                  <WorkspaceViewSwitch ui={ui} view={workspaceView} onChange={setPreferredWorkspaceView} />
                  {proposalReviewActive ? (
                    <span
                      className={`proposal-preview-badge ${proposalPreviewActive ? "valid" : "error"}`}
                      role="status"
                    >
                      <Eye aria-hidden="true" />
                      <span>{proposalPreviewActive ? ui.proposalReadOnly : ui.proposalPreviewUnavailable}</span>
                    </span>
                  ) : (
                    <>
                      <button
                        className={`history-trigger source-version-trigger ${historyOpen ? "active" : ""}`}
                        onClick={() => setHistoryOpen((open) => !open)}
                        aria-expanded={historyOpen}
                        aria-label={ui.sourceVersions}
                        title={ui.sourceVersions}
                      >
                        <Code2 aria-hidden="true" />
                        <span>{selectedArtifact.language}</span>
                        <i aria-hidden="true" />
                        <History aria-hidden="true" />
                        <span>{selectedCheckpoints.length}</span>
                        <ChevronDown className="source-version-chevron" aria-hidden="true" />
                      </button>
                      <button
                        className="icon-button small close-file-button"
                        onClick={closeCurrentArtifact}
                        aria-label={ui.closeFile}
                        title={`${ui.closeFile} (⌘ W)`}
                      >
                        <X />
                      </button>
                    </>
                  )}
                </div>
              </header>

              {historyOpen && !proposalReviewActive && (
                <section className="checkpoint-panel" aria-label={ui.checkpoints}>
                  <div className="checkpoint-panel-header">
                    <div>
                      <span className="overline">{ui.sourceVersions}</span>
                      <strong>{ui.checkpointCount(selectedCheckpoints.length)}</strong>
                      <small>{selectedArtifact.language}</small>
                    </div>
                    <div className="checkpoint-panel-actions">
                      <button
                        className="icon-button small"
                        onClick={undoLastAgentChange}
                        disabled={
                          !selectedCheckpoints.some((checkpoint) => checkpoint.source !== selectedArtifact.source)
                        }
                        aria-label={ui.restoreLatestDifferent}
                        title={ui.restoreLatest}
                      >
                        <Undo2 />
                      </button>
                      <button className="button checkpoint-save" onClick={saveManualCheckpoint}>
                        <Check aria-hidden="true" /> {ui.saveCurrent}
                      </button>
                    </div>
                  </div>
                  {selectedCheckpoints.length ? (
                    <div className="checkpoint-list">
                      {[...selectedCheckpoints].reverse().map((checkpoint) => {
                        const current = checkpoint.source === selectedArtifact.source;
                        return (
                          <div className={`checkpoint-row ${current ? "current" : ""}`} key={checkpoint.id}>
                            <span className="checkpoint-node" aria-hidden="true" />
                            <div>
                              <strong>{checkpoint.label}</strong>
                              <small>
                                {ui.checkpointReasons[checkpoint.reason]} ·{" "}
                                {checkpointTime(checkpoint.createdAt, locale)}
                              </small>
                            </div>
                            {current ? (
                              <span className="checkpoint-current">{ui.current}</span>
                            ) : (
                              <button
                                disabled={Boolean(activeVisualSourceDraft)}
                                onClick={() => restoreCheckpoint(checkpoint)}
                              >
                                {ui.restore}
                              </button>
                            )}
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
                <pre
                  ref={gutterRef}
                  className={`line-gutter ${activeVisualSourceDraft ? "visual-source-draft" : ""} ${proposalReviewActive ? "proposal-source-preview" : ""}`.trim()}
                  aria-hidden="true"
                >
                  {lineNumbers}
                </pre>
                {activeVisualSourceDraft && (
                  <div
                    className={`visual-source-sync-state ${activeVisualSourceDraft.errors.length ? "has-error" : "valid"}`}
                    role="status"
                  >
                    <span>{ui.unsavedVisualDraft}</span>
                    <strong>
                      {activeVisualSourceDraft.errors.length
                        ? ui.draftNeedsFix
                        : activeVisualSourceDraft.nextSource === activeVisualSourceDraft.sourceRevision
                          ? ui.draftUnchanged
                          : ui.draftReady}
                    </strong>
                  </div>
                )}
                {proposalReviewActive && (
                  <div
                    className={`visual-source-sync-state proposal ${proposalPreviewActive ? "valid" : "has-error"}`}
                    role="status"
                  >
                    <span>{ui.proposalSource}</span>
                    <strong>
                      {proposalPreviewActive
                        ? ui.canonicalUnchanged
                        : (proposalPreview?.errors[0] ?? ui.proposalPreviewUnavailable)}
                    </strong>
                  </div>
                )}
                <textarea
                  ref={sourceEditorRef}
                  className={`source-editor ${activeVisualSourceDraft ? "visual-source-draft" : ""} ${proposalReviewActive ? "proposal-source-preview" : ""}`.trim()}
                  value={editorSource}
                  onChange={(event) =>
                    updateSource(event.target.value, {
                      start: event.currentTarget.selectionStart,
                      end: event.currentTarget.selectionEnd,
                    })
                  }
                  onSelect={proposalReviewActive ? undefined : captureSourceSelection}
                  onScroll={(event) => {
                    if (gutterRef.current) gutterRef.current.scrollTop = event.currentTarget.scrollTop;
                    if (sourceDraftMirrorRef.current) {
                      sourceDraftMirrorRef.current.scrollTop = event.currentTarget.scrollTop;
                      sourceDraftMirrorRef.current.scrollLeft = event.currentTarget.scrollLeft;
                    }
                  }}
                  spellCheck={false}
                  wrap="off"
                  readOnly={Boolean(activeVisualSourceDraft) || proposalReviewActive}
                  disabled={visualEditState !== "idle" || Boolean(pendingDocumentStructure)}
                  aria-busy={visualEditState !== "idle" || Boolean(pendingDocumentStructure)}
                  aria-readonly={Boolean(activeVisualSourceDraft) || proposalReviewActive}
                  aria-label={
                    proposalReviewActive
                      ? `${ui.proposalSource} · ${presentedArtifact.name}`
                      : activeVisualSourceDraft
                        ? ui.syncedDraftSource(selectedArtifact.name)
                        : ui.editSource(selectedArtifact.name)
                  }
                />
                {activeVisualSourceDraft && (
                  <pre ref={sourceDraftMirrorRef} className="source-draft-mirror" aria-hidden="true">
                    {editorSource.slice(0, activeVisualSourceDraft.start)}
                    <mark>
                      {editorSource.slice(activeVisualSourceDraft.start, activeVisualSourceDraft.end) || "\u200b"}
                    </mark>
                    {editorSource.slice(activeVisualSourceDraft.end)}
                  </pre>
                )}
              </div>

              <div className="agent-dock">
                {pendingChange && (
                  <div className="patch-card">
                    <div className="patch-icon">
                      <History aria-hidden="true" />
                    </div>
                    <div className="patch-copy">
                      <span className="overline">
                        {ui.proposedChange(
                          pendingChange.scope === "workspace"
                            ? "workspace"
                            : pendingChange.scope === "selection"
                              ? "selection"
                              : "file",
                        )}{" "}
                        ·{" "}
                        {pendingChange.planningKind === "task-outline"
                          ? ui.modelOutline
                          : pendingChange.planningKind === "task-narrative"
                            ? ui.modelNarrative
                            : pendingChange.provider !== "local"
                              ? ui.typedOperations(pendingOperationCount)
                              : ui.localPlan}
                        {pendingChange.runtimeRepair ? ` · ${ui.repairedOnce}` : ""}
                      </span>
                      <strong>{pendingChange.summary}</strong>
                      <p>{pendingChange.detail}</p>
                      {pendingChange.runtimeRepair && (
                        <div className="runtime-repair" aria-label={ui.repairPassed}>
                          <RefreshCw aria-hidden="true" />
                          <span>
                            <strong>{ui.recovered}</strong>
                            <small>
                              {ui.firstUnapplied} · {pendingChange.runtimeRepair.failure}
                            </small>
                          </span>
                        </div>
                      )}
                      {pendingChange.runtimePreflight && (
                        <div className="runtime-preflight" aria-label={ui.runtimePassed}>
                          <CheckCircle2 aria-hidden="true" />
                          <span>
                            <strong>{ui.runtimePassed}</strong>
                            <small>
                              {pendingChange.runtimePreflight.dataCount > 0
                                ? `${pendingChange.runtimePreflight.dataCount} proposed Data ${pendingChange.runtimePreflight.dataCount === 1 ? "source" : "sources"} · `
                                : ""}
                              {pendingChange.runtimePreflight.queryCount > 0
                                ? `${pendingChange.runtimePreflight.queryCount} impacted ${pendingChange.runtimePreflight.queryCount === 1 ? "Query" : "Queries"} executed locally`
                                : "no SQL execution required"}{" "}
                              · {pendingChange.runtimePreflight.legacyMetricConsumerCount} legacy metric{" "}
                              {pendingChange.runtimePreflight.legacyMetricConsumerCount === 1
                                ? "consumer"
                                : "consumers"}{" "}
                              · {pendingChange.runtimePreflight.scalarConsumerCount} SQL scalar{" "}
                              {pendingChange.runtimePreflight.scalarConsumerCount === 1 ? "consumer" : "consumers"} ·{" "}
                              {pendingChange.runtimePreflight.chartConsumerCount}{" "}
                              {pendingChange.runtimePreflight.chartConsumerCount === 1 ? "chart" : "charts"} ·{" "}
                              {[
                                ...pendingChange.runtimePreflight.dataNames,
                                ...pendingChange.runtimePreflight.queryNames,
                              ].join(", ")}
                            </small>
                          </span>
                        </div>
                      )}
                      <Suspense fallback={<DeferredWorkbenchSurfaceFallback locale={locale} variant="inline" />}>
                        {pendingTransactionReview && !pendingTransactionReview.errors.length && (
                          <TransactionReviewMap
                            review={pendingTransactionReview}
                            activeArtifactId={proposalArtifact?.id ?? selectedPendingStat?.artifact.id ?? ""}
                            locale={locale}
                            onSelect={setPendingReviewId}
                          />
                        )}
                      </Suspense>
                      <div className="diff-summary">
                        <span>{ui.changedFiles(pendingStats.length)}</span>
                        <span className="additions">+{pendingTotals.additions}</span>
                        <span className="removals">−{pendingTotals.removals}</span>
                        <span>{ui.changedLines}</span>
                      </div>
                      <div className="patch-file-list" aria-label={ui.filesInPatch}>
                        {pendingStats.map(({ artifact, patch, additions, removals, isCreation }) => (
                          <button
                            key={artifact.id}
                            className={`patch-file-row ${artifact.id === proposalArtifact?.id ? "active" : ""}`}
                            onClick={() => setPendingReviewId(artifact.id)}
                            aria-label={ui.reviewArtifact(artifact.name)}
                          >
                            <span className={`artifact-icon ${artifact.kind}`}>
                              <ArtifactIcon kind={artifact.kind} size={13} />
                            </span>
                            <span className="patch-file-label">
                              <strong>
                                {artifact.name}
                                {isCreation && <em className="new-file-badge">{ui.newFile}</em>}
                              </strong>
                              <small>
                                {patch.summary}
                                {patch.operationCount ? ` · ${ui.typedOps(patch.operationCount)}` : ""}
                              </small>
                            </span>
                            <span className="patch-file-diff">
                              <b>+{additions}</b>
                              <i>−{removals}</i>
                            </span>
                          </button>
                        ))}
                      </div>
                      {selectedPendingStat ? (
                        <div
                          className="patch-source-diff"
                          aria-label={ui.sourceDiffFor(selectedPendingStat.artifact.name)}
                        >
                          <div className="patch-source-diff-header">
                            <span>{selectedPendingStat.isCreation ? ui.newSourceDiff : ui.sourceDiff}</span>
                            <strong>{selectedPendingStat.artifact.name}</strong>
                          </div>
                          <pre>
                            {selectedDiffPreview.map((line, index) => (
                              <code className={line.kind} key={`${line.kind}-${index}`}>
                                <span>{line.kind === "addition" ? "+" : line.kind === "removal" ? "−" : " "}</span>
                                {line.text || " "}
                              </code>
                            ))}
                          </pre>
                        </div>
                      ) : (
                        <p className="patch-review-hint">
                          {proposalPreviewActive ? ui.proposalSourceUnchanged : ui.selectChangedFile}
                        </p>
                      )}
                    </div>
                    <div className="patch-actions">
                      <button className="button primary-button" onClick={applyPendingChange}>
                        <Check aria-hidden="true" /> {pendingStats.length > 1 ? ui.applyAll : ui.apply}
                      </button>
                      <button
                        className="icon-button small"
                        onClick={discardPendingChange}
                        aria-label={ui.discardPatch}
                        title={ui.discard}
                      >
                        <X />
                      </button>
                    </div>
                  </div>
                )}

                {agentError && (
                  <div className="agent-error" role="alert">
                    {agentError}
                  </div>
                )}

                <AgentComposer
                  ref={promptRef}
                  prompt={prompt}
                  onPromptChange={setPrompt}
                  onPromptKeyDown={onPromptKeyDown}
                  onRun={() => void runAgent()}
                  onQuickCommand={(command) => void runAgent(command)}
                  scope={agentScope}
                  onScopeChange={changeAgentScope}
                  busy={agentState === "planning" || visualEditState !== "idle"}
                  locked={Boolean(activeVisualSourceDraft)}
                  selectionUnavailable={!validSourceSelection}
                  mode={agentMode}
                  placeholder={
                    agentScope === "workspace"
                      ? ui.askWorkspace
                      : agentScope === "selection"
                        ? ui.askSelection
                        : ui.askFile
                  }
                  ariaLabel={
                    agentScope === "workspace"
                      ? ui.describeWorkspaceChange
                      : agentScope === "selection"
                        ? ui.describeSelectionChange
                        : ui.describeArtifactChange
                  }
                  scopeLabels={{ selection: ui.selection, artifact: ui.file, workspace: ui.workspaceScope }}
                  scopeGroupLabel={ui.agentScope}
                  suggestedActionsLabel={ui.suggestedActions}
                  sendLabel={ui.planChange}
                  sendTitle={`${ui.planChange} (⌘ Enter)`}
                  modelConnectedLabel={ui.modelConnected}
                  localFallbackLabel={ui.localFallback}
                  planHint={ui.planHint}
                  queryEvidenceText={
                    agentScope === "workspace" && workspaceAgentQueryCount > 0
                      ? ui.queryEvidence(workspaceAgentQueryCount)
                      : ""
                  }
                  quickCommands={runeQuickCommands(locale, agentScope, selectedArtifact.kind)}
                />
              </div>
            </section>

            <WorkspaceSplitter
              workspaceRef={workspaceRef}
              value={workspaceSourcePercent}
              label={ui.resizeWorkspace}
              valueText={workspaceSplitValueLabel(locale, Math.round(workspaceSourcePercent))}
              resetLabel={ui.resetWorkspaceSplit}
              onChange={setWorkspaceSourcePercent}
              onCommit={setPreferredWorkspaceSplit}
            />

            <section
              className="preview-pane"
              aria-label={proposalReviewActive ? `${ui.preview} · ${ui.proposalPreview}` : ui.preview}
              aria-hidden={workspaceView === "source" ? true : undefined}
              inert={workspaceView === "source" ? true : undefined}
              data-proposal-preview={proposalReviewActive ? "true" : undefined}
            >
              <header className="pane-header preview-header">
                <div className="pane-title">
                  <span className="preview-mark">
                    <FileCode2 aria-hidden="true" />
                  </span>
                  <div>
                    <span className="overline">{ui.output}</span>
                    <strong>{proposalReviewActive ? ui.proposalPreview : ui.livePreview}</strong>
                  </div>
                </div>
                <div className="preview-actions">
                  <WorkspaceViewSwitch ui={ui} view={workspaceView} onChange={setPreferredWorkspaceView} />
                  {proposalReviewActive ? (
                    <span
                      className={`proposal-preview-badge ${proposalPreviewActive ? "valid" : "error"}`}
                      role="status"
                    >
                      <Eye aria-hidden="true" />
                      <span>{proposalPreviewActive ? ui.proposalOutput : ui.proposalPreviewUnavailable}</span>
                    </span>
                  ) : (
                    <details className="preview-evidence">
                      <summary aria-label={ui.previewDetails} title={ui.previewDetailsBody}>
                        {validationDiagnostics.length ? (
                          <span className="validation-badge error">
                            <X aria-hidden="true" /> {ui.issues(validationDiagnostics.length)}
                          </span>
                        ) : (
                          <span className="validation-badge">
                            <CheckCircle2 aria-hidden="true" /> {ui.valid}
                          </span>
                        )}
                        <ChevronDown className="preview-evidence-chevron" aria-hidden="true" />
                      </summary>
                      <div
                        className={
                          validationDiagnostics.length
                            ? "preview-evidence-popover has-issues"
                            : "preview-evidence-popover"
                        }
                      >
                        <header>
                          <span className="overline">{ui.previewDetails}</span>
                          <strong>{ui.previewDetailsBody}</strong>
                        </header>
                        <div className="preview-evidence-badges">
                          {activePreviewTarget && (
                            <span className="source-link-badge" title={ui.sourceLinked(activePreviewTarget.label)}>
                              <CircleDot aria-hidden="true" />
                              <span>{activePreviewTarget.label}</span>
                            </span>
                          )}
                          {selectedArtifact.kind === "query" && selectedQueryDataArtifact && (
                            <span className="binding-badge query">
                              <Database aria-hidden="true" /> {ui.oneSource}
                            </span>
                          )}
                          {selectedArtifact.kind === "chart" &&
                            selectedChartSourceArtifact &&
                            !selectedChartBindingErrors.length && (
                              <span className="binding-badge chart">
                                {selectedChartSourceArtifact.kind === "query" ? (
                                  <Database aria-hidden="true" />
                                ) : (
                                  <TableProperties aria-hidden="true" />
                                )}{" "}
                                {ui.oneSource}
                              </span>
                            )}
                          {!!bindingState?.queryMetricReferences.length && (
                            <span className="binding-badge query">
                              <Database aria-hidden="true" />{" "}
                              {ui.sqlMetricBadge(bindingState.queryMetricReferences.length)}
                            </span>
                          )}
                          {!!bindingState?.chartReferences.length && (
                            <span className="binding-badge chart">
                              <BarChart3 aria-hidden="true" /> {ui.chartBadge(bindingState.chartReferences.length)}
                            </span>
                          )}
                          {!!bindingState?.references.length && (
                            <span className="binding-badge">
                              <Link2 aria-hidden="true" /> {ui.liveBadge(bindingState.references.length)}
                            </span>
                          )}
                          {validationDiagnostics.length ? (
                            <span className="validation-badge error">
                              <X aria-hidden="true" /> {ui.issues(validationDiagnostics.length)}
                            </span>
                          ) : (
                            <span className="validation-badge">
                              <CheckCircle2 aria-hidden="true" /> {ui.valid}
                            </span>
                          )}
                        </div>
                        {!!validationDiagnostics.length && (
                          <section className="preview-diagnostics" aria-label={ui.diagnostics.heading}>
                            <div className="preview-diagnostics-heading">
                              <span>
                                <CircleAlert aria-hidden="true" />
                              </span>
                              <div>
                                <strong>{ui.diagnostics.heading}</strong>
                                <small>{ui.diagnostics.body}</small>
                              </div>
                              <button type="button" onClick={openValidationIssueSource}>
                                {ui.diagnostics.openSource}
                              </button>
                            </div>
                            <ol>
                              {validationDiagnostics.map((diagnostic) => {
                                const copy = ui.diagnostics.codes[diagnostic.code];
                                return (
                                  <li key={diagnostic.id}>
                                    <strong>{copy.title}</strong>
                                    <p>{copy.action}</p>
                                    {diagnostic.reference && (
                                      <div className="preview-diagnostic-reference">
                                        <span>{ui.diagnostics.reference}</span>
                                        <code>{diagnostic.reference}</code>
                                      </div>
                                    )}
                                    <details>
                                      <summary>{ui.diagnostics.technicalDetail}</summary>
                                      <code>{diagnostic.detail}</code>
                                      {diagnostic.detailTruncated && <small>{ui.diagnostics.detailTruncated}</small>}
                                    </details>
                                  </li>
                                );
                              })}
                            </ol>
                          </section>
                        )}
                        <div className="preview-evidence-lineage">
                          {selectedArtifact.kind === "chart" &&
                            selectedChartSourceArtifact &&
                            !selectedChartBindingErrors.length && (
                              <div className="lineage-strip chart-lineage">
                                {selectedChartSourceArtifact.kind === "query" ? (
                                  <Database aria-hidden="true" />
                                ) : (
                                  <TableProperties aria-hidden="true" />
                                )}
                                <span>{selectedChartSourceArtifact.name}</span>
                                <ChevronRight aria-hidden="true" />
                                <span>{selectedArtifact.name}</span>
                                <strong>
                                  {selectedChartSourceArtifact.kind === "query"
                                    ? ui.browserQueryOutput
                                    : ui.canonicalDataLive}
                                </strong>
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
                              <strong>
                                {selectedQueryDataResolution?.explicit ? ui.explicitDataBinding : ui.legacyDataBinding}
                              </strong>
                            </div>
                          )}
                          {!!bindingState?.queryMetricReferences.length && (
                            <div className="lineage-strip query-lineage">
                              <Database aria-hidden="true" />
                              <span>
                                {[
                                  ...new Set(
                                    bindingState.queryMetricReferences.map(
                                      (reference) =>
                                        artifacts.find((artifact) => artifact.id === reference.queryArtifactId)?.name ??
                                        reference.queryArtifactId,
                                    ),
                                  ),
                                ].join(", ")}
                              </span>
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
                              <span>
                                {bindingState.chartReferences
                                  .map((id) => artifacts.find((artifact) => artifact.id === id)?.name ?? id)
                                  .join(", ")}
                              </span>
                              <ChevronRight aria-hidden="true" />
                              <span>{selectedArtifact.name}</span>
                              <strong>{ui.chartsCompiledLive(bindingState.chartReferences.length)}</strong>
                            </div>
                          )}
                        </div>
                      </div>
                    </details>
                  )}
                </div>
              </header>
              <div className="preview-body">
                <div className="preview-scroll" ref={previewScrollRef}>
                  <ArtifactPreview
                    key={`${proposalReviewActive ? "proposal" : "canonical"}:${presentedArtifact.id}`}
                    artifact={presentedArtifact}
                    artifacts={presentedArtifacts}
                    locale={locale}
                    activeSelection={proposalReviewActive ? null : activePreviewTarget}
                    onTargetSource={proposalReviewActive ? undefined : focusPreviewTarget}
                    onEditDataCell={
                      !proposalReviewActive && visualEditState === "idle" ? commitVisualDataCellEdit : undefined
                    }
                    onEditDocumentSection={
                      !proposalReviewActive && visualEditState === "idle" ? commitVisualDocumentSectionEdit : undefined
                    }
                    onEditDocumentBlock={
                      !proposalReviewActive && visualEditState === "idle" ? commitVisualDocumentBlockEdit : undefined
                    }
                    onReviewDocumentBlockStructure={
                      !proposalReviewActive && visualEditState === "idle" && !pendingDocumentStructure
                        ? reviewVisualDocumentBlockStructure
                        : undefined
                    }
                    onEditDeckSlide={
                      !proposalReviewActive && visualEditState === "idle" ? commitVisualDeckSlideEdit : undefined
                    }
                    onCreateEditableDeckCopy={
                      !proposalReviewActive && visualEditState === "idle" ? reviewSemanticHtmlEditableCopy : undefined
                    }
                    onEditChartSpec={
                      !proposalReviewActive && visualEditState === "idle" ? commitVisualChartSpecEdit : undefined
                    }
                    onVisualSourceDraftChange={proposalReviewActive ? undefined : handleVisualSourceDraftChange}
                    resolveLocalAssetUrl={resolveLocalAssetUrl}
                  />
                </div>
              </div>
            </section>
          </>
        )}
      </div>

      <WorkbenchStatusBar visibleNotice={visibleNotice} artifactStatsText={artifactStats(presentedArtifact)} />

      <Suspense fallback={<DeferredWorkbenchSurfaceFallback locale={locale} />}>
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
            key={`${editingOperatingReviewId || "new-operating-review"}:${taskSession?.phase === "configuring" ? (taskSession.preferredArtifactId ?? "default") : "default"}`}
            artifacts={artifacts}
            locale={locale}
            error={operatingReviewError}
            initialInput={savedOperatingReviews.find((workflow) => workflow.id === editingOperatingReviewId)?.input}
            preferredDataArtifactId={
              taskSession?.phase === "configuring" ? (taskSession.preferredArtifactId ?? undefined) : undefined
            }
            modelMode={modelMode}
            onCancel={() => {
              if (operatingReviewState !== "idle") return;
              setOperatingReviewOpen(false);
              setOperatingReviewError("");
              setEditingOperatingReviewId("");
              setTaskSession(null);
              setNotice(
                runeText(
                  locale,
                  "Operating review cancelled — the workspace is unchanged",
                  "已取消经营汇报 — 工作区保持不变",
                ),
              );
            }}
            onPrepare={prepareOperatingReview}
          />
        )}
        {documentBriefingOpen && (
          <DocumentBriefingDialog
            key={`document-briefing:${taskSession?.phase === "configuring" ? (taskSession.preferredArtifactId ?? "default") : "default"}:${preferredDocumentBriefingTargetId || "new"}`}
            artifacts={artifacts}
            locale={locale}
            error={documentBriefingError}
            preferredDocumentArtifactId={
              taskSession?.phase === "configuring" && taskSession.taskId === "document-briefing"
                ? (taskSession.preferredArtifactId ?? undefined)
                : undefined
            }
            preferredPresentationArtifactId={preferredDocumentBriefingTargetId || undefined}
            modelMode={modelMode}
            onCancel={() => {
              if (documentBriefingState !== "idle") return;
              setDocumentBriefingOpen(false);
              setDocumentBriefingError("");
              setPreferredDocumentBriefingTargetId("");
              setTaskSession(null);
              setNotice(
                runeText(
                  locale,
                  "Document presentation cancelled — the workspace is unchanged",
                  "已取消文档演示 — 工作区保持不变",
                ),
              );
            }}
            onPrepare={prepareDocumentBriefing}
          />
        )}
        {pendingImport && (
          <ImportReviewDialog
            sourceName={pendingImport.sourceName}
            artifacts={pendingImport.importedArtifacts}
            warnings={pendingImport.warnings}
            error={importError}
            busy={importState === "reading"}
            locale={locale}
            continuationTask={taskSession?.phase === "reviewing-source" ? taskSession.taskId : undefined}
            purpose={pendingImport.purpose}
            onCancel={cancelPendingImport}
            onConfirm={applyPendingImport}
          />
        )}
        {pendingPdfOcr && (
          <PdfOcrSetupDialog
            key={pendingPdfOcr.candidates
              .map((candidate) => `${candidate.fileIndex}:${candidate.analysis.ocrCandidatePageNumbers.join(",")}`)
              .join("|")}
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
        {pendingPilotEvidence && (
          <PilotEvidenceReviewDialog
            result={pendingPilotEvidence.result}
            locale={locale}
            error={pilotEvidenceError}
            onCancel={cancelPilotEvidenceExport}
            onConfirm={confirmPilotEvidenceExport}
          />
        )}
        {pendingDeliveryConfirmation && (
          <DeliveryOutcomeDialog
            key={`${pendingDeliveryConfirmation.runId}:${pendingDeliveryConfirmation.artifactId}:${pendingDeliveryConfirmation.target}`}
            workflowTitle={pendingDeliveryConfirmation.workflowTitle}
            artifactName={pendingDeliveryConfirmation.artifactName}
            handoffLabel={pendingDeliveryConfirmation.handoffLabel}
            locale={locale}
            submitting={deliveryOutcomeState === "recording"}
            error={deliveryOutcomeError}
            onCancel={() => {
              if (deliveryOutcomeState !== "idle") return;
              setPendingDeliveryConfirmation(null);
              setDeliveryOutcomeError("");
              setNotice(ui.noDeliveryOutcomes);
            }}
            onConfirm={confirmDeliveryOutcome}
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
      </Suspense>
      <Suspense fallback={<DeferredWorkbenchSurfaceFallback locale={locale} variant="welcome" />}>
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
      </Suspense>
    </main>
  );
}
