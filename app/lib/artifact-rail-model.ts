import { findMetricReferences, findQueryMetricReferences } from "./bindings.ts";
import { findChartReferences } from "./charts.ts";
import type { WorkspaceArtifact } from "./workspace.ts";

export type ArtifactRailGroup = Readonly<{
  id: string;
  label: string;
  artifacts: WorkspaceArtifact[];
}>;

export function buildArtifactRailModel(
  artifacts: WorkspaceArtifact[],
  labels: { sources: string; analysis: string; deliverables: string },
) {
  const groups: ArtifactRailGroup[] = [
    { id: "sources", label: labels.sources, artifacts: artifacts.filter((artifact) => artifact.kind === "data") },
    {
      id: "analysis",
      label: labels.analysis,
      artifacts: artifacts.filter((artifact) => artifact.kind === "query" || artifact.kind === "chart"),
    },
    {
      id: "deliverables",
      label: labels.deliverables,
      artifacts: artifacts.filter((artifact) => artifact.kind === "document" || artifact.kind === "slides"),
    },
  ].filter((group) => group.artifacts.length > 0);
  const referenceCounts = new Map(
    artifacts.map((artifact) => [
      artifact.id,
      findMetricReferences(artifact.source).length +
        findQueryMetricReferences(artifact.source).length +
        findChartReferences(artifact.source).length,
    ]),
  );
  return { groups, referenceCounts } as const;
}
