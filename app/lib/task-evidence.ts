import type { ArtifactExportKind } from "./export-contract.ts";
import type { RuneTaskId } from "./task-runtime.ts";
import { PORTABLE_SOURCE_REVISION_PATTERN, portableSourceRevision } from "./source-revision.ts";

export const MAX_RUNE_TASK_RUNS = 24;
export const MAX_RUNE_TASK_DELIVERIES = 24;
export const MAX_RUNE_TASK_DURATION_MS = 30 * 60 * 1_000;
export const MAX_RUNE_TASK_DELIVERY_MS = 365 * 24 * 60 * 60 * 1_000;

export type RuneTaskRunStatus = "applied" | "stopped";
export type RuneTaskStopReason = "validation" | "runtime" | "stale" | "persistence" | "cancelled";
export type RuneTaskDeliveryRating = "ready" | "minor-edits" | "not-ready";
export type RuneTaskDeliveryMethod = "download" | "folder";
export type RuneTaskDeliveryTarget = ArtifactExportKind | "md" | "deck-md" | "folder";

export type RuneTaskRun = {
  version: 1;
  id: string;
  taskId: RuneTaskId;
  completedAt: string;
  status: RuneTaskRunStatus;
  stopReason: RuneTaskStopReason | null;
  provider: string;
  sourceArtifactId: string;
  sourceRevision: string;
  outputArtifactIds: string[];
  outputRevisions: Record<string, string>;
  changedFileCount: number;
  queryCount: number;
  chartConsumerCount: number;
  durationMs: number;
  inputTokens: number | null;
  outputTokens: number | null;
};

export type RuneTaskDeliveryOutcome = {
  version: 1;
  id: string;
  confirmedAt: string;
  runId: string;
  taskId: RuneTaskId;
  artifactId: string;
  method: RuneTaskDeliveryMethod;
  target: RuneTaskDeliveryTarget;
  rating: RuneTaskDeliveryRating;
  sourceSha256: string;
  taskDurationMs: number;
};

export type RuneTaskEvidence = {
  version: 1;
  runs: RuneTaskRun[];
  deliveries: RuneTaskDeliveryOutcome[];
};

export const EMPTY_RUNE_TASK_EVIDENCE: RuneTaskEvidence = {
  version: 1,
  runs: [],
  deliveries: [],
};

const TASK_IDS = new Set<RuneTaskId>(["operating-review", "document-briefing"]);
const STOP_REASONS = new Set<RuneTaskStopReason>(["validation", "runtime", "stale", "persistence", "cancelled"]);
const DELIVERY_RATINGS = new Set<RuneTaskDeliveryRating>(["ready", "minor-edits", "not-ready"]);
const DOWNLOAD_TARGETS = new Set<RuneTaskDeliveryTarget>([
  "csv", "json", "doc", "ppt", "docx", "xlsx", "pptx", "odt", "ods", "odp", "html", "pdf", "md", "deck-md",
]);
const SHA256 = /^[0-9a-f]{64}$/u;

function boundedText(value: unknown, maximum: number) {
  if (typeof value !== "string") return undefined;
  const normalized = value.normalize("NFKC").trim();
  return normalized.length > 0 && normalized.length <= maximum && !/[\u0000-\u001f\u007f]/u.test(normalized)
    ? normalized
    : undefined;
}

function boundedInteger(value: unknown, maximum: number) {
  return Number.isInteger(value) && Number(value) >= 0 && Number(value) <= maximum ? Number(value) : undefined;
}

function normalizedArtifactIds(value: unknown) {
  if (!Array.isArray(value) || !value.length || value.length > 4) return undefined;
  const ids = value.map((item) => boundedText(item, 120));
  if (ids.some((id) => !id)) return undefined;
  const unique = [...new Set(ids as string[])];
  return unique.length === ids.length ? unique : undefined;
}

