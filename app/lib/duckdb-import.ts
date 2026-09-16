import { Bool, Float64, Table, Utf8, Vector, vectorFromArray } from "apache-arrow";
import type { DataCell } from "./workspace";

function normalizedColumn(values: DataCell[]) {
  const kinds = new Set(values.filter((value) => value !== null).map((value) => typeof value));
  if (kinds.size === 1 && kinds.has("number") && values.every((value) => value === null || Number.isFinite(value))) {
    return vectorFromArray(values, new Float64());
  }
  if (kinds.size === 1 && kinds.has("boolean")) return vectorFromArray(values, new Bool());
  return vectorFromArray(
    values.map((value) => (value === null ? null : String(value))),
    new Utf8(),
  );
}

export function workspaceRowsToArrowTable(
  columns: string[],
  rows: Array<Record<string, DataCell>>,
  importOrderColumn: string,
): Table {
  const vectors: Record<string, Vector> = Object.create(null);
  for (const column of columns) {
    vectors[column] = normalizedColumn(rows.map((row) => row[column] ?? null));
  }
  vectors[importOrderColumn] = vectorFromArray(
    rows.map((_, index) => index),
    new Float64(),
  );
  return new Table(vectors);
}
