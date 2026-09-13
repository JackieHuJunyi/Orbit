import assert from "node:assert/strict";
import test from "node:test";
import {
  MAX_LEGACY_OFFICE_IMPORT_BYTES,
  convertLegacyOfficeFile,
  discoverDesktopModelConnections,
  exportLegacyOfficeFile,
  importDesktopModelConnection,
  legacyOfficeFileName,
  renderDesktopWebPdf,
  supportsLegacyOfficeDesktopConversion,
  supportsLegacyOfficeDesktopExport,
  supportsDesktopWebPdf,
} from "../app/lib/desktop-bridge.ts";

function fakeFile(name, bytes) {
  return {
    name,
    size: bytes.length,
    async arrayBuffer() {
      return Uint8Array.from(bytes).buffer;
    },
  };
}

test("recognizes only legacy Word and PowerPoint binary names", () => {
  assert.equal(legacyOfficeFileName("brief.DOC"), true);
  assert.equal(legacyOfficeFileName("deck.ppt"), true);
  assert.equal(legacyOfficeFileName("brief.docx"), false);
  assert.equal(legacyOfficeFileName("sheet.xls"), false);
});

test("fails closed when the browser has no narrow Orbit desktop bridge", async () => {
  globalThis.window = {};
  assert.equal(supportsLegacyOfficeDesktopConversion(), false);
  await assert.rejects(
    () => convertLegacyOfficeFile(fakeFile("brief.doc", [1, 2, 3])),
    /requires the Orbit desktop app/i,
  );
  delete globalThis.window;
});

test("accepts one bounded converted OOXML package from the desktop bridge", async () => {
  globalThis.window = {
    orbitDesktop: {
      async convertLegacyOffice(input) {
        assert.equal(input.fileName, "brief.doc");
        assert.deepEqual(input.bytes, new Uint8Array([1, 2, 3]));
        return { fileName: "brief.docx", bytes: new Uint8Array([80, 75, 3, 4]), warning: "Converted locally." };
      },
    },
  };
  const result = await convertLegacyOfficeFile(fakeFile("brief.doc", [1, 2, 3]));
  assert.equal(result.fileName, "brief.docx");
  assert.deepEqual(result.bytes, new Uint8Array([80, 75, 3, 4]));
  delete globalThis.window;
});

test("accepts one bounded Web-to-PDF result through the desktop-only bridge", async () => {
  globalThis.window = {
    orbitDesktop: {
      async renderWebPdf(url) {
        assert.equal(url, "https://example.com/report");
        return { fileName: "example.com.pdf", bytes: new Uint8Array([37, 80, 68, 70, 45]) };
      },
    },
  };
  assert.equal(supportsDesktopWebPdf(), true);
  const result = await renderDesktopWebPdf("https://example.com/report");
  assert.equal(result.name, "example.com.pdf");
  assert.deepEqual(result.bytes, new Uint8Array([37, 80, 68, 70, 45]));
  delete globalThis.window;
});

test("exports one bounded DOCX or PPTX package through the narrow desktop bridge", async () => {
  globalThis.window = {
    orbitDesktop: {
      async convertLegacyOffice() {
        throw new Error("not used");
      },
      async exportLegacyOffice(input) {
        assert.equal(input.fileName, "brief.docx");
        assert.deepEqual(input.bytes, new Uint8Array([80, 75, 3, 4]));
        return { fileName: "brief.doc", bytes: new Uint8Array([208, 207, 17, 224]), warning: "Converted locally." };
      },
    },
  };
  assert.equal(supportsLegacyOfficeDesktopExport(), true);
  const result = await exportLegacyOfficeFile({ fileName: "brief.docx", bytes: new Uint8Array([80, 75, 3, 4]) });
  assert.equal(result.fileName, "brief.doc");
  assert.deepEqual(result.bytes, new Uint8Array([208, 207, 17, 224]));
  delete globalThis.window;
});

test("keeps legacy export unavailable on the web and rejects mismatched bridge output", async () => {
  globalThis.window = {};
  assert.equal(supportsLegacyOfficeDesktopExport(), false);
  await assert.rejects(
    () => exportLegacyOfficeFile({ fileName: "brief.docx", bytes: new Uint8Array([1]) }),
    /requires the Orbit desktop app/i,
  );
  globalThis.window = {
    orbitDesktop: {
      async convertLegacyOffice() {
        throw new Error("not used");
      },
      async exportLegacyOffice() {
        return { fileName: "brief.ppt", bytes: [1], warning: "Wrong kind." };
      },
    },
  };
  await assert.rejects(
    () => exportLegacyOfficeFile({ fileName: "brief.docx", bytes: new Uint8Array([1]) }),
    /invalid legacy Office export/i,
  );
  delete globalThis.window;
});

