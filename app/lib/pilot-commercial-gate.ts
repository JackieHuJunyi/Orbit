export const PILOT_COMMERCIAL_GATE_THRESHOLDS = {
  explicitQuotes: 10,
  payingTeams: 5,
  qualifiedConversionPercent: 30,
  paidContinuationTeams: 1,
  repeatableAcquisitionChannels: 1,
} as const;

const MAX_PILOTS = 100;
const MAX_CNY_FEN = 1_000_000_000;

type Offer = 499 | 999 | 1999;
type SelectedOffer = Offer | "none";
type CommercialStatus = "not_paid" | "signed_commitment" | "cleared" | "refunded";
type ContinuationStatus = "renewed_paid" | "requested_paid" | "none" | "stopped";

export type PilotCommercialRecord = {
  teamId: string;
  quotedOn: string;
  evidenceReference: string;
  qualified: true;
  offersPresented: [499, 999, 1999];
  selectedOffer: SelectedOffer;
  commercialStatus: CommercialStatus;
  contractedRevenueCnyFen: number;
  recognizedRevenueCnyFen: number;
  refundedRevenueCnyFen: number;
  providerCostCnyFen: number;
  infrastructureCostCnyFen: number;
  supportCostCnyFen: number;
  paymentCostCnyFen: number;
  otherVariableCostCnyFen: number;
  costsComplete: true;
  continuationStatus: ContinuationStatus;
  acquisitionChannel: string;
  acquisitionEvidenceReference: string | null;
};

