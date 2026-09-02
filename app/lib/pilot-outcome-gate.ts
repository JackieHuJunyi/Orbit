export const PILOT_OUTCOME_GATE_THRESHOLDS = {
  comparableTasks: 10,
  medianTimeReductionPercent: 50,
  deliveryUsabilityPercent: 70,
  keyNumberTraceabilityPercent: 100,
  applyPercent: 60,
  safetyRedlines: 0,
} as const;

const MAX_COMPARISONS = 100;
const MAX_MINUTES = 10_080;
const MAX_KEY_NUMBERS = 1_000;

type DeliveryOutcome = "ready" | "minor_edits" | "not_usable";
type ManualTiming = "measured" | "estimated";

export type PilotOutcomeComparison = {
  participantId: string;
  taskId: string;
  recordedOn: string;
  evidenceReference: string;
  manualMinutes: number;
  runeMinutes: number;
  manualTiming: ManualTiming;
  authorizedOrRedacted: true;
  sameScope: true;
  sameDecision: true;
  deliveryOutcome: DeliveryOutcome;
  keyNumbersGenerated: number;
  keyNumbersTraceable: number;
  applied: boolean;
  safetyRedlines: number;
};

export type PilotOutcomeInput = {
  version: 1;
  comparisons: PilotOutcomeComparison[];
};

export type PilotOutcomeReport = {
  version: 1;
  comparableTasks: number;
  participants: number;
  estimatedManualTimings: number;
  medianTimeReductionPercent: number;
  deliveryUsabilityPercent: number;
  keyNumberTraceabilityPercent: number;
  applyPercent: number;
  safetyRedlines: number;
  gates: {
    sample: boolean;
    time: boolean;
    delivery: boolean;
    traceability: boolean;
    apply: boolean;
    safety: boolean;
    passed: boolean;
  };
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function hasExactKeys(value: Record<string, unknown>, keys: string[]) {
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  return actual.length === expected.length && actual.every((key, index) => key === expected[index]);
}

function isBoundedInteger(value: unknown, minimum: number, maximum: number): value is number {
  return Number.isInteger(value) && Number.isSafeInteger(value) && Number(value) >= minimum && Number(value) <= maximum;
}

function isCalendarDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/u.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  return parsed.getUTCFullYear() === year && parsed.getUTCMonth() === month - 1 && parsed.getUTCDate() === day;
}

function isReference(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.trim() === value &&
    value.length >= 1 &&
    value.length <= 240 &&
    !/[\u0000-\u001f\u007f]/u.test(value)
  );
}

function roundRate(value: number) {
  return Math.round(value * 10) / 10;
}

function median(values: number[]) {
  const ordered = [...values].sort((left, right) => left - right);
  const middle = Math.floor(ordered.length / 2);
  return ordered.length % 2 === 1 ? ordered[middle] : (ordered[middle - 1] + ordered[middle]) / 2;
}

function parseComparison(value: unknown, taskIds: Set<string>): PilotOutcomeComparison {
  if (
    !isRecord(value) ||
    !hasExactKeys(value, [
      "participantId",
      "taskId",
      "recordedOn",
      "evidenceReference",
      "manualMinutes",
      "runeMinutes",
      "manualTiming",
      "authorizedOrRedacted",
      "sameScope",
      "sameDecision",
      "deliveryOutcome",
      "keyNumbersGenerated",
      "keyNumbersTraceable",
      "applied",
      "safetyRedlines",
    ])
  ) {
    throw new Error("Each P2 comparison must contain only the documented fields.");
  }

  const participantId = value.participantId;
  const taskId = value.taskId;
  if (typeof participantId !== "string" || !/^participant-\d{3}$/u.test(participantId)) {
    throw new Error("P2 participantId must use the anonymous participant-NNN form.");
  }
  if (typeof taskId !== "string" || !/^task-\d{3}$/u.test(taskId) || taskIds.has(taskId)) {
    throw new Error("Every P2 taskId must be a unique anonymous task-NNN value.");
  }
  taskIds.add(taskId);

  if (!isCalendarDate(value.recordedOn) || !isReference(value.evidenceReference)) {
    throw new Error("Each P2 comparison needs a valid date and a bounded approved-system evidence reference.");
  }
  if (!isBoundedInteger(value.manualMinutes, 1, MAX_MINUTES) || !isBoundedInteger(value.runeMinutes, 1, MAX_MINUTES)) {
    throw new Error(`P2 timing must be whole minutes between 1 and ${MAX_MINUTES}.`);
  }
  if (value.manualTiming !== "measured" && value.manualTiming !== "estimated") {
    throw new Error("manualTiming must be measured or estimated.");
  }
  if (value.authorizedOrRedacted !== true || value.sameScope !== true || value.sameDecision !== true) {
    throw new Error("P2 records must affirm authorization/redaction, the same scope, and the same decision goal.");
  }
  if (
    value.deliveryOutcome !== "ready" &&
    value.deliveryOutcome !== "minor_edits" &&
    value.deliveryOutcome !== "not_usable"
  ) {
    throw new Error("deliveryOutcome must be ready, minor_edits, or not_usable.");
  }
  if (
    !isBoundedInteger(value.keyNumbersGenerated, 1, MAX_KEY_NUMBERS) ||
    !isBoundedInteger(value.keyNumbersTraceable, 0, value.keyNumbersGenerated)
  ) {
    throw new Error("P2 key-number counts must be bounded and traceable cannot exceed generated.");
  }
  if (typeof value.applied !== "boolean" || !isBoundedInteger(value.safetyRedlines, 0, MAX_KEY_NUMBERS)) {
    throw new Error("P2 Apply and safety-redline fields must be explicit bounded values.");
  }

  return value as PilotOutcomeComparison;
}

