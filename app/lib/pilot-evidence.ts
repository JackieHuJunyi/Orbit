import {
  normalizeOrbitTaskEvidence,
  summarizeOrbitTaskDeliveries,
  summarizeOrbitTaskRuns,
  type OrbitTaskDeliveryMethod,
  type OrbitTaskDeliveryRating,
  type OrbitTaskDeliveryTarget,
  type OrbitTaskEvidence,
  type OrbitTaskHumanEvaluation,
  type OrbitTaskRunStatus,
  type OrbitTaskStopReason,
} from "./task-evidence.ts";
import type { OrbitTaskId } from "./task-runtime.ts";

export const ORBIT_PILOT_EVIDENCE_KIND = "orbit-pilot-evidence";
export const MAX_ORBIT_PILOT_EVIDENCE_BYTES = 128 * 1_024;

export type OrbitPilotEvidenceRun = {
  id: string;
  taskId: OrbitTaskId;
  completedOn: string;
  status: OrbitTaskRunStatus;
  stopReason: OrbitTaskStopReason | null;
  planner: "local" | "configured-model";
  outputCount: number;
  changedFileCount: number;
  queryCount: number;
  chartConsumerCount: number;
  durationMs: number;
  inputTokens: number | null;
  outputTokens: number | null;
};

export type OrbitPilotEvidenceDelivery = {
  runId: string;
  output: string;
  confirmedOn: string;
  taskId: OrbitTaskId;
  method: OrbitTaskDeliveryMethod;
  target: OrbitTaskDeliveryTarget;
  rating: OrbitTaskDeliveryRating;
  taskDurationMs: number;
  evaluation: OrbitTaskHumanEvaluation | null;
};

export type OrbitPilotEvidencePackage = {
  version: 1;
  kind: typeof ORBIT_PILOT_EVIDENCE_KIND;
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
    runs: ReturnType<typeof summarizeOrbitTaskRuns>;
    deliveries: ReturnType<typeof summarizeOrbitTaskDeliveries>;
  };
  runs: OrbitPilotEvidenceRun[];
  deliveries: OrbitPilotEvidenceDelivery[];
};

export type OrbitPilotEvidenceExport = {
  package: OrbitPilotEvidencePackage;
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

export function prepareOrbitPilotEvidenceExport(
  input: OrbitTaskEvidence,
  now: Date = new Date(),
): OrbitPilotEvidenceExport {
  if (Number.isNaN(now.getTime())) throw new Error("Pilot evidence needs a valid export time.");
  const evidence = normalizeOrbitTaskEvidence(input);
  if (!evidence.runs.length) throw new Error("Complete a guided task before exporting pilot evidence.");

  const runAliases = new Map(evidence.runs.map((run, index) => [run.id, numberedAlias("run", index, 3)] as const));
  const outputAliases = new Map<string, string>();
  for (const run of evidence.runs) {
    run.outputArtifactIds.forEach((artifactId, index) => {
      outputAliases.set(`${run.id}:${artifactId}`, numberedAlias("output", index, 2));
    });
  }

  const runs: OrbitPilotEvidenceRun[] = evidence.runs.map((run) => ({
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
  const deliveries: OrbitPilotEvidenceDelivery[] = evidence.deliveries.map((delivery) => ({
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
  const evidencePackage: OrbitPilotEvidencePackage = {
    version: 1,
    kind: ORBIT_PILOT_EVIDENCE_KIND,
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
      runs: summarizeOrbitTaskRuns(evidence.runs),
      deliveries: summarizeOrbitTaskDeliveries(evidence.deliveries),
    },
    runs,
    deliveries,
  };
  const bytes = new TextEncoder().encode(`${JSON.stringify(evidencePackage, null, 2)}\n`);
  if (bytes.byteLength > MAX_ORBIT_PILOT_EVIDENCE_BYTES) {
    throw new Error("Pilot evidence is larger than Orbit's local review limit.");
  }
  return {
    package: evidencePackage,
    bytes,
    fileName: `orbit-pilot-evidence-${exportedOn}.json`,
    mimeType: "application/json",
  };
}
