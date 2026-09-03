export const MAX_QUERY_ROWS = 500;
export const QUERY_PROVENANCE_COLUMN = "__orbit_source_row_index__";

export type QueryCellLineage = {
  sourceRowIndex: number;
  sourceColumn: string;
};

export type QueryLineageProjection = { kind: "star" } | { kind: "column"; sourceColumn: string } | { kind: "derived" };

export type QueryLineagePlan = {
  sql: string;
  projections: QueryLineageProjection[];
};

export type QueryLineageRevision = {
  querySource: string;
  dataArtifactId: string;
  dataSource: string;
};

export function queryLineageSourceIsSupported(columns: string[]) {
  if (!columns.length) return false;
  const seen = new Set<string>();
  return columns.every((column) => {
    const normalized = column.toLowerCase();
    if (
      !normalized ||
      normalized === "rowid" ||
      normalized === QUERY_PROVENANCE_COLUMN.toLowerCase() ||
      seen.has(normalized)
    )
      return false;
    seen.add(normalized);
    return true;
  });
}

export function normalizeQuerySourceRowIndex(value: unknown, rowCount: number) {
  const numeric =
    typeof value === "bigint"
      ? Number(value)
      : typeof value === "number"
        ? value
        : typeof value === "string" && /^\d+$/u.test(value)
          ? Number(value)
          : Number.NaN;
  return Number.isSafeInteger(numeric) && numeric >= 0 && numeric < rowCount ? numeric : null;
}

export function queryLineageRevisionMatches(
  revision: QueryLineageRevision,
  querySource: string,
  dataArtifactId: string,
  dataSource: string,
) {
  return (
    revision.querySource === querySource &&
    revision.dataArtifactId === dataArtifactId &&
    revision.dataSource === dataSource
  );
}

type SqlWord = {
  value: string;
  start: number;
  end: number;
};

const bareIdentifier = "[A-Za-z_][A-Za-z0-9_$]*";
const quotedIdentifier = '"(?:[^"]|"")*"';
const sqlIdentifier = `(?:${quotedIdentifier}|${bareIdentifier})`;

function decodeIdentifier(value: string) {
  return value.startsWith('"') ? value.slice(1, -1).replace(/""/g, '"') : value;
}

function sameIdentifier(left: string, right: string) {
  return decodeIdentifier(left).toLowerCase() === decodeIdentifier(right).toLowerCase();
}

function sqlWords(source: string, topLevelOnly: boolean): SqlWord[] {
  const words: SqlWord[] = [];
  let quote: "'" | '"' | null = null;
  let depth = 0;
  for (let index = 0; index < source.length; index += 1) {
    const character = source[index];
    if (quote) {
      if (character === quote && source[index + 1] === quote) index += 1;
      else if (character === quote) quote = null;
      continue;
    }
    if (character === "'" || character === '"') {
      quote = character;
      continue;
    }
    if (character === "(" || character === "[" || character === "{") {
      depth += 1;
      continue;
    }
    if (character === ")" || character === "]" || character === "}") {
      depth = Math.max(0, depth - 1);
      continue;
    }
    if ((topLevelOnly && depth) || !/[A-Za-z_]/u.test(character)) continue;
    const start = index;
    while (index + 1 < source.length && /[A-Za-z0-9_$]/u.test(source[index + 1])) index += 1;
    words.push({ value: source.slice(start, index + 1).toLowerCase(), start, end: index + 1 });
  }
  return words;
}

function topLevelWords(source: string) {
  return sqlWords(source, true);
}

function splitTopLevelList(source: string): string[] | null {
  const items: string[] = [];
  let quote: "'" | '"' | null = null;
  let depth = 0;
  let start = 0;
  for (let index = 0; index < source.length; index += 1) {
    const character = source[index];
    if (quote) {
      if (character === quote && source[index + 1] === quote) index += 1;
      else if (character === quote) quote = null;
      continue;
    }
    if (character === "'" || character === '"') {
      quote = character;
      continue;
    }
    if (character === "(" || character === "[" || character === "{") depth += 1;
    else if (character === ")" || character === "]" || character === "}") depth -= 1;
    else if (character === "," && depth === 0) {
      const item = source.slice(start, index).trim();
      if (!item) return null;
      items.push(item);
      start = index + 1;
    }
    if (depth < 0) return null;
  }
  const finalItem = source.slice(start).trim();
  if (quote || depth || !finalItem) return null;
  items.push(finalItem);
  return items;
}

