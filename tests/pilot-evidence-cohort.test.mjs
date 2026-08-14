import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  compileRunePilotCohort,
  parseRunePilotEvidencePackage,
  renderRunePilotCohortMarkdown,
} from "../app/lib/pilot-evidence-cohort.ts";
import { prepareRunePilotEvidenceExport } from "../app/lib/pilot-evidence.ts";

const projectRoot = fileURLToPath(new URL("..", import.meta.url));

function revision(seed) {
  return `r1-${seed}-${seed.repeat(16).slice(0, 16)}`;
}

function evaluation(numberCorrectness, rest = 4) {
  return {
    version: 1,
    provenance: "authorized-or-redacted",
    rubric: {
      numberCorrectness,
      evidenceCompleteness: rest,
      conclusionUsefulness: rest,
      structureClarity: rest,
      visualDeliverability: rest,
      changeComprehensibility: rest,
      timeSaved: rest,
    },
  };
}

function run({ id, date, taskId = "operating-review", provider = "local", tokens = false }) {
  const sourceArtifactId = `source-${id}`;
  const outputArtifactId = `output-${id}`;
  return {
    version: 1,
    id,
    taskId,
    completedAt: `${date}T09:00:00.000Z`,
    status: "applied",
    stopReason: null,
    provider,
    sourceArtifactId,
    sourceRevision: revision("a"),
    outputArtifactIds: [outputArtifactId],
    outputRevisions: { [outputArtifactId]: revision("b") },
    changedFileCount: taskId === "operating-review" ? 3 : 1,
    queryCount: taskId === "operating-review" ? 1 : 0,
    chartConsumerCount: taskId === "operating-review" ? 1 : 0,
    durationMs: 60_000,
    inputTokens: tokens ? 1_000 : null,
    outputTokens: tokens ? 400 : null,
  };
}

function delivery(runRecord, { date, rating = "ready", numberCorrectness = 5 }) {
  const artifactId = runRecord.outputArtifactIds[0];
  return {
    version: 2,
    id: `delivery:${runRecord.id}:${artifactId}`,
    confirmedAt: `${date}T09:10:00.000Z`,
    runId: runRecord.id,
    taskId: runRecord.taskId,
    artifactId,
    method: "download",
    target: runRecord.taskId === "operating-review" ? "pdf" : "pptx",
    rating,
    sourceSha256: "c".repeat(64),
    taskDurationMs: 660_000,
    evaluation: evaluation(numberCorrectness),
  };
}

function participantOnePackage() {
  const first = run({ id: "p1-first", date: "2026-07-01" });
  const second = run({ id: "p1-second", date: "2026-07-15", provider: "configured", tokens: true });
  return prepareRunePilotEvidenceExport(
    {
      version: 3,
      runs: [first, second],
      deliveries: [
        delivery(first, { date: "2026-07-01", numberCorrectness: 5 }),
        delivery(second, { date: "2026-07-15", rating: "minor-edits", numberCorrectness: 4 }),
      ],
    },
    new Date("2026-08-01T01:02:03.000Z"),
  ).package;
}

function participantTwoPackage() {
  const briefing = run({ id: "p2-briefing", date: "2026-07-04", taskId: "document-briefing" });
  return prepareRunePilotEvidenceExport(
    {
      version: 3,
      runs: [briefing],
      deliveries: [delivery(briefing, { date: "2026-07-04", rating: "not-ready", numberCorrectness: 3 })],
    },
    new Date("2026-08-02T01:02:03.000Z"),
  ).package;
}

test("strictly parses a compiler-owned pilot package without mutating it", () => {
  const evidence = participantOnePackage();
  const snapshot = structuredClone(evidence);
  const parsed = parseRunePilotEvidencePackage(evidence);
  assert.deepEqual(parsed, evidence);
  assert.notEqual(parsed, evidence);
  assert.deepEqual(evidence, snapshot);
});

