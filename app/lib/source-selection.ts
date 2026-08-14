export const MAX_AGENT_SELECTION_CHARS = 16_000;

export type SourceSelection = {
  start: number;
  end: number;
};

export function sourceSelectionError(source: string, selection: SourceSelection) {
  if (
    !Number.isInteger(selection.start) ||
    !Number.isInteger(selection.end) ||
    selection.start < 0 ||
    selection.start >= selection.end ||
    selection.end > source.length
  ) {
    return "The selected source range does not match the current artifact revision.";
  }
  if (selection.end - selection.start > MAX_AGENT_SELECTION_CHARS) {
    return `Source selections are limited to ${MAX_AGENT_SELECTION_CHARS} characters.`;
  }
  const splitsSurrogatePair = (offset: number) =>
    offset > 0 &&
    offset < source.length &&
    source.charCodeAt(offset - 1) >= 0xd800 &&
    source.charCodeAt(offset - 1) <= 0xdbff &&
    source.charCodeAt(offset) >= 0xdc00 &&
    source.charCodeAt(offset) <= 0xdfff;
  if (splitsSurrogatePair(selection.start) || splitsSurrogatePair(selection.end)) {
    return "The selected source range splits a Unicode character.";
  }
  return "";
}

export function sourceOutsideSelectionIsUnchanged(source: string, nextSource: string, selection: SourceSelection) {
  if (sourceSelectionError(source, selection)) return false;
  const prefix = source.slice(0, selection.start);
  const suffix = source.slice(selection.end);
  return (
    nextSource.length >= prefix.length + suffix.length && nextSource.startsWith(prefix) && nextSource.endsWith(suffix)
  );
}

export function replaceSourceSelection(source: string, selection: SourceSelection, replacement: string) {
  const error = sourceSelectionError(source, selection);
  if (error) throw new Error(error);
  return `${source.slice(0, selection.start)}${replacement}${source.slice(selection.end)}`;
}
