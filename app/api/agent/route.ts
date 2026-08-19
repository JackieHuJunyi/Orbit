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
  validateCompiledSelectionPatch,
} from "../../lib/agent-operations.ts";
import { prepareWorkspaceMutation } from "../../lib/patches.ts";
import { validateArtifact } from "../../lib/workspace.ts";
import {
  buildWorkspaceDependencyGraph,
  dependencyEdgesForContext,
  selectWorkspaceAgentContext,
} from "../../lib/dependency-graph.ts";
import { findQueryMetricReferences, parseMetricBindings, queryMetricReferenceKey } from "../../lib/bindings.ts";
import { validateAgentQueryEvidenceContext } from "../../lib/agent-evidence.ts";
import { DEFAULT_OPENAI_MODEL } from "../../lib/model-preference.ts";
import { resolveModelRouting } from "../../lib/model-credential-vault.ts";
import { requestProviderPlan } from "../../lib/model-provider-adapters.ts";
import { executeModelRoute } from "../../lib/model-routing.ts";

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

  if (parsed.data.scope === "workspace") {
    const workspace = parsed.data.workspaceArtifacts ?? [];
    const dependencySignature = ({
      fromArtifactId,
      toArtifactId,
      kind,
      references,
    }: {
      fromArtifactId: string;
      toArtifactId: string;
      kind: string;
      references: string[];
    }) => JSON.stringify([fromArtifactId, toArtifactId, kind, references]);
    const graph = buildWorkspaceDependencyGraph(workspace);
    if (graph.issues.length) {
      return Response.json({ error: "The workspace dependency context is incomplete or invalid." }, { status: 400 });
    }
    const expectedContext = selectWorkspaceAgentContext(workspace, graph, parsed.data.artifact.id, {
      pinnedArtifactIds: parsed.data.workspacePinnedArtifactIds ?? [],
    });
    if (
      expectedContext.length !== workspace.length ||
      expectedContext.some((artifact, index) => artifact.id !== workspace[index]?.id)
    ) {
      return Response.json(
        { error: "The workspace context contains an unpinned disconnected artifact." },
        { status: 400 },
      );
    }
    const expected = dependencyEdgesForContext(graph, workspace).map(dependencySignature).sort();
    const supplied = (parsed.data.workspaceDependencies ?? []).map(dependencySignature).sort();
    if (expected.length !== supplied.length || expected.some((edge, index) => edge !== supplied[index])) {
      return Response.json({ error: "The workspace dependency context is stale or invalid." }, { status: 400 });
    }
  }

  const routing = await resolveModelRouting(request);
  if (!routing.connections.length) {
    return Response.json({ error: "No model provider is configured.", code: "MODEL_UNCONFIGURED" }, { status: 503 });
  }

  if (parsed.data.scope === "workspace") {
    const workspace = parsed.data.workspaceArtifacts ?? [];
    const queryArtifactIds = workspace.filter((artifact) => artifact.kind === "query").map((artifact) => artifact.id);
    if (queryArtifactIds.length && parsed.data.queryEvidence === undefined) {
      return Response.json(
        {
          error: "Current Query results are required before the model can plan this workspace change.",
          code: "QUERY_EVIDENCE_REQUIRED",
          queryArtifactIds,
        },
        { status: 428 },
      );
    }
    if (parsed.data.queryEvidence !== undefined) {
      const evidenceErrors = validateAgentQueryEvidenceContext(workspace, parsed.data.queryEvidence);
      if (evidenceErrors.length) {
        return Response.json(
          {
            error: "The Query evidence context is stale or invalid.",
            code: "QUERY_EVIDENCE_INVALID",
            details: evidenceErrors.slice(0, 3),
          },
          { status: 400 },
        );
      }
    }
  }

  try {
    const workspaceScope = parsed.data.scope === "workspace";
    const providerController = new AbortController();
    const providerTimeout = setTimeout(() => providerController.abort(), 60_000);
    let routed;
    try {
      const schema = workspaceScope ? AgentWorkspaceOperationPlanSchema : AgentOperationPatchSchema;
      routed = await executeModelRoute({
        ...routing,
        signal: providerController.signal,
        run: async (connection) => {
          const response = await requestProviderPlan({
            connection,
            instructions: buildAgentInstructions(parsed.data),
            input: buildAgentInput(parsed.data),
            schema,
            schemaName: workspaceScope ? "workspace_operations" : "artifact_operations",
            responseDescription: "Return Rune's proposed typed source-operation plan for local validation.",
            signal: providerController.signal,
          });
          if (!schema.safeParse(response.output).success)
            throw new Error("The model returned an invalid operation plan.");
          return response;
        },
      });
    } finally {
      clearTimeout(providerTimeout);
    }
    const response = routed.result;
    const connection = routed.connection;
    const model = connection.model || DEFAULT_OPENAI_MODEL;

    if (!response.output) {
      return Response.json({ error: "The model did not return a usable patch." }, { status: 502 });
    }

    if (workspaceScope) {
      const operationPlan = AgentWorkspaceOperationPlanSchema.safeParse(response.output);
      if (!operationPlan.success) {
        return Response.json({ error: "The model returned an invalid workspace operation plan." }, { status: 502 });
      }
      const allowedIds = new Set(parsed.data.workspaceArtifacts?.map((artifact) => artifact.id));
      const patchIds = operationPlan.data.actions.flatMap((action) =>
        action.type === "patch_artifact" ? [action.artifactId] : [],
      );
      if (new Set(patchIds).size !== patchIds.length || patchIds.some((id) => !allowedIds.has(id))) {
        return Response.json({ error: "The model returned an invalid workspace operation plan." }, { status: 502 });
      }
      const compiled = compileAgentWorkspaceOperations(parsed.data.workspaceArtifacts ?? [], operationPlan.data);
      if (!compiled.plan || compiled.errors.length) {
        return Response.json(
          {
            error: "The model returned source operations that do not match the current workspace revision.",
            details: compiled.errors.slice(0, 3),
          },
          { status: 502 },
        );
      }
      const workspacePlan = AgentCompiledWorkspacePatchSchema.safeParse(compiled.plan);
      if (!workspacePlan.success) {
        return Response.json({ error: "The model returned an invalid compiled workspace patch." }, { status: 502 });
      }
      const prepared = prepareWorkspaceMutation(
        parsed.data.workspaceArtifacts ?? [],
        workspacePlan.data.patches,
        workspacePlan.data.creations,
      );
      if (prepared.errors.length) {
        return Response.json(
          {
            error: "The compiled model operations did not pass Rune's workspace safety gate.",
            details: prepared.errors.slice(0, 3),
          },
          { status: 502 },
        );
      }
      return Response.json({
        provider: connection.provider,
        profileName: connection.profileName,
        model,
        repairAttempt: parsed.data.runtimeRepair?.attempt,
        usage: response.usage,
        routing: { attempts: routed.attempts, failoverUsed: routed.failoverUsed },
        plan: workspacePlan.data,
      });
    }

    const operationPlan = AgentOperationPatchSchema.safeParse(response.output);
    if (!operationPlan.success) {
      return Response.json({ error: "The model returned an invalid artifact operation plan." }, { status: 502 });
    }
    const compiled = compileAgentOperationPatch(parsed.data.artifact, operationPlan.data);
    if (!compiled.plan || compiled.errors.length) {
      return Response.json(
        {
          error: "The model returned source operations that do not match the current artifact revision.",
          details: compiled.errors.slice(0, 3),
        },
        { status: 502 },
      );
    }
    const artifactPlan = AgentCompiledPatchSchema.safeParse(compiled.plan);
    if (!artifactPlan.success) {
      return Response.json({ error: "The model returned an invalid compiled artifact patch." }, { status: 502 });
    }
    const metricBindingErrors = parseMetricBindings(artifactPlan.data.nextSource).errors;
    if (metricBindingErrors.length) {
      return Response.json(
        {
          error: "The compiled model operations produced an invalid metric binding.",
          details: metricBindingErrors.slice(0, 3),
        },
        { status: 502 },
      );
    }
    const originalQueryMetrics = findQueryMetricReferences(parsed.data.artifact.source)
      .map(queryMetricReferenceKey)
      .sort();
    const nextQueryMetrics = findQueryMetricReferences(artifactPlan.data.nextSource)
      .map(queryMetricReferenceKey)
      .sort();
    if (
      originalQueryMetrics.length !== nextQueryMetrics.length ||
      originalQueryMetrics.some((reference, index) => reference !== nextQueryMetrics[index])
    ) {
      return Response.json(
        {
          error: "Cross-file Query metric bindings can be introduced or retargeted only in Workspace scope.",
        },
        { status: 502 },
      );
    }
    if (parsed.data.scope === "selection" && parsed.data.selection) {
      const selectionErrors = validateCompiledSelectionPatch(
        parsed.data.artifact,
        parsed.data.selection,
        artifactPlan.data.nextSource,
      );
      if (selectionErrors.length) {
        return Response.json(
          {
            error: "The compiled model operations crossed the selected source range.",
            details: selectionErrors,
          },
          { status: 502 },
        );
      }
    }
    const validationErrors = validateArtifact({
      ...parsed.data.artifact,
      source: artifactPlan.data.nextSource,
    });
    if (validationErrors.length) {
      return Response.json(
        {
          error: "The compiled model operations did not pass Rune's artifact safety gate.",
          details: validationErrors.slice(0, 3),
        },
        { status: 502 },
      );
    }
    return Response.json({
      provider: connection.provider,
      profileName: connection.profileName,
      model,
      repairAttempt: parsed.data.runtimeRepair?.attempt,
      usage: response.usage,
      routing: { attempts: routed.attempts, failoverUsed: routed.failoverUsed },
      plan: artifactPlan.data,
    });
  } catch {
    return Response.json(
      { error: "The model provider could not prepare a patch. Rune kept the source unchanged." },
      { status: 502 },
    );
  }
}
