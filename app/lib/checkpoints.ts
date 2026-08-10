import type { WorkspaceArtifact } from "./workspace.ts";

export const MAX_CHECKPOINTS_PER_ARTIFACT = 24;
export const MAX_CHECKPOINT_SOURCE_CHARS = 200_000;
export const MAX_CHECKPOINT_CHARS_PER_ARTIFACT = 500_000;

export type CheckpointReason = "agent" | "manual" | "restore";

export type WorkspaceCheckpoint = {
  id: string;
  artifactId: string;
  source: string;
  label: string;
  createdAt: string;
  reason: CheckpointReason;
};

export type CheckpointMap = Record<string, WorkspaceCheckpoint[]>;

export function createCheckpoint(
  artifact: Pick<WorkspaceArtifact, "id" | "source">,
  label: string,
  reason: CheckpointReason,
  now = new Date(),
): WorkspaceCheckpoint {
  return {
    id: `${artifact.id}-${now.getTime().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    artifactId: artifact.id,
    source: artifact.source,
    label: label.trim() || "Saved checkpoint",
    createdAt: now.toISOString(),
    reason,
  };
}

export function appendCheckpoint(history: CheckpointMap, checkpoint: WorkspaceCheckpoint): CheckpointMap {
  if (!canCheckpointSource(checkpoint.source)) return history;
  const current = history[checkpoint.artifactId] ?? [];
  if (current.at(-1)?.source === checkpoint.source) return history;
  const next = [...current, checkpoint].slice(-MAX_CHECKPOINTS_PER_ARTIFACT);
  let totalChars = next.reduce((total, item) => total + item.source.length, 0);
  while (next.length > 1 && totalChars > MAX_CHECKPOINT_CHARS_PER_ARTIFACT) {
    totalChars -= next.shift()?.source.length ?? 0;
  }
  return {
    ...history,
    [checkpoint.artifactId]: next,
  };
}

export function canCheckpointSource(source: string): boolean {
  return source.length <= MAX_CHECKPOINT_SOURCE_CHARS;
}

function isReason(value: unknown): value is CheckpointReason {
  return value === "agent" || value === "manual" || value === "restore";
}

function isCheckpoint(value: unknown, artifactId: string): value is WorkspaceCheckpoint {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<WorkspaceCheckpoint>;
  return typeof candidate.id === "string"
    && candidate.artifactId === artifactId
    && typeof candidate.source === "string"
    && typeof candidate.label === "string"
    && typeof candidate.createdAt === "string"
    && !Number.isNaN(Date.parse(candidate.createdAt))
    && isReason(candidate.reason);
}

export function normalizeCheckpointMap(value: unknown): CheckpointMap {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  let normalized: CheckpointMap = {};
  Object.entries(value).forEach(([artifactId, entries]) => {
    if (!Array.isArray(entries)) return;
    entries.forEach((entry) => {
      if (isCheckpoint(entry, artifactId)) normalized = appendCheckpoint(normalized, entry);
    });
  });
  return normalized;
}
