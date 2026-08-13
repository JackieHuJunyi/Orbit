import { z } from "zod";
import { RUNE_LOCALE_REGISTRY } from "./localization.ts";

export const MAX_OPERATING_REVIEW_MODEL_SOURCE_CHARS = 100_000;
export const MAX_OPERATING_REVIEW_EVIDENCE_ROWS = 20;
export const MAX_OPERATING_REVIEW_INSIGHTS = 2;

const OperatingReviewArtifactSchema = z.object({
  id: z.string().min(1).max(120),
  name: z.string().min(1).max(240),
  kind: z.literal("data"),
  language: z.string().min(1).max(80),
  source: z.string().min(1).max(MAX_OPERATING_REVIEW_MODEL_SOURCE_CHARS),
}).strict();

const OperatingReviewInputSchema = z.object({
  title: z.string().trim().min(1).max(60),
  dataArtifactId: z.string().min(1).max(120),
  category: z.string().min(1).max(120),
  value: z.string().min(1).max(120),
  aggregation: z.enum(["sum", "average"]),
  mark: z.enum(["bar", "line"]),
  format: z.enum(["number", "currency", "percent"]),
  period: z.string().trim().min(1).max(60),
  audience: z.enum(["leadership", "board", "team"]),
  focus: z.string().trim().min(1).max(140),
  deliverables: z.array(z.enum(["document", "slides"])).min(1).max(2),
  locale: z.enum(RUNE_LOCALE_REGISTRY.map((entry) => entry.locale)),
}).strict().superRefine((input, context) => {
  if (new Set(input.deliverables).size !== input.deliverables.length) {
    context.addIssue({ code: "custom", message: "Deliverable choices must be unique." });
  }
});

export const OperatingReviewModelRequestSchema = z.object({
  artifact: OperatingReviewArtifactSchema,
  input: OperatingReviewInputSchema,
}).strict().superRefine((request, context) => {
  if (request.artifact.id !== request.input.dataArtifactId) {
    context.addIssue({ code: "custom", message: "The Data identity does not match the review source." });
  }
});

export const OperatingReviewNarrativeSchema = z.object({
  insights: z.array(z.object({
    primaryEvidenceRowId: z.string().regex(/^result-(?:[1-9]|1\d|20)$/u),
    supportingEvidenceRowId: z.string().regex(/^result-(?:[1-9]|1\d|20)$/u).nullable(),
    title: z.string().trim().min(1).max(70),
    question: z.string().trim().min(1).max(140),
    decisionPrompt: z.string().trim().min(1).max(140),
  }).strict()).min(1).max(MAX_OPERATING_REVIEW_INSIGHTS),
}).strict();

export type OperatingReviewEvidenceRow = {
  id: string;
  category: string;
  value: number;
  sourceRowCount: number;
};

export type OperatingReviewNarrative = z.infer<typeof OperatingReviewNarrativeSchema>;

function isPlainQualitativeLine(value: string) {
  return !/[\r\n\u0000-\u001f\u007f<>{}\p{N}%$€£¥₹]/u.test(value);
}

export function validateOperatingReviewNarrative(
  value: unknown,
  evidenceRows: readonly OperatingReviewEvidenceRow[],
) {
  const parsed = OperatingReviewNarrativeSchema.safeParse(value);
  if (!parsed.success) return { errors: ["The model returned an invalid operating-review narrative."] };
  const expectedInsightCount = Math.min(MAX_OPERATING_REVIEW_INSIGHTS, evidenceRows.length);
  if (parsed.data.insights.length !== expectedInsightCount) {
    return { errors: [`The model must return exactly ${expectedInsightCount} evidence-led insights.`] };
  }
  const evidenceIds = new Set(evidenceRows.map((row) => row.id));
  const evidenceLabels = evidenceRows
    .map((row) => row.category.toLocaleLowerCase("en-US"))
    .filter((label) => [...label].length >= 3);
  const primaryIds = parsed.data.insights.map((insight) => insight.primaryEvidenceRowId);
  if (new Set(primaryIds).size !== primaryIds.length || primaryIds.some((id) => !evidenceIds.has(id))) {
    return { errors: ["Every insight needs a unique exact primary evidence row."] };
  }
  if (parsed.data.insights.some((insight) => (
    (insight.supportingEvidenceRowId != null
      && (!evidenceIds.has(insight.supportingEvidenceRowId)
        || insight.supportingEvidenceRowId === insight.primaryEvidenceRowId))
    || !isPlainQualitativeLine(insight.title)
    || !isPlainQualitativeLine(insight.question)
    || !isPlainQualitativeLine(insight.decisionPrompt)
    || evidenceLabels.some((label) => [insight.title, insight.question, insight.decisionPrompt]
      .some((text) => text.toLocaleLowerCase("en-US").includes(label)))
  ))) {
    return { errors: ["Model narrative must use exact evidence ids and generic qualitative text without copied labels or numbers."] };
  }
  return { narrative: parsed.data, errors: [] };
}

export function buildOperatingReviewModelInstructions(insightCount: number) {
  return `You are Rune's bounded operating-review question planner. Return exactly ${insightCount} evidence-led review prompts. Each prompt must use a unique primaryEvidenceRowId from the supplied aggregate evidence and must set supportingEvidenceRowId to a different exact evidence id or null. Rune will insert live category context and every numeric value deterministically; do not copy category labels or include digits, written numbers, currencies, percentages, dates, Markdown, HTML, binding braces, or line breaks in title, question, or decisionPrompt. Do not claim causation, forecasts, people, events, or facts absent from the evidence. Ask a concise question about the visible pattern and offer a cautious decision prompt for the requested audience and purpose. Return only the required structured narrative.`;
}

export function buildOperatingReviewModelInput({
  sourceName,
  title,
  audience,
  focus,
  period,
  locale,
  category,
  value,
  aggregation,
  evidenceRows,
}: {
  sourceName: string;
  title: string;
  audience: string;
  focus: string;
  period: string;
  locale: string;
  category: string;
  value: string;
  aggregation: string;
  evidenceRows: readonly OperatingReviewEvidenceRow[];
}) {
  return JSON.stringify({
    task: { title, audience, purpose: focus, period, language: locale },
    measure: { sourceName, category, value, aggregation },
    aggregateEvidence: evidenceRows,
  }, null, 2);
}
