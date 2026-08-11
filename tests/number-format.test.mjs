import assert from "node:assert/strict";
import test from "node:test";

import {
  formatCompactCurrency,
  formatCompactNumber,
  formatDeterministicNumber,
  formatFixedPercent,
  formatInteger,
} from "../app/lib/number-format.ts";

test("formats chart and metric numbers without runtime-locale behavior", () => {
  assert.equal(formatCompactCurrency(970_000), "$970K");
  assert.equal(formatCompactCurrency(1_840_000), "$1.84M");
  assert.equal(formatCompactCurrency(1_000_000), "$1M");
  assert.equal(formatCompactCurrency(-1_200), "-$1.2K");
  assert.equal(formatCompactNumber(9_999.5), "9,999.5");
  assert.equal(formatCompactNumber(10_000), "10K");
  assert.equal(formatCompactNumber(999_999), "1M");
  assert.equal(formatDeterministicNumber(12_345.678), "12,345.68");
  assert.equal(formatInteger(16_000), "16,000");
  assert.equal(formatFixedPercent(30), "30.0%");
  assert.equal(formatFixedPercent(12.4, true), "+12.4%");
});

test("keeps negative zero and non-finite values explicit and deterministic", () => {
  assert.equal(formatDeterministicNumber(-0), "0");
  assert.equal(formatCompactCurrency(Number.POSITIVE_INFINITY), "Infinity");
  assert.equal(formatFixedPercent(Number.NaN), "NaN%");
});