const safeScalarFunctions = new Set([
  "abs",
  "cast",
  "ceil",
  "ceiling",
  "character_length",
  "coalesce",
  "concat",
  "concat_ws",
  "date_part",
  "date_trunc",
  "extract",
  "floor",
  "greatest",
  "ifnull",
  "least",
  "length",
  "lower",
  "ltrim",
  "nullif",
  "regexp_extract",
  "regexp_replace",
  "replace",
  "round",
  "rtrim",
  "strftime",
  "strptime",
  "substr",
  "substring",
  "trim",
  "trunc",
  "try_cast",
  "try_strptime",
  "typeof",
  "upper",
]);

const bareNonColumnExpressions = new Set([
  "current_catalog",
  "current_date",
  "current_role",
  "current_schema",
  "current_time",
  "current_timestamp",
  "current_user",
  "default",
  "false",
  "localtime",
  "localtimestamp",
  "null",
  "session_user",
  "system_user",
  "true",
  "user",
]);

function projectionIsRowPreserving(source: string) {
  let quote: "'" | '"' | null = null;
  for (let index = 0; index < source.length; index += 1) {
    const character = source[index];
    if (quote) {
      if (character === quote && source[index + 1] === quote) index += 1;
      else if (character === quote) quote = null;
      continue;
    }
    if (character === "'" || character === '"') {
      quote = character;
      continue;
    }
    if (!/[A-Za-z_]/u.test(character)) continue;
    const start = index;
    while (index + 1 < source.length && /[A-Za-z0-9_$]/u.test(source[index + 1])) index += 1;
    const word = source.slice(start, index + 1).toLowerCase();
    if (["select", "over", "filter"].includes(word)) return false;
    let next = index + 1;
    while (next < source.length && /\s/u.test(source[next])) next += 1;
    if (source[next] === "(" && !safeScalarFunctions.has(word)) return false;
  }
  return !quote;
}

function projectionWithoutAlias(source: string) {
  const words = topLevelWords(source);
  const aliasWord = [...words].reverse().find((word) => word.value === "as");
  if (!aliasWord) return source.trim();
  const alias = source.slice(aliasWord.end).trim();
  if (!new RegExp(`^${sqlIdentifier}$`, "u").test(alias)) return null;
  return source.slice(0, aliasWord.start).trim();
}

export type QueryOutputContract = {
  columns: string[];
  errors: string[];
};

function projectionOutputName(source: string) {
  const words = topLevelWords(source);
  const aliasWord = [...words].reverse().find((word) => word.value === "as");
  if (aliasWord) {
    const alias = source.slice(aliasWord.end).trim();
    const expression = source.slice(0, aliasWord.start).trim();
    if (!expression || !new RegExp(`^${sqlIdentifier}$`, "u").test(alias)) return null;
    return decodeIdentifier(alias);
  }
  const direct = source.trim().match(new RegExp(`^(?:${sqlIdentifier}\\s*\\.\\s*)?(${sqlIdentifier})$`, "u"));
  return direct ? decodeIdentifier(direct[1]) : null;
}

export function inferQueryOutputColumns(source: string, workspaceDataColumns: string[] = []): QueryOutputContract {
  const queryErrors = validateReadQuery(source);
  if (queryErrors.length) return { columns: [], errors: queryErrors };
  const query = normalizeReadQuery(source);
  const words = topLevelWords(query);
  const selectWords = words.filter((word) => word.value === "select");
  if (selectWords.length !== 1) {
    return { columns: [], errors: ["A downstream Query source needs one outer SELECT projection."] };
  }
  const selectWord = selectWords[0];
  const followingWords = words.filter((word) => word.start >= selectWord.end);
  const setOperator = followingWords.find((word) => ["except", "intersect", "union"].includes(word.value));
  if (setOperator) {
    return {
      columns: [],
      errors: ["Wrap set-query output in one outer SELECT with explicit column names before using it in a Chart."],
    };
  }
  const fromWord = followingWords.find((word) => word.value === "from");
  const selectEnd =
    fromWord?.start ??
    followingWords.find((word) => ["fetch", "limit", "offset", "order", "qualify", "where"].includes(word.value))
      ?.start ??
    query.length;
  let selectList = query.slice(selectWord.end, selectEnd).trim();
  selectList = selectList.replace(/^(?:all|distinct)\b\s*/iu, "");
  const items = splitTopLevelList(selectList);
  if (!items) return { columns: [], errors: ["The Query output projection could not be read safely."] };

  let workspaceStarSource = false;
  let workspaceStarQualifier = "workspace_data";
  if (fromWord) {
    const fromIndex = words.indexOf(fromWord);
    const clauseStarts = new Set([
      "fetch",
      "group",
      "having",
      "limit",
      "offset",
      "order",
      "qualify",
      "where",
      "window",
    ]);
    const nextClause = words.slice(fromIndex + 1).find((word) => clauseStarts.has(word.value));
    const fromSource = query.slice(fromWord.end, nextClause?.start ?? query.length).trim();
    const fromMatch = fromSource.match(new RegExp(`^(${sqlIdentifier})(?:\\s+(?:as\\s+)?(${sqlIdentifier}))?$`, "iu"));
    if (fromMatch && decodeIdentifier(fromMatch[1]).toLowerCase() === "workspace_data") {
      workspaceStarSource = true;
      workspaceStarQualifier = fromMatch[2] ?? fromMatch[1];
    }
  }

  const columns: string[] = [];
  for (const item of items) {
    const trimmed = item.trim();
    const qualifiedStar = trimmed.match(new RegExp(`^(${sqlIdentifier})\\s*\\.\\s*\\*$`, "u"));
    if (trimmed === "*" || qualifiedStar) {
      const qualifierMatches =
        !qualifiedStar ||
        sameIdentifier(qualifiedStar[1], workspaceStarQualifier) ||
        sameIdentifier(qualifiedStar[1], "workspace_data");
      if (!workspaceStarSource || !qualifierMatches || !workspaceDataColumns.length) {
        return {
          columns: [],
          errors: ["Downstream Query stars must expand directly from workspace_data with known canonical columns."],
        };
      }
      columns.push(...workspaceDataColumns);
      continue;
    }
    const outputName = projectionOutputName(trimmed);
    if (!outputName) {
      return {
        columns: [],
        errors: ["Give every derived Query field used downstream an explicit AS alias."],
      };
    }
    columns.push(outputName);
  }

  if (!columns.length) return { columns: [], errors: ["A downstream Query source needs at least one output column."] };
  if (columns.length > 256)
    return { columns: [], errors: ["A downstream Query source is limited to 256 output columns."] };
  const seen = new Set<string>();
  for (const column of columns) {
    const normalized = column.toLocaleLowerCase("en-US");
    if (!normalized || seen.has(normalized)) {
      return { columns: [], errors: [`Query output column names must be unique: ${column || "unnamed"}.`] };
    }
    seen.add(normalized);
  }
  return { columns, errors: [] };
}

