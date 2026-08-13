import {
  derivePreviewSourceTargets,
  type PreviewSourceTarget,
} from "./preview-targets.ts";
import {
  MAX_AGENT_SELECTION_CHARS,
  sourceOutsideSelectionIsUnchanged,
} from "./source-selection.ts";
import {
  parseDeckSource,
  type DeckLayout,
} from "./deck.ts";
import type { WorkspaceArtifact } from "./workspace.ts";

export const MAX_VISUAL_DECK_SLIDE_CHARS = MAX_AGENT_SELECTION_CHARS;

export const VISUAL_DECK_LAYOUTS: DeckLayout[] = [
  "cover",
  "content",
  "metrics",
  "split",
  "conclusion",
];

export type VisualDeckSlideEditInput = {
  layout: DeckLayout;
  eyebrow: string;
  draft: string;
};

export type PreparedVisualDeckSlideEdit = {
  nextSource: string;
  nextTarget: PreviewSourceTarget | null;
  errors: string[];
};

export type VisualDeckSlideDraftProjection = {
  nextSource: string;
  start: number;
  end: number;
  errors: string[];
};

export type VisualDeckSlidePreview = {
  source: string;
  errors: string[];
};

function emptyResult(source: string, error: string): PreparedVisualDeckSlideEdit {
  return { nextSource: source, nextTarget: null, errors: [error] };
}

function currentTargetForRevision(
  artifact: WorkspaceArtifact,
  requested: PreviewSourceTarget,
) {
  return derivePreviewSourceTargets(artifact).find((target) => (
    target.kind === "deck-slide"
    && requested.kind === "deck-slide"
    && target.id === requested.id
    && target.index === requested.index
    && target.label === requested.label
    && target.start === requested.start
    && target.end === requested.end
  ));
}

function newlineFor(source: string) {
  return source.includes("\r\n") ? "\r\n" : "\n";
}

function normalizeBody(draft: string, newline: string) {
  const normalized = draft.replace(/\r\n?|\n/gu, "\n");
  const withoutLeadingBlankLines = normalized.replace(/^(?:[\t ]*\n)+/u, "");
  const withoutTrailingBlankLines = withoutLeadingBlankLines.replace(/(?:\n[\t ]*)+$/u, "");
  return newline === "\n" ? withoutTrailingBlankLines : withoutTrailingBlankLines.replace(/\n/gu, newline);
}

function normalizedSemanticBody(draft: string) {
  return normalizeBody(draft, "\n");
}

function runeBindingTokens(source: string) {
  return source.match(/\{\{[^{}\r\n]+\}\}/gu) ?? [];
}

function validateInput(input: VisualDeckSlideEditInput) {
  if (!VISUAL_DECK_LAYOUTS.includes(input.layout)) return "Choose a supported Rune slide layout.";
  if (input.eyebrow.length > 100) return "A slide eyebrow is limited to 100 characters.";
  if (/[\r\n]/u.test(input.eyebrow) || input.eyebrow.includes("--") || /[<>]/u.test(input.eyebrow)) {
    return "Keep the slide eyebrow on one plain-text line without HTML comment syntax.";
  }
  if (input.draft.length > MAX_VISUAL_DECK_SLIDE_CHARS) {
    return `Visual Deck slides are limited to ${MAX_VISUAL_DECK_SLIDE_CHARS.toLocaleString("en-US")} characters.`;
  }
  if (!input.draft.trim()) return "A visual Deck slide cannot be empty.";
  if (/^\s*---\s*$/mu.test(input.draft)) {
    return "A visual Deck edit stays inside one slide. Add or remove slides from canonical source.";
  }
  return null;
}

function composeSlideFragment(
  input: VisualDeckSlideEditInput,
  newline: string,
) {
  const body = normalizeBody(input.draft, newline);
  const metadata = [`<!-- layout: ${input.layout} -->`];
  const eyebrow = input.eyebrow.trim();
  if (eyebrow) metadata.push(`<!-- eyebrow: ${eyebrow} -->`);
  return `${metadata.join(newline)}${newline}${newline}${body}`;
}

function canonicalPreviewFrontmatter(artifact: WorkspaceArtifact) {
  const parsed = parseDeckSource(artifact.source);
  if (!parsed.deck) return { source: "", errors: parsed.errors };
  const { frontmatter } = parsed.deck;
  const source = [
    "---",
    "version: 1",
    `title: ${frontmatter.title}`,
    `theme: ${frontmatter.theme}`,
    "ratio: 16:9",
    `lang: ${frontmatter.lang}`,
    "---",
  ].join("\n");
  return { source, errors: [] };
}

export function visualDeckSlideDraft(
  artifact: WorkspaceArtifact,
  target: PreviewSourceTarget,
): VisualDeckSlideEditInput | null {
  if (artifact.kind !== "slides" || target.kind !== "deck-slide") return null;
  const current = currentTargetForRevision(artifact, target);
  const parsed = parseDeckSource(artifact.source);
  const slide = current ? parsed.deck?.slides[current.index] : undefined;
  return slide ? { layout: slide.layout, eyebrow: slide.eyebrow, draft: slide.source } : null;
}

