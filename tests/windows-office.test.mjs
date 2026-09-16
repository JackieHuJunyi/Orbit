import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import {
  WINDOWS_OFFICE_SCRIPT,
  WINDOWS_OFFICE_TIMEOUT_MS,
  convertWindowsLegacyOffice,
  exportWindowsLegacyOffice,
  isWindowsOfficeApplicationRunning,
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
  assert.match(windowsOfficeScript, /Win32_Process/);
  assert.match(windowsOfficeScript, /WINWORD\.EXE/);
  assert.match(windowsOfficeScript, /POWERPNT\.EXE/);
  assert.match(windowsOfficeScript, /ownershipPath/);
  assert.match(windowsOfficeScript, /WriteOwnedProcessMarker/);
  assert.match(windowsOfficeScript, /RunSafeOfficeCleanup/);
  assert.match(windowsOfficeScript, /GetObject\(, applicationProgId\)/);
  assert.match(windowsOfficeScript, /FindOfficeFile/);
  assert.doesNotMatch(windowsOfficeScript, /GetObject\(filePath\)/u);
  assert.match(windowsOfficeScript, /RevokeOwnedProcessMarker/);
  assert.doesNotMatch(windowsOfficeScript, /taskkill/iu);
  assert.match(windowsOfficeScript, /appStartedByOrbit/);
  assert.match(windowsOfficeScript, /If appStartedByOrbit Then/);
  assert.match(windowsOfficeScript, /AutomationSecurity = 3/);
  assert.match(windowsOfficeScript, /Visible = False/);
  assert.match(windowsOfficeScript, /SaveAs2 outputPath, 16/);
  assert.match(windowsOfficeScript, /SaveAs2 outputPath, 0/);
  assert.match(windowsOfficeScript, /SaveAs outputPath, 24/);
  assert.match(windowsOfficeScript, /SaveAs outputPath, 1/);
  assert.match(windowsOfficeScript, /document\.Close False/);
  assert.match(windowsOfficeScript, /presentation\.Saved = True/);
  assert.match(windowsOfficeScript, /presentation\.Close/);
});

test("detects a running Word or PowerPoint process without opening Office", async () => {
  const calls = [];
  const running = await isWindowsOfficeApplicationRunning("ppt", async (file, args) => {
    calls.push({ file, args });
    return { stdout: '"POWERPNT.EXE","1234","Console","1","42,000 K"\n' };
  });
  assert.equal(running, true);
  assert.deepEqual(calls, [
    {
      file: "tasklist.exe",
      args: ["/FI", "IMAGENAME eq POWERPNT.EXE", "/FO", "CSV", "/NH"],
    },
  ]);
  const notRunning = await isWindowsOfficeApplicationRunning("doc", async () => ({
    stdout: "INFO: No tasks are running which match the specified criteria.\n",
  }));
  assert.equal(notRunning, false);
});

test("refuses conversion when the target application is already running", async () => {
  for (const [fileName, expectedName] of [
    ["review.doc", "Word"],
    ["brief.pptx", "PowerPoint"],
  ]) {
    let helperCalled = false;
    await assert.rejects(
      () =>
        (fileName.endsWith(".doc") ? convertWindowsLegacyOffice : exportWindowsLegacyOffice)(
          undefined,
          { fileName, bytes: new Uint8Array([1, 2, 3]) },
          {
            detect: async () => true,
            run: async () => {
              helperCalled = true;
            },
          },
        ),
      new RegExp(`${expectedName} is already running; close it before Orbit converts`),
    );
    assert.equal(helperCalled, false);
  }
});

test("fails closed when process detection cannot be completed", async () => {
  let helperCalled = false;
  await assert.rejects(
    () =>
      convertWindowsLegacyOffice(
        undefined,
        { fileName: "unknown.doc", bytes: new Uint8Array([1, 2, 3]) },
        {
          detect: async () => {
            throw new Error("tasklist unavailable");
          },
          run: async () => {
            helperCalled = true;
          },
        },
      ),
    /tasklist unavailable/u,
  );
  assert.equal(helperCalled, false);
});

