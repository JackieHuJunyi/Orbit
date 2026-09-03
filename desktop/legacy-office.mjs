import { execFile } from "node:child_process";
import { access, mkdtemp, readFile, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
export const MAX_LEGACY_BYTES = 12 * 1024 * 1024;
export const CONVERSION_TIMEOUT_MS = 60_000;
const WORD_PATH = "/Applications/Microsoft Word.app";
const POWERPOINT_PATH = "/Applications/Microsoft PowerPoint.app";

export function exactLegacyKind(fileName) {
  if (/^[^/\\\0]+\.doc$/i.test(fileName)) return "doc";
  if (/^[^/\\\0]+\.ppt$/i.test(fileName)) return "ppt";
  throw new Error("Orbit Desktop converts .doc and .ppt files only.");
}

export function exactModernKind(fileName) {
  if (/^[^/\\\0]+\.docx$/i.test(fileName)) return "doc";
  if (/^[^/\\\0]+\.pptx$/i.test(fileName)) return "ppt";
  throw new Error("Orbit Desktop exports DOCX and PPTX packages to legacy Office only.");
}

function coerceBytes(value) {
  const bytes =
    value instanceof Uint8Array
      ? value
      : value instanceof ArrayBuffer
        ? new Uint8Array(value)
        : Array.isArray(value)
          ? Uint8Array.from(value)
          : new Uint8Array();
  if (!bytes.length || bytes.length > MAX_LEGACY_BYTES)
    throw new Error("Legacy Office input must be between 1 byte and 12 MB.");
  return bytes;
}

export function legacyConversionAppleScript(kind, inputPath, outputPath) {
  const input = JSON.stringify(inputPath);
  const output = JSON.stringify(outputPath);
  if (kind === "doc")
    return `
tell application "Microsoft Word"
  set oldSecurity to automation security
  set oldAlerts to display alerts
  set automation security to msoAutomationSecurityForceDisable
  set display alerts to alerts none
  set convertedDocument to missing value
  try
    open POSIX file ${input}
    repeat 100 times
      if (count documents) > 0 then exit repeat
      delay 0.1
    end repeat
    if (count documents) is 0 then error "Microsoft Word did not finish opening the conversion source."
    set convertedDocument to active document
    save as convertedDocument file name ${output} file format format document add to recent files false
    set convertedDocument to active document
    close convertedDocument saving no
  on error errorMessage number errorNumber
    try
      if convertedDocument is not missing value then close convertedDocument saving no
    end try
    set display alerts to oldAlerts
    set automation security to oldSecurity
    error errorMessage number errorNumber
  end try
  set display alerts to oldAlerts
  set automation security to oldSecurity
end tell`;
  return `
tell application "Microsoft PowerPoint"
  set oldSecurity to automation security
  set automation security to msoAutomationSecurityForceDisable
  set hadSecurityValue to oldSecurity is not missing value
  set convertedPresentation to missing value
  try
    open POSIX file ${input}
    repeat 100 times
      if (count presentations) > 0 then exit repeat
      delay 0.1
    end repeat
    if (count presentations) is 0 then error "Microsoft PowerPoint did not finish opening the conversion source."
    set convertedPresentation to active presentation
    save convertedPresentation in POSIX file ${output} as save as Open XML presentation
    repeat with openPresentation in (get presentations)
      try
        set openPresentationPath to full name of openPresentation as text
        if openPresentationPath is ${input} or openPresentationPath is ${output} then close openPresentation
      end try
    end repeat
  on error errorMessage number errorNumber
    repeat with openPresentation in (get presentations)
      try
        set openPresentationPath to full name of openPresentation as text
        if openPresentationPath is ${input} or openPresentationPath is ${output} then close openPresentation
      end try
    end repeat
    if hadSecurityValue then set automation security to oldSecurity
    error errorMessage number errorNumber
  end try
  if hadSecurityValue then set automation security to oldSecurity
end tell`;
}

export function legacyExportAppleScript(kind, inputPath, outputPath) {
  const input = JSON.stringify(inputPath);
  const output = JSON.stringify(outputPath);
  if (kind === "doc")
    return `
tell application "Microsoft Word"
  set oldSecurity to automation security
  set oldAlerts to display alerts
  set automation security to msoAutomationSecurityForceDisable
  set display alerts to alerts none
  set exportedDocument to missing value
  try
    open POSIX file ${input}
    repeat 100 times
      if (count documents) > 0 then exit repeat
      delay 0.1
    end repeat
    if (count documents) is 0 then error "Microsoft Word did not finish opening the export source."
    set exportedDocument to active document
    save as exportedDocument file name ${output} file format format document97 add to recent files false
    set exportedDocument to active document
    close exportedDocument saving no
  on error errorMessage number errorNumber
    try
      if exportedDocument is not missing value then close exportedDocument saving no
    end try
    set display alerts to oldAlerts
    set automation security to oldSecurity
    error errorMessage number errorNumber
  end try
  set display alerts to oldAlerts
  set automation security to oldSecurity
end tell`;
  return `
tell application "Microsoft PowerPoint"
  set oldSecurity to automation security
  set automation security to msoAutomationSecurityForceDisable
  set hadSecurityValue to oldSecurity is not missing value
  set exportedPresentation to missing value
  try
    open POSIX file ${input}
    repeat 100 times
      if (count presentations) > 0 then exit repeat
      delay 0.1
    end repeat
    if (count presentations) is 0 then error "Microsoft PowerPoint did not finish opening the export source."
    set exportedPresentation to active presentation
    save exportedPresentation in POSIX file ${output} as save as presentation
    repeat with openPresentation in (get presentations)
      try
        set openPresentationPath to full name of openPresentation as text
        if openPresentationPath is ${input} or openPresentationPath is ${output} then close openPresentation
      end try
    end repeat
  on error errorMessage number errorNumber
    repeat with openPresentation in (get presentations)
      try
        set openPresentationPath to full name of openPresentation as text
        if openPresentationPath is ${input} or openPresentationPath is ${output} then close openPresentation
      end try
    end repeat
    if hadSecurityValue then set automation security to oldSecurity
    error errorMessage number errorNumber
  end try
  if hadSecurityValue then set automation security to oldSecurity
end tell`;
}

async function officeAvailable(kind) {
  const officePath = kind === "doc" ? WORD_PATH : POWERPOINT_PATH;
  const available = await access(officePath).then(
    () => true,
    () => false,
  );
  if (!available)
    throw new Error(
      `${kind === "doc" ? "Microsoft Word" : "Microsoft PowerPoint"} is required for this local conversion.`,
    );
}

async function officeProcessRunning(kind) {
  const executable =
    kind === "doc"
      ? `${WORD_PATH}/Contents/MacOS/Microsoft Word`
      : `${POWERPOINT_PATH}/Contents/MacOS/Microsoft PowerPoint`;
  try {
    await execFileAsync("/usr/bin/pgrep", ["-f", executable], { timeout: 2_000, maxBuffer: 8 * 1024 });
    return true;
  } catch (error) {
    if (error?.code === 1) return false;
    // A process-inspection failure must never authorize Orbit to quit an app
    // that may already belong to the user.
    return true;
  }
}

async function quitOfficeStartedByOrbit(kind) {
  const applicationName = kind === "doc" ? "Microsoft Word" : "Microsoft PowerPoint";
  await execFileAsync(
    "/usr/bin/osascript",
    ["-e", `tell application ${JSON.stringify(applicationName)} to quit saving no`],
    {
      timeout: 10_000,
      maxBuffer: 32 * 1024,
      windowsHide: true,
    },
  ).catch(() => undefined);
}

async function runConversion(source) {
  try {
    await execFileAsync("/usr/bin/osascript", ["-e", source], {
      timeout: CONVERSION_TIMEOUT_MS,
      maxBuffer: 128 * 1024,
      windowsHide: true,
    });
  } catch (error) {
    if (error?.killed || error?.signal)
      throw new Error("The local Office conversion exceeded Orbit's 60 second limit and was stopped.");
    throw error;
  }
}

export async function convertLegacyOffice(_event, input) {
  const kind = exactLegacyKind(input?.fileName ?? "");
  const bytes = coerceBytes(input?.bytes);
  const officeWasRunning = await officeProcessRunning(kind);
  await officeAvailable(kind);
  const privateDirectory = await realpath(await mkdtemp(path.join(tmpdir(), "rune-legacy-office-")));
  const inputPath = path.join(privateDirectory, `source.${kind}`);
  const outputName = `${path.basename(input.fileName, `.${kind}`)}.${kind}x`;
  const outputPath = path.join(privateDirectory, outputName);
  try {
    await writeFile(inputPath, bytes, { mode: 0o600 });
    await runConversion(legacyConversionAppleScript(kind, inputPath, outputPath));
    const converted = await readFile(outputPath);
    if (!converted.length || converted.length > MAX_LEGACY_BYTES)
      throw new Error("The converted modern Office file is empty or exceeds 12 MB.");
    return {
      fileName: outputName,
      bytes: new Uint8Array(converted),
      warning: `Orbit Desktop converted ${input.fileName} to ${outputName} locally with Office macros force-disabled. Legacy layout, embedded objects, media, comments, and animation may change; review the generated canonical source before import.`,
    };
  } catch (error) {
    if (error?.killed || error?.signal)
      throw new Error("The local Office conversion exceeded Orbit's 60 second limit and was stopped.");
    throw new Error(
      error instanceof Error ? error.message : "Orbit Desktop could not convert that legacy Office file.",
    );
  } finally {
    if (!officeWasRunning) await quitOfficeStartedByOrbit(kind);
    await rm(privateDirectory, { recursive: true, force: true });
  }
}

export async function exportLegacyOffice(_event, input) {
  const kind = exactModernKind(input?.fileName ?? "");
  const bytes = coerceBytes(input?.bytes);
  const officeWasRunning = await officeProcessRunning(kind);
  await officeAvailable(kind);
  const privateDirectory = await realpath(await mkdtemp(path.join(tmpdir(), "rune-legacy-office-export-")));
  const modernExtension = kind === "doc" ? "docx" : "pptx";
  const legacyExtension = kind === "doc" ? "doc" : "ppt";
  const inputPath = path.join(privateDirectory, `source.${modernExtension}`);
  const outputName = `${path.basename(input.fileName, `.${modernExtension}`)}.${legacyExtension}`;
  const outputPath = path.join(privateDirectory, outputName);
  try {
    await writeFile(inputPath, bytes, { mode: 0o600 });
    await runConversion(legacyExportAppleScript(kind, inputPath, outputPath));
    const converted = await readFile(outputPath);
    if (!converted.length || converted.length > MAX_LEGACY_BYTES)
      throw new Error("The converted legacy Office file is empty or exceeds 12 MB.");
    return {
      fileName: outputName,
      bytes: new Uint8Array(converted),
      warning: `Orbit Desktop converted ${input.fileName} to ${outputName} locally with Office macros force-disabled. The legacy binary may change typography, layout, vector charts, tables, media, and accessibility; open the downloaded result in Office and verify it before delivery.`,
    };
  } catch (error) {
    throw new Error(error instanceof Error ? error.message : "Orbit Desktop could not create that legacy Office file.");
  } finally {
    if (!officeWasRunning) await quitOfficeStartedByOrbit(kind);
    await rm(privateDirectory, { recursive: true, force: true });
  }
}
