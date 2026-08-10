"use client";

import {
  BarChart3,
  Bot,
  Check,
  CheckCircle2,
  ChevronRight,
  CircleDot,
  Code2,
  Database,
  Download,
  FileCode2,
  FileText,
  FolderOpen,
  History,
  LayoutGrid,
  Link2,
  LoaderCircle,
  PanelLeftClose,
  PanelLeftOpen,
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
import { ChangeEvent, KeyboardEvent, useEffect, useMemo, useRef, useState } from "react";
import { ArtifactPreview } from "./artifact-previews";
import {
  artifactStats,
  cloneDefaultArtifacts,
  detectArtifact,
  normalizeWorkspaceArtifacts,
  planLocalChange,
  planLocalWorkspaceChange,
  parseDataSource,
  quickCommands,
  validateArtifact,
  workspaceQuickCommands,
  type ArtifactKind,
  type WorkspaceArtifact,
} from "../lib/workspace";
import { compileArtifactSource, findMetricReferences } from "../lib/bindings";
import { findChartReferences, resolveChartModel } from "../lib/charts";
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
  createLineDiffPreview,
  prepareWorkspacePatch,
  type ArtifactSourcePatch,
} from "../lib/patches";
import {
  chooseWorkspaceDirectory,
  readWorkspaceDirectory,
  supportsDirectoryWorkspace,
  writeWorkspaceDirectory,
  type DirectoryReadResult,
  type DirectoryWorkspaceHandle,
} from "../lib/directory-workspace";

const STORAGE_KEY = "rune-workspace-v0";
const MAX_IMPORT_SIZE = 2 * 1024 * 1024;

type PendingChange = {
  prompt: string;
  provider: "openai" | "local";
  scope: "artifact" | "workspace";
  summary: string;
  detail: string;
  patches: ArtifactSourcePatch[];
};

type RemoteFilePlan = ArtifactSourcePatch;
type RemoteSinglePlan = Omit<RemoteFilePlan, "artifactId">;
type RemoteWorkspacePlan = { summary: string; detail: string; patches: RemoteFilePlan[] };

type RemoteAgentResponse = {
  error?: string;
  code?: string;
  provider?: string;
  model?: string;
  plan?: unknown;
};

function isRemoteSinglePlan(value: unknown): value is RemoteSinglePlan {
  return Boolean(
    value && typeof value === "object"
    && typeof (value as RemoteSinglePlan).nextSource === "string"
    && typeof (value as RemoteSinglePlan).summary === "string"
    && typeof (value as RemoteSinglePlan).detail === "string",
  );
}

function isRemoteWorkspacePlan(value: unknown): value is RemoteWorkspacePlan {
  if (!value || typeof value !== "object") return false;
  const plan = value as RemoteWorkspacePlan;
  return typeof plan.summary === "string"
    && typeof plan.detail === "string"
    && Array.isArray(plan.patches)
    && plan.patches.length > 0
    && plan.patches.every((patch) => typeof patch.artifactId === "string"
      && typeof patch.nextSource === "string"
      && typeof patch.summary === "string"
      && typeof patch.detail === "string");
}

