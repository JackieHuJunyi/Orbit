import { derivePreviewSourceTargets, type PreviewSourceTarget } from "./preview-targets.ts";
import { MAX_AGENT_SELECTION_CHARS, sourceOutsideSelectionIsUnchanged } from "./source-selection.ts";
import type { WorkspaceArtifact } from "./workspace.ts";

export const MAX_VISUAL_DOCUMENT_SECTION_CHARS = MAX_AGENT_SELECTION_CHARS;

export type VisualDocumentSectionEditInput = {
  draft: string;
};

export type PreparedVisualDocumentSectionEdit = {
  nextSource: string;
  nextTarget: PreviewSourceTarget | null;
  errors: string[];
};

export type VisualDocumentDraftProjection = {
  nextSource: string;
  start: number;
  end: number;
  errors: string[];
};

type VisibleHeading = {
  level: number;
  start: number;
};

function emptyResult(source: string, error: string): PreparedVisualDocumentSectionEdit {
  return { nextSource: source, nextTarget: null, errors: [error] };
}

function visibleHeadings(source: string): VisibleHeading[] {
  const headings: VisibleHeading[] = [];
  let offset = 0;
  let fence: { marker: "`" | "~"; length: number } | null = null;
  source.split(/(?<=\n)/u).forEach((rawLine) => {
    const line = rawLine.replace(/(?:\r?\n)$/u, "");
    if (fence) {
      const closing = line.match(/^[\t ]{0,3}(`{3,}|~{3,})[\t ]*$/u);
      if (closing && closing[1][0] === fence.marker && closing[1].length >= fence.length) fence = null;
      offset += rawLine.length;
      return;
    }
    const opening = line.match(/^[\t ]{0,3}(`{3,}|~{3,})/u);
    if (opening) {
      fence = { marker: opening[1][0] as "`" | "~", length: opening[1].length };
      offset += rawLine.length;
      return;
    }
    const heading = line.match(/^[\t ]{0,3}(#{1,6})[\t ]+\S/u);
    if (heading) headings.push({ level: heading[1].length, start: offset });
    offset += rawLine.length;
  });
  return headings;
}

function currentTargetForRevision(artifact: WorkspaceArtifact, requested: PreviewSourceTarget) {
  return derivePreviewSourceTargets(artifact).find(
    (target) =>
      target.kind === "document-section" &&
      requested.kind === "document-section" &&
      target.id === requested.id &&
      target.index === requested.index &&
      target.label === requested.label &&
      target.start === requested.start &&
      target.end === requested.end,
  );
}

function normalizeDraft(draft: string, source: string) {
  const newline = source.includes("\r\n") ? "\r\n" : "\n";
  const normalized = draft.replace(/\r\n?|\n/gu, "\n");
  const withoutLeadingBlankLines = normalized.replace(/^(?:[\t ]*\n)+/u, "");
  const withoutTrailingBlankLines = withoutLeadingBlankLines.replace(/(?:\n[\t ]*)+$/u, "");
  return newline === "\n" ? withoutTrailingBlankLines : withoutTrailingBlankLines.replace(/\n/gu, newline);
}

function runeBindingTokens(source: string) {
  return source.match(/\{\{[^{}\r\n]+\}\}/gu) ?? [];
}

export function visualDocumentSectionDraft(artifact: WorkspaceArtifact, target: PreviewSourceTarget) {
  return artifact.source.slice(target.start, target.end);
}

export function canVisualEditDocumentSection(artifact: WorkspaceArtifact, target: PreviewSourceTarget) {
  if (artifact.kind !== "document" || target.kind !== "document-section") return false;
  const current = currentTargetForRevision(artifact, target);
  return Boolean(current && current.end - current.start <= MAX_VISUAL_DOCUMENT_SECTION_CHARS);
}

export function projectVisualDocumentSectionDraft(
  artifact: WorkspaceArtifact,
  requestedTarget: PreviewSourceTarget,
  input: VisualDocumentSectionEditInput,
): VisualDocumentDraftProjection {
  const target = artifact.kind === "document" ? currentTargetForRevision(artifact, requestedTarget) : undefined;
  if (!target) {
    return {
      nextSource: artifact.source,
      start: requestedTarget.start,
      end: requestedTarget.end,
      errors: ["The section no longer matches the current source revision."],
    };
  }
  const replacement = normalizeDraft(input.draft, artifact.source);
  const nextSource = `${artifact.source.slice(0, target.start)}${replacement}${artifact.source.slice(target.end)}`;
  const prepared = prepareVisualDocumentSectionEdit(artifact, target, input);
  return {
    nextSource,
    start: target.start,
    end: target.start + replacement.length,
    errors: prepared.errors.filter((error) => !/unchanged\.?$/iu.test(error)),
  };
}

export function prepareVisualDocumentSectionEdit(
  artifact: WorkspaceArtifact,
  requestedTarget: PreviewSourceTarget,
  input: VisualDocumentSectionEditInput,
): PreparedVisualDocumentSectionEdit {
  if (artifact.kind !== "document") {
    return emptyResult(artifact.source, "Visual section editing requires a Markdown Document.");
  }
  const target = currentTargetForRevision(artifact, requestedTarget);
  if (!target) return emptyResult(artifact.source, "The section no longer matches the current source revision.");
  if (target.end - target.start > MAX_VISUAL_DOCUMENT_SECTION_CHARS) {
    return emptyResult(
      artifact.source,
      `Visual Document sections are limited to ${MAX_VISUAL_DOCUMENT_SECTION_CHARS.toLocaleString("en-US")} characters.`,
    );
  }
  if (input.draft.length > MAX_VISUAL_DOCUMENT_SECTION_CHARS) {
    return emptyResult(
      artifact.source,
      `Visual Document sections are limited to ${MAX_VISUAL_DOCUMENT_SECTION_CHARS.toLocaleString("en-US")} characters.`,
    );
  }

  const currentFragment = artifact.source.slice(target.start, target.end);
  const replacement = normalizeDraft(input.draft, artifact.source);
  if (!replacement.trim()) return emptyResult(artifact.source, "A visual Document section cannot be empty.");
  if (replacement === currentFragment) return emptyResult(artifact.source, "The edited section is unchanged.");

  const currentHeadings = visibleHeadings(currentFragment);
  const nextHeadings = visibleHeadings(replacement);
  if (nextHeadings.length !== currentHeadings.length) {
    return emptyResult(
      artifact.source,
      "Keep this visual edit inside one section. Add or remove document structure from canonical source.",
    );
  }
  if (
    currentHeadings.length === 1 &&
    (currentHeadings[0].start !== 0 ||
      nextHeadings[0]?.start !== 0 ||
      nextHeadings[0]?.level !== currentHeadings[0].level)
  ) {
    return emptyResult(
      artifact.source,
      "Keep the section's heading level unchanged. Structural changes belong in canonical source.",
    );
  }
  if (JSON.stringify(runeBindingTokens(replacement)) !== JSON.stringify(runeBindingTokens(currentFragment))) {
    return emptyResult(
      artifact.source,
      "Keep live metric and Chart bindings unchanged in the visual editor. Edit dependency source directly.",
    );
  }

  const nextSource = `${artifact.source.slice(0, target.start)}${replacement}${artifact.source.slice(target.end)}`;
  if (!sourceOutsideSelectionIsUnchanged(artifact.source, nextSource, target)) {
    return emptyResult(artifact.source, "The visual edit crossed its exact Document section boundary.");
  }
  const nextArtifact = { ...artifact, source: nextSource };
  const nextTarget =
    derivePreviewSourceTargets(nextArtifact).find(
      (candidate) =>
        candidate.kind === "document-section" &&
        candidate.index === target.index &&
        candidate.start === target.start &&
        candidate.end === target.start + replacement.length,
    ) ?? null;
  if (!nextTarget) {
    return emptyResult(artifact.source, "Orbit could not prove the edited section's new source range.");
  }
  return { nextSource, nextTarget, errors: [] };
}
