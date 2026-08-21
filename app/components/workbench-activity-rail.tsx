"use client";

import {
  ClipboardList,
  Database,
  FilePlus2,
  FolderOpen,
  Presentation,
  RotateCcw,
  Settings,
  Sparkles,
} from "lucide-react";
import type { RefObject } from "react";
import type { WorkbenchMenuFocusEdge } from "./use-workbench-menu-focus";

export type WorkbenchActivityRailProps = Readonly<{
  railView: "workspace" | "graph";
  sectionLabel: string;
  workspaceFilesLabel: string;
  newArtifactLabel: string;
  createOperatingReviewLabel: string;
  documentBriefingLabel: string;
  focusAgentLabel: string;
  dataGraphLabel: string;
  resetSampleLabel: string;
  settingsLabel: string;
  settingsExpanded: boolean;
  settingsTriggerRef: RefObject<HTMLButtonElement | null>;
  newArtifactDisabled: boolean;
  operatingReviewDisabled: boolean;
  documentBriefingDisabled: boolean;
  onSelectWorkspace: () => void;
  onSelectGraph: () => void;
  onNewArtifact: () => void;
  onOperatingReview: () => void;
  onDocumentBriefing: () => void;
  onFocusAgent: () => void;
  onReset: () => void;
  onToggleSettings: () => void;
  onOpenSettings: (edge: WorkbenchMenuFocusEdge) => void;
}>;

/** Props-only activity rail; the Workbench owns every action it dispatches. */
export function WorkbenchActivityRail({
  railView,
  sectionLabel,
  workspaceFilesLabel,
  newArtifactLabel,
  createOperatingReviewLabel,
  documentBriefingLabel,
  focusAgentLabel,
  dataGraphLabel,
  resetSampleLabel,
  settingsLabel,
  settingsExpanded,
  settingsTriggerRef,
  newArtifactDisabled,
  operatingReviewDisabled,
  documentBriefingDisabled,
  onSelectWorkspace,
  onSelectGraph,
  onNewArtifact,
  onOperatingReview,
  onDocumentBriefing,
  onFocusAgent,
  onReset,
  onToggleSettings,
  onOpenSettings,
}: WorkbenchActivityRailProps) {
  return (
    <aside className="activity-rail" aria-label={sectionLabel}>
      <div className="activity-group">
        <button
          className={`activity-button ${railView === "workspace" ? "active" : ""}`.trim()}
          onClick={onSelectWorkspace}
          aria-label={workspaceFilesLabel}
          aria-pressed={railView === "workspace"}
          title={workspaceFilesLabel}
        >
          <FolderOpen />
        </button>
        <button
          className="activity-button"
          onClick={onNewArtifact}
          disabled={newArtifactDisabled}
          aria-label={newArtifactLabel}
          title={newArtifactLabel}
        >
          <FilePlus2 />
        </button>
        <button
          className="activity-button"
          onClick={onOperatingReview}
          disabled={operatingReviewDisabled}
          aria-label={createOperatingReviewLabel}
          title={createOperatingReviewLabel}
        >
          <ClipboardList />
        </button>
        <button
          className="activity-button"
          onClick={onDocumentBriefing}
          disabled={documentBriefingDisabled}
          aria-label={documentBriefingLabel}
          title={documentBriefingLabel}
        >
          <Presentation />
        </button>
        <button className="activity-button" onClick={onFocusAgent} aria-label={focusAgentLabel} title={focusAgentLabel}>
          <Sparkles />
        </button>
        <button
          className={`activity-button ${railView === "graph" ? "active" : ""}`.trim()}
          onClick={onSelectGraph}
          aria-label={dataGraphLabel}
          aria-pressed={railView === "graph"}
          title={dataGraphLabel}
        >
          <Database />
        </button>
      </div>
      <div className="activity-group">
        <button className="activity-button" onClick={onReset} aria-label={resetSampleLabel} title={resetSampleLabel}>
          <RotateCcw />
        </button>
        <button
          ref={settingsTriggerRef}
          className="activity-button"
          data-settings-trigger
          onClick={onToggleSettings}
          onKeyDown={(event) => {
            if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
            event.preventDefault();
            onOpenSettings(event.key === "ArrowUp" ? "last" : "first");
          }}
          aria-label={settingsLabel}
          aria-expanded={settingsExpanded}
          aria-haspopup="menu"
          title={settingsLabel}
        >
          <Settings />
        </button>
      </div>
    </aside>
  );
}