function ArtifactIcon({ kind, size = 16 }: { kind: ArtifactKind; size?: number }) {
  if (kind === "document") return <FileText size={size} aria-hidden="true" />;
  if (kind === "data") return <TableProperties size={size} aria-hidden="true" />;
  if (kind === "query") return <Database size={size} aria-hidden="true" />;
  if (kind === "chart") return <BarChart3 size={size} aria-hidden="true" />;
  return <Presentation size={size} aria-hidden="true" />;
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
  const [prompt, setPrompt] = useState("");
  const [pendingChange, setPendingChange] = useState<PendingChange | null>(null);
  const [agentError, setAgentError] = useState("");
  const [agentState, setAgentState] = useState<"idle" | "planning">("idle");
  const [agentMode, setAgentMode] = useState<"openai" | "local">("local");
  const [agentScope, setAgentScope] = useState<"artifact" | "workspace">("artifact");
  const [checkpoints, setCheckpoints] = useState<CheckpointMap>({});
  const [historyOpen, setHistoryOpen] = useState(false);
  const [directoryHandle, setDirectoryHandle] = useState<DirectoryWorkspaceHandle | null>(null);
  const [directoryState, setDirectoryState] = useState<"disconnected" | "syncing" | "connected" | "error">("disconnected");
  const [notice, setNotice] = useState("Local workspace ready");
  const gutterRef = useRef<HTMLPreElement>(null);
  const importRef = useRef<HTMLInputElement>(null);

  const selectedArtifact = artifacts.find((artifact) => artifact.id === selectedId) ?? artifacts[0];
  const selectedCheckpoints = checkpoints[selectedArtifact?.id] ?? [];
  const canonicalDataArtifact = artifacts.find((artifact) => artifact.kind === "data");
  const selectedChartResolution = useMemo(
    () => selectedArtifact?.kind === "chart"
      ? resolveChartModel(selectedArtifact, artifacts, parseDataSource)
      : null,
    [artifacts, selectedArtifact],
  );
  const bindingState = useMemo(
    () => selectedArtifact ? compileArtifactSource(selectedArtifact.source, artifacts) : null,
    [artifacts, selectedArtifact],
  );
  const validationErrors = useMemo(
    () => selectedArtifact
      ? [...new Set([
          ...validateArtifact(selectedArtifact),
          ...(bindingState?.unresolved.map((key) => `Unresolved metric: ${key}`) ?? []),
          ...(bindingState?.unresolvedCharts.map((key) => `Unresolved chart: ${key}`) ?? []),
          ...(selectedChartResolution?.errors ?? []),
        ])]
      : ["No artifact selected."],
    [bindingState?.unresolved, bindingState?.unresolvedCharts, selectedArtifact, selectedChartResolution?.errors],
  );
  const lineNumbers = useMemo(
    () => Array.from({ length: selectedArtifact?.source.split("\n").length ?? 1 }, (_, index) => index + 1).join("\n"),
    [selectedArtifact?.source],
  );
  const pendingStats = useMemo(() => pendingChange?.patches.flatMap((patch) => {
    const artifact = artifacts.find((item) => item.id === patch.artifactId);
    return artifact ? [{ artifact, patch, ...getDiffStats(artifact.source, patch.nextSource) }] : [];
  }) ?? [], [artifacts, pendingChange]);
  const pendingTotals = useMemo(() => pendingStats.reduce(
    (total, patch) => ({
      additions: total.additions + patch.additions,
      removals: total.removals + patch.removals,
    }),
    { additions: 0, removals: 0 },
  ), [pendingStats]);
  const selectedPendingStat = pendingStats.find((patch) => patch.artifact.id === selectedArtifact?.id);
  const selectedDiffPreview = useMemo(() => selectedPendingStat
    ? createLineDiffPreview(selectedPendingStat.artifact.source, selectedPendingStat.patch.nextSource)
    : [], [selectedPendingStat]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
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
      if (!(event.metaKey || event.ctrlKey) || event.key.toLowerCase() !== "s") return;
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
  }, [artifacts, checkpoints, selectedId]);

  if (!selectedArtifact) return null;

  function selectArtifact(id: string) {
    setSaveState("saving");
    setSelectedId(id);
    setAgentError("");
    setNotice("Switched artifact context");
  }

  function updateSource(source: string) {
    setSaveState("saving");
    setArtifacts((current) => current.map((artifact) => (
      artifact.id === selectedArtifact.id ? { ...artifact, source } : artifact
    )));
    if (pendingChange) setPendingChange(null);
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
    if (!instruction || agentState === "planning") return;
    const targetArtifact = selectedArtifact;
    const targetArtifacts = artifacts;
    const scope = agentScope;
    setAgentState("planning");
    setAgentError("");
    setPendingChange(null);
    setNotice(scope === "workspace"
      ? "Agent is coordinating a reviewable workspace patch"
      : "Agent is planning a reviewable file patch");

    const metrics = Object.fromEntries(
      Object.entries(bindingState?.metrics ?? {}).map(([key, metric]) => [key, metric.formatted]),
    );
    const remoteEligible = scope === "artifact"
      ? targetArtifact.source.length <= 100_000
      : targetArtifacts.length >= 2
        && targetArtifacts.length <= 6
        && targetArtifacts.every((artifact) => artifact.source.length <= 100_000)
        && targetArtifacts.reduce((total, artifact) => total + artifact.source.length, 0) <= 180_000;
    let fallbackNotice = remoteEligible
      ? "Local patch ready · model provider unavailable"
      : "Local patch ready · workspace exceeds the model context safety limit";

    if (remoteEligible) {
      try {
        const response = await fetch("/api/agent", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            scope,
            artifact: targetArtifact,
            workspaceArtifacts: scope === "workspace" ? targetArtifacts : undefined,
            prompt: instruction,
            metrics,
          }),
        });
        const payload = await response.json().catch(() => ({})) as RemoteAgentResponse;

        if (response.ok && scope === "workspace" && isRemoteWorkspacePlan(payload.plan)) {
          setPendingChange({ prompt: instruction, provider: "openai", scope, ...payload.plan });
          setAgentMode("openai");
          setPrompt("");
          setNotice(`Model prepared ${payload.plan.patches.length} coordinated patches${payload.model ? ` · ${payload.model}` : ""}`);
          setAgentState("idle");
          return;
        }
        if (response.ok && scope === "artifact" && isRemoteSinglePlan(payload.plan)) {
          setPendingChange({
            prompt: instruction,
            provider: "openai",
            scope,
            summary: payload.plan.summary,
            detail: payload.plan.detail,
            patches: [{ artifactId: targetArtifact.id, ...payload.plan }],
          });
          setAgentMode("openai");
          setPrompt("");
          setNotice(`Model prepared a file patch${payload.model ? ` · ${payload.model}` : ""}`);
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

    try {
      if (scope === "workspace") {
        const localPlan = planLocalWorkspaceChange(targetArtifacts, instruction);
        setPendingChange({ prompt: instruction, provider: "local", scope, ...localPlan });
        setNotice(`${fallbackNotice} · ${localPlan.patches.length} files coordinated`);
      } else {
        const localPlan = planLocalChange(targetArtifact, instruction);
        setPendingChange({
          prompt: instruction,
          provider: "local",
          scope,
          summary: localPlan.summary,
          detail: localPlan.detail,
          patches: [{ artifactId: targetArtifact.id, ...localPlan }],
        });
        setNotice(fallbackNotice);
      }
      setAgentMode("local");
      setPrompt("");
    } catch (error) {
      setPendingChange(null);
      setAgentError(error instanceof Error ? error.message : "Rune could not plan that change.");
      setNotice("Agent needs a more specific instruction");
    } finally {
      setAgentState("idle");
    }
  }

  function applyPendingChange() {
    if (!pendingChange) return;
    const targetArtifacts = pendingChange.patches.flatMap((patch) => {
      const artifact = artifacts.find((item) => item.id === patch.artifactId);
      return artifact ? [artifact] : [];
    });
    if (targetArtifacts.length !== pendingChange.patches.length) {
      setAgentError("The plan references a file that is no longer in this workspace.");
      setNotice("Patch held for review — workspace context changed");
      return;
    }
    const oversized = targetArtifacts.find((artifact) => !canCheckpointSource(artifact.source));
    if (oversized) {
      setAgentError(`${oversized.name} is too large for safe device history. Download it before applying this patch.`);
      setNotice("Patch held for review — every changed file needs a safety checkpoint");
      return;
    }

    const prepared = prepareWorkspacePatch(artifacts, pendingChange.patches);
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
        `${pendingChange.scope === "workspace" ? "Before workspace patch" : "Before agent patch"} · ${patch.summary}`,
        "agent",
        new Date(checkpointTimestamp + index),
      );
      nextCheckpoints = appendCheckpoint(nextCheckpoints, checkpoint);
    });

    try {
      persistDeviceWorkspace(prepared.nextArtifacts, selectedId, nextCheckpoints);
    } catch {
      setSaveState("error");
      setAgentError("Device storage is full, so Rune kept every source unchanged.");
      setNotice("Nothing applied — atomic persistence failed");
      return;
    }

    setArtifacts(prepared.nextArtifacts);
    setCheckpoints(nextCheckpoints);
    setSaveState("saved");
    setSavedAt("just now");
    setPendingChange(null);
    setAgentError("");
    setNotice(`${targetArtifacts.length} ${targetArtifacts.length === 1 ? "file" : "files"} applied atomically — checkpoints are ready`);
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
    setCheckpoints({});
    setHistoryOpen(false);
    setPendingChange(null);
    localStorage.removeItem(STORAGE_KEY);
    setNotice("Sample workspace restored");
  }

  async function importFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (file.size > MAX_IMPORT_SIZE) {
      setNotice("Import is limited to 2 MB in this prototype");
      return;
    }
    const source = await file.text();
    const artifact = detectArtifact(file.name, source);
    if (!artifact) {
      setNotice("Choose a Markdown, CSV, JSON, SQL, or HTML file");
      return;
    }
    setArtifacts((current) => [...current, artifact]);
    setSaveState("saving");
    setSelectedId(artifact.id);
    setPendingChange(null);
    setNotice(`Imported ${file.name} locally`);
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
          <button className="button ghost-button" onClick={() => importRef.current?.click()}>
            <Upload aria-hidden="true" /> Import
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
          <button className="icon-button" onClick={() => downloadArtifact(selectedArtifact)} aria-label={`Download ${selectedArtifact.name}`} title="Download source">
            <Download />
          </button>
          <input ref={importRef} className="visually-hidden" type="file" accept=".deck.md,.md,.markdown,.csv,.json,.sql,.html,.htm" onChange={importFile} />
        </div>
      </header>

      <div className={`workspace ${fileRailOpen ? "with-file-rail" : "without-file-rail"}`}>
        <aside className="activity-rail" aria-label="Rune sections">
          <div className="activity-group">
            <button className="activity-button active" aria-label="Workspace" title="Workspace"><FolderOpen /></button>
            <button className="activity-button" aria-label="Agent" title="Agent"><Sparkles /></button>
            <button className="activity-button" aria-label="Data graph" title="Data graph"><Database /></button>
          </div>
          <div className="activity-group">
            <button className="activity-button" onClick={resetWorkspace} aria-label="Reset sample workspace" title="Reset sample"><RotateCcw /></button>
          </div>
        </aside>

        {fileRailOpen && (
          <aside className="file-rail" aria-label="Workspace files">
            <div className="file-rail-header">
              <div><span className="overline">Workspace</span><strong>Q2 review</strong></div>
              <button className="tiny-icon-button" onClick={() => importRef.current?.click()} aria-label="Import a source file" title="Import file">+</button>
            </div>
            <div className="artifact-group-label"><span>Artifacts</span><span>{artifacts.length}</span></div>
            <nav className="artifact-list">
              {artifacts.map((artifact) => {
                const metricReferenceCount = findMetricReferences(artifact.source).length;
                const chartReferenceCount = findChartReferences(artifact.source).length;
                const referenceCount = metricReferenceCount + chartReferenceCount;
                return (
                  <button
                    key={artifact.id}
                    className={`artifact-row ${artifact.id === selectedArtifact.id ? "active" : ""}`}
                    onClick={() => selectArtifact(artifact.id)}
                  >
                    <span className={`artifact-icon ${artifact.kind}`}><ArtifactIcon kind={artifact.kind} /></span>
                    <span className="artifact-label"><strong>{artifact.name}</strong><small>{artifact.language}{referenceCount ? ` · ${referenceCount} live bindings` : ""}</small></span>
                    {artifact.id === selectedArtifact.id && <span className="active-notch" />}
                  </button>
                );
              })}
            </nav>
            <div className="file-rail-spacer" />
            <div className="workspace-note">
              <LayoutGrid aria-hidden="true" />
              <div><strong>One workspace</strong><span>Every artifact stays readable to people and agents.</span></div>
            </div>
            <div className="local-badge"><span className="pulse-dot" /> Local-first prototype</div>
          </aside>
        )}

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
              className="source-editor"
              value={selectedArtifact.source}
              onChange={(event) => updateSource(event.target.value)}
              onScroll={(event) => { if (gutterRef.current) gutterRef.current.scrollTop = event.currentTarget.scrollTop; }}
              spellCheck={false}
              aria-label={`Edit ${selectedArtifact.name} source`}
            />
          </div>

          <div className="agent-dock">
            <div className="agent-title-row">
              <div className="agent-identity"><span className="agent-avatar"><Bot aria-hidden="true" /></span><div><strong>Rune Agent</strong><small>{agentScope === "workspace" ? "Coordinates canonical sources" : "Plans a patch before writing"}</small></div></div>
              <div className="agent-controls">
                <div className="agent-scope-switch" role="group" aria-label="Agent change scope">
                  {(["artifact", "workspace"] as const).map((scope) => (
                    <button
                      key={scope}
                      className={agentScope === scope ? "active" : ""}
                      onClick={() => {
                        setAgentScope(scope);
                        setPendingChange(null);
                        setAgentError("");
                        setNotice(scope === "workspace" ? "Workspace Agent scope enabled" : "Current-file Agent scope enabled");
                      }}
                      disabled={agentState === "planning"}
                      aria-pressed={agentScope === scope}
                    >
                      {scope === "artifact" ? "File" : "Workspace"}
                    </button>
                  ))}
                </div>
                <span className={`local-planner-badge ${agentMode}`}>{agentMode === "openai" ? "Model connected" : "Local fallback"}</span>
              </div>
            </div>

            <div className="quick-commands" aria-label="Suggested commands">
              {(agentScope === "workspace" ? workspaceQuickCommands : quickCommands[selectedArtifact.kind]).map((command) => (
                <button key={command} onClick={() => void runAgent(command)} disabled={agentState === "planning"}>{command}</button>
              ))}
            </div>

            {pendingChange && (
              <div className="patch-card">
                <div className="patch-icon"><History aria-hidden="true" /></div>
                <div className="patch-copy">
                  <span className="overline">Proposed {pendingChange.scope === "workspace" ? "workspace" : "file"} patch · {pendingChange.provider === "openai" ? "Model" : "Local"}</span>
                  <strong>{pendingChange.summary}</strong>
                  <p>{pendingChange.detail}</p>
                  <div className="diff-summary"><span>{pendingChange.patches.length} {pendingChange.patches.length === 1 ? "file" : "files"}</span><span className="additions">+{pendingTotals.additions}</span><span className="removals">−{pendingTotals.removals}</span><span>changed lines</span></div>
                  <div className="patch-file-list" aria-label="Files in proposed patch">
                    {pendingStats.map(({ artifact, patch, additions, removals }) => (
                      <button
                        key={artifact.id}
                        className={`patch-file-row ${artifact.id === selectedArtifact.id ? "active" : ""}`}
                        onClick={() => selectArtifact(artifact.id)}
                        aria-label={`Review ${artifact.name}`}
                      >
                        <span className={`artifact-icon ${artifact.kind}`}><ArtifactIcon kind={artifact.kind} size={13} /></span>
                        <span className="patch-file-label"><strong>{artifact.name}</strong><small>{patch.summary}</small></span>
                        <span className="patch-file-diff"><b>+{additions}</b><i>−{removals}</i></span>
                      </button>
                    ))}
                  </div>
                  {selectedPendingStat ? (
                    <div className="patch-source-diff" aria-label={`Source diff for ${selectedPendingStat.artifact.name}`}>
                      <div className="patch-source-diff-header"><span>Source diff</span><strong>{selectedPendingStat.artifact.name}</strong></div>
                      <pre>{selectedDiffPreview.map((line, index) => (
                        <code className={line.kind} key={`${line.kind}-${index}`}><span>{line.kind === "addition" ? "+" : line.kind === "removal" ? "−" : " "}</span>{line.text || " "}</code>
                      ))}</pre>
                    </div>
                  ) : (
                    <p className="patch-review-hint">Select a changed file to inspect its source diff.</p>
                  )}
                </div>
                <div className="patch-actions">
                  <button className="button primary-button" onClick={applyPendingChange}><Check aria-hidden="true" /> {pendingChange.patches.length > 1 ? "Apply all" : "Apply"}</button>
                  <button className="icon-button small" onClick={() => setPendingChange(null)} aria-label="Discard proposed patch" title="Discard"><X /></button>
                </div>
              </div>
            )}

            {agentError && <div className="agent-error" role="alert">{agentError}</div>}

            <div className="agent-composer">
              <Sparkles className="composer-spark" aria-hidden="true" />
              <textarea
                value={prompt}
                onChange={(event) => setPrompt(event.target.value)}
                onKeyDown={onPromptKeyDown}
                placeholder={agentScope === "workspace" ? "Ask Rune to coordinate this workspace…" : `Ask Rune to change ${selectedArtifact.name}…`}
                rows={1}
                aria-label={agentScope === "workspace" ? "Describe a workspace change" : "Describe an artifact change"}
              />
              <button className="run-button" onClick={() => void runAgent()} disabled={!prompt.trim() || agentState === "planning"} aria-label="Plan change" title="Plan change (⌘ Enter)">{agentState === "planning" ? <LoaderCircle className="agent-spinner" /> : <Play />}</button>
            </div>
            <p className="agent-hint">⌘ Enter to plan · {agentScope === "workspace" ? "All files validate and apply atomically" : "Every write is reviewable and undoable"}</p>
          </div>
        </section>

        <section className="preview-pane" aria-label="Compiled artifact preview">
          <header className="pane-header preview-header">
            <div className="pane-title">
              <span className="preview-mark"><FileCode2 aria-hidden="true" /></span>
              <div><span className="overline">Compiled output</span><strong>Live preview</strong></div>
            </div>
            <div className="preview-actions">
              {selectedArtifact.kind === "query" && canonicalDataArtifact && <span className="binding-badge query"><Database aria-hidden="true" /> 1 source</span>}
              {selectedArtifact.kind === "chart" && selectedChartResolution?.model && <span className="binding-badge chart"><TableProperties aria-hidden="true" /> 1 source</span>}
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
            {selectedArtifact.kind === "chart" && selectedChartResolution?.model && (
              <div className="lineage-strip chart-lineage">
                <TableProperties aria-hidden="true" />
                <span>{selectedChartResolution.model.sourceArtifactName}</span>
                <ChevronRight aria-hidden="true" />
                <span>{selectedArtifact.name}</span>
                <strong>{selectedChartResolution.model.data.length} marks compiled live</strong>
              </div>
            )}
            {selectedArtifact.kind === "query" && canonicalDataArtifact && (
              <div className="lineage-strip query-lineage">
                <TableProperties aria-hidden="true" />
                <span>{canonicalDataArtifact.name}</span>
                <ChevronRight aria-hidden="true" />
                <span>workspace_data</span>
                <ChevronRight aria-hidden="true" />
                <span>{selectedArtifact.name}</span>
                <strong>Browser-local SQL</strong>
              </div>
            )}
            {!!bindingState?.references.length && (
              <div className="lineage-strip">
                <Database aria-hidden="true" />
                <span>{artifacts.find((artifact) => artifact.kind === "data")?.name ?? "workspace data"}</span>
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
            <div className="preview-scroll"><ArtifactPreview artifact={selectedArtifact} artifacts={artifacts} /></div>
          </div>
        </section>
      </div>

      <footer className="statusbar">
        <div><span className="status-agent-dot" /> {notice}</div>
        <div className="statusbar-right"><span>{artifactStats(selectedArtifact)}</span>{!!bindingState?.references.length && <span>{bindingState.references.length} linked metrics</span>}{!!bindingState?.chartReferences.length && <span>{bindingState.chartReferences.length} linked chart{bindingState.chartReferences.length > 1 ? "s" : ""}</span>}<span>UTF-8</span><span>Rune v0.5</span></div>
      </footer>
    </main>
  );
}
