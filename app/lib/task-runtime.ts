import { validateWorkspaceImportReview, type WorkspaceImportReview } from "./imports.ts";
import {
  captureWorkspaceSourceRevision,
  workspaceMatchesSourceRevision,
  type WorkspaceSourceRevision,
} from "./patches.ts";
import type { ArtifactKind, WorkspaceArtifact } from "./workspace.ts";

export type RuneTaskId = "operating-review" | "document-briefing";
export type RuneTaskPhase = "awaiting-source" | "reviewing-source" | "configuring";

export type RuneTaskDefinition = {
  id: RuneTaskId;
  sourceAccept: string;
  acceptedArtifactKinds: readonly ArtifactKind[];
  requiredArtifactLabel: string;
};

export const RUNE_TASK_DEFINITIONS = {
  "operating-review": {
    id: "operating-review",
    sourceAccept: ".csv,.json,.xlsx,.ods",
    acceptedArtifactKinds: ["data"],
    requiredArtifactLabel: "readable Data source",
  },
  "document-briefing": {
    id: "document-briefing",
    sourceAccept: ".doc,.docx,.odt,.pdf,.md,.markdown",
    acceptedArtifactKinds: ["document"],
    requiredArtifactLabel: "readable Document source",
  },
} as const satisfies Record<RuneTaskId, RuneTaskDefinition>;

export type RuneTaskSession = {
  taskId: RuneTaskId;
  phase: RuneTaskPhase;
  baseRevision: WorkspaceSourceRevision;
  importedArtifactIds: string[];
  preferredArtifactId: string | null;
};

export type PreparedRuneTaskSession = {
  session: RuneTaskSession | null;
  preferredArtifactId: string | null;
  errors: string[];
};

function failed(errors: string[]): PreparedRuneTaskSession {
  return { session: null, preferredArtifactId: null, errors };
}

export function startRuneTaskSession(taskId: RuneTaskId, artifacts: WorkspaceArtifact[]): RuneTaskSession {
  return {
    taskId,
    phase: "awaiting-source",
    baseRevision: captureWorkspaceSourceRevision(artifacts),
    importedArtifactIds: [],
    preferredArtifactId: null,
  };
}

export function startRuneTaskFromArtifact(
  taskId: RuneTaskId,
  artifacts: WorkspaceArtifact[],
  artifactId: string,
): PreparedRuneTaskSession {
  const artifact = artifacts.find((item) => item.id === artifactId);
  const definition = RUNE_TASK_DEFINITIONS[taskId];
  if (!artifact) return failed([`Task source is missing: ${artifactId}`]);
  if (!definition.acceptedArtifactKinds.some((kind) => kind === artifact.kind)) {
    return failed([`${artifact.name} is not a supported source for this task.`]);
  }
  return {
    session: {
      taskId,
      phase: "configuring",
      baseRevision: captureWorkspaceSourceRevision(artifacts),
      importedArtifactIds: [],
      preferredArtifactId: artifact.id,
    },
    preferredArtifactId: artifact.id,
    errors: [],
  };
}

export function bindRuneTaskImportReview(
  session: RuneTaskSession,
  artifacts: WorkspaceArtifact[],
  review: WorkspaceImportReview,
): PreparedRuneTaskSession {
  if (session.phase !== "awaiting-source") {
    return failed(["This task is no longer waiting for a source import."]);
  }
  if (!workspaceMatchesSourceRevision(artifacts, session.baseRevision)) {
    return failed(["The workspace changed after this task started. Choose the source again."]);
  }
  const reviewErrors = validateWorkspaceImportReview(artifacts, review);
  if (reviewErrors.length) return failed(reviewErrors);

  const definition = RUNE_TASK_DEFINITIONS[session.taskId];
  const incompatible = review.importedArtifacts.find(
    (artifact) => !definition.acceptedArtifactKinds.some((kind) => kind === artifact.kind),
  );
  if (incompatible) {
    return failed([`${incompatible.name} is not a supported source for this task.`]);
  }
  const preferredArtifact = review.importedArtifacts.find((artifact) =>
    definition.acceptedArtifactKinds.some((kind) => kind === artifact.kind),
  );
  if (!preferredArtifact) {
    return failed([`This task needs at least one ${definition.requiredArtifactLabel}.`]);
  }

  return {
    session: {
      ...session,
      phase: "reviewing-source",
      importedArtifactIds: review.importedArtifacts.map((artifact) => artifact.id),
      preferredArtifactId: preferredArtifact.id,
    },
    preferredArtifactId: preferredArtifact.id,
    errors: [],
  };
}

export function prepareRuneTaskAfterImport(
  session: RuneTaskSession,
  artifacts: WorkspaceArtifact[],
  review: WorkspaceImportReview,
): PreparedRuneTaskSession {
  if (session.phase !== "reviewing-source" || !session.preferredArtifactId) {
    return failed(["This task does not have a reviewed source to continue from."]);
  }
  if (!workspaceMatchesSourceRevision(artifacts, session.baseRevision)) {
    return failed(["The workspace changed while this task source was under review."]);
  }
  const reviewErrors = validateWorkspaceImportReview(artifacts, review);
  if (reviewErrors.length) return failed(reviewErrors);
  const importedArtifactIds = review.importedArtifacts.map((artifact) => artifact.id);
  if (
    importedArtifactIds.length !== session.importedArtifactIds.length ||
    importedArtifactIds.some((id, index) => id !== session.importedArtifactIds[index])
  ) {
    return failed(["The reviewed task sources no longer match this import session."]);
  }
  const preferredArtifact = review.importedArtifacts.find((artifact) => artifact.id === session.preferredArtifactId);
  const definition = RUNE_TASK_DEFINITIONS[session.taskId];
  if (!preferredArtifact || !definition.acceptedArtifactKinds.some((kind) => kind === preferredArtifact.kind)) {
    return failed([`The preferred ${definition.requiredArtifactLabel} is no longer part of this reviewed import.`]);
  }

  return {
    session: {
      ...session,
      phase: "configuring",
      baseRevision: captureWorkspaceSourceRevision(review.nextArtifacts),
    },
    preferredArtifactId: preferredArtifact.id,
    errors: [],
  };
}
