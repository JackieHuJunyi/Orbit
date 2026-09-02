import Papa from "papaparse";
import { safeExportBaseName, type ArtifactExportResult } from "./export-contract.ts";
import { parseDataSource, type DataCell, type WorkspaceArtifact } from "./workspace.ts";

export const MAX_PORTABLE_DATA_EXPORT_SOURCE_CHARS = 2_000_000;
export const MAX_PORTABLE_DATA_EXPORT_BYTES = 12 * 1024 * 1024;

export type PortableDataExportKind = "csv" | "json";
export type PortableDataExportResult = ArtifactExportResult<PortableDataExportKind>;

const encoder = new TextEncoder();

function rectangularRows(columns: string[], rows: Array<Record<string, DataCell>>) {
  return rows.map((row) => Object.fromEntries(columns.map((column) => [column, row[column] ?? null])));
}

function formulaSafeCsvRows(rows: Array<Record<string, DataCell>>) {
  let protectedCellCount = 0;
  const safeRows = rows.map((row) =>
    Object.fromEntries(
      Object.entries(row).map(([column, value]) => {
        if (typeof value !== "string" || !/^[\t\r\n ]*[=+@-]/u.test(value) || value.startsWith("'"))
          return [column, value];
        protectedCellCount += 1;
        return [column, `'${value}`];
      }),
    ),
  );
  return { safeRows, protectedCellCount };
}

export function exportPortableDataArtifact(
  artifact: WorkspaceArtifact,
  targetType: PortableDataExportKind,
): PortableDataExportResult {
  if (artifact.kind !== "data") throw new Error("CSV and JSON export supports Data artifacts only.");
  if (!artifact.source.trim()) throw new Error("The source is empty.");
  if (artifact.source.length > MAX_PORTABLE_DATA_EXPORT_SOURCE_CHARS) {
    throw new Error("CSV and JSON export is limited to 2,000,000 source characters.");
  }
  const parsed = parseDataSource(artifact.source);
  if (parsed.errors.length) throw new Error(parsed.errors[0]);
  if (!parsed.columns.length) throw new Error("Add at least one Data column before export.");

  const rows = rectangularRows(parsed.columns, parsed.rows);
  const csvRows = targetType === "csv" ? formulaSafeCsvRows(rows) : null;
  const source =
    targetType === "json"
      ? `${JSON.stringify(rows, null, 2)}\n`
      : `${Papa.unparse({ fields: parsed.columns, data: csvRows?.safeRows ?? rows }, { newline: "\n" })}\n`;
  const bytes = encoder.encode(source);
  if (bytes.length > MAX_PORTABLE_DATA_EXPORT_BYTES) {
    throw new Error(`The generated ${targetType.toUpperCase()} file exceeds Orbit's 12 MB export limit.`);
  }

  const warnings =
    targetType === "json"
      ? [
          "JSON export writes one flat object per visible row in canonical column order; absent cells become explicit null values.",
          "The download is a deterministic data snapshot and does not retain the original CSV quoting or JSON whitespace.",
        ]
      : [
          "CSV export writes the visible rectangular table with typed values serialized as text; CSV does not carry a schema.",
          ...(csvRows?.protectedCellCount
            ? [
                `${csvRows.protectedCellCount} formula-leading text ${csvRows.protectedCellCount === 1 ? "cell was" : "cells were"} prefixed with an apostrophe before spreadsheet handoff.`,
              ]
            : []),
          "The download is a deterministic data snapshot and does not retain the original JSON whitespace or object sparsity.",
        ];
  return {
    bytes,
    fileName: `${safeExportBaseName(artifact.name)}.${targetType}`,
    mimeType: targetType === "json" ? "application/json;charset=utf-8" : "text/csv;charset=utf-8",
    targetType,
    warnings,
  };
}
