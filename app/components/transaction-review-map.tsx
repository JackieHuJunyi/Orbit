"use client";

import {
  BarChart3,
  ChevronRight,
  Database,
  FileText,
  Link2,
  Presentation,
  TableProperties,
  Workflow,
} from "lucide-react";

import type { WorkspaceDependencyKind } from "../lib/dependency-graph";
import type {
  WorkspaceTransactionNode,
  WorkspaceTransactionReview,
} from "../lib/transaction-review";
import type { ArtifactKind } from "../lib/workspace";

function ArtifactIcon({ kind, size = 11 }: { kind: ArtifactKind; size?: number }) {
  if (kind === "document") return <FileText size={size} aria-hidden="true" />;
  if (kind === "data") return <TableProperties size={size} aria-hidden="true" />;
  if (kind === "query") return <Database size={size} aria-hidden="true" />;
  if (kind === "chart") return <BarChart3 size={size} aria-hidden="true" />;
  return <Presentation size={size} aria-hidden="true" />;
}

function DependencyKindIcon({ kind }: { kind: WorkspaceDependencyKind }) {
  if (kind === "query" || kind === "query-metric") return <Database aria-hidden="true" />;
  if (kind === "chart-data" || kind === "chart-query" || kind === "chart-embed") {
    return <BarChart3 aria-hidden="true" />;
  }
  return <Link2 aria-hidden="true" />;
}

const statusLabels = {
  created: "New",
  edited: "Edited",
  validated: "Validated",
  input: "Input",
} as const;

function TransactionNode({
  node,
  active,
  compact = false,
  onSelect,
}: {
  node: WorkspaceTransactionNode;
  active: boolean;
  compact?: boolean;
  onSelect: (artifactId: string) => void;
}) {
  const content = (
    <>
      <span className={`artifact-icon ${node.kind}`}>
        <ArtifactIcon kind={node.kind} size={compact ? 10 : 11} />
      </span>
      <span className="transaction-node-name">{node.name}</span>
      {!compact && (
        <em className={`transaction-node-status ${node.status}`}>{statusLabels[node.status]}</em>
      )}
    </>
  );
  const className = `transaction-node ${node.status} ${active ? "active" : ""} ${compact ? "compact" : ""}`.trim();
  if (node.status === "created" || node.status === "edited") {
    return (
      <button
        type="button"
        className={className}
        onClick={() => onSelect(node.artifactId)}
        aria-label={`Review ${node.name}, ${statusLabels[node.status].toLowerCase()}`}
        aria-current={active ? "true" : undefined}
      >
        {content}
      </button>
    );
  }
  return (
    <span className={className} aria-label={`${node.name}, ${statusLabels[node.status].toLowerCase()}`}>
      {content}
    </span>
  );
}

export function TransactionReviewMap({
  review,
  activeArtifactId,
  onSelect,
}: {
  review: WorkspaceTransactionReview;
  activeArtifactId: string;
  onSelect: (artifactId: string) => void;
}) {
  const nodeById = new Map(review.nodes.map((node) => [node.artifactId, node] as const));
  const bindingChanges = review.addedEdgeCount + review.removedEdgeCount + review.updatedEdgeCount;
  return (
    <details className="transaction-review-map" open={review.changeCount > 1 || review.edges.length > 0}>
      <summary>
        <Workflow aria-hidden="true" />
        <span>
          <strong>Transaction map</strong>
          <small>{review.changeCount} {review.changeCount === 1 ? "change" : "changes"} · {review.nodes.length} source {review.nodes.length === 1 ? "node" : "nodes"} · {bindingChanges} binding {bindingChanges === 1 ? "change" : "changes"}</small>
        </span>
        <span className="transaction-edge-count" aria-label={`${review.edges.length} dependency edges`}>{review.edges.length}</span>
      </summary>
      <div className="transaction-review-content">
        <div className="transaction-node-list" role="list" aria-label="Sources in proposed transaction">
          {review.nodes.map((node) => (
            <span role="listitem" key={node.artifactId}>
              <TransactionNode
                node={node}
                active={activeArtifactId === node.artifactId}
                onSelect={onSelect}
              />
            </span>
          ))}
        </div>
        <div className="transaction-edge-list" role="list" aria-label="Proposed source dependency changes">
          {review.edges.map((edge) => {
            const source = nodeById.get(edge.fromArtifactId);
            const consumer = nodeById.get(edge.toArtifactId);
            if (!source || !consumer) return null;
            const relation = edge.status === "updated" && edge.previousLabel
              ? `${edge.previousLabel} → ${edge.label}`
              : edge.label;
            return (
              <div
                className={`transaction-edge ${edge.status}`}
                role="listitem"
                key={`${edge.fromArtifactId}-${edge.toArtifactId}-${edge.kind}`}
              >
                <TransactionNode node={source} compact active={activeArtifactId === source.artifactId} onSelect={onSelect} />
                <span className={`transaction-edge-relation ${edge.kind}`} title={edge.references.join(", ")}>
                  <DependencyKindIcon kind={edge.kind} />
                  <span>{edge.status === "added" ? "+" : edge.status === "removed" ? "−" : edge.status === "updated" ? "~" : ""} {relation}</span>
                  <ChevronRight aria-hidden="true" />
                </span>
                <TransactionNode node={consumer} compact active={activeArtifactId === consumer.artifactId} onSelect={onSelect} />
              </div>
            );
          })}
          {!review.edges.length && <p>No cross-file bindings change in this transaction.</p>}
        </div>
        <p className="transaction-review-note">
          New and edited nodes are reviewable diffs. Input and validated nodes remain unchanged; Rune compiled them to prove the complete proposed workspace.
        </p>
      </div>
    </details>
  );
}
