import assert from "node:assert/strict";
import test from "node:test";

import { MAX_OCR_LANGUAGE_BYTES, loadBundledOcrLanguages } from "../app/lib/ocr-language-data.ts";

test("loads each selected OCR language from bounded same-origin static-safe assets", async () => {
  const requests = [];
  const languages = await loadBundledOcrLanguages("eng+chi_sim", "http://localhost:3000/ocr/", {
    fetcher: async (url, options) => {
      requests.push({ url: String(url), options });
      return new Response(new Uint8Array(url.toString().includes("eng") ? [31, 139, 1] : [31, 139, 2]), {
        status: 200,
        headers: { "content-length": "3" },
      });
    },
  });

  assert.deepEqual(
    requests.map(({ url }) => url),
    ["http://localhost:3000/ocr/lang/eng.traineddata.wasm", "http://localhost:3000/ocr/lang/chi_sim.traineddata.wasm"],
  );
  assert.ok(requests.every(({ options }) => options.credentials === "same-origin"));
  assert.ok(requests.every(({ options }) => options.redirect === "error"));
  assert.deepEqual(
    languages.map(({ code, data }) => ({ code, data: [...data] })),
    [
      { code: "eng", data: [31, 139, 1] },
      { code: "chi_sim", data: [31, 139, 2] },
    ],
  );
});

test("rejects missing, empty, and oversized OCR language assets", async () => {
  await assert.rejects(
    () =>
      loadBundledOcrLanguages("eng", "http://localhost:3000/ocr/", {
        fetcher: async () => new Response("missing", { status: 404 }),
      }),
    /returned HTTP 404/iu,
  );
  await assert.rejects(
    () =>
      loadBundledOcrLanguages("eng", "http://localhost:3000/ocr/", {
        fetcher: async () => new Response(new Uint8Array(), { status: 200 }),
      }),
    /empty or exceeds/iu,
  );
  await assert.rejects(
    () =>
      loadBundledOcrLanguages("eng", "http://localhost:3000/ocr/", {
        fetcher: async () =>
          new Response(new Uint8Array([1]), {
            status: 200,
            headers: { "content-length": String(MAX_OCR_LANGUAGE_BYTES + 1) },
          }),
      }),
    /exceeds/iu,
  );
  await assert.rejects(
    () =>
      loadBundledOcrLanguages("eng", "http://localhost:3000/ocr/", {
        fetcher: async () =>
          new Response(
            new ReadableStream({
              start(controller) {
                controller.enqueue(new Uint8Array(MAX_OCR_LANGUAGE_BYTES));
                controller.enqueue(new Uint8Array([1]));
                controller.close();
              },
            }),
            { status: 200 },
          ),
      }),
    /exceeds/iu,
  );
});

test("rejects redirected language responses and propagates cancellation", async () => {
  await assert.rejects(
    () =>
      loadBundledOcrLanguages("eng", "http://localhost:3000/ocr/", {
        fetcher: async () => {
          const response = new Response(new Uint8Array([31, 139, 1]), { status: 200 });
          Object.defineProperty(response, "url", { value: "https://cdn.example/eng.traineddata.wasm" });
          return response;
        },
      }),
    /same-origin/iu,
  );

  const controller = new AbortController();
  controller.abort();
  await assert.rejects(
    () =>
      loadBundledOcrLanguages("eng", "http://localhost:3000/ocr/", {
        signal: controller.signal,
        fetcher: async (_url, options) => {
          options.signal.throwIfAborted();
          return new Response(new Uint8Array([31, 139, 1]), { status: 200 });
        },
      }),
    { name: "AbortError" },
  );
});