function classifyProjection(
  source: string,
  tableIdentifier: string,
  aliasIdentifier: string,
): QueryLineageProjection | null {
  const base = projectionWithoutAlias(source);
  if (!base || !projectionIsRowPreserving(base)) return null;
  if (base === "*") return { kind: "star" };
  const qualifiedStar = base.match(new RegExp(`^(${sqlIdentifier})\\s*\\.\\s*\\*$`, "u"));
  if (qualifiedStar) {
    return sameIdentifier(qualifiedStar[1], aliasIdentifier) || sameIdentifier(qualifiedStar[1], tableIdentifier)
      ? { kind: "star" }
      : null;
  }
  const direct = base.match(new RegExp(`^(${sqlIdentifier})(?:\\s*\\.\\s*(${sqlIdentifier}))?$`, "u"));
  if (!direct) return { kind: "derived" };
  if (!direct[2]) {
    if (
      (!direct[1].startsWith('"') && bareNonColumnExpressions.has(direct[1].toLowerCase())) ||
      sameIdentifier(direct[1], aliasIdentifier) ||
      sameIdentifier(direct[1], tableIdentifier)
    )
      return { kind: "derived" };
    return { kind: "column", sourceColumn: decodeIdentifier(direct[1]) };
  }
  if (!sameIdentifier(direct[1], aliasIdentifier) && !sameIdentifier(direct[1], tableIdentifier)) return null;
  return { kind: "column", sourceColumn: decodeIdentifier(direct[2]) };
}

export function buildQueryLineagePlan(source: string): QueryLineagePlan | null {
  const query = normalizeReadQuery(source);
  if (!/^select\b/iu.test(query) || query.toLowerCase().includes(QUERY_PROVENANCE_COLUMN)) return null;
  if (sqlWords(query, false).filter((word) => word.value === "select").length !== 1) return null;
  const words = topLevelWords(query);
  const selectWord = words[0];
  const fromWordIndex = words.findIndex((word, index) => index > 0 && word.value === "from");
  if (!selectWord || selectWord.value !== "select" || fromWordIndex < 0) return null;
  const fromWord = words[fromWordIndex];
  const forbidden = new Set([
    "distinct",
    "except",
    "group",
    "having",
    "intersect",
    "join",
    "pivot",
    "qualify",
    "sample",
    "union",
    "unpivot",
    "window",
  ]);
  if (words.some((word) => forbidden.has(word.value))) return null;
  const selectList = query.slice(selectWord.end, fromWord.start).trim();
  if (/^(?:all|distinct)\b/iu.test(selectList)) return null;
  const clauseStarts = new Set(["fetch", "limit", "offset", "order", "where"]);
  const nextClause = words.slice(fromWordIndex + 1).find((word) => clauseStarts.has(word.value));
  const fromEnd = nextClause?.start ?? query.length;
  const fromSource = query.slice(fromWord.end, fromEnd).trim();
  const fromMatch = fromSource.match(new RegExp(`^(${sqlIdentifier})(?:\\s+(?:as\\s+)?(${sqlIdentifier}))?$`, "iu"));
  if (!fromMatch || decodeIdentifier(fromMatch[1]).toLowerCase() !== "workspace_data") return null;
  const tableIdentifier = fromMatch[1];
  const aliasIdentifier = fromMatch[2] ?? tableIdentifier;
  const items = splitTopLevelList(selectList);
  if (!items) return null;
  const projections: QueryLineageProjection[] = [];
  for (const item of items) {
    const projection = classifyProjection(item, tableIdentifier, aliasIdentifier);
    if (!projection) return null;
    projections.push(projection);
  }
  const qualifiedRowId = `${aliasIdentifier}.rowid`;
  return {
    sql: `${query.slice(0, selectWord.end)} ${qualifiedRowId} AS "${QUERY_PROVENANCE_COLUMN}",${query.slice(selectWord.end)}`,
    projections,
  };
}

