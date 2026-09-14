import assert from "node:assert/strict";
import test from "node:test";

import { planGreetingPresentation } from "../app/lib/greeting-presentation.ts";
import { ORBIT_LOCALE_REGISTRY } from "../app/lib/localization.ts";

test("plans one frozen path timeline for every interface greeting", () => {
  const expectedScripts = {
    "zh-CN": "logographic",
    "zh-TW": "logographic",
    en: "cursive",
    fr: "cursive",
    es: "cursive",
    ru: "cursive",
    ar: "arabic",
    ja: "kana",
    ko: "hangul",
  };

  for (const entry of ORBIT_LOCALE_REGISTRY) {
    const plan = planGreetingPresentation({ locale: entry.locale, value: entry.greeting });

    assert.equal(plan.locale, entry.locale);
    assert.equal(plan.value, entry.greeting);
    assert.equal(plan.direction, entry.direction);
    assert.equal(plan.script, expectedScripts[entry.locale]);
    assert.equal(plan.renderMode, entry.locale === "en" ? "vector-centerline" : "tegaki-font");
    assert.ok(plan.canvasWidth >= 430 && plan.canvasWidth <= 1_040);
    assert.ok(plan.motion.completeAfterMs < plan.motion.cycleDurationMs);
    assert.ok(plan.motion.cycleDurationMs >= 5_000 && plan.motion.cycleDurationMs <= 7_000);
    assert.equal(Object.isFrozen(plan), true);
    assert.equal(Object.isFrozen(plan.motion), true);
  }
});

test("does not mutate presentation input and applies one duration scale to drawing and cycle", () => {
  const input = Object.freeze({ durationScale: 1.25, locale: "en", value: "Hello" });
  const plan = planGreetingPresentation(input);

  assert.deepEqual(input, { durationScale: 1.25, locale: "en", value: "Hello" });
  assert.equal(plan.motion.durationScale, 1.25);
  assert.equal(plan.renderMode, "vector-centerline");
  assert.equal(plan.completeAfterMs, 3_560);
  assert.equal(plan.motion.writeDurationMs, 2_500);
  assert.equal(plan.motion.settleDurationMs, 775);
  assert.ok(plan.motion.completeAfterMs < plan.motion.cycleDurationMs);
});
