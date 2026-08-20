import assert from "node:assert/strict";
import test from "node:test";

import {
  MAX_DIRECTORY_FILE_BYTES,
  WORKSPACE_MANIFEST_NAME,
  WORKSPACE_ASSET_DIRECTORY_NAME,
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
      size: typeof source === "string" ? new TextEncoder().encode(source).byteLength : source.byteLength,
      async text() {
        return typeof source === "string" ? source : new TextDecoder().decode(source);
      },
      async arrayBuffer() {
        return typeof source === "string" ? new TextEncoder().encode(source).buffer : source.slice().buffer;
      },
    };
  }

  async createWritable() {
    let source = "";
    return {
      write: async (nextSource) => {
        source = typeof nextSource === "string" ? nextSource : nextSource.slice();
      },
      close: async () => {
        this.files.set(this.name, source);
      },
    };
  }
}

class MemoryDirectory {
  kind = "directory";

  constructor(name = "Rune workspace", initial = {}) {
    this.name = name;
    this.files = new Map(Object.entries(initial));
    this.directories = new Map();
  }

  async getFileHandle(name, options = {}) {
    if (!this.files.has(name) && !options.create) throw new Error(`not found: ${name}`);
    return new MemoryFileHandle(name, this.files);
  }

  async *entries() {
    for (const name of [...this.files.keys()].sort()) yield [name, new MemoryFileHandle(name, this.files)];
  }

  async getDirectoryHandle(name, options = {}) {
    if (!this.directories.has(name) && !options.create) throw new Error(`not found: ${name}`);
    if (!this.directories.has(name)) this.directories.set(name, new MemoryDirectory(name));
    return this.directories.get(name);
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
  assert.ok(directory.files.has("board-briefing.html"));

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
  assert.deepEqual(
    result.artifacts.map((artifact) => artifact.id),
    ["regional", "report"],
  );
  assert.deepEqual(
    result.artifacts.map((artifact) => artifact.name),
    ["regional.csv", "report.md"],
  );
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

test("writes and rereads exactly referenced content-hash assets through the hidden folder", async () => {
  const png = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 1, 2, 3]);
  const id = "0f6c3a09018d44c79811cb205e1e03f0f214fdd8728f82e6e92aaaf95da5ee49";
  const artifacts = [
    {
      id: "report",
      name: "report.md",
      kind: "document",
      language: "Markdown",
      source: `# Report\n\n![View](rune-asset:sha256:${id})`,
    },
  ];
  const assets = [{ id, name: "view.png", mimeType: "image/png", size: png.length, bytes: png }];
  const directory = new MemoryDirectory();
  const written = await writeWorkspaceDirectory(directory, artifacts, assets);
  assert.deepEqual(written, ["report.md", WORKSPACE_MANIFEST_NAME]);
  assert.ok(directory.directories.has(WORKSPACE_ASSET_DIRECTORY_NAME));
  assert.ok(directory.directories.get(WORKSPACE_ASSET_DIRECTORY_NAME).files.has(`${id}.png`));
  const manifest = JSON.parse(directory.files.get(WORKSPACE_MANIFEST_NAME));
  assert.equal(manifest.version, 2);
  assert.deepEqual(manifest.assets, [{ id, name: "view.png", mimeType: "image/png", size: png.length }]);
  const result = await readWorkspaceDirectory(directory);
  assert.deepEqual(result.errors, []);
  assert.deepEqual(result.artifacts, artifacts);
  assert.equal(result.assets.length, 1);
  assert.deepEqual(result.assets[0].bytes, png);
});

test("refuses missing, corrupt, unreferenced, and manifest-free folder assets", async () => {
  const id = "a".repeat(64);
  const artifact = {
    id: "report",
    name: "report.md",
    kind: "document",
    language: "Markdown",
    source: `# Report\n\n![View](rune-asset:sha256:${id})`,
  };
  assert.throws(() => buildWorkspaceManifest([artifact]), /missing/);
  const png = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  assert.throws(
    () =>
      buildWorkspaceManifest(
        [{ ...artifact, source: "# Report" }],
        [{ id, name: "x.png", mimeType: "image/png", size: png.length, bytes: png }],
      ),
    /not referenced/,
  );
  await assert.rejects(
    () =>
      writeWorkspaceDirectory(
        new MemoryDirectory(),
        [artifact],
        [{ id, name: "x.png", mimeType: "image/png", size: png.length, bytes: png }],
      ),
    /content verification/,
  );
  const loose = new MemoryDirectory("Loose", { "report.md": artifact.source });
  const looseResult = await readWorkspaceDirectory(loose);
  assert.match(looseResult.errors.join(" "), /manifest-free folder/);
});
