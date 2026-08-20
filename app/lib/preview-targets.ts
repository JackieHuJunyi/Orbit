import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";
import { parseDeckSource, isDeckMarkdownArtifact } from "./deck.ts";
import { compileLegacyHtmlSlides } from "./legacy-html-slides.ts";
import { parseChartSource } from "./charts.ts";
import type { SourceSelection } from "./source-selection.ts";
import { parseDataSource, type DataCell, type WorkspaceArtifact } from "./workspace.ts";

export type PreviewSourceTargetKind =
  "document-section" | "document-block" | "document-fragment" | "data-row" | "data-cell" | "deck-slide" | "chart-spec";

export type DocumentBlockType = "heading" | "paragraph" | "list" | "quote" | "code" | "table" | "rule";

export type DocumentFragmentType =
  | "list-item"
  | "table-header-cell"
  | "table-cell"
  | "bold"
  | "italic"
  | "strikethrough"
  | "inline-code"
  | "link"
  | "image";

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

export type DocumentBlockPreviewSourceTarget = PreviewSourceTarget & {
  kind: "document-block";
  blockType: DocumentBlockType;
  headingLevel?: number;
};

export type DocumentFragmentPreviewSourceTarget = PreviewSourceTarget & {
  kind: "document-fragment";
  fragmentType: DocumentFragmentType;
  rowIndex?: number;
  columnIndex?: number;
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

const SOURCE_LINK_TARGET_PRIORITY: Record<PreviewSourceTargetKind, number> = {
  "document-fragment": 0,
  "data-cell": 0,
  "document-block": 1,
  "data-row": 2,
  "deck-slide": 3,
  "chart-spec": 3,
  "document-section": 4,
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
    return range
      ? [
          {
            ...range,
            id: `document-section:0:${range.start}`,
            index: 0,
            kind: "document-section",
            label: "Document body",
          },
        ]
      : [];
  }

  const targets: PreviewSourceTarget[] = [];
  const preamble = trimDocumentRange(source, 0, headings[0].start);
  if (preamble) {
    targets.push({
      ...preamble,
      id: `document-section:0:${preamble.start}`,
      index: 0,
      kind: "document-section",
      label: "Document preamble",
    });
  }
  headings.forEach((heading, headingIndex) => {
    const end = headings[headingIndex + 1]?.start ?? source.length;
    const range = trimDocumentRange(source, heading.start, end);
    if (!range) return;
    const index = targets.length;
    targets.push({
      ...range,
      id: `document-section:${index}:${range.start}`,
      index,
      kind: "document-section",
      label: heading.label,
    });
  });
  return targets;
}

type MarkdownNode = {
  type: string;
  value?: string;
  alt?: string;
  depth?: number;
  children?: MarkdownNode[];
  position?: {
    start?: { offset?: number };
    end?: { offset?: number };
  };
};

const DOCUMENT_BLOCK_TYPES: Partial<Record<string, DocumentBlockType>> = {
  heading: "heading",
  paragraph: "paragraph",
  list: "list",
  blockquote: "quote",
  code: "code",
  table: "table",
  thematicBreak: "rule",
};

