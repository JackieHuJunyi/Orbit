import assert from "node:assert/strict";
import test from "node:test";

import { compilePilotCommercialGate, renderPilotCommercialGateMarkdown } from "../app/lib/pilot-commercial-gate.ts";

function pilot(index, overrides = {}) {
  return {
    teamId: `team-${String(index + 1).padStart(3, "0")}`,
    quotedOn: "2026-08-01",
    evidenceReference: `commercial-system/quote-${index + 1}`,
    qualified: true,
    offersPresented: [499, 999, 1999],
    selectedOffer: "none",
    commercialStatus: "not_paid",
    contractedRevenueCnyFen: 0,
    recognizedRevenueCnyFen: 0,
    refundedRevenueCnyFen: 0,
    providerCostCnyFen: 2_000,
    infrastructureCostCnyFen: 1_000,
    supportCostCnyFen: 4_000,
    paymentCostCnyFen: 0,
    otherVariableCostCnyFen: 0,
    costsComplete: true,
    continuationStatus: "none",
    acquisitionChannel: index < 2 ? "partner" : `channel_${index}`,
    acquisitionEvidenceReference: index < 2 ? `commercial-system/acquisition-${index + 1}` : null,
    ...overrides,
  };
}

test("passes P4 only with quotes, real commercial proof, continuation, contribution, and acquisition", () => {
  const pilots = Array.from({ length: 10 }, (_, index) => {
    if (index < 4) {
      return pilot(index, {
        selectedOffer: 999,
        commercialStatus: "cleared",
        contractedRevenueCnyFen: 99_900,
        recognizedRevenueCnyFen: 99_900,
        paymentCostCnyFen: 3_000,
        continuationStatus: index === 0 ? "requested_paid" : "none",
      });
    }
    if (index === 4) {
      return pilot(index, {
        selectedOffer: 999,
        commercialStatus: "signed_commitment",
        contractedRevenueCnyFen: 99_900,
      });
    }
    return pilot(index);
  });

  const report = compilePilotCommercialGate({ version: 1, decisionOn: "2026-08-19", pilots });

  assert.equal(report.qualifiedPilots, 10);
  assert.equal(report.explicitQuotes, 10);
  assert.equal(report.payingTeams, 5);
  assert.equal(report.qualifiedConversionPercent, 50);
  assert.equal(report.paidContinuationTeams, 1);
  assert.equal(report.repeatableAcquisitionChannels, 1);
  assert.equal(report.netRevenueCnyFen, 399_600);
  assert.equal(report.variableCostCnyFen, 82_000);
  assert.equal(report.contributionCnyFen, 317_600);
  assert.deepEqual(report.gates, {
    quotes: true,
    payment: true,
    conversion: true,
    continuation: true,
    unitEconomics: true,
    acquisition: true,
    passed: true,
  });
});

test("does not count refunds, preferences, or incomplete economics as demand", () => {
  const pilots = Array.from({ length: 9 }, (_, index) =>
    pilot(index, {
      selectedOffer: index < 2 ? 499 : "none",
      commercialStatus: index < 2 ? "refunded" : "not_paid",
      contractedRevenueCnyFen: index < 2 ? 49_900 : 0,
      recognizedRevenueCnyFen: index < 2 ? 49_900 : 0,
      refundedRevenueCnyFen: index < 2 ? 49_900 : 0,
      acquisitionEvidenceReference: null,
    }),
  );

  const report = compilePilotCommercialGate({ version: 1, decisionOn: "2026-08-19", pilots });

  assert.equal(report.payingTeams, 0);
  assert.equal(report.netRevenueCnyFen, 0);
  assert.equal(report.gates.passed, false);
  assert.deepEqual(report.gates, {
    quotes: false,
    payment: false,
    conversion: false,
    continuation: false,
    unitEconomics: false,
    acquisition: false,
    passed: false,
  });
});

test("rejects denominator drift, invalid commercial states, and unsupported continuation claims", () => {
  assert.throws(
    () =>
      compilePilotCommercialGate({
        version: 1,
        decisionOn: "2026-08-19",
        pilots: [pilot(0, { qualified: false })],
      }),
    /denominator row must be qualified/i,
  );
  assert.throws(
    () =>
      compilePilotCommercialGate({
        version: 1,
        decisionOn: "2026-08-19",
        pilots: [pilot(0, { offersPresented: [999] })],
      }),
    /fixed 499, 999, and 1999 offers/i,
  );
  assert.throws(
    () =>
      compilePilotCommercialGate({
        version: 1,
        decisionOn: "2026-08-19",
        pilots: [
          pilot(0, {
            selectedOffer: 999,
            commercialStatus: "cleared",
            contractedRevenueCnyFen: 99_900,
            recognizedRevenueCnyFen: 99_900,
            refundedRevenueCnyFen: 99_900,
          }),
        ],
      }),
    /commercial status must agree/i,
  );
  assert.throws(
    () =>
      compilePilotCommercialGate({
        version: 1,
        decisionOn: "2026-08-19",
        pilots: [pilot(0, { continuationStatus: "renewed_paid" })],
      }),
    /Paid continuation can be credited only/i,
  );
  assert.throws(
    () =>
      compilePilotCommercialGate({
        version: 1,
        decisionOn: "2026-08-19",
        pilots: [pilot(0, { quotedOn: "2026-08-20" })],
      }),
    /on-or-before decision date/i,
  );
});

test("renders aggregate commercial evidence without team, reference, or channel identifiers", () => {
  const report = compilePilotCommercialGate({ version: 1, decisionOn: "2026-08-19", pilots: [pilot(0)] });
  const markdown = renderPilotCommercialGateMarkdown(report);

  assert.match(markdown, /Preferences, checkout clicks, draft invoices, and refunded teams are not payment/i);
  assert.doesNotMatch(markdown, /team-001/);
  assert.doesNotMatch(markdown, /quote-1/);
  assert.doesNotMatch(markdown, /partner/);
});