test("converts a bounded legacy Word payload through the injectable helper runner", async () => {
  const calls = [];
  const result = await convertWindowsLegacyOffice(
    undefined,
    { fileName: "review.doc", bytes: new Uint8Array([1, 2, 3]) },
    {
      detect: async () => false,
      run: async (_file, args) => {
        calls.push(args);
        assert.match(args[1], /convert-office\.vbs$/u);
        const outputPath = args[5];
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
      detect: async () => false,
      run: async (_file, args) => {
        assert.match(args[1], /convert-office\.vbs$/u);
        const outputPath = args[5];
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
          detect: async () => false,
          run: async () => {
            const error = new Error("timed out");
            error.killed = true;
            throw error;
          },
          cleanupRun: async () => {},
        },
      ),
    /60 second limit/u,
  );
});

test("uses file-targeted safe cleanup after a Word or PowerPoint helper failure", async () => {
  const cleanupCalls = [];
  for (const [fileName, expectedKind] of [
    ["timed-out.doc", "doc"],
    ["timed-out.ppt", "ppt"],
  ]) {
    await assert.rejects(
      () =>
        convertWindowsLegacyOffice(
          undefined,
          { fileName, bytes: new Uint8Array([1]) },
          {
            detect: async () => false,
            run: async () => {
              const error = new Error("timed out");
              error.killed = true;
              throw error;
            },
            cleanupRun: async (file, args, options) => {
              cleanupCalls.push({ file, args, options, expectedKind });
            },
          },
        ),
      /60 second limit/u,
    );
  }
  assert.equal(cleanupCalls.length, 2);
  for (const { file, args, options, expectedKind } of cleanupCalls) {
    assert.equal(file, "cscript.exe");
    assert.equal(args[0], "//nologo");
    assert.match(args[1], /convert-office\.vbs$/u);
    assert.equal(args[2], expectedKind);
    assert.equal(args[3], "cleanup");
    assert.match(args[4], /source\.(doc|ppt)$/u);
    assert.match(args[5], /timed-out\.(docx|pptx)$/u);
    assert.match(args[6], /office-ownership\.txt$/u);
    assert.equal(options.timeout, 10_000);
  }
});

test("cleans the private conversion directory when the helper fails", async () => {
  let privateDirectory = "";
  await assert.rejects(
    () =>
      convertWindowsLegacyOffice(
        undefined,
        { fileName: "failed.doc", bytes: new Uint8Array([1]) },
        {
          detect: async () => false,
          run: async (_file, args) => {
            privateDirectory = path.dirname(args[4]);
            throw new Error("Office conversion failed");
          },
          cleanupRun: async () => {},
        },
      ),
    /Office conversion failed/u,
  );
  await assert.rejects(() => access(privateDirectory));
});

test("runs the same safe cleanup for a failed PowerPoint conversion", async () => {
  let cleanupCall;
  await assert.rejects(
    () =>
      exportWindowsLegacyOffice(
        undefined,
        { fileName: "failed.pptx", bytes: new Uint8Array([80, 75, 3, 4]) },
        {
          detect: async () => false,
          run: async () => {
            throw new Error("PowerPoint SaveAs failed");
          },
          cleanupRun: async (file, args) => {
            cleanupCall = { file, args };
          },
        },
      ),
    /PowerPoint SaveAs failed/u,
  );
  assert.equal(cleanupCall.file, "cscript.exe");
  assert.equal(cleanupCall.args[2], "ppt");
  assert.equal(cleanupCall.args[3], "cleanup");
  assert.match(cleanupCall.args[4], /source\.pptx$/u);
  assert.match(cleanupCall.args[5], /failed\.ppt$/u);
  assert.match(cleanupCall.args[6], /office-ownership\.txt$/u);
});

test("never falls back to process termination when safe cleanup fails", async () => {
  await assert.rejects(
    () =>
      convertWindowsLegacyOffice(
        undefined,
        { fileName: "cleanup-failed.doc", bytes: new Uint8Array([1]) },
        {
          detect: async () => false,
          run: async () => {
            throw new Error("Office conversion failed");
          },
          cleanupRun: async () => {
            throw new Error("cleanup timed out");
          },
        },
      ),
    /Office conversion failed.*no Office process was force-terminated.*cleanup timed out/u,
  );
});
