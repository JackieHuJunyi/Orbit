import { deriveWorkspaceMetrics, findMetricReferences } from "./bindings.ts";
import { findChartReferences, parseChartSource } from "./charts.ts";
import type { WorkspaceArtifact } from "./workspace.ts";

export const WORKSPACE_DEPENDENCY_KINDS = [
  "metric",
  "query",
  "chart-data",
  "chart-embed",
] as const;

export const MAX_WORKSPACE_AGENT_ARTIFACTS = 6;
export const MAX_WORKSPACE_AGENT_ARTIFACT_CHARS = 100_000;
export const MAX_WORKSPACE_AGENT_CONTEXT_CHARS = 180_000;
export const MAX_WORKSPACE_DEPENDENCY_REFERENCES = 16;

export type WorkspaceDependencyKind = typeof WORKSPACE_DEPENDENCY_KINDS[number];

export type WorkspaceDependencyEdge = {
  fromArtifactId: string;
  toArtifactId: string;
  kind: WorkspaceDependencyKind;
  label: string;
  references: string[];
};

export type WorkspaceDependencyIssue = {
  artifactId: string;
  kind: WorkspaceDependencyKind;
  target: string;
  message: string;
};

export type WorkspaceDependencyGraph = {
  edges: WorkspaceDependencyEdge[];
  issues: WorkspaceDependencyIssue[];
};

function plural(count: number, singular: string) {
  return `${count} ${singular}${count === 1 ? "" : "s"}`;
}

export function buildWorkspaceDependencyGraph(
  artifacts: WorkspaceArtifact[],
): WorkspaceDependencyGraph {
  const edges: WorkspaceDependencyEdge[] = [];
  const issues: WorkspaceDependencyIssue[] = [];
  const edgeKeys = new Set<string>();
  const artifactById = new Map(artifacts.map((artifact) => [artifact.id, artifact] as const));
  const artifactOrder = new Map(artifacts.map((artifact, index) => [artifact.id, index] as const));
  const canonicalData = artifacts.find((artifact) => artifact.kind === "data");
  const metrics = deriveWorkspaceMetrics(artifacts);

  const addEdge = (edge: WorkspaceDependencyEdge) => {
    const key = `${edge.fromArtifactId}\u0000${edge.toArtifactId}\u0000${edge.kind}`;
    if (edgeKeys.has(key)) return;
    edgeKeys.add(key);
    edges.push(edge);
  };

  artifacts.forEach((artifact) => {
    const metricReferences = findMetricReferences(artifact.source);
    if (metricReferences.length) {
      if (canonicalData) {
        addEdge({
          fromArtifactId: canonicalData.id,
          toArtifactId: artifact.id,
          kind: "metric",
          label: plural(metricReferences.length, "metric"),
          references: metricReferences.slice(0, MAX_WORKSPACE_DEPENDENCY_REFERENCES),
        });
      }
      metricReferences.filter((reference) => !metrics[reference]).forEach((reference) => {
        issues.push({
          artifactId: artifact.id,
          kind: "metric",
          target: reference,
          message: canonicalData
            ? `Metric is unresolved: ${reference}`
            : `Metric has no canonical data source: ${reference}`,
        });
      });
    }

    if (artifact.kind === "query") {
      if (canonicalData) {
        addEdge({
          fromArtifactId: canonicalData.id,
          toArtifactId: artifact.id,
          kind: "query",
          label: "workspace_data",
          references: [canonicalData.id],
        });
      } else {
        issues.push({
          artifactId: artifact.id,
          kind: "query",
          target: "workspace_data",
          message: "Query has no canonical data source.",
        });
      }
    }

    if (artifact.kind === "chart") {
      const parsed = parseChartSource(artifact.source);
      if (parsed.spec) {
        const source = artifactById.get(parsed.spec.source);
        if (source?.kind === "data") {
          addEdge({
            fromArtifactId: source.id,
            toArtifactId: artifact.id,
            kind: "chart-data",
            label: `${parsed.spec.category} → ${parsed.spec.value}`,
            references: [parsed.spec.category, parsed.spec.value],
          });
        } else {
          issues.push({
            artifactId: artifact.id,
            kind: "chart-data",
            target: parsed.spec.source,
            message: `Chart data source is unresolved: ${parsed.spec.source}`,
          });
        }
      } else {
        issues.push({
          artifactId: artifact.id,
          kind: "chart-data",
          target: artifact.id,
          message: parsed.errors[0] ?? "Chart source is invalid.",
        });
      }
    }

    findChartReferences(artifact.source).forEach((reference) => {
      const chart = artifactById.get(reference);
      if (chart?.kind === "chart") {
        addEdge({
          fromArtifactId: chart.id,
          toArtifactId: artifact.id,
          kind: "chart-embed",
          label: "chart embed",
          references: [reference],
        });
      } else {
        issues.push({
          artifactId: artifact.id,
          kind: "chart-embed",
          target: reference,
          message: `Chart reference is unresolved: ${reference}`,
        });
      }
    });
  });

  edges.sort((left, right) => (
    (artifactOrder.get(left.fromArtifactId) ?? Number.MAX_SAFE_INTEGER)
      - (artifactOrder.get(right.fromArtifactId) ?? Number.MAX_SAFE_INTEGER)
    || (artifactOrder.get(left.toArtifactId) ?? Number.MAX_SAFE_INTEGER)
      - (artifactOrder.get(right.toArtifactId) ?? Number.MAX_SAFE_INTEGER)
    || left.kind.localeCompare(right.kind)
  ));
  issues.sort((left, right) => (
    (artifactOrder.get(left.artifactId) ?? Number.MAX_SAFE_INTEGER)
      - (artifactOrder.get(right.artifactId) ?? Number.MAX_SAFE_INTEGER)
    || left.kind.localeCompare(right.kind)
    || left.target.localeCompare(right.target)
  ));

  return { edges, issues };
}

