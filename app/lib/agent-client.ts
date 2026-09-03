import type { AgentRuntimeRepair } from "./agent-repair";
import type { ArtifactCreationChange, ArtifactSourcePatch } from "./patches";
import type { WorkspaceArtifact } from "./workspace";

export type RemoteFilePlan = ArtifactSourcePatch & { operationCount: number };
export type RemoteSinglePlan = Omit<RemoteFilePlan, "artifactId">;
export type RemoteCreationPlan = ArtifactCreationChange & { operationCount: number };
export type RemoteWorkspacePlan = {
  summary: string;
  detail: string;
  patches: RemoteFilePlan[];
  creations: RemoteCreationPlan[];
};

export type RemoteAgentResponse = {
  answer?: string;
  message?: string;
  error?: string;
  code?: string;
  provider?: string;
  model?: string;
  profileName?: string;
  plan?: unknown;
  queryArtifactIds?: string[];
  repairAttempt?: number;
  usage?: { inputTokens?: unknown; outputTokens?: unknown };
};

export type RemoteAgentRequestBody = {
  scope: "selection" | "artifact" | "workspace";
  artifact: WorkspaceArtifact;
  selection?: { start: number; end: number } | null;
  workspaceArtifacts?: WorkspaceArtifact[];
  workspaceDependencies?: Array<{
    fromArtifactId: string;
    toArtifactId: string;
    kind: string;
    references: string[];
  }>;
  workspacePinnedArtifactIds?: string[];
  conversation: Array<{ role: "user" | "assistant"; content: string }>;
  prompt: string;
  metrics: Record<string, string>;
  queryEvidence?: unknown;
  runtimeRepair?: AgentRuntimeRepair;
};

export function normalizeRemoteAgentUsage(value: RemoteAgentResponse["usage"]) {
  const token = (candidate: unknown) =>
    Number.isInteger(candidate) && Number(candidate) >= 0 ? Number(candidate) : null;
  return { inputTokens: token(value?.inputTokens), outputTokens: token(value?.outputTokens) };
}

function isRemoteSinglePlan(value: unknown): value is RemoteSinglePlan {
  return Boolean(
    value &&
    typeof value === "object" &&
    typeof (value as RemoteSinglePlan).nextSource === "string" &&
    typeof (value as RemoteSinglePlan).summary === "string" &&
    typeof (value as RemoteSinglePlan).detail === "string" &&
    Number.isInteger((value as RemoteSinglePlan).operationCount) &&
    (value as RemoteSinglePlan).operationCount > 0,
  );
}

function isRemoteWorkspacePlan(value: unknown): value is RemoteWorkspacePlan {
  if (!value || typeof value !== "object") return false;
  const plan = value as RemoteWorkspacePlan;
  const patchesValid =
    Array.isArray(plan.patches) &&
    plan.patches.every(
      (patch) =>
        typeof patch.artifactId === "string" &&
        typeof patch.nextSource === "string" &&
        typeof patch.summary === "string" &&
        typeof patch.detail === "string" &&
        Number.isInteger(patch.operationCount) &&
        patch.operationCount > 0,
    );
  const creationsValid =
    Array.isArray(plan.creations) &&
    plan.creations.every(
      (creation) =>
        Boolean(creation.artifact) &&
        typeof creation.artifact.id === "string" &&
        typeof creation.artifact.name === "string" &&
        ["document", "data", "query", "chart", "slides"].includes(creation.artifact.kind) &&
        typeof creation.artifact.language === "string" &&
        typeof creation.artifact.source === "string" &&
        typeof creation.summary === "string" &&
        typeof creation.detail === "string" &&
        Number.isInteger(creation.operationCount) &&
        creation.operationCount >= 0 &&
        creation.operationCount <= 8,
    );
  const actionCount = (plan.patches?.length ?? 0) + (plan.creations?.length ?? 0);
  return (
    typeof plan.summary === "string" &&
    typeof plan.detail === "string" &&
    patchesValid &&
    creationsValid &&
    actionCount > 0 &&
    actionCount <= 4
  );
}

export function normalizeRemoteAgentPlan(
  scope: RemoteAgentRequestBody["scope"],
  targetArtifactId: string,
  candidate: unknown,
): RemoteWorkspacePlan | null {
  if (scope === "workspace" && isRemoteWorkspacePlan(candidate)) return candidate;
  if (scope !== "workspace" && isRemoteSinglePlan(candidate)) {
    return {
      summary: candidate.summary,
      detail: candidate.detail,
      patches: [{ artifactId: targetArtifactId, ...candidate }],
      creations: [],
    };
  }
  return null;
}

export async function postAgentRequest(body: RemoteAgentRequestBody, fetcher: typeof fetch = fetch) {
  const response = await fetcher("/api/agent", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const payload = (await response.json().catch(() => ({}))) as RemoteAgentResponse;
  return { response, payload };
}

export async function requestRemoteAgentTurn({
  body,
  workspaceArtifacts,
  collectQueryEvidence,
  onQueryEvidenceRequested,
  fetcher = fetch,
}: {
  body: RemoteAgentRequestBody;
  workspaceArtifacts: WorkspaceArtifact[];
  collectQueryEvidence: (artifacts: WorkspaceArtifact[]) => Promise<unknown>;
  onQueryEvidenceRequested?: (count: number) => void;
  fetcher?: typeof fetch;
}) {
  let requestBody = body;
  let { response, payload } = await postAgentRequest(requestBody, fetcher);
  let queryEvidenceCount = 0;
  if (body.scope === "workspace" && response.status === 428 && payload.code === "QUERY_EVIDENCE_REQUIRED") {
    const expectedQueryIds = workspaceArtifacts
      .filter((artifact) => artifact.kind === "query")
      .map((artifact) => artifact.id);
    if (
      !payload.queryArtifactIds ||
      payload.queryArtifactIds.length !== expectedQueryIds.length ||
      payload.queryArtifactIds.some((artifactId, index) => artifactId !== expectedQueryIds[index])
    ) {
      throw new Error("The model provider requested stale Query evidence.");
    }
    onQueryEvidenceRequested?.(expectedQueryIds.length);
    const queryEvidence = await collectQueryEvidence(workspaceArtifacts);
    queryEvidenceCount = Array.isArray(queryEvidence) ? queryEvidence.length : 0;
    requestBody = { ...body, queryEvidence };
    ({ response, payload } = await postAgentRequest(requestBody, fetcher));
  }
  return { response, payload, requestBody, queryEvidenceCount };
}
