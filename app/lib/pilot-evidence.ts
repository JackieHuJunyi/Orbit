import {
  normalizeRuneTaskEvidence,
  summarizeRuneTaskDeliveries,
  summarizeRuneTaskRuns,
  type RuneTaskDeliveryMethod,
  type RuneTaskDeliveryRating,
  type RuneTaskDeliveryTarget,
  type RuneTaskEvidence,
  type RuneTaskHumanEvaluation,
  type RuneTaskRunStatus,
  type RuneTaskStopReason,
} from "./task-evidence.ts";
import type { RuneTaskId } from "./task-runtime.ts";

export const RUNE_PILOT_EVIDENCE_KIND = "rune-pilot-evidence";
export const MAX_RUNE_PILOT_EVIDENCE_BYTES = 128 * 1_024;

export type RunePilotEvidenceRun = {
  id: string;
  taskId: RuneTaskId;
  completedOn: string;
  status: RuneTaskRunStatus;
  stopReason: RuneTaskStopReason | null;
  planner: "local" | "configured-model";
  outputCount: number;
  changedFileCount: number;
  queryCount: number;
  chartConsumerCount: number;
  durationMs: number;
  inputTokens: number | null;
  outputTokens: number | null;
};

export type RunePilotEvidenceDelivery = {
  runId: string;
  output: string;
  confirmedOn: string;
  taskId: RuneTaskId;
  method: RuneTaskDeliveryMethod;
  target: RuneTaskDeliveryTarget;
  rating: RuneTaskDeliveryRating;
  taskDurationMs: number;
  evaluation: RuneTaskHumanEvaluation | null;
};

export type RunePilotEvidencePackage = {
  version: 1;
  kind: typeof RUNE_PILOT_EVIDENCE_KIND;
  exportedOn: string;
  provenance: {
    scope: "device-local";
    evidenceClass: "candidate-human-outcome-evidence";
    contentIncluded: false;
    identityIncluded: false;
    syntheticRegressionEvidenceIncluded: false;
    uploadPerformed: false;
  };
  summary: {
    runs: ReturnType<typeof summarizeRuneTaskRuns>;
    deliveries: ReturnType<typeof summarizeRuneTaskDeliveries>;
  };
  runs: RunePilotEvidenceRun[];
  deliveries: RunePilotEvidenceDelivery[];
};

export type RunePilotEvidenceExport = {
  package: RunePilotEvidencePackage;
  bytes: Uint8Array;
  fileName: string;
  mimeType: "application/json";
};

function publicDate(iso: string) {
  return iso.slice(0, 10);
}

function numberedAlias(prefix: string, index: number, width: number) {
  return `${prefix}-${String(index + 1).padStart(width, "0")}`;
}

export function prepareRunePilotEvidenceExport(
  input: RuneTaskEvidence,
  now: Date = new Date(),
): RunePilotEvidenceExport {
  if (Number.isNaN(now.getTime())) throw new Error("Pilot evidence needs a valid export time.");
  const evidence = normalizeRuneTaskEvidence(input);
  if (!evidence.runs.length) throw new Error("Complete a guided task before exporting pilot evidence.");

  const runAliases = new Map(evidence.runs.map((run, index) => [run.id, numberedAlias("run", index, 3)] as const));
  const outputAliases = new Map<string, string>();
  for (const run of evidence.runs) {
    run.outputArtifactIds.forEach((artifactId, index) => {
      outputAliases.set(`${run.id}:${artifactId}`, numberedAlias("output", index, 2));
    });
  }

  const runs: RunePilotEvidenceRun[] = evidence.runs.map((run) => ({
    id: runAliases.get(run.id) as string,
    taskId: run.taskId,
    completedOn: publicDate(run.completedAt),
    status: run.status,
    stopReason: run.stopReason,
    planner: run.provider === "local" ? "local" : "configured-model",
    outputCount: run.outputArtifactIds.length,
    changedFileCount: run.changedFileCount,
    queryCount: run.queryCount,
    chartConsumerCount: run.chartConsumerCount,
    durationMs: run.durationMs,
    inputTokens: run.inputTokens,
    outputTokens: run.outputTokens,
  }));
  const deliveries: RunePilotEvidenceDelivery[] = evidence.deliveries.map((delivery) => ({
    runId: runAliases.get(delivery.runId) as string,
    output: outputAliases.get(`${delivery.runId}:${delivery.artifactId}`) as string,
    confirmedOn: publicDate(delivery.confirmedAt),
    taskId: delivery.taskId,
    method: delivery.method,
    target: delivery.target,
    rating: delivery.rating,
    taskDurationMs: delivery.taskDurationMs,
    evaluation: delivery.evaluation
      ? {
          version: 1,
          provenance: "authorized-or-redacted",
          rubric: { ...delivery.evaluation.rubric },
        }
      : null,
  }));
  const exportedOn = now.toISOString().slice(0, 10);
  const evidencePackage: RunePilotEvidencePackage = {
    version: 1,
    kind: RUNE_PILOT_EVIDENCE_KIND,
    exportedOn,
    provenance: {
      scope: "device-local",
      evidenceClass: "candidate-human-outcome-evidence",
      contentIncluded: false,
      identityIncluded: false,
      syntheticRegressionEvidenceIncluded: false,
      uploadPerformed: false,
    },
    summary: {
      runs: summarizeRuneTaskRuns(evidence.runs),
      deliveries: summarizeRuneTaskDeliveries(evidence.deliveries),
    },
    runs,
    deliveries,
  };
  const bytes = new TextEncoder().encode(`${JSON.stringify(evidencePackage, null, 2)}\n`);
  if (bytes.byteLength > MAX_RUNE_PILOT_EVIDENCE_BYTES) {
    throw new Error("Pilot evidence is larger than Orbit's local review limit.");
  }
  return {
    package: evidencePackage,
    bytes,
    fileName: `orbit-pilot-evidence-${exportedOn}.json`,
    mimeType: "application/json",
  };
}
