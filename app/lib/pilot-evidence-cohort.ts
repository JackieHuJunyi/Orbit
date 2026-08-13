import {
  MAX_RUNE_PILOT_EVIDENCE_BYTES,
  RUNE_PILOT_EVIDENCE_KIND,
  type RunePilotEvidenceDelivery,
  type RunePilotEvidencePackage,
  type RunePilotEvidenceRun,
} from "./pilot-evidence.ts";
import {
  MAX_RUNE_TASK_DELIVERIES,
  MAX_RUNE_TASK_DURATION_MS,
  MAX_RUNE_TASK_RUNS,
  RUNE_TASK_RUBRIC_DIMENSIONS,
  type RuneTaskRubricDimension,
} from "./task-evidence.ts";
import type { RuneTaskId } from "./task-runtime.ts";

export const RUNE_PILOT_COHORT_KIND = "rune-pilot-evidence-cohort";
export const MAX_RUNE_PILOT_COHORT_PARTICIPANTS = 50;

type RunSummary = {
  total: number;
  applied: number;
  stopped: number;
  successRate: number | null;
  averageDurationMs: number | null;
  modelRunCount: number;
  inputTokens: number | null;
  outputTokens: number | null;
};

type DeliverySummary = {
  total: number;
  ready: number;
  minorEdits: number;
  notReady: number;
  usable: number;
  usableRate: number | null;
  averageTaskDurationMs: number | null;
  humanEvaluated: number;
  reviewedRealTasks: number;
  numberCorrectnessBelow4: number;
  pilotEligibleTasks: number;
  meetsPilotMinimum: boolean;
  dimensionAverages: Record<RuneTaskRubricDimension, number | null>;
};

export type RunePilotCohortParticipant = {
  participantId: string;
  evidence: unknown;
};

export type RunePilotCohortReport = {
  version: 1;
  kind: typeof RUNE_PILOT_COHORT_KIND;
  compiledOn: string;
  provenance: {
    evidenceClass: "candidate-human-outcome-cohort";
    participantCount: number;
    sourcePackageCount: number;
    oneFinalPackagePerParticipantRequired: true;
    duplicatePackageContentRejected: true;
    participantIdentityIncluded: false;
    sourceRecordsIncluded: false;
    contentIncluded: false;
    uploadPerformed: false;
  };
  summary: {
    runs: RunSummary;
    deliveries: DeliverySummary;
    recurrence: {
      evaluatedParticipants: number;
      repeatedWithin28Days: number;
      repeatRate: number | null;
    };
  };
  tasks: Array<{
    taskId: RuneTaskId;
    runs: RunSummary;
    deliveries: DeliverySummary;
  }>;
};

type ValidatedParticipant = {
  participantId: string;
  evidence: RunePilotEvidencePackage;
};

const TASK_IDS = new Set<RuneTaskId>(["operating-review", "document-briefing"]);
const STOP_REASONS = new Set(["validation", "runtime", "stale", "persistence", "cancelled"]);
const TARGETS = new Set([
  "csv", "json", "doc", "ppt", "docx", "xlsx", "pptx", "odt", "ods", "odp", "html", "pdf", "md", "deck-md", "folder",
]);
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/u;
const PARTICIPANT_ID = /^participant-\d{3}$/u;
const RUN_ID = /^run-\d{3}$/u;
const OUTPUT_ID = /^output-\d{2}$/u;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function exactKeys(value: Record<string, unknown>, keys: readonly string[]) {
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  return actual.length === expected.length && actual.every((key, index) => key === expected[index]);
}

function validDateOnly(value: unknown): value is string {
  if (typeof value !== "string" || !DATE_ONLY.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function boundedInteger(value: unknown, maximum: number, minimum = 0): value is number {
  return Number.isInteger(value) && Number(value) >= minimum && Number(value) <= maximum;
}

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map((item) => canonicalJson(item)).join(",")}]`;
  if (isRecord(value)) return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(",")}}`;
  return JSON.stringify(value);
}

function sameJson(left: unknown, right: unknown) {
  return canonicalJson(left) === canonicalJson(right);
}

function average(values: number[]) {
  return values.length ? Math.round(values.reduce((total, value) => total + value, 0) / values.length) : null;
}

