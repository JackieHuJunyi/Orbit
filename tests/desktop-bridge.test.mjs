import assert from "node:assert/strict";
import test from "node:test";
import {
  MAX_LEGACY_OFFICE_IMPORT_BYTES,
  convertLegacyOfficeFile,
  exportLegacyOfficeFile,
  legacyOfficeFileName,
  supportsLegacyOfficeDesktopConversion,
  supportsLegacyOfficeDesktopExport,
} from "../app/lib/desktop-bridge.ts";

function fakeFile(name, bytes) {
  return { name, size: bytes.length, async arrayBuffer() { return Uint8Array.from(bytes).buffer; } };
}

test("recognizes only legacy Word and PowerPoint binary names", () => {
  assert.equal(legacyOfficeFileName("brief.DOC"), true);
  assert.equal(legacyOfficeFileName("deck.ppt"), true);
  assert.equal(legacyOfficeFileName("brief.docx"), false);
  assert.equal(legacyOfficeFileName("sheet.xls"), false);
});

test("fails closed when the browser has no narrow Rune desktop bridge", async () => {
  globalThis.window = {};
  assert.equal(supportsLegacyOfficeDesktopConversion(), false);
  await assert.rejects(() => convertLegacyOfficeFile(fakeFile("brief.doc", [1, 2, 3])), /requires the Rune desktop app/i);
  delete globalThis.window;
});

test("accepts one bounded converted OOXML package from the desktop bridge", async () => {
  globalThis.window = { runeDesktop: { async convertLegacyOffice(input) {
    assert.equal(input.fileName, "brief.doc");
    assert.deepEqual(input.bytes, new Uint8Array([1, 2, 3]));
    return { fileName: "brief.docx", bytes: new Uint8Array([80, 75, 3, 4]), warning: "Converted locally." };
  } } };
  const result = await convertLegacyOfficeFile(fakeFile("brief.doc", [1, 2, 3]));
  assert.equal(result.fileName, "brief.docx");
  assert.deepEqual(result.bytes, new Uint8Array([80, 75, 3, 4]));
  delete globalThis.window;
});

test("exports one bounded DOCX or PPTX package through the narrow desktop bridge", async () => {
  globalThis.window = { runeDesktop: {
    async convertLegacyOffice() { throw new Error("not used"); },
    async exportLegacyOffice(input) {
      assert.equal(input.fileName, "brief.docx");
      assert.deepEqual(input.bytes, new Uint8Array([80, 75, 3, 4]));
      return { fileName: "brief.doc", bytes: new Uint8Array([208, 207, 17, 224]), warning: "Converted locally." };
    },
  } };
  assert.equal(supportsLegacyOfficeDesktopExport(), true);
  const result = await exportLegacyOfficeFile({ fileName: "brief.docx", bytes: new Uint8Array([80, 75, 3, 4]) });
  assert.equal(result.fileName, "brief.doc");
  assert.deepEqual(result.bytes, new Uint8Array([208, 207, 17, 224]));
  delete globalThis.window;
});

test("keeps legacy export unavailable on the web and rejects mismatched bridge output", async () => {
  globalThis.window = {};
  assert.equal(supportsLegacyOfficeDesktopExport(), false);
  await assert.rejects(() => exportLegacyOfficeFile({ fileName: "brief.docx", bytes: new Uint8Array([1]) }), /requires the Rune desktop app/i);
  globalThis.window = { runeDesktop: {
    async convertLegacyOffice() { throw new Error("not used"); },
    async exportLegacyOffice() { return { fileName: "brief.ppt", bytes: [1], warning: "Wrong kind." }; },
  } };
  await assert.rejects(() => exportLegacyOfficeFile({ fileName: "brief.docx", bytes: new Uint8Array([1]) }), /invalid legacy Office export/i);
  delete globalThis.window;
});

test("rejects unsupported input, invalid bridge output, and oversized legacy files", async () => {
  globalThis.window = { runeDesktop: { async convertLegacyOffice() { return { fileName: "bad.txt", bytes: [], warning: "" }; } } };
  await assert.rejects(() => convertLegacyOfficeFile(fakeFile("sheet.xls", [1])), /\.doc and \.ppt/i);
  await assert.rejects(() => convertLegacyOfficeFile(fakeFile("bad.doc", [1])), /invalid legacy Office conversion/i);
  await assert.rejects(() => convertLegacyOfficeFile({ name: "large.ppt", size: MAX_LEGACY_OFFICE_IMPORT_BYTES + 1, async arrayBuffer() { return new ArrayBuffer(0); } }), /12 MB/i);
  delete globalThis.window;
});
