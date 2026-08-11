import {
  buildWorkspaceDependencyGraph,
  type WorkspaceDependencyEdge,
  type WorkspaceDependencyIssue,
  type WorkspaceDependencyKind,
} from "./dependency-graph.ts";
import {
  prepareWorkspaceMutation,
  type ArtifactCreationChange,
  type ArtifactSourcePatch,
} from "./patches.ts";
import type { ArtifactKind, WorkspaceArtifact } from "./workspace.ts";

export type WorkspaceTransactionNodeStatus = "created" | "edited" | "validated" | "input";
export type WorkspaceTransactionEdgeStatus = "added" | "removed" | "updated" | "retained";

export type WorkspaceTransactionNode = {
  artifactId: string;
  name: string;
  kind: ArtifactKind;
  status: WorkspaceTransactionNodeStatus;
};

export type WorkspaceTransactionEdge = {
  fromArtifactId: string;
  toArtifactId: string;
  kind: WorkspaceDependencyKind;
  status: WorkspaceTransactionEdgeStatus;
  label: string;
  previousLabel?: string;
  references: string[];
};

export type WorkspaceTransactionReview = {
  nodes: WorkspaceTransactionNode[];
  edges: WorkspaceTransactionEdge[];
  issues: WorkspaceDependencyIssue[];
  errors: string[];
  changeCount: number;
  createdCount: number;
  editedCount: number;
  validatedCount: number;
  inputCount: number;
  addedEdgeCount: number;
  removedEdgeCount: number;
  updatedEdgeCount: number;
};

function edgeKey(edge: WorkspaceDependencyEdge) {
  return `${edge.fromArtifactId}\u0000${edge.toArtifactId}\u0000${edge.kind}`;
}

function edgeContentKey(edge: WorkspaceDependencyEdge) {
  return JSON.stringify([edge.label, edge.references]);
}

function traverseDependencies(
  startArtifactIds: Set<string>,
  edges: WorkspaceDependencyEdge[],
  direction: "upstream" | "downstream",
) {
  const reached = new Set(startArtifactIds);
  const queue = [...startArtifactIds];
  while (queue.length) {
    const artifactId = queue.shift();
    if (!artifactId) continue;
    edges.forEach((edge) => {
      const matches = direction === "upstream"
        ? edge.toArtifactId === artifactId
        : edge.fromArtifactId === artifactId;
      if (!matches) return;
      const nextArtifactId = direction === "upstream"
        ? edge.fromArtifactId
        : edge.toArtifactId;
      if (reached.has(nextArtifactId)) return;
      reached.add(nextArtifactId);
      queue.push(nextArtifactId);
    });
  }
  return reached;
}

function emptyReview(errors: string[], changeCount: number): WorkspaceTransactionReview {
  return {
    nodes: [],
    edges: [],
    issues: [],
    errors,
    changeCount,
    createdCount: 0,
    editedCount: 0,
    validatedCount: 0,
    inputCount: 0,
    addedEdgeCount: 0,
    removedEdgeCount: 0,
    updatedEdgeCount: 0,
  };
}