function summarizeRuns(runs: RunePilotEvidenceRun[]): RunSummary {
  const applied = runs.filter((run) => run.status === "applied");
  const modelRuns = runs.filter((run) => run.inputTokens != null && run.outputTokens != null);
  return {
    total: runs.length,
    applied: applied.length,
    stopped: runs.length - applied.length,
    successRate: runs.length ? Math.round((applied.length / runs.length) * 100) : null,
    averageDurationMs: average(runs.map((run) => run.durationMs)),
    modelRunCount: modelRuns.length,
    inputTokens: modelRuns.length ? modelRuns.reduce((total, run) => total + (run.inputTokens ?? 0), 0) : null,
    outputTokens: modelRuns.length ? modelRuns.reduce((total, run) => total + (run.outputTokens ?? 0), 0) : null,
  };
}

function summarizeDeliveries(
  deliveries: Array<{ participantId: string; delivery: RunePilotEvidenceDelivery }>,
): DeliverySummary {
  const usable = deliveries.filter(({ delivery }) => delivery.rating === "ready" || delivery.rating === "minor-edits");
  const humanEvaluated = deliveries.filter(({ delivery }) => delivery.evaluation);
  const evaluatedRuns = new Map<string, RunePilotEvidenceDelivery[]>();
  for (const { participantId, delivery } of humanEvaluated) {
    const runKey = `${participantId}:${delivery.runId}`;
    const outcomes = evaluatedRuns.get(runKey) ?? [];
    outcomes.push(delivery);
    evaluatedRuns.set(runKey, outcomes);
  }
  const dimensionAverages = Object.fromEntries(RUNE_TASK_RUBRIC_DIMENSIONS.map((dimension) => [
    dimension,
    humanEvaluated.length
      ? Math.round((humanEvaluated.reduce((total, { delivery }) => total + (delivery.evaluation?.rubric[dimension] ?? 0), 0) / humanEvaluated.length) * 10) / 10
      : null,
  ])) as Record<RuneTaskRubricDimension, number | null>;
  const pilotEligibleTasks = [...evaluatedRuns.values()].filter((outcomes) => (
    outcomes.every((outcome) => (outcome.evaluation?.rubric.numberCorrectness ?? 0) >= 4)
  )).length;
  return {
    total: deliveries.length,
    ready: deliveries.filter(({ delivery }) => delivery.rating === "ready").length,
    minorEdits: deliveries.filter(({ delivery }) => delivery.rating === "minor-edits").length,
    notReady: deliveries.length - usable.length,
    usable: usable.length,
    usableRate: deliveries.length ? Math.round((usable.length / deliveries.length) * 100) : null,
    averageTaskDurationMs: average(deliveries.map(({ delivery }) => delivery.taskDurationMs)),
    humanEvaluated: humanEvaluated.length,
    reviewedRealTasks: evaluatedRuns.size,
    numberCorrectnessBelow4: humanEvaluated.filter(({ delivery }) => (delivery.evaluation?.rubric.numberCorrectness ?? 0) < 4).length,
    pilotEligibleTasks,
    meetsPilotMinimum: pilotEligibleTasks >= 20,
    dimensionAverages,
  };
}

function validateEvaluation(value: unknown) {
  if (!isRecord(value) || !exactKeys(value, ["version", "provenance", "rubric"])
    || value.version !== 1 || value.provenance !== "authorized-or-redacted" || !isRecord(value.rubric)
    || !exactKeys(value.rubric, RUNE_TASK_RUBRIC_DIMENSIONS)) return false;
  const rubric = value.rubric;
  return RUNE_TASK_RUBRIC_DIMENSIONS.every((dimension) => boundedInteger(rubric[dimension], 5, 1));
}

