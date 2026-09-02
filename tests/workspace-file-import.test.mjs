import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  MAX_WORKSPACE_IMPORT_FILES,
  WORKSPACE_IMPORT_ACCEPT,
  convertWorkspaceImportFiles,
  firstWorkspaceImportOversizeNotice,
  isWorkspacePdfImportFile,
  workspaceImportFilePolicy,
  workspaceImportOversizeNotice,
} from "../app/lib/workspace-file-import.ts";

function sourceFile(name, source) {
  const bytes = new TextEncoder().encode(source);
  return {
    name,
    size: bytes.length,
    async text() {
      return source;
    },
    async arrayBuffer() {
      return bytes.slice().buffer;
    },
  };
}

test("resolves every import family through one ordered case-insensitive policy", () => {
  assert.deepEqual(workspaceImportFilePolicy("brief.DOC"), {
    format: "legacy-office",
    maxBytes: 12 * 1024 * 1024,
    limitName: "desktop legacy Office",
  });
  assert.equal(workspaceImportFilePolicy("book.XLSX").format, "office");
  assert.equal(workspaceImportFilePolicy("board.ODP").format, "odf");
  assert.equal(workspaceImportFilePolicy("scan.PDF").format, "pdf");
  assert.equal(workspaceImportFilePolicy("notes.markdown").format, "source");
  assert.equal(workspaceImportFilePolicy("unknown.bin").format, "source");
  assert.equal(isWorkspacePdfImportFile("scan.PdF"), true);
  assert.equal(isWorkspacePdfImportFile("scan.pdf.txt"), false);
  assert.equal(MAX_WORKSPACE_IMPORT_FILES, 20);
  assert.equal(
    WORKSPACE_IMPORT_ACCEPT,
    ".doc,.ppt,.docx,.xlsx,.pptx,.odt,.ods,.odp,.pdf,.deck.md,.md,.markdown,.csv,.json,.sql,.html,.htm",
  );
});

test("owns package and readable-source size limits without mutating file facts", () => {
  const source = Object.freeze({ name: "large.md", size: 2 * 1024 * 1024 + 1 });
  const office = Object.freeze({ name: "large.docx", size: 12 * 1024 * 1024 + 1 });
  const pdf = Object.freeze({ name: "large.pdf", size: 12 * 1024 * 1024 });

  assert.equal(workspaceImportOversizeNotice(pdf), null);
  assert.equal(workspaceImportOversizeNotice(source), "large.md exceeds the 2 MB source import limit");
  assert.equal(workspaceImportOversizeNotice(office), "large.docx exceeds the 12 MB Office import limit");
  assert.equal(firstWorkspaceImportOversizeNotice([pdf, office, source]), workspaceImportOversizeNotice(office));
  assert.deepEqual(source, { name: "large.md", size: 2 * 1024 * 1024 + 1 });
  assert.deepEqual(office, { name: "large.docx", size: 12 * 1024 * 1024 + 1 });
});

test("converts a mixed readable-source batch in input order through the shared path", async () => {
  const files = Object.freeze([
    sourceFile("brief.md", "# Brief\n\nReady.\n"),
    sourceFile("model.csv", "region,revenue\nNorth,120\n"),
    sourceFile(
      "board.html",
      '<main data-rune-format="presentation-v1" data-title="Board"><section data-slide-index="1"><h1>Board</h1></section></main>',
    ),
  ]);
  const active = [];
  const result = await convertWorkspaceImportFiles(files, { onActiveFileName: (name) => active.push(name) });

  assert.deepEqual(
    result.artifacts.map(({ name, kind }) => ({ name, kind })),
    [
      { name: "brief.md", kind: "document" },
      { name: "model.csv", kind: "data" },
      { name: "board.html", kind: "slides" },
    ],
  );
  assert.deepEqual(active, ["brief.md", "model.csv", "board.html"]);
  assert.deepEqual(result.warnings, []);
  assert.deepEqual(result.assets, []);
  assert.equal(files[0].name, "brief.md");
});

test("fails closed for an unsupported source instead of inventing a canonical artifact", async () => {
  await assert.rejects(
    () => convertWorkspaceImportFiles([sourceFile("archive.bin", "not a readable Orbit source")]),
    /choose Markdown, CSV, JSON, SQL, Deck Markdown, HTML, PDF, DOCX, XLSX, PPTX, ODT, ODS, or ODP/i,
  );
});

test("keeps heavyweight converters deferred and removes duplicated format branching from Workbench", async () => {
  const [adapterSource, workbenchSource] = await Promise.all([
    readFile(new URL("../app/lib/workspace-file-import.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/components/rune-workbench.tsx", import.meta.url), "utf8"),
  ]);

  for (const moduleName of ["office-import", "odf-import", "pdf-import-client"]) {
    assert.match(adapterSource, new RegExp(`import\\(\"\\./${moduleName}\\.ts\"\\)`));
    assert.doesNotMatch(adapterSource, new RegExp(`^import\\s+[^;]+from\\s+\"\\./${moduleName}\\.ts\"`, "m"));
    assert.doesNotMatch(workbenchSource, new RegExp(`import\\(\"\\.\\./lib/${moduleName}`));
  }
  assert.doesNotMatch(workbenchSource, /OFFICE_IMPORT_PATTERN|ODF_IMPORT_PATTERN|PDF_IMPORT_PATTERN/);
  assert.doesNotMatch(workbenchSource, /accept="\.doc,/);
  assert.match(workbenchSource, /accept={WORKSPACE_IMPORT_ACCEPT}/);
  assert.match(workbenchSource, /analyzeWorkspaceImportPdfs\(files\)/);
  assert.equal(workbenchSource.match(/convertWorkspaceImportFiles\(/g)?.length, 2);
});
