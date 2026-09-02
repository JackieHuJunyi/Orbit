import { z } from "zod";
import { RUNE_LOCALE_REGISTRY } from "./localization.ts";

export const MAX_DOCUMENT_BRIEFING_MODEL_SOURCE_CHARS = 100_000;
export const MAX_DOCUMENT_BRIEFING_MODEL_SLIDE_TITLE_CHARS = 90;
export const MAX_DOCUMENT_BRIEFING_MODEL_BULLET_CHARS = 240;

const DocumentBriefingArtifactSchema = z
  .object({
    id: z.string().min(1).max(120),
    name: z.string().min(1).max(240),
    kind: z.literal("document"),
    language: z.string().min(1).max(80),
    source: z.string().min(1).max(MAX_DOCUMENT_BRIEFING_MODEL_SOURCE_CHARS),
  })
  .strict();

const DocumentBriefingInputSchema = z
  .object({
    sourceArtifactId: z.string().min(1).max(120),
    targetArtifactId: z.string().min(1).max(120).optional(),
    title: z.string().trim().min(1).max(80),
    audience: z.enum(["leadership", "team", "customer"]),
    focus: z.string().trim().min(1).max(180),
    slideCount: z.union([z.literal(4), z.literal(6), z.literal(8)]),
    locale: z.enum(RUNE_LOCALE_REGISTRY.map((entry) => entry.locale)),
  })
  .strict();

export const DocumentBriefingModelRequestSchema = z
  .object({
    artifact: DocumentBriefingArtifactSchema,
    input: DocumentBriefingInputSchema,
  })
  .strict()
  .superRefine((request, context) => {
    if (request.artifact.id !== request.input.sourceArtifactId) {
      context.addIssue({
        code: "custom",
        message: "The Document identity does not match the briefing source.",
      });
    }
  });

export const DocumentBriefingModelOutlineSchema = z
  .object({
    slides: z
      .array(
        z
          .object({
            sourceUnitId: z.string().regex(/^source-[1-6]$/u),
            title: z.string().trim().min(1).max(MAX_DOCUMENT_BRIEFING_MODEL_SLIDE_TITLE_CHARS),
            bullets: z.array(z.string().trim().min(1).max(MAX_DOCUMENT_BRIEFING_MODEL_BULLET_CHARS)).min(1).max(4),
          })
          .strict(),
      )
      .min(2)
      .max(6),
  })
  .strict();

export type DocumentBriefingEvidenceUnit = {
  id: string;
  label: string;
  body: string;
};

export type DocumentBriefingModelOutline = z.infer<typeof DocumentBriefingModelOutlineSchema>;

function isPlainModelLine(value: string) {
  return !/[\r\n\u0000-\u001f\u007f<>{}]/u.test(value);
}

export function validateDocumentBriefingModelOutline(
  value: unknown,
  evidenceUnits: readonly DocumentBriefingEvidenceUnit[],
) {
  const parsed = DocumentBriefingModelOutlineSchema.safeParse(value);
  if (!parsed.success) return { errors: ["The model returned an invalid presentation outline."] };
  if (parsed.data.slides.length !== evidenceUnits.length) {
    return { errors: [`The model must return exactly ${evidenceUnits.length} content slides.`] };
  }
  const expectedIds = new Set(evidenceUnits.map((unit) => unit.id));
  const receivedIds = parsed.data.slides.map((slide) => slide.sourceUnitId);
  if (
    new Set(receivedIds).size !== receivedIds.length ||
    receivedIds.some((id) => !expectedIds.has(id)) ||
    expectedIds.size !== receivedIds.length
  ) {
    return { errors: ["Every bounded source unit must support exactly one content slide."] };
  }
  if (
    parsed.data.slides.some(
      (slide) => !isPlainModelLine(slide.title) || slide.bullets.some((bullet) => !isPlainModelLine(bullet)),
    )
  ) {
    return { errors: ["Model-authored titles and bullets must remain plain text."] };
  }
  return { outline: parsed.data, errors: [] };
}

export function buildDocumentBriefingModelInstructions(contentSlideCount: number) {
  return `You are Orbit's bounded presentation narrative planner. Return exactly ${contentSlideCount} content slides; Orbit owns the cover, conclusion, file identity, source metadata, and every write. Use each supplied sourceUnitId exactly once. Keep every claim supported by that unit's excerpt. Titles and bullets must be concise plain text with no Markdown, HTML, binding braces, or line breaks. Do not invent numbers, people, dates, decisions, or outcomes. Shape the narrative for the requested audience, purpose, and language. Return only the required structured outline.`;
}

export function buildDocumentBriefingModelInput({
  sourceName,
  title,
  audience,
  focus,
  locale,
  slideCount,
  evidenceUnits,
}: {
  sourceName: string;
  title: string;
  audience: string;
  focus: string;
  locale: string;
  slideCount: number;
  evidenceUnits: readonly DocumentBriefingEvidenceUnit[];
}) {
  return JSON.stringify(
    {
      task: {
        title,
        audience,
        purpose: focus,
        language: locale,
        totalSlides: slideCount,
        contentSlides: evidenceUnits.length,
      },
      source: {
        name: sourceName,
        units: evidenceUnits.map((unit) => ({
          sourceUnitId: unit.id,
          section: unit.label,
          excerpt: unit.body,
        })),
      },
    },
    null,
    2,
  );
}
