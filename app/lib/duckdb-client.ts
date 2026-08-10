import * as duckdb from "@duckdb/duckdb-wasm";
import { buildBoundedQuery, MAX_QUERY_ROWS } from "./sql.ts";

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

async function executeQuery(
  sql: string,
  dataSource: string,
  dataFormat: "CSV" | "JSON",
): Promise<WorkspaceQueryResult> {
  const database = await getDatabase();
  const fileName = dataFormat === "JSON" ? "rune-workspace.json" : "rune-workspace.csv";
  await database.dropFiles();
  await database.registerFileText(fileName, dataSource);
  const connection = await database.connect();

  try {
    const reader = dataFormat === "JSON"
      ? `read_json_auto('${fileName}', format = 'auto')`
      : `read_csv_auto('${fileName}', header = true, sample_size = -1)`;
    await connection.query(`CREATE OR REPLACE TABLE workspace_data AS SELECT * FROM ${reader}`);
    const startedAt = performance.now();
    const table = await connection.query(buildBoundedQuery(sql));
    const elapsedMs = performance.now() - startedAt;
    const columns = table.schema.fields.map((field) => field.name);
    const visibleRows = Math.min(table.numRows, MAX_QUERY_ROWS);
    const rows = Array.from({ length: visibleRows }, (_, rowIndex) => (
      columns.map((_, columnIndex) => normalizeCell(table.getChildAt(columnIndex)?.get(rowIndex)))
    ));
    return {
      columns,
      rows,
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
