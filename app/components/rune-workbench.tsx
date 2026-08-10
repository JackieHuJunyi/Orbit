"use client";

import {
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
  PanelLeftClose,
  PanelLeftOpen,
  Play,
  Presentation,
  RotateCcw,
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
  planLocalChange,
  quickCommands,
  validateArtifact,
  type ArtifactKind,
  type WorkspaceArtifact,
} from "../lib/workspace";

const STORAGE_KEY = "rune-workspace-v0";
const MAX_IMPORT_SIZE = 2 * 1024 * 1024;

type PendingChange = {
  artifactId: string;
  prompt: string;
  nextSource: string;
  summary: string;
  detail: string;
};

function ArtifactIcon({ kind, size = 16 }: { kind: ArtifactKind; size?: number }) {
  if (kind === "document") return <FileText size={size} aria-hidden="true" />;
  if (kind === "data") return <TableProperties size={size} aria-hidden="true" />;
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

function downloadArtifact(artifact: WorkspaceArtifact) {
  const mime = artifact.kind === "document"
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
  const [saveState, setSaveState] = useState<"saved" | "saving">("saved");
  const [savedAt, setSavedAt] = useState("just now");
  const [fileRailOpen, setFileRailOpen] = useState(true);
  const [prompt, setPrompt] = useState("");
  const [pendingChange, setPendingChange] = useState<PendingChange | null>(null);
  const [agentError, setAgentError] = useState("");
  const [history, setHistory] = useState<Record<string, string[]>>({});
  const [notice, setNotice] = useState("Local workspace ready");
  const gutterRef = useRef<HTMLPreElement>(null);
  const importRef = useRef<HTMLInputElement>(null);

  const selectedArtifact = artifacts.find((artifact) => artifact.id === selectedId) ?? artifacts[0];
  const validationErrors = useMemo(
    () => selectedArtifact ? validateArtifact(selectedArtifact) : ["No artifact selected."],
    [selectedArtifact],
  );
  const lineNumbers = useMemo(
    () => Array.from({ length: selectedArtifact?.source.split("\n").length ?? 1 }, (_, index) => index + 1).join("\n"),
    [selectedArtifact?.source],
  );
  const diffStats = useMemo(() => {
    if (!pendingChange || !selectedArtifact) return null;
    return getDiffStats(selectedArtifact.source, pendingChange.nextSource);
  }, [pendingChange, selectedArtifact]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
          const parsed = JSON.parse(stored) as { artifacts?: WorkspaceArtifact[]; selectedId?: string };
          if (Array.isArray(parsed.artifacts) && parsed.artifacts.length) {
            setArtifacts(parsed.artifacts);
            setSelectedId(parsed.selectedId ?? parsed.artifacts[0].id);
            setNotice("Restored the latest device draft");
          }
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
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ artifacts, selectedId }));
      setSaveState("saved");
      setSavedAt(new Intl.DateTimeFormat("en", { hour: "2-digit", minute: "2-digit" }).format(new Date()));
    }, 450);
    return () => window.clearTimeout(timer);
  }, [artifacts, hydrated, selectedId]);

  useEffect(() => {
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey) || event.key.toLowerCase() !== "s") return;
      event.preventDefault();
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ artifacts, selectedId }));
      setSaveState("saved");
      setSavedAt("just now");
      setNotice("Checkpoint saved on this device");
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [artifacts, selectedId]);

  if (!selectedArtifact) return null;

  function selectArtifact(id: string) {
    setSaveState("saving");
    setSelectedId(id);
    setPendingChange(null);
    setAgentError("");
    setNotice("Switched artifact context");
  }

  function updateSource(source: string) {
    setSaveState("saving");
    setArtifacts((current) => current.map((artifact) => (
      artifact.id === selectedArtifact.id ? { ...artifact, source } : artifact
    )));
    if (pendingChange?.artifactId === selectedArtifact.id) setPendingChange(null);
  }

  function runAgent(nextPrompt = prompt) {
    try {
      const plan = planLocalChange(selectedArtifact, nextPrompt);
      setPendingChange({ artifactId: selectedArtifact.id, prompt: nextPrompt, ...plan });
      setAgentError("");
      setPrompt("");
      setNotice("Agent prepared a patch for review");
    } catch (error) {
      setPendingChange(null);
      setAgentError(error instanceof Error ? error.message : "Rune could not plan that change.");
      setNotice("Agent needs a more specific instruction");
    }
  }

  function applyPendingChange() {
    if (!pendingChange || pendingChange.artifactId !== selectedArtifact.id) return;
    setHistory((current) => ({
      ...current,
      [selectedArtifact.id]: [...(current[selectedArtifact.id] ?? []), selectedArtifact.source].slice(-20),
    }));
    updateSource(pendingChange.nextSource);
    setPendingChange(null);
    setNotice("Patch applied — undo remains available");
  }

  function undoLastAgentChange() {
    const stack = history[selectedArtifact.id] ?? [];
    const previous = stack.at(-1);
    if (previous == null) return;
    updateSource(previous);
    setHistory((current) => ({ ...current, [selectedArtifact.id]: stack.slice(0, -1) }));
    setNotice("Restored the previous checkpoint");
  }

  function resetWorkspace() {
    if (!window.confirm("Reset this device draft to the Rune sample workspace?")) return;
    const defaults = cloneDefaultArtifacts();
    setSaveState("saving");
    setArtifacts(defaults);
    setSelectedId(defaults[0].id);
    setHistory({});
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
      setNotice("Choose a Markdown, CSV, JSON, or HTML file");
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
      runAgent();
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
          <div className={`save-indicator ${saveState}`} title={`Last saved ${savedAt}`}>
            {saveState === "saved" ? <Check /> : <CircleDot />}
            <span>{saveState === "saved" ? "Saved on device" : "Saving"}</span>
          </div>
          <button className="button ghost-button" onClick={() => importRef.current?.click()}>
            <Upload aria-hidden="true" /> Import
          </button>
          <button className="icon-button" onClick={() => downloadArtifact(selectedArtifact)} aria-label={`Download ${selectedArtifact.name}`} title="Download source">
            <Download />
          </button>
          <input ref={importRef} className="visually-hidden" type="file" accept=".md,.markdown,.csv,.json,.html,.htm" onChange={importFile} />
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
              {artifacts.map((artifact) => (
                <button
                  key={artifact.id}
                  className={`artifact-row ${artifact.id === selectedArtifact.id ? "active" : ""}`}
                  onClick={() => selectArtifact(artifact.id)}
                >
                  <span className={`artifact-icon ${artifact.kind}`}><ArtifactIcon kind={artifact.kind} /></span>
                  <span className="artifact-label"><strong>{artifact.name}</strong><small>{artifact.language}</small></span>
                  {artifact.id === selectedArtifact.id && <span className="active-notch" />}
                </button>
              ))}
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
                className="icon-button small"
                onClick={undoLastAgentChange}
                disabled={!(history[selectedArtifact.id]?.length)}
                aria-label="Undo last agent change"
                title="Undo agent change"
              ><Undo2 /></button>
            </div>
          </header>

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
              <div className="agent-identity"><span className="agent-avatar"><Bot aria-hidden="true" /></span><div><strong>Rune Agent</strong><small>Plans a patch before writing</small></div></div>
              <span className="local-planner-badge">Local planner</span>
            </div>

            <div className="quick-commands" aria-label="Suggested commands">
              {quickCommands[selectedArtifact.kind].map((command) => (
                <button key={command} onClick={() => runAgent(command)}>{command}</button>
              ))}
            </div>

            {pendingChange && pendingChange.artifactId === selectedArtifact.id && diffStats && (
              <div className="patch-card">
                <div className="patch-icon"><History aria-hidden="true" /></div>
                <div className="patch-copy">
                  <span className="overline">Proposed patch</span>
                  <strong>{pendingChange.summary}</strong>
                  <p>{pendingChange.detail}</p>
                  <div className="diff-summary"><span className="additions">+{diffStats.additions}</span><span className="removals">−{diffStats.removals}</span><span>changed lines</span></div>
                </div>
                <div className="patch-actions">
                  <button className="button primary-button" onClick={applyPendingChange}><Check aria-hidden="true" /> Apply</button>
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
                placeholder={`Ask Rune to change ${selectedArtifact.name}…`}
                rows={1}
                aria-label="Describe an artifact change"
              />
              <button className="run-button" onClick={() => runAgent()} disabled={!prompt.trim()} aria-label="Plan change" title="Plan change (⌘ Enter)"><Play /></button>
            </div>
            <p className="agent-hint">⌘ Enter to plan · Every write is reviewable and undoable</p>
          </div>
        </section>

        <section className="preview-pane" aria-label="Compiled artifact preview">
          <header className="pane-header preview-header">
            <div className="pane-title">
              <span className="preview-mark"><FileCode2 aria-hidden="true" /></span>
              <div><span className="overline">Compiled output</span><strong>Live preview</strong></div>
            </div>
            {validationErrors.length ? (
              <span className="validation-badge error"><X aria-hidden="true" /> {validationErrors.length} issue{validationErrors.length > 1 ? "s" : ""}</span>
            ) : (
              <span className="validation-badge"><CheckCircle2 aria-hidden="true" /> Valid</span>
            )}
          </header>
          <div className="preview-body"><ArtifactPreview artifact={selectedArtifact} /></div>
        </section>
      </div>

      <footer className="statusbar">
        <div><span className="status-agent-dot" /> {notice}</div>
        <div className="statusbar-right"><span>{artifactStats(selectedArtifact)}</span><span>UTF-8</span><span>Rune v0.1</span></div>
      </footer>
    </main>
  );
}
