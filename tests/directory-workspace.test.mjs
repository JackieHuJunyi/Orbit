import assert from "node:assert/strict";
import test from "node:test";

import {
  MAX_DIRECTORY_FILE_BYTES,
  WORKSPACE_MANIFEST_NAME,
  buildWorkspaceManifest,
  parseWorkspaceManifest,
  readWorkspaceDirectory,
  serializeWorkspaceManifest,
  writeWorkspaceDirectory,
} from "../app/lib/directory-workspace.ts";
import { defaultArtifacts } from "../app/lib/workspace.ts";

class MemoryFileHandle {
  kind = "file";

  constructor(name, files) {
    this.name = name;
    this.files = files;
  }

  async getFile() {
    if (!this.files.has(this.name)) throw new Error(`not found: ${this.name}`);
    const source = this.files.get(this.name);
    return {
      size: new TextEncoder().encode(source).byteLength,
      async text() { return source; },
    };
  }

  async createWritable() {
    let source = "";
    return {
      write: async (nextSource) => { source = String(nextSource); },
      close: async () => { this.files.set(this.name, source); },
    };
  }
}

class MemoryDirectory {
  kind = "directory";

  constructor(name = "Rune workspace", initial = {}) {
    this.name = name;
    this.files = new Map(Object.entries(initial));
  }

  async getFileHandle(name, options = {}) {
    if (!this.files.has(name) && !options.create) throw new Error(`not found: ${name}`);
    return new MemoryFileHandle(name, this.files);
  }

  async *entries() {
    for (const name of [...this.files.keys()].sort()) yield [name, new MemoryFileHandle(name, this.files)];
  }
}

test("keeps source out of the readable workspace manifest", () => {
  const manifest = buildWorkspaceManifest(defaultArtifacts);
  assert.equal(manifest.version, 1);
  assert.equal(manifest.artifacts.length, defaultArtifacts.length);
  assert.equal("source" in manifest.artifacts[0], false);
  const parsed = parseWorkspaceManifest(serializeWorkspaceManifest(defaultArtifacts));
  assert.deepEqual(parsed.errors, []);
  assert.deepEqual(parsed.manifest, manifest);
});

test("writes and reads a complete real-file workspace round trip", async () => {
  const directory = new MemoryDirectory();
  const written = await writeWorkspaceDirectory(directory, defaultArtifacts);
  assert.equal(written.length, defaultArtifacts.length + 1);
  assert.ok(directory.files.has(WORKSPACE_MANIFEST_NAME));
  assert.ok(directory.files.has("q2-review.md"));
  assert.ok(directory.files.has("regional-revenue.chart.json"));
  assert.ok(directory.files.has("board-briefing.deck.md"));

  const result = await readWorkspaceDirectory(directory);
  assert.equal(result.source, "manifest");
  assert.deepEqual(result.errors, []);
  assert.deepEqual(result.artifacts, defaultArtifacts);
});

test("scans a manifest-free folder into stable readable artifacts", async () => {
  const directory = new MemoryDirectory("Loose sources", {
    "report.md": "# Folder report",
    "regional.csv": "Region,Revenue\nAPAC,120",
    ".ignored.md": "# Hidden",
    "notes.txt": "Ignored",
  });
  const result = await readWorkspaceDirectory(directory);
  assert.equal(result.source, "scan");
  assert.deepEqual(result.errors, []);
  assert.deepEqual(result.artifacts.map((artifact) => artifact.id), ["regional", "report"]);
  assert.deepEqual(result.artifacts.map((artifact) => artifact.name), ["regional.csv", "report.md"]);
});

test("rejects duplicate or path-like manifest entries", () => {
  const duplicate = {
    version: 1,
    artifacts: [
      { id: "one", name: "report.md", kind: "document", language: "Markdown" },
      { id: "two", name: "report.md", kind: "document", language: "Markdown" },
    ],
  };
  assert.match(parseWorkspaceManifest(JSON.stringify(duplicate)).errors.join(" "), /unique/);
  duplicate.artifacts[1].name = "../outside.md";
  assert.match(parseWorkspaceManifest(JSON.stringify(duplicate)).errors.join(" "), /plain, non-hidden/);
  assert.throws(
    () => buildWorkspaceManifest([{ ...defaultArtifacts[0], name: "report.csv" }]),
    /does not match its declared document kind/,
  );
});

test("rejects missing and oversized manifest files before replacing workspace state", async () => {
  const missing = new MemoryDirectory("Missing source", {
    [WORKSPACE_MANIFEST_NAME]: JSON.stringify({
      version: 1,
      artifacts: [{ id: "report", name: "report.md", kind: "document", language: "Markdown" }],
    }),
  });
  const missingResult = await readWorkspaceDirectory(missing);
  assert.deepEqual(missingResult.artifacts, []);
  assert.match(missingResult.errors[0], /not found/);

  const oversized = new MemoryDirectory("Oversized", {
    "large.md": "x".repeat(MAX_DIRECTORY_FILE_BYTES + 1),
  });
  await assert.rejects(() => readWorkspaceDirectory(oversized), /2 MB per-file limit/);
});