test("aggregates candidate outcomes, number gates, task mix, and 28-day recurrence", () => {
  const report = compileRunePilotCohort(
    [
      { participantId: "participant-001", evidence: participantOnePackage() },
      { participantId: "participant-002", evidence: participantTwoPackage() },
    ],
    new Date("2026-08-14T12:00:00.000Z"),
  );
  assert.equal(report.compiledOn, "2026-08-14");
  assert.equal(report.provenance.participantCount, 2);
  assert.equal(report.provenance.participantIdentityIncluded, false);
  assert.equal(report.provenance.sourceRecordsIncluded, false);
  assert.equal(report.provenance.uploadPerformed, false);
  assert.deepEqual(report.summary.runs, {
    total: 3,
    applied: 3,
    stopped: 0,
    successRate: 100,
    averageDurationMs: 60_000,
    modelRunCount: 1,
    inputTokens: 1_000,
    outputTokens: 400,
  });
  assert.equal(report.summary.deliveries.total, 3);
  assert.equal(report.summary.deliveries.usable, 2);
  assert.equal(report.summary.deliveries.usableRate, 67);
  assert.equal(report.summary.deliveries.humanEvaluated, 3);
  assert.equal(report.summary.deliveries.reviewedRealTasks, 3);
  assert.equal(report.summary.deliveries.numberCorrectnessBelow4, 1);
  assert.equal(report.summary.deliveries.pilotEligibleTasks, 2);
  assert.equal(report.summary.deliveries.meetsPilotMinimum, false);
  assert.equal(report.summary.deliveries.dimensionAverages.numberCorrectness, 4);
  assert.deepEqual(report.summary.recurrence, {
    evaluatedParticipants: 2,
    repeatedWithin28Days: 1,
    repeatRate: 50,
  });
  assert.equal(report.tasks.find((task) => task.taskId === "operating-review")?.runs.total, 2);
  assert.equal(report.tasks.find((task) => task.taskId === "document-briefing")?.deliveries.notReady, 1);
});

test("marks the pilot minimum only after twenty distinct fully evaluated eligible tasks", () => {
  const participants = Array.from({ length: 20 }, (_, index) => {
    const day = String(index + 1).padStart(2, "0");
    const taskRun = run({ id: `threshold-${day}`, date: `2026-07-${day}` });
    const evidence = prepareRunePilotEvidenceExport(
      {
        version: 3,
        runs: [taskRun],
        deliveries: [delivery(taskRun, { date: `2026-07-${day}`, numberCorrectness: 4 })],
      },
      new Date("2026-08-01T00:00:00.000Z"),
    ).package;
    return { participantId: `participant-${String(index + 1).padStart(3, "0")}`, evidence };
  });
  const report = compileRunePilotCohort(participants, new Date("2026-08-14T00:00:00.000Z"));
  assert.equal(report.summary.deliveries.reviewedRealTasks, 20);
  assert.equal(report.summary.deliveries.pilotEligibleTasks, 20);
  assert.equal(report.summary.deliveries.meetsPilotMinimum, true);
});

test("emits only aggregate report facts and never participant aliases or source records", () => {
  const report = compileRunePilotCohort(
    [
      { participantId: "participant-001", evidence: participantOnePackage() },
      { participantId: "participant-002", evidence: participantTwoPackage() },
    ],
    new Date("2026-08-14T12:00:00.000Z"),
  );
  const json = JSON.stringify(report);
  const markdown = renderRunePilotCohortMarkdown(report);
  for (const forbidden of ["participant-001", "participant-002", "run-001", "output-01", "source-p1", "p1-first"]) {
    assert.equal(json.includes(forbidden), false, forbidden);
    assert.equal(markdown.includes(forbidden), false, forbidden);
  }
  assert.match(markdown, /Pilot-eligible tasks: 2 \/ 20/);
  assert.match(markdown, /not proof of PMF/);
  assert.match(markdown, /Upload performed: no/);
});

test("rejects altered provenance, fields, links, order, and summaries", () => {
  const provenance = structuredClone(participantOnePackage());
  provenance.provenance.uploadPerformed = true;
  assert.throws(() => parseRunePilotEvidencePackage(provenance), /provenance/i);

  const foreignField = structuredClone(participantOnePackage());
  foreignField.runs[0].sourceArtifactId = "should-never-exist";
  assert.throws(() => parseRunePilotEvidencePackage(foreignField), /runs/i);

  const link = structuredClone(participantOnePackage());
  link.deliveries[0].runId = "run-999";
  assert.throws(() => parseRunePilotEvidencePackage(link), /deliveries/i);

  const order = structuredClone(participantOnePackage());
  order.runs.reverse();
  assert.throws(() => parseRunePilotEvidencePackage(order), /runs|order/i);

  const summary = structuredClone(participantOnePackage());
  summary.summary.deliveries.pilotEligibleTasks = 20;
  summary.summary.deliveries.meetsPilotMinimum = true;
  assert.throws(() => parseRunePilotEvidencePackage(summary), /summary/i);
});

test("requires one unique pseudonymous package per participant and rejects duplicate content across export dates", () => {
  const first = participantOnePackage();
  const sameContentLater = { ...structuredClone(first), exportedOn: "2026-08-03" };
  assert.throws(
    () =>
      compileRunePilotCohort([
        { participantId: "participant-001", evidence: first },
        { participantId: "participant-002", evidence: sameContentLater },
      ]),
    /duplicate evidence package content/i,
  );
  assert.throws(
    () =>
      compileRunePilotCohort([
        { participantId: "participant-001", evidence: first },
        { participantId: "participant-001", evidence: participantTwoPackage() },
      ]),
    /participant ids/i,
  );
  assert.throws(
    () => compileRunePilotCohort([{ participantId: "alice@example.com", evidence: first }]),
    /participant-NNN/i,
  );
});

