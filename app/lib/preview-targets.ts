import { parseDeckSource, isDeckMarkdownArtifact } from "./deck.ts";
import { parseChartSource } from "./charts.ts";
import type { SourceSelection } from "./source-selection.ts";
import { parseDataSource, type DataCell, type WorkspaceArtifact } from "./workspace.ts";

export type PreviewSourceTargetKind = "document-section" | "data-row" | "data-cell" | "deck-slide" | "chart-spec";

export type PreviewSourceTarget = SourceSelection & {
  id: string;
  index: number;
  kind: PreviewSourceTargetKind;
  label: string;
};

export type DataCellPreviewSourceTarget = PreviewSourceTarget & {
  kind: "data-cell";
  rowIndex: number;
  columnIndex: number;
  column: string;
};

export type DataPreviewSourceTargets = {
  rows: PreviewSourceTarget[];
  cells: DataCellPreviewSourceTarget[];
};

export type ResolvedPreviewSourceTarget = {
  artifact: WorkspaceArtifact;
  target: PreviewSourceTarget;
};

export type ResolvedDataRowPreviewTargets = {
  artifact: WorkspaceArtifact;
  targets: PreviewSourceTarget[];
};

export type ResolvedDataPreviewSourceTargets = DataPreviewSourceTargets & {
  artifact: WorkspaceArtifact;
};

type SourceLine = {
  start: number;
  end: number;
  text: string;
};

function sourceLines(source: string): SourceLine[] {
  const lines: SourceLine[] = [];
  let start = 0;
  while (start < source.length) {
    const newline = source.indexOf("\n", start);
    const rawEnd = newline < 0 ? source.length : newline;
    const contentEnd = rawEnd > start && source[rawEnd - 1] === "\r" ? rawEnd - 1 : rawEnd;
    lines.push({ start, end: newline < 0 ? source.length : newline + 1, text: source.slice(start, contentEnd) });
    if (newline < 0) break;
    start = newline + 1;
  }
  return lines;
}

