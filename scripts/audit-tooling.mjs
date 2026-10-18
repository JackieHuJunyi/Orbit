import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";

export const TOOLING_ADVISORY = "https://github.com/advisories/GHSA-vfj7-8cjw-p6xm";
export const TOOLING_REVIEW_DATE = "2026-11-17";

const reviewedPackages = new Set([
  "braces",
  "micromatch",
  "fast-glob",
  "@next/eslint-plugin-next",
  "eslint-config-next",
  "vite-plugin-dynamic-import",
  "vite-plugin-commonjs",
  "vinext",
]);

export function reviewToolingAudit(audit, lockfile, today = new Date()) {
  if (audit.error || !audit.vulnerabilities || !audit.metadata?.vulnerabilities || !lockfile.packages) {
    throw new Error("A complete npm audit report and lockfile are required.");
  }

  const exceptionCurrent = today.toISOString().slice(0, 10) < TOOLING_REVIEW_DATE;
  const isReviewed = (name, ancestors = new Set()) => {
    const finding = audit.vulnerabilities[name];
    if (!exceptionCurrent || !reviewedPackages.has(name) || ancestors.has(name) || finding?.severity !== "high") {
      return false;
    }
    if (!finding.nodes?.length || !finding.via?.length) return false;
    if (
      !finding.nodes.every((location) => {
        const installed = lockfile.packages[location];
        return installed?.dev === true && (name !== "braces" || installed.version === "3.0.3");
      })
    ) {
      return false;
    }

    const nextAncestors = new Set([...ancestors, name]);
    return finding.via.every((advisory) =>
      typeof advisory === "string"
        ? isReviewed(advisory, nextAncestors)
        : name === "braces" &&
          advisory.name === "braces" &&
          advisory.url === TOOLING_ADVISORY &&
          advisory.severity === "high" &&
          advisory.range === "<=3.0.3",
    );
  };

  const accepted = [];
  const blocked = [];
  for (const [name, finding] of Object.entries(audit.vulnerabilities)) {
    if (finding.severity !== "high" && finding.severity !== "critical") continue;
    (isReviewed(name) ? accepted : blocked).push(name);
  }
  return { accepted, blocked };
}

function main() {
  const npmCli = process.env.npm_execpath;
  if (!npmCli) throw new Error("Run this check with npm run audit:tooling.");
  const result = spawnSync(process.execPath, [npmCli, "audit", "--json"], {
    cwd: fileURLToPath(new URL("..", import.meta.url)),
    encoding: "utf8",
    maxBuffer: 8 * 1024 * 1024,
    timeout: 120_000,
  });
  if (result.error) throw result.error;
  if (result.status !== 0 && result.status !== 1) throw new Error(result.stderr || "npm audit failed.");
  const audit = JSON.parse(result.stdout);
  const lockfile = JSON.parse(readFileSync(new URL("../package-lock.json", import.meta.url), "utf8"));
  const review = reviewToolingAudit(audit, lockfile);
  if (review.accepted.length) {
    console.warn(`Reviewed development-only advisory until ${TOOLING_REVIEW_DATE}: ${TOOLING_ADVISORY}`);
    console.warn(`Affected tooling: ${review.accepted.join(", ")}. See docs/DEPENDENCY-SECURITY.md.`);
  }
  if (review.blocked.length) {
    console.error(`Unreviewed high/critical vulnerabilities: ${review.blocked.join(", ")}`);
    process.exitCode = 1;
  } else {
    console.log("Tooling audit passed: no unreviewed high/critical vulnerabilities.");
  }
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  try {
    main();
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