test("keeps deep-frozen cohort input unchanged on success and failure", () => {
  const frozenEvidence = participantOnePackage();
  Object.freeze(frozenEvidence.provenance);
  frozenEvidence.runs.forEach(Object.freeze);
  Object.freeze(frozenEvidence.runs);
  frozenEvidence.deliveries.forEach((item) => {
    if (item.evaluation) {
      Object.freeze(item.evaluation.rubric);
      Object.freeze(item.evaluation);
    }
    Object.freeze(item);
  });
  Object.freeze(frozenEvidence.deliveries);
  Object.freeze(frozenEvidence.summary.runs);
  Object.freeze(frozenEvidence.summary.deliveries.dimensionAverages);
  Object.freeze(frozenEvidence.summary.deliveries);
  Object.freeze(frozenEvidence.summary);
  Object.freeze(frozenEvidence);
  const participant = Object.freeze({ participantId: "participant-001", evidence: frozenEvidence });
  const input = Object.freeze([participant]);
  const snapshot = structuredClone(input);
  compileRunePilotCohort(input, new Date("2026-08-14T00:00:00.000Z"));
  assert.deepEqual(input, snapshot);
  assert.throws(() => compileRunePilotCohort(input, new Date("invalid")), /valid compile time/i);
  assert.deepEqual(input, snapshot);
});

test("CLI reads one relative regular file per alias and writes non-overwriting private aggregate reports", async () => {
  const temporary = await mkdtemp(path.join(tmpdir(), "rune-pilot-cohort-"));
  try {
    const evidenceDirectory = path.join(temporary, "evidence");
    const outputDirectory = path.join(temporary, "reports");
    await mkdir(evidenceDirectory);
    await writeFile(path.join(evidenceDirectory, "one.json"), JSON.stringify(participantOnePackage()));
    await writeFile(path.join(evidenceDirectory, "two.json"), JSON.stringify(participantTwoPackage()));
    const manifestPath = path.join(temporary, "manifest.json");
    await writeFile(
      manifestPath,
      JSON.stringify({
        version: 1,
        participants: [
          { participantId: "participant-001", evidenceFile: "evidence/one.json" },
          { participantId: "participant-002", evidenceFile: "evidence/two.json" },
        ],
      }),
    );
    const first = spawnSync(
      process.execPath,
      ["--experimental-strip-types", "scripts/aggregate-pilot-evidence.mjs", manifestPath, outputDirectory],
      { cwd: projectRoot, encoding: "utf8" },
    );
    assert.equal(first.status, 0, first.stderr);
    const files = (await readdir(outputDirectory)).sort();
    assert.equal(files.length, 2);
    assert.match(files[0], /\.json$/u);
    assert.match(files[1], /\.md$/u);
    const json = await readFile(path.join(outputDirectory, files[0]), "utf8");
    const markdown = await readFile(path.join(outputDirectory, files[1]), "utf8");
    assert.equal(json.includes("participant-001"), false);
    assert.equal(json.includes("run-001"), false);
    assert.match(markdown, /Pilot-eligible tasks: 2 \/ 20/);
    const second = spawnSync(
      process.execPath,
      ["--experimental-strip-types", "scripts/aggregate-pilot-evidence.mjs", manifestPath, outputDirectory],
      { cwd: projectRoot, encoding: "utf8" },
    );
    assert.notEqual(second.status, 0);
    assert.match(second.stderr, /already exists|could not be written atomically/i);
    assert.equal(await readFile(path.join(outputDirectory, files[0]), "utf8"), json);
    assert.equal(await readFile(path.join(outputDirectory, files[1]), "utf8"), markdown);
  } finally {
    await rm(temporary, { recursive: true, force: true });
  }
});

test("keeps the cohort compiler pure and the filesystem CLI outside the production client", async () => {
  const source = await readFile(new URL("../app/lib/pilot-evidence-cohort.ts", import.meta.url), "utf8");
  assert.doesNotMatch(source, /from ["']react|node:fs|localStorage|sessionStorage|indexedDB|\bfetch\s*\(/u);
  assert.doesNotMatch(source, /aggregate-pilot-evidence/u);
  const workbench = await readFile(new URL("../app/components/rune-workbench.tsx", import.meta.url), "utf8");
  assert.doesNotMatch(workbench, /pilot-evidence-cohort|aggregate-pilot-evidence/u);
});
