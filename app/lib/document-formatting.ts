export type DocumentFormattingCommand =
  "bold" | "italic" | "strikethrough" | "code" | "link" | "bullet-list" | "numbered-list" | "quote";

export type DocumentFormattingResult = {
  draft: string;
  selectionStart: number;
  selectionEnd: number;
  error: string | null;
};

type Selection = {
  start: number;
  end: number;
};

function clampSelection(draft: string, selectionStart: number, selectionEnd: number): Selection {
  const safeStart = Number.isFinite(selectionStart) ? Math.trunc(selectionStart) : 0;
  const safeEnd = Number.isFinite(selectionEnd) ? Math.trunc(selectionEnd) : safeStart;
  const start = Math.min(draft.length, Math.max(0, Math.min(safeStart, safeEnd)));
  const end = Math.min(draft.length, Math.max(0, Math.max(safeStart, safeEnd)));
  return { start, end };
}

function result(
  draft: string,
  selectionStart: number,
  selectionEnd: number,
  error: string | null = null,
): DocumentFormattingResult {
  return { draft, selectionStart, selectionEnd, error };
}

function toggleDelimited(draft: string, selection: Selection, marker: string): DocumentFormattingResult {
  const { start, end } = selection;
  const selected = draft.slice(start, end);

  if (selected.length >= marker.length * 2 && selected.startsWith(marker) && selected.endsWith(marker)) {
    const content = selected.slice(marker.length, -marker.length);
    const nextDraft = `${draft.slice(0, start)}${content}${draft.slice(end)}`;
    return result(nextDraft, start, start + content.length);
  }

  if (
    start >= marker.length &&
    draft.slice(start - marker.length, start) === marker &&
    draft.slice(end, end + marker.length) === marker
  ) {
    const nextStart = start - marker.length;
    const nextDraft = `${draft.slice(0, nextStart)}${selected}${draft.slice(end + marker.length)}`;
    return result(nextDraft, nextStart, nextStart + selected.length);
  }

  const nextDraft = `${draft.slice(0, start)}${marker}${selected}${marker}${draft.slice(end)}`;
  const nextStart = start + marker.length;
  return result(nextDraft, nextStart, nextStart + selected.length);
}

function longestBacktickRun(value: string) {
  return Array.from(value.matchAll(/`+/gu)).reduce((longest, match) => Math.max(longest, match[0].length), 0);
}

function toggleCode(draft: string, selection: Selection): DocumentFormattingResult {
  const { start, end } = selection;
  const selected = draft.slice(start, end);
  const selectedOpening = selected.match(/^(`+)/u)?.[1] ?? "";
  const selectedClosing = selected.match(/(`+)$/u)?.[1] ?? "";

  if (
    selectedOpening &&
    selectedOpening === selectedClosing &&
    selected.length >= selectedOpening.length * 2 &&
    longestBacktickRun(selected.slice(selectedOpening.length, -selectedClosing.length)) < selectedOpening.length
  ) {
    const content = selected.slice(selectedOpening.length, -selectedClosing.length);
    const nextDraft = `${draft.slice(0, start)}${content}${draft.slice(end)}`;
    return result(nextDraft, start, start + content.length);
  }

  const preceding = draft.slice(0, start).match(/(`+)$/u)?.[1] ?? "";
  const following = draft.slice(end).match(/^(`+)/u)?.[1] ?? "";
  if (preceding && preceding === following && longestBacktickRun(selected) < preceding.length) {
    const nextStart = start - preceding.length;
    const nextDraft = `${draft.slice(0, nextStart)}${selected}${draft.slice(end + following.length)}`;
    return result(nextDraft, nextStart, nextStart + selected.length);
  }

  const marker = "`".repeat(longestBacktickRun(selected) + 1);
  const nextDraft = `${draft.slice(0, start)}${marker}${selected}${marker}${draft.slice(end)}`;
  const nextStart = start + marker.length;
  return result(nextDraft, nextStart, nextStart + selected.length);
}

function toggleLink(draft: string, selection: Selection): DocumentFormattingResult {
  const { start, end } = selection;
  const selected = draft.slice(start, end);
  if (selected.includes("\n") || selected.includes("\r")) {
    return result(draft, start, end, "Select text on one line to add a link.");
  }

  const completeLink = selected.match(/^\[([^\]\r\n]*)\]\(([^)\r\n]*)\)$/u);
  if (completeLink) {
    const label = completeLink[1];
    const nextDraft = `${draft.slice(0, start)}${label}${draft.slice(end)}`;
    return result(nextDraft, start, start + label.length);
  }

  const linkTail = draft.slice(end).match(/^\]\(([^)\r\n]*)\)/u)?.[0] ?? "";
  if (start > 0 && draft[start - 1] === "[" && linkTail) {
    const nextStart = start - 1;
    const nextDraft = `${draft.slice(0, nextStart)}${selected}${draft.slice(end + linkTail.length)}`;
    return result(nextDraft, nextStart, nextStart + selected.length);
  }

  const label = selected || "Link";
  const url = "https://";
  const replacement = `[${label}](${url})`;
  const nextDraft = `${draft.slice(0, start)}${replacement}${draft.slice(end)}`;
  const urlStart = start + label.length + 3;
  return result(nextDraft, urlStart, urlStart + url.length);
}

type ListPrefix = {
  end: number;
  indent: string;
  kind: "bullet-list" | "numbered-list";
};

function listPrefix(line: string): ListPrefix | null {
  const match = line.match(/^([\t ]{0,3})(?:(-)|(\+)|(\*)|(\d+[.)]))[\t ]+/u);
  if (!match) return null;
  return {
    end: match[0].length,
    indent: match[1],
    kind: match[5] ? "numbered-list" : "bullet-list",
  };
}

