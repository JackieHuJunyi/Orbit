import assert from "node:assert/strict";
import test from "node:test";

import { planGreetingMotion } from "../app/lib/greeting-motion.ts";

test("plans a bounded cursive greeting as an opening, cross stroke, and one connected letter gesture", () => {
  const plan = planGreetingMotion({
    canvasWidth: 592,
    direction: "ltr",
    script: "cursive",
    unitCount: 6,
    value: "Hello!",
  });

  assert.equal(plan.motionCount, 6);
  assert.equal(plan.writeDurationMs, 2_190);
  assert.equal(plan.settleDelayMs, 2_382);
  assert.equal(plan.settleDurationMs, 620);
  assert.equal(plan.completeAfterMs, 3_002);
  assert.equal(plan.cycleDurationMs, 5_000);
  assert.equal(plan.durationScale, 1);
  assert.equal(plan.strokes.length, 3);
  assert.match(plan.strokes[0].path, /^M48 174 /);
  assert.match(plan.strokes[2].path, /^M96\.3 148 /);
  assert.equal(plan.strokes[2].path.match(/M/g)?.length, 1);
  assert.ok(plan.strokes[0].delayMs < plan.strokes[1].delayMs);
  assert.ok(plan.strokes[1].delayMs < plan.strokes[2].delayMs);
  assert.ok(plan.strokes.at(-1).delayMs + plan.strokes.at(-1).durationMs < plan.settleDelayMs);
  assert.equal(Object.isFrozen(plan), true);
  assert.equal(Object.isFrozen(plan.strokes), true);
  assert.equal(plan.strokes.every(Object.isFrozen), true);
});

test("keeps Arabic shaping intact while planning its body and marks right to left", () => {
  const value = "مرحبًا";
  const plan = planGreetingMotion({ canvasWidth: 680, direction: "rtl", script: "arabic", unitCount: 1, value });

  assert.equal(plan.motionCount, 5);
  assert.equal(plan.writeDurationMs, 2_000);
  assert.equal(plan.settleDelayMs, 2_192);
  assert.equal(plan.strokes.length, 3);
  assert.match(plan.strokes[0].path, /^M571\.4 148 /);
  assert.match(plan.strokes[0].path, / 24 136$/);
  assert.equal(plan.strokes[0].path.match(/M/g)?.length, 1);
  assert.equal(plan.strokes[0].strokeWidth, 78);
  assert.equal(plan.strokes[1].strokeWidth, 29);
});

test("gives logographic, kana, and Hangul greetings bounded sequential brush strokes", () => {
  const plans = [
    planGreetingMotion({ canvasWidth: 430, direction: "ltr", script: "logographic", unitCount: 2, value: "你好" }),
    planGreetingMotion({ canvasWidth: 875, direction: "ltr", script: "kana", unitCount: 5, value: "こんにちは" }),
    planGreetingMotion({ canvasWidth: 875, direction: "ltr", script: "hangul", unitCount: 5, value: "안녕하세요" }),
  ];

  assert.deepEqual(
    plans.map((plan) => plan.strokes.length),
    [8, 12, 12],
  );
  for (const plan of plans) {
    assert.ok(plan.strokes.length > 3);
    assert.ok(plan.strokes.every((stroke, index) => index === 0 || stroke.delayMs > plan.strokes[index - 1].delayMs));
    assert.ok(plan.strokes.at(-1).delayMs + plan.strokes.at(-1).durationMs < plan.settleDelayMs);
  }
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
  assert.equal(plan.strokes.length, 3);
  assert.match(plan.strokes[0].path, /^M48 174 /);
  assert.ok(plan.strokes.at(-1).delayMs + plan.strokes.at(-1).durationMs < plan.settleDelayMs);
  assert.deepEqual(input, { canvasWidth: Number.POSITIVE_INFINITY, direction: "ltr", unitCount: 9_999, value: "Hi" });

  const nonfinite = planGreetingMotion({ canvasWidth: Number.NaN, direction: "ltr", unitCount: Number.NaN, value: "" });
  assert.equal(nonfinite.motionCount, 1);
  assert.equal(nonfinite.writeDurationMs, 1_240);
  assert.equal(nonfinite.strokes.length, 3);
  assert.ok(nonfinite.strokes.at(-1).delayMs + nonfinite.strokes.at(-1).durationMs < nonfinite.settleDelayMs);
});

test("scales the complete path timeline while keeping it inside a bounded welcome cycle", () => {
  const fast = planGreetingMotion({
    canvasWidth: 592,
    direction: "ltr",
    durationScale: 0.2,
    script: "cursive",
    unitCount: 5,
    value: "Hello",
  });
  const slow = planGreetingMotion({
    canvasWidth: 592,
    direction: "ltr",
    durationScale: 20,
    script: "cursive",
    unitCount: 5,
    value: "Hello",
  });

  assert.equal(fast.durationScale, 0.6);
  assert.equal(fast.writeDurationMs, 1_200);
  assert.equal(fast.completeAfterMs, 1_687);
  assert.equal(fast.cycleDurationMs, 5_000);
  assert.equal(slow.durationScale, 1.6);
  assert.equal(slow.writeDurationMs, 3_200);
  assert.equal(slow.completeAfterMs, 4_499);
  assert.equal(slow.cycleDurationMs, 6_419);
  assert.ok(fast.strokes.every((stroke, index) => index === 0 || stroke.delayMs > fast.strokes[index - 1].delayMs));
  assert.ok(slow.strokes.every((stroke, index) => index === 0 || stroke.delayMs > slow.strokes[index - 1].delayMs));
});
