import Papa from "papaparse";
import {
  AgentCompiledPatchSchema,
  AgentCompiledWorkspacePatchSchema,
  type AgentCompiledPatch,
  type AgentCompiledWorkspacePatch,
  type AgentOperationPatch,
  type AgentSourceOperation,
  type AgentWorkspaceOperationPlan,
} from "./agent-contract.ts";
import { isDeckMarkdownArtifact } from "./deck.ts";
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
  if (edit.find === edit.replace) return { nextSource: source, errors: ["The exact replacement does not change its anchor."] };
  const match = exactMatch(source, edit.find);
  if (match.count === 0) return { nextSource: source, errors: ["The exact anchor does not match the current source revision."] };
  if (match.count > 1) return { nextSource: source, errors: ["The exact anchor is ambiguous in the current source revision."] };
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
      if (closingFence
        && closingFence[1][0] === fence.marker
        && closingFence[1].length >= fence.length) fence = undefined;
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
  if (!resolved.section) return { nextSource: source, errors: [resolved.error ?? "The Markdown section could not be resolved."] };
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
  if (!resolved.section) return { nextSource: source, errors: [resolved.error ?? "The Markdown section could not be resolved."] };
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
  let result = format === "CSV"
    ? Papa.unparse(rows, { columns, newline: sourceNewline(source) })
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
  const duplicateCells = edit.cells.filter((cell, index) => edit.cells.findIndex((candidate) => candidate.column === cell.column) !== index);
  if (duplicateCells.length) return { nextSource: source, errors: [`Data operation repeats column: ${duplicateCells[0].column}`] };
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
  const matches = rows.flatMap((row, index) => cellsEqual(row[edit.keyColumn] ?? null, edit.keyValue) ? [index] : []);
  if (matches.length > 1) {
    return { nextSource: source, errors: [`Data key is ambiguous in ${edit.keyColumn}.`] };
  }
  if (!matches.length && parsed.format === "JSON" && !jsonArray) {
    return { nextSource: source, errors: ["A single-object JSON source cannot insert a second row."] };
  }

  const row = matches.length
    ? { ...rows[matches[0]] }
    : Object.fromEntries(parsed.columns.map((column) => [column, null])) as Record<string, DataCell>;
  if (matches.length && edit.cells.every((cell) => cellsEqual(row[cell.column] ?? null, cell.value))) {
    return { nextSource: source, errors: ["The data-row operation does not change the targeted row."] };
  }
  if (!matches.length) row[edit.keyColumn] = edit.keyValue;
  edit.cells.forEach((cell) => { row[cell.column] = cell.value; });
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

function splitDeck(source: string): { deck?: DeckParts; error?: string } {
  const normalized = source.replace(/\r\n?/g, "\n");
  const lines = normalized.split("\n");
  if (lines[0]?.trim() !== "---") return { error: "Deck Markdown must start with frontmatter." };
  const closing = lines.findIndex((line, index) => index > 0 && line.trim() === "---");
  if (closing < 0) return { error: "Deck frontmatter is missing its closing delimiter." };
  const body = lines.slice(closing + 1).join("\n").trim();
  const slides = body.split(/^\s*---\s*$/m).map((slide) => slide.trim()).filter(Boolean);
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
  const matches = deck.slides.flatMap((slide, index) => deckSlideTitle(slide) === target ? [index] : []);
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
  if (resolved.index == null) return { nextSource: source, errors: [resolved.error ?? "The Deck slide could not be resolved."] };
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
  if (resolved.index == null) return { nextSource: source, errors: [resolved.error ?? "The Deck slide could not be resolved."] };
  parsed.deck.slides.splice(resolved.index + 1, 0, edit.slide.trim());
  return { nextSource: serializeDeck(source, parsed.deck), errors: [] };
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
  if (edit.type === "replace_deck_slide") {
    return artifact.kind === "slides" && isDeckMarkdownArtifact(artifact)
      ? replaceDeckSlide(source, edit)
      : { nextSource: source, errors: ["replace_deck_slide only supports Deck Markdown presentations."] };
  }
  return artifact.kind === "slides" && isDeckMarkdownArtifact(artifact)
    ? insertDeckSlide(source, edit)
    : { nextSource: source, errors: ["insert_deck_slide_after only supports Deck Markdown presentations."] };
}

export function applyAgentSourceOperations(
  source: string,
  edits: ExactTextOperation[],
): SourceOperationCompilation {
  if (!edits.length) return { nextSource: source, errors: ["The plan does not contain any source operations."] };
  let nextSource = source;
  for (let index = 0; index < edits.length; index += 1) {
    const compiled = applyExactTextOperation(nextSource, edits[index]);
    if (compiled.errors.length) {
      return { nextSource: source, errors: compiled.errors.map((error) => `Operation ${index + 1}: ${error}`) };
    }
    nextSource = compiled.nextSource;
    if (nextSource.length > MAX_COMPILED_AGENT_SOURCE_CHARS) {
      return { nextSource: source, errors: [`Operation ${index + 1} would exceed Rune's 120,000-character Agent output limit.`] };
    }
  }
  if (nextSource === source) return { nextSource: source, errors: ["The ordered source operations cancel out without changing the file."] };
  return { nextSource, errors: [] };
}

export function applyAgentArtifactOperations(
  artifact: WorkspaceArtifact,
  edits: AgentSourceOperation[],
): SourceOperationCompilation {
  if (!edits.length) return { nextSource: artifact.source, errors: ["The plan does not contain any source operations."] };
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
      return { nextSource: artifact.source, errors: [`Operation ${index + 1} would exceed Rune's 120,000-character Agent output limit.`] };
    }
  }
  if (nextSource === artifact.source) {
    return { nextSource: artifact.source, errors: ["The ordered source operations cancel out without changing the file."] };
  }
  return { nextSource, errors: [] };
}

export function compileAgentOperationPatch(
  artifact: WorkspaceArtifact,
  patch: AgentOperationPatch,
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

export function compileAgentWorkspaceOperations(
  artifacts: WorkspaceArtifact[],
  operationPlan: AgentWorkspaceOperationPlan,
): PlanCompilation<AgentCompiledWorkspacePatch> {
  const errors: string[] = [];
  const seen = new Set<string>();
  const compiledPatches: AgentCompiledWorkspacePatch["patches"] = [];

  operationPlan.patches.forEach((patch) => {
    if (seen.has(patch.artifactId)) {
      errors.push(`${patch.artifactId}: the operation plan contains duplicate file patches.`);
      return;
    }
    seen.add(patch.artifactId);
    const artifact = artifacts.find((candidate) => candidate.id === patch.artifactId);
    if (!artifact) {
      errors.push(`${patch.artifactId}: the operation plan references an unknown artifact.`);
      return;
    }
    const compiled = compileAgentOperationPatch(artifact, patch);
    if (!compiled.plan) {
      compiled.errors.forEach((error) => errors.push(`${patch.artifactId}: ${error}`));
      return;
    }
    compiledPatches.push({ artifactId: patch.artifactId, ...compiled.plan });
  });

  if (errors.length) return { errors: [...new Set(errors)] };
  const plan = AgentCompiledWorkspacePatchSchema.safeParse({
    summary: operationPlan.summary,
    detail: operationPlan.detail,
    patches: compiledPatches,
  });
  return plan.success
    ? { plan: plan.data, errors: [] }
    : { errors: ["The compiled workspace patch exceeds Rune's bounded review contract."] };
}
