import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import {
  AgentPatchSchema,
  AgentRequestSchema,
  buildAgentInput,
  buildAgentInstructions,
} from "../../lib/agent-contract.ts";

const DEFAULT_MODEL = "gpt-5.6";

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }

  const parsed = AgentRequestSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "The artifact request is invalid." }, { status: 400 });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return Response.json(
      { error: "No model provider is configured.", code: "MODEL_UNCONFIGURED" },
      { status: 503 },
    );
  }

  const model = process.env.OPENAI_MODEL || DEFAULT_MODEL;
  const client = new OpenAI({ apiKey });

  try {
    const response = await client.responses.parse({
      model,
      store: false,
      input: [
        { role: "system", content: buildAgentInstructions(parsed.data) },
        { role: "user", content: buildAgentInput(parsed.data) },
      ],
      text: {
        format: zodTextFormat(AgentPatchSchema, "artifact_patch"),
      },
      max_output_tokens: 16_000,
    });

    if (!response.output_parsed) {
      return Response.json({ error: "The model did not return a usable patch." }, { status: 502 });
    }

    return Response.json({
      provider: "openai",
      model,
      plan: response.output_parsed,
    });
  } catch {
    return Response.json(
      { error: "The model provider could not prepare a patch. Rune kept the source unchanged." },
      { status: 502 },
    );
  }
}
