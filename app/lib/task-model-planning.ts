import {
  prepareDocumentBriefingEvidence,
  type DocumentBriefingInput,
  type DocumentBriefingModelOutline,
} from "./document-briefing.ts";
import {
  MAX_DOCUMENT_BRIEFING_MODEL_SOURCE_CHARS,
  validateDocumentBriefingModelOutline,
} from "./document-briefing-contract.ts";
import type { OrbitModelMode } from "./model-preference.ts";
import {
  prepareOperatingReviewEvidence,
  type OperatingReviewInput,
  type OperatingReviewNarrative,
} from "./operating-review.ts";
import {
  MAX_OPERATING_REVIEW_MODEL_SOURCE_CHARS,
  validateOperatingReviewNarrative,
} from "./operating-review-contract.ts";
import type { WorkspaceArtifact } from "./workspace.ts";

export const MAX_ORBIT_TASK_MODEL_RESPONSE_BYTES = 128_000;

export type OrbitTaskModelUsage = {
  inputTokens: number | null;
  outputTokens: number | null;
};

export type OrbitTaskModelOutcome = "local" | "model" | "source-too-large" | "unavailable";

type OrbitTaskModelMetadata = {
  outcome: OrbitTaskModelOutcome;
  provider: string;
  modelLabel: string;
  usage?: OrbitTaskModelUsage;
};

export type OperatingReviewModelAssistance = OrbitTaskModelMetadata & {
  taskId: "operating-review";
  narrative?: OperatingReviewNarrative;
};

export type DocumentBriefingModelAssistance = OrbitTaskModelMetadata & {
  taskId: "document-briefing";
  outline?: DocumentBriefingModelOutline;
};

export type OrbitTaskModelRequest =
  | { taskId: "operating-review"; input: OperatingReviewInput }
  | { taskId: "document-briefing"; input: DocumentBriefingInput };

export type OrbitTaskModelFetch = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

export type OrbitTaskModelOptions = {
  mode: OrbitModelMode;
  fetcher: OrbitTaskModelFetch;
  onModelRequest?: () => void;
};

type RemoteTaskModelPayload = {
  provider?: unknown;
  profileName?: unknown;
  model?: unknown;
  usage?: { inputTokens?: unknown; outputTokens?: unknown };
  narrative?: unknown;
  outline?: unknown;
};

function nonNegativeInteger(value: unknown) {
  return Number.isInteger(value) && Number(value) >= 0 ? Number(value) : null;
}

export function normalizeOrbitTaskModelUsage(value: RemoteTaskModelPayload["usage"]): OrbitTaskModelUsage {
  return {
    inputTokens: nonNegativeInteger(value?.inputTokens),
    outputTokens: nonNegativeInteger(value?.outputTokens),
  };
}

async function readBoundedTaskModelJson(response: Response): Promise<RemoteTaskModelPayload> {
  if (!response.body) throw new Error("Orbit received an empty task-model response.");
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let received = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    received += value.byteLength;
    if (received > MAX_ORBIT_TASK_MODEL_RESPONSE_BYTES) {
      await reader.cancel();
      throw new Error("Orbit received an oversized task-model response.");
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(received);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  const parsed = JSON.parse(new TextDecoder().decode(bytes)) as unknown;
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Orbit received an invalid task-model response.");
  }
  return parsed as RemoteTaskModelPayload;
}

function metadataText(value: unknown, maximumCharacters: number) {
  if (typeof value !== "string") return "";
  const normalized = value
    .normalize("NFKC")
    .replace(/[\u0000-\u001f\u007f]+/gu, " ")
    .trim();
  return [...normalized].slice(0, maximumCharacters).join("");
}

function localAssistance<T extends OrbitTaskModelRequest["taskId"]>(
  taskId: T,
  outcome: Exclude<OrbitTaskModelOutcome, "model">,
) {
  return { taskId, outcome, provider: "local", modelLabel: "" };
}

export async function prepareOrbitTaskModelAssistance(
  artifacts: WorkspaceArtifact[],
  request: Extract<OrbitTaskModelRequest, { taskId: "operating-review" }>,
  options: OrbitTaskModelOptions,
): Promise<OperatingReviewModelAssistance>;
export async function prepareOrbitTaskModelAssistance(
  artifacts: WorkspaceArtifact[],
  request: Extract<OrbitTaskModelRequest, { taskId: "document-briefing" }>,
  options: OrbitTaskModelOptions,
): Promise<DocumentBriefingModelAssistance>;
export async function prepareOrbitTaskModelAssistance(
  artifacts: WorkspaceArtifact[],
  request: OrbitTaskModelRequest,
  options: OrbitTaskModelOptions,
): Promise<OperatingReviewModelAssistance | DocumentBriefingModelAssistance> {
  if (options.mode === "device-tools-only") return localAssistance(request.taskId, "local");

  const sourceId =
    request.taskId === "operating-review" ? request.input.dataArtifactId : request.input.sourceArtifactId;
  const sourceKind = request.taskId === "operating-review" ? "data" : "document";
  const sourceLimit =
    request.taskId === "operating-review"
      ? MAX_OPERATING_REVIEW_MODEL_SOURCE_CHARS
      : MAX_DOCUMENT_BRIEFING_MODEL_SOURCE_CHARS;
  const source = artifacts.find((artifact) => artifact.id === sourceId && artifact.kind === sourceKind);
  if (!source) return localAssistance(request.taskId, "unavailable");
  if (source.source.length > sourceLimit) return localAssistance(request.taskId, "source-too-large");

  try {
    options.onModelRequest?.();
    const response = await options.fetcher(`/api/tasks/${request.taskId}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ artifact: source, input: request.input }),
    });
    if (!response.ok) return localAssistance(request.taskId, "unavailable");
    const payload = await readBoundedTaskModelJson(response);
    const provider = metadataText(payload.provider, 40) || "model";
    const modelLabel = metadataText(payload.profileName, 120) || metadataText(payload.model, 120) || provider;
    const usage = normalizeOrbitTaskModelUsage(payload.usage);

    if (request.taskId === "operating-review") {
      const evidence = prepareOperatingReviewEvidence(artifacts, request.input);
      const validated = evidence.evidenceRows
        ? validateOperatingReviewNarrative(payload.narrative, evidence.evidenceRows)
        : { errors: evidence.errors };
      if (!validated.narrative || validated.errors.length) {
        return localAssistance(request.taskId, "unavailable");
      }
      return {
        taskId: request.taskId,
        outcome: "model",
        provider,
        modelLabel,
        usage,
        narrative: validated.narrative,
      };
    }

    const evidence = prepareDocumentBriefingEvidence(artifacts, request.input);
    const validated = evidence.evidenceUnits
      ? validateDocumentBriefingModelOutline(payload.outline, evidence.evidenceUnits)
      : { errors: evidence.errors };
    if (!validated.outline || validated.errors.length) {
      return localAssistance(request.taskId, "unavailable");
    }
    return {
      taskId: request.taskId,
      outcome: "model",
      provider,
      modelLabel,
      usage,
      outline: validated.outline,
    };
  } catch {
    return localAssistance(request.taskId, "unavailable");
  }
}
