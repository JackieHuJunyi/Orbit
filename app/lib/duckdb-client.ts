import * as duckdb from "@duckdb/duckdb-wasm";
import {
  buildBoundedQuery,
  buildQueryLineagePlan,
  MAX_QUERY_ROWS,
  normalizeQuerySourceRowIndex,
  QUERY_PROVENANCE_COLUMN,
  queryLineageColumnsForOutput,
  queryLineageSourceIsSupported,
} from "./sql.ts";
import {
  createWorkspaceQuerySnapshot,
  type QueryCell,
  type WorkspaceQueryResult,
  type WorkspaceQuerySnapshot,
} from "./query-snapshot.ts";
import { parseQueryDataSourceDirective } from "./query-source.ts";
import { parseDataSource, type WorkspaceArtifact } from "./workspace.ts";

export type { QueryCell, WorkspaceQueryResult, WorkspaceQuerySnapshot } from "./query-snapshot.ts";

const DUCKDB_VERSION = "1.32.0";
const DUCKDB_INIT_TIMEOUT_MS = 30_000;
const DUCKDB_MAX_WASM_BYTES = 45 * 1024 * 1024;
const DUCKDB_MAX_WASM_PART_BYTES = 20 * 1024 * 1024;

interface DuckDbWasmManifest {
  schemaVersion: 1;
  totalBytes: number;
  parts: Array<{ name: string; bytes: number }>;
}

function sameOriginMvpBundle() {
  const assetUrl = (name: string) => new URL(`/duckdb/${name}`, window.location.origin).href;
  return {
    mainModuleManifest: assetUrl("duckdb-mvp.wasm.manifest.json"),
    mainWorker: assetUrl("duckdb-browser-mvp.worker.js"),
    pthreadWorker: null,
  };
}

function isDuckDbWasmManifest(value: unknown): value is DuckDbWasmManifest {
  if (!value || typeof value !== "object") return false;
  const manifest = value as Partial<DuckDbWasmManifest>;
  return (
    manifest.schemaVersion === 1 &&
    Number.isSafeInteger(manifest.totalBytes) &&
    Number(manifest.totalBytes) > 0 &&
    Number(manifest.totalBytes) <= DUCKDB_MAX_WASM_BYTES &&
    Array.isArray(manifest.parts) &&
    manifest.parts.length > 0 &&
    manifest.parts.length <= 8 &&
    manifest.parts.every(
      (part, index) =>
        Boolean(part) &&
        part.name === `duckdb-mvp.wasm.part-${index}` &&
        Number.isSafeInteger(part.bytes) &&
        part.bytes > 0 &&
        part.bytes <= DUCKDB_MAX_WASM_PART_BYTES,
    ) &&
    manifest.parts.reduce((sum, part) => sum + part.bytes, 0) === manifest.totalBytes
  );
}

async function fetchDuckDbWasm(manifestUrl: string, signal: AbortSignal) {
  const manifestResponse = await fetch(manifestUrl, { credentials: "same-origin", signal });
  if (!manifestResponse.ok) {
    throw new Error(`DuckDB's same-origin Wasm manifest returned HTTP ${manifestResponse.status}.`);
  }
  const manifestValue: unknown = await manifestResponse.json();
  if (!isDuckDbWasmManifest(manifestValue)) throw new Error("DuckDB's same-origin Wasm manifest is invalid.");

  const manifestDirectory = new URL(".", manifestResponse.url);
  const blobs = await Promise.all(
    manifestValue.parts.map(async (part) => {
      const partUrl = new URL(part.name, manifestDirectory);
      if (partUrl.origin !== window.location.origin) throw new Error("DuckDB's Wasm part is not same-origin.");
      const response = await fetch(partUrl, { credentials: "same-origin", signal });
      if (!response.ok) throw new Error(`DuckDB's same-origin Wasm part returned HTTP ${response.status}.`);
      const declaredSize = Number(response.headers.get("content-length"));
      if (Number.isFinite(declaredSize) && declaredSize !== part.bytes) {
        throw new Error("DuckDB's same-origin Wasm part has an unexpected size.");
      }
      const blob = await response.blob();
      if (blob.size !== part.bytes) throw new Error("DuckDB's same-origin Wasm part is incomplete.");
      return blob;
    }),
  );
  const totalBytes = blobs.reduce((sum, blob) => sum + blob.size, 0);
  if (totalBytes !== manifestValue.totalBytes) throw new Error("DuckDB's same-origin Wasm is incomplete.");
  return new Blob(blobs, { type: "application/wasm" });
}

async function instantiateDatabase(database: duckdb.AsyncDuckDB, manifestUrl: string, pthreadWorker?: string) {
  let timer = 0;
  let wasmModuleUrl: string | null = null;
  const abortController = new AbortController();
  try {
    await Promise.race([
      (async () => {
        const wasmBlob = await fetchDuckDbWasm(manifestUrl, abortController.signal);
        wasmModuleUrl = URL.createObjectURL(new Blob([wasmBlob], { type: "application/wasm" }));
        await database.instantiate(wasmModuleUrl, pthreadWorker);
      })(),
      new Promise<never>((_, reject) => {
        timer = window.setTimeout(
          () => reject(new Error("DuckDB could not start from Orbit's same-origin runtime within 30 seconds.")),
          DUCKDB_INIT_TIMEOUT_MS,
        );
      }),
    ]);
  } finally {
    abortController.abort();
    window.clearTimeout(timer);
    if (wasmModuleUrl) URL.revokeObjectURL(wasmModuleUrl);
  }
}

let databasePromise: Promise<duckdb.AsyncDuckDB> | null = null;
let queryQueue: Promise<void> = Promise.resolve();