export function canVisualEditDeckSlide(
  artifact: WorkspaceArtifact,
  target: PreviewSourceTarget,
) {
  if (artifact.kind !== "slides" || artifact.language !== "Deck Markdown" || target.kind !== "deck-slide") return false;
  const current = currentTargetForRevision(artifact, target);
  return Boolean(current && current.end - current.start <= MAX_VISUAL_DECK_SLIDE_CHARS);
}

export function projectVisualDeckSlideDraft(
  artifact: WorkspaceArtifact,
  requestedTarget: PreviewSourceTarget,
  input: VisualDeckSlideEditInput,
): VisualDeckSlideDraftProjection {
  const target = artifact.kind === "slides"
    ? currentTargetForRevision(artifact, requestedTarget)
    : undefined;
  if (!target) {
    return {
      nextSource: artifact.source,
      start: requestedTarget.start,
      end: requestedTarget.end,
      errors: ["The slide no longer matches the current source revision."],
    };
  }
  const replacement = composeSlideFragment(input, newlineFor(artifact.source));
  const prepared = prepareVisualDeckSlideEdit(artifact, target, input);
  return {
    nextSource: `${artifact.source.slice(0, target.start)}${replacement}${artifact.source.slice(target.end)}`,
    start: target.start,
    end: target.start + replacement.length,
    errors: prepared.errors.filter((error) => !/unchanged\.?$/iu.test(error)),
  };
}

export function visualDeckSlidePreviewSource(
  artifact: WorkspaceArtifact,
  input: VisualDeckSlideEditInput,
): VisualDeckSlidePreview {
  const frontmatter = canonicalPreviewFrontmatter(artifact);
  if (frontmatter.errors.length) return frontmatter;
  const inputError = validateInput(input);
  if (inputError) return { source: "", errors: [inputError] };
  const source = `${frontmatter.source}\n\n${composeSlideFragment(input, "\n")}\n`;
  const parsed = parseDeckSource(source);
  return parsed.deck && parsed.deck.slides.length === 1
    ? { source, errors: [] }
    : { source: "", errors: parsed.errors.length ? parsed.errors : ["Rune could not compile this draft as one slide."] };
}

export function prepareVisualDeckSlideEdit(
  artifact: WorkspaceArtifact,
  requestedTarget: PreviewSourceTarget,
  input: VisualDeckSlideEditInput,
): PreparedVisualDeckSlideEdit {
  if (artifact.kind !== "slides" || artifact.language !== "Deck Markdown") {
    return emptyResult(artifact.source, "Visual slide editing requires a Deck Markdown artifact.");
  }
  const target = currentTargetForRevision(artifact, requestedTarget);
  if (!target) return emptyResult(artifact.source, "The slide no longer matches the current source revision.");
  if (target.end - target.start > MAX_VISUAL_DECK_SLIDE_CHARS) {
    return emptyResult(
      artifact.source,
      `Visual Deck slides are limited to ${MAX_VISUAL_DECK_SLIDE_CHARS.toLocaleString("en-US")} characters.`,
    );
  }
  const inputError = validateInput(input);
  if (inputError) return emptyResult(artifact.source, inputError);

  const parsed = parseDeckSource(artifact.source);
  const currentSlide = parsed.deck?.slides[target.index];
  if (!currentSlide) return emptyResult(artifact.source, "Rune could not resolve this slide in the current Deck.");
  const eyebrow = input.eyebrow.trim();
  const semanticBody = normalizedSemanticBody(input.draft);
  if (currentSlide.layout === input.layout
    && currentSlide.eyebrow === eyebrow
    && normalizedSemanticBody(currentSlide.source) === semanticBody) {
    return emptyResult(artifact.source, "The edited slide is unchanged.");
  }

  const replacement = composeSlideFragment(input, newlineFor(artifact.source));
  const currentFragment = artifact.source.slice(target.start, target.end);
  if (JSON.stringify(runeBindingTokens(replacement)) !== JSON.stringify(runeBindingTokens(currentFragment))) {
    return emptyResult(
      artifact.source,
      "Keep live metric and Chart bindings unchanged in the visual editor. Edit dependency source directly.",
    );
  }

  const nextSource = `${artifact.source.slice(0, target.start)}${replacement}${artifact.source.slice(target.end)}`;
  if (!sourceOutsideSelectionIsUnchanged(artifact.source, nextSource, target)) {
    return emptyResult(artifact.source, "The visual edit crossed its exact Deck slide boundary.");
  }
  const nextParsed = parseDeckSource(nextSource);
  if (!nextParsed.deck) return emptyResult(artifact.source, nextParsed.errors[0] ?? "The edited Deck is invalid.");
  if (nextParsed.deck.slides.length !== parsed.deck?.slides.length) {
    return emptyResult(artifact.source, "The visual edit changed the number of slides. Structural changes belong in canonical source.");
  }

  const nextArtifact = { ...artifact, source: nextSource };
  const nextTarget = derivePreviewSourceTargets(nextArtifact).find((candidate) => (
    candidate.kind === "deck-slide"
    && candidate.index === target.index
    && candidate.start === target.start
    && candidate.end === target.start + replacement.length
  )) ?? null;
  if (!nextTarget) {
    return emptyResult(artifact.source, "Rune could not prove the edited slide's new source range.");
  }
  return { nextSource, nextTarget, errors: [] };
}
