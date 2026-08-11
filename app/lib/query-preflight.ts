import { compileArtifactSource, findQueryMetricReferences, queryMetricReferenceKey } from "./bindings.ts";
import { parseChartSource, resolveChartModel } from "./charts.ts";
import { prepareWorkspaceMutation, type ArtifactCreationChange, type ArtifactSourcePatch } from "./patches.ts";
import { resolveQueryDataArtifact } from "./query-source.ts";
import { workspaceQuerySnapshotIsCurrent, type WorkspaceQuerySnapshot } from "./query-snapshot.ts";
import { parseDataSource, type WorkspaceArtifact } from "./workspace.ts";

export type QueryMutationPreflight = {
  queryCount: number;
  scalarConsumerCount: number;
  chartConsumerCount: number;
  queryNames: string[];
};

export type QueryPreflightRunner = (
  queryArtifact: WorkspaceArtifact,
  dataArtifact: WorkspaceArtifact,
) => Promise<WorkspaceQuerySnapshot>;

export async function preflightAgentQueryMutation(
  artifacts: WorkspaceArtifact[],
  patches: ArtifactSourcePatch[],
  creations: ArtifactCreationChange[],
  runSnapshot: QueryPreflightRunner,
): Promise<QueryMutationPreflight | null> {
  const changedQueryIds = new Set<string>();
  patches.forEach((patch) => {
    if (artifacts.find((artifact) => artifact.id === patch.artifactId)?.kind === "query") {
      changedQueryIds.add(patch.artifactId);
    }
  });
  creations.forEach(({ artifact }) => {
    if (artifact.kind === "query") changedQueryIds.add(artifact.id);
  });
  if (!changedQueryIds.size) return null;

  const prepared = prepareWorkspaceMutation(artifacts, patches, creations);
  if (prepared.errors.length) throw new Error(prepared.errors[0]);
  const changedQueries = prepared.nextArtifacts.filter((artifact) => changedQueryIds.has(artifact.id));
  const snapshots: WorkspaceQuerySnapshot[] = [];
  for (const queryArtifact of changedQueries) {
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

  const scalarConsumerKeys = new Set<string>();
  for (const artifact of prepared.nextArtifacts) {
    const changedReferences = findQueryMetricReferences(artifact.source)
      .filter((reference) => changedQueryIds.has(reference.queryArtifactId));
    changedReferences.forEach((reference) => {
      scalarConsumerKeys.add(`${artifact.id}\u0000${queryMetricReferenceKey(reference)}`);
    });
    if (!changedReferences.length) continue;
    const compiled = compileArtifactSource(artifact.source, prepared.nextArtifacts, snapshots);
    if (compiled.queryMetricRuntimeErrors.length) {
      throw new Error(`${artifact.name}: ${compiled.queryMetricRuntimeErrors[0]}`);
    }
  }

  let chartConsumerCount = 0;
  for (const chartArtifact of prepared.nextArtifacts.filter((artifact) => artifact.kind === "chart")) {
    const spec = parseChartSource(chartArtifact.source).spec;
    if (!spec || !changedQueryIds.has(spec.source)) continue;
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
    queryCount: changedQueries.length,
    scalarConsumerCount: scalarConsumerKeys.size,
    chartConsumerCount,
    queryNames: changedQueries.map((artifact) => artifact.name),
  };
}
