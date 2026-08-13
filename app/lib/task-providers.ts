import {
  prepareDocumentBriefingWorkflow,
  type DocumentBriefingInput,
  type DocumentBriefingModelOutline,
  type PreparedDocumentBriefing,
} from "./document-briefing.ts";
import {
  prepareOperatingReviewWorkflow,
  type OperatingReviewInput,
  type PreparedOperatingReview,
} from "./operating-review.ts";
import type { RuneTaskId } from "./task-runtime.ts";
import type { WorkspaceArtifact } from "./workspace.ts";

export const RUNE_TASK_PROVIDER_IDS = {
  "operating-review": true,
  "document-briefing": true,
} as const satisfies Record<RuneTaskId, true>;

export type RuneTaskProviderRequest =
  | { taskId: "operating-review"; input: OperatingReviewInput }
  | { taskId: "document-briefing"; input: DocumentBriefingInput; outline?: DocumentBriefingModelOutline };

export type PreparedRuneTaskProvider = PreparedOperatingReview | PreparedDocumentBriefing;

export function prepareRuneTaskProvider(
  artifacts: WorkspaceArtifact[],
  request: RuneTaskProviderRequest,
): PreparedRuneTaskProvider {
  switch (request.taskId) {
    case "operating-review":
      return prepareOperatingReviewWorkflow(artifacts, request.input);
    case "document-briefing":
      return prepareDocumentBriefingWorkflow(artifacts, request.input, request.outline);
  }
}
