import { prepareArtifactCreation } from "./artifact-creation.ts";
import { derivePreviewSourceTargets } from "./preview-targets.ts";
import {
  prepareWorkspaceMutation,
  type ArtifactCreationChange,
} from "./patches.ts";
import { runeText, type RuneLocale } from "./localization.ts";
import type { WorkspaceArtifact } from "./workspace.ts";

export const MAX_DOCUMENT_BRIEFING_TITLE_CHARS = 80;
export const MAX_DOCUMENT_BRIEFING_FOCUS_CHARS = 180;

export type DocumentBriefingAudience = "leadership" | "team" | "customer";
export type DocumentBriefingSlideCount = 4 | 6 | 8;

export type DocumentBriefingInput = {
  sourceArtifactId: string;
  title: string;
  audience: DocumentBriefingAudience;
  focus: string;
  slideCount: DocumentBriefingSlideCount;
  locale: RuneLocale;
};

export type DocumentBriefingPlan = {
  summary: string;
  detail: string;
  patches: [];
  creations: [ArtifactCreationChange];
};

export type PreparedDocumentBriefing = {
  plan?: DocumentBriefingPlan;
  errors: string[];
};

type BriefingUnit = { label: string; body: string };

function normalizePlainText(value: string) {
  return value.normalize("NFKC").replace(/[\t ]+/gu, " ").trim();
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

function splitReadableUnits(source: WorkspaceArtifact): BriefingUnit[] {
  const sections = derivePreviewSourceTargets(source)
    .filter((target) => target.kind === "document-section")
    .flatMap((target) => {
      const body = readableMarkdown(source.source.slice(target.start, target.end));
      if (!body) return [];
      const blocks = body.split(/\n\s*\n/gu).map((part) => part.trim()).filter(Boolean);
      return blocks.map((block) => ({ label: target.label, body: block }));
    });
  if (sections.length) return sections;
  const body = readableMarkdown(source.source);
  return body ? [{ label: "Document body", body }] : [];
}

function splitLongestUnit(units: BriefingUnit[]) {
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
  units.splice(index, 1,
    { ...unit, body: unit.body.slice(0, splitAt).trim() },
    { ...unit, body: unit.body.slice(splitAt).trim() },
  );
  return true;
}

function briefingUnits(source: WorkspaceArtifact, count: number) {
  const units = splitReadableUnits(source);
  while (units.length < count && splitLongestUnit(units)) {
    // Keep splitting the longest readable source block until every requested slide has evidence.
  }
  if (units.length < count) return [];
  return Array.from({ length: count }, (_, index) => {
    const start = Math.floor(index * units.length / count);
    const end = Math.floor((index + 1) * units.length / count);
    const group = units.slice(start, Math.max(start + 1, end));
    const body = group.map((unit) => unit.body).join("\n\n");
    return {
      label: group[0]?.label ?? `Source ${index + 1}`,
      body: body.length > 1_300 ? `${body.slice(0, 1_299).trimEnd()}…` : body,
    };
  });
}

function audienceLabel(locale: RuneLocale, audience: DocumentBriefingAudience) {
  const english = audience === "leadership" ? "Leadership" : audience === "customer" ? "Customer" : "Team";
  const chinese = audience === "leadership" ? "管理层" : audience === "customer" ? "客户" : "团队";
  return runeText(locale, english, chinese);
}

function deckSource(source: WorkspaceArtifact, input: DocumentBriefingInput, units: BriefingUnit[]) {
  const title = markdownInline(normalizePlainText(input.title));
  const focus = markdownInline(normalizePlainText(input.focus));
  const audience = audienceLabel(input.locale, input.audience);
  const sourceName = markdownInline(source.name);
  const contentSlides = units.map((unit, index) => `<!-- layout: content -->
<!-- eyebrow: ${runeText(input.locale, `Source ${index + 1}`, `来源 ${index + 1}`)} · ${sourceName} -->

## ${markdownInline(unit.label)}

${unit.body}`).join("\n\n---\n\n");

  return `---
version: 1
title: ${normalizePlainText(input.title)}
theme: rune
ratio: 16:9
lang: ${input.locale}
origin: ${source.id}
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
): PreparedDocumentBriefing {
  const errors = [
    validatePlainText(input.title, "Presentation title", MAX_DOCUMENT_BRIEFING_TITLE_CHARS),
    validatePlainText(input.focus, "Briefing focus", MAX_DOCUMENT_BRIEFING_FOCUS_CHARS),
  ].filter(Boolean);
  if (![4, 6, 8].includes(input.slideCount)) errors.push("Choose 4, 6, or 8 slides.");
  const source = artifacts.find((artifact) => artifact.id === input.sourceArtifactId);
  if (!source) errors.push(`Document source is missing: ${input.sourceArtifactId}`);
  else if (source.kind !== "document") errors.push(`Presentation source must be a Document artifact: ${input.sourceArtifactId}`);
  if (errors.length || !source || source.kind !== "document") return { errors };

  const units = briefingUnits(source, input.slideCount - 2);
  if (units.length !== input.slideCount - 2) {
    return { errors: [`${source.name} does not contain enough readable material for ${input.slideCount} distinct slides.`] };
  }

  const prepared = prepareArtifactCreation(artifacts, { kind: "slides", title: input.title });
  if (!prepared.artifact || prepared.errors.length) return { errors: prepared.errors };
  const artifact = { ...prepared.artifact, source: deckSource(source, input, units) };
  const creation: ArtifactCreationChange = {
    artifact,
    summary: `Create “${artifact.name}” from ${source.name}`,
    detail: `${input.slideCount} editable Deck Markdown slides with an explicit origin link to ${source.id}.`,
    operationCount: input.slideCount,
  };
  const transaction = prepareWorkspaceMutation(artifacts, [], [creation]);
  if (transaction.errors.length) return { errors: transaction.errors };
  return {
    plan: {
      summary: `Create a source-linked presentation from “${source.name}”`,
      detail: `Compile ${input.slideCount} editable slides for ${audienceLabel(input.locale, input.audience)}; source identity remains explicit and every write requires review.`,
      patches: [],
      creations: [creation],
    },
    errors: [],
  };
}
