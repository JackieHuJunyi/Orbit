export type SourceEditorScrollInput = {
  source: string;
  start: number;
  end: number;
  lineHeight: number;
  viewportHeight: number;
  scrollHeight: number;
};

function lineIndexAt(source: string, offset: number) {
  const safeOffset = Math.max(0, Math.min(source.length, offset));
  return source.slice(0, safeOffset).split("\n").length - 1;
}

/**
 * Centers a canonical UTF-16 source selection in the unwrapped source editor.
 * The result is deterministic and clamped to the editor's real scroll range.
 */
export function sourceSelectionScrollTop({
  source,
  start,
  end,
  lineHeight,
  viewportHeight,
  scrollHeight,
}: SourceEditorScrollInput) {
  if (
    ![lineHeight, viewportHeight, scrollHeight].every(Number.isFinite) ||
    lineHeight <= 0 ||
    viewportHeight <= 0 ||
    scrollHeight <= viewportHeight
  )
    return 0;
  const firstLine = lineIndexAt(source, Math.min(start, end));
  const lastLine = lineIndexAt(source, Math.max(start, end));
  const selectionCenter = ((firstLine + lastLine + 1) / 2) * lineHeight;
  return Math.max(0, Math.min(scrollHeight - viewportHeight, selectionCenter - viewportHeight / 2));
}
export function sourceEditorPresentation(source: string) {
  const large = source.length > 250_000;
  return {
    large,
    lineNumbers: large
      ? ""
      : Array.from({ length: source.split("\n").length || 1 }, (_, index) => index + 1).join("\n"),
  } as const;
}
