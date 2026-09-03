import Papa from "papaparse";
import { deriveDataPreviewSourceTargets, type DataCellPreviewSourceTarget } from "./preview-targets.ts";
import { sourceOutsideSelectionIsUnchanged } from "./source-selection.ts";
import { parseDataSource, type DataCell, type WorkspaceArtifact } from "./workspace.ts";

export const MAX_VISUAL_DATA_CELL_CHARS = 10_000;

export type VisualDataCellValueType = "auto" | "string" | "number" | "boolean" | "null";

export type VisualDataCellEditInput = {
  draft: string;
  valueType: VisualDataCellValueType;
};

export type PreparedVisualDataCellEdit = {
  nextSource: string;
  nextTarget: DataCellPreviewSourceTarget | null;
  value: DataCell;
  errors: string[];
};

export type VisualDataCellDraftProjection = {
  nextSource: string;
  start: number;
  end: number;
  errors: string[];
};

function emptyResult(source: string, error: string): PreparedVisualDataCellEdit {
  return { nextSource: source, nextTarget: null, value: null, errors: [error] };
}

function sameCell(left: DataCell | undefined, right: DataCell) {
  return Object.is(left ?? null, right);
}

function targetForCurrentRevision(artifact: WorkspaceArtifact, requested: DataCellPreviewSourceTarget) {
  return deriveDataPreviewSourceTargets(artifact).cells.find(
    (target) =>
      target.rowIndex === requested.rowIndex &&
      target.columnIndex === requested.columnIndex &&
      target.column === requested.column &&
      target.start === requested.start &&
      target.end === requested.end,
  );
}

function parseStrictNumber(draft: string) {
  const normalized = draft.trim();
  if (!/^-?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/u.test(normalized)) {
    throw new Error("Enter a finite decimal number.");
  }
  const value = Number(normalized);
  if (!Number.isFinite(value)) throw new Error("Enter a finite decimal number.");
  return value;
}

function parseCsvAutoValue(draft: string): DataCell {
  const singleCellSource = Papa.unparse(
    [
      ["value", "_orbit"],
      [draft, "1"],
    ],
    { quotes: true, newline: "\n" },
  );
  const parsed = parseDataSource(singleCellSource);
  if (parsed.errors.length || parsed.rows.length !== 1) {
    throw new Error(parsed.errors[0] ?? "Orbit could not parse this CSV value.");
  }
  return parsed.rows[0].value ?? null;
}

function parseDraft(draft: string, valueType: VisualDataCellValueType, format: "CSV" | "JSON"): DataCell {
  if (draft.length > MAX_VISUAL_DATA_CELL_CHARS) {
    throw new Error(
      `Visual cell edits are limited to ${MAX_VISUAL_DATA_CELL_CHARS.toLocaleString("en-US")} characters.`,
    );
  }
  if (format === "CSV") {
    if (valueType !== "auto") throw new Error("CSV cells use automatic scalar typing.");
    return parseCsvAutoValue(draft);
  }
  if (valueType === "auto") throw new Error("Choose an explicit JSON scalar type.");
  if (valueType === "string") return draft;
  if (valueType === "number") return parseStrictNumber(draft);
  if (valueType === "boolean") {
    if (draft === "true") return true;
    if (draft === "false") return false;
    throw new Error("Choose true or false.");
  }
  return null;
}

function serializeCell(value: DataCell, format: "CSV" | "JSON") {
  if (format === "JSON") return JSON.stringify(value);
  if (value === null) return '""';
  return Papa.unparse([[value]], {
    quotes: (cell) => typeof cell === "string",
    newline: "\n",
  });
}

export function visualDataCellValueType(value: DataCell, format: "CSV" | "JSON"): VisualDataCellValueType {
  if (format === "CSV") return "auto";
  if (value === null) return "null";
  if (typeof value === "number") return "number";
  if (typeof value === "boolean") return "boolean";
  return "string";
}

export function visualDataCellDraft(value: DataCell) {
  return value === null ? "" : String(value);
}

