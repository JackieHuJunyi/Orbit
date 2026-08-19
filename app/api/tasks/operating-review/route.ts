import { DEFAULT_OPENAI_MODEL } from "../../../lib/model-preference.ts";
import { resolveModelRouting } from "../../../lib/model-credential-vault.ts";
import { requestProviderPlan } from "../../../lib/model-provider-adapters.ts";
import { executeModelRoute } from "../../../lib/model-routing.ts";
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
  const evidenceRows = evidence.evidenceRows;

  const routing = await resolveModelRouting(request);
  if (!routing.connections.length) {
    return Response.json({ error: "No model provider is configured.", code: "MODEL_UNCONFIGURED" }, { status: 503 });
  }

  const providerController = new AbortController();
  const providerTimeout = setTimeout(() => providerController.abort(), 60_000);
  try {
    const insightCount = Math.min(MAX_OPERATING_REVIEW_INSIGHTS, evidenceRows.length);
    const instructions = buildOperatingReviewModelInstructions(insightCount);
    const modelInput = buildOperatingReviewModelInput({
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
      evidenceRows,
    });
    const routed = await executeModelRoute({
      ...routing,
      signal: providerController.signal,
      run: async (connection) => {
        const response = await requestProviderPlan({
          connection,
          instructions,
          input: modelInput,
          schema: OperatingReviewNarrativeSchema,
          schemaName: "operating_review_questions",
          responseDescription: "Return Rune's evidence-bound operating-review questions for local validation.",
          signal: providerController.signal,
        });
        const validated = validateOperatingReviewNarrative(response.output, evidenceRows);
        if (!validated.narrative || validated.errors.length) {
          const error = new Error(validated.errors[0] ?? "The model returned an invalid operating-review narrative.");
          error.name = "ModelOutputValidationError";
          throw error;
        }
        return { response, narrative: validated.narrative };
      },
    });
    const connection = routed.connection;
    return Response.json({
      provider: connection.provider,
      profileName: connection.profileName,
      model: connection.model || DEFAULT_OPENAI_MODEL,
      usage: routed.result.response.usage,
      narrative: routed.result.narrative,
      routing: { attempts: routed.attempts, failoverUsed: routed.failoverUsed },
    });
  } catch (error) {
    if (error instanceof Error && error.name === "ModelOutputValidationError") {
      return Response.json({ error: error.message, code: "MODEL_NARRATIVE_INVALID" }, { status: 502 });
    }
    return Response.json(
      {
        error: "The model provider could not shape this review. Rune kept the source unchanged.",
        code: "MODEL_NARRATIVE_UNAVAILABLE",
      },
      { status: 502 },
    );
  } finally {
    clearTimeout(providerTimeout);
  }
}
