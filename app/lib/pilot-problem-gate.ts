export const PILOT_PROBLEM_GATE_THRESHOLDS = {
  eligibleInterviews: 15,
  monthlyRepeaters: 8,
  highCostOrError: 5,
  supervisedTaskAgreements: 7,
  availableSourceSets: 5,
} as const;

const MAX_ACTIVE_MINUTES = 10_080;

type ActiveMinutesBasis = "measured" | "estimated" | "unknown";
type MaterialErrorCost = "observed" | "not_observed" | "unknown";
type TrialMaterialStatus = "authorized" | "redacted" | "unavailable" | "unknown";
type SupervisedTaskAgreement = "yes" | "no" | "follow_up";
type RoleSegment = "operations" | "finance" | "strategy_analysis" | "founder_office";
type PriceChoice = 499 | 999 | 1999 | "none";

export type PilotProblemInterview = {
  participantId: string;
  interviewedOn: string;
  evidenceReference: string;
  roleSegment: RoleSegment;
  eligibleRecentTask: true;
  repeatsAtLeastMonthly: boolean;
  activeMinutes: number | null;
  activeMinutesBasis: ActiveMinutesBasis;
  materialErrorCost: MaterialErrorCost;
  trialMaterialStatus: TrialMaterialStatus;
  agreesToSupervisedTask: SupervisedTaskAgreement;
  priceChoice: PriceChoice;
};

