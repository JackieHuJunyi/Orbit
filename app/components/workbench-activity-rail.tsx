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
  onOpenSettings: () => void;
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
        <button className="activity-button" onClick={onOpenSettings} aria-label={settingsLabel} title={settingsLabel}>
          <Settings />
        </button>
      </div>
    </aside>
  );
}
