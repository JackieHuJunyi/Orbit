import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { runRuneGoldenTaskSet } from "../evals/run-golden-task-set.mjs";

const BASELINE_URL = new URL("../evals/BASELINE.md", import.meta.url);

function tableCell(value) {
  return String(value).replaceAll("|", "\\|").replaceAll("\n", " ");
}

export function renderRuneGoldenTaskReport(result) {
  const rows = result.cases.map((entry) => (
    `| \`${tableCell(entry.id)}\` | ${entry.expected} | ${entry.result} | ${tableCell(entry.coverage.join(" · "))} |`
  ));
  return `# Rune synthetic Golden Task baseline

> Evidence grade E1: deterministic regression evidence from synthetic fixtures. This is not user-demand, delivery, retention, or paid validation.

## Automated contract

- Set version: ${result.version}
- Fixtures: ${result.taskCount} synthetic tasks; ${result.licensedRealTasks} licensed or redacted real tasks
- Result: ${result.passed}/${result.taskCount} passed; ${result.failed} failed
- Expected success paths: ${result.expectedSuccess}
- Expected fail-closed paths: ${result.expectedRejected}
- Real DuckDB-Wasm numeric executions: ${result.runtimeVerified}
- Human-rated tasks: ${result.humanRated}

| Task | Expected outcome | Automated result | Coverage |
| --- | --- | --- | --- |
${rows.join("\n")}

## Human business-outcome rubric

Every licensed or redacted real task must be reviewed from 1–5 on:

1. Number correctness
2. Evidence completeness
3. Conclusion usefulness
4. Structure clarity
5. Visual deliverability
6. Change comprehensibility
7. Overall time saved

No human score is recorded until an authorized reviewer has completed a real task. A number-correctness score below 4 cannot be hidden by averaging. The pilot entry threshold remains 20 licensed or redacted real tasks.
`;
}

async function main() {
  const result = await runRuneGoldenTaskSet();
  const report = renderRuneGoldenTaskReport(result);
  if (process.argv.includes("--print")) {
    process.stdout.write(report);
  } else {
    const baseline = await readFile(BASELINE_URL, "utf8");
    if (baseline !== report) {
      throw new Error(`Golden Task baseline drifted: ${fileURLToPath(BASELINE_URL)}. Review the task contract and update the baseline intentionally.`);
    }
    process.stdout.write(`Golden Task Eval ${result.passed}/${result.taskCount} · ${result.runtimeVerified} DuckDB executions · synthetic E1 only\n`);
  }
  if (result.failed > 0) process.exitCode = 1;
}

await main();
