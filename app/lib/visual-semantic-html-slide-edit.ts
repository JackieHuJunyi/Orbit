import { compileLegacyHtmlSlides } from "./legacy-html-slides.ts";
import { derivePreviewSourceTargets, type PreviewSourceTarget } from "./preview-targets.ts";
import { MAX_AGENT_SELECTION_CHARS, sourceOutsideSelectionIsUnchanged } from "./source-selection.ts";
import type { WorkspaceArtifact } from "./workspace.ts";

export const MAX_VISUAL_SEMANTIC_HTML_SLIDE_CHARS = MAX_AGENT_SELECTION_CHARS;

export type VisualSemanticHtmlSlideEditInput = Readonly<{
  draft: string;
}>;

export type PreparedVisualSemanticHtmlSlideEdit = Readonly<{
  errors: string[];
  nextSource: string;
  nextTarget: PreviewSourceTarget | null;
}>;

export type VisualSemanticHtmlSlideDraftProjection = Readonly<{
  end: number;
  errors: string[];
  nextSource: string;
  start: number;
}>;

export type VisualSemanticHtmlSlidePreview = Readonly<{
  errors: string[];
  html: string;
}>;

function emptyResult(source: string, error: string): PreparedVisualSemanticHtmlSlideEdit {
  return { errors: [error], nextSource: source, nextTarget: null };
}

function isSemanticHtmlPresentation(artifact: WorkspaceArtifact) {
  return artifact.kind === "slides" && artifact.language === "Semantic HTML" && /\.html?$/iu.test(artifact.name);
}

function currentTargetForRevision(artifact: WorkspaceArtifact, requested: PreviewSourceTarget) {
  if (!isSemanticHtmlPresentation(artifact) || requested.kind !== "deck-slide") return null;
  return (
    derivePreviewSourceTargets(artifact).find(
      (target) =>
        target.kind === "deck-slide" &&
        target.id === requested.id &&
        target.index === requested.index &&
        target.label === requested.label &&
        target.start === requested.start &&
        target.end === requested.end,
    ) ?? null
  );
}

function newlineFor(source: string) {
  return source.includes("\r\n") ? "\r\n" : "\n";
}

function normalizeSectionDraft(draft: string, newline: string) {
  const normalized = draft.replace(/\r\n?|\n/gu, "\n").trim();
  return newline === "\n" ? normalized : normalized.replace(/\n/gu, newline);
}

function runeBindingTokens(source: string) {
  return source.match(/\{\{[^{}\r\n]+\}\}/gu) ?? [];
}

function exactSectionError(replacement: string) {
  if (!replacement) return "A visual semantic HTML slide cannot be empty.";
  const probe = `<main>${replacement}</main>`;
  const compilation = compileLegacyHtmlSlides(probe);
  if (compilation.errors.length) return compilation.errors[0];
  if (compilation.slides.length !== 1 || compilation.slides[0]?.source !== replacement) {
    return "Keep this visual edit inside exactly one outer <section> slide.";
  }
  return null;
}

function candidateForInput(
  artifact: WorkspaceArtifact,
  requestedTarget: PreviewSourceTarget,
  input: VisualSemanticHtmlSlideEditInput,
) {
  const target = currentTargetForRevision(artifact, requestedTarget);
  if (!target) {
    return {
      target: null,
      replacement: "",
      nextSource: artifact.source,
      errors: ["The semantic HTML slide no longer matches the current source revision."],
    };
  }
  if (input.draft.length > MAX_VISUAL_SEMANTIC_HTML_SLIDE_CHARS) {
    return {
      target,
      replacement: artifact.source.slice(target.start, target.end),
      nextSource: artifact.source,
      errors: [
        `Visual semantic HTML slides are limited to ${MAX_VISUAL_SEMANTIC_HTML_SLIDE_CHARS.toLocaleString("en-US")} characters.`,
      ],
    };
  }
  const replacement = normalizeSectionDraft(input.draft, newlineFor(artifact.source));
  const sectionError = exactSectionError(replacement);
  const nextSource = `${artifact.source.slice(0, target.start)}${replacement}${artifact.source.slice(target.end)}`;
  return { target, replacement, nextSource, errors: sectionError ? [sectionError] : [] };
}

export function visualSemanticHtmlSlideDraft(
  artifact: WorkspaceArtifact,
  target: PreviewSourceTarget,
): VisualSemanticHtmlSlideEditInput | null {
  const current = currentTargetForRevision(artifact, target);
  return current ? { draft: artifact.source.slice(current.start, current.end) } : null;
}

export function canVisualEditSemanticHtmlSlide(artifact: WorkspaceArtifact, target: PreviewSourceTarget) {
  const current = currentTargetForRevision(artifact, target);
  return Boolean(current && current.end - current.start <= MAX_VISUAL_SEMANTIC_HTML_SLIDE_CHARS);
}