export function expandQueryLineageColumns(
  projections: QueryLineageProjection[],
  sourceColumns: string[],
): Array<string | null> {
  const resolveColumn = (requested: string) => {
    const matches = sourceColumns.filter((column) => column.toLowerCase() === requested.toLowerCase());
    return matches.length === 1 ? matches[0] : null;
  };
  return projections.flatMap((projection) => {
    if (projection.kind === "star") return sourceColumns;
    if (projection.kind === "column") return [resolveColumn(projection.sourceColumn)];
    return [null];
  });
}

export function queryLineageColumnsForOutput(
  projections: QueryLineageProjection[],
  sourceColumns: string[],
  outputColumnCount: number,
) {
  const columns = expandQueryLineageColumns(projections, sourceColumns);
  return columns.length === outputColumnCount ? columns : null;
}

function stripSqlComments(source: string): string {
  let result = "";
  let state: "normal" | "single" | "double" | "line" | "block" = "normal";
  let blockDepth = 0;

  for (let index = 0; index < source.length; index += 1) {
    const character = source[index];
    const next = source[index + 1];
    if (state === "line") {
      if (character === "\n") {
        result += "\n";
        state = "normal";
      }
      continue;
    }
    if (state === "block") {
      if (character === "/" && next === "*") {
        blockDepth += 1;
        index += 1;
      } else if (character === "*" && next === "/") {
        blockDepth -= 1;
        index += 1;
        if (!blockDepth) {
          result += " ";
          state = "normal";
        }
      }
      continue;
    }
    if (state === "single" || state === "double") {
      result += character;
      const quote = state === "single" ? "'" : '"';
      if (character === quote && next === quote) {
        result += next;
        index += 1;
      } else if (character === quote) {
        state = "normal";
      }
      continue;
    }
    if (character === "-" && next === "-") {
      state = "line";
      index += 1;
    } else if (character === "/" && next === "*") {
      state = "block";
      blockDepth = 1;
      index += 1;
    } else {
      result += character;
      if (character === "'") state = "single";
      if (character === '"') state = "double";
    }
  }
  return result;
}

function hasStatementSeparator(source: string): boolean {
  let quote: "'" | '"' | null = null;
  for (let index = 0; index < source.length; index += 1) {
    const character = source[index];
    if (quote) {
      if (character === quote && source[index + 1] === quote) index += 1;
      else if (character === quote) quote = null;
    } else if (character === "'" || character === '"') {
      quote = character;
    } else if (character === ";") {
      return true;
    }
  }
  return false;
}

export function normalizeReadQuery(source: string): string {
  return stripSqlComments(source)
    .trim()
    .replace(/;+\s*$/, "");
}

export function validateReadQuery(source: string): string[] {
  const query = normalizeReadQuery(source);
  if (!query) return ["Add a SELECT query to create a live result."];
  if (!/^(select|with)\b/i.test(query)) {
    return ["Orbit runs read-only SELECT or WITH queries in the live preview."];
  }
  if (hasStatementSeparator(query)) {
    return ["Run one SQL statement at a time in the live preview."];
  }
  return [];
}

export function buildBoundedQuery(source: string, limit = MAX_QUERY_ROWS): string {
  const errors = validateReadQuery(source);
  if (errors.length) throw new Error(errors[0]);
  const requestedLimit = Number.isFinite(limit) ? Math.floor(limit) : MAX_QUERY_ROWS;
  const safeLimit = Math.min(MAX_QUERY_ROWS, Math.max(1, requestedLimit));
  return `SELECT * FROM (${normalizeReadQuery(source)}) AS orbit_result LIMIT ${safeLimit + 1}`;
}