function validateRun(value: unknown, index: number): value is RunePilotEvidenceRun {
  if (!isRecord(value) || !exactKeys(value, [
    "id", "taskId", "completedOn", "status", "stopReason", "planner", "outputCount", "changedFileCount",
    "queryCount", "chartConsumerCount", "durationMs", "inputTokens", "outputTokens",
  ])) return false;
  const statusValid = value.status === "applied"
    ? value.stopReason === null
    : value.status === "stopped" && STOP_REASONS.has(value.stopReason as string);
  const tokensValid = (value.inputTokens === null || boundedInteger(value.inputTokens, 10_000_000))
    && (value.outputTokens === null || boundedInteger(value.outputTokens, 10_000_000));
  return value.id === `run-${String(index + 1).padStart(3, "0")}`
    && RUN_ID.test(value.id as string)
    && TASK_IDS.has(value.taskId as RuneTaskId)
    && validDateOnly(value.completedOn)
    && statusValid
    && (value.planner === "local" || value.planner === "configured-model")
    && boundedInteger(value.outputCount, 4, 1)
    && boundedInteger(value.changedFileCount, 7)
    && boundedInteger(value.queryCount, 50)
    && boundedInteger(value.chartConsumerCount, 50)
    && boundedInteger(value.durationMs, MAX_RUNE_TASK_DURATION_MS)
    && tokensValid;
}

function validateDelivery(
  value: unknown,
  runById: Map<string, RunePilotEvidenceRun>,
): value is RunePilotEvidenceDelivery {
  if (!isRecord(value) || !exactKeys(value, [
    "runId", "output", "confirmedOn", "taskId", "method", "target", "rating", "taskDurationMs", "evaluation",
  ])) return false;
  const run = typeof value.runId === "string" ? runById.get(value.runId) : undefined;
  const outputIndex = typeof value.output === "string" && OUTPUT_ID.test(value.output)
    ? Number.parseInt(value.output.slice("output-".length), 10)
    : 0;
  const targetMatchesMethod = value.method === "folder"
    ? value.target === "folder"
    : value.method === "download" && TARGETS.has(value.target as string) && value.target !== "folder";
  return Boolean(run)
    && run?.status === "applied"
    && RUN_ID.test(value.runId as string)
    && outputIndex >= 1 && outputIndex <= (run?.outputCount ?? 0)
    && validDateOnly(value.confirmedOn)
    && value.confirmedOn >= (run?.completedOn ?? "")
    && value.taskId === run?.taskId
    && targetMatchesMethod
    && (value.rating === "ready" || value.rating === "minor-edits" || value.rating === "not-ready")
    && boundedInteger(value.taskDurationMs, 365 * 24 * 60 * 60 * 1_000)
    && value.taskDurationMs >= (run?.durationMs ?? Number.POSITIVE_INFINITY)
    && (value.evaluation === null || validateEvaluation(value.evaluation));
}

export function parseRunePilotEvidencePackage(value: unknown): RunePilotEvidencePackage {
  if (!isRecord(value) || !exactKeys(value, ["version", "kind", "exportedOn", "provenance", "summary", "runs", "deliveries"])
    || value.version !== 1 || value.kind !== RUNE_PILOT_EVIDENCE_KIND || !validDateOnly(value.exportedOn)) {
    throw new Error("Pilot evidence package metadata is invalid.");
  }
  if (!isRecord(value.provenance) || !exactKeys(value.provenance, [
    "scope", "evidenceClass", "contentIncluded", "identityIncluded", "syntheticRegressionEvidenceIncluded", "uploadPerformed",
  ]) || value.provenance.scope !== "device-local"
    || value.provenance.evidenceClass !== "candidate-human-outcome-evidence"
    || value.provenance.contentIncluded !== false
    || value.provenance.identityIncluded !== false
    || value.provenance.syntheticRegressionEvidenceIncluded !== false
    || value.provenance.uploadPerformed !== false) {
    throw new Error("Pilot evidence package provenance is invalid.");
  }
  if (!Array.isArray(value.runs) || value.runs.length < 1 || value.runs.length > MAX_RUNE_TASK_RUNS
    || !value.runs.every((run, index) => validateRun(run, index))) {
    throw new Error("Pilot evidence package runs are invalid.");
  }
  const runs = value.runs as RunePilotEvidenceRun[];
  if (runs.some((run, index) => index > 0 && runs[index - 1].completedOn < run.completedOn)) {
    throw new Error("Pilot evidence package runs are not in compiler order.");
  }
  const runById = new Map(runs.map((run) => [run.id, run] as const));
  if (!Array.isArray(value.deliveries) || value.deliveries.length > MAX_RUNE_TASK_DELIVERIES
    || !value.deliveries.every((delivery) => validateDelivery(delivery, runById))) {
    throw new Error("Pilot evidence package deliveries are invalid.");
  }
  const deliveries = value.deliveries as RunePilotEvidenceDelivery[];
  if (deliveries.some((delivery, index) => index > 0 && deliveries[index - 1].confirmedOn < delivery.confirmedOn)) {
    throw new Error("Pilot evidence package deliveries are not in compiler order.");
  }
  const deliveryKeys = new Set(deliveries.map((delivery) => `${delivery.runId}:${delivery.output}`));
  if (deliveryKeys.size !== deliveries.length) throw new Error("Pilot evidence package repeats an output outcome.");
  const expectedSummary = {
    runs: summarizeRuns(runs),
    deliveries: summarizeDeliveries(deliveries.map((delivery) => ({ participantId: "participant-000", delivery }))),
  };
  if (!sameJson(value.summary, expectedSummary)) throw new Error("Pilot evidence package summary does not match its records.");
  if (new TextEncoder().encode(canonicalJson(value)).byteLength > MAX_RUNE_PILOT_EVIDENCE_BYTES) {
    throw new Error("Pilot evidence package exceeds Rune's review limit.");
  }
  return JSON.parse(JSON.stringify(value)) as RunePilotEvidencePackage;
}