function normalizedOutputRevisions(value: unknown, outputArtifactIds: string[]) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const entries = Object.entries(value as Record<string, unknown>);
  if (entries.length !== outputArtifactIds.length) return undefined;
  const revisions: Record<string, string> = {};
  for (const artifactId of outputArtifactIds) {
    const revision = (value as Record<string, unknown>)[artifactId];
    if (typeof revision !== "string" || !PORTABLE_SOURCE_REVISION_PATTERN.test(revision)) return undefined;
    revisions[artifactId] = revision;
  }
  return entries.every(([artifactId]) => outputArtifactIds.includes(artifactId)) ? revisions : undefined;
}

export function normalizeRuneTaskRuns(value: unknown): RuneTaskRun[] {
  if (!Array.isArray(value)) return [];
  const runs: RuneTaskRun[] = [];
  const ids = new Set<string>();
  for (const entry of value.slice(0, MAX_RUNE_TASK_RUNS * 2)) {
    if (!entry || typeof entry !== "object") continue;
    const candidate = entry as Partial<RuneTaskRun>;
    const id = boundedText(candidate.id, 220);
    const taskId = TASK_IDS.has(candidate.taskId as RuneTaskId) ? candidate.taskId as RuneTaskId : undefined;
    const completedAt = boundedText(candidate.completedAt, 40);
    const status = candidate.status === "applied" || candidate.status === "stopped" ? candidate.status : undefined;
    const stopReason = candidate.stopReason === null
      ? null
      : STOP_REASONS.has(candidate.stopReason as RuneTaskStopReason)
        ? candidate.stopReason as RuneTaskStopReason
        : undefined;
    const provider = boundedText(candidate.provider, 40);
    const sourceArtifactId = boundedText(candidate.sourceArtifactId, 120);
    const sourceRevision = typeof candidate.sourceRevision === "string" && PORTABLE_SOURCE_REVISION_PATTERN.test(candidate.sourceRevision)
      ? candidate.sourceRevision
      : undefined;
    const outputArtifactIds = normalizedArtifactIds(candidate.outputArtifactIds);
    const outputRevisions = outputArtifactIds ? normalizedOutputRevisions(candidate.outputRevisions, outputArtifactIds) : undefined;
    const changedFileCount = boundedInteger(candidate.changedFileCount, 7);
    const queryCount = boundedInteger(candidate.queryCount, 50);
    const chartConsumerCount = boundedInteger(candidate.chartConsumerCount, 50);
    const durationMs = boundedInteger(candidate.durationMs, MAX_RUNE_TASK_DURATION_MS);
    const inputTokens = candidate.inputTokens === null ? null : boundedInteger(candidate.inputTokens, 10_000_000);
    const outputTokens = candidate.outputTokens === null ? null : boundedInteger(candidate.outputTokens, 10_000_000);
    if (candidate.version !== 1 || !id || ids.has(id) || !taskId || !completedAt || Number.isNaN(Date.parse(completedAt))
      || !status || stopReason === undefined || (status === "applied" ? stopReason !== null : stopReason === null)
      || !provider || !sourceArtifactId || !sourceRevision || !outputArtifactIds || !outputRevisions || outputArtifactIds.includes(sourceArtifactId)
      || changedFileCount == null || queryCount == null || chartConsumerCount == null || durationMs == null
      || inputTokens === undefined || outputTokens === undefined) continue;
    ids.add(id);
    runs.push({
      version: 1,
      id,
      taskId,
      completedAt: new Date(completedAt).toISOString(),
      status,
      stopReason,
      provider,
      sourceArtifactId,
      sourceRevision,
      outputArtifactIds,
      outputRevisions,
      changedFileCount,
      queryCount,
      chartConsumerCount,
      durationMs,
      inputTokens,
      outputTokens,
    });
    if (runs.length >= MAX_RUNE_TASK_RUNS) break;
  }
  return runs.sort((left, right) => right.completedAt.localeCompare(left.completedAt));
}

