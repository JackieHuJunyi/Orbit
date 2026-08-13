import { DEFAULT_OPENAI_MODEL } from "../../../lib/model-preference.ts";
import { resolveActiveModelConnection } from "../../../lib/model-credential-vault.ts";
import { requestProviderPlan } from "../../../lib/model-provider-adapters.ts";
import {
  OperatingReviewModelRequestSchema,
  OperatingReviewNarrativeSchema,
  MAX_OPERATING_REVIEW_INSIGHTS,
  buildOperatingReviewModelInput,
  buildOperatingReviewModelInstructions,
  validateOperatingReviewNarrative,
} from "../../../lib/operating-review-contract.ts";
import {
  prepareOperatingReviewEvidence,
  prepareOperatingReviewWorkflow,
  type OperatingReviewInput,
} from "../../../lib/operating-review.ts";

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }

  const parsed = OperatingReviewModelRequestSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "The operating-review request is invalid." }, { status: 400 });
  }

  const { artifact, input } = parsed.data;
  const typedInput = input as OperatingReviewInput;
  const localPlan = prepareOperatingReviewWorkflow([artifact], typedInput);
  if (!localPlan.plan || localPlan.errors.length) {
    return Response.json({ error: localPlan.errors[0] ?? "The operating-review source is invalid." }, { status: 400 });
  }
  const evidence = prepareOperatingReviewEvidence([artifact], typedInput);
  if (!evidence.data || !evidence.evidenceRows || evidence.errors.length) {
    return Response.json({ error: evidence.errors[0] ?? "The aggregate evidence is invalid." }, { status: 400 });
  }

  const connection = await resolveActiveModelConnection(request);
  if (!connection) {
    return Response.json(
      { error: "No model provider is configured.", code: "MODEL_UNCONFIGURED" },
      { status: 503 },
    );
  }

  const model = connection.model || DEFAULT_OPENAI_MODEL;
  const providerController = new AbortController();
  const providerTimeout = setTimeout(() => providerController.abort(), 60_000);
  try {
    const insightCount = Math.min(MAX_OPERATING_REVIEW_INSIGHTS, evidence.evidenceRows.length);
    const response = await requestProviderPlan({
      connection,
      instructions: buildOperatingReviewModelInstructions(insightCount),
      input: buildOperatingReviewModelInput({
        sourceName: evidence.data.name,
        title: input.title,
        audience: input.audience,
        focus: input.focus,
        period: input.period,
        locale: input.locale,
        category: input.category,
        value: input.value,
        aggregation: input.aggregation,
        scope: input.scope,
        comparisonScope: input.comparisonScope,
        evidenceRows: evidence.evidenceRows,
      }),
      schema: OperatingReviewNarrativeSchema,
      schemaName: "operating_review_questions",
      responseDescription: "Return Rune's evidence-bound operating-review questions for local validation.",
      signal: providerController.signal,
    });
    const validated = validateOperatingReviewNarrative(response.output, evidence.evidenceRows);
    if (!validated.narrative || validated.errors.length) {
      return Response.json({
        error: validated.errors[0] ?? "The model returned an invalid operating-review narrative.",
        code: "MODEL_NARRATIVE_INVALID",
      }, { status: 502 });
    }
    return Response.json({
      provider: connection.provider,
      profileName: connection.profileName,
      model,
      usage: response.usage,
      narrative: validated.narrative,
    });
  } catch {
    return Response.json({
      error: "The model provider could not shape this review. Rune kept the source unchanged.",
      code: "MODEL_NARRATIVE_UNAVAILABLE",
    }, { status: 502 });
  } finally {
    clearTimeout(providerTimeout);
  }
}