function evidenceContentIdentity(evidence: RunePilotEvidencePackage) {
  const content: Record<string, unknown> = { ...evidence };
  delete content.exportedOn;
  return canonicalJson(content);
}

function recurrenceSummary(participants: ValidatedParticipant[]) {
  let evaluatedParticipants = 0;
  let repeatedWithin28Days = 0;
  for (const participant of participants) {
    const evaluatedRunIds = new Set(participant.evidence.deliveries
      .filter((delivery) => delivery.evaluation)
      .map((delivery) => delivery.runId));
    const dates = participant.evidence.runs
      .filter((run) => evaluatedRunIds.has(run.id))
      .map((run) => Date.parse(`${run.completedOn}T00:00:00.000Z`))
      .sort((left, right) => left - right);
    if (!dates.length) continue;
    evaluatedParticipants += 1;
    const repeated = dates.some((date, index) => dates.slice(index + 1).some((next) => {
      const days = (next - date) / (24 * 60 * 60 * 1_000);
      return days >= 1 && days <= 28;
    }));
    if (repeated) repeatedWithin28Days += 1;
  }
  return {
    evaluatedParticipants,
    repeatedWithin28Days,
    repeatRate: evaluatedParticipants ? Math.round((repeatedWithin28Days / evaluatedParticipants) * 100) : null,
  };
}

export function compileRunePilotCohort(
  input: readonly RunePilotCohortParticipant[],
  now: Date = new Date(),
): RunePilotCohortReport {
  if (Number.isNaN(now.getTime())) throw new Error("Pilot cohort needs a valid compile time.");
  if (!Array.isArray(input) || input.length < 1 || input.length > MAX_RUNE_PILOT_COHORT_PARTICIPANTS) {
    throw new Error(`Pilot cohort requires 1–${MAX_RUNE_PILOT_COHORT_PARTICIPANTS} participants.`);
  }
  const participantIds = new Set<string>();
  const packageContents = new Set<string>();
  const participants: ValidatedParticipant[] = input.map((participant) => {
    if (!isRecord(participant) || !exactKeys(participant, ["participantId", "evidence"])
      || typeof participant.participantId !== "string" || !PARTICIPANT_ID.test(participant.participantId)
      || participantIds.has(participant.participantId)) {
      throw new Error("Pilot cohort participant ids must be unique participant-NNN aliases.");
    }
    participantIds.add(participant.participantId);
    const evidence = parseRunePilotEvidencePackage(participant.evidence);
    const contentIdentity = evidenceContentIdentity(evidence);
    if (packageContents.has(contentIdentity)) throw new Error("Pilot cohort contains duplicate evidence package content.");
    packageContents.add(contentIdentity);
    return { participantId: participant.participantId, evidence };
  });
  const allRuns = participants.flatMap((participant) => participant.evidence.runs);
  const allDeliveries = participants.flatMap((participant) => participant.evidence.deliveries.map((delivery) => ({
    participantId: participant.participantId,
    delivery,
  })));
  const tasks = [...TASK_IDS].map((taskId) => ({
    taskId,
    runs: summarizeRuns(allRuns.filter((run) => run.taskId === taskId)),
    deliveries: summarizeDeliveries(allDeliveries.filter(({ delivery }) => delivery.taskId === taskId)),
  }));
  return {
    version: 1,
    kind: RUNE_PILOT_COHORT_KIND,
    compiledOn: now.toISOString().slice(0, 10),
    provenance: {
      evidenceClass: "candidate-human-outcome-cohort",
      participantCount: participants.length,
      sourcePackageCount: participants.length,
      oneFinalPackagePerParticipantRequired: true,
      duplicatePackageContentRejected: true,
      participantIdentityIncluded: false,
      sourceRecordsIncluded: false,
      contentIncluded: false,
      uploadPerformed: false,
    },
    summary: {
      runs: summarizeRuns(allRuns),
      deliveries: summarizeDeliveries(allDeliveries),
      recurrence: recurrenceSummary(participants),
    },
    tasks,
  };
}