export function buildWorkspaceTransactionReview(
  artifacts: WorkspaceArtifact[],
  patches: ArtifactSourcePatch[],
  creations: ArtifactCreationChange[],
): WorkspaceTransactionReview {
  const changeCount = patches.length + creations.length;
  const prepared = prepareWorkspaceMutation(artifacts, patches, creations);
  if (prepared.errors.length) return emptyReview(prepared.errors, changeCount);

  const currentGraph = buildWorkspaceDependencyGraph(artifacts);
  const proposedGraph = buildWorkspaceDependencyGraph(prepared.nextArtifacts);
  const currentEdges = new Map(currentGraph.edges.map((edge) => [edgeKey(edge), edge] as const));
  const proposedEdges = new Map(proposedGraph.edges.map((edge) => [edgeKey(edge), edge] as const));
  const unionEdges = [...new Map(
    [...currentGraph.edges, ...proposedGraph.edges].map((edge) => [edgeKey(edge), edge] as const),
  ).values()];
  const createdArtifactIds = new Set(creations.map((creation) => creation.artifact.id));
  const editedArtifactIds = new Set(patches.map((patch) => patch.artifactId));
  const changedArtifactIds = new Set([...createdArtifactIds, ...editedArtifactIds]);
  const upstreamArtifactIds = traverseDependencies(changedArtifactIds, unionEdges, "upstream");
  const downstreamArtifactIds = traverseDependencies(changedArtifactIds, unionEdges, "downstream");
  const relevantArtifactIds = new Set([
    ...changedArtifactIds,
    ...upstreamArtifactIds,
    ...downstreamArtifactIds,
  ]);
  const proposedArtifactById = new Map(
    prepared.nextArtifacts.map((artifact) => [artifact.id, artifact] as const),
  );
  const orderedArtifacts = [
    ...prepared.nextArtifacts,
    ...artifacts.filter((artifact) => !proposedArtifactById.has(artifact.id)),
  ];

  const nodes = orderedArtifacts.flatMap((artifact): WorkspaceTransactionNode[] => {
    if (!relevantArtifactIds.has(artifact.id)) return [];
    const status: WorkspaceTransactionNodeStatus = createdArtifactIds.has(artifact.id)
      ? "created"
      : editedArtifactIds.has(artifact.id)
        ? "edited"
        : downstreamArtifactIds.has(artifact.id)
          ? "validated"
          : "input";
    return [{ artifactId: artifact.id, name: artifact.name, kind: artifact.kind, status }];
  });
  const nodeOrder = new Map(nodes.map((node, index) => [node.artifactId, index] as const));
  const edges = [...new Set([...proposedEdges.keys(), ...currentEdges.keys()])].flatMap((key) => {
    const current = currentEdges.get(key);
    const proposed = proposedEdges.get(key);
    const edge = proposed ?? current;
    if (!edge
      || !relevantArtifactIds.has(edge.fromArtifactId)
      || !relevantArtifactIds.has(edge.toArtifactId)) return [];
    const status: WorkspaceTransactionEdgeStatus = !current
      ? "added"
      : !proposed
        ? "removed"
        : edgeContentKey(current) === edgeContentKey(proposed)
          ? "retained"
          : "updated";
    return [{
      fromArtifactId: edge.fromArtifactId,
      toArtifactId: edge.toArtifactId,
      kind: edge.kind,
      status,
      label: (proposed ?? current)?.label ?? "dependency",
      previousLabel: status === "updated" ? current?.label : undefined,
      references: [...((proposed ?? current)?.references ?? [])],
    } satisfies WorkspaceTransactionEdge];
  }).sort((left, right) => (
    (nodeOrder.get(left.fromArtifactId) ?? Number.MAX_SAFE_INTEGER)
      - (nodeOrder.get(right.fromArtifactId) ?? Number.MAX_SAFE_INTEGER)
    || (nodeOrder.get(left.toArtifactId) ?? Number.MAX_SAFE_INTEGER)
      - (nodeOrder.get(right.toArtifactId) ?? Number.MAX_SAFE_INTEGER)
    || left.kind.localeCompare(right.kind)
  ));
  const relevantIssues = proposedGraph.issues.filter((issue) => relevantArtifactIds.has(issue.artifactId));

  return {
    nodes,
    edges,
    issues: relevantIssues,
    errors: [],
    changeCount,
    createdCount: nodes.filter((node) => node.status === "created").length,
    editedCount: nodes.filter((node) => node.status === "edited").length,
    validatedCount: nodes.filter((node) => node.status === "validated").length,
    inputCount: nodes.filter((node) => node.status === "input").length,
    addedEdgeCount: edges.filter((edge) => edge.status === "added").length,
    removedEdgeCount: edges.filter((edge) => edge.status === "removed").length,
    updatedEdgeCount: edges.filter((edge) => edge.status === "updated").length,
  };
}
