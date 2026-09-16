import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  WINDOWS_OFFICE_SCRIPT,
  WINDOWS_OFFICE_TIMEOUT_MS,
  convertWindowsLegacyOffice,
  exportWindowsLegacyOffice,
  windowsOfficeCommand,
} from "../desktop/windows-office.mjs";

const legacyOfficeSource = await readFile(new URL("../desktop/legacy-office.mjs", import.meta.url), "utf8");
const windowsOfficeScript = await readFile(WINDOWS_OFFICE_SCRIPT, "utf8");

test("selects the Windows Script Host COM helper without interpolating file paths", () => {
  const command = windowsOfficeCommand({
    kind: "doc",
    direction: "export",
    inputPath: "C:\\Orbit Files\\review.docx",
    outputPath: "C:\\Orbit Files\\review.doc",
  });
  assert.equal(command.file, "cscript.exe");
  assert.equal(command.args[0], "//nologo");
  assert.match(command.args[1], /convert-office\.vbs$/u);
  assert.deepEqual(command.args.slice(2), [
    "doc",
    "export",
    "C:\\Orbit Files\\review.docx",
    "C:\\Orbit Files\\review.doc",
  ]);
  assert.equal(command.options.timeout, WINDOWS_OFFICE_TIMEOUT_MS);
  assert.equal(command.options.windowsHide, true);
});

test("keeps the macOS implementation and adds only platform-gated Windows dispatch", () => {
  assert.match(legacyOfficeSource, /if \(process\.platform === "win32"\) return convertWindowsLegacyOffice/);
  assert.match(legacyOfficeSource, /if \(process\.platform === "win32"\) return exportWindowsLegacyOffice/);
  assert.match(legacyOfficeSource, /osascript/);
  assert.match(legacyOfficeSource, /open POSIX file/);
  assert.match(legacyOfficeSource, /\/Applications\/Microsoft Word\.app/);
  assert.match(legacyOfficeSource, /\/Applications\/Microsoft PowerPoint\.app/);
});

test("uses isolated IDispatch automation with force-disabled macros and no visible Office UI", () => {
  assert.match(windowsOfficeScript, /CreateObject\("Word\.Application"\)/);
  assert.match(windowsOfficeScript, /CreateObject\("PowerPoint\.Application"\)/);
  assert.match(windowsOfficeScript, /AutomationSecurity = 3/);
  assert.match(windowsOfficeScript, /Visible = False/);
  assert.match(windowsOfficeScript, /SaveAs2 outputPath, 16/);
  assert.match(windowsOfficeScript, /SaveAs2 outputPath, 0/);
  assert.match(windowsOfficeScript, /SaveAs outputPath, 24/);
  assert.match(windowsOfficeScript, /SaveAs outputPath, 1/);
});

test("converts a bounded legacy Word payload through the injectable helper runner", async () => {
  const calls = [];
  const result = await convertWindowsLegacyOffice(
    undefined,
    { fileName: "review.doc", bytes: new Uint8Array([1, 2, 3]) },
    {
      run: async (_file, args) => {
        calls.push(args);
        assert.match(args[1], /convert-office\.vbs$/u);
        const outputPath = args.at(-1);
        await import("node:fs/promises").then(({ writeFile }) => writeFile(outputPath, new Uint8Array([80, 75, 3, 4])));
      },
    },
  );
  assert.equal(result.fileName, "review.docx");
  assert.deepEqual(result.bytes, new Uint8Array([80, 75, 3, 4]));
  assert.match(result.warning, /Office macros force-disabled/);
  assert.equal(calls.length, 1);
  assert.equal(calls[0][2], "doc");
  assert.equal(calls[0][3], "import");
});

test("converts a bounded modern PowerPoint payload to the legacy extension", async () => {
  const result = await exportWindowsLegacyOffice(
    undefined,
    { fileName: "brief.pptx", bytes: new Uint8Array([80, 75, 3, 4]) },
    {
      run: async (_file, args) => {
        assert.match(args[1], /convert-office\.vbs$/u);
        const outputPath = args.at(-1);
        await import("node:fs/promises").then(({ writeFile }) =>
          writeFile(outputPath, new Uint8Array([208, 207, 17, 224])),
        );
      },
    },
  );
  assert.equal(result.fileName, "brief.ppt");
  assert.deepEqual(result.bytes, new Uint8Array([208, 207, 17, 224]));
  assert.match(result.warning, /Office macros force-disabled/);
});

test("turns helper timeout into the same bounded conversion error", async () => {
  await assert.rejects(
    () =>
      convertWindowsLegacyOffice(
        undefined,
        { fileName: "slow.doc", bytes: new Uint8Array([1]) },
        {
          run: async () => {
            const error = new Error("timed out");
            error.killed = true;
            throw error;
          },
        },
      ),
    /60 second limit/u,
  );
});
