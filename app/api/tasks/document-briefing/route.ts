import { DEFAULT_OPENAI_MODEL } from "../../../lib/model-preference.ts";
import { resolveActiveModelConnection } from "../../../lib/model-credential-vault.ts";
import { requestProviderPlan } from "../../../lib/model-provider-adapters.ts";
import {
  DocumentBriefingModelOutlineSchema,
  DocumentBriefingModelRequestSchema,
  buildDocumentBriefingModelInput,
  buildDocumentBriefingModelInstructions,
  validateDocumentBriefingModelOutline,
} from "../../../lib/document-briefing-contract.ts";
import {
  prepareDocumentBriefingEvidence,
  type DocumentBriefingInput,
} from "../../../lib/document-briefing.ts";

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
    const response = await requestProviderPlan({
      connection,
      instructions: buildDocumentBriefingModelInstructions(evidence.evidenceUnits.length),
      input: buildDocumentBriefingModelInput({
        sourceName: evidence.source.name,
        title: input.title,
        audience: input.audience,
        focus: input.focus,
        locale: input.locale,
        slideCount: input.slideCount,
        evidenceUnits: evidence.evidenceUnits,
      }),
      schema: DocumentBriefingModelOutlineSchema,
      schemaName: "document_briefing_outline",
      responseDescription: "Return Rune's evidence-bound presentation outline for local validation.",
      signal: providerController.signal,
    });
    const validated = validateDocumentBriefingModelOutline(response.output, evidence.evidenceUnits);
    if (!validated.outline || validated.errors.length) {
      return Response.json({
        error: validated.errors[0] ?? "The model returned an invalid presentation outline.",
        code: "MODEL_OUTLINE_INVALID",
      }, { status: 502 });
    }
    return Response.json({
      provider: connection.provider,
      profileName: connection.profileName,
      model,
      usage: response.usage,
      outline: validated.outline,
    });
  } catch {
    return Response.json({
      error: "The model provider could not shape this presentation. Rune kept the source unchanged.",
      code: "MODEL_OUTLINE_UNAVAILABLE",
    }, { status: 502 });
  } finally {
    clearTimeout(providerTimeout);
  }
}
