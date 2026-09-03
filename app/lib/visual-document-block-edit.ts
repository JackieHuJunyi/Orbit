import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";
import {
  deriveDocumentBlockPreviewSourceTargets,
  type DocumentBlockPreviewSourceTarget,
  type DocumentBlockType,
} from "./preview-targets.ts";
import { MAX_AGENT_SELECTION_CHARS, sourceOutsideSelectionIsUnchanged } from "./source-selection.ts";
import type { WorkspaceArtifact } from "./workspace.ts";

export const MAX_VISUAL_DOCUMENT_BLOCK_CHARS = MAX_AGENT_SELECTION_CHARS;

export type VisualDocumentBlockEditInput = {
  draft: string;
};

export type PreparedVisualDocumentBlockEdit = {
  nextSource: string;
  nextTarget: DocumentBlockPreviewSourceTarget | null;
  errors: string[];
};

export type VisualDocumentBlockDraftProjection = {
  nextSource: string;
  start: number;
  end: number;
  errors: string[];
};

type MarkdownBlockNode = {
  type: string;
  depth?: number;
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

const EDITABLE_DOCUMENT_BLOCK_TYPES = new Set<DocumentBlockType>([
  "heading",
  "paragraph",
  "list",
  "quote",
  "code",
  "table",
]);

function emptyResult(source: string, error: string): PreparedVisualDocumentBlockEdit {
  return { nextSource: source, nextTarget: null, errors: [error] };
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

function normalizeDraft(draft: string, source: string) {
  const newline = source.includes("\r\n") ? "\r\n" : "\n";
  const normalized = draft.replace(/\r\n?|\n/gu, "\n");
  const withoutLeadingBlankLines = normalized.replace(/^(?:[\t ]*\n)+/u, "");
  const withoutTrailingBlankLines = withoutLeadingBlankLines.replace(/(?:\n[\t ]*)+$/u, "");
  return newline === "\n" ? withoutTrailingBlankLines : withoutTrailingBlankLines.replace(/\n/gu, newline);
}

function orbitBindingTokens(source: string) {
  return source.match(/\{\{[^{}\r\n]+\}\}/gu) ?? [];
}

function bindingTokensAreByteStable(current: string, replacement: string) {
  const currentTokens = orbitBindingTokens(current);
  const replacementTokens = orbitBindingTokens(replacement);
  if (JSON.stringify(replacementTokens) !== JSON.stringify(currentTokens)) return false;
  const bindingPattern = /\{\{[^{}\r\n]+\}\}/gu;
  const currentText = current.replace(bindingPattern, "");
  const replacementText = replacement.replace(bindingPattern, "");
  return (
    !currentText.includes("{{") &&
    !currentText.includes("}}") &&
    !replacementText.includes("{{") &&
    !replacementText.includes("}}")
  );
}

function parseSingleBlock(source: string): MarkdownBlockNode | null {
  try {
    const root = unified().use(remarkParse).use(remarkGfm).parse(source) as {
      children?: MarkdownBlockNode[];
    };
    return root.children?.length === 1 ? root.children[0] : null;
  } catch {
    return null;
  }
}

export function visualDocumentBlockDraft(artifact: WorkspaceArtifact, target: DocumentBlockPreviewSourceTarget) {
  return artifact.source.slice(target.start, target.end);
}

export function canVisualEditDocumentBlock(artifact: WorkspaceArtifact, target: DocumentBlockPreviewSourceTarget) {
  if (artifact.kind !== "document" || target.kind !== "document-block") return false;
  const current = currentTargetForRevision(artifact, target);
  return Boolean(
    current &&
    EDITABLE_DOCUMENT_BLOCK_TYPES.has(current.blockType) &&
    current.end - current.start <= MAX_VISUAL_DOCUMENT_BLOCK_CHARS,
  );
}

export function projectVisualDocumentBlockDraft(
  artifact: WorkspaceArtifact,
  requestedTarget: DocumentBlockPreviewSourceTarget,
  input: VisualDocumentBlockEditInput,
): VisualDocumentBlockDraftProjection {
  const target = artifact.kind === "document" ? currentTargetForRevision(artifact, requestedTarget) : undefined;
  if (!target) {
    return {
      nextSource: artifact.source,
      start: requestedTarget.start,
      end: requestedTarget.end,
      errors: ["The block no longer matches the current source revision."],
    };
  }
  const replacement = normalizeDraft(input.draft, artifact.source);
  const nextSource = `${artifact.source.slice(0, target.start)}${replacement}${artifact.source.slice(target.end)}`;
  const prepared = prepareVisualDocumentBlockEdit(artifact, target, input);
  return {
    nextSource,
    start: target.start,
    end: target.start + replacement.length,
    errors: prepared.errors.filter((error) => !/unchanged\.?$/iu.test(error)),
  };
}

export function prepareVisualDocumentBlockEdit(
  artifact: WorkspaceArtifact,
  requestedTarget: DocumentBlockPreviewSourceTarget,
  input: VisualDocumentBlockEditInput,
): PreparedVisualDocumentBlockEdit {
  if (artifact.kind !== "document") {
    return emptyResult(artifact.source, "Visual block editing requires a Markdown Document.");
  }
  const target = currentTargetForRevision(artifact, requestedTarget);
  if (!target) return emptyResult(artifact.source, "The block no longer matches the current source revision.");
  if (!EDITABLE_DOCUMENT_BLOCK_TYPES.has(target.blockType)) {
    return emptyResult(
      artifact.source,
      "Divider blocks remain source-only because an empty visual edit would delete structure.",
    );
  }
  if (
    target.end - target.start > MAX_VISUAL_DOCUMENT_BLOCK_CHARS ||
    typeof input.draft !== "string" ||
    input.draft.length > MAX_VISUAL_DOCUMENT_BLOCK_CHARS
  ) {
    return emptyResult(
      artifact.source,
      `Visual Document blocks are limited to ${MAX_VISUAL_DOCUMENT_BLOCK_CHARS.toLocaleString("en-US")} characters.`,
    );
  }

  const currentFragment = artifact.source.slice(target.start, target.end);
  const replacement = normalizeDraft(input.draft, artifact.source);
  if (!replacement.trim()) return emptyResult(artifact.source, "A visual Document block cannot be empty.");
  if (replacement === currentFragment) return emptyResult(artifact.source, "The edited block is unchanged.");
  if (!bindingTokensAreByteStable(currentFragment, replacement)) {
    return emptyResult(
      artifact.source,
      "Keep live metric and Chart bindings unchanged in the visual editor. Edit dependency source directly.",
    );
  }

  const replacementNode = parseSingleBlock(replacement);
  const replacementType = replacementNode ? MARKDOWN_NODE_BLOCK_TYPES[replacementNode.type] : undefined;
  if (!replacementNode || replacementType !== target.blockType) {
    return emptyResult(
      artifact.source,
      `Keep this visual edit as one ${target.blockType} block. Change document structure in canonical source.`,
    );
  }
  if (target.blockType === "heading" && replacementNode.depth !== target.headingLevel) {
    return emptyResult(
      artifact.source,
      "Keep the block's heading level unchanged. Structural changes belong in canonical source.",
    );
  }

  const nextSource = `${artifact.source.slice(0, target.start)}${replacement}${artifact.source.slice(target.end)}`;
  if (!sourceOutsideSelectionIsUnchanged(artifact.source, nextSource, target)) {
    return emptyResult(artifact.source, "The visual edit crossed its exact Document block boundary.");
  }
  const nextArtifact = { ...artifact, source: nextSource };
  const nextTarget =
    deriveDocumentBlockPreviewSourceTargets(nextArtifact).find(
      (candidate) =>
        candidate.index === target.index &&
        candidate.start === target.start &&
        candidate.end === target.start + replacement.length &&
        candidate.blockType === target.blockType &&
        candidate.headingLevel === target.headingLevel,
    ) ?? null;
  if (!nextTarget) {
    return emptyResult(artifact.source, "Orbit could not prove the edited block's new source range.");
  }
  return { nextSource, nextTarget, errors: [] };
}
