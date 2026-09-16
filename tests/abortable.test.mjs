import assert from "node:assert/strict";
import test from "node:test";

import { raceWithAbort } from "../app/lib/abortable.ts";

test("returns completed work and rejects pending work promptly when aborted", async () => {
  assert.equal(await raceWithAbort(Promise.resolve("done"), undefined, "cancelled"), "done");

  const controller = new AbortController();
  const pending = raceWithAbort(new Promise(() => {}), controller.signal, "OCR cancelled");
  controller.abort();
  await assert.rejects(pending, { name: "AbortError", message: "OCR cancelled" });
});

test("rejects before starting a race when the signal is already aborted", async () => {
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(raceWithAbort(Promise.resolve("late"), controller.signal, "OCR cancelled"), {
    name: "AbortError",
  });
});
