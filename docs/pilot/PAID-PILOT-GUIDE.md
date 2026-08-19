# Rune P4 paid-pilot guide

> This protocol operationalizes a real commercial test. A price preference is E1 evidence. Only an authorized payment or signed commercial commitment in the approved commercial system counts as E4.

## Entry and buyer

Make an offer only after the team has a qualified recurring operating-review task, a buyer or budget owner, an authorized/redacted data path, and a supervised Rune result that the team judged usable or fixable. Do not count friends, employees, grants, investor support, coupons with no consideration, or a research honorarium as customer payment.

Before quoting, identify separately:

- the task owner who performs or reviews the work;
- the buyer who can authorize the spend;
- the exact four-week outcome and data boundary;
- support and token-budget limits;
- refund/extension authority and invoice/contract owner.

## Fixed first-round offers

Present the three real choices without inventing a personalized hidden price:

| Offer |             Price | Included outcome                                                          | Constraint being tested     |
| ----- | ----------------: | ------------------------------------------------------------------------- | --------------------------- |
| A     |   ¥499/team/month | BYOK, bounded templates, no high-touch support                            | Low-service product         |
| B     |   ¥999/team/month | Four operating-review tasks, included bounded token budget, basic support | Default paid pilot          |
| C     | ¥1,999/team/month | Higher bounded budget, workflow configuration, priority support           | Reliability/service premium |

State that this is a four-week price experiment, not a permanent production price. No offer includes unlimited tokens or unbounded implementation work. If Rune cannot complete the agreed core outcome, apply the disclosed extension or refund policy rather than redefining success after the sale.

## Offer and evidence procedure

1. Assign a qualified-pilot alias in the approved commercial system; keep names, contacts, company, invoices, contracts, and payment details out of this repository and `pilot-private/`.
2. Record all three offers shown, the buyer's choice or refusal, date, currency, tax treatment, promised outcome, support boundary, and acquisition source.
3. Count one **explicit quote** only when a buyer sees a concrete price and terms. Count one **qualified pilot** in the conversion denominator once the entry conditions above are met and a real offer is delivered.
4. Count one **paying team** only after cleared non-refunded funds exist, or after an authorized signed commercial commitment with price and payment terms exists. A forced choice, verbal intent, checkout click, draft invoice, unsigned order, or free extension is not E4.
5. Record direct revenue and refund separately. Allocate provider/token, infrastructure, human support, payment, and other variable costs to the same four-week window.
6. At the end, record whether the team completed the promised tasks, reused Rune on another date, requested continuation, renewed, refunded, or stopped—and the buyer's reason.
7. Have a second authorized reviewer reconcile the commercial summary against the source system before a P4 decision is reported.

Do not implement or simulate payments inside Rune for this experiment. Use an organization-approved invoicing, contract, or payment system with its normal security, tax, refund, and access controls.

## Decision record

Keep row-level records in the approved commercial system. A reviewed aggregate may use these fields:

```text
Decision date:
Qualified pilots offered:
Explicit quotes delivered:
Offer A / B / C selections:
Paying teams (cleared payment or signed commitment):
Refunded teams:
Teams requesting continuation or renewing:
Recognized pilot revenue:
Provider/token cost:
Infrastructure cost:
Human support cost:
Payment cost:
Other variable cost:
Repeatable acquisition channels with source evidence:
Reviewer and source-system reconciliation reference:
```

Calculate qualified conversion as `paying teams / qualified pilots offered`; do not use only respondents or selected-plan users as the denominator. Calculate contribution as recognized non-refunded revenue minus all allocated variable costs. Report team counts, not individual payments split into several transactions.

## Private deterministic gate

At the locked decision date, export every qualified pilot that received a concrete quote on or before that date into `pilot-private/p4-commercial.json`. Omitting refusals changes the denominator and invalidates the result. Keep the row-level source of truth in the approved commercial system; the private file contains aliases, bounded money in integer CNY fen, and source references only.

```json
{
  "version": 1,
  "decisionOn": "2026-08-19",
  "pilots": [
    {
      "teamId": "team-001",
      "quotedOn": "2026-08-01",
      "evidenceReference": "commercial-system/reference-not-a-name",
      "qualified": true,
      "offersPresented": [499, 999, 1999],
      "selectedOffer": 999,
      "commercialStatus": "cleared",
      "contractedRevenueCnyFen": 99900,
      "recognizedRevenueCnyFen": 99900,
      "refundedRevenueCnyFen": 0,
      "providerCostCnyFen": 8000,
      "infrastructureCostCnyFen": 1000,
      "supportCostCnyFen": 12000,
      "paymentCostCnyFen": 3000,
      "otherVariableCostCnyFen": 0,
      "costsComplete": true,
      "continuationStatus": "requested_paid",
      "acquisitionChannel": "partner",
      "acquisitionEvidenceReference": "commercial-system/channel-reference"
    }
  ]
}
```

The example is schema documentation, not payment evidence or a complete passing cohort. `signed_commitment` requires a selected offer and positive contracted amount; `cleared` requires positive recognized revenue remaining after refunds; `refunded` never counts as a paying team; `not_paid` requires zero contracted, recognized, and refunded revenue. A paid continuation belongs only to a cleared or signed record.

Run:

```bash
npm run pilot:commercial -- pilot-private/p4-commercial.json
```

The command rejects extra fields, duplicate teams, post-decision quotes, altered offer sets, inconsistent payment/refund states, incomplete cost allocation, and unsupported continuation claims. A repeatable acquisition channel requires at least two qualified rows in the same bounded channel category, each with an approved-system acquisition reference. Output contains aggregate counts and money only—never team, evidence, or channel identifiers.

## Fixed P4 decision

P4 passes only when all conditions hold together:

- at least 10 explicit quotes;
- at least 5 paying teams;
- at least 30% conversion among all qualified pilots offered;
- at least one team renews or actively requests paid continuation;
- allocated contribution is non-negative and the price covers the observed result cost;
- at least one acquisition source demonstrates a repeatable path to another qualified team.

Report refusals, refunds, discounts, support intensity, and missing cost allocation. If there is use without payment, revisit value strength, buyer, budget, and positioning. If there is payment without reuse, treat the result as possible services revenue rather than software PMF. P5 does not begin until P1–P4 all pass.