test("rejects unsupported input, invalid bridge output, and oversized legacy files", async () => {
  globalThis.window = {
    orbitDesktop: {
      async convertLegacyOffice() {
        return { fileName: "bad.txt", bytes: [], warning: "" };
      },
    },
  };
  await assert.rejects(() => convertLegacyOfficeFile(fakeFile("sheet.xls", [1])), /\.doc and \.ppt/i);
  await assert.rejects(() => convertLegacyOfficeFile(fakeFile("bad.doc", [1])), /invalid legacy Office conversion/i);
  await assert.rejects(
    () =>
      convertLegacyOfficeFile({
        name: "large.ppt",
        size: MAX_LEGACY_OFFICE_IMPORT_BYTES + 1,
        async arrayBuffer() {
          return new ArrayBuffer(0);
        },
      }),
    /12 MB/i,
  );
  delete globalThis.window;
});

test("normalizes desktop model discovery without exposing credentials in scan results", async () => {
  globalThis.window = {
    orbitDesktop: {
      async discoverModels() {
        return {
          supported: true,
          accounts: [],
          candidates: [
            {
              id: "candidate-1",
              sourceKind: "cc-switch",
              sourceLabel: "CC Switch · Codex",
              locality: "cloud",
              provider: "custom",
              protocol: "responses",
              name: "Team",
              baseURL: "https://models.example.com/v1",
              model: "gpt-team",
              models: ["gpt-team"],
              credentialState: "detected",
            },
          ],
        };
      },
      async importDiscoveredModel(id) {
        assert.equal(id, "candidate-1");
        return {
          provider: "custom",
          protocol: "responses",
          name: "Team",
          baseURL: "https://models.example.com/v1",
          model: "gpt-team",
          apiKey: "secret-only-after-confirm",
        };
      },
    },
  };
  const discovery = await discoverDesktopModelConnections();
  assert.equal(discovery.candidates.length, 1);
  assert.doesNotMatch(JSON.stringify(discovery), /secret/u);
  assert.equal((await importDesktopModelConnection("candidate-1")).apiKey, "secret-only-after-confirm");
  delete globalThis.window;
});

test("accepts redacted signed-in account runtimes without exposing their bridge token", async () => {
  globalThis.window = {
    orbitDesktop: {
      async discoverModels() {
        return {
          supported: true,
          accounts: [
            {
              id: "codex",
              provider: "codex-account",
              label: "ChatGPT",
              sourceLabel: "Codex · ChatGPT account",
              model: "chatgpt-codex-account",
              installed: true,
              status: "ready",
            },
          ],
          candidates: [
            {
              id: "account-candidate",
              sourceKind: "account-runtime",
              sourceLabel: "Codex · ChatGPT account",
              locality: "device",
              provider: "codex-account",
              protocol: "responses",
              name: "Codex · ChatGPT account",
              baseURL: "http://127.0.0.1:54321/__orbit_account__/codex/v1",
              model: "chatgpt-codex-account",
              models: [],
              credentialState: "account-session",
            },
          ],
        };
      },
      async importDiscoveredModel() {
        return {
          provider: "codex-account",
          protocol: "responses",
          name: "Codex · ChatGPT account",
          baseURL: "http://127.0.0.1:54321/__orbit_account__/codex/v1",
          model: "chatgpt-codex-account",
          apiKey: "private-loopback-token",
        };
      },
    },
  };
  const discovery = await discoverDesktopModelConnections();
  assert.equal(discovery.accounts[0].status, "ready");
  assert.equal(discovery.candidates[0].credentialState, "account-session");
  assert.doesNotMatch(JSON.stringify(discovery), /private-loopback-token/u);
  assert.equal((await importDesktopModelConnection("account-candidate")).provider, "codex-account");
  delete globalThis.window;
});

test("rejects a desktop discovery result that attempts to expose a credential", async () => {
  globalThis.window = {
    orbitDesktop: {
      async discoverModels() {
        return {
          supported: true,
          candidates: [
            {
              id: "unsafe",
              sourceKind: "environment",
              sourceLabel: "Environment",
              locality: "cloud",
              provider: "openai",
              protocol: "responses",
              name: "OpenAI",
              baseURL: "https://api.openai.com/v1",
              model: "gpt-5.6",
              models: [],
              credentialState: "detected",
              apiKey: "must-not-cross",
            },
          ],
        };
      },
      async importDiscoveredModel() {
        throw new Error("not used");
      },
    },
  };
  assert.deepEqual((await discoverDesktopModelConnections()).candidates, []);
  delete globalThis.window;
});
