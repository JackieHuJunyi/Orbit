import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import {
  AgentCompiledPatchSchema,
  AgentCompiledWorkspacePatchSchema,
  AgentOperationPatchSchema,
  AgentRequestSchema,
  AgentWorkspaceOperationPlanSchema,
  buildAgentInput,
  buildAgentInstructions,
} from "../../lib/agent-contract.ts";
import {
  compileAgentOperationPatch,
  compileAgentWorkspaceOperations,
} from "../../lib/agent-operations.ts";
import { prepareWorkspacePatch } from "../../lib/patches.ts";
import { validateArtifact } from "../../lib/workspace.ts";

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
          ? zodTextFormat(AgentWorkspaceOperationPlanSchema, "workspace_operations")
          : zodTextFormat(AgentOperationPatchSchema, "artifact_operations"),
      },
      max_output_tokens: 8_000,
    });

    if (!response.output_parsed) {
      return Response.json({ error: "The model did not return a usable patch." }, { status: 502 });
    }

    if (workspaceScope) {
      const operationPlan = AgentWorkspaceOperationPlanSchema.safeParse(response.output_parsed);
      if (!operationPlan.success) {
        return Response.json({ error: "The model returned an invalid workspace operation plan." }, { status: 502 });
      }
      const allowedIds = new Set(parsed.data.workspaceArtifacts?.map((artifact) => artifact.id));
      const patchIds = operationPlan.data.patches.map((patch) => patch.artifactId);
      if (new Set(patchIds).size !== patchIds.length || patchIds.some((id) => !allowedIds.has(id))) {
        return Response.json({ error: "The model returned an invalid workspace operation plan." }, { status: 502 });
      }
      const compiled = compileAgentWorkspaceOperations(parsed.data.workspaceArtifacts ?? [], operationPlan.data);
      if (!compiled.plan || compiled.errors.length) {
        return Response.json({
          error: "The model returned source operations that do not match the current workspace revision.",
          details: compiled.errors.slice(0, 3),
        }, { status: 502 });
      }
      const workspacePlan = AgentCompiledWorkspacePatchSchema.safeParse(compiled.plan);
      if (!workspacePlan.success) {
        return Response.json({ error: "The model returned an invalid compiled workspace patch." }, { status: 502 });
      }
      const prepared = prepareWorkspacePatch(parsed.data.workspaceArtifacts ?? [], workspacePlan.data.patches);
      if (prepared.errors.length) {
        return Response.json({
          error: "The compiled model operations did not pass Rune's workspace safety gate.",
          details: prepared.errors.slice(0, 3),
        }, { status: 502 });
      }
      return Response.json({ provider: "openai", model, plan: workspacePlan.data });
    }

    const operationPlan = AgentOperationPatchSchema.safeParse(response.output_parsed);
    if (!operationPlan.success) {
      return Response.json({ error: "The model returned an invalid artifact operation plan." }, { status: 502 });
    }
    const compiled = compileAgentOperationPatch(parsed.data.artifact, operationPlan.data);
    if (!compiled.plan || compiled.errors.length) {
      return Response.json({
        error: "The model returned source operations that do not match the current artifact revision.",
        details: compiled.errors.slice(0, 3),
      }, { status: 502 });
    }
    const artifactPlan = AgentCompiledPatchSchema.safeParse(compiled.plan);
    if (!artifactPlan.success) {
      return Response.json({ error: "The model returned an invalid compiled artifact patch." }, { status: 502 });
    }
    const validationErrors = validateArtifact({
      ...parsed.data.artifact,
      source: artifactPlan.data.nextSource,
    });
    if (validationErrors.length) {
      return Response.json({
        error: "The compiled model operations did not pass Rune's artifact safety gate.",
        details: validationErrors.slice(0, 3),
      }, { status: 502 });
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
