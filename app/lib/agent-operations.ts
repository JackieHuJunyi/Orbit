import Papa from "papaparse";
import {
  AgentCompiledPatchSchema,
  AgentCompiledWorkspacePatchSchema,
  type AgentArtifactReference,
  type AgentCompiledPatch,
  type AgentCompiledWorkspacePatch,
  type AgentOperationPatch,
  type AgentSourceSelection,
  type AgentSourceOperation,
  type AgentWorkspaceOperationPlan,
} from "./agent-contract.ts";
import { prepareArtifactCreation, type ArtifactCreationInput } from "./artifact-creation.ts";
import { findChartReferences, formatChartReference } from "./charts.ts";
import { isDeckMarkdownArtifact } from "./deck.ts";
import { buildWorkspaceDependencyGraph } from "./dependency-graph.ts";
import { sourceOutsideSelectionIsUnchanged } from "./source-selection.ts";
import {
  appendSemanticHtmlPresentationSlide,
  escapeSemanticHtml,
  insertSemanticHtmlPresentationSlideAfter,
  replaceSemanticHtmlPresentationSlide,
} from "./semantic-html-presentation.ts";
import { parseDataSource, type DataCell, type WorkspaceArtifact } from "./workspace.ts";

export const MAX_COMPILED_AGENT_SOURCE_CHARS = 120_000;

type ExactTextOperation = Extract<AgentSourceOperation, { type: "replace_text" }>;

type SourceOperationCompilation = {
  nextSource: string;
  errors: string[];
};

type PlanCompilation<Plan> = {
  plan?: Plan;
  errors: string[];
};

type AgentCompilableOperationPatch = Omit<AgentOperationPatch, "edits"> & {
  edits: AgentSourceOperation[];
};

type MarkdownSection = {
  title: string;
  level: number;
  start: number;
  headingEnd: number;
  end: number;
};

type DeckParts = {
  frontmatter: string;
  slides: string[];
  trailingNewline: boolean;
};

function sourceNewline(source: string) {
  return source.includes("\r\n") ? "\r\n" : "\n";
}

function withSourceNewline(source: string, normalized: string) {
  return sourceNewline(source) === "\r\n" ? normalized.replaceAll("\n", "\r\n") : normalized;
}

function exactMatch(source: string, find: string) {
  const first = source.indexOf(find);
  if (first < 0) return { count: 0, index: -1 };
  const second = source.indexOf(find, first + 1);
  return { count: second < 0 ? 1 : 2, index: first };
}

function applyExactTextOperation(source: string, edit: ExactTextOperation): SourceOperationCompilation {
  if (edit.find === edit.replace)
    return { nextSource: source, errors: ["The exact replacement does not change its anchor."] };
  const match = exactMatch(source, edit.find);
  if (match.count === 0)
    return { nextSource: source, errors: ["The exact anchor does not match the current source revision."] };
  if (match.count > 1)
    return { nextSource: source, errors: ["The exact anchor is ambiguous in the current source revision."] };
  return {
    nextSource: `${source.slice(0, match.index)}${edit.replace}${source.slice(match.index + edit.find.length)}`,
    errors: [],
  };
}

