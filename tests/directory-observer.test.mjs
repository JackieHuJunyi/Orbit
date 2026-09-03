import assert from "node:assert/strict";
import test from "node:test";

import {
  directoryObservationFingerprint,
  observeWorkspaceDirectory,
  supportsDirectoryObservation,
} from "../app/lib/directory-observer.ts";

const handle = { kind: "directory", name: "Reports" };

test("reports directory observation support without assuming a browser implementation", () => {
  assert.equal(supportsDirectoryObservation({}), false);
  assert.equal(supportsDirectoryObservation({ FileSystemObserver: class {} }), true);
});

test("observes recursively, coalesces each callback into one signal, and disconnects", async () => {
  let callback;
  let observed;
  let disconnected = false;
  class Observer {
    constructor(next) {
      callback = next;
    }
    async observe(nextHandle, options) {
      observed = { handle: nextHandle, options };
    }
    disconnect() {
      disconnected = true;
    }
  }
  let changes = 0;
  const stop = observeWorkspaceDirectory(
    handle,
    () => {
      changes += 1;
    },
    assert.fail,
    { FileSystemObserver: Observer },
  );
  await Promise.resolve();
  assert.deepEqual(observed, { handle, options: { recursive: true } });
  callback([], {});
  callback([{ type: "modified" }, { type: "appeared" }], {});
  assert.equal(changes, 1);
  stop();
  assert.equal(disconnected, true);
  callback([{ type: "modified" }], {});
  assert.equal(changes, 1);
});

test("reports an asynchronous observation failure while active", async () => {
  class Observer {
    async observe() {
      throw new Error("permission revoked");
    }
    disconnect() {}
  }
  let failure;
  observeWorkspaceDirectory(
    handle,
    assert.fail,
    (error) => {
      failure = error;
    },
    { FileSystemObserver: Observer },
  );
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.match(failure.message, /permission revoked/);
});

function file(name, size, lastModified) {
  return {
    kind: "file",
    name,
    async getFile() {
      return { size, lastModified };
    },
  };
}

function directory(entries) {
  return {
    kind: "directory",
    name: "Reports",
    async *entries() {
      for (const entry of entries) yield [entry.name, entry];
    },
  };
}

test("fingerprints only bounded Orbit source and asset metadata in stable order", async () => {
  const assets = directory([file("b.png", 20, 2), file("a.png", 10, 1)]);
  assets.name = ".orbit-assets";
  const fingerprint = await directoryObservationFingerprint(
    directory([file("notes.txt", 99, 9), file("report.md", 30, 3), assets]),
  );
  assert.deepEqual(JSON.parse(fingerprint), [
    [".orbit-assets/a.png", 10, 1],
    [".orbit-assets/b.png", 20, 2],
    ["report.md", 30, 3],
  ]);
});

test("falls back to bounded metadata polling when the native observer is unavailable", async () => {
  let lastModified = 1;
  const handle = directory([
    {
      kind: "file",
      name: "report.md",
      async getFile() {
        return { size: 30, lastModified };
      },
    },
  ]);
  let scheduled;
  let cancelled;
  let changes = 0;
  const stop = observeWorkspaceDirectory(
    handle,
    () => {
      changes += 1;
    },
    assert.fail,
    {
      setInterval(callback) {
        scheduled = callback;
        return 41;
      },
      clearInterval(id) {
        cancelled = id;
      },
    },
  );
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(changes, 0);
  lastModified = 2;
  scheduled();
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(changes, 1);
  stop();
  assert.equal(cancelled, 41);
});
