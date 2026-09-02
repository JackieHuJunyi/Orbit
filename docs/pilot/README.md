# Orbit real-pilot runbook

> Current verified-human baseline: **0 / 20 pilot-eligible tasks**. Orbit's synthetic Golden Tasks remain E1 regression evidence and never enter this workflow.

This runbook turns authorized or redacted real work into a privacy-minimized cohort baseline. It is a research process, not telemetry: every participant explicitly reviews and downloads one device-local evidence package, and the researcher aggregates packages locally. Orbit does not upload content, outcomes, identities, or reports.

## Who and what to recruit

Recruit operations, finance, strategy/business analysis, or founder-office owners in 10–200 person teams who already produce a weekly or monthly operating review. The first study should obtain:

- 15 problem interviews about the most recent completed task;
- at least 10 timestamped before/Orbit task timelines;
- at least 5 authorized or redacted source sets;
- at least 7 people willing to try a real task;
- 20 fully scored real tasks before calling the pilot threshold met.

Do not recruit one-off presentation generators, macro-heavy financial model owners, pixel-perfect Office migration projects, or anyone who needs unattended external publishing. Those are outside the current product contract.

Use the [P1 interview guide](INTERVIEW-GUIDE.md) for the screener, 45-minute recent-task interview, timeline fields, and deterministic gate calculation. Store completed interview records in the approved research system, not this repository or `pilot-private/`.

Use the [P2 paired-task comparison guide](TASK-COMPARISON-GUIDE.md) for exact A/B boundaries and the deterministic outcome-gate command. Use the [P4 paid-pilot guide](PAID-PILOT-GUIDE.md) and its commercial-gate command only after a qualified task and buyer exist; commercial source records remain outside Orbit.

## Consent and data boundary

Before using a file, record consent outside the Orbit repository and confirm one of these is true:

1. the participant is authorized to use the task for product evaluation; or
2. the material has been redacted so it contains no protected or identifying content.

Orbit's detailed seven-dimension review repeats this assertion. Never infer permission from a file type, successful import, model configuration, employer, or quick delivery rating. Keep any real-name ↔ `participant-NNN` mapping in the approved research system, never in the manifest, Git, Orbit source, or a cohort report.

## Per-participant session

1. Capture the participant's last manual workflow: inputs, tools, handoffs, elapsed time, rework, and last number/version error.
2. Start with the same authorized/redacted task in Orbit. Record start and finish outside the product only if the study needs a comparable manual baseline; Orbit already records bounded task duration.
3. Complete Operating Review or Document-to-Presentation through reviewed import, exact mapping, proposal, Apply, and real handoff.
4. After download or folder Push, record the quick outcome. Expand the detailed evaluation only when the reviewer can complete all seven scores and affirm authorization/redaction.
5. For recurrence evidence, repeat a genuinely new cycle on a different calendar date within 28 days. Same-day retries do not count as recurring use.
6. At the end of that participant's study window, choose **More Tools → Export pilot evidence**, review the inclusion/exclusion boundary, acknowledge the candidate-evidence warning, and download exactly one final JSON package.

If a participant exports again, replace their earlier final file. Do not add a second manifest row. Orbit intentionally emits no stable cross-export person or run identifier, so incremental packages cannot be safely merged without double counting.

## Private directory and manifest

Use the Git-ignored `pilot-private/` directory:

```text
pilot-private/
  manifest.json
  evidence/
    participant-001.json
    participant-002.json
  reports/
```

`manifest.json` contains aliases and relative files only:

```json
{
  "version": 1,
  "participants": [
    { "participantId": "participant-001", "evidenceFile": "evidence/participant-001.json" },
    { "participantId": "participant-002", "evidenceFile": "evidence/participant-002.json" }
  ]
}
```

Do not add names, emails, companies, interview notes, source files, deliverables, or consent records to this directory or manifest.

## Validate and aggregate

Preview a Markdown report without writing:

```bash
npm run pilot:aggregate -- pilot-private/manifest.json
```

Write a new JSON aggregate and Markdown report with user-only file permissions:

```bash
npm run pilot:aggregate -- pilot-private/manifest.json pilot-private/reports
```

The command refuses invalid metadata/provenance, altered summaries, unknown fields, broken run/output links, invalid dates or ordering, incomplete rubrics, files above 128 KB, duplicate aliases, duplicate paths, symlinks, path escape, duplicate package content, and existing report filenames. It recomputes every summary instead of trusting claimed totals. Output includes no participant alias or per-run/per-output record.

## Read the evidence honestly

The cohort report answers only what its packages can support:

- technical Apply rate and average run duration;
- delivery usability rate and average end-to-end duration;
- model-run/token totals when providers returned usage;
- complete human-evaluated deliverables and unique reviewed tasks;
- pilot-eligible tasks, with every number-correctness score below 4 visible;
- seven weighted dimension averages;
- evaluated participants with a second fully reviewed task on another date within 28 days;
- Operating Review versus Document-to-Presentation mix.

It does not prove demand, causal time savings, four-week retention outside the captured window, willingness to pay, company identity, or PMF. Combine it with interview/timeline evidence and a separately authorized paid-pilot record. Do not commit packages or generated cohort reports to Git.

## Phase gates

- **P1 problem validation:** at least 8/15 repeat monthly, 5 people spend more than two hours or bear material error cost, and 7 agree to a real task.
- **P2 outcome validation:** median time at least 50% lower, at least 70% usable/minor-edit deliveries, 100% generated key numbers traceable, at least 60% Apply, and zero safety redlines.
- **Pilot entry:** at least 20 fully authorized/redacted reviewed tasks, every eligible task's evaluated deliverables at number correctness ≥4.
- **P3 reuse signal:** at least 40% of evaluated participants complete a second fully reviewed task on another date within 28 days.
- **P4 payment validation:** at least 10 explicit quotes, 5 paying teams, 30% qualified-pilot conversion, one paid continuation signal, viable observed contribution, and one repeatable acquisition path.

If a gate fails twice, fix the highest-blocking step or revisit the user/task hypothesis. Do not rescue weak demand by adding more formats, templates, automation, or telemetry.