function markdownSections(source: string): MarkdownSection[] {
  const headings: Omit<MarkdownSection, "end">[] = [];
  let offset = 0;
  let fence: { marker: "`" | "~"; length: number } | undefined;
  source.split("\n").forEach((line) => {
    const fenceMatch = line.match(/^[\t ]{0,3}(`{3,}|~{3,})/);
    if (fence) {
      const closingFence = line.match(/^[\t ]{0,3}(`{3,}|~{3,})[\t ]*$/);
      if (closingFence && closingFence[1][0] === fence.marker && closingFence[1].length >= fence.length)
        fence = undefined;
      offset += line.length + 1;
      return;
    }
    if (fenceMatch) {
      fence = { marker: fenceMatch[1][0] as "`" | "~", length: fenceMatch[1].length };
    } else {
      const heading = line.match(/^[\t ]{0,3}(#{1,6})[\t ]+(.+?)[\t ]*$/);
      if (heading) {
        headings.push({
          title: heading[2].replace(/[\t ]+#+[\t ]*$/, "").trim(),
          level: heading[1].length,
          start: offset,
          headingEnd: offset + line.length,
        });
      }
    }
    offset += line.length + 1;
  });
  return headings.map((heading, index) => ({
    ...heading,
    end: headings.slice(index + 1).find((candidate) => candidate.level <= heading.level)?.start ?? source.length,
  }));
}

function oneMarkdownSection(source: string, heading: string) {
  const target = heading.trim();
  const matches = markdownSections(source).filter((section) => section.title === target);
  if (!matches.length) return { error: `Markdown heading not found: ${target}` };
  if (matches.length > 1) return { error: `Markdown heading is ambiguous: ${target}` };
  return { section: matches[0] };
}

function replaceMarkdownSection(
  source: string,
  edit: Extract<AgentSourceOperation, { type: "replace_markdown_section" }>,
): SourceOperationCompilation {
  const normalized = source.replace(/\r\n?/g, "\n");
  const resolved = oneMarkdownSection(normalized, edit.heading);
  if (!resolved.section)
    return { nextSource: source, errors: [resolved.error ?? "The Markdown section could not be resolved."] };
  const before = normalized.slice(0, resolved.section.headingEnd);
  const after = normalized.slice(resolved.section.end).trimStart();
  const body = edit.body.trim();
  let nextSource = `${before}${body ? `\n\n${body}` : ""}`;
  if (after) nextSource = `${nextSource}\n\n${after}`;
  else if (normalized.endsWith("\n")) nextSource += "\n";
  return { nextSource: withSourceNewline(source, nextSource), errors: [] };
}

function insertMarkdownSection(
  source: string,
  edit: Extract<AgentSourceOperation, { type: "insert_markdown_section_after" }>,
): SourceOperationCompilation {
  const normalized = source.replace(/\r\n?/g, "\n");
  const resolved = oneMarkdownSection(normalized, edit.heading);
  if (!resolved.section)
    return { nextSource: source, errors: [resolved.error ?? "The Markdown section could not be resolved."] };
  const inserted = edit.section.trim();
  if (!/^#{1,6}[\t ]+\S/.test(inserted)) {
    return { nextSource: source, errors: ["An inserted Markdown section must start with its own heading."] };
  }
  const before = normalized.slice(0, resolved.section.end).trimEnd();
  const after = normalized.slice(resolved.section.end).trimStart();
  let nextSource = `${before}\n\n${inserted}`;
  if (after) nextSource = `${nextSource}\n\n${after}`;
  else if (normalized.endsWith("\n")) nextSource += "\n";
  return { nextSource: withSourceNewline(source, nextSource), errors: [] };
}

function cellsEqual(left: DataCell, right: DataCell) {
  return Object.is(left, right);
}

function dataKeyIdentity(value: DataCell) {
  if (typeof value === "number") return `number:${Object.is(value, -0) ? "-0" : String(value)}`;
  return `${typeof value}:${String(value)}`;
}

function validateUniqueDataKey(rows: Array<Record<string, DataCell>>, keyColumn: string) {
  const seen = new Set<string>();
  for (const row of rows) {
    const key = row[keyColumn];
    if (key == null || key === "") return `Data key column ${keyColumn} contains an empty value.`;
    const identity = dataKeyIdentity(key);
    if (seen.has(identity)) return `Data key column ${keyColumn} is ambiguous because its values are not unique.`;
    seen.add(identity);
  }
  return "";
}

function validateFlatJsonRows(source: string) {
  try {
    const parsed = JSON.parse(source.trim());
    const rows = Array.isArray(parsed) ? parsed : [parsed];
    if (!rows.every((row) => row && typeof row === "object" && !Array.isArray(row))) {
      return { error: "Semantic data-row operations require JSON objects or an array of objects." };
    }
    if (rows.some((row) => Object.values(row).some((cell) => cell !== null && typeof cell === "object"))) {
      return { error: "Semantic data-row operations require flat JSON cells." };
    }
    return { array: Array.isArray(parsed) };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Invalid JSON." };
  }
}

function serializeDataRows(
  source: string,
  format: "CSV" | "JSON",
  columns: string[],
  rows: Array<Record<string, DataCell>>,
  jsonArray: boolean,
) {
  let result =
    format === "CSV"
      ? rows.length
        ? Papa.unparse(rows, { columns, newline: sourceNewline(source) })
        : Papa.unparse({ fields: columns, data: [] }, { newline: sourceNewline(source) })
      : JSON.stringify(jsonArray ? rows : rows[0], null, 2);
  if (source.endsWith("\n") && !result.endsWith("\n")) result += sourceNewline(source);
  return result;
}

function upsertDataRow(
  source: string,
  edit: Extract<AgentSourceOperation, { type: "upsert_data_row" }>,
): SourceOperationCompilation {
  const parsed = parseDataSource(source);
  if (parsed.errors.length || !parsed.columns.length) {
    return { nextSource: source, errors: [parsed.errors[0] ?? "The data source has no columns."] };
  }
  if (!parsed.columns.includes(edit.keyColumn)) {
    return { nextSource: source, errors: [`Data key column not found: ${edit.keyColumn}`] };
  }
  const duplicateCells = edit.cells.filter(
    (cell, index) => edit.cells.findIndex((candidate) => candidate.column === cell.column) !== index,
  );
  if (duplicateCells.length)
    return { nextSource: source, errors: [`Data operation repeats column: ${duplicateCells[0].column}`] };
  const unknownCell = edit.cells.find((cell) => !parsed.columns.includes(cell.column));
  if (unknownCell) return { nextSource: source, errors: [`Data column not found: ${unknownCell.column}`] };
  const keyCell = edit.cells.find((cell) => cell.column === edit.keyColumn);
  if (keyCell && !cellsEqual(keyCell.value, edit.keyValue)) {
    return { nextSource: source, errors: ["A data-row operation cannot change the key used to identify that row."] };
  }

  let jsonArray = true;
  if (parsed.format === "JSON") {
    const jsonShape = validateFlatJsonRows(source);
    if (jsonShape.error) return { nextSource: source, errors: [jsonShape.error] };
    jsonArray = jsonShape.array ?? true;
  }

  const rows = parsed.rows.map((row) => ({ ...row }));
  const invalidKey = validateUniqueDataKey(rows, edit.keyColumn);
  if (invalidKey) return { nextSource: source, errors: [invalidKey] };
  const matches = rows.flatMap((row, index) => (cellsEqual(row[edit.keyColumn] ?? null, edit.keyValue) ? [index] : []));
  if (matches.length > 1) {
    return { nextSource: source, errors: [`Data key is ambiguous in ${edit.keyColumn}.`] };
  }
  if (!matches.length && parsed.format === "JSON" && !jsonArray) {
    return { nextSource: source, errors: ["A single-object JSON source cannot insert a second row."] };
  }

  const row = matches.length
    ? { ...rows[matches[0]] }
    : (Object.fromEntries(parsed.columns.map((column) => [column, null])) as Record<string, DataCell>);
  if (matches.length && edit.cells.every((cell) => cellsEqual(row[cell.column] ?? null, cell.value))) {
    return { nextSource: source, errors: ["The data-row operation does not change the targeted row."] };
  }
  if (!matches.length) row[edit.keyColumn] = edit.keyValue;
  edit.cells.forEach((cell) => {
    row[cell.column] = cell.value;
  });
  if (!matches.length && !cellsEqual(row[edit.keyColumn] ?? null, edit.keyValue)) {
    return { nextSource: source, errors: ["A new data row cannot override its own key value."] };
  }
  if (matches.length) rows[matches[0]] = row;
  else rows.push(row);

  const resultingKey = row[edit.keyColumn] ?? null;
  if (rows.filter((candidate) => cellsEqual(candidate[edit.keyColumn] ?? null, resultingKey)).length > 1) {
    return { nextSource: source, errors: [`The data operation would create a duplicate ${edit.keyColumn} key.`] };
  }
  return {
    nextSource: serializeDataRows(source, parsed.format, parsed.columns, rows, jsonArray),
    errors: [],
  };
}

function semanticDataRows(source: string) {
  const parsed = parseDataSource(source);
  if (parsed.errors.length || !parsed.columns.length) {
    return { parsed, jsonArray: true, error: parsed.errors[0] ?? "The data source has no columns." };
  }
  let jsonArray = true;
  if (parsed.format === "JSON") {
    const jsonShape = validateFlatJsonRows(source);
    if (jsonShape.error) return { parsed, jsonArray, error: jsonShape.error };
    jsonArray = jsonShape.array ?? true;
  }
  return { parsed, jsonArray, error: "" };
}

function upsertDataColumn(
  source: string,
  edit: Extract<AgentSourceOperation, { type: "upsert_data_column" }>,
): SourceOperationCompilation {
  const semantic = semanticDataRows(source);
  if (semantic.error) return { nextSource: source, errors: [semantic.error] };
  const { parsed, jsonArray } = semantic;
  if (!parsed.columns.includes(edit.keyColumn)) {
    return { nextSource: source, errors: [`Data key column not found: ${edit.keyColumn}`] };
  }
  if (!edit.column.trim() || edit.column !== edit.column.trim() || /[\r\n]/.test(edit.column)) {
    return {
      nextSource: source,
      errors: ["A data column name must be non-empty, single-line, and have no outer whitespace."],
    };
  }
  if (edit.column === edit.keyColumn) {
    return {
      nextSource: source,
      errors: ["A data-column operation cannot change the key column used to identify rows."],
    };
  }

  const rows = parsed.rows.map((row) => ({ ...row }));
  const invalidKey = validateUniqueDataKey(rows, edit.keyColumn);
  if (invalidKey) return { nextSource: source, errors: [invalidKey] };
  const requestedKeys = new Set<string>();
  const rowIndexByKey = new Map(rows.map((row, index) => [dataKeyIdentity(row[edit.keyColumn]), index] as const));
  const updates: Array<{ rowIndex: number; value: DataCell }> = [];
  for (const entry of edit.values) {
    const identity = dataKeyIdentity(entry.keyValue);
    if (requestedKeys.has(identity)) {
      return { nextSource: source, errors: [`Data column operation repeats key: ${String(entry.keyValue)}`] };
    }
    requestedKeys.add(identity);
    const rowIndex = rowIndexByKey.get(identity);
    if (rowIndex == null) {
      return { nextSource: source, errors: [`Data row not found for ${edit.keyColumn}: ${String(entry.keyValue)}`] };
    }
    updates.push({ rowIndex, value: entry.value });
  }

  const existing = parsed.columns.includes(edit.column);
  if (!existing && requestedKeys.size !== rows.length) {
    return {
      nextSource: source,
      errors: [`A new data column must provide exactly one value for every current row (${rows.length}).`],
    };
  }
  if (existing && !updates.length) {
    return { nextSource: source, errors: ["Updating an existing data column requires at least one keyed value."] };
  }
  if (existing && updates.every(({ rowIndex, value }) => cellsEqual(rows[rowIndex][edit.column] ?? null, value))) {
    return { nextSource: source, errors: ["The data-column operation does not change any targeted value."] };
  }
  updates.forEach(({ rowIndex, value }) => {
    rows[rowIndex][edit.column] = value;
  });
  const columns = existing ? parsed.columns : [...parsed.columns, edit.column];
  return {
    nextSource: serializeDataRows(source, parsed.format, columns, rows, jsonArray),
    errors: [],
  };
}

function renameDataColumn(
  source: string,
  edit: Extract<AgentSourceOperation, { type: "rename_data_column" }>,
): SourceOperationCompilation {
  const semantic = semanticDataRows(source);
  if (semantic.error) return { nextSource: source, errors: [semantic.error] };
  const { parsed, jsonArray } = semantic;
  if (!parsed.columns.includes(edit.column)) {
    return { nextSource: source, errors: [`Data column not found: ${edit.column}`] };
  }
  if (!edit.nextColumn.trim() || edit.nextColumn !== edit.nextColumn.trim() || /[\r\n]/.test(edit.nextColumn)) {
    return {
      nextSource: source,
      errors: ["A renamed data column must be non-empty, single-line, and have no outer whitespace."],
    };
  }
  if (edit.nextColumn === edit.column) {
    return { nextSource: source, errors: ["The renamed data column is unchanged."] };
  }
  if (parsed.columns.includes(edit.nextColumn)) {
    return { nextSource: source, errors: [`Data column already exists: ${edit.nextColumn}`] };
  }
  const rows = parsed.rows.map(
    (row) =>
      Object.fromEntries(
        Object.entries(row).map(([column, value]) =>
          column === edit.column ? [edit.nextColumn, value] : [column, value],
        ),
      ) as Record<string, DataCell>,
  );
  const columns = parsed.columns.map((column) => (column === edit.column ? edit.nextColumn : column));
  return {
    nextSource: serializeDataRows(source, parsed.format, columns, rows, jsonArray),
    errors: [],
  };
}

function splitDeck(source: string): { deck?: DeckParts; error?: string } {
  const normalized = source.replace(/\r\n?/g, "\n");
  const lines = normalized.split("\n");
  if (lines[0]?.trim() !== "---") return { error: "Deck Markdown must start with frontmatter." };
  const closing = lines.findIndex((line, index) => index > 0 && line.trim() === "---");
  if (closing < 0) return { error: "Deck frontmatter is missing its closing delimiter." };
  const body = lines
    .slice(closing + 1)
    .join("\n")
    .trim();
  const slides = body
    .split(/^\s*---\s*$/m)
    .map((slide) => slide.trim())
    .filter(Boolean);
  if (!slides.length) return { error: "Deck Markdown has no slides." };
  return {
    deck: {
      frontmatter: lines.slice(0, closing + 1).join("\n"),
      slides,
      trailingNewline: normalized.endsWith("\n"),
    },
  };
}

function deckSlideTitle(slide: string) {
  const match = slide.match(/^#{1,2}[\t ]+(.+?)[\t ]*$/m);
  return match?.[1].replace(/[\t ]+#+[\t ]*$/, "").trim() ?? "";
}

function validateSlideFragment(slide: string) {
  const value = slide.trim();
  if (!value) return "A Deck slide operation needs a complete slide.";
  if (/^\s*---\s*$/m.test(value)) return "A Deck slide operation cannot contain a slide separator.";
  if (!deckSlideTitle(value)) return "A Deck slide operation needs a # or ## title.";
  return "";
}

function deckSlideIndex(deck: DeckParts, title: string) {
  const target = title.trim();
  const matches = deck.slides.flatMap((slide, index) => (deckSlideTitle(slide) === target ? [index] : []));
  if (!matches.length) return { error: `Deck slide title not found: ${target}` };
  if (matches.length > 1) return { error: `Deck slide title is ambiguous: ${target}` };
  return { index: matches[0] };
}

function serializeDeck(source: string, deck: DeckParts) {
  const normalized = `${deck.frontmatter}\n\n${deck.slides.join("\n\n---\n\n")}${deck.trailingNewline ? "\n" : ""}`;
  return withSourceNewline(source, normalized);
}

function replaceDeckSlide(
  source: string,
  edit: Extract<AgentSourceOperation, { type: "replace_deck_slide" }>,
): SourceOperationCompilation {
  const parsed = splitDeck(source);
  if (!parsed.deck) return { nextSource: source, errors: [parsed.error ?? "The Deck could not be parsed."] };
  const invalid = validateSlideFragment(edit.slide);
  if (invalid) return { nextSource: source, errors: [invalid] };
  const resolved = deckSlideIndex(parsed.deck, edit.title);
  if (resolved.index == null)
    return { nextSource: source, errors: [resolved.error ?? "The Deck slide could not be resolved."] };
  parsed.deck.slides[resolved.index] = edit.slide.trim();
  return { nextSource: serializeDeck(source, parsed.deck), errors: [] };
}

function insertDeckSlide(
  source: string,
  edit: Extract<AgentSourceOperation, { type: "insert_deck_slide_after" }>,
): SourceOperationCompilation {
  const parsed = splitDeck(source);
  if (!parsed.deck) return { nextSource: source, errors: [parsed.error ?? "The Deck could not be parsed."] };
  const invalid = validateSlideFragment(edit.slide);
  if (invalid) return { nextSource: source, errors: [invalid] };
  const resolved = deckSlideIndex(parsed.deck, edit.title);
  if (resolved.index == null)
    return { nextSource: source, errors: [resolved.error ?? "The Deck slide could not be resolved."] };
  parsed.deck.slides.splice(resolved.index + 1, 0, edit.slide.trim());
  return { nextSource: serializeDeck(source, parsed.deck), errors: [] };
}

function appendChart(
  artifact: WorkspaceArtifact,
  source: string,
  edit: Extract<AgentSourceOperation, { type: "append_chart" }>,
): SourceOperationCompilation {
  if (edit.chart.kind !== "artifact") {
    return { nextSource: source, errors: ["Creation handles can be resolved only in Workspace scope."] };
  }
  if (findChartReferences(source).includes(edit.chart.artifactId)) {
    return { nextSource: source, errors: [`This source already embeds Chart ${edit.chart.artifactId}.`] };
  }
  let reference: string;
  try {
    reference = formatChartReference(edit.chart.artifactId);
  } catch (error) {
    return { nextSource: source, errors: [error instanceof Error ? error.message : "The Chart reference is invalid."] };
  }
  if (artifact.kind === "document") {
    return {
      nextSource: `${source.trimEnd()}\n\n## ${edit.heading}\n\n${reference}\n`,
      errors: [],
    };
  }
  if (artifact.kind === "slides") {
    if (isDeckMarkdownArtifact(artifact)) {
      return {
        nextSource: `${source.trimEnd()}\n\n---\n\n<!-- layout: split -->\n\n# ${edit.heading}\n\n${reference}\n`,
        errors: [],
      };
    }
    const appended = appendSemanticHtmlPresentationSlide(
      source,
      `<section class="slide split" data-layout="split"><div class="slide-body"><h2>${escapeSemanticHtml(edit.heading)}</h2><div class="chart-slot">${reference}</div></div></section>`,
    );
    return appended.source
      ? { nextSource: appended.source, errors: [] }
      : { nextSource: source, errors: [...appended.errors] };
  }
  return {
    nextSource: source,
    errors: ["append_chart only supports Markdown documents or semantic presentations."],
  };
}

function applyArtifactOperation(
  artifact: WorkspaceArtifact,
  source: string,
  edit: AgentSourceOperation,
): SourceOperationCompilation {
  if (edit.type === "replace_text") return applyExactTextOperation(source, edit);
  if (edit.type === "replace_markdown_section") {
    return artifact.kind === "document"
      ? replaceMarkdownSection(source, edit)
      : { nextSource: source, errors: ["replace_markdown_section only supports Markdown documents."] };
  }
  if (edit.type === "insert_markdown_section_after") {
    return artifact.kind === "document"
      ? insertMarkdownSection(source, edit)
      : { nextSource: source, errors: ["insert_markdown_section_after only supports Markdown documents."] };
  }
  if (edit.type === "upsert_data_row") {
    return artifact.kind === "data"
      ? upsertDataRow(source, edit)
      : { nextSource: source, errors: ["upsert_data_row only supports CSV or JSON data artifacts."] };
  }
  if (edit.type === "upsert_data_column") {
    return artifact.kind === "data"
      ? upsertDataColumn(source, edit)
      : { nextSource: source, errors: ["upsert_data_column only supports CSV or JSON data artifacts."] };
  }
  if (edit.type === "rename_data_column") {
    return artifact.kind === "data"
      ? renameDataColumn(source, edit)
      : { nextSource: source, errors: ["rename_data_column only supports CSV or JSON data artifacts."] };
  }
  if (edit.type === "replace_deck_slide") {
    return artifact.kind === "slides" && isDeckMarkdownArtifact(artifact)
      ? replaceDeckSlide(source, edit)
      : { nextSource: source, errors: ["replace_deck_slide only supports Deck Markdown presentations."] };
  }
  if (edit.type === "insert_deck_slide_after") {
    return artifact.kind === "slides" && isDeckMarkdownArtifact(artifact)
      ? insertDeckSlide(source, edit)
      : { nextSource: source, errors: ["insert_deck_slide_after only supports Deck Markdown presentations."] };
  }
  if (edit.type === "replace_html_slide") {
    if (artifact.kind !== "slides" || isDeckMarkdownArtifact(artifact)) {
      return {
        nextSource: source,
        errors: ["replace_html_slide only supports semantic HTML presentations."],
      };
    }
    const replaced = replaceSemanticHtmlPresentationSlide(source, edit.index, edit.section);
    return replaced.source
      ? { nextSource: replaced.source, errors: [] }
      : { nextSource: source, errors: [...replaced.errors] };
  }
  if (edit.type === "insert_html_slide_after") {
    if (artifact.kind !== "slides" || isDeckMarkdownArtifact(artifact)) {
      return {
        nextSource: source,
        errors: ["insert_html_slide_after only supports semantic HTML presentations."],
      };
    }
    const inserted = insertSemanticHtmlPresentationSlideAfter(source, edit.index, edit.section);
    return inserted.source
      ? { nextSource: inserted.source, errors: [] }
      : { nextSource: source, errors: [...inserted.errors] };
  }
  return appendChart(artifact, source, edit);
}

export function applyAgentSourceOperations(source: string, edits: ExactTextOperation[]): SourceOperationCompilation {
  if (!edits.length) return { nextSource: source, errors: ["The plan does not contain any source operations."] };
  let nextSource = source;
  for (let index = 0; index < edits.length; index += 1) {
    const compiled = applyExactTextOperation(nextSource, edits[index]);
    if (compiled.errors.length) {
      return { nextSource: source, errors: compiled.errors.map((error) => `Operation ${index + 1}: ${error}`) };
    }
    nextSource = compiled.nextSource;
    if (nextSource.length > MAX_COMPILED_AGENT_SOURCE_CHARS) {
      return {
        nextSource: source,
        errors: [`Operation ${index + 1} would exceed Rune's 120,000-character Agent output limit.`],
      };
    }
  }
  if (nextSource === source)
    return { nextSource: source, errors: ["The ordered source operations cancel out without changing the file."] };
  return { nextSource, errors: [] };
}

export function applyAgentArtifactOperations(
  artifact: WorkspaceArtifact,
  edits: AgentSourceOperation[],
): SourceOperationCompilation {
  if (!edits.length)
    return { nextSource: artifact.source, errors: ["The plan does not contain any source operations."] };
  let nextSource = artifact.source;
  for (let index = 0; index < edits.length; index += 1) {
    const compiled = applyArtifactOperation(artifact, nextSource, edits[index]);
    if (compiled.errors.length) {
      return {
        nextSource: artifact.source,
        errors: compiled.errors.map((error) => `Operation ${index + 1} (${edits[index].type}): ${error}`),
      };
    }
    nextSource = compiled.nextSource;
    if (nextSource.length > MAX_COMPILED_AGENT_SOURCE_CHARS) {
      return {
        nextSource: artifact.source,
        errors: [`Operation ${index + 1} would exceed Rune's 120,000-character Agent output limit.`],
      };
    }
  }
  if (nextSource === artifact.source) {
    return {
      nextSource: artifact.source,
      errors: ["The ordered source operations cancel out without changing the file."],
    };
  }
  return { nextSource, errors: [] };
}

export function compileAgentOperationPatch(
  artifact: WorkspaceArtifact,
  patch: AgentCompilableOperationPatch,
): PlanCompilation<AgentCompiledPatch> {
  const compiled = applyAgentArtifactOperations(artifact, patch.edits);
  if (compiled.errors.length) return { errors: compiled.errors };
  const plan = AgentCompiledPatchSchema.safeParse({
    summary: patch.summary,
    detail: patch.detail,
    nextSource: compiled.nextSource,
    operationCount: patch.edits.length,
  });
  return plan.success
    ? { plan: plan.data, errors: [] }
    : { errors: ["The compiled Agent patch exceeds Rune's bounded review contract."] };
}

export function validateCompiledSelectionPatch(
  artifact: WorkspaceArtifact,
  selection: AgentSourceSelection,
  nextSource: string,
): string[] {
  if (selection.start < 0 || selection.start >= selection.end || selection.end > artifact.source.length) {
    return ["The selected source range does not match the current artifact revision."];
  }
  if (!sourceOutsideSelectionIsUnchanged(artifact.source, nextSource, selection)) {
    return ["The compiled source operations cross the selected source range."];
  }
  return [];
}

export function compileAgentWorkspaceOperations(
  artifacts: WorkspaceArtifact[],
  operationPlan: AgentWorkspaceOperationPlan,
): PlanCompilation<AgentCompiledWorkspacePatch> {
  const errors: string[] = [];
  const seen = new Set<string>();
  const compiledPatches: AgentCompiledWorkspacePatch["patches"] = [];
  const compiledCreations: AgentCompiledWorkspacePatch["creations"] = [];
  const creationHandles = new Map<string, WorkspaceArtifact>();
  const authorizedSamePlanDependencies = new Set<string>();
  let workingArtifacts = artifacts;

  const dependencyKey = (fromArtifactId: string, toArtifactId: string) => `${fromArtifactId}\u0000${toArtifactId}`;
  const resolveReference = (
    reference: AgentArtifactReference | undefined,
    expectedKinds: WorkspaceArtifact["kind"][],
  ): { artifact?: WorkspaceArtifact; fromCreation?: boolean; error?: string } => {
    if (!reference || (reference.kind !== "artifact" && reference.kind !== "creation")) {
      return { error: "Artifact reference is missing or malformed." };
    }
    const artifact =
      reference.kind === "artifact"
        ? artifacts.find((candidate) => candidate.id === reference.artifactId)
        : creationHandles.get(reference.handle);
    const label = reference.kind === "artifact" ? reference.artifactId : reference.handle;
    if (!artifact) {
      return {
        error:
          reference.kind === "artifact"
            ? `Artifact reference must name an exact existing visible artifact: ${label}`
            : `Creation handle must name an earlier successful creation: ${label}`,
      };
    }
    if (!expectedKinds.includes(artifact.kind)) {
      return { error: `${label} must resolve to ${expectedKinds.join(" or ")}, not ${artifact.kind}.` };
    }
    return { artifact, fromCreation: reference.kind === "creation" };
  };
  const resolveEdits = (
    edits: AgentSourceOperation[],
    targetArtifactId: string,
  ): { edits: AgentSourceOperation[]; errors: string[] } => {
    const editErrors: string[] = [];
    const resolved = edits.map((edit, editIndex) => {
      if (edit.type !== "append_chart") return edit;
      const chart = resolveReference(edit.chart, ["chart"]);
      if (!chart.artifact) {
        editErrors.push(`Operation ${editIndex + 1} (append_chart): ${chart.error}`);
        return edit;
      }
      if (chart.fromCreation) {
        authorizedSamePlanDependencies.add(dependencyKey(chart.artifact.id, targetArtifactId));
      }
      return {
        ...edit,
        chart: { kind: "artifact" as const, artifactId: chart.artifact.id },
      };
    });
    return { edits: resolved, errors: editErrors };
  };

  operationPlan.actions.forEach((action) => {
    if (action.type === "create_artifact") {
      if (!action.handle) {
        errors.push(`${action.title}: every creation needs one action-local handle.`);
        return;
      }
      if (creationHandles.has(action.handle)) {
        errors.push(`${action.title}: creation handles must be unique: ${action.handle}`);
        return;
      }
      const resolvedSource =
        action.kind === "query"
          ? resolveReference(action.source, ["data"])
          : action.kind === "chart"
            ? resolveReference(action.source, ["data", "query"])
            : undefined;
      if (resolvedSource && !resolvedSource.artifact) {
        errors.push(`${action.title}: ${resolvedSource.error}`);
        return;
      }
      const input: ArtifactCreationInput =
        action.kind === "query"
          ? {
              kind: action.kind,
              title: action.title,
              sourceArtifactId: resolvedSource?.artifact?.id ?? "",
            }
          : action.kind === "chart"
            ? {
                kind: action.kind,
                title: action.title,
                sourceArtifactId: resolvedSource?.artifact?.id ?? "",
                category: action.category,
                value: action.value,
                mark: action.mark,
                format: action.format,
              }
            : { kind: action.kind, title: action.title };
      const prepared = prepareArtifactCreation(workingArtifacts, input);
      if (!prepared.artifact || prepared.errors.length) {
        prepared.errors.forEach((error) => errors.push(`${action.title}: ${error}`));
        return;
      }
      const resolvedEdits = resolveEdits(action.edits, prepared.artifact.id);
      if (resolvedEdits.errors.length) {
        resolvedEdits.errors.forEach((error) => errors.push(`${prepared.artifact?.name ?? action.title}: ${error}`));
        return;
      }
      const compiled = action.edits.length
        ? applyAgentArtifactOperations(prepared.artifact, resolvedEdits.edits)
        : { nextSource: prepared.artifact.source, errors: [] };
      if (compiled.errors.length) {
        compiled.errors.forEach((error) => errors.push(`${prepared.artifact?.name ?? action.title}: ${error}`));
        return;
      }
      const artifact = { ...prepared.artifact, source: compiled.nextSource };
      compiledCreations.push({
        artifact,
        summary: action.summary,
        detail: action.detail,
        operationCount: action.edits.length,
      });
      if (resolvedSource?.artifact && resolvedSource.fromCreation) {
        authorizedSamePlanDependencies.add(dependencyKey(resolvedSource.artifact.id, artifact.id));
      }
      creationHandles.set(action.handle, artifact);
      workingArtifacts = [...workingArtifacts, artifact];
      return;
    }

    if (seen.has(action.artifactId)) {
      errors.push(`${action.artifactId}: the operation plan contains duplicate file patches.`);
      return;
    }
    seen.add(action.artifactId);
    const artifact = artifacts.find((candidate) => candidate.id === action.artifactId);
    if (!artifact) {
      errors.push(`${action.artifactId}: the operation plan references an unknown artifact.`);
      return;
    }
    const resolvedEdits = resolveEdits(action.edits, action.artifactId);
    if (resolvedEdits.errors.length) {
      resolvedEdits.errors.forEach((error) => errors.push(`${action.artifactId}: ${error}`));
      return;
    }
    const compiled = compileAgentOperationPatch(artifact, { ...action, edits: resolvedEdits.edits });
    if (!compiled.plan) {
      compiled.errors.forEach((error) => errors.push(`${action.artifactId}: ${error}`));
      return;
    }
    compiledPatches.push({ artifactId: action.artifactId, ...compiled.plan });
    workingArtifacts = workingArtifacts.map((candidate) =>
      candidate.id === action.artifactId
        ? { ...candidate, source: compiled.plan?.nextSource ?? candidate.source }
        : candidate,
    );
  });

  if (errors.length) return { errors: [...new Set(errors)] };
  const createdArtifactIds = new Set(compiledCreations.map((creation) => creation.artifact.id));
  const touchedArtifactIds = new Set([
    ...compiledPatches.map((patch) => patch.artifactId),
    ...compiledCreations.map((creation) => creation.artifact.id),
  ]);
  const samePlanDependency = buildWorkspaceDependencyGraph(workingArtifacts).edges.find(
    (edge) =>
      createdArtifactIds.has(edge.fromArtifactId) &&
      touchedArtifactIds.has(edge.toArtifactId) &&
      edge.fromArtifactId !== edge.toArtifactId &&
      !authorizedSamePlanDependencies.has(dependencyKey(edge.fromArtifactId, edge.toArtifactId)),
  );
  if (samePlanDependency) {
    return {
      errors: [
        `${samePlanDependency.toArtifactId}: a source cannot reference the guessed identity of ` +
          `same-plan creation ${samePlanDependency.fromArtifactId}; use an explicit earlier creation handle.`,
      ],
    };
  }
  const plan = AgentCompiledWorkspacePatchSchema.safeParse({
    summary: operationPlan.summary,
    detail: operationPlan.detail,
    patches: compiledPatches,
    creations: compiledCreations,
  });
  return plan.success
    ? { plan: plan.data, errors: [] }
    : { errors: ["The compiled workspace patch exceeds Rune's bounded review contract."] };
}
