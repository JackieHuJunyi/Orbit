export const MAX_LEGACY_OFFICE_IMPORT_BYTES = 12 * 1024 * 1024;
export const MAX_LEGACY_OFFICE_EXPORT_BYTES = 12 * 1024 * 1024;

export type LegacyOfficeConversion = {
  bytes: Uint8Array;
  fileName: string;
  warning: string;
};

type RuneDesktopApi = {
  convertLegacyOffice(input: { bytes: Uint8Array; fileName: string }): Promise<{
    bytes: Uint8Array | ArrayBuffer | number[];
    fileName: string;
    warning: string;
  }>;
  exportLegacyOffice(input: { bytes: Uint8Array; fileName: string }): Promise<{
    bytes: Uint8Array | ArrayBuffer | number[];
    fileName: string;
    warning: string;
  }>;
};

declare global {
  interface Window {
    runeDesktop?: RuneDesktopApi;
  }
}

export function legacyOfficeFileName(name: string) {
  return /\.(?:doc|ppt)$/i.test(name);
}

export function supportsLegacyOfficeDesktopConversion() {
  return typeof window !== "undefined" && typeof window.runeDesktop?.convertLegacyOffice === "function";
}

export function supportsLegacyOfficeDesktopExport() {
  return typeof window !== "undefined" && typeof window.runeDesktop?.exportLegacyOffice === "function";
}

function resultBytes(value: Uint8Array | ArrayBuffer | number[]) {
  return value instanceof Uint8Array
    ? value
    : value instanceof ArrayBuffer
      ? new Uint8Array(value)
      : Array.isArray(value)
        ? Uint8Array.from(value)
        : new Uint8Array();
}

export async function convertLegacyOfficeFile(file: File): Promise<LegacyOfficeConversion> {
  if (!legacyOfficeFileName(file.name)) throw new Error("Desktop legacy conversion supports .doc and .ppt files only.");
  if (!supportsLegacyOfficeDesktopConversion()) {
    throw new Error(
      "Legacy .doc/.ppt import requires the Rune desktop app with Microsoft Word or PowerPoint installed. The web app will not upload or guess this binary format.",
    );
  }
  if (!file.size) throw new Error(`${file.name}: the selected legacy Office file is empty.`);
  if (file.size > MAX_LEGACY_OFFICE_IMPORT_BYTES)
    throw new Error(`${file.name}: legacy Office import is limited to 12 MB.`);
  const inputBytes = new Uint8Array(await file.arrayBuffer());
  const result = await window.runeDesktop!.convertLegacyOffice({ fileName: file.name, bytes: inputBytes });
  if (!result || !/\.(?:docx|pptx)$/i.test(result.fileName) || typeof result.warning !== "string") {
    throw new Error("The Rune desktop bridge returned an invalid legacy Office conversion.");
  }
  const bytes = resultBytes(result.bytes);
  if (!bytes.length || bytes.length > MAX_LEGACY_OFFICE_IMPORT_BYTES) {
    throw new Error("The converted Office package is empty or exceeds Rune's 12 MB import limit.");
  }
  return { bytes, fileName: result.fileName, warning: result.warning };
}

export async function exportLegacyOfficeFile(input: {
  bytes: Uint8Array;
  fileName: string;
}): Promise<LegacyOfficeConversion> {
  if (!/^[^/\\\0]+\.(?:docx|pptx)$/i.test(input.fileName))
    throw new Error("Desktop legacy export supports DOCX and PPTX packages only.");
  if (!supportsLegacyOfficeDesktopExport()) {
    throw new Error(
      "Legacy DOC/PPT export requires the Rune desktop app with Microsoft Word or PowerPoint installed. The web app will not offer a fake legacy download.",
    );
  }
  if (!input.bytes.length || input.bytes.length > MAX_LEGACY_OFFICE_EXPORT_BYTES) {
    throw new Error("The modern Office package must be between 1 byte and 12 MB before legacy export.");
  }
  const result = await window.runeDesktop!.exportLegacyOffice({ fileName: input.fileName, bytes: input.bytes });
  const expectedExtension = /\.docx$/i.test(input.fileName) ? ".doc" : ".ppt";
  if (!result || !result.fileName.toLowerCase().endsWith(expectedExtension) || typeof result.warning !== "string") {
    throw new Error("The Rune desktop bridge returned an invalid legacy Office export.");
  }
  const bytes = resultBytes(result.bytes);
  if (!bytes.length || bytes.length > MAX_LEGACY_OFFICE_EXPORT_BYTES) {
    throw new Error("The converted legacy Office file is empty or exceeds Rune's 12 MB export limit.");
  }
  return { bytes, fileName: result.fileName, warning: result.warning };
}