export type PilotProblemReport = {
  version: 1;
  eligibleInterviews: number;
  monthlyRepeaters: number;
  highCostOrError: number;
  supervisedTaskAgreements: number;
  availableSourceSets: number;
  unknownActiveMinutes: number;
  unknownErrorCosts: number;
  unknownSourceSets: number;
  priceChoices: {
    499: number;
    999: number;
    1999: number;
    none: number;
  };
  gates: {
    sample: boolean;
    recurrence: boolean;
    pain: boolean;
    trialAgreement: boolean;
    sourceAvailability: boolean;
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

function isBoundedInteger(value: unknown, minimum: number, maximum: number): value is number {
  return Number.isSafeInteger(value) && Number(value) >= minimum && Number(value) <= maximum;
}

function parseInterview(value: unknown, participantIds: Set<string>): PilotProblemInterview {
  if (
    !isRecord(value) ||
    !hasExactKeys(value, [
      "participantId",
      "interviewedOn",
      "evidenceReference",
      "roleSegment",
      "eligibleRecentTask",
      "repeatsAtLeastMonthly",
      "activeMinutes",
      "activeMinutesBasis",
      "materialErrorCost",
      "trialMaterialStatus",
      "agreesToSupervisedTask",
      "priceChoice",
    ])
  ) {
    throw new Error("Each P1 interview must contain only the documented fields.");
  }

  const participantId = value.participantId;
  if (
    typeof participantId !== "string" ||
    !/^participant-\d{3}$/u.test(participantId) ||
    participantIds.has(participantId)
  ) {
    throw new Error("Every P1 participantId must be a unique anonymous participant-NNN value.");
  }
  participantIds.add(participantId);

  if (!isCalendarDate(value.interviewedOn) || !isReference(value.evidenceReference)) {
    throw new Error("Each P1 interview needs a valid date and a bounded approved-system evidence reference.");
  }
  if (
    value.roleSegment !== "operations" &&
    value.roleSegment !== "finance" &&
    value.roleSegment !== "strategy_analysis" &&
    value.roleSegment !== "founder_office"
  ) {
    throw new Error("P1 roleSegment must be one of the four target segments.");
  }
  if (value.eligibleRecentTask !== true || typeof value.repeatsAtLeastMonthly !== "boolean") {
    throw new Error("P1 records must affirm an eligible recent task and explicitly record recurrence.");
  }
  if (
    value.activeMinutesBasis !== "measured" &&
    value.activeMinutesBasis !== "estimated" &&
    value.activeMinutesBasis !== "unknown"
  ) {
    throw new Error("activeMinutesBasis must be measured, estimated, or unknown.");
  }
  const minutesKnown = value.activeMinutesBasis !== "unknown";
  if (
    (minutesKnown && !isBoundedInteger(value.activeMinutes, 1, MAX_ACTIVE_MINUTES)) ||
    (!minutesKnown && value.activeMinutes !== null)
  ) {
    throw new Error("P1 active minutes must be bounded when known and null only when the basis is unknown.");
  }
  if (
    value.materialErrorCost !== "observed" &&
    value.materialErrorCost !== "not_observed" &&
    value.materialErrorCost !== "unknown"
  ) {
    throw new Error("materialErrorCost must be observed, not_observed, or unknown.");
  }
  if (
    value.trialMaterialStatus !== "authorized" &&
    value.trialMaterialStatus !== "redacted" &&
    value.trialMaterialStatus !== "unavailable" &&
    value.trialMaterialStatus !== "unknown"
  ) {
    throw new Error("trialMaterialStatus must explicitly describe authorization, redaction, or absence.");
  }
  if (
    value.agreesToSupervisedTask !== "yes" &&
    value.agreesToSupervisedTask !== "no" &&
    value.agreesToSupervisedTask !== "follow_up"
  ) {
    throw new Error("agreesToSupervisedTask must be yes, no, or follow_up.");
  }
  if (
    value.priceChoice !== 499 &&
    value.priceChoice !== 999 &&
    value.priceChoice !== 1999 &&
    value.priceChoice !== "none"
  ) {
    throw new Error("priceChoice must be 499, 999, 1999, or none and remains E1 evidence only.");
  }

  return value as PilotProblemInterview;
}

export function compilePilotProblemGate(value: unknown): PilotProblemReport {
  if (
    !isRecord(value) ||
    !hasExactKeys(value, ["version", "interviews"]) ||
    value.version !== 1 ||
    !Array.isArray(value.interviews) ||
    value.interviews.length !== PILOT_PROBLEM_GATE_THRESHOLDS.eligibleInterviews
  ) {
    throw new Error(
      `P1 input requires version 1 and exactly ${PILOT_PROBLEM_GATE_THRESHOLDS.eligibleInterviews} interviews.`,
    );
  }

  const participantIds = new Set<string>();
  const interviews = value.interviews.map((interview) => parseInterview(interview, participantIds));
  const monthlyRepeaters = interviews.filter((interview) => interview.repeatsAtLeastMonthly).length;
  const highCostOrError = interviews.filter(
    (interview) =>
      (interview.activeMinutes !== null && interview.activeMinutes > 120) || interview.materialErrorCost === "observed",
  ).length;
  const supervisedTaskAgreements = interviews.filter((interview) => interview.agreesToSupervisedTask === "yes").length;
  const availableSourceSets = interviews.filter(
    (interview) => interview.trialMaterialStatus === "authorized" || interview.trialMaterialStatus === "redacted",
  ).length;
  const gates = {
    sample: interviews.length === PILOT_PROBLEM_GATE_THRESHOLDS.eligibleInterviews,
    recurrence: monthlyRepeaters >= PILOT_PROBLEM_GATE_THRESHOLDS.monthlyRepeaters,
    pain: highCostOrError >= PILOT_PROBLEM_GATE_THRESHOLDS.highCostOrError,
    trialAgreement: supervisedTaskAgreements >= PILOT_PROBLEM_GATE_THRESHOLDS.supervisedTaskAgreements,
    sourceAvailability: availableSourceSets >= PILOT_PROBLEM_GATE_THRESHOLDS.availableSourceSets,
    passed: false,
  };
  gates.passed = gates.sample && gates.recurrence && gates.pain && gates.trialAgreement && gates.sourceAvailability;

  return {
    version: 1,
    eligibleInterviews: interviews.length,
    monthlyRepeaters,
    highCostOrError,
    supervisedTaskAgreements,
    availableSourceSets,
    unknownActiveMinutes: interviews.filter((interview) => interview.activeMinutesBasis === "unknown").length,
    unknownErrorCosts: interviews.filter((interview) => interview.materialErrorCost === "unknown").length,
    unknownSourceSets: interviews.filter((interview) => interview.trialMaterialStatus === "unknown").length,
    priceChoices: {
      499: interviews.filter((interview) => interview.priceChoice === 499).length,
      999: interviews.filter((interview) => interview.priceChoice === 999).length,
      1999: interviews.filter((interview) => interview.priceChoice === 1999).length,
      none: interviews.filter((interview) => interview.priceChoice === "none").length,
    },
    gates,
  };
}

function mark(value: boolean) {
  return value ? "PASS" : "OPEN";
}

export function renderPilotProblemGateMarkdown(report: PilotProblemReport) {
  return `# Rune P1 problem gate

> ${report.gates.passed ? "PASS" : "OPEN"}. This report summarizes asserted, externally evidenced interviews. Synthetic personas and missing interviews never count.

| Measure | Result | Gate | Status |
| --- | ---: | ---: | --- |
| Eligible recent-task interviews | ${report.eligibleInterviews} | ${PILOT_PROBLEM_GATE_THRESHOLDS.eligibleInterviews} | ${mark(report.gates.sample)} |
| Repeat at least monthly | ${report.monthlyRepeaters} | ≥ ${PILOT_PROBLEM_GATE_THRESHOLDS.monthlyRepeaters} | ${mark(report.gates.recurrence)} |
| More than 120 active minutes or material error cost | ${report.highCostOrError} | ≥ ${PILOT_PROBLEM_GATE_THRESHOLDS.highCostOrError} | ${mark(report.gates.pain)} |
| Agree to a supervised real task | ${report.supervisedTaskAgreements} | ≥ ${PILOT_PROBLEM_GATE_THRESHOLDS.supervisedTaskAgreements} | ${mark(report.gates.trialAgreement)} |
| Authorized or redacted source sets | ${report.availableSourceSets} | ≥ ${PILOT_PROBLEM_GATE_THRESHOLDS.availableSourceSets} | ${mark(report.gates.sourceAvailability)} |

Unknown active time: ${report.unknownActiveMinutes}. Unknown error cost: ${report.unknownErrorCosts}. Unknown source availability: ${report.unknownSourceSets}.

Price preference (E1 only, never payment): ¥499 ${report.priceChoices[499]}, ¥999 ${report.priceChoices[999]}, ¥1,999 ${report.priceChoices[1999]}, none ${report.priceChoices.none}.
`;
}