export function appendRuneTaskRun(evidence: RuneTaskEvidence, run: RuneTaskRun): RuneTaskEvidence {
  const runs = normalizeRuneTaskRuns([run, ...evidence.runs]);
  return normalizeRuneTaskEvidence({ ...evidence, runs });
}

export function summarizeRuneTaskRuns(runs: RuneTaskRun[]) {
  const applied = runs.filter((run) => run.status === "applied");
  const modelRuns = runs.filter((run) => run.inputTokens != null && run.outputTokens != null);
  return {
    total: runs.length,
    applied: applied.length,
    stopped: runs.length - applied.length,
    successRate: runs.length ? Math.round((applied.length / runs.length) * 100) : null,
    averageDurationMs: runs.length
      ? Math.round(runs.reduce((total, run) => total + run.durationMs, 0) / runs.length)
      : null,
    modelRunCount: modelRuns.length,
    inputTokens: modelRuns.length ? modelRuns.reduce((total, run) => total + (run.inputTokens ?? 0), 0) : null,
    outputTokens: modelRuns.length ? modelRuns.reduce((total, run) => total + (run.outputTokens ?? 0), 0) : null,
  };
}

export function runeTaskDeliveryId(runId: string, artifactId: string) {
  return `delivery:${runId}:${artifactId}`;
}

export async function runeTaskSourceSha256(source: string) {
  if (!globalThis.crypto?.subtle) throw new Error("This browser cannot create a local delivery revision proof.");
  const bytes = new TextEncoder().encode(source);
  const digest = await globalThis.crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((value) => value.toString(16).padStart(2, "0")).join("");
}

function normalizeRuneTaskDeliveries(value: unknown, runs: RuneTaskRun[]): RuneTaskDeliveryOutcome[] {
  if (!Array.isArray(value)) return [];
  const runById = new Map(runs.map((run) => [run.id, run] as const));
  const deliveries: RuneTaskDeliveryOutcome[] = [];
  const ids = new Set<string>();
  for (const entry of value.slice(0, MAX_RUNE_TASK_DELIVERIES * 2)) {
    if (!entry || typeof entry !== "object") continue;
    const candidate = entry as Partial<RuneTaskDeliveryOutcome>;
    const id = boundedText(candidate.id, 380);
    const confirmedAt = boundedText(candidate.confirmedAt, 40);
    const runId = boundedText(candidate.runId, 220);
    const taskId = TASK_IDS.has(candidate.taskId as RuneTaskId) ? candidate.taskId as RuneTaskId : undefined;
    const artifactId = boundedText(candidate.artifactId, 120);
    const method = candidate.method === "download" || candidate.method === "folder" ? candidate.method : undefined;
    const target = typeof candidate.target === "string" ? candidate.target as RuneTaskDeliveryTarget : undefined;
    const rating = DELIVERY_RATINGS.has(candidate.rating as RuneTaskDeliveryRating)
      ? candidate.rating as RuneTaskDeliveryRating
      : undefined;
    const taskDurationMs = boundedInteger(candidate.taskDurationMs, MAX_RUNE_TASK_DELIVERY_MS);
    const run = runId ? runById.get(runId) : undefined;
    const targetMatchesMethod = method === "folder" ? target === "folder" : method === "download" && DOWNLOAD_TARGETS.has(target as RuneTaskDeliveryTarget);
    if (candidate.version !== 1 || !id || ids.has(id) || !confirmedAt || Number.isNaN(Date.parse(confirmedAt))
      || !runId || !taskId || !artifactId || !run || run.status !== "applied" || run.taskId !== taskId
      || !run.outputArtifactIds.includes(artifactId) || id !== runeTaskDeliveryId(runId, artifactId)
      || !method || !target || !targetMatchesMethod || !rating || !SHA256.test(candidate.sourceSha256 ?? "")
      || taskDurationMs == null) continue;
    ids.add(id);
    deliveries.push({
      version: 1,
      id,
      confirmedAt: new Date(confirmedAt).toISOString(),
      runId,
      taskId,
      artifactId,
      method,
      target,
      rating,
      sourceSha256: candidate.sourceSha256 as string,
      taskDurationMs,
    });
    if (deliveries.length >= MAX_RUNE_TASK_DELIVERIES) break;
  }
  return deliveries.sort((left, right) => right.confirmedAt.localeCompare(left.confirmedAt));
}

