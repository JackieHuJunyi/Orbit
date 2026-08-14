import { execFile } from "node:child_process";
import { access, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
export const MAX_LEGACY_BYTES = 12 * 1024 * 1024;
export const CONVERSION_TIMEOUT_MS = 30_000;
const WORD_PATH = "/Applications/Microsoft Word.app";
const POWERPOINT_PATH = "/Applications/Microsoft PowerPoint.app";

export function exactLegacyKind(fileName) {
  if (/^[^/\\\0]+\.doc$/i.test(fileName)) return "doc";
  if (/^[^/\\\0]+\.ppt$/i.test(fileName)) return "ppt";
  throw new Error("Rune Desktop converts .doc and .ppt files only.");
}

export function exactModernKind(fileName) {
  if (/^[^/\\\0]+\.docx$/i.test(fileName)) return "doc";
  if (/^[^/\\\0]+\.pptx$/i.test(fileName)) return "ppt";
  throw new Error("Rune Desktop exports DOCX and PPTX packages to legacy Office only.");
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
  set automation security to msoAutomationSecurityForceDisable
  set convertedDocument to missing value
  try
    open file name ${input} read only true add to recent files false
    set convertedDocument to active document
    save as convertedDocument file name ${output} file format format document add to recent files false
    close convertedDocument saving no
  on error errorMessage number errorNumber
    try
      if convertedDocument is not missing value then close convertedDocument saving no
    end try
    set automation security to oldSecurity
    error errorMessage number errorNumber
  end try
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
    set convertedPresentation to active presentation
    save convertedPresentation in POSIX file ${output} as save as Open XML presentation
    close convertedPresentation
  on error errorMessage number errorNumber
    try
      if convertedPresentation is not missing value then close convertedPresentation
    end try
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
  set automation security to msoAutomationSecurityForceDisable
  set exportedDocument to missing value
  try
    open file name ${input} read only true add to recent files false
    set exportedDocument to active document
    save as exportedDocument file name ${output} file format format document97 add to recent files false
    close exportedDocument saving no
  on error errorMessage number errorNumber
    try
      if exportedDocument is not missing value then close exportedDocument saving no
    end try
    set automation security to oldSecurity
    error errorMessage number errorNumber
  end try
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
    set exportedPresentation to active presentation
    save exportedPresentation in POSIX file ${output} as save as presentation
    close exportedPresentation
  on error errorMessage number errorNumber
    try
      if exportedPresentation is not missing value then close exportedPresentation
    end try
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

async function runConversion(source) {
  try {
    await execFileAsync("/usr/bin/osascript", ["-e", source], {
      timeout: CONVERSION_TIMEOUT_MS,
      maxBuffer: 128 * 1024,
      windowsHide: true,
    });
  } catch (error) {
    if (error?.killed || error?.signal)
      throw new Error("The local Office conversion exceeded Rune's 30 second limit and was stopped.");
    throw error;
  }
}

export async function convertLegacyOffice(_event, input) {
  const kind = exactLegacyKind(input?.fileName ?? "");
  const bytes = coerceBytes(input?.bytes);
  await officeAvailable(kind);
  const privateDirectory = await mkdtemp(path.join(tmpdir(), "rune-legacy-office-"));
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
      warning: `Rune Desktop converted ${input.fileName} to ${outputName} locally with Office macros force-disabled. Legacy layout, embedded objects, media, comments, and animation may change; review the generated canonical source before import.`,
    };
  } catch (error) {
    if (error?.killed || error?.signal)
      throw new Error("The local Office conversion exceeded Rune's 30 second limit and was stopped.");
    throw new Error(error instanceof Error ? error.message : "Rune Desktop could not convert that legacy Office file.");
  } finally {
    await rm(privateDirectory, { recursive: true, force: true });
  }
}

export async function exportLegacyOffice(_event, input) {
  const kind = exactModernKind(input?.fileName ?? "");
  const bytes = coerceBytes(input?.bytes);
  await officeAvailable(kind);
  const privateDirectory = await mkdtemp(path.join(tmpdir(), "rune-legacy-office-export-"));
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
      warning: `Rune Desktop converted ${input.fileName} to ${outputName} locally with Office macros force-disabled. The legacy binary may change typography, layout, vector charts, tables, media, and accessibility; open the downloaded result in Office and verify it before delivery.`,
    };
  } catch (error) {
    throw new Error(error instanceof Error ? error.message : "Rune Desktop could not create that legacy Office file.");
  } finally {
    await rm(privateDirectory, { recursive: true, force: true });
  }
}
