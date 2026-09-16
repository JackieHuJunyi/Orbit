import { execFile } from "node:child_process";
import { mkdtemp, readFile, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export const MAX_WINDOWS_LEGACY_BYTES = 12 * 1024 * 1024;
export const WINDOWS_OFFICE_TIMEOUT_MS = 60_000;
export const WINDOWS_OFFICE_SCRIPT = new URL("./windows/convert-office.vbs", import.meta.url);

const WINDOWS_SCRIPT_HOST = "cscript.exe";
const WINDOWS_OFFICE_PROCESS_NAMES = Object.freeze({ doc: "WINWORD.EXE", ppt: "POWERPNT.EXE" });
const WINDOWS_OFFICE_CLEANUP_OPTIONS = Object.freeze({
  timeout: 10_000,
  windowsHide: true,
  maxBuffer: 128 * 1024,
});

function windowsOfficeDisplayName(kind) {
  return kind === "doc" ? "Word" : "PowerPoint";
}

export async function isWindowsOfficeApplicationRunning(kind, run = execFileAsync) {
  const processName = WINDOWS_OFFICE_PROCESS_NAMES[kind];
  if (!processName) throw new Error("Windows Office conversion kind must be doc or ppt.");
  try {
    const result = await run("tasklist.exe", ["/FI", `IMAGENAME eq ${processName}`, "/FO", "CSV", "/NH"], {
      windowsHide: true,
      maxBuffer: 128 * 1024,
    });
    return String(result?.stdout ?? "")
      .split(/\r?\n/u)
      .some((line) => line.trimStart().toUpperCase().startsWith(`"${processName}"`));
  } catch {
    throw new Error(`Orbit could not safely determine whether Microsoft ${windowsOfficeDisplayName(kind)} is running.`);
  }
}

function windowsOfficeCleanupCommand({
  kind,
  inputPath,
  outputPath,
  ownershipPath,
  scriptPath = fileURLToPath(WINDOWS_OFFICE_SCRIPT),
}) {
  return {
    file: WINDOWS_SCRIPT_HOST,
    args: ["//nologo", scriptPath, kind, "cleanup", inputPath, outputPath, ...(ownershipPath ? [ownershipPath] : [])],
    options: WINDOWS_OFFICE_CLEANUP_OPTIONS,
  };
}

async function cleanupOfficeDocumentSafely({
  kind,
  inputPath,
  outputPath,
  ownershipPath,
  scriptPath,
  cleanupRun = execFileAsync,
}) {
  const cleanupCommand = windowsOfficeCleanupCommand({
    kind,
    inputPath,
    outputPath,
    ownershipPath,
    scriptPath,
  });
  try {
    await cleanupRun(cleanupCommand.file, cleanupCommand.args, cleanupCommand.options);
  } catch (error) {
    const detail = error instanceof Error && error.message ? `: ${error.message}` : "";
    throw new Error(
      `Orbit could not complete safe ${windowsOfficeDisplayName(kind)} cleanup; no Office process was force-terminated${detail}`,
    );
  }
}

function exactLegacyKind(fileName) {
  if (typeof fileName === "string" && /^[^/\\\0]+\.doc$/i.test(fileName)) return "doc";
  if (typeof fileName === "string" && /^[^/\\\0]+\.ppt$/i.test(fileName)) return "ppt";
  throw new Error("Orbit Desktop converts .doc and .ppt files only.");
}

function exactModernKind(fileName) {
  if (typeof fileName === "string" && /^[^/\\\0]+\.docx$/i.test(fileName)) return "doc";
  if (typeof fileName === "string" && /^[^/\\\0]+\.pptx$/i.test(fileName)) return "ppt";
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
  if (!bytes.length || bytes.length > MAX_WINDOWS_LEGACY_BYTES) {
    throw new Error("Legacy Office input must be between 1 byte and 12 MB.");
  }
  return bytes;
}

function baseNameWithoutExtension(fileName, extension) {
  const baseName = path.basename(fileName);
  return baseName.replace(new RegExp(`\\.${extension}$`, "iu"), "");
}

export function windowsOfficeCommand({
  kind,
  direction,
  inputPath,
  outputPath,
  ownershipPath,
  scriptPath = fileURLToPath(WINDOWS_OFFICE_SCRIPT),
}) {
  if (kind !== "doc" && kind !== "ppt") throw new Error("Windows Office conversion kind must be doc or ppt.");
  if (direction !== "import" && direction !== "export") {
    throw new Error("Windows Office conversion direction must be import or export.");
  }
  return {
    file: WINDOWS_SCRIPT_HOST,
    args: ["//nologo", scriptPath, kind, direction, inputPath, outputPath, ...(ownershipPath ? [ownershipPath] : [])],
    options: {
      timeout: WINDOWS_OFFICE_TIMEOUT_MS,
      maxBuffer: 128 * 1024,
      windowsHide: true,
    },
  };
}

export async function runWindowsOfficeConversion({
  kind,
  direction,
  inputPath,
  outputPath,
  scriptPath,
  ownershipPath,
  run = execFileAsync,
  detect = isWindowsOfficeApplicationRunning,
  cleanupRun = execFileAsync,
}) {
  let applicationRunning;
  try {
    applicationRunning = await detect(kind);
  } catch (error) {
    throw new Error(
      error instanceof Error
        ? error.message
        : `Orbit could not safely determine whether Microsoft ${windowsOfficeDisplayName(kind)} is running.`,
    );
  }
  if (applicationRunning) {
    throw new Error(
      `Microsoft ${windowsOfficeDisplayName(kind)} is already running; close it before Orbit converts legacy Office files to protect open documents.`,
    );
  }
  const command = windowsOfficeCommand({ kind, direction, inputPath, outputPath, ownershipPath, scriptPath });
  try {
    await run(command.file, command.args, command.options);
  } catch (error) {
    const conversionError =
      error?.killed || error?.signal || error?.code === "ETIMEDOUT"
        ? new Error("The local Office conversion exceeded Orbit's 60 second limit and was stopped.")
        : error;
    try {
      await cleanupOfficeDocumentSafely({
        kind,
        inputPath,
        outputPath,
        ownershipPath,
        scriptPath: command.args[1],
        cleanupRun,
      });
    } catch (cleanupError) {
      throw new Error(
        `${conversionError instanceof Error ? conversionError.message : "The local Office conversion failed."} Cleanup: ${cleanupError instanceof Error ? cleanupError.message : "Orbit could not clean up the private Office process."}`,
      );
    }
    throw conversionError;
  }
}

async function convertWindowsOffice(input, direction, options = {}) {
  const kind = direction === "import" ? exactLegacyKind(input?.fileName) : exactModernKind(input?.fileName);
  const bytes = coerceBytes(input?.bytes);
  const privateDirectory = await realpath(
    await mkdtemp(
      path.join(
        tmpdir(),
        direction === "import" ? "orbit-legacy-office-windows-" : "orbit-legacy-office-export-windows-",
      ),
    ),
  );
  const modernExtension = kind === "doc" ? "docx" : "pptx";
  const legacyExtension = kind === "doc" ? "doc" : "ppt";
  const inputExtension = direction === "import" ? legacyExtension : modernExtension;
  const outputExtension = direction === "import" ? modernExtension : legacyExtension;
  const inputPath = path.join(privateDirectory, `source.${inputExtension}`);
  const outputName = `${baseNameWithoutExtension(input.fileName, inputExtension)}.${outputExtension}`;
  const outputPath = path.join(privateDirectory, outputName);
  const ownershipPath = path.join(privateDirectory, "office-ownership.txt");
  const scriptPath = path.join(privateDirectory, "convert-office.vbs");
  try {
    await writeFile(inputPath, bytes, { mode: 0o600 });
    await writeFile(scriptPath, await readFile(WINDOWS_OFFICE_SCRIPT), { mode: 0o600 });
    await runWindowsOfficeConversion({
      kind,
      direction,
      inputPath,
      outputPath,
      scriptPath,
      ownershipPath,
      run: options.run,
      detect: options.detect,
      cleanupRun: options.cleanupRun,
    });
    const converted = await readFile(outputPath);
    if (!converted.length || converted.length > MAX_WINDOWS_LEGACY_BYTES) {
      throw new Error(
        direction === "import"
          ? "The converted modern Office file is empty or exceeds 12 MB."
          : "The converted legacy Office file is empty or exceeds 12 MB.",
      );
    }
    return {
      fileName: outputName,
      bytes: new Uint8Array(converted),
      warning:
        direction === "import"
          ? `Orbit Desktop converted ${input.fileName} to ${outputName} locally with Office macros force-disabled. Legacy layout, embedded objects, media, comments, and animation may change; review the generated canonical source before import.`
          : `Orbit Desktop converted ${input.fileName} to ${outputName} locally with Office macros force-disabled. The legacy binary may change typography, layout, vector charts, tables, media, and accessibility; open the downloaded result in Office and verify it before delivery.`,
    };
  } catch (error) {
    throw new Error(
      error instanceof Error ? error.message : "Orbit Desktop could not convert that legacy Office file.",
    );
  } finally {
    await rm(privateDirectory, { recursive: true, force: true });
  }
}

export async function convertWindowsLegacyOffice(_event, input, options) {
  return convertWindowsOffice(input, "import", options);
}

export async function exportWindowsLegacyOffice(_event, input, options) {
  return convertWindowsOffice(input, "export", options);
}
