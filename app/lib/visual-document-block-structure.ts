import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";
import {
  deriveDocumentBlockPreviewSourceTargets,
  derivePreviewSourceTargets,
  type DocumentBlockPreviewSourceTarget,
  type DocumentBlockType,
  type PreviewSourceTarget,
} from "./preview-targets.ts";
import { MAX_AGENT_SELECTION_CHARS, sourceOutsideSelectionIsUnchanged } from "./source-selection.ts";
import type { WorkspaceArtifact } from "./workspace.ts";

export const MAX_VISUAL_DOCUMENT_INSERT_CHARS = MAX_AGENT_SELECTION_CHARS;

export type VisualDocumentBlockStructureAction = "insert-before" | "insert-after" | "move-up" | "move-down" | "delete";

export type VisualDocumentBlockStructureInput = {
  action: VisualDocumentBlockStructureAction;
  draft?: string;
};

export type DocumentBlockStructureCapabilities = {
  available: boolean;
  canInsertBefore: boolean;
  canInsertAfter: boolean;
  canMoveUp: boolean;
  canMoveDown: boolean;
  canDelete: boolean;
};

export type PreparedVisualDocumentBlockStructure = {
  nextSource: string;
  nextTarget: PreviewSourceTarget | null;
  errors: string[];
  warnings: string[];
};

type MarkdownBlockNode = {
  type: string;
  depth?: number;
  position?: {
    start?: { offset?: number };
    end?: { offset?: number };
  };
};

type PositionedMarkdownNode = {
  index: number;
  start: number;
  end: number;
  blockType?: DocumentBlockType;
  headingLevel?: number;
};

const MARKDOWN_NODE_BLOCK_TYPES: Partial<Record<string, DocumentBlockType>> = {
  heading: "heading",
  paragraph: "paragraph",
  list: "list",
  blockquote: "quote",
  code: "code",
  table: "table",
  thematicBreak: "rule",
};

const EMPTY_CAPABILITIES: DocumentBlockStructureCapabilities = {
  available: false,
  canInsertBefore: false,
  canInsertAfter: false,
  canMoveUp: false,
  canMoveDown: false,
  canDelete: false,
};

function emptyResult(source: string, error: string, warnings: string[] = []): PreparedVisualDocumentBlockStructure {
  return { nextSource: source, nextTarget: null, errors: [error], warnings };
}

function parseMarkdownBlocks(source: string): PositionedMarkdownNode[] {
  let children: MarkdownBlockNode[];
  try {
    children =
      (
        unified().use(remarkParse).use(remarkGfm).parse(source) as {
          children?: MarkdownBlockNode[];
        }
      ).children ?? [];
  } catch {
    return [];
  }
  return children
    .map((node, index) => {
      const start = node.position?.start?.offset;
      const end = node.position?.end?.offset;
      if (start == null || end == null || start >= end) return null;
      const blockType = MARKDOWN_NODE_BLOCK_TYPES[node.type];
      return {
        index,
        start,
        end,
        ...(blockType ? { blockType } : {}),
        ...(blockType === "heading" && Number.isInteger(node.depth) ? { headingLevel: node.depth } : {}),
      };
    })
    .filter((node): node is PositionedMarkdownNode => Boolean(node));
}

function currentTargetForRevision(artifact: WorkspaceArtifact, requested: DocumentBlockPreviewSourceTarget) {
  return deriveDocumentBlockPreviewSourceTargets(artifact).find(
    (target) =>
      target.id === requested.id &&
      target.index === requested.index &&
      target.label === requested.label &&
      target.start === requested.start &&
      target.end === requested.end &&
      target.blockType === requested.blockType &&
      target.headingLevel === requested.headingLevel,
  );
}

function positionedTarget(source: string, target: DocumentBlockPreviewSourceTarget) {
  const node = parseMarkdownBlocks(source).find((candidate) => candidate.index === target.index);
  return node &&
    node.start === target.start &&
    node.end === target.end &&
    node.blockType === target.blockType &&
    node.headingLevel === target.headingLevel
    ? node
    : null;
}

function whitespaceGap(source: string, left: PositionedMarkdownNode, right: PositionedMarkdownNode) {
  if (left.end > right.start) return null;
  const gap = source.slice(left.end, right.start);
  return /^\s*$/u.test(gap) ? gap : null;
}

function rangeFitsStructureBudget(start: number, end: number) {
  return end - start <= MAX_AGENT_SELECTION_CHARS;
}

