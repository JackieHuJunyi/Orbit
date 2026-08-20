import { convertLegacyOfficeFile, legacyOfficeFileName } from "./desktop-bridge.ts";
import type { PreparedRuneImageAsset } from "./local-assets.ts";
import type { PdfImportAnalysis, PdfOcrProgress, PdfOcrRequest } from "./pdf-import.ts";
import { detectArtifact, type WorkspaceArtifact } from "./workspace.ts";

export const MAX_WORKSPACE_IMPORT_FILES = 20;

const MAX_SOURCE_IMPORT_BYTES = 2 * 1024 * 1024;
const MAX_PACKAGE_IMPORT_BYTES = 12 * 1024 * 1024;

export type WorkspaceImportFormat = "legacy-office" | "office" | "odf" | "pdf" | "source";

export type WorkspaceImportFilePolicy = Readonly<{
  format: WorkspaceImportFormat;
  maxBytes: number;
  limitName: string;
}>;

export type WorkspacePdfOcrCandidate = {
  fileIndex: number;
  fileName: string;
  file: File;
  analysis: PdfImportAnalysis;
};

export type WorkspaceFileConversion = {
  artifacts: WorkspaceArtifact[];
  warnings: string[];
  assets: PreparedRuneImageAsset[];
};

export type WorkspaceFilesConversionOptions = {
  pdfOcrSelections?: ReadonlyMap<number, PdfOcrRequest>;
  signal?: AbortSignal;
  onProgress?: (progress: PdfOcrProgress) => void;
  onActiveFileName?: (fileName: string) => void;
};

type WorkspaceImportAdapter = WorkspaceImportFilePolicy &
  Readonly<{
    extensions: readonly string[];
    matches: (fileName: string) => boolean;
    convert: (
      file: File,
      fileIndex: number,
      options: WorkspaceFilesConversionOptions,
    ) => Promise<WorkspaceFileConversion>;
  }>;

function prefixedWarnings(fileName: string, warnings: readonly string[]) {
  return warnings.map((warning) => `${fileName}: ${warning}`);
}

async function convertLegacyOffice(file: File): Promise<WorkspaceFileConversion> {
  const converted = await convertLegacyOfficeFile(file);
  const { convertOfficeFileWithAssets } = await import("./office-import.ts");
  const result = await convertOfficeFileWithAssets(converted.fileName, converted.bytes);
  return {
    artifacts: result.artifacts,
    assets: result.assets,
    warnings: prefixedWarnings(file.name, [converted.warning, ...result.warnings]),
  };
}

async function convertOffice(file: File): Promise<WorkspaceFileConversion> {
  const { convertOfficeFileWithAssets } = await import("./office-import.ts");
  const result = await convertOfficeFileWithAssets(file.name, await file.arrayBuffer());
  return {
    artifacts: result.artifacts,
    assets: result.assets,
    warnings: prefixedWarnings(file.name, result.warnings),
  };
}

async function convertOdf(file: File): Promise<WorkspaceFileConversion> {
  const { convertOdfFileWithAssets } = await import("./odf-import.ts");
  const result = await convertOdfFileWithAssets(file.name, await file.arrayBuffer());
  return {
    artifacts: result.artifacts,
    assets: result.assets,
    warnings: prefixedWarnings(file.name, result.warnings),
  };
}

async function convertPdf(
  file: File,
  fileIndex: number,
  options: WorkspaceFilesConversionOptions,
): Promise<WorkspaceFileConversion> {
  const { convertPdfFile, convertPdfFileWithOcr } = await import("./pdf-import-client.ts");
  const selection = options.pdfOcrSelections?.get(fileIndex);
  const result = selection
    ? await convertPdfFileWithOcr(file.name, await file.arrayBuffer(), selection, {
        signal: options.signal,
        onProgress: options.onProgress,
      })
    : await convertPdfFile(file.name, await file.arrayBuffer());
  return {
    artifacts: result.artifacts,
    assets: [],
    warnings: prefixedWarnings(file.name, result.warnings),
  };
}

async function convertSource(file: File): Promise<WorkspaceFileConversion> {
  const artifact = detectArtifact(file.name, await file.text());
  if (!artifact) {
    throw new Error(
      `${file.name}: choose Markdown, CSV, JSON, SQL, Deck Markdown, HTML, PDF, DOCX, XLSX, PPTX, ODT, ODS, or ODP. Legacy DOC/PPT requires Rune Desktop.`,
    );
  }
  return { artifacts: [artifact], assets: [], warnings: [] };
}