export function canVisualEditDataCell(artifact: WorkspaceArtifact, target: DataCellPreviewSourceTarget) {
  if (artifact.kind !== "data") return false;
  const current = targetForCurrentRevision(artifact, target);
  if (!current || current.end - current.start > MAX_VISUAL_DATA_CELL_CHARS) return false;
  const parsed = parseDataSource(artifact.source);
  if (parsed.errors.length) return false;
  if (parsed.format === "JSON") {
    const literal = artifact.source.slice(current.start, current.end).trimStart();
    if (literal.startsWith("{") || literal.startsWith("[")) return false;
  }
  return parsed.rows[current.rowIndex]?.[current.column] !== undefined;
}

export function projectVisualDataCellDraft(
  artifact: WorkspaceArtifact,
  requestedTarget: DataCellPreviewSourceTarget,
  input: VisualDataCellEditInput,
): VisualDataCellDraftProjection {
  const target = artifact.kind === "data" ? targetForCurrentRevision(artifact, requestedTarget) : undefined;
  if (!target) {
    return {
      nextSource: artifact.source,
      start: requestedTarget.start,
      end: requestedTarget.end,
      errors: ["The cell no longer matches the current source revision."],
    };
  }
  const parsed = parseDataSource(artifact.source);
  let replacement = input.draft;
  try {
    replacement = serializeCell(parseDraft(input.draft, input.valueType, parsed.format), parsed.format);
  } catch {
    if (parsed.format === "JSON") {
      replacement =
        input.valueType === "string" ? JSON.stringify(input.draft) : input.valueType === "null" ? "null" : input.draft;
    }
  }
  const prepared = prepareVisualDataCellEdit(artifact, target, input);
  return {
    nextSource: `${artifact.source.slice(0, target.start)}${replacement}${artifact.source.slice(target.end)}`,
    start: target.start,
    end: target.start + replacement.length,
    errors: prepared.errors.filter((error) => !/unchanged\.?$/iu.test(error)),
  };
}

export function prepareVisualDataCellEdit(
  artifact: WorkspaceArtifact,
  requestedTarget: DataCellPreviewSourceTarget,
  input: VisualDataCellEditInput,
): PreparedVisualDataCellEdit {
  if (artifact.kind !== "data") return emptyResult(artifact.source, "Visual cell editing requires a Data artifact.");
  const target = targetForCurrentRevision(artifact, requestedTarget);
  if (!target) return emptyResult(artifact.source, "The cell no longer matches the current source revision.");
  if (!canVisualEditDataCell(artifact, target)) {
    return emptyResult(artifact.source, "Only exact CSV cells and flat JSON scalar values can be edited visually.");
  }

  const parsed = parseDataSource(artifact.source);
  if (parsed.errors.length) return emptyResult(artifact.source, parsed.errors[0]);
  let value: DataCell;
  try {
    value = parseDraft(input.draft, input.valueType, parsed.format);
  } catch (error) {
    return emptyResult(artifact.source, error instanceof Error ? error.message : "Orbit could not parse this value.");
  }

  const currentValue = parsed.rows[target.rowIndex]?.[target.column];
  if (sameCell(currentValue, value)) {
    return emptyResult(artifact.source, "The edited value is unchanged.");
  }
  const replacement = serializeCell(value, parsed.format);
  const nextSource = `${artifact.source.slice(0, target.start)}${replacement}${artifact.source.slice(target.end)}`;
  if (!sourceOutsideSelectionIsUnchanged(artifact.source, nextSource, target)) {
    return emptyResult(artifact.source, "The visual edit crossed its exact source-cell boundary.");
  }

  const nextArtifact = { ...artifact, source: nextSource };
  const nextParsed = parseDataSource(nextSource);
  if (nextParsed.errors.length) return emptyResult(artifact.source, nextParsed.errors[0]);
  if (!sameCell(nextParsed.rows[target.rowIndex]?.[target.column], value)) {
    return emptyResult(artifact.source, "The edited value could not round-trip through the canonical source.");
  }
  const nextTarget =
    deriveDataPreviewSourceTargets(nextArtifact).cells.find(
      (candidate) =>
        candidate.rowIndex === target.rowIndex &&
        candidate.columnIndex === target.columnIndex &&
        candidate.column === target.column,
    ) ?? null;
  if (!nextTarget) {
    return emptyResult(artifact.source, "Orbit could not prove the edited cell's new source range.");
  }
  return { nextSource, nextTarget, value, errors: [] };
}
