import type { QueryCellLineage } from "./sql.ts";
import type { WorkspaceArtifact } from "./workspace.ts";

export type QueryCell = string | number | boolean | null;

export type WorkspaceQueryResult = {
  columns: string[];
  rows: QueryCell[][];
  sourceRowIndices: Array<number | null>;
  cellLineage: Array<Array<QueryCellLineage | null>>;
  lineageMode: "direct" | "read-only";
  elapsedMs: number;
  truncated: boolean;
  engine: string;
};

export type WorkspaceQuerySnapshot = {
  queryArtifactId: string;
  queryArtifactName: string;
  querySource: string;
  dataArtifactId: string;
  dataArtifactName: string;
  dataSource: string;
  result: WorkspaceQueryResult;
};

export function createWorkspaceQuerySnapshot(
  queryArtifact: WorkspaceArtifact,
  dataArtifact: WorkspaceArtifact,
  result: WorkspaceQueryResult,
): WorkspaceQuerySnapshot {
  if (queryArtifact.kind !== "query") throw new Error("A query snapshot requires a Query artifact.");
  if (dataArtifact.kind !== "data") throw new Error("A query snapshot requires a canonical Data artifact.");
  return {
    queryArtifactId: queryArtifact.id,
    queryArtifactName: queryArtifact.name,
    querySource: queryArtifact.source,
    dataArtifactId: dataArtifact.id,
    dataArtifactName: dataArtifact.name,
    dataSource: dataArtifact.source,
    result,
  };
}

export function workspaceQuerySnapshotIsCurrent(
  snapshot: WorkspaceQuerySnapshot,
  queryArtifact: { id: string; kind: string; source: string },
  dataArtifact: { id: string; kind: string; source: string },
) {
  return queryArtifact.kind === "query"
    && dataArtifact.kind === "data"
    && snapshot.queryArtifactId === queryArtifact.id
    && snapshot.querySource === queryArtifact.source
    && snapshot.dataArtifactId === dataArtifact.id
    && snapshot.dataSource === dataArtifact.source;
}
