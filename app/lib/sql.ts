export const MAX_QUERY_ROWS = 500;

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
  return stripSqlComments(source).trim().replace(/;+\s*$/, "");
}

export function validateReadQuery(source: string): string[] {
  const query = normalizeReadQuery(source);
  if (!query) return ["Add a SELECT query to create a live result."];
  if (!/^(select|with)\b/i.test(query)) {
    return ["Rune runs read-only SELECT or WITH queries in the live preview."];
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
  return `SELECT * FROM (${normalizeReadQuery(source)}) AS rune_result LIMIT ${safeLimit + 1}`;
}