function orderedGraphCandidates(
  artifacts: WorkspaceArtifact[],
  graph: WorkspaceDependencyGraph,
  selectedArtifactId: string,
) {
  const artifactById = new Map(artifacts.map((artifact) => [artifact.id, artifact] as const));
  const order = new Map(artifacts.map((artifact, index) => [artifact.id, index] as const));
  const neighbors = new Map<string, Set<string>>();
  graph.edges.forEach((edge) => {
    if (edge.fromArtifactId === edge.toArtifactId) return;
    const from = neighbors.get(edge.fromArtifactId) ?? new Set<string>();
    const to = neighbors.get(edge.toArtifactId) ?? new Set<string>();
    from.add(edge.toArtifactId);
    to.add(edge.fromArtifactId);
    neighbors.set(edge.fromArtifactId, from);
    neighbors.set(edge.toArtifactId, to);
  });

  const selected = artifactById.get(selectedArtifactId) ?? artifacts[0];
  if (!selected) return [];
  const queued = new Set([selected.id]);
  const queue = [selected.id];
  const ids: string[] = [];
  while (queue.length) {
    const id = queue.shift();
    if (!id) continue;
    ids.push(id);
    const next = [...(neighbors.get(id) ?? [])]
      .sort((left, right) => (order.get(left) ?? 0) - (order.get(right) ?? 0));
    next.forEach((neighbor) => {
      if (queued.has(neighbor)) return;
      queued.add(neighbor);
      queue.push(neighbor);
    });
  }
  return ids.flatMap((id) => {
    const artifact = artifactById.get(id);
    return artifact ? [artifact] : [];
  });
}

