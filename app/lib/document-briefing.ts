import { prepareArtifactCreation } from "./artifact-creation.ts";
import { isDeckMarkdownArtifact, parseDeckSource } from "./deck.ts";
import { derivePreviewSourceTargets } from "./preview-targets.ts";
import { prepareWorkspaceMutation, type ArtifactCreationChange, type ArtifactSourcePatch } from "./patches.ts";
import { runeText, type RuneLocale } from "./localization.ts";
import { portableSourceRevision } from "./source-revision.ts";
import type { WorkspaceArtifact } from "./workspace.ts";
import {
  validateDocumentBriefingModelOutline,
  type DocumentBriefingEvidenceUnit,
  type DocumentBriefingModelOutline,
} from "./document-briefing-contract.ts";

export const MAX_DOCUMENT_BRIEFING_TITLE_CHARS = 80;
export const MAX_DOCUMENT_BRIEFING_FOCUS_CHARS = 180;

export type DocumentBriefingAudience = "leadership" | "team" | "customer";
export type DocumentBriefingSlideCount = 4 | 6 | 8;
export type DocumentBriefingFreshness = "current" | "changed" | "unknown";

export type DocumentBriefingInput = {
  sourceArtifactId: string;
  targetArtifactId?: string;
  title: string;
  audience: DocumentBriefingAudience;
  focus: string;
  slideCount: DocumentBriefingSlideCount;
  locale: RuneLocale;
};

export type DocumentBriefingPlan = {
  summary: string;
  detail: string;
  patches: ArtifactSourcePatch[];
  creations: ArtifactCreationChange[];
};

export type DocumentBriefingTarget = {
  artifactId: string;
  name: string;
  title: string;
  slideCount: number;
  locale: RuneLocale;
  audience?: DocumentBriefingAudience;
  purpose?: string;
  freshness: DocumentBriefingFreshness;
};

export type PreparedDocumentBriefing = {
  plan?: DocumentBriefingPlan;
  errors: string[];
};

type BriefingUnit = DocumentBriefingEvidenceUnit;
type RawBriefingUnit = Omit<BriefingUnit, "id">;

export type { DocumentBriefingModelOutline } from "./document-briefing-contract.ts";

export function documentBriefingSourceIdForPresentation(artifact: WorkspaceArtifact) {
  if (artifact.kind !== "slides" || !isDeckMarkdownArtifact(artifact)) return null;
  const parsed = parseDeckSource(artifact.source);
  if (!parsed.deck || parsed.errors.length) return null;
  return parsed.deck.frontmatter.origin ?? null;
}

export function documentBriefingTargets(
  artifacts: WorkspaceArtifact[],
  sourceArtifactId: string,
): DocumentBriefingTarget[] {
  const source = artifacts.find((artifact) => artifact.id === sourceArtifactId && artifact.kind === "document");
  if (!source) return [];
  const currentSourceRevision = portableSourceRevision(source.source);
  return artifacts.flatMap((artifact): DocumentBriefingTarget[] => {
    if (documentBriefingSourceIdForPresentation(artifact) !== sourceArtifactId) return [];
    const parsed = parseDeckSource(artifact.source);
    if (!parsed.deck || parsed.errors.length) return [];
    return [
      {
        artifactId: artifact.id,
        name: artifact.name,
        title: parsed.deck.frontmatter.title,
        slideCount: parsed.deck.slides.length,
        locale: parsed.deck.frontmatter.lang,
        audience: parsed.deck.frontmatter.audience,
        purpose: parsed.deck.frontmatter.purpose,
        freshness:
          parsed.deck.frontmatter.origin_revision == null
            ? "unknown"
            : parsed.deck.frontmatter.origin_revision === currentSourceRevision
              ? "current"
              : "changed",
      },
    ];
  });
}

function normalizePlainText(value: string) {
  return value
    .normalize("NFKC")
    .replace(/[\t ]+/gu, " ")
    .trim();
}

