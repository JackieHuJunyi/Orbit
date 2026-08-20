import assert from "node:assert/strict";
import test from "node:test";

import { planGreetingMotion } from "../app/lib/greeting-motion.ts";

test("plans one bounded left-to-right writing gesture from visible symbols", () => {
  const plan = planGreetingMotion({ canvasWidth: 592, direction: "ltr", unitCount: 6, value: "Hello!" });

  assert.equal(plan.motionCount, 6);
  assert.equal(plan.writeDurationMs, 2_190);
  assert.equal(plan.settleDelayMs, 2_260);
  assert.equal(plan.finishDelayMs, 2_370);
  assert.match(plan.writePath, /^M40 145 /);
  assert.match(plan.writePath, / 552 148$/);
  assert.equal(Object.isFrozen(plan), true);
});

test("keeps Arabic shaping intact while planning a longer right-to-left gesture", () => {
  const value = "مرحبًا";
  const plan = planGreetingMotion({ canvasWidth: 680, direction: "rtl", unitCount: 1, value });

  assert.equal(plan.motionCount, 5);
  assert.equal(plan.writeDurationMs, 2_000);
  assert.equal(plan.settleDelayMs, 2_070);
  assert.equal(plan.finishDelayMs, 2_180);
  assert.match(plan.writePath, /^M640 145 /);
  assert.match(plan.writePath, / 40 148$/);
});

test("bounds hostile geometry and visible-symbol counts without mutating input", () => {
  const input = Object.freeze({
    canvasWidth: Number.POSITIVE_INFINITY,
    direction: "ltr",
    unitCount: 9_999,
    value: "Hi",
  });
  const plan = planGreetingMotion(input);

  assert.equal(plan.motionCount, 14);
  assert.equal(plan.writeDurationMs, 3_000);
  assert.match(plan.writePath, /^M40 145 /);
  assert.match(plan.writePath, / 390 148$/);
  assert.deepEqual(input, { canvasWidth: Number.POSITIVE_INFINITY, direction: "ltr", unitCount: 9_999, value: "Hi" });

  const nonfinite = planGreetingMotion({ canvasWidth: Number.NaN, direction: "ltr", unitCount: Number.NaN, value: "" });
  assert.equal(nonfinite.motionCount, 1);
  assert.equal(nonfinite.writeDurationMs, 1_240);
  assert.match(nonfinite.writePath, / 390 148$/);
});
