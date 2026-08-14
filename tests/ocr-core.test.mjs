import assert from "node:assert/strict";
import test from "node:test";

import { detectOcrCoreVariant } from "../app/lib/ocr-core.ts";

test("picks the relaxed SIMD core when the browser supports it", () => {
  const validate = (bytes) => bytes.length > 0;
  assert.equal(detectOcrCoreVariant(validate), "relaxedsimd-lstm");
});

test("falls back to plain SIMD when relaxed SIMD is unavailable", () => {
  // The relaxed-SIMD probe is 31 bytes; the SIMD probe is 30 bytes.
  const validate = (bytes) => bytes.length === 30;
  assert.equal(detectOcrCoreVariant(validate), "simd-lstm");
});

test("falls back to baseline LSTM when neither SIMD variant validates", () => {
  assert.equal(
    detectOcrCoreVariant(() => false),
    "lstm",
  );
});