export type PilotCommercialReport = {
  version: 1;
  decisionOn: string;
  qualifiedPilots: number;
  explicitQuotes: number;
  payingTeams: number;
  qualifiedConversionPercent: number;
  paidContinuationTeams: number;
  repeatableAcquisitionChannels: number;
  contractedRevenueCnyFen: number;
  recognizedRevenueCnyFen: number;
  refundedRevenueCnyFen: number;
  netRevenueCnyFen: number;
  variableCostCnyFen: number;
  contributionCnyFen: number;
  offerSelections: {
    499: number;
    999: number;
    1999: number;
    none: number;
  };
  commercialStatuses: {
    notPaid: number;
    signedCommitment: number;
    cleared: number;
    refunded: number;
  };
  gates: {
    quotes: boolean;
    payment: boolean;
    conversion: boolean;
    continuation: boolean;
    unitEconomics: boolean;
    acquisition: boolean;
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

function isMoney(value: unknown): value is number {
  return Number.isSafeInteger(value) && Number(value) >= 0 && Number(value) <= MAX_CNY_FEN;
}

function hasFixedOffers(value: unknown): value is [499, 999, 1999] {
  return Array.isArray(value) && value.length === 3 && value[0] === 499 && value[1] === 999 && value[2] === 1999;
}

function parseCommercialRecord(value: unknown, teamIds: Set<string>, decisionOn: string): PilotCommercialRecord {
  if (
    !isRecord(value) ||
    !hasExactKeys(value, [
      "teamId",
      "quotedOn",
      "evidenceReference",
      "qualified",
      "offersPresented",
      "selectedOffer",
      "commercialStatus",
      "contractedRevenueCnyFen",
      "recognizedRevenueCnyFen",
      "refundedRevenueCnyFen",
      "providerCostCnyFen",
      "infrastructureCostCnyFen",
      "supportCostCnyFen",
      "paymentCostCnyFen",
      "otherVariableCostCnyFen",
      "costsComplete",
      "continuationStatus",
      "acquisitionChannel",
      "acquisitionEvidenceReference",
    ])
  ) {
    throw new Error("Each P4 commercial record must contain only the documented fields.");
  }

  const teamId = value.teamId;
  if (typeof teamId !== "string" || !/^team-\d{3}$/u.test(teamId) || teamIds.has(teamId)) {
    throw new Error("Every P4 teamId must be a unique anonymous team-NNN value.");
  }
  teamIds.add(teamId);
  if (!isCalendarDate(value.quotedOn) || value.quotedOn > decisionOn || !isReference(value.evidenceReference)) {
    throw new Error("Each P4 quote needs a valid on-or-before decision date and approved-system evidence reference.");
  }
  if (value.qualified !== true || !hasFixedOffers(value.offersPresented)) {
    throw new Error("Every P4 denominator row must be qualified and receive the fixed 499, 999, and 1999 offers.");
  }
  if (
    value.selectedOffer !== 499 &&
    value.selectedOffer !== 999 &&
    value.selectedOffer !== 1999 &&
    value.selectedOffer !== "none"
  ) {
    throw new Error("selectedOffer must be 499, 999, 1999, or none.");
  }
  if (
    value.commercialStatus !== "not_paid" &&
    value.commercialStatus !== "signed_commitment" &&
    value.commercialStatus !== "cleared" &&
    value.commercialStatus !== "refunded"
  ) {
    throw new Error("commercialStatus must distinguish no payment, commitment, cleared funds, and refund.");
  }
  const moneyFields = [
    value.contractedRevenueCnyFen,
    value.recognizedRevenueCnyFen,
    value.refundedRevenueCnyFen,
    value.providerCostCnyFen,
    value.infrastructureCostCnyFen,
    value.supportCostCnyFen,
    value.paymentCostCnyFen,
    value.otherVariableCostCnyFen,
  ];
  if (!moneyFields.every(isMoney) || value.costsComplete !== true) {
    throw new Error("P4 revenue and complete variable-cost fields must be non-negative integer CNY fen.");
  }
  const contracted = Number(value.contractedRevenueCnyFen);
  const recognized = Number(value.recognizedRevenueCnyFen);
  const refunded = Number(value.refundedRevenueCnyFen);
  const selected = value.selectedOffer;
  const status = value.commercialStatus;
  const validCommercialState =
    (status === "not_paid" && contracted === 0 && recognized === 0 && refunded === 0) ||
    (status === "signed_commitment" && selected !== "none" && contracted > 0 && recognized === 0 && refunded === 0) ||
    (status === "cleared" && selected !== "none" && contracted > 0 && recognized > 0 && refunded < recognized) ||
    (status === "refunded" && selected !== "none" && contracted > 0 && recognized > 0 && refunded === recognized);
  if (!validCommercialState || recognized > contracted || refunded > recognized) {
    throw new Error(
      "P4 commercial status must agree with selected offer, contracted revenue, cleared revenue, and refunds.",
    );
  }
  if (
    value.continuationStatus !== "renewed_paid" &&
    value.continuationStatus !== "requested_paid" &&
    value.continuationStatus !== "none" &&
    value.continuationStatus !== "stopped"
  ) {
    throw new Error("continuationStatus must explicitly record paid continuation, absence, or stop.");
  }
  if (
    (value.continuationStatus === "renewed_paid" || value.continuationStatus === "requested_paid") &&
    status !== "cleared" &&
    status !== "signed_commitment"
  ) {
    throw new Error("Paid continuation can be credited only to a cleared or signed commercial record.");
  }
  if (
    typeof value.acquisitionChannel !== "string" ||
    !/^[a-z0-9][a-z0-9_-]{1,39}$/u.test(value.acquisitionChannel) ||
    (value.acquisitionEvidenceReference !== null && !isReference(value.acquisitionEvidenceReference))
  ) {
    throw new Error("P4 acquisition needs a bounded category and an optional approved evidence reference.");
  }

  return value as PilotCommercialRecord;
}

function roundRate(value: number) {
  return Math.round(value * 10) / 10;
}

function isPaying(record: PilotCommercialRecord) {
  return record.commercialStatus === "cleared" || record.commercialStatus === "signed_commitment";
}

export function compilePilotCommercialGate(value: unknown): PilotCommercialReport {
  if (
    !isRecord(value) ||
    !hasExactKeys(value, ["version", "decisionOn", "pilots"]) ||
    value.version !== 1 ||
    !isCalendarDate(value.decisionOn) ||
    !Array.isArray(value.pilots) ||
    value.pilots.length < 1 ||
    value.pilots.length > MAX_PILOTS
  ) {
    throw new Error(`P4 input requires version 1, a decision date, and 1–${MAX_PILOTS} qualified pilots.`);
  }

  const teamIds = new Set<string>();
  const records = value.pilots.map((record) => parseCommercialRecord(record, teamIds, value.decisionOn as string));
  const payingTeams = records.filter(isPaying).length;
  const qualifiedConversionPercent = roundRate((payingTeams / records.length) * 100);
  const paidContinuationTeams = records.filter(
    (record) =>
      isPaying(record) &&
      (record.continuationStatus === "renewed_paid" || record.continuationStatus === "requested_paid"),
  ).length;
  const channelRecords = new Map<string, PilotCommercialRecord[]>();
  for (const record of records) {
    const channel = channelRecords.get(record.acquisitionChannel) ?? [];
    channel.push(record);
    channelRecords.set(record.acquisitionChannel, channel);
  }
  const repeatableAcquisitionChannels = [...channelRecords.values()].filter(
    (channel) => channel.length >= 2 && channel.every((record) => record.acquisitionEvidenceReference !== null),
  ).length;
  const contractedRevenueCnyFen = records.reduce((total, record) => total + record.contractedRevenueCnyFen, 0);
  const recognizedRevenueCnyFen = records.reduce((total, record) => total + record.recognizedRevenueCnyFen, 0);
  const refundedRevenueCnyFen = records.reduce((total, record) => total + record.refundedRevenueCnyFen, 0);
  const netRevenueCnyFen = recognizedRevenueCnyFen - refundedRevenueCnyFen;
  const variableCostCnyFen = records.reduce(
    (total, record) =>
      total +
      record.providerCostCnyFen +
      record.infrastructureCostCnyFen +
      record.supportCostCnyFen +
      record.paymentCostCnyFen +
      record.otherVariableCostCnyFen,
    0,
  );
  const contributionCnyFen = netRevenueCnyFen - variableCostCnyFen;
  const gates = {
    quotes: records.length >= PILOT_COMMERCIAL_GATE_THRESHOLDS.explicitQuotes,
    payment: payingTeams >= PILOT_COMMERCIAL_GATE_THRESHOLDS.payingTeams,
    conversion: qualifiedConversionPercent >= PILOT_COMMERCIAL_GATE_THRESHOLDS.qualifiedConversionPercent,
    continuation: paidContinuationTeams >= PILOT_COMMERCIAL_GATE_THRESHOLDS.paidContinuationTeams,
    unitEconomics: netRevenueCnyFen > 0 && contributionCnyFen >= 0,
    acquisition: repeatableAcquisitionChannels >= PILOT_COMMERCIAL_GATE_THRESHOLDS.repeatableAcquisitionChannels,
    passed: false,
  };
  gates.passed =
    gates.quotes && gates.payment && gates.conversion && gates.continuation && gates.unitEconomics && gates.acquisition;

  return {
    version: 1,
    decisionOn: value.decisionOn as string,
    qualifiedPilots: records.length,
    explicitQuotes: records.length,
    payingTeams,
    qualifiedConversionPercent,
    paidContinuationTeams,
    repeatableAcquisitionChannels,
    contractedRevenueCnyFen,
    recognizedRevenueCnyFen,
    refundedRevenueCnyFen,
    netRevenueCnyFen,
    variableCostCnyFen,
    contributionCnyFen,
    offerSelections: {
      499: records.filter((record) => record.selectedOffer === 499).length,
      999: records.filter((record) => record.selectedOffer === 999).length,
      1999: records.filter((record) => record.selectedOffer === 1999).length,
      none: records.filter((record) => record.selectedOffer === "none").length,
    },
    commercialStatuses: {
      notPaid: records.filter((record) => record.commercialStatus === "not_paid").length,
      signedCommitment: records.filter((record) => record.commercialStatus === "signed_commitment").length,
      cleared: records.filter((record) => record.commercialStatus === "cleared").length,
      refunded: records.filter((record) => record.commercialStatus === "refunded").length,
    },
    gates,
  };
}

function mark(value: boolean) {
  return value ? "PASS" : "OPEN";
}

function formatCny(fen: number) {
  return `¥${(fen / 100).toFixed(2)}`;
}

export function renderPilotCommercialGateMarkdown(report: PilotCommercialReport) {
  return `# Orbit P4 commercial gate

> ${report.gates.passed ? "PASS" : "OPEN"} on ${report.decisionOn}. This aggregate must be reconciled against the approved commercial system. Preferences, checkout clicks, draft invoices, and refunded teams are not payment.

| Measure | Result | Gate | Status |
| --- | ---: | ---: | --- |
| Explicit quotes to qualified pilots | ${report.explicitQuotes} | ≥ ${PILOT_COMMERCIAL_GATE_THRESHOLDS.explicitQuotes} | ${mark(report.gates.quotes)} |
| Paying teams | ${report.payingTeams} | ≥ ${PILOT_COMMERCIAL_GATE_THRESHOLDS.payingTeams} | ${mark(report.gates.payment)} |
| Qualified-pilot conversion | ${report.qualifiedConversionPercent}% | ≥ ${PILOT_COMMERCIAL_GATE_THRESHOLDS.qualifiedConversionPercent}% | ${mark(report.gates.conversion)} |
| Paid continuation teams | ${report.paidContinuationTeams} | ≥ ${PILOT_COMMERCIAL_GATE_THRESHOLDS.paidContinuationTeams} | ${mark(report.gates.continuation)} |
| Net revenue / variable cost / contribution | ${formatCny(report.netRevenueCnyFen)} / ${formatCny(report.variableCostCnyFen)} / ${formatCny(report.contributionCnyFen)} | positive revenue and contribution ≥ ¥0.00 | ${mark(report.gates.unitEconomics)} |
| Repeatable evidenced acquisition channels | ${report.repeatableAcquisitionChannels} | ≥ ${PILOT_COMMERCIAL_GATE_THRESHOLDS.repeatableAcquisitionChannels} | ${mark(report.gates.acquisition)} |

Status counts — cleared: ${report.commercialStatuses.cleared}; signed commitment: ${report.commercialStatuses.signedCommitment}; not paid: ${report.commercialStatuses.notPaid}; refunded: ${report.commercialStatuses.refunded}.

Offer selections — ¥499: ${report.offerSelections[499]}; ¥999: ${report.offerSelections[999]}; ¥1,999: ${report.offerSelections[1999]}; none: ${report.offerSelections.none}.
`;
}
