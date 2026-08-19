# Rune P2 paired-task comparison guide

> Use this protocol for at least 10 authorized or redacted real tasks. Automated tests, demos, synthetic data, and staff-authored scores never count toward P2.

## Comparison unit

One comparison is the same participant completing the same decision task from the same bounded input scope twice:

- **A — current workflow:** the participant's normal tools and handoffs;
- **B — Rune workflow:** reviewed import, exact mapping, proposal, Apply, verification, and real-format handoff.

Use the participant's most recently completed task when repeating A would be wasteful. Mark that manual timing as `estimated`, preserve the stage-by-stage basis in the approved research system, and report the estimated count. Do not silently combine a remembered broad monthly process with a narrowly scoped Rune run.

A record is comparable only when all three statements are true: the material is authorized or redacted, A and B use the same source scope, and A and B serve the same decision goal. Do not tune B against A's finished narrative, reuse an answer the participant could not have known at the original task time, or let the research team perform the participant's critical steps.

## Session procedure

1. Freeze the exact input scope and decision question before timing either path.
2. For A, start when all frozen inputs are available and stop when the normal handoff is ready. Record active minutes separately from waiting time; only active minutes enter the gate.
3. Reset to the frozen inputs. For B, start before Rune import/setup and stop after the participant obtains the real handoff file. Rune's bounded duration is supporting evidence; the supervised stopwatch owns the paired boundary.
4. Count a delivery as `ready`, `minor_edits`, or `not_usable` using the recipient/reviewer's judgment, not the researcher's taste.
5. Count every generated key number in the handed-off result and verify whether each resolves to current Data/Query evidence. One untraceable generated key number fails the 100% traceability gate.
6. Mark `applied` only if the participant reviewed and applied at least one Rune proposal in the task. Preview-only demonstrations do not count.
7. Record every safety redline: unauthorized data movement, an unreviewed write, an unrecoverable overwrite, or a materially incorrect key number presented as verified.
8. Keep tool switches, manual copies, help requests, rejected proposals and reasons, final correction effort, and willingness to retry in the approved research record. These diagnose the result but do not replace the fixed P2 gate.
9. Export and review the participant's final Rune evidence package according to the main runbook. Store the comparison's approved-system reference, not names, notes, files, or content, in the local gate input.

Counterbalance A/B order when a genuine fresh equivalent cycle exists. Otherwise use the already completed A path and run B second, then explicitly retain `manualTiming: "estimated"`; never describe that design as a randomized experiment.

## Private gate input

Create `pilot-private/p2-comparisons.json`. It is Git-ignored and contains aliases and bounded measurements only:

```json
{
  "version": 1,
  "comparisons": [
    {
      "participantId": "participant-001",
      "taskId": "task-001",
      "recordedOn": "2026-08-19",
      "evidenceReference": "approved-system/reference-not-a-name",
      "manualMinutes": 120,
      "runeMinutes": 48,
      "manualTiming": "measured",
      "authorizedOrRedacted": true,
      "sameScope": true,
      "sameDecision": true,
      "deliveryOutcome": "minor_edits",
      "keyNumbersGenerated": 8,
      "keyNumbersTraceable": 8,
      "applied": true,
      "safetyRedlines": 0
    }
  ]
}
```

The example is schema documentation, not participant evidence. Never copy it into a decision record as if it happened.

Run the deterministic aggregate:

```bash
npm run pilot:outcomes -- pilot-private/p2-comparisons.json
```

The command rejects extra fields, duplicate task aliases, invalid dates, non-whole-minute timing, zero generated key numbers, over-counted traceability, and any record that does not affirm authorization/redaction, equal scope, and equal decision goal. Its Markdown output is aggregate-only and does not print participant, task, or evidence references.

## Fixed P2 decision

P2 passes only when all conditions hold together:

- at least 10 comparable paired tasks;
- median of the per-task active-time reductions is at least 50%;
- at least 70% of tasks end `ready` or `minor_edits`;
- 100% of generated key numbers in handed-off results are traceable;
- at least 60% of tasks include a reviewed Apply;
- zero safety redlines.

Negative time reductions remain negative; do not clamp them to zero. Do not remove slow, failed, estimated, or unsupported tasks after observing the result. Fix the highest-frequency blocker or revisit the target task if the gate fails twice.