function boundedLabel(value: string, fallback: string) {
  const readable = value
    .replace(/\{\{[^}]+\}\}/g, "live value")
    .replace(/[*_`~\[\]<>]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (!readable) return fallback;
  return readable.length > 72 ? `${readable.slice(0, 69).trimEnd()}…` : readable;
}

function trimRange(source: string, start: number, end: number): SourceSelection | null {
  while (start < end && /\s/u.test(source[start])) start += 1;
  while (end > start && /\s/u.test(source[end - 1])) end -= 1;
  return start < end ? { start, end } : null;
}

function trimDocumentRange(source: string, start: number, end: number): SourceSelection | null {
  const fragment = source.slice(start, end);
  const leadingBlankLines = fragment.match(/^(?:[\t ]*(?:\r\n|\r|\n))+/u)?.[0].length ?? 0;
  const withoutLeading = fragment.slice(leadingBlankLines);
  const trailingBlankLines = withoutLeading.match(/[\t ]*(?:(?:\r\n|\r|\n)[\t ]*)+$/u)?.[0].length ?? 0;
  const nextStart = start + leadingBlankLines;
  const nextEnd = end - trailingBlankLines;
  return nextStart < nextEnd ? { start: nextStart, end: nextEnd } : null;
}

function documentTargets(source: string): PreviewSourceTarget[] {
  const headings: Array<{ start: number; label: string }> = [];
  let fence: { marker: "`" | "~"; length: number } | null = null;

  sourceLines(source).forEach((line) => {
    const fenceMatch = line.text.match(/^\s{0,3}(`{3,}|~{3,})/u);
    if (fenceMatch) {
      const marker = fenceMatch[1][0] as "`" | "~";
      if (!fence) fence = { marker, length: fenceMatch[1].length };
      else if (fence.marker === marker && fenceMatch[1].length >= fence.length) fence = null;
      return;
    }
    if (fence) return;
    const heading = line.text.match(/^\s{0,3}#{1,6}[\t ]+(.+?)[\t ]*#*[\t ]*$/u);
    if (heading) headings.push({ start: line.start, label: boundedLabel(heading[1], "Untitled section") });
  });

  if (!headings.length) {
    const range = trimDocumentRange(source, 0, source.length);
    return range ? [{ ...range, id: `document-section:0:${range.start}`, index: 0, kind: "document-section", label: "Document body" }] : [];
  }

  const targets: PreviewSourceTarget[] = [];
  const preamble = trimDocumentRange(source, 0, headings[0].start);
  if (preamble) {
    targets.push({ ...preamble, id: `document-section:0:${preamble.start}`, index: 0, kind: "document-section", label: "Document preamble" });
  }
  headings.forEach((heading, headingIndex) => {
    const end = headings[headingIndex + 1]?.start ?? source.length;
    const range = trimDocumentRange(source, heading.start, end);
    if (!range) return;
    const index = targets.length;
    targets.push({ ...range, id: `document-section:${index}:${range.start}`, index, kind: "document-section", label: heading.label });
  });
  return targets;
}

function csvRecordRanges(source: string): SourceSelection[] {
  const records: SourceSelection[] = [];
  const hasValue = (range: SourceSelection) => {
    const cells = [""];
    let quoted = false;
    for (let index = range.start; index < range.end; index += 1) {
      const character = source[index];
      if (character === '"') {
        if (quoted && source[index + 1] === '"') {
          cells[cells.length - 1] += '"';
          index += 1;
        } else quoted = !quoted;
      } else if (character === "," && !quoted) cells.push("");
      else cells[cells.length - 1] += character;
    }
    return cells.some((cell) => cell.trim().length > 0);
  };
  const append = (from: number, to: number) => {
    const range = trimRange(source, from, to);
    if (range && hasValue(range)) records.push(range);
  };
  let start = 0;
  let quoted = false;
  for (let index = 0; index < source.length; index += 1) {
    const character = source[index];
    if (character === '"') {
      if (quoted && source[index + 1] === '"') index += 1;
      else quoted = !quoted;
      continue;
    }
    if (quoted || (character !== "\n" && character !== "\r")) continue;
    append(start, index);
    if (character === "\r" && source[index + 1] === "\n") index += 1;
    start = index + 1;
  }
  append(start, source.length);
  return records;
}

function csvCellRanges(source: string, record: SourceSelection): Array<SourceSelection | null> {
  const ranges: Array<SourceSelection | null> = [];
  let start = record.start;
  let quoted = false;
  for (let index = record.start; index < record.end; index += 1) {
    const character = source[index];
    if (character === '"') {
      if (quoted && source[index + 1] === '"') index += 1;
      else quoted = !quoted;
      continue;
    }
    if (character !== "," || quoted) continue;
    ranges.push(trimRange(source, start, index));
    start = index + 1;
  }
  ranges.push(trimRange(source, start, record.end));
  return ranges;
}

function jsonValueEnd(source: string, start: number, limit: number) {
  const first = source[start];
  if (first === '"') {
    let escaped = false;
    for (let index = start + 1; index < limit; index += 1) {
      const character = source[index];
      if (escaped) escaped = false;
      else if (character === "\\") escaped = true;
      else if (character === '"') return index + 1;
    }
    return -1;
  }
  if (first === "{" || first === "[") {
    const stack = [first === "{" ? "}" : "]"];
    let quoted = false;
    let escaped = false;
    for (let index = start + 1; index < limit; index += 1) {
      const character = source[index];
      if (quoted) {
        if (escaped) escaped = false;
        else if (character === "\\") escaped = true;
        else if (character === '"') quoted = false;
        continue;
      }
      if (character === '"') quoted = true;
      else if (character === "{" || character === "[") stack.push(character === "{" ? "}" : "]");
      else if (character === stack[stack.length - 1]) {
        stack.pop();
        if (!stack.length) return index + 1;
      }
    }
    return -1;
  }
  let index = start;
  while (index < limit && source[index] !== "," && source[index] !== "]" && source[index] !== "}") index += 1;
  return index;
}

function jsonRowRanges(source: string): SourceSelection[] {
  const top = trimRange(source, 0, source.length);
  if (!top) return [];
  if (source[top.start] !== "[") return source[top.start] === "{" ? [top] : [];
  const ranges: SourceSelection[] = [];
  let index = top.start + 1;
  while (index < top.end) {
    while (index < top.end && /\s/u.test(source[index])) index += 1;
    if (source[index] === "]") break;
    const end = jsonValueEnd(source, index, top.end);
    if (end < 0) return [];
    const range = trimRange(source, index, end);
    if (range) ranges.push(range);
    index = end;
    while (index < top.end && /\s/u.test(source[index])) index += 1;
    if (source[index] === ",") index += 1;
    else if (source[index] !== "]") return [];
  }
  return ranges;
}

function skipJsonWhitespace(source: string, index: number, limit: number) {
  while (index < limit && /\s/u.test(source[index])) index += 1;
  return index;
}

function jsonObjectValueRanges(source: string, row: SourceSelection): Map<string, SourceSelection> | null {
  let index = skipJsonWhitespace(source, row.start, row.end);
  if (source[index] !== "{") return null;
  index += 1;
  const ranges = new Map<string, SourceSelection>();
  while (index < row.end) {
    index = skipJsonWhitespace(source, index, row.end);
    if (source[index] === "}") return ranges;
    if (source[index] !== '"') return null;
    const keyEnd = jsonValueEnd(source, index, row.end);
    if (keyEnd < 0) return null;
    let key: string;
    try {
      key = JSON.parse(source.slice(index, keyEnd)) as string;
    } catch {
      return null;
    }
    if (ranges.has(key)) return null;
    index = skipJsonWhitespace(source, keyEnd, row.end);
    if (source[index] !== ":") return null;
    index = skipJsonWhitespace(source, index + 1, row.end);
    const valueEnd = jsonValueEnd(source, index, row.end);
    if (valueEnd < 0) return null;
    const range = trimRange(source, index, valueEnd);
    if (!range) return null;
    ranges.set(key, range);
    index = skipJsonWhitespace(source, valueEnd, row.end);
    if (source[index] === ",") {
      index += 1;
      continue;
    }
    if (source[index] === "}") return ranges;
    return null;
  }
  return null;
}

function dataRowLabel(row: Record<string, DataCell> | undefined, firstColumn: string | undefined, index: number) {
  const value = firstColumn ? row?.[firstColumn] : undefined;
  const suffix = value == null || value === "" ? "" : ` · ${boundedLabel(String(value), "")}`;
  return `Row ${index + 1}${suffix}`;
}

function dataCellLabel(rowIndex: number, columnIndex: number, column: string) {
  return `Row ${rowIndex + 1} · ${boundedLabel(column, `Column ${columnIndex + 1}`)}`;
}

function dataTargets(source: string): DataPreviewSourceTargets {
  const parsed = parseDataSource(source);
  if (parsed.errors.length || !parsed.rows.length) return { rows: [], cells: [] };
  const ranges = parsed.format === "JSON" ? jsonRowRanges(source) : csvRecordRanges(source).slice(1);
  if (ranges.length !== parsed.rows.length) return { rows: [], cells: [] };
  const rows = ranges.map((range, index) => ({
    ...range,
    id: `data-row:${index}:${range.start}`,
    index,
    kind: "data-row" as const,
    label: dataRowLabel(parsed.rows[index], parsed.columns[0], index),
  }));
  const cells: DataCellPreviewSourceTarget[] = [];

  if (parsed.format === "CSV") {
    const cellRanges = ranges.map((range) => csvCellRanges(source, range));
    if (cellRanges.some((record) => record.length !== parsed.columns.length)) return { rows, cells: [] };
    cellRanges.forEach((record, rowIndex) => {
      record.forEach((range, columnIndex) => {
        if (!range) return;
        const column = parsed.columns[columnIndex];
        cells.push({
          ...range,
          id: `data-cell:${rowIndex}:${columnIndex}:${range.start}`,
          index: rowIndex,
          kind: "data-cell",
          label: dataCellLabel(rowIndex, columnIndex, column),
          rowIndex,
          columnIndex,
          column,
        });
      });
    });
  } else {
    ranges.forEach((rowRange, rowIndex) => {
      const first = source[skipJsonWhitespace(source, rowRange.start, rowRange.end)];
      const valueRanges = first === "{" ? jsonObjectValueRanges(source, rowRange) : null;
      parsed.columns.forEach((column, columnIndex) => {
        const range = valueRanges?.get(column)
          ?? (first !== "{" && column === "value" ? rowRange : null);
        if (!range) return;
        cells.push({
          ...range,
          id: `data-cell:${rowIndex}:${columnIndex}:${range.start}`,
          index: rowIndex,
          kind: "data-cell",
          label: dataCellLabel(rowIndex, columnIndex, column),
          rowIndex,
          columnIndex,
          column,
        });
      });
    });
  }

  return { rows, cells };
}

function deckTargets(source: string): PreviewSourceTarget[] {
  const parsed = parseDeckSource(source);
  if (!parsed.deck) return [];
  const lines = sourceLines(source);
  const closingIndex = lines.findIndex((line, index) => index > 0 && line.text.trim() === "---");
  if (closingIndex < 0) return [];
  const separators = lines.slice(closingIndex + 1).filter((line) => line.text.trim() === "---");
  const ranges: SourceSelection[] = [];
  let start = lines[closingIndex].end;
  separators.forEach((separator) => {
    const range = trimRange(source, start, separator.start);
    if (range) ranges.push(range);
    start = separator.end;
  });
  const finalRange = trimRange(source, start, source.length);
  if (finalRange) ranges.push(finalRange);
  if (ranges.length !== parsed.deck.slides.length) return [];
  return ranges.map((range, index) => {
    const heading = source.slice(range.start, range.end).match(/^#{1,2}[\t ]+(.+?)[\t ]*#*[\t ]*$/mu);
    return {
      ...range,
      id: `deck-slide:${index}:${range.start}`,
      index,
      kind: "deck-slide" as const,
      label: boundedLabel(heading?.[1] ?? "", `Slide ${index + 1}`),
    };
  });
}

function chartTargets(artifact: WorkspaceArtifact): PreviewSourceTarget[] {
  const parsed = parseChartSource(artifact.source);
  if (!parsed.spec || !artifact.source.length) return [];
  return [{
    start: 0,
    end: artifact.source.length,
    id: "chart-spec:0:0",
    index: 0,
    kind: "chart-spec",
    label: boundedLabel(parsed.spec.title, "Chart properties"),
  }];
}

export function derivePreviewSourceTargets(artifact: WorkspaceArtifact): PreviewSourceTarget[] {
  if (!artifact.source.trim()) return [];
  if (artifact.kind === "document") return documentTargets(artifact.source);
  if (artifact.kind === "data") return dataTargets(artifact.source).rows;
  if (artifact.kind === "chart") return chartTargets(artifact);
  if (artifact.kind === "slides" && isDeckMarkdownArtifact(artifact)) return deckTargets(artifact.source);
  return [];
}

export function deriveDataPreviewSourceTargets(artifact: WorkspaceArtifact): DataPreviewSourceTargets {
  if (artifact.kind !== "data" || !artifact.source.trim()) return { rows: [], cells: [] };
  return dataTargets(artifact.source);
}

export function previewTargetIsActive(target: PreviewSourceTarget, selection?: SourceSelection | null) {
  return Boolean(selection && target.start === selection.start && target.end === selection.end);
}

export function resolveDataRowPreviewTarget(
  artifactId: string,
  sourceRowIndex: number,
  artifacts: WorkspaceArtifact[],
): ResolvedPreviewSourceTarget | null {
  if (!Number.isInteger(sourceRowIndex) || sourceRowIndex < 0) return null;
  const resolved = resolveDataRowPreviewTargets(artifactId, artifacts);
  if (!resolved) return null;
  const target = resolved.targets.find((candidate) => candidate.index === sourceRowIndex);
  return target ? { artifact: resolved.artifact, target } : null;
}

export function resolveDataRowPreviewTargets(
  artifactId: string,
  artifacts: WorkspaceArtifact[],
): ResolvedDataRowPreviewTargets | null {
  const resolved = resolveDataPreviewSourceTargets(artifactId, artifacts);
  return resolved ? { artifact: resolved.artifact, targets: resolved.rows } : null;
}

export function resolveDataCellPreviewTarget(
  artifactId: string,
  sourceRowIndex: number,
  column: string,
  artifacts: WorkspaceArtifact[],
): ResolvedPreviewSourceTarget | null {
  if (!Number.isInteger(sourceRowIndex) || sourceRowIndex < 0 || !column) return null;
  const resolved = resolveDataPreviewSourceTargets(artifactId, artifacts);
  if (!resolved) return null;
  const target = resolved.cells.find((candidate) => (
    candidate.rowIndex === sourceRowIndex && candidate.column === column
  ));
  return target ? { artifact: resolved.artifact, target } : null;
}

export function resolveDataPreviewSourceTargets(
  artifactId: string,
  artifacts: WorkspaceArtifact[],
): ResolvedDataPreviewSourceTargets | null {
  const artifact = artifacts.find((candidate) => candidate.id === artifactId && candidate.kind === "data");
  if (!artifact) return null;
  const targets = deriveDataPreviewSourceTargets(artifact);
  return targets.rows.length ? { artifact, ...targets } : null;
}
