"use client";

import { Pin, RefreshCw } from "lucide-react";
import { useState, type ReactNode } from "react";
import type { ArtifactRailGroup } from "../lib/artifact-rail-model";
import type { OrbitUICopy } from "../lib/localization";
import type { WorkspaceArtifact } from "../lib/workspace";

export function WorkspaceArtifactList({
  groups,
  referenceCounts,
  selectedId,
  pinnedIds,
  contextIds,
  briefingFreshness,
  copy,
  locked,
  creationDisabled,
  renderIcon,
  onSelect,
  onTogglePin,
  onReviewRefresh,
}: {
  groups: readonly ArtifactRailGroup[];
  referenceCounts: ReadonlyMap<string, number>;
  selectedId: string;
  pinnedIds: readonly string[];
  contextIds: ReadonlySet<string>;
  briefingFreshness: ReadonlyMap<string, "current" | "changed" | "unknown">;
  copy: OrbitUICopy["workbench"];
  locked: boolean;
  creationDisabled: boolean;
  renderIcon: (artifact: WorkspaceArtifact) => ReactNode;
  onSelect: (id: string) => void;
  onTogglePin: (id: string) => void;
  onReviewRefresh: (id: string) => void;
}) {
  const [visualSelection, setVisualSelection] = useState<{ from: string; to: string } | null>(null);
  const displayedSelectedId =
    visualSelection && (selectedId === visualSelection.from || selectedId === visualSelection.to)
      ? visualSelection.to
      : selectedId;

  function select(id: string) {
    setVisualSelection({ from: selectedId, to: id });
    // Commit the requested identity in the click turn so the old editor is
    // disabled before another pointer or keyboard action can reach it. The
    // Workbench still defers expensive preview compilation separately.
    onSelect(id);
  }

  return (
    <nav className="artifact-groups" aria-label={copy.artifacts}>
      {groups.map((group) => (
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
              const referenceCount = referenceCounts.get(artifact.id) ?? 0;
              const pinned = pinnedIds.includes(artifact.id);
              const inAgentContext = contextIds.has(artifact.id);
              const freshness = briefingFreshness.get(artifact.id);
              return (
                <div
                  className={`artifact-row-shell ${inAgentContext ? "in-agent-context" : ""} ${freshness === "changed" ? "has-refresh" : ""}`.trim()}
                  data-agent-context={inAgentContext ? "true" : undefined}
                  key={artifact.id}
                >
                  <button
                    className={`artifact-row ${artifact.id === displayedSelectedId ? "active" : ""}`}
                    disabled={locked}
                    onClick={() => select(artifact.id)}
                  >
                    <span className={`artifact-icon ${artifact.kind}`}>{renderIcon(artifact)}</span>
                    <span className="artifact-label">
                      <strong>{artifact.name}</strong>
                      <small>
                        <span>
                          {artifact.language}
                          {referenceCount ? ` · ${copy.liveBindings(referenceCount)}` : ""}
                        </span>
                        {freshness === "changed" && (
                          <span className="artifact-refresh-status">{copy.refreshAvailable}</span>
                        )}
                      </small>
                    </span>
                  </button>
                  <button
                    type="button"
                    className={`artifact-context-pin ${pinned ? "active" : ""}`.trim()}
                    aria-label={copy.pinContext(artifact.name, pinned)}
                    aria-pressed={pinned}
                    title={pinned ? copy.removePin : copy.keepPin}
                    disabled={locked}
                    onClick={() => onTogglePin(artifact.id)}
                  >
                    <Pin aria-hidden="true" />
                  </button>
                  {freshness === "changed" && (
                    <button
                      type="button"
                      className="artifact-refresh-action"
                      aria-label={`${copy.reviewRefresh} · ${artifact.name}`}
                      title={copy.reviewRefresh}
                      disabled={creationDisabled}
                      onClick={() => onReviewRefresh(artifact.id)}
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
  );
}