function displayRate(value: number | null) {
  return value == null ? "—" : `${value}%`;
}

function displayDuration(value: number | null) {
  return value == null ? "—" : `${Math.round(value / 60_000)} min`;
}

export function renderRunePilotCohortMarkdown(report: RunePilotCohortReport) {
  const dimensions = RUNE_TASK_RUBRIC_DIMENSIONS.map((dimension) => (
    `| ${dimension} | ${report.summary.deliveries.dimensionAverages[dimension] ?? "—"} |`
  )).join("\n");
  const tasks = report.tasks.map((task) => (
    `| ${task.taskId} | ${task.runs.total} | ${displayRate(task.runs.successRate)} | ${task.deliveries.total} | ${displayRate(task.deliveries.usableRate)} | ${task.deliveries.reviewedRealTasks} | ${task.deliveries.pilotEligibleTasks} |`
  )).join("\n");
  return `# Rune Pilot Cohort\n\n> Candidate human-outcome cohort evidence compiled locally. This report is not proof of PMF, retention, payment, or a completed pilot.\n\n- Compiled on: ${report.compiledOn}\n- Anonymous participants: ${report.provenance.participantCount}\n- Source packages: ${report.provenance.sourcePackageCount}\n- Upload performed: no\n- Participant identity included: no\n- Source records or content included: no\n\n## Outcome summary\n\n- Task runs: ${report.summary.runs.total}\n- Applied: ${report.summary.runs.applied} (${displayRate(report.summary.runs.successRate)})\n- Average run time: ${displayDuration(report.summary.runs.averageDurationMs)}\n- Delivery outcomes: ${report.summary.deliveries.total}\n- Usable or minor-edit deliveries: ${report.summary.deliveries.usable} (${displayRate(report.summary.deliveries.usableRate)})\n- Human-evaluated deliverables: ${report.summary.deliveries.humanEvaluated}\n- Unique reviewed real tasks: ${report.summary.deliveries.reviewedRealTasks}\n- Pilot-eligible tasks: ${report.summary.deliveries.pilotEligibleTasks} / 20\n- Number-correctness checks below 4: ${report.summary.deliveries.numberCorrectnessBelow4}\n- Evaluated participants with a repeated task within 28 days: ${report.summary.recurrence.repeatedWithin28Days} / ${report.summary.recurrence.evaluatedParticipants} (${displayRate(report.summary.recurrence.repeatRate)})\n\n## Task breakdown\n\n| Task | Runs | Apply rate | Deliveries | Usable rate | Reviewed real tasks | Pilot eligible |\n| --- | ---: | ---: | ---: | ---: | ---: | ---: |\n${tasks}\n\n## Human evaluation averages\n\n| Dimension | Average / 5 |\n| --- | ---: |\n${dimensions}\n\n## Interpretation boundary\n\nOne final package is required per pseudonymous participant. Exact duplicate package content is rejected, but Rune intentionally emits no stable cross-export person or run identity; replacing a participant's final package must happen in the manifest rather than adding another row. Only complete authorized/redacted evaluations count as reviewed real tasks. Synthetic regression results and unscored technical success do not count.\n`;
}
