import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import {
  AgentPatchSchema,
  AgentRequestSchema,
  AgentWorkspacePatchSchema,
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
    const workspaceScope = parsed.data.scope === "workspace";
    const response = await client.responses.parse({
      model,
      store: false,
      input: [
        { role: "system", content: buildAgentInstructions(parsed.data) },
        { role: "user", content: buildAgentInput(parsed.data) },
      ],
      text: {
        format: workspaceScope
          ? zodTextFormat(AgentWorkspacePatchSchema, "workspace_patch")
          : zodTextFormat(AgentPatchSchema, "artifact_patch"),
      },
      max_output_tokens: 16_000,
    });

    if (!response.output_parsed) {
      return Response.json({ error: "The model did not return a usable patch." }, { status: 502 });
    }

    if (workspaceScope) {
      const workspacePlan = AgentWorkspacePatchSchema.safeParse(response.output_parsed);
      if (!workspacePlan.success) {
        return Response.json({ error: "The model returned an invalid workspace patch." }, { status: 502 });
      }
      const allowedIds = new Set(parsed.data.workspaceArtifacts?.map((artifact) => artifact.id));
      const patchIds = workspacePlan.data.patches.map((patch) => patch.artifactId);
      if (new Set(patchIds).size !== patchIds.length || patchIds.some((id) => !allowedIds.has(id))) {
        return Response.json({ error: "The model returned an invalid workspace patch." }, { status: 502 });
      }
      return Response.json({ provider: "openai", model, plan: workspacePlan.data });
    }

    const artifactPlan = AgentPatchSchema.safeParse(response.output_parsed);
    if (!artifactPlan.success) {
      return Response.json({ error: "The model returned an invalid artifact patch." }, { status: 502 });
    }
    return Response.json({
      provider: "openai",
      model,
      plan: artifactPlan.data,
    });
  } catch {
    return Response.json(
      { error: "The model provider could not prepare a patch. Rune kept the source unchanged." },
      { status: 502 },
    );
  }
}
