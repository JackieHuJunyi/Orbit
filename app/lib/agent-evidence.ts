import { z } from "zod";
import { MAX_WORKSPACE_AGENT_ARTIFACTS } from "./dependency-graph.ts";
import { resolveQueryDataArtifact } from "./query-source.ts";
import { workspaceQuerySnapshotIsCurrent, type QueryCell, type WorkspaceQuerySnapshot } from "./query-snapshot.ts";
import type { WorkspaceArtifact } from "./workspace.ts";

export const MAX_AGENT_QUERY_EVIDENCE_ROWS = 20;
export const MAX_AGENT_QUERY_EVIDENCE_COLUMNS = 32;
export const MAX_AGENT_QUERY_EVIDENCE_CELLS = 400;
export const MAX_AGENT_QUERY_EVIDENCE_CELL_CHARS = 500;
export const MAX_AGENT_QUERY_EVIDENCE_ERROR_CHARS = 500;
export const MAX_AGENT_QUERY_EVIDENCE_JSON_CHARS = 20_000;

const EvidenceCellSchema = z.union([
  z.string().max(MAX_AGENT_QUERY_EVIDENCE_CELL_CHARS),
  z.number().finite(),
  z.boolean(),
  z.null(),
]);

const AgentQueryEvidenceBaseSchema = z
  .object({
    queryArtifactId: z.string().min(1).max(120),
    dataArtifactId: z.string().min(1).max(120),
  })
  .strict();

export const AgentQueryReadyEvidenceSchema = AgentQueryEvidenceBaseSchema.extend({
  status: z.literal("ready"),
  columns: z.array(z.string().max(200)).max(MAX_AGENT_QUERY_EVIDENCE_COLUMNS),
  rows: z.array(z.array(EvidenceCellSchema).max(MAX_AGENT_QUERY_EVIDENCE_COLUMNS)).max(MAX_AGENT_QUERY_EVIDENCE_ROWS),
  visibleResultRowCount: z.number().int().min(0).max(500),
  totalColumnCount: z.number().int().min(0).max(10_000),
  resultTruncated: z.boolean(),
  evidenceTruncated: z.boolean(),
})
  .strict()
  .superRefine((evidence, context) => {
    if (evidence.rows.some((row) => row.length !== evidence.columns.length)) {
      context.addIssue({ code: "custom", message: "Every Query evidence row must match its column count." });
    }
    if (evidence.rows.reduce((total, row) => total + row.length, 0) > MAX_AGENT_QUERY_EVIDENCE_CELLS) {
      context.addIssue({ code: "custom", message: "Query evidence exceeds the cell limit." });
    }
    if (evidence.visibleResultRowCount < evidence.rows.length || evidence.totalColumnCount < evidence.columns.length) {
      context.addIssue({
        code: "custom",
        message: "Query evidence result counts cannot be smaller than the supplied sample.",
      });
    }
  });

export const AgentQueryErrorEvidenceSchema = AgentQueryEvidenceBaseSchema.extend({
  status: z.literal("error"),
  error: z.string().min(1).max(MAX_AGENT_QUERY_EVIDENCE_ERROR_CHARS),
}).strict();

export const AgentQueryEvidenceSchema = z.discriminatedUnion("status", [
  AgentQueryReadyEvidenceSchema,
  AgentQueryErrorEvidenceSchema,
]);

export const AgentQueryEvidenceListSchema = z
  .array(AgentQueryEvidenceSchema)
  .max(MAX_WORKSPACE_AGENT_ARTIFACTS)
  .superRefine((evidence, context) => {
    if (JSON.stringify(evidence).length > MAX_AGENT_QUERY_EVIDENCE_JSON_CHARS) {
      context.addIssue({ code: "custom", message: "Query evidence exceeds the total JSON limit." });
    }
  });

export type AgentQueryEvidence = z.infer<typeof AgentQueryEvidenceSchema>;

export type AgentQueryEvidenceRunner = (
  queryArtifact: WorkspaceArtifact,
  dataArtifact: WorkspaceArtifact,
) => Promise<WorkspaceQuerySnapshot>;

function truncate(value: string, maxChars: number) {
  return value.length <= maxChars ? value : value.slice(0, maxChars);
}

function boundedCell(value: QueryCell): QueryCell {
  if (typeof value === "string") return truncate(value, MAX_AGENT_QUERY_EVIDENCE_CELL_CHARS);
  if (typeof value === "number" && !Number.isFinite(value)) return String(value);
  return value;
}

