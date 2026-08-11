import * as duckdb from "@duckdb/duckdb-wasm";
import {
  buildBoundedQuery,
  buildQueryLineagePlan,
  MAX_QUERY_ROWS,
  normalizeQuerySourceRowIndex,
  QUERY_PROVENANCE_COLUMN,
  queryLineageColumnsForOutput,
  queryLineageSourceIsSupported,
  type QueryCellLineage,
} from "./sql.ts";
import { parseDataSource } from "./workspace.ts";

const DUCKDB_VERSION = "1.32.0";
const DUCKDB_CDN = `https://cdn.jsdelivr.net/npm/@duckdb/duckdb-wasm@${DUCKDB_VERSION}/dist`;
const PINNED_BUNDLES: duckdb.DuckDBBundles = {
  mvp: {
    mainModule: `${DUCKDB_CDN}/duckdb-mvp.wasm`,
    mainWorker: `${DUCKDB_CDN}/duckdb-browser-mvp.worker.js`,
  },
  eh: {
    mainModule: `${DUCKDB_CDN}/duckdb-eh.wasm`,
    mainWorker: `${DUCKDB_CDN}/duckdb-browser-eh.worker.js`,
  },
};

export type QueryCell = string | number | boolean | null;

export type WorkspaceQueryResult = {
  columns: string[];
  rows: QueryCell[][];
  sourceRowIndices: Array<number | null>;
  cellLineage: Array<Array<QueryCellLineage | null>>;
  lineageMode: "direct" | "read-only";
  elapsedMs: number;
  truncated: boolean;
  engine: string;
};

let databasePromise: Promise<duckdb.AsyncDuckDB> | null = null;
let queryQueue: Promise<void> = Promise.resolve();

function getDatabase(): Promise<duckdb.AsyncDuckDB> {
  if (!databasePromise) {
    databasePromise = (async () => {
      const bundle = await duckdb.selectBundle(PINNED_BUNDLES);
      if (!bundle.mainWorker) throw new Error("No compatible DuckDB worker is available in this browser.");
      const workerUrl = URL.createObjectURL(
        new Blob([`importScripts(${JSON.stringify(bundle.mainWorker)});`], { type: "text/javascript" }),
      );
      const worker = new Worker(workerUrl);
      const database = new duckdb.AsyncDuckDB(new duckdb.ConsoleLogger(duckdb.LogLevel.WARNING), worker);
      try {
        await database.instantiate(bundle.mainModule, bundle.pthreadWorker ?? undefined);
        return database;
      } catch (error) {
        worker.terminate();
        databasePromise = null;
        throw error;
      } finally {
        URL.revokeObjectURL(workerUrl);
      }
    })();
  }
  return databasePromise;
}

function normalizeCell(value: unknown): QueryCell {
  if (value == null) return null;
  if (typeof value === "string" || typeof value === "boolean") return value;
  if (typeof value === "number") return Number.isFinite(value) ? value : String(value);
  if (typeof value === "bigint") {
    const numeric = Number(value);
    return Number.isSafeInteger(numeric) ? numeric : value.toString();
  }
  if (value instanceof Date) return value.toISOString();
  if (value instanceof Uint8Array) {
    return Array.from(value, (byte) => byte.toString(16).padStart(2, "0")).join("");
  }
  if (typeof value === "object" && "toString" in value) return String(value);
  return JSON.stringify(value) ?? String(value);
}

function quoteSqlIdentifier(value: string) {
  return `"${value.replace(/"/g, '""')}"`;
}

