"use client";

import { Code2, Columns2, Eye } from "lucide-react";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type RefObject,
} from "react";
import type { OrbitUICopy } from "../lib/localization";
import {
  clampWorkspaceSourcePercent,
  DEFAULT_WORKSPACE_SOURCE_PERCENT,
  MAX_WORKSPACE_SOURCE_PERCENT,
  MIN_WORKSPACE_SOURCE_PERCENT,
  ORBIT_WORKSPACE_VIEW_CONTRIBUTIONS,
  workspaceSplitPercentFromDrag,
  type OrbitWorkspaceSplitGeometry,
  type OrbitWorkspaceView,
} from "../lib/workspace-layout";

type WorkspaceViewSwitchProps = {
  ui: OrbitUICopy["workbench"];
  view: OrbitWorkspaceView;
  onChange: (view: OrbitWorkspaceView) => void;
};

function WorkspaceViewIcon({ view }: { view: OrbitWorkspaceView }) {
  if (view === "split") return <Columns2 aria-hidden="true" />;
  if (view === "source") return <Code2 aria-hidden="true" />;
  return <Eye aria-hidden="true" />;
}

function workspaceViewLabel(ui: OrbitUICopy["workbench"], view: OrbitWorkspaceView) {
  if (view === "split") return { short: ui.splitView, accessible: ui.showSplitView };
  if (view === "source") return { short: ui.sourceView, accessible: ui.showSourceView };
  return { short: ui.previewView, accessible: ui.showPreviewView };
}

/** One retained, locale-safe segmented control shared by both pane headers. */
export function WorkspaceViewSwitch({ ui, view, onChange }: WorkspaceViewSwitchProps) {
  return (
    <div className="workspace-view-switch" role="group" aria-label={ui.workspaceView} data-view={view}>
      {ORBIT_WORKSPACE_VIEW_CONTRIBUTIONS.map((contribution) => {
        const label = workspaceViewLabel(ui, contribution.id);
        const shortcut = `⌘⌥${contribution.shortcutNumber} / Ctrl Alt ${contribution.shortcutNumber}`;
        return (
          <button
            data-workspace-view-option={contribution.id}
            type="button"
            className={view === contribution.id ? "active" : ""}
            aria-pressed={view === contribution.id}
            aria-label={label.accessible}
            aria-keyshortcuts={`Meta+Alt+${contribution.shortcutNumber} Control+Alt+${contribution.shortcutNumber}`}
            title={`${label.accessible} · ${shortcut}`}
            onClick={() => onChange(contribution.id)}
            key={contribution.id}
          >
            <WorkspaceViewIcon view={contribution.id} />
            <span>{label.short}</span>
          </button>
        );
      })}
    </div>
  );
}

type WorkspaceSplitterProps = {
  workspaceRef: RefObject<HTMLDivElement | null>;
  value: number;
  label: string;
  valueText: string;
  resetLabel: string;
  onChange: (value: number) => void;
  onCommit: (value: number) => void;
};

function workspaceSplitGeometry(workspace: HTMLDivElement, originX: number): OrbitWorkspaceSplitGeometry | null {
  const sourcePane = workspace.querySelector<HTMLElement>(":scope > .source-pane");
  const previewPane = workspace.querySelector<HTMLElement>(":scope > .preview-pane");
  if (!sourcePane || !previewPane) return null;
  const sourceRect = sourcePane.getBoundingClientRect();
  const previewRect = previewPane.getBoundingClientRect();
  const width = sourceRect.width + previewRect.width;
  if (width <= 0) return null;
  return {
    basePercent: clampWorkspaceSourcePercent((sourceRect.width / width) * 100),
    originX,
    width,
    rtl: document.documentElement.dir === "rtl",
  };
}

/**
 * A frame-owned separator. Pointer capture keeps the gesture alive outside
 * the hit strip; requestAnimationFrame prevents React updates from outrunning
 * paint; persistence happens once, after the gesture settles.
 */