export function createAgentQueryReadyEvidence(snapshot: WorkspaceQuerySnapshot): AgentQueryEvidence {
  const columns = snapshot.result.columns
    .slice(0, MAX_AGENT_QUERY_EVIDENCE_COLUMNS)
    .map((column) => truncate(column, 200));
  const maximumRowsByCellBudget = columns.length
    ? Math.floor(MAX_AGENT_QUERY_EVIDENCE_CELLS / columns.length)
    : MAX_AGENT_QUERY_EVIDENCE_ROWS;
  const rows = snapshot.result.rows
    .slice(0, Math.min(MAX_AGENT_QUERY_EVIDENCE_ROWS, maximumRowsByCellBudget))
    .map((row) => columns.map((_column, index) => boundedCell(row[index] ?? null)));
  let evidenceTruncated =
    snapshot.result.columns.length > columns.length ||
    snapshot.result.rows.length > rows.length ||
    snapshot.result.rows.some(
      (row, rowIndex) =>
        rowIndex < rows.length &&
        row.some((cell) => typeof cell === "string" && cell.length > MAX_AGENT_QUERY_EVIDENCE_CELL_CHARS),
    );
  const evidence: AgentQueryEvidence = {
    queryArtifactId: snapshot.queryArtifactId,
    dataArtifactId: snapshot.dataArtifactId,
    status: "ready",
    columns,
    rows,
    visibleResultRowCount: snapshot.result.rows.length,
    totalColumnCount: snapshot.result.columns.length,
    resultTruncated: snapshot.result.truncated,
    evidenceTruncated,
  };

  while (
    JSON.stringify(evidence).length > MAX_AGENT_QUERY_EVIDENCE_JSON_CHARS &&
    evidence.status === "ready" &&
    evidence.rows.length
  ) {
    evidence.rows.pop();
    evidence.evidenceTruncated = true;
    evidenceTruncated = true;
  }
  if (JSON.stringify(evidence).length > MAX_AGENT_QUERY_EVIDENCE_JSON_CHARS) {
    throw new Error("Query evidence metadata exceeds Rune's model context limit.");
  }
  if (evidence.status === "ready") evidence.evidenceTruncated = evidenceTruncated;
  return AgentQueryEvidenceSchema.parse(evidence);
}

export function createAgentQueryErrorEvidence(
  queryArtifactId: string,
  dataArtifactId: string,
  error: unknown,
): AgentQueryEvidence {
  const message = error instanceof Error ? error.message : String(error);
  return AgentQueryEvidenceSchema.parse({
    queryArtifactId,
    dataArtifactId,
    status: "error",
    error: truncate(message.trim() || "The Query could not run.", MAX_AGENT_QUERY_EVIDENCE_ERROR_CHARS),
  });
}

export async function collectWorkspaceAgentQueryEvidence(
  artifacts: WorkspaceArtifact[],
  runSnapshot: AgentQueryEvidenceRunner,
): Promise<AgentQueryEvidence[]> {
  const evidence: AgentQueryEvidence[] = [];
  for (const queryArtifact of artifacts.filter((artifact) => artifact.kind === "query")) {
    const resolution = resolveQueryDataArtifact(queryArtifact, artifacts);
    if (!resolution.artifact) {
      throw new Error(`${queryArtifact.name}: ${resolution.errors[0] ?? "Query Data source is unresolved."}`);
    }
    try {
      const snapshot = await runSnapshot(queryArtifact, resolution.artifact);
      if (!workspaceQuerySnapshotIsCurrent(snapshot, queryArtifact, resolution.artifact)) {
        throw new Error("The Query result became stale before Agent evidence was prepared.");
      }
      evidence.push(createAgentQueryReadyEvidence(snapshot));
    } catch (error) {
      evidence.push(createAgentQueryErrorEvidence(queryArtifact.id, resolution.artifact.id, error));
    }
  }
  while (JSON.stringify(evidence).length > MAX_AGENT_QUERY_EVIDENCE_JSON_CHARS) {
    const ready = evidence
      .filter((item): item is z.infer<typeof AgentQueryReadyEvidenceSchema> => item.status === "ready")
      .sort((left, right) => JSON.stringify(right).length - JSON.stringify(left).length)[0];
    if (!ready) break;
    if (ready.rows.length) {
      ready.rows.pop();
      ready.evidenceTruncated = true;
      continue;
    }
    if (ready.columns.length) {
      ready.columns.pop();
      ready.rows.forEach((row) => row.pop());
      ready.evidenceTruncated = true;
      continue;
    }
    break;
  }
  return AgentQueryEvidenceListSchema.parse(evidence);
}

export function validateAgentQueryEvidenceContext(
  artifacts: WorkspaceArtifact[],
  evidence: AgentQueryEvidence[],
): string[] {
  const errors: string[] = [];
  const parsed = AgentQueryEvidenceListSchema.safeParse(evidence);
  if (!parsed.success) return ["Query evidence does not match Rune's bounded evidence contract."];
  const queries = artifacts.filter((artifact) => artifact.kind === "query");
  if (queries.length !== evidence.length) {
    errors.push("Query evidence must contain exactly one result for every Query in workspace order.");
  }
  queries.forEach((query, index) => {
    const item = evidence[index];
    if (!item || item.queryArtifactId !== query.id) {
      errors.push(`Query evidence is missing or out of order for ${query.id}.`);
      return;
    }
    const resolution = resolveQueryDataArtifact(query, artifacts);
    if (!resolution.artifact || item.dataArtifactId !== resolution.artifact.id) {
      errors.push(`Query evidence uses the wrong Data revision identity for ${query.id}.`);
    }
  });
  if (new Set(evidence.map((item) => item.queryArtifactId)).size !== evidence.length) {
    errors.push("Query evidence artifact ids must be unique.");
  }
  return [...new Set(errors)];
}