function quotePrefix(line: string) {
  const match = line.match(/^([\t ]{0,3})>[\t ]?/u);
  return match ? { end: match[0].length, indent: match[1] } : null;
}

function leadingMarkdownIndent(line: string) {
  return line.match(/^[\t ]{0,3}/u)?.[0] ?? "";
}

function transformListLines(lines: string[], command: "bullet-list" | "numbered-list", includeEmpty: boolean) {
  const actionableIndexes = lines.flatMap((line, index) => (line.trim() || includeEmpty ? [index] : []));
  const actionable = new Set(actionableIndexes);
  const remove =
    actionableIndexes.length > 0 && actionableIndexes.every((index) => listPrefix(lines[index])?.kind === command);
  let ordinal = 1;

  return lines.map((line, index) => {
    if (!actionable.has(index)) return line;
    const existing = listPrefix(line);
    if (remove && existing) {
      return `${existing.indent}${line.slice(existing.end)}`;
    }
    const indent = existing?.indent ?? leadingMarkdownIndent(line);
    const content = existing ? line.slice(existing.end) : line.slice(indent.length);
    const marker = command === "bullet-list" ? "- " : `${ordinal}. `;
    ordinal += 1;
    return `${indent}${marker}${content}`;
  });
}

function transformQuoteLines(lines: string[], includeEmpty: boolean) {
  const actionableIndexes = lines.flatMap((line, index) => (line.trim() || includeEmpty ? [index] : []));
  const actionable = new Set(actionableIndexes);
  const remove = actionableIndexes.length > 0 && actionableIndexes.every((index) => Boolean(quotePrefix(lines[index])));

  return lines.map((line, index) => {
    if (!actionable.has(index)) return line;
    const existing = quotePrefix(line);
    if (remove && existing) return `${existing.indent}${line.slice(existing.end)}`;
    if (existing) return line;
    const indent = leadingMarkdownIndent(line);
    return `${indent}> ${line.slice(indent.length)}`;
  });
}

function mapLineOffset(source: string, transformed: string, offset: number) {
  if (source === transformed) return Math.min(offset, transformed.length);
  let commonPrefix = 0;
  while (
    commonPrefix < source.length &&
    commonPrefix < transformed.length &&
    source[commonPrefix] === transformed[commonPrefix]
  )
    commonPrefix += 1;

  let commonSuffix = 0;
  while (
    commonSuffix < source.length - commonPrefix &&
    commonSuffix < transformed.length - commonPrefix &&
    source[source.length - commonSuffix - 1] === transformed[transformed.length - commonSuffix - 1]
  ) {
    commonSuffix += 1;
  }

  const sourceChangedEnd = source.length - commonSuffix;
  const transformedChangedEnd = transformed.length - commonSuffix;
  if (offset < commonPrefix) return offset;
  if (offset >= sourceChangedEnd) return transformedChangedEnd + (offset - sourceChangedEnd);
  return transformedChangedEnd;
}

function mapBlockOffset(sourceLines: string[], transformedLines: string[], offset: number) {
  let sourceCursor = 0;
  let transformedCursor = 0;
  for (let index = 0; index < sourceLines.length; index += 1) {
    const sourceLine = sourceLines[index];
    const transformedLine = transformedLines[index];
    const sourceLineEnd = sourceCursor + sourceLine.length;
    if (offset <= sourceLineEnd || index === sourceLines.length - 1) {
      return (
        transformedCursor +
        mapLineOffset(sourceLine, transformedLine, Math.max(0, Math.min(sourceLine.length, offset - sourceCursor)))
      );
    }
    sourceCursor = sourceLineEnd + 1;
    transformedCursor += transformedLine.length + 1;
  }
  return transformedLines.join("\n").length;
}

function toggleBlock(
  draft: string,
  selection: Selection,
  command: "bullet-list" | "numbered-list" | "quote",
): DocumentFormattingResult {
  const { start, end } = selection;
  const blockStart = draft.lastIndexOf("\n", Math.max(0, start - 1)) + 1;
  const effectiveEnd = end > start && draft[end - 1] === "\n" ? end - 1 : end;
  const followingBreak = draft.indexOf("\n", effectiveEnd);
  const blockEnd = followingBreak === -1 ? draft.length : followingBreak;
  const sourceBlock = draft.slice(blockStart, blockEnd);
  const sourceLines = sourceBlock.split("\n");
  const includeEmpty = start === end && sourceLines.length === 1;
  const transformedLines =
    command === "quote"
      ? transformQuoteLines(sourceLines, includeEmpty)
      : transformListLines(sourceLines, command, includeEmpty);
  const transformedBlock = transformedLines.join("\n");
  const nextDraft = `${draft.slice(0, blockStart)}${transformedBlock}${draft.slice(blockEnd)}`;
  const lengthDelta = transformedBlock.length - sourceBlock.length;
  const mapPosition = (position: number) => {
    if (position < blockStart) return position;
    if (position <= blockEnd) {
      return blockStart + mapBlockOffset(sourceLines, transformedLines, position - blockStart);
    }
    return position + lengthDelta;
  };
  return result(nextDraft, mapPosition(start), mapPosition(end));
}

export function applyDocumentFormatting(
  draft: string,
  command: DocumentFormattingCommand,
  selectionStart: number,
  selectionEnd: number,
): DocumentFormattingResult {
  const selection = clampSelection(draft, selectionStart, selectionEnd);
  if (command === "bold") return toggleDelimited(draft, selection, "**");
  if (command === "italic") return toggleDelimited(draft, selection, "_");
  if (command === "strikethrough") return toggleDelimited(draft, selection, "~~");
  if (command === "code") return toggleCode(draft, selection);
  if (command === "link") return toggleLink(draft, selection);
  return toggleBlock(draft, selection, command);
}
