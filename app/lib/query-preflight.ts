import {
  compileArtifactSource,
  findMetricReferences,
  findQueryMetricReferences,
  queryMetricReferenceKey,
} from "./bindings.ts";
import { parseChartSource, resolveChartModel } from "./charts.ts";
import { prepareWorkspaceMutation, type ArtifactCreationChange, type ArtifactSourcePatch } from "./patches.ts";
import { resolveQueryDataArtifact } from "./query-source.ts";
import { workspaceQuerySnapshotIsCurrent, type WorkspaceQuerySnapshot } from "./query-snapshot.ts";
import { parseDataSource, type WorkspaceArtifact } from "./workspace.ts";

export type RuntimeImpactPreflight = {
  dataCount: number;
  queryCount: number;
  legacyMetricConsumerCount: number;
  scalarConsumerCount: number;
  chartConsumerCount: number;
  dataNames: string[];
  queryNames: string[];
};

export type QueryPreflightRunner = (
  queryArtifact: WorkspaceArtifact,
  dataArtifact: WorkspaceArtifact,
) => Promise<WorkspaceQuerySnapshot>;

export async function preflightAgentRuntimeImpact(
  artifacts: WorkspaceArtifact[],
  patches: ArtifactSourcePatch[],
  creations: ArtifactCreationChange[],
  runSnapshot: QueryPreflightRunner,
): Promise<RuntimeImpactPreflight | null> {
  const changedDataIds = new Set<string>();
  const changedQueryIds = new Set<string>();
  const changedChartIds = new Set<string>();
  patches.forEach((patch) => {
    const kind = artifacts.find((artifact) => artifact.id === patch.artifactId)?.kind;
    if (kind === "data") changedDataIds.add(patch.artifactId);
    if (kind === "query") changedQueryIds.add(patch.artifactId);
    if (kind === "chart") changedChartIds.add(patch.artifactId);
  });
  creations.forEach(({ artifact }) => {
    if (artifact.kind === "data") changedDataIds.add(artifact.id);
    if (artifact.kind === "query") changedQueryIds.add(artifact.id);
    if (artifact.kind === "chart") changedChartIds.add(artifact.id);
  });
  if (!changedDataIds.size && !changedQueryIds.size && !changedChartIds.size) return null;

  const prepared = prepareWorkspaceMutation(artifacts, patches, creations);
  if (prepared.errors.length) throw new Error(prepared.errors[0]);
  const changedData = prepared.nextArtifacts.filter((artifact) => changedDataIds.has(artifact.id));
  const changedChartQueryIds = new Set<string>();
  prepared.nextArtifacts
    .filter((artifact) => artifact.kind === "chart" && changedChartIds.has(artifact.id))
    .forEach((artifact) => {
      const sourceId = parseChartSource(artifact.source).spec?.source;
      if (prepared.nextArtifacts.some((candidate) => candidate.id === sourceId && candidate.kind === "query")) {
        changedChartQueryIds.add(sourceId ?? "");
      }
    });
  const impactedQueries = prepared.nextArtifacts.filter((artifact) => {
    if (artifact.kind !== "query") return false;
    if (changedQueryIds.has(artifact.id)) return true;
    if (changedChartQueryIds.has(artifact.id)) return true;
    const resolution = resolveQueryDataArtifact(artifact, prepared.nextArtifacts);
    return Boolean(resolution.artifact && changedDataIds.has(resolution.artifact.id));
  });
  const impactedQueryIds = new Set(impactedQueries.map((artifact) => artifact.id));
  const snapshots: WorkspaceQuerySnapshot[] = [];
  for (const queryArtifact of impactedQueries) {
    const resolution = resolveQueryDataArtifact(queryArtifact, prepared.nextArtifacts);
    if (!resolution.artifact) {
      throw new Error(`${queryArtifact.name}: ${resolution.errors[0] ?? "Query Data source is unresolved."}`);
    }
    try {
      const snapshot = await runSnapshot(queryArtifact, resolution.artifact);
      if (!workspaceQuerySnapshotIsCurrent(snapshot, queryArtifact, resolution.artifact)) {
        throw new Error("The Query result became stale during runtime preflight.");
      }
      snapshots.push(snapshot);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`${queryArtifact.name}: ${message || "Query runtime failed."}`);
    }
  }

  const legacyMetricConsumerKeys = new Set<string>();
  const canonicalData = prepared.nextArtifacts.find((artifact) => artifact.kind === "data");
  if (canonicalData && changedDataIds.has(canonicalData.id)) {
    for (const artifact of prepared.nextArtifacts) {
      const references = findMetricReferences(artifact.source);
      references.forEach((reference) => {
        legacyMetricConsumerKeys.add(`${artifact.id}\u0000${reference}`);
      });
      if (!references.length) continue;
      const compiled = compileArtifactSource(artifact.source, prepared.nextArtifacts, snapshots);
      if (compiled.unresolved.length) {
        throw new Error(`${artifact.name}: unresolved metric ${compiled.unresolved[0]}.`);
      }
    }
  }

  const scalarConsumerKeys = new Set<string>();
  for (const artifact of prepared.nextArtifacts) {
    const impactedReferences = findQueryMetricReferences(artifact.source)
      .filter((reference) => impactedQueryIds.has(reference.queryArtifactId));
    impactedReferences.forEach((reference) => {
      scalarConsumerKeys.add(`${artifact.id}\u0000${queryMetricReferenceKey(reference)}`);
    });
    if (!impactedReferences.length) continue;
    const compiled = compileArtifactSource(artifact.source, prepared.nextArtifacts, snapshots);
    if (compiled.queryMetricRuntimeErrors.length) {
      throw new Error(`${artifact.name}: ${compiled.queryMetricRuntimeErrors[0]}`);
    }
  }

  let chartConsumerCount = 0;
  for (const chartArtifact of prepared.nextArtifacts.filter((artifact) => artifact.kind === "chart")) {
    const spec = parseChartSource(chartArtifact.source).spec;
    if (!spec || (!changedChartIds.has(chartArtifact.id)
      && !impactedQueryIds.has(spec.source)
      && !changedDataIds.has(spec.source))) continue;
    chartConsumerCount += 1;
    const resolution = resolveChartModel(
      chartArtifact,
      prepared.nextArtifacts,
      parseDataSource,
      snapshots,
    );
    if (!resolution.model) {
      throw new Error(`${chartArtifact.name}: ${resolution.errors[0] ?? "Query-backed chart runtime failed."}`);
    }
  }

  return {
    dataCount: changedData.length,
    queryCount: impactedQueries.length,
    legacyMetricConsumerCount: legacyMetricConsumerKeys.size,
    scalarConsumerCount: scalarConsumerKeys.size,
    chartConsumerCount,
    dataNames: changedData.map((artifact) => artifact.name),
    queryNames: impactedQueries.map((artifact) => artifact.name),
  };
}
