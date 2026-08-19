import { DEFAULT_OPENAI_MODEL } from "../../../lib/model-preference.ts";
import { resolveModelRouting } from "../../../lib/model-credential-vault.ts";
import { requestProviderPlan } from "../../../lib/model-provider-adapters.ts";
import { executeModelRoute } from "../../../lib/model-routing.ts";
import {
  DocumentBriefingModelOutlineSchema,
  DocumentBriefingModelRequestSchema,
  buildDocumentBriefingModelInput,
  buildDocumentBriefingModelInstructions,
  validateDocumentBriefingModelOutline,
} from "../../../lib/document-briefing-contract.ts";
import { prepareDocumentBriefingEvidence, type DocumentBriefingInput } from "../../../lib/document-briefing.ts";

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }

  const parsed = DocumentBriefingModelRequestSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "The Document briefing request is invalid." }, { status: 400 });
  }

  const { artifact, input } = parsed.data;
  const evidence = prepareDocumentBriefingEvidence([artifact], input as DocumentBriefingInput);
  if (!evidence.source || !evidence.evidenceUnits || evidence.errors.length) {
    return Response.json({ error: evidence.errors[0] ?? "The Document evidence is invalid." }, { status: 400 });
  }

  const routing = await resolveModelRouting(request);
  if (!routing.connections.length) {
    return Response.json({ error: "No model provider is configured.", code: "MODEL_UNCONFIGURED" }, { status: 503 });
  }

  const providerController = new AbortController();
  const providerTimeout = setTimeout(() => providerController.abort(), 60_000);
  try {
    const instructions = buildDocumentBriefingModelInstructions(evidence.evidenceUnits.length);
    const modelInput = buildDocumentBriefingModelInput({
      sourceName: evidence.source.name,
      title: input.title,
      audience: input.audience,
      focus: input.focus,
      locale: input.locale,
      slideCount: input.slideCount,
      evidenceUnits: evidence.evidenceUnits,
    });
    const routed = await executeModelRoute({
      ...routing,
      signal: providerController.signal,
      run: async (connection) => {
        const response = await requestProviderPlan({
          connection,
          instructions,
          input: modelInput,
          schema: DocumentBriefingModelOutlineSchema,
          schemaName: "document_briefing_outline",
          responseDescription: "Return Rune's evidence-bound presentation outline for local validation.",
          signal: providerController.signal,
        });
        const validated = validateDocumentBriefingModelOutline(response.output, evidence.evidenceUnits);
        if (!validated.outline || validated.errors.length) {
          const error = new Error(validated.errors[0] ?? "The model returned an invalid presentation outline.");
          error.name = "ModelOutputValidationError";
          throw error;
        }
        return { response, outline: validated.outline };
      },
    });
    const connection = routed.connection;
    return Response.json({
      provider: connection.provider,
      profileName: connection.profileName,
      model: connection.model || DEFAULT_OPENAI_MODEL,
      usage: routed.result.response.usage,
      outline: routed.result.outline,
      routing: { attempts: routed.attempts, failoverUsed: routed.failoverUsed },
    });
  } catch (error) {
    if (error instanceof Error && error.name === "ModelOutputValidationError") {
      return Response.json({ error: error.message, code: "MODEL_OUTLINE_INVALID" }, { status: 502 });
    }
    return Response.json(
      {
        error: "The model provider could not shape this presentation. Rune kept the source unchanged.",
        code: "MODEL_OUTLINE_UNAVAILABLE",
      },
      { status: 502 },
    );
  } finally {
    clearTimeout(providerTimeout);
  }
}