const WORKSPACE_IMPORT_ADAPTERS: readonly WorkspaceImportAdapter[] = Object.freeze([
  Object.freeze({
    format: "legacy-office" as const,
    extensions: Object.freeze([".doc", ".ppt"]),
    maxBytes: MAX_PACKAGE_IMPORT_BYTES,
    limitName: "desktop legacy Office",
    matches: legacyOfficeFileName,
    convert: convertLegacyOffice,
  }),
  Object.freeze({
    format: "office" as const,
    extensions: Object.freeze([".docx", ".xlsx", ".pptx"]),
    maxBytes: MAX_PACKAGE_IMPORT_BYTES,
    limitName: "Office",
    matches: (fileName: string) => /\.(?:docx|xlsx|pptx)$/i.test(fileName),
    convert: convertOffice,
  }),
  Object.freeze({
    format: "odf" as const,
    extensions: Object.freeze([".odt", ".ods", ".odp"]),
    maxBytes: MAX_PACKAGE_IMPORT_BYTES,
    limitName: "OpenDocument",
    matches: (fileName: string) => /\.(?:odt|ods|odp)$/i.test(fileName),
    convert: convertOdf,
  }),
  Object.freeze({
    format: "pdf" as const,
    extensions: Object.freeze([".pdf"]),
    maxBytes: MAX_PACKAGE_IMPORT_BYTES,
    limitName: "PDF",
    matches: (fileName: string) => /\.pdf$/i.test(fileName),
    convert: convertPdf,
  }),
  Object.freeze({
    format: "source" as const,
    extensions: Object.freeze([".deck.md", ".md", ".markdown", ".csv", ".json", ".sql", ".html", ".htm"]),
    maxBytes: MAX_SOURCE_IMPORT_BYTES,
    limitName: "source",
    matches: () => true,
    convert: convertSource,
  }),
]);

export const WORKSPACE_IMPORT_ACCEPT = WORKSPACE_IMPORT_ADAPTERS.flatMap((adapter) => adapter.extensions).join(",");

function workspaceImportAdapterForFileName(fileName: string) {
  return WORKSPACE_IMPORT_ADAPTERS.find((adapter) => adapter.matches(fileName))!;
}

export function workspaceImportFilePolicy(fileName: string): WorkspaceImportFilePolicy {
  const { format, maxBytes, limitName } = workspaceImportAdapterForFileName(fileName);
  return Object.freeze({ format, maxBytes, limitName });
}

export function workspaceImportOversizeNotice(file: Pick<File, "name" | "size">) {
  const policy = workspaceImportFilePolicy(file.name);
  if (file.size <= policy.maxBytes) return null;
  return `${file.name} exceeds the ${policy.maxBytes / 1_048_576} MB ${policy.limitName} import limit`;
}

export function firstWorkspaceImportOversizeNotice(files: readonly Pick<File, "name" | "size">[]) {
  for (const file of files) {
    const notice = workspaceImportOversizeNotice(file);
    if (notice) return notice;
  }
  return null;
}

export function isWorkspacePdfImportFile(fileName: string) {
  return workspaceImportAdapterForFileName(fileName).format === "pdf";
}

export async function analyzeWorkspaceImportPdfs(files: readonly File[]) {
  const candidates: WorkspacePdfOcrCandidate[] = [];
  for (const [fileIndex, file] of files.entries()) {
    if (!isWorkspacePdfImportFile(file.name)) continue;
    const { analyzePdfFile } = await import("./pdf-import-client.ts");
    const analysis = await analyzePdfFile(file.name, await file.arrayBuffer());
    if (analysis.ocrCandidatePageNumbers.length) {
      candidates.push({ fileIndex, fileName: file.name, file, analysis });
    }
  }
  return candidates;
}

export async function convertWorkspaceImportFiles(
  files: readonly File[],
  options: WorkspaceFilesConversionOptions = {},
): Promise<WorkspaceFileConversion> {
  const artifacts: WorkspaceArtifact[] = [];
  const warnings: string[] = [];
  const assets: PreparedRuneImageAsset[] = [];
  for (const [fileIndex, file] of files.entries()) {
    if (options.signal?.aborted) throw new DOMException("OCR cancelled", "AbortError");
    options.onActiveFileName?.(file.name);
    const adapter = workspaceImportAdapterForFileName(file.name);
    const converted = await adapter.convert(file, fileIndex, options);
    artifacts.push(...converted.artifacts);
    warnings.push(...converted.warnings);
    assets.push(...converted.assets);
  }
  return { artifacts, warnings, assets };
}