export function compilePilotOutcomeGate(value: unknown): PilotOutcomeReport {
  if (
    !isRecord(value) ||
    !hasExactKeys(value, ["version", "comparisons"]) ||
    value.version !== 1 ||
    !Array.isArray(value.comparisons) ||
    value.comparisons.length < 1 ||
    value.comparisons.length > MAX_COMPARISONS
  ) {
    throw new Error(`P2 input requires version 1 and 1–${MAX_COMPARISONS} comparisons.`);
  }

  const taskIds = new Set<string>();
  const comparisons = value.comparisons.map((comparison) => parseComparison(comparison, taskIds));
  const participants = new Set(comparisons.map((comparison) => comparison.participantId)).size;
  const timeReductions = comparisons.map(
    (comparison) => ((comparison.manualMinutes - comparison.runeMinutes) / comparison.manualMinutes) * 100,
  );
  const medianTimeReductionPercent = roundRate(median(timeReductions));
  const deliveryUsabilityPercent = roundRate(
    (comparisons.filter((comparison) => comparison.deliveryOutcome !== "not_usable").length / comparisons.length) * 100,
  );
  const generatedKeyNumbers = comparisons.reduce((total, comparison) => total + comparison.keyNumbersGenerated, 0);
  const traceableKeyNumbers = comparisons.reduce((total, comparison) => total + comparison.keyNumbersTraceable, 0);
  const keyNumberTraceabilityPercent = roundRate((traceableKeyNumbers / generatedKeyNumbers) * 100);
  const applyPercent = roundRate(
    (comparisons.filter((comparison) => comparison.applied).length / comparisons.length) * 100,
  );
  const safetyRedlines = comparisons.reduce((total, comparison) => total + comparison.safetyRedlines, 0);
  const gates = {
    sample: comparisons.length >= PILOT_OUTCOME_GATE_THRESHOLDS.comparableTasks,
    time: medianTimeReductionPercent >= PILOT_OUTCOME_GATE_THRESHOLDS.medianTimeReductionPercent,
    delivery: deliveryUsabilityPercent >= PILOT_OUTCOME_GATE_THRESHOLDS.deliveryUsabilityPercent,
    traceability: keyNumberTraceabilityPercent >= PILOT_OUTCOME_GATE_THRESHOLDS.keyNumberTraceabilityPercent,
    apply: applyPercent >= PILOT_OUTCOME_GATE_THRESHOLDS.applyPercent,
    safety: safetyRedlines === PILOT_OUTCOME_GATE_THRESHOLDS.safetyRedlines,
    passed: false,
  };
  gates.passed = gates.sample && gates.time && gates.delivery && gates.traceability && gates.apply && gates.safety;

  return {
    version: 1,
    comparableTasks: comparisons.length,
    participants,
    estimatedManualTimings: comparisons.filter((comparison) => comparison.manualTiming === "estimated").length,
    medianTimeReductionPercent,
    deliveryUsabilityPercent,
    keyNumberTraceabilityPercent,
    applyPercent,
    safetyRedlines,
    gates,
  };
}

function mark(value: boolean) {
  return value ? "PASS" : "OPEN";
}

export function renderPilotOutcomeGateMarkdown(report: PilotOutcomeReport) {
  return `# Orbit P2 outcome gate

> ${report.gates.passed ? "PASS" : "OPEN"}. This report summarizes asserted, externally evidenced real-task records. It does not turn synthetic fixtures into user evidence.

| Measure | Result | Gate | Status |
| --- | ---: | ---: | --- |
| Comparable paired tasks | ${report.comparableTasks} | ≥ ${PILOT_OUTCOME_GATE_THRESHOLDS.comparableTasks} | ${mark(report.gates.sample)} |
| Median paired time reduction | ${report.medianTimeReductionPercent}% | ≥ ${PILOT_OUTCOME_GATE_THRESHOLDS.medianTimeReductionPercent}% | ${mark(report.gates.time)} |
| Ready or minor-edit delivery | ${report.deliveryUsabilityPercent}% | ≥ ${PILOT_OUTCOME_GATE_THRESHOLDS.deliveryUsabilityPercent}% | ${mark(report.gates.delivery)} |
| Generated key-number traceability | ${report.keyNumberTraceabilityPercent}% | ${PILOT_OUTCOME_GATE_THRESHOLDS.keyNumberTraceabilityPercent}% | ${mark(report.gates.traceability)} |
| Apply rate | ${report.applyPercent}% | ≥ ${PILOT_OUTCOME_GATE_THRESHOLDS.applyPercent}% | ${mark(report.gates.apply)} |
| Safety redlines | ${report.safetyRedlines} | ${PILOT_OUTCOME_GATE_THRESHOLDS.safetyRedlines} | ${mark(report.gates.safety)} |

Participants: ${report.participants}. Estimated manual timings: ${report.estimatedManualTimings}/${report.comparableTasks}. Review the source records and approved-system references before making a decision.
`;
}