async function executeQuery(
  sql: string,
  dataSource: string,
  dataFormat: "CSV" | "JSON",
): Promise<WorkspaceQueryResult> {
  const parsedData = parseDataSource(dataSource);
  if (parsedData.errors.length) throw new Error(parsedData.errors[0]);
  if (!parsedData.columns.length) throw new Error("Add at least one data column before running SQL.");
  let importOrderColumn = "__rune_import_order__";
  const canonicalColumnNames = new Set(parsedData.columns.map((column) => column.toLowerCase()));
  while (canonicalColumnNames.has(importOrderColumn.toLowerCase())) importOrderColumn += "_";
  const canonicalRows = parsedData.rows.map((row, index) => ({ ...row, [importOrderColumn]: index }));
  const fileName = `rune-workspace-${dataFormat.toLocaleLowerCase()}.json`;
  const database = await getDatabase();
  await database.dropFiles();
  await database.registerFileText(fileName, JSON.stringify(canonicalRows));
  const connection = await database.connect();

  try {
    if (parsedData.rows.length) {
      const projection = parsedData.columns.map(quoteSqlIdentifier).join(", ");
      await connection.query(`CREATE OR REPLACE TABLE workspace_data AS SELECT ${projection} FROM read_json_auto('${fileName}', format = 'array') ORDER BY ${quoteSqlIdentifier(importOrderColumn)}`);
    } else {
      const columns = parsedData.columns.map((column) => `${quoteSqlIdentifier(column)} VARCHAR`).join(", ");
      await connection.query(`CREATE OR REPLACE TABLE workspace_data (${columns})`);
    }
    const lineagePlan = queryLineageSourceIsSupported(parsedData.columns) ? buildQueryLineagePlan(sql) : null;
    const startedAt = performance.now();
    const table = await connection.query(buildBoundedQuery(lineagePlan?.sql ?? sql));
    const elapsedMs = performance.now() - startedAt;
    const tableColumns = table.schema.fields.map((field) => field.name);
    const lineageColumnIndex = tableColumns.indexOf(QUERY_PROVENANCE_COLUMN);
    const visibleColumnIndices = tableColumns
      .map((_, index) => index)
      .filter((index) => index !== lineageColumnIndex);
    const columns = visibleColumnIndices.map((index) => tableColumns[index]);
    const projectedSourceColumns = lineagePlan
      ? queryLineageColumnsForOutput(lineagePlan.projections, parsedData.columns, columns.length)
      : null;
    const hasDirectLineage = Boolean(
      lineagePlan
      && lineageColumnIndex >= 0
      && projectedSourceColumns,
    );
    const visibleRows = Math.min(table.numRows, MAX_QUERY_ROWS);
    const rows = Array.from({ length: visibleRows }, (_, rowIndex) => (
      visibleColumnIndices.map((columnIndex) => normalizeCell(table.getChildAt(columnIndex)?.get(rowIndex)))
    ));
    const sourceRowIndices = Array.from({ length: visibleRows }, (_, rowIndex) => (
      hasDirectLineage
        ? normalizeQuerySourceRowIndex(table.getChildAt(lineageColumnIndex)?.get(rowIndex), parsedData.rows.length)
        : null
    ));
    const cellLineage = sourceRowIndices.map((rowIndex) => (
      columns.map((_, columnIndex) => {
        const sourceColumn = hasDirectLineage ? projectedSourceColumns?.[columnIndex] : null;
        return rowIndex != null && sourceColumn ? { sourceRowIndex: rowIndex, sourceColumn } : null;
      })
    ));
    return {
      columns,
      rows,
      sourceRowIndices,
      cellLineage,
      lineageMode: hasDirectLineage ? "direct" : "read-only",
      elapsedMs,
      truncated: table.numRows > MAX_QUERY_ROWS,
      engine: `DuckDB-Wasm ${DUCKDB_VERSION}`,
    };
  } finally {
    await connection.close();
  }
}

export function runWorkspaceQuery(
  sql: string,
  dataSource: string,
  dataFormat: "CSV" | "JSON",
): Promise<WorkspaceQueryResult> {
  const job = queryQueue.then(() => executeQuery(sql, dataSource, dataFormat));
  queryQueue = job.then(() => undefined, () => undefined);
  return job;
}