export function projectVisualSemanticHtmlSlideDraft(
  artifact: WorkspaceArtifact,
  requestedTarget: PreviewSourceTarget,
  input: VisualSemanticHtmlSlideEditInput,
): VisualSemanticHtmlSlideDraftProjection {
  const candidate = candidateForInput(artifact, requestedTarget, input);
  if (!candidate.target) {
    return {
      nextSource: artifact.source,
      start: requestedTarget.start,
      end: requestedTarget.end,
      errors: candidate.errors,
    };
  }
  const prepared = prepareVisualSemanticHtmlSlideEdit(artifact, candidate.target, input);
  return {
    nextSource: candidate.nextSource,
    start: candidate.target.start,
    end: candidate.target.start + candidate.replacement.length,
    errors: prepared.errors.filter((error) => !/unchanged\.?$/iu.test(error)),
  };
}

export function visualSemanticHtmlSlidePreview(
  artifact: WorkspaceArtifact,
  requestedTarget: PreviewSourceTarget,
  input: VisualSemanticHtmlSlideEditInput,
  resolveLocalAssetUrl?: (reference: string) => string | null,
): VisualSemanticHtmlSlidePreview {
  const projection = projectVisualSemanticHtmlSlideDraft(artifact, requestedTarget, input);
  if (projection.errors.length) return { html: "", errors: projection.errors };
  const compilation = compileLegacyHtmlSlides(projection.nextSource, { resolveLocalAssetUrl });
  const slide = compilation.slides[requestedTarget.index];
  return slide
    ? { html: slide.html, errors: [] }
    : {
        html: "",
        errors: compilation.errors.length
          ? [...compilation.errors]
          : ["Rune could not compile this draft as one semantic HTML slide."],
      };
}

export function prepareVisualSemanticHtmlSlideEdit(
  artifact: WorkspaceArtifact,
  requestedTarget: PreviewSourceTarget,
  input: VisualSemanticHtmlSlideEditInput,
): PreparedVisualSemanticHtmlSlideEdit {
  if (!isSemanticHtmlPresentation(artifact)) {
    return emptyResult(artifact.source, "Visual HTML slide editing requires a Semantic HTML presentation artifact.");
  }
  const candidate = candidateForInput(artifact, requestedTarget, input);
  if (!candidate.target) return emptyResult(artifact.source, candidate.errors[0]);
  if (candidate.errors.length) return emptyResult(artifact.source, candidate.errors[0]);

  const currentFragment = artifact.source.slice(candidate.target.start, candidate.target.end);
  if (candidate.replacement === currentFragment) {
    return emptyResult(artifact.source, "The edited semantic HTML slide is unchanged.");
  }
  if (JSON.stringify(runeBindingTokens(candidate.replacement)) !== JSON.stringify(runeBindingTokens(currentFragment))) {
    return emptyResult(
      artifact.source,
      "Keep live metric and Chart bindings unchanged in the visual HTML editor. Edit dependency source directly.",
    );
  }
  if (!sourceOutsideSelectionIsUnchanged(artifact.source, candidate.nextSource, candidate.target)) {
    return emptyResult(artifact.source, "The visual edit crossed its exact semantic HTML slide boundary.");
  }

  const currentCompilation = compileLegacyHtmlSlides(artifact.source);
  const nextCompilation = compileLegacyHtmlSlides(candidate.nextSource);
  if (nextCompilation.errors.length) {
    return emptyResult(
      artifact.source,
      nextCompilation.errors[0] ?? "The edited semantic HTML presentation is invalid.",
    );
  }
  if (nextCompilation.slides.length !== currentCompilation.slides.length) {
    return emptyResult(
      artifact.source,
      "The visual edit changed the number of semantic HTML slides. Structural changes belong in canonical source.",
    );
  }
  if (
    nextCompilation.slides.some(
      (slide, index) => index !== candidate.target?.index && slide.source !== currentCompilation.slides[index]?.source,
    )
  ) {
    return emptyResult(artifact.source, "The visual edit changed another semantic HTML slide.");
  }

  const nextArtifact = { ...artifact, source: candidate.nextSource };
  const nextTarget =
    derivePreviewSourceTargets(nextArtifact).find(
      (target) =>
        target.kind === "deck-slide" &&
        target.index === candidate.target?.index &&
        target.start === candidate.target?.start &&
        target.end === candidate.target.start + candidate.replacement.length,
    ) ?? null;
  if (!nextTarget) {
    return emptyResult(artifact.source, "Rune could not prove the edited semantic HTML slide's new source range.");
  }
  return { errors: [], nextSource: candidate.nextSource, nextTarget };
}