function getDatabase(): Promise<duckdb.AsyncDuckDB> {
  if (!databasePromise) {
    databasePromise = (async () => {
      const bundle = sameOriginMvpBundle();
      if (!bundle.mainWorker) throw new Error("No compatible DuckDB worker is available in this browser.");
      const worker = new Worker(bundle.mainWorker);
      const database = new duckdb.AsyncDuckDB(new duckdb.ConsoleLogger(duckdb.LogLevel.WARNING), worker);
      try {
        await instantiateDatabase(database, bundle.mainModuleManifest, bundle.pthreadWorker ?? undefined);
        return database;
      } catch (error) {
        worker.terminate();
        databasePromise = null;
        throw error;
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
  signal?: AbortSignal,
): Promise<WorkspaceQueryResult> {
  signal?.throwIfAborted();
  const parsedData = parseDataSource(dataSource);
  if (parsedData.errors.length) throw new Error(parsedData.errors[0]);
  if (!parsedData.columns.length) throw new Error("Add at least one data column before running SQL.");
  let importOrderColumn = "__rune_import_order__";
  const canonicalColumnNames = new Set(parsedData.columns.map((column) => column.toLowerCase()));
  while (canonicalColumnNames.has(importOrderColumn.toLowerCase())) importOrderColumn += "_";
  const canonicalRows = parsedData.rows.map((row, index) => ({ ...row, [importOrderColumn]: index }));
  const fileName = `rune-workspace-${dataFormat.toLocaleLowerCase()}.json`;
  const database = await getDatabase();
  signal?.throwIfAborted();
  await database.dropFiles();
  await database.registerFileText(fileName, JSON.stringify(canonicalRows));
  signal?.throwIfAborted();
  const connection = await database.connect();

  try {
    signal?.throwIfAborted();
    if (parsedData.rows.length) {
      const projection = parsedData.columns.map(quoteSqlIdentifier).join(", ");
      await connection.query(
        `CREATE OR REPLACE TABLE workspace_data AS SELECT ${projection} FROM read_json_auto('${fileName}', format = 'array') ORDER BY ${quoteSqlIdentifier(importOrderColumn)}`,
      );
    } else {
      const columns = parsedData.columns.map((column) => `${quoteSqlIdentifier(column)} VARCHAR`).join(", ");
      await connection.query(`CREATE OR REPLACE TABLE workspace_data (${columns})`);
    }
    signal?.throwIfAborted();
    const lineagePlan = queryLineageSourceIsSupported(parsedData.columns) ? buildQueryLineagePlan(sql) : null;
    const startedAt = performance.now();
    const table = await connection.query(buildBoundedQuery(lineagePlan?.sql ?? sql));
    signal?.throwIfAborted();
    const elapsedMs = performance.now() - startedAt;
    const tableColumns = table.schema.fields.map((field) => field.name);
    const lineageColumnIndex = tableColumns.indexOf(QUERY_PROVENANCE_COLUMN);
    const visibleColumnIndices = tableColumns.map((_, index) => index).filter((index) => index !== lineageColumnIndex);
    const columns = visibleColumnIndices.map((index) => tableColumns[index]);
    const projectedSourceColumns = lineagePlan
      ? queryLineageColumnsForOutput(lineagePlan.projections, parsedData.columns, columns.length)
      : null;
    const hasDirectLineage = Boolean(lineagePlan && lineageColumnIndex >= 0 && projectedSourceColumns);
    const visibleRows = Math.min(table.numRows, MAX_QUERY_ROWS);
    const rows = Array.from({ length: visibleRows }, (_, rowIndex) =>
      visibleColumnIndices.map((columnIndex) => normalizeCell(table.getChildAt(columnIndex)?.get(rowIndex))),
    );
    const sourceRowIndices = Array.from({ length: visibleRows }, (_, rowIndex) =>
      hasDirectLineage
        ? normalizeQuerySourceRowIndex(table.getChildAt(lineageColumnIndex)?.get(rowIndex), parsedData.rows.length)
        : null,
    );
    const cellLineage = sourceRowIndices.map((rowIndex) =>
      columns.map((_, columnIndex) => {
        const sourceColumn = hasDirectLineage ? projectedSourceColumns?.[columnIndex] : null;
        return rowIndex != null && sourceColumn ? { sourceRowIndex: rowIndex, sourceColumn } : null;
      }),
    );
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
  signal?: AbortSignal,
): Promise<WorkspaceQueryResult> {
  const job = queryQueue.then(() => executeQuery(sql, dataSource, dataFormat, signal));
  queryQueue = job.then(
    () => undefined,
    () => undefined,
  );
  return job;
}

export async function runWorkspaceQuerySnapshot(
  queryArtifact: WorkspaceArtifact,
  dataArtifact: WorkspaceArtifact,
  signal?: AbortSignal,
): Promise<WorkspaceQuerySnapshot> {
  if (queryArtifact.kind !== "query") throw new Error("Choose a Query artifact as the derived chart source.");
  if (dataArtifact.kind !== "data") throw new Error("Add a canonical CSV or JSON artifact before running SQL.");
  const binding = parseQueryDataSourceDirective(queryArtifact.source);
  if (binding.errors.length) throw new Error(binding.errors[0]);
  if (binding.artifactId && binding.artifactId !== dataArtifact.id) {
    throw new Error(
      `Query ${queryArtifact.name} is bound to Data artifact ${binding.artifactId}, not ${dataArtifact.id}.`,
    );
  }
  const dataFormat =
    dataArtifact.source.trim().startsWith("[") || dataArtifact.source.trim().startsWith("{") ? "JSON" : "CSV";
  const result = await runWorkspaceQuery(queryArtifact.source, dataArtifact.source, dataFormat, signal);
  return createWorkspaceQuerySnapshot(queryArtifact, dataArtifact, result);
}