const DOCUMENT_CHART_BINDING = /\{\{\s*chart\(["'][\p{L}\p{N}_.-]+["']\)\s*\}\}/u;

const DOCUMENT_BLOCK_FALLBACKS: Record<DocumentBlockType, string> = {
  heading: "Heading",
  paragraph: "Paragraph",
  list: "List",
  quote: "Quote",
  code: "Code block",
  table: "Table",
  rule: "Divider",
};

function documentNodeText(node: MarkdownNode): string {
  if (node.type === "text" || node.type === "inlineCode" || node.type === "code") return node.value ?? "";
  if (node.type === "image") return node.alt ?? "";
  if (node.type === "break") return " ";
  return (node.children ?? []).map(documentNodeText).join(" ");
}

function parseDocumentTree(source: string): MarkdownNode | null {
  try {
    return unified().use(remarkParse).use(remarkGfm).parse(source) as MarkdownNode;
  } catch {
    return null;
  }
}

function documentBlockTargets(source: string, root: MarkdownNode): DocumentBlockPreviewSourceTarget[] {
  const children = root.children ?? [];
  return children.flatMap((node, index) => {
    const blockType = DOCUMENT_BLOCK_TYPES[node.type];
    const start = node.position?.start?.offset;
    const end = node.position?.end?.offset;
    if (!blockType || start == null || end == null || start >= end) return [];
    if (blockType === "paragraph" && DOCUMENT_CHART_BINDING.test(source.slice(start, end))) return [];
    return [
      {
        start,
        end,
        id: `document-block:${index}:${start}`,
        index,
        kind: "document-block" as const,
        blockType,
        ...(blockType === "heading" && Number.isInteger(node.depth) ? { headingLevel: node.depth } : {}),
        label: boundedLabel(documentNodeText(node), DOCUMENT_BLOCK_FALLBACKS[blockType]),
      },
    ];
  });
}

const DOCUMENT_INLINE_FRAGMENT_TYPES: Partial<Record<string, DocumentFragmentType>> = {
  strong: "bold",
  emphasis: "italic",
  delete: "strikethrough",
  inlineCode: "inline-code",
  link: "link",
  image: "image",
};

const DOCUMENT_FRAGMENT_LABELS: Record<DocumentFragmentType, string> = {
  "list-item": "List item",
  "table-header-cell": "Table header",
  "table-cell": "Table cell",
  bold: "Bold",
  italic: "Italic",
  strikethrough: "Strikethrough",
  "inline-code": "Inline code",
  link: "Link",
  image: "Image",
};

function documentFragmentTargets(source: string, root: MarkdownNode): DocumentFragmentPreviewSourceTarget[] {
  const targets: DocumentFragmentPreviewSourceTarget[] = [];
  const append = (
    node: MarkdownNode,
    fragmentType: DocumentFragmentType,
    labelPrefix = DOCUMENT_FRAGMENT_LABELS[fragmentType],
    rowIndex?: number,
    columnIndex?: number,
  ) => {
    const start = node.position?.start?.offset;
    const end = node.position?.end?.offset;
    if (start == null || end == null || start >= end) return;
    const fragment = source.slice(start, end);
    if (DOCUMENT_CHART_BINDING.test(fragment)) return;
    const index = targets.length;
    const readable = boundedLabel(documentNodeText(node), labelPrefix);
    targets.push({
      start,
      end,
      id: `document-fragment:${index}:${start}`,
      index,
      kind: "document-fragment",
      fragmentType,
      label: readable === labelPrefix ? labelPrefix : `${labelPrefix} · ${readable}`,
      ...(rowIndex == null ? {} : { rowIndex }),
      ...(columnIndex == null ? {} : { columnIndex }),
    });
  };
  const visit = (node: MarkdownNode) => {
    if (node.type === "table") {
      const rows = node.children ?? [];
      const headerLabels = (rows[0]?.children ?? []).map((cell, columnIndex) =>
        boundedLabel(documentNodeText(cell), `Column ${columnIndex + 1}`),
      );
      rows.forEach((row, rowIndex) => {
        (row.children ?? []).forEach((cell, columnIndex) => {
          const fragmentType = rowIndex === 0 ? "table-header-cell" : "table-cell";
          const column = headerLabels[columnIndex] ?? `Column ${columnIndex + 1}`;
          const prefix = rowIndex === 0 ? "Table header" : `Table row ${rowIndex} · ${column}`;
          append(cell, fragmentType, prefix, rowIndex, columnIndex);
          (cell.children ?? []).forEach(visit);
        });
      });
      return;
    }
    if (node.type === "listItem") append(node, "list-item");
    const inlineType = DOCUMENT_INLINE_FRAGMENT_TYPES[node.type];
    if (inlineType) append(node, inlineType);
    (node.children ?? []).forEach(visit);
  };
  visit(root);
  return targets;
}

type CachedDocumentSyntaxTargets = {
  source: string;
  blocks: DocumentBlockPreviewSourceTarget[];
  fragments: DocumentFragmentPreviewSourceTarget[];
};

const DOCUMENT_SYNTAX_TARGET_CACHE = new WeakMap<WorkspaceArtifact, CachedDocumentSyntaxTargets>();

function documentSyntaxTargets(artifact: WorkspaceArtifact): CachedDocumentSyntaxTargets {
  const cached = DOCUMENT_SYNTAX_TARGET_CACHE.get(artifact);
  if (cached?.source === artifact.source) return cached;
  const root = parseDocumentTree(artifact.source);
  const targets = {
    source: artifact.source,
    blocks: root ? documentBlockTargets(artifact.source, root) : [],
    fragments: root ? documentFragmentTargets(artifact.source, root) : [],
  };
  DOCUMENT_SYNTAX_TARGET_CACHE.set(artifact, targets);
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
        const range = valueRanges?.get(column) ?? (first !== "{" && column === "value" ? rowRange : null);
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
  return [
    {
      start: 0,
      end: artifact.source.length,
      id: "chart-spec:0:0",
      index: 0,
      kind: "chart-spec",
      label: boundedLabel(parsed.spec.title, "Chart properties"),
    },
  ];
}

function legacyHtmlSlideTargets(source: string): PreviewSourceTarget[] {
  const compilation = compileLegacyHtmlSlides(source);
  if (compilation.errors.length) return [];
  return compilation.slides.map((slide) => ({
    start: slide.start,
    end: slide.end,
    id: `deck-slide:${slide.index}:${slide.start}`,
    index: slide.index,
    kind: "deck-slide" as const,
    label: slide.label,
  }));
}

export function derivePreviewSourceTargets(artifact: WorkspaceArtifact): PreviewSourceTarget[] {
  if (!artifact.source.trim()) return [];
  if (artifact.kind === "document") return documentTargets(artifact.source);
  if (artifact.kind === "data") return dataTargets(artifact.source).rows;
  if (artifact.kind === "chart") return chartTargets(artifact);
  if (artifact.kind === "slides") {
    return isDeckMarkdownArtifact(artifact) ? deckTargets(artifact.source) : legacyHtmlSlideTargets(artifact.source);
  }
  return [];
}

export function deriveDocumentBlockPreviewSourceTargets(
  artifact: WorkspaceArtifact,
): DocumentBlockPreviewSourceTarget[] {
  if (artifact.kind !== "document" || !artifact.source.trim()) return [];
  return documentSyntaxTargets(artifact).blocks;
}

export function deriveDocumentFragmentPreviewSourceTargets(
  artifact: WorkspaceArtifact,
): DocumentFragmentPreviewSourceTarget[] {
  if (artifact.kind !== "document" || !artifact.source.trim()) return [];
  return documentSyntaxTargets(artifact).fragments;
}

export function deriveDataPreviewSourceTargets(artifact: WorkspaceArtifact): DataPreviewSourceTargets {
  if (artifact.kind !== "data" || !artifact.source.trim()) return { rows: [], cells: [] };
  return dataTargets(artifact.source);
}

/**
 * Returns every canonical-source range that has a visible target in the
 * current artifact preview. The ranges may intentionally overlap: a
 * Document block belongs to a section and a Data cell belongs to a row.
 */
export function deriveSourceLinkedPreviewTargets(artifact: WorkspaceArtifact): PreviewSourceTarget[] {
  if (!artifact.source.trim()) return [];
  if (artifact.kind === "document") {
    return [
      ...deriveDocumentFragmentPreviewSourceTargets(artifact),
      ...deriveDocumentBlockPreviewSourceTargets(artifact),
      ...derivePreviewSourceTargets(artifact),
    ];
  }
  if (artifact.kind === "data") {
    const targets = deriveDataPreviewSourceTargets(artifact);
    return [...targets.cells, ...targets.rows];
  }
  return derivePreviewSourceTargets(artifact);
}

function sourceRangeCanLink(source: string, selection: SourceSelection) {
  if (
    !Number.isInteger(selection.start) ||
    !Number.isInteger(selection.end) ||
    selection.start < 0 ||
    selection.end < selection.start ||
    selection.end > source.length
  )
    return false;
  const splitsSurrogatePair = (offset: number) =>
    offset > 0 &&
    offset < source.length &&
    source.charCodeAt(offset - 1) >= 0xd800 &&
    source.charCodeAt(offset - 1) <= 0xdbff &&
    source.charCodeAt(offset) >= 0xdc00 &&
    source.charCodeAt(offset) <= 0xdfff;
  return !splitsSurrogatePair(selection.start) && !splitsSurrogatePair(selection.end);
}

/**
 * Resolves a textarea-compatible UTF-16 caret or selection to the smallest
 * visible preview range that fully contains it. Exact nested targets win over
 * their container (cell over row, block over section). At a shared boundary,
 * the target beginning at the caret wins over the target ending there.
 */
export function resolveSourceLinkedPreviewTarget(
  artifact: WorkspaceArtifact,
  selection: SourceSelection,
  targets = deriveSourceLinkedPreviewTargets(artifact),
): PreviewSourceTarget | null {
  if (!sourceRangeCanLink(artifact.source, selection)) return null;
  const collapsed = selection.start === selection.end;
  const candidates = targets.filter((target) =>
    collapsed
      ? target.start <= selection.start && selection.start <= target.end
      : target.start <= selection.start && selection.end <= target.end,
  );
  candidates.sort((left, right) => {
    if (collapsed) {
      const leftStartsHere = selection.start === left.start;
      const rightStartsHere = selection.start === right.start;
      if (leftStartsHere !== rightStartsHere) return leftStartsHere ? -1 : 1;
    }
    const span = left.end - left.start - (right.end - right.start);
    if (span) return span;
    const priority = SOURCE_LINK_TARGET_PRIORITY[left.kind] - SOURCE_LINK_TARGET_PRIORITY[right.kind];
    if (priority) return priority;
    return left.index - right.index || left.id.localeCompare(right.id);
  });
  return candidates[0] ?? null;
}

export function previewTargetIsActive(target: PreviewSourceTarget, selection?: SourceSelection | null) {
  if (!selection) return false;
  if ("id" in selection && typeof selection.id === "string") return target.id === selection.id;
  return target.start === selection.start && target.end === selection.end;
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
  const target = resolved.cells.find(
    (candidate) => candidate.rowIndex === sourceRowIndex && candidate.column === column,
  );
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
