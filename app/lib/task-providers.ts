import {
  prepareDocumentBriefingWorkflow,
  type DocumentBriefingInput,
  type DocumentBriefingModelOutline,
  type PreparedDocumentBriefing,
} from "./document-briefing.ts";
import {
  prepareOperatingReviewWorkflow,
  type OperatingReviewInput,
  type OperatingReviewNarrative,
  type PreparedOperatingReview,
} from "./operating-review.ts";
import type { OrbitTaskId } from "./task-runtime.ts";
import type { WorkspaceArtifact } from "./workspace.ts";

export const ORBIT_TASK_PROVIDER_IDS = {
  "operating-review": true,
  "document-briefing": true,
} as const satisfies Record<OrbitTaskId, true>;

export type OrbitTaskProviderRequest =
  | { taskId: "operating-review"; input: OperatingReviewInput; narrative?: OperatingReviewNarrative }
  | { taskId: "document-briefing"; input: DocumentBriefingInput; outline?: DocumentBriefingModelOutline };

export type PreparedOrbitTaskProvider = PreparedOperatingReview | PreparedDocumentBriefing;

export function prepareOrbitTaskProvider(
  artifacts: WorkspaceArtifact[],
  request: Extract<OrbitTaskProviderRequest, { taskId: "operating-review" }>,
): PreparedOperatingReview;
export function prepareOrbitTaskProvider(
  artifacts: WorkspaceArtifact[],
  request: Extract<OrbitTaskProviderRequest, { taskId: "document-briefing" }>,
): PreparedDocumentBriefing;
export function prepareOrbitTaskProvider(
  artifacts: WorkspaceArtifact[],
  request: OrbitTaskProviderRequest,
): PreparedOrbitTaskProvider {
  switch (request.taskId) {
    case "operating-review":
      return prepareOperatingReviewWorkflow(artifacts, request.input, request.narrative);
    case "document-briefing":
      return prepareDocumentBriefingWorkflow(artifacts, request.input, request.outline);
  }
}
