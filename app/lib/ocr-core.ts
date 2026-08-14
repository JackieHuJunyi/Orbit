export type OcrCoreVariant = "relaxedsimd-lstm" | "simd-lstm" | "lstm";

// wasm-feature-detect probes (the same bytes tesseract.js uses when it resolves
// a core directory). Kept local so the OCR path does not pull in that package.
const SIMD_PROBE: Uint8Array<ArrayBuffer> = new Uint8Array([
  0, 97, 115, 109, 1, 0, 0, 0, 1, 5, 1, 96, 0, 1, 123, 3, 2, 1, 0, 10, 10, 1, 8, 0, 32, 0, 253, 12, 0, 11,
]);

const RELAXED_SIMD_PROBE: Uint8Array<ArrayBuffer> = new Uint8Array([
  0, 97, 115, 109, 1, 0, 0, 0, 1, 5, 1, 96, 0, 1, 123, 3, 2, 1, 0, 10, 10, 1, 8, 0, 32, 0, 253, 15, 253, 98, 11,
]);

function browserValidator(bytes: Uint8Array<ArrayBuffer>): boolean {
  if (typeof WebAssembly === "undefined" || typeof WebAssembly.validate !== "function") {
    return false;
  }
  try {
    return WebAssembly.validate(bytes);
  } catch {
    return false;
  }
}

/**
 * Chooses one Tesseract core variant for this browser so the OCR worker loads a
 * single wasm loader instead of the whole core directory. Mirrors
 * tesseract.js-core's directory resolution order: relaxed SIMD, then SIMD,
 * then baseline LSTM.
 */
export function detectOcrCoreVariant(
  validate: (bytes: Uint8Array<ArrayBuffer>) => boolean = browserValidator,
): OcrCoreVariant {
  if (validate(RELAXED_SIMD_PROBE)) return "relaxedsimd-lstm";
  if (validate(SIMD_PROBE)) return "simd-lstm";
  return "lstm";
}