function normalizeDraft(draft: string, source: string) {
  const newline = source.includes("\r\n") ? "\r\n" : "\n";
  const normalized = draft.replace(/\r\n?|\n/gu, "\n");
  const withoutLeadingBlankLines = normalized.replace(/^(?:[\t ]*\n)+/u, "");
  const withoutTrailingBlankLines = withoutLeadingBlankLines.replace(/(?:\n[\t ]*)+$/u, "");
  return newline === "\n" ? withoutTrailingBlankLines : withoutTrailingBlankLines.replace(/\n/gu, newline);
}

function parseInsertedBlock(source: string): PositionedMarkdownNode | null {
  const nodes = parseMarkdownBlocks(source);
  return nodes.length === 1 && nodes[0].blockType ? nodes[0] : null;
}

function separatorFor(source: string) {
  return source.includes("\r\n") ? "\r\n\r\n" : "\n\n";
}

function nearestSurvivingTarget(artifact: WorkspaceArtifact, preferredOffset: number): PreviewSourceTarget | null {
  const blockTargets = deriveDocumentBlockPreviewSourceTargets(artifact);
  const after = blockTargets.find((target) => target.start >= preferredOffset);
  if (after) return after;
  const before = [...blockTargets].reverse().find((target) => target.end <= preferredOffset);
  if (before) return before;
  return derivePreviewSourceTargets(artifact).find((target) => target.kind === "document-section") ?? null;
}

function bindingCount(source: string) {
  return source.match(/\{\{[^{}\r\n]+\}\}/gu)?.length ?? 0;
}

function structureWarnings(
  source: string,
  target: DocumentBlockPreviewSourceTarget,
  action: VisualDocumentBlockStructureAction,
) {
  const warnings: string[] = [];
  if (action === "delete") {
    const bindings = bindingCount(source.slice(target.start, target.end));
    if (bindings) {
      warnings.push(`Deleting this block also removes ${bindings} live ${bindings === 1 ? "binding" : "bindings"}.`);
    }
  }
  if (target.blockType === "heading" && action === "delete") {
    warnings.push("Deleting only this heading changes the outline; its following body blocks remain in place.");
  } else if (target.blockType === "heading" && (action === "move-up" || action === "move-down")) {
    warnings.push("Only this heading moves; its following body blocks remain in their current order.");
  }
  return warnings;
}

export function documentBlockStructureCapabilities(
  artifact: WorkspaceArtifact,
  requestedTarget: DocumentBlockPreviewSourceTarget,
): DocumentBlockStructureCapabilities {
  if (artifact.kind !== "document" || requestedTarget.kind !== "document-block") {
    return EMPTY_CAPABILITIES;
  }
  const target = currentTargetForRevision(artifact, requestedTarget);
  if (!target) return EMPTY_CAPABILITIES;
  const nodes = parseMarkdownBlocks(artifact.source);
  const current = positionedTarget(artifact.source, target);
  if (!current) return EMPTY_CAPABILITIES;
  const previous = nodes.find((node) => node.index === current.index - 1);
  const next = nodes.find((node) => node.index === current.index + 1);
  const supportedNodeCount = nodes.filter((node) => node.blockType).length;
  return {
    available: true,
    canInsertBefore:
      !previous || Boolean(previous.blockType && whitespaceGap(artifact.source, previous, current) != null),
    canInsertAfter: !next || Boolean(next.blockType && whitespaceGap(artifact.source, current, next) != null),
    canMoveUp: Boolean(
      previous?.blockType &&
      whitespaceGap(artifact.source, previous, current) != null &&
      rangeFitsStructureBudget(previous.start, current.end),
    ),
    canMoveDown: Boolean(
      next?.blockType &&
      whitespaceGap(artifact.source, current, next) != null &&
      rangeFitsStructureBudget(current.start, next.end),
    ),
    canDelete:
      supportedNodeCount > 1 &&
      Boolean(
        (next &&
          whitespaceGap(artifact.source, current, next) != null &&
          rangeFitsStructureBudget(current.start, next.start)) ||
        (previous &&
          whitespaceGap(artifact.source, previous, current) != null &&
          rangeFitsStructureBudget(previous.end, current.end)),
      ),
  };
}

