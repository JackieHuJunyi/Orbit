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
  scriptPath = fileURLToPath(WINDOWS_OFFICE_SCRIPT),
}) {
  if (kind !== "doc" && kind !== "ppt") throw new Error("Windows Office conversion kind must be doc or ppt.");
  if (direction !== "import" && direction !== "export") {
    throw new Error("Windows Office conversion direction must be import or export.");
  }
  return {
    file: WINDOWS_SCRIPT_HOST,
    args: ["//nologo", scriptPath, kind, direction, inputPath, outputPath],
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
  run = execFileAsync,
}) {
  const command = windowsOfficeCommand({ kind, direction, inputPath, outputPath, scriptPath });
  try {
    await run(command.file, command.args, command.options);
  } catch (error) {
    if (error?.killed || error?.signal || error?.code === "ETIMEDOUT") {
      throw new Error("The local Office conversion exceeded Orbit's 60 second limit and was stopped.");
    }
    throw error;
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
      run: options.run,
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
