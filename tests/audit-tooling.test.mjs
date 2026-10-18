import assert from "node:assert/strict";
import test from "node:test";
import { reviewToolingAudit, TOOLING_ADVISORY } from "../scripts/audit-tooling.mjs";

function fixture() {
  return {
    audit: {
      metadata: { vulnerabilities: { high: 2, critical: 0 } },
      vulnerabilities: {
        braces: {
          severity: "high",
          nodes: ["node_modules/braces"],
          via: [{ name: "braces", url: TOOLING_ADVISORY, severity: "high", range: "<=3.0.3" }],
        },
        micromatch: { severity: "high", nodes: ["node_modules/micromatch"], via: ["braces"] },
      },
    },
    lockfile: {
      packages: {
        "node_modules/braces": { version: "3.0.3", dev: true },
        "node_modules/micromatch": { version: "4.0.8", dev: true },
      },
    },
  };
}

const reviewDate = new Date("2026-10-18T00:00:00Z");

test("accepts only the reviewed development-only advisory and its dependency chain", () => {
  const { audit, lockfile } = fixture();
  assert.deepEqual(reviewToolingAudit(audit, lockfile, reviewDate), {
    accepted: ["braces", "micromatch"],
    blocked: [],
  });
});

test("rejects the exception when braces enters production dependencies", () => {
  const { audit, lockfile } = fixture();
  delete lockfile.packages["node_modules/braces"].dev;
  assert.deepEqual(reviewToolingAudit(audit, lockfile, reviewDate).blocked, ["braces", "micromatch"]);
});

test("rejects new advisories even when they affect the same reviewed package", () => {
  const { audit, lockfile } = fixture();
  audit.vulnerabilities.braces.via.push({ name: "braces", url: "https://example.com/new", severity: "high" });
  assert.deepEqual(reviewToolingAudit(audit, lockfile, reviewDate).blocked, ["braces", "micromatch"]);
});

test("rejects expired exceptions and unreviewed installed versions", () => {
  const { audit, lockfile } = fixture();
  assert.deepEqual(reviewToolingAudit(audit, lockfile, new Date("2026-11-17T00:00:00Z")).blocked, [
    "braces",
    "micromatch",
  ]);
  lockfile.packages["node_modules/braces"].version = "3.0.2";
  assert.deepEqual(reviewToolingAudit(audit, lockfile, reviewDate).blocked, ["braces", "micromatch"]);
});

test("rejects critical findings, unknown dependencies, and cycles", () => {
  const { audit, lockfile } = fixture();
  audit.vulnerabilities.braces.severity = "critical";
  assert.deepEqual(reviewToolingAudit(audit, lockfile, reviewDate).blocked, ["braces", "micromatch"]);
  audit.vulnerabilities.braces.severity = "high";
  audit.vulnerabilities.micromatch.via = ["missing"];
  assert.deepEqual(reviewToolingAudit(audit, lockfile, reviewDate).blocked, ["micromatch"]);
  audit.vulnerabilities.micromatch.via = ["micromatch"];
  assert.deepEqual(reviewToolingAudit(audit, lockfile, reviewDate).blocked, ["micromatch"]);
});

test("fails closed for unavailable audit data and missing lockfile entries", () => {
  const { audit, lockfile } = fixture();
  assert.throws(() => reviewToolingAudit({ error: { code: "NETWORK" } }, lockfile, reviewDate));
  assert.throws(() => reviewToolingAudit({ vulnerabilities: {} }, lockfile, reviewDate));
  delete lockfile.packages["node_modules/braces"];
  assert.deepEqual(reviewToolingAudit(audit, lockfile, reviewDate).blocked, ["braces", "micromatch"]);
});
