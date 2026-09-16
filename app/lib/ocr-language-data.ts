import type { PdfOcrLanguage } from "./pdf-import";

export const MAX_OCR_LANGUAGE_BYTES = 12 * 1024 * 1024;

const OCR_LANGUAGE_CODES = new Set(["eng", "chi_sim"]);

async function readBoundedBody(response: Response, code: string) {
  if (!response.body) throw new Error(`Orbit OCR language ${code} is empty or exceeds the 12 MB limit.`);
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      totalBytes += value.byteLength;
      if (totalBytes > MAX_OCR_LANGUAGE_BYTES) {
        await reader.cancel();
        throw new Error(`Orbit OCR language ${code} exceeds the 12 MB limit.`);
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  if (!totalBytes) throw new Error(`Orbit OCR language ${code} is empty or exceeds the 12 MB limit.`);

  const data = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    data.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return data;
}

export async function loadBundledOcrLanguages(
  language: PdfOcrLanguage,
  assetBase: string,
  options: { fetcher?: typeof fetch; signal?: AbortSignal } = {},
) {
  const fetcher = options.fetcher ?? fetch;
  const assetBaseUrl = new URL(assetBase);
  if (assetBaseUrl.protocol !== "http:" && assetBaseUrl.protocol !== "https:") {
    throw new Error("Orbit OCR language assets require an HTTP origin.");
  }
  const codes = language.split("+");
  if (!codes.length || codes.some((code) => !OCR_LANGUAGE_CODES.has(code))) {
    throw new Error("Choose a supported English or Simplified Chinese OCR model.");
  }

  return Promise.all(
    codes.map(async (code) => {
      const url = new URL(`lang/${code}.traineddata.wasm`, assetBaseUrl);
      if (url.origin !== assetBaseUrl.origin) throw new Error("Orbit OCR language assets must stay same-origin.");
      const response = await fetcher(url, {
        credentials: "same-origin",
        redirect: "error",
        signal: options.signal,
      });
      if (!response.ok) throw new Error(`Orbit OCR language ${code} returned HTTP ${response.status}.`);
      if (response.url && new URL(response.url).origin !== assetBaseUrl.origin) {
        throw new Error("Orbit OCR language assets must stay same-origin.");
      }
      const contentLength = response.headers.get("content-length");
      const declaredBytes = contentLength === null ? undefined : Number(contentLength);
      if (declaredBytes !== undefined && Number.isFinite(declaredBytes) && declaredBytes > MAX_OCR_LANGUAGE_BYTES) {
        throw new Error(`Orbit OCR language ${code} exceeds the 12 MB limit.`);
      }
      const data = await readBoundedBody(response, code);
      return { code, data };
    }),
  );
}