export function normalizeRuneTaskEvidence(value: unknown): RuneTaskEvidence {
  if (!value || typeof value !== "object") return { ...EMPTY_RUNE_TASK_EVIDENCE };
  const candidate = value as Partial<RuneTaskEvidence>;
  if (candidate.version !== 1) return { ...EMPTY_RUNE_TASK_EVIDENCE };
  const runs = normalizeRuneTaskRuns(candidate.runs);
  return {
    version: 1,
    runs,
    deliveries: normalizeRuneTaskDeliveries(candidate.deliveries, runs),
  };
}

export async function recordRuneTaskDelivery(input: {
  evidence: RuneTaskEvidence;
  runId: string;
  artifactId: string;
  source: string;
  currentSourceRevision: string;
  method: RuneTaskDeliveryMethod;
  target: RuneTaskDeliveryTarget;
  rating: RuneTaskDeliveryRating;
  now?: Date;
}) {
  const evidence = normalizeRuneTaskEvidence(input.evidence);
  const run = evidence.runs.find((candidate) => candidate.id === input.runId);
  if (!run || run.status !== "applied") throw new Error("The applied task run is no longer available.");
  if (!run.outputArtifactIds.includes(input.artifactId)) throw new Error("This file is not an exact output of the applied task.");
  if (run.sourceRevision !== input.currentSourceRevision) {
    throw new Error("The task source changed after this run. Refresh the output before confirming delivery.");
  }
  if (run.outputRevisions[input.artifactId] !== portableSourceRevision(input.source)) {
    throw new Error("This output changed after the applied task. Run or refresh the task again before confirming delivery.");
  }
  const confirmedAt = input.now ?? new Date();
  const completedAt = Date.parse(run.completedAt);
  if (Number.isNaN(completedAt) || Number.isNaN(confirmedAt.getTime())) throw new Error("The task run has no valid completion time.");
  const outcome: RuneTaskDeliveryOutcome = {
    version: 1,
    id: runeTaskDeliveryId(run.id, input.artifactId),
    confirmedAt: confirmedAt.toISOString(),
    runId: run.id,
    taskId: run.taskId,
    artifactId: input.artifactId,
    method: input.method,
    target: input.target,
    rating: input.rating,
    sourceSha256: await runeTaskSourceSha256(input.source),
    taskDurationMs: run.durationMs + Math.max(0, confirmedAt.getTime() - completedAt),
  };
  const deliveries = normalizeRuneTaskDeliveries([
    outcome,
    ...evidence.deliveries.filter((delivery) => delivery.id !== outcome.id),
  ], evidence.runs);
  const recorded = deliveries.find((delivery) => delivery.id === outcome.id);
  if (!recorded) throw new Error("The delivery confirmation is outside Rune's bounded device record.");
  return { ...evidence, deliveries };
}

export function summarizeRuneTaskDeliveries(deliveries: RuneTaskDeliveryOutcome[]) {
  const usable = deliveries.filter((outcome) => outcome.rating === "ready" || outcome.rating === "minor-edits");
  return {
    total: deliveries.length,
    ready: deliveries.filter((outcome) => outcome.rating === "ready").length,
    minorEdits: deliveries.filter((outcome) => outcome.rating === "minor-edits").length,
    notReady: deliveries.length - usable.length,
    usable: usable.length,
    usableRate: deliveries.length ? Math.round((usable.length / deliveries.length) * 100) : null,
    averageTaskDurationMs: deliveries.length
      ? Math.round(deliveries.reduce((total, outcome) => total + outcome.taskDurationMs, 0) / deliveries.length)
      : null,
  };
}