export function WorkspaceSplitter({
  workspaceRef,
  value,
  label,
  valueText,
  resetLabel,
  onChange,
  onCommit,
}: WorkspaceSplitterProps) {
  const [dragging, setDragging] = useState(false);
  const draggingRef = useRef(false);
  const geometryRef = useRef<OrbitWorkspaceSplitGeometry | null>(null);
  const latestClientXRef = useRef(0);
  const latestPercentRef = useRef(value);
  const frameRef = useRef<number | null>(null);
  const movedRef = useRef(false);

  useEffect(() => {
    if (!draggingRef.current) latestPercentRef.current = value;
  }, [value]);

  const flushPointer = useCallback(() => {
    frameRef.current = null;
    const geometry = geometryRef.current;
    if (!geometry) return;
    const next = workspaceSplitPercentFromDrag(latestClientXRef.current, geometry);
    latestPercentRef.current = next;
    onChange(next);
  }, [onChange]);

  const finishDrag = useCallback(() => {
    if (!draggingRef.current) return;
    if (frameRef.current !== null) {
      window.cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
      flushPointer();
    }
    draggingRef.current = false;
    geometryRef.current = null;
    document.body.classList.remove("workspace-resizing");
    setDragging(false);
    onCommit(latestPercentRef.current);
  }, [flushPointer, onCommit]);

  useEffect(
    () => () => {
      if (frameRef.current !== null) window.cancelAnimationFrame(frameRef.current);
      draggingRef.current = false;
      document.body.classList.remove("workspace-resizing");
    },
    [],
  );

  const handlePointerDown = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (
        draggingRef.current ||
        event.button !== 0 ||
        !event.isPrimary ||
        window.matchMedia("(max-width: 960px)").matches
      )
        return;
      const workspace = workspaceRef.current;
      if (!workspace) return;
      const geometry = workspaceSplitGeometry(workspace, event.clientX);
      if (!geometry) return;
      event.preventDefault();
      geometryRef.current = geometry;
      latestClientXRef.current = event.clientX;
      latestPercentRef.current = value;
      movedRef.current = false;
      draggingRef.current = true;
      setDragging(true);
      document.body.classList.add("workspace-resizing");
      event.currentTarget.setPointerCapture(event.pointerId);
    },
    [value, workspaceRef],
  );

  const handlePointerMove = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (!draggingRef.current || !event.currentTarget.hasPointerCapture(event.pointerId)) return;
      latestClientXRef.current = event.clientX;
      movedRef.current = true;
      frameRef.current ??= window.requestAnimationFrame(flushPointer);
    },
    [flushPointer],
  );

  const handlePointerEnd = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (!draggingRef.current) return;
      latestClientXRef.current = event.clientX;
      if (movedRef.current && frameRef.current !== null) {
        window.cancelAnimationFrame(frameRef.current);
        frameRef.current = null;
      }
      if (movedRef.current) flushPointer();
      finishDrag();
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
    },
    [finishDrag, flushPointer],
  );

  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLDivElement>) => {
      const direction = document.documentElement.dir === "rtl" ? -1 : 1;
      const step = event.shiftKey ? 5 : 2;
      let next: number | null = null;
      if (event.key === "Home") next = DEFAULT_WORKSPACE_SOURCE_PERCENT;
      else if (event.key === "ArrowLeft") next = clampWorkspaceSourcePercent(value - step * direction);
      else if (event.key === "ArrowRight") next = clampWorkspaceSourcePercent(value + step * direction);
      if (next === null) return;
      event.preventDefault();
      onChange(next);
      onCommit(next);
    },
    [onChange, onCommit, value],
  );

  return (
    <div
      className="workspace-splitter"
      role="separator"
      aria-orientation="vertical"
      aria-label={label}
      aria-valuemin={MIN_WORKSPACE_SOURCE_PERCENT}
      aria-valuemax={MAX_WORKSPACE_SOURCE_PERCENT}
      aria-valuenow={Math.round(value)}
      aria-valuetext={valueText}
      data-dragging={dragging || undefined}
      tabIndex={0}
      title={`${label} · ${resetLabel}`}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerEnd}
      onPointerCancel={finishDrag}
      onLostPointerCapture={finishDrag}
      onKeyDown={handleKeyDown}
      onDoubleClick={() => {
        onChange(DEFAULT_WORKSPACE_SOURCE_PERCENT);
        onCommit(DEFAULT_WORKSPACE_SOURCE_PERCENT);
      }}
    >
      <span aria-hidden="true" />
    </div>
  );
}