function validatePlainText(value: string, label: string, maxChars: number) {
  if (!value.trim()) return `${label} is required.`;
  if (/[\r\n\u0000-\u001f\u007f<>{}]/u.test(value)) {
    return `${label} must be one plain-text line without angle brackets or binding braces.`;
  }
  if ([...normalizePlainText(value)].length > maxChars) return `${label} is limited to ${maxChars} characters.`;
  return "";
}

function markdownInline(value: string) {
  return value.replace(/[\\`*_\[\]#|]/gu, (character) => `\\${character}`);
}

function readableMarkdown(value: string) {
  return value
    .replace(/```[^]*?```/gu, "")
    .replace(/~~~[^]*?~~~/gu, "")
    .replace(/<!--[^]*?-->/gu, "")
    .replace(/<[^>]+>/gu, "")
    .replace(/!\[([^\]]*)\]\([^)]*\)/gu, "$1")
    .replace(/\[([^\]]+)\]\([^)]*\)/gu, "$1")
    .replace(/\{\{[^}]+\}\}/gu, "linked source value")
    .replace(/^\s*#{1,6}\s+.*$/gmu, "")
    .replace(/^\s*---\s*$/gmu, "—")
    .replace(/\n{3,}/gu, "\n\n")
    .trim();
}

function splitReadableUnits(source: WorkspaceArtifact): RawBriefingUnit[] {
  const sections = derivePreviewSourceTargets(source)
    .filter((target) => target.kind === "document-section")
    .flatMap((target) => {
      const body = readableMarkdown(source.source.slice(target.start, target.end));
      if (!body) return [];
      const blocks = body
        .split(/\n\s*\n/gu)
        .map((part) => part.trim())
        .filter(Boolean);
      return blocks.map((block) => ({ label: target.label, body: block }));
    });
  if (sections.length) return sections;
  const body = readableMarkdown(source.source);
  return body ? [{ label: "Document body", body }] : [];
}

function splitLongestUnit(units: RawBriefingUnit[]) {
  let index = -1;
  let splitAt = -1;
  units.forEach((unit, unitIndex) => {
    if (unit.body.length < 120 || unit.body.length <= (index >= 0 ? units[index].body.length : 0)) return;
    const midpoint = Math.floor(unit.body.length / 2);
    const candidates = [
      unit.body.lastIndexOf(". ", midpoint),
      unit.body.lastIndexOf("。", midpoint),
      unit.body.lastIndexOf("\n", midpoint),
      unit.body.lastIndexOf(" ", midpoint),
    ].filter((candidate) => candidate >= 40);
    const candidate = Math.max(...candidates, -1);
    if (candidate > 0 && unit.body.length - candidate > 40) {
      index = unitIndex;
      splitAt = candidate + (unit.body[candidate] === " " ? 0 : 1);
    }
  });
  if (index < 0 || splitAt < 0) return false;
  const unit = units[index];
  units.splice(
    index,
    1,
    { ...unit, body: unit.body.slice(0, splitAt).trim() },
    { ...unit, body: unit.body.slice(splitAt).trim() },
  );
  return true;
}

function briefingUnits(source: WorkspaceArtifact, count: number): BriefingUnit[] {
  const units = splitReadableUnits(source);
  while (units.length < count && splitLongestUnit(units)) {
    // Keep splitting the longest readable source block until every requested slide has evidence.
  }
  if (units.length < count) return [];
  return Array.from({ length: count }, (_, index) => {
    const start = Math.floor((index * units.length) / count);
    const end = Math.floor(((index + 1) * units.length) / count);
    const group = units.slice(start, Math.max(start + 1, end));
    const body = group.map((unit) => unit.body).join("\n\n");
    return {
      id: `source-${index + 1}`,
      label: group[0]?.label ?? `Source ${index + 1}`,
      body: body.length > 1_300 ? `${body.slice(0, 1_299).trimEnd()}…` : body,
    };
  });
}

export function prepareDocumentBriefingEvidence(artifacts: WorkspaceArtifact[], input: DocumentBriefingInput) {
  const source = artifacts.find((artifact) => artifact.id === input.sourceArtifactId);
  if (!source) return { errors: [`Document source is missing: ${input.sourceArtifactId}`] };
  if (source.kind !== "document") {
    return { errors: [`Presentation source must be a Document artifact: ${input.sourceArtifactId}`] };
  }
  const evidenceUnits = briefingUnits(source, input.slideCount - 2);
  if (evidenceUnits.length !== input.slideCount - 2) {
    return {
      errors: [`${source.name} does not contain enough readable material for ${input.slideCount} distinct slides.`],
    };
  }
  return { source, evidenceUnits, errors: [] };
}

function audienceLabel(locale: RuneLocale, audience: DocumentBriefingAudience) {
  const english = audience === "leadership" ? "Leadership" : audience === "customer" ? "Customer" : "Team";
  const chinese = audience === "leadership" ? "管理层" : audience === "customer" ? "客户" : "团队";
  return runeText(locale, english, chinese);
}

function deckSource(
  source: WorkspaceArtifact,
  input: DocumentBriefingInput,
  units: BriefingUnit[],
  theme: "rune" | "rune-dark" = "rune",
  outline?: DocumentBriefingModelOutline,
) {
  const title = markdownInline(normalizePlainText(input.title));
  const focus = markdownInline(normalizePlainText(input.focus));
  const audience = audienceLabel(input.locale, input.audience);
  const sourceName = markdownInline(source.name);
  const unitById = new Map(units.map((unit) => [unit.id, unit] as const));
  const content = outline
    ? outline.slides.map((slide) => ({
        unit: unitById.get(slide.sourceUnitId) as BriefingUnit,
        title: slide.title,
        body: slide.bullets.map((bullet) => `- ${markdownInline(normalizePlainText(bullet))}`).join("\n"),
      }))
    : units.map((unit) => ({ unit, title: unit.label, body: unit.body }));
  const contentSlides = content
    .map(
      ({ unit, title: slideTitle, body }, index) => `<!-- layout: content -->
<!-- eyebrow: ${runeText(input.locale, `Source ${index + 1}`, `来源 ${index + 1}`)} · ${sourceName} -->
<!-- source-unit: ${unit.id} -->

## ${markdownInline(normalizePlainText(slideTitle))}

${body}`,
    )
    .join("\n\n---\n\n");

  return `---
version: 1
title: ${normalizePlainText(input.title)}
theme: ${theme}
ratio: 16:9
lang: ${input.locale}
origin: ${source.id}
origin_revision: ${portableSourceRevision(source.source)}
audience: ${input.audience}
purpose: ${normalizePlainText(input.focus)}
---

<!-- layout: cover -->
<!-- eyebrow: ${runeText(input.locale, "Document briefing", "文档简报")} -->

# ${title}

${audience} · ${runeText(input.locale, "Compiled from one reviewed local source", "由一份已审核的本地来源编译")}

---

${contentSlides}

---

<!-- layout: conclusion -->
<!-- eyebrow: ${runeText(input.locale, "Purpose", "目标")} -->

## ${runeText(input.locale, "Use the source to guide the decision.", "让来源内容支撑下一步判断。")}

${focus}

${runeText(input.locale, "Source identity stays attached to this presentation; review the transaction before Rune writes it.", "这份演示始终保留来源身份；Rune 只会在你审核事务后写入。")}
`;
}

export function prepareDocumentBriefingWorkflow(
  artifacts: WorkspaceArtifact[],
  input: DocumentBriefingInput,
  outline?: DocumentBriefingModelOutline,
): PreparedDocumentBriefing {
  const errors = [
    validatePlainText(input.title, "Presentation title", MAX_DOCUMENT_BRIEFING_TITLE_CHARS),
    validatePlainText(input.focus, "Briefing focus", MAX_DOCUMENT_BRIEFING_FOCUS_CHARS),
  ].filter(Boolean);
  if (![4, 6, 8].includes(input.slideCount)) errors.push("Choose 4, 6, or 8 slides.");
  const source = artifacts.find((artifact) => artifact.id === input.sourceArtifactId);
  if (!source) errors.push(`Document source is missing: ${input.sourceArtifactId}`);
  else if (source.kind !== "document")
    errors.push(`Presentation source must be a Document artifact: ${input.sourceArtifactId}`);
  const target = input.targetArtifactId
    ? artifacts.find((artifact) => artifact.id === input.targetArtifactId)
    : undefined;
  let targetTheme: "rune" | "rune-dark" = "rune";
  if (input.targetArtifactId && !target) {
    errors.push(`Presentation target is missing: ${input.targetArtifactId}`);
  } else if (target) {
    if (target.kind !== "slides" || !isDeckMarkdownArtifact(target)) {
      errors.push(`Presentation target must be a Deck Markdown artifact: ${target.id}`);
    } else {
      const parsedTarget = parseDeckSource(target.source);
      if (!parsedTarget.deck || parsedTarget.errors.length) {
        errors.push(`${target.name} is not a valid Deck Markdown presentation.`);
      } else if (parsedTarget.deck.frontmatter.origin !== input.sourceArtifactId) {
        errors.push(`${target.name} is not linked to Document source ${input.sourceArtifactId}.`);
      } else {
        targetTheme = parsedTarget.deck.frontmatter.theme;
      }
    }
  }
  if (errors.length || !source || source.kind !== "document") return { errors };

  const units = briefingUnits(source, input.slideCount - 2);
  if (units.length !== input.slideCount - 2) {
    return {
      errors: [`${source.name} does not contain enough readable material for ${input.slideCount} distinct slides.`],
    };
  }

  if (outline) {
    const validatedOutline = validateDocumentBriefingModelOutline(outline, units);
    if (!validatedOutline.outline || validatedOutline.errors.length) return { errors: validatedOutline.errors };
    outline = validatedOutline.outline;
  }

  const nextSource = deckSource(source, input, units, targetTheme, outline);
  let patches: ArtifactSourcePatch[] = [];
  let creations: ArtifactCreationChange[] = [];
  if (target) {
    patches = [
      {
        artifactId: target.id,
        nextSource,
        summary: `Refresh “${target.name}” from ${source.name}`,
        detail: `Replace the current slide source with ${input.slideCount} reviewed slides while preserving ${target.id} and its explicit origin link.`,
        operationCount: input.slideCount,
      },
    ];
  } else {
    const prepared = prepareArtifactCreation(artifacts, { kind: "slides", title: input.title });
    if (!prepared.artifact || prepared.errors.length) return { errors: prepared.errors };
    const artifact = { ...prepared.artifact, source: nextSource };
    creations = [
      {
        artifact,
        summary: `Create “${artifact.name}” from ${source.name}`,
        detail: `${input.slideCount} editable Deck Markdown slides with an explicit origin link to ${source.id}.`,
        operationCount: input.slideCount,
      },
    ];
  }
  const transaction = prepareWorkspaceMutation(artifacts, patches, creations);
  if (transaction.errors.length) return { errors: transaction.errors };
  const updating = Boolean(target);
  return {
    plan: {
      summary: `${updating ? "Refresh" : "Create"} a source-linked presentation from “${source.name}”`,
      detail: `Compile ${input.slideCount} editable slides for ${audienceLabel(input.locale, input.audience)}; ${updating ? "the existing presentation identity" : "source identity"} remains explicit and every write requires review.`,
      patches,
      creations,
    },
    errors: [],
  };
}