export function selectWorkspaceAgentContext(
  artifacts: WorkspaceArtifact[],
  graph: WorkspaceDependencyGraph,
  selectedArtifactId: string,
  limit = MAX_WORKSPACE_AGENT_ARTIFACTS,
) {
  const candidates = orderedGraphCandidates(artifacts, graph, selectedArtifactId);
  if (!candidates.length) return [];
  const requestedLimit = Number.isFinite(limit) ? Math.floor(limit) : MAX_WORKSPACE_AGENT_ARTIFACTS;
  const safeLimit = Math.min(MAX_WORKSPACE_AGENT_ARTIFACTS, Math.max(1, requestedLimit));
  const artifactById = new Map(artifacts.map((artifact) => [artifact.id, artifact] as const));
  const incoming = new Map<string, Set<string>>();
  graph.edges.forEach((edge) => {
    if (edge.fromArtifactId === edge.toArtifactId) return;
    const sources = incoming.get(edge.toArtifactId) ?? new Set<string>();
    sources.add(edge.fromArtifactId);
    incoming.set(edge.toArtifactId, sources);
  });
  const closureFor = (artifactId: string) => {
    const closure = new Set<string>();
    const queue = [artifactId];
    while (queue.length) {
      const id = queue.shift();
      if (!id || closure.has(id)) continue;
      closure.add(id);
      (incoming.get(id) ?? []).forEach((sourceId) => queue.push(sourceId));
    }
    return closure;
  };
  const selected = candidates[0];
  const selectedClosure = closureFor(selected.id);
  const selectedClosureArtifacts = artifacts.filter((artifact) => selectedClosure.has(artifact.id));
  const selectedClosureFits = selectedClosureArtifacts.length <= safeLimit
    && selectedClosureArtifacts.every((artifact) => (
      artifact.id === selected.id || artifact.source.length <= MAX_WORKSPACE_AGENT_ARTIFACT_CHARS
    ))
    && selectedClosureArtifacts.reduce((total, artifact) => total + artifact.source.length, 0)
      <= MAX_WORKSPACE_AGENT_CONTEXT_CHARS;
  const selectedIds = selectedClosureFits ? selectedClosure : new Set([selected.id]);
  let characterCount = artifacts.reduce((total, artifact) => (
    selectedIds.has(artifact.id) ? total + artifact.source.length : total
  ), 0);
  for (const candidate of candidates) {
    if (selectedIds.has(candidate.id) || selectedIds.size >= safeLimit) continue;
    const missingIds = [...closureFor(candidate.id)].filter((id) => !selectedIds.has(id));
    const missingArtifacts = missingIds.flatMap((id) => {
      const artifact = artifactById.get(id);
      return artifact ? [artifact] : [];
    });
    if (!missingArtifacts.length || selectedIds.size + missingArtifacts.length > safeLimit) continue;
    if (missingArtifacts.some((artifact) => artifact.source.length > MAX_WORKSPACE_AGENT_ARTIFACT_CHARS)) continue;
    const missingCharacters = missingArtifacts.reduce((total, artifact) => total + artifact.source.length, 0);
    if (characterCount + missingCharacters > MAX_WORKSPACE_AGENT_CONTEXT_CHARS) continue;
    missingArtifacts.forEach((artifact) => selectedIds.add(artifact.id));
    characterCount += missingCharacters;
  }
  return artifacts.filter((artifact) => selectedIds.has(artifact.id));
}

export function dependencyEdgesForContext(
  graph: WorkspaceDependencyGraph,
  artifacts: WorkspaceArtifact[],
) {
  const ids = new Set(artifacts.map((artifact) => artifact.id));
  return graph.edges.filter((edge) => ids.has(edge.fromArtifactId) && ids.has(edge.toArtifactId));
}

export function workspaceAgentContextIsClosed(
  graph: WorkspaceDependencyGraph,
  artifacts: WorkspaceArtifact[],
) {
  const ids = new Set(artifacts.map((artifact) => artifact.id));
  return graph.edges.every((edge) => (
    !ids.has(edge.toArtifactId)
    || edge.fromArtifactId === edge.toArtifactId
    || ids.has(edge.fromArtifactId)
  ));
}