export function prepareVisualDocumentBlockStructure(
  artifact: WorkspaceArtifact,
  requestedTarget: DocumentBlockPreviewSourceTarget,
  input: VisualDocumentBlockStructureInput,
): PreparedVisualDocumentBlockStructure {
  if (artifact.kind !== "document") {
    return emptyResult(artifact.source, "Document structure operations require a Markdown Document.");
  }
  const target = currentTargetForRevision(artifact, requestedTarget);
  if (!target) return emptyResult(artifact.source, "The block no longer matches the current source revision.");
  const nodes = parseMarkdownBlocks(artifact.source);
  const current = positionedTarget(artifact.source, target);
  if (!current) return emptyResult(artifact.source, "Orbit could not prove this block's current Markdown structure.");
  const warnings = structureWarnings(artifact.source, target, input.action);

  if (input.action === "insert-before" || input.action === "insert-after") {
    if (typeof input.draft !== "string" || !input.draft.trim()) {
      return emptyResult(artifact.source, "Write one new Markdown block before reviewing this structure change.");
    }
    if (input.draft.length > MAX_VISUAL_DOCUMENT_INSERT_CHARS) {
      return emptyResult(
        artifact.source,
        `New Document blocks are limited to ${MAX_VISUAL_DOCUMENT_INSERT_CHARS.toLocaleString("en-US")} characters.`,
      );
    }
    const replacement = normalizeDraft(input.draft, artifact.source);
    if (!replacement.trim()) {
      return emptyResult(artifact.source, "A new Document block cannot be empty.");
    }
    if (replacement.includes("{{") || replacement.includes("}}")) {
      return emptyResult(
        artifact.source,
        "Add live metric or Chart dependencies from canonical source or Agent review, not the visual structure menu.",
      );
    }
    const inserted = parseInsertedBlock(replacement);
    if (!inserted) {
      return emptyResult(
        artifact.source,
        "Add exactly one supported CommonMark or GFM block: heading, paragraph, list, quote, code, table, or divider.",
      );
    }
    if (inserted.blockType === "heading") {
      warnings.push("Inserting a heading changes the outline; following blocks may become part of a new section.");
    }
    const separator = separatorFor(artifact.source);
    const previous = nodes.find((node) => node.index === current.index - 1);
    const next = nodes.find((node) => node.index === current.index + 1);
    let changeStart: number;
    let changeEnd: number;
    let change: string;
    let insertedStart: number;
    if (input.action === "insert-before" && previous) {
      const gap = whitespaceGap(artifact.source, previous, current);
      if (!previous.blockType || gap == null) {
        return emptyResult(
          artifact.source,
          "Orbit will not insert across unsupported or ambiguous Markdown structure.",
        );
      }
      changeStart = previous.end;
      changeEnd = current.start;
      change = `${separator}${replacement}${separator}`;
      insertedStart = changeStart + separator.length;
    } else if (input.action === "insert-after" && next) {
      const gap = whitespaceGap(artifact.source, current, next);
      if (!next.blockType || gap == null) {
        return emptyResult(
          artifact.source,
          "Orbit will not insert across unsupported or ambiguous Markdown structure.",
        );
      }
      changeStart = current.end;
      changeEnd = next.start;
      change = `${separator}${replacement}${separator}`;
      insertedStart = changeStart + separator.length;
    } else if (input.action === "insert-before") {
      changeStart = current.start;
      changeEnd = current.start;
      change = `${replacement}${separator}`;
      insertedStart = changeStart;
    } else {
      changeStart = current.end;
      changeEnd = current.end;
      change = `${separator}${replacement}`;
      insertedStart = changeStart + separator.length;
    }
    const nextSource = `${artifact.source.slice(0, changeStart)}${change}${artifact.source.slice(changeEnd)}`;
    const prefix = artifact.source.slice(0, changeStart);
    const suffix = artifact.source.slice(changeEnd);
    if (!nextSource.startsWith(prefix) || !nextSource.endsWith(suffix)) {
      return emptyResult(artifact.source, "The insertion crossed its exact Document block boundary.");
    }
    const insertedIndex = input.action === "insert-before" ? target.index : target.index + 1;
    const nextArtifact = { ...artifact, source: nextSource };
    const nextTarget =
      deriveDocumentBlockPreviewSourceTargets(nextArtifact).find(
        (candidate) =>
          candidate.index === insertedIndex &&
          candidate.start === insertedStart &&
          candidate.end === insertedStart + replacement.length &&
          candidate.blockType === inserted.blockType &&
          candidate.headingLevel === inserted.headingLevel,
      ) ?? null;
    if (!nextTarget) {
      return emptyResult(artifact.source, "Orbit could not prove the inserted block's new source range.");
    }
    return { nextSource, nextTarget, errors: [], warnings };
  }

  if (input.action === "move-up" || input.action === "move-down") {
    const movingUp = input.action === "move-up";
    const neighbor = nodes.find((node) => node.index === current.index + (movingUp ? -1 : 1));
    if (!neighbor) {
      return emptyResult(
        artifact.source,
        movingUp ? "This block is already first." : "This block is already last.",
        warnings,
      );
    }
    if (!neighbor.blockType) {
      return emptyResult(
        artifact.source,
        "Orbit will not move this block across unsupported Markdown structure.",
        warnings,
      );
    }
    if (target.blockType !== "heading" && neighbor.blockType === "heading") {
      warnings.push("This block moves across a heading and may change which section it belongs to.");
    }
    const left = movingUp ? neighbor : current;
    const right = movingUp ? current : neighbor;
    const gap = whitespaceGap(artifact.source, left, right);
    if (gap == null) {
      return emptyResult(
        artifact.source,
        "Orbit will not move this block across unsupported or ambiguous Markdown structure.",
        warnings,
      );
    }
    const currentFragment = artifact.source.slice(current.start, current.end);
    const neighborFragment = artifact.source.slice(neighbor.start, neighbor.end);
    const replacement = movingUp
      ? `${currentFragment}${gap}${neighborFragment}`
      : `${neighborFragment}${gap}${currentFragment}`;
    const range = { start: left.start, end: right.end };
    if (!rangeFitsStructureBudget(range.start, range.end)) {
      return emptyResult(
        artifact.source,
        `Document structure operations are limited to ${MAX_AGENT_SELECTION_CHARS.toLocaleString("en-US")} source characters.`,
        warnings,
      );
    }
    const nextSource = `${artifact.source.slice(0, range.start)}${replacement}${artifact.source.slice(range.end)}`;
    if (!sourceOutsideSelectionIsUnchanged(artifact.source, nextSource, range)) {
      return emptyResult(artifact.source, "The move crossed its two-block source boundary.", warnings);
    }
    const movedStart = movingUp ? neighbor.start : current.start + neighborFragment.length + gap.length;
    const movedIndex = neighbor.index;
    const nextArtifact = { ...artifact, source: nextSource };
    const nextTarget =
      deriveDocumentBlockPreviewSourceTargets(nextArtifact).find(
        (candidate) =>
          candidate.index === movedIndex &&
          candidate.start === movedStart &&
          candidate.end === movedStart + currentFragment.length &&
          candidate.blockType === target.blockType &&
          candidate.headingLevel === target.headingLevel,
      ) ?? null;
    if (!nextTarget) {
      return emptyResult(artifact.source, "Orbit could not prove the moved block's new source range.", warnings);
    }
    return { nextSource, nextTarget, errors: [], warnings };
  }

  if (input.action === "delete") {
    if (nodes.filter((node) => node.blockType).length <= 1) {
      return emptyResult(
        artifact.source,
        "Orbit will not delete the last Document block. Delete the artifact or replace its source instead.",
        warnings,
      );
    }
    const next = nodes.find((node) => node.index === current.index + 1);
    const previous = nodes.find((node) => node.index === current.index - 1);
    let range: { start: number; end: number } | null = null;
    if (next && whitespaceGap(artifact.source, current, next) != null) {
      range = { start: current.start, end: next.start };
    } else if (previous && whitespaceGap(artifact.source, previous, current) != null) {
      range = { start: previous.end, end: current.end };
    }
    if (!range) {
      return emptyResult(
        artifact.source,
        "Orbit will not delete this block across unsupported or ambiguous Markdown structure.",
        warnings,
      );
    }
    if (!rangeFitsStructureBudget(range.start, range.end)) {
      return emptyResult(
        artifact.source,
        `Document structure operations are limited to ${MAX_AGENT_SELECTION_CHARS.toLocaleString("en-US")} source characters.`,
        warnings,
      );
    }
    const nextSource = `${artifact.source.slice(0, range.start)}${artifact.source.slice(range.end)}`;
    if (!nextSource.trim()) {
      return emptyResult(artifact.source, "Orbit will not leave a Document with empty source.", warnings);
    }
    if (!sourceOutsideSelectionIsUnchanged(artifact.source, nextSource, range)) {
      return emptyResult(artifact.source, "The deletion crossed its exact block-and-separator boundary.", warnings);
    }
    const nextArtifact = { ...artifact, source: nextSource };
    const nextTarget = nearestSurvivingTarget(nextArtifact, range.start);
    if (!nextTarget) {
      return emptyResult(artifact.source, "Orbit could not prove a surviving source target after deletion.", warnings);
    }
    return { nextSource, nextTarget, errors: [], warnings };
  }

  return emptyResult(artifact.source, "Unsupported Document structure operation.");
}
