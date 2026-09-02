import type { ArtifactExportKind } from "./export-contract.ts";

export const MAX_OPERATING_REVIEW_DELIVERIES = 12;
export const MAX_OPERATING_REVIEW_DELIVERY_MS = 365 * 24 * 60 * 60 * 1_000;

export type OperatingReviewDeliveryRating = "ready" | "minor-edits" | "not-ready";
export type OperatingReviewDeliveryMethod = "download" | "folder";
export type OperatingReviewDeliveryTarget = ArtifactExportKind | "md" | "deck-md" | "folder";

export type OperatingReviewDeliveryOutcome = {
  version: 1;
  id: string;
  confirmedAt: string;
  runId: string;
  artifactId: string;
  method: OperatingReviewDeliveryMethod;
  target: OperatingReviewDeliveryTarget;
  rating: OperatingReviewDeliveryRating;
  sourceSha256: string;
  taskDurationMs: number;
};

export type OperatingReviewDeliveryContext = {
  appliedRunIds: readonly string[];
  deliverableArtifactIds: readonly string[];
};

export type OperatingReviewDeliveryRun = {
  id: string;
  completedAt: string;
  durationMs: number;
  status: "applied" | "stopped";
};

const DOWNLOAD_TARGETS = new Set<OperatingReviewDeliveryTarget>([
  "csv",
  "json",
  "doc",
  "ppt",
  "docx",
  "xlsx",
  "pptx",
  "odt",
  "ods",
  "odp",
  "html",
  "pdf",
  "md",
  "deck-md",
]);
const RATINGS = new Set<OperatingReviewDeliveryRating>(["ready", "minor-edits", "not-ready"]);
const SHA256 = /^[0-9a-f]{64}$/u;

export function operatingReviewDeliveryId(runId: string, artifactId: string) {
  return `delivery:${runId}:${artifactId}`;
}

function boundedString(value: unknown, max: number) {
  return typeof value === "string" && value.length > 0 && value.length <= max ? value : undefined;
}

function boundedInteger(value: unknown, max: number) {
  return Number.isInteger(value) && Number(value) >= 0 && Number(value) <= max ? Number(value) : undefined;
}

export async function sourceSha256(source: string) {
  if (!globalThis.crypto?.subtle) throw new Error("This browser cannot create a local delivery revision proof.");
  const bytes = new TextEncoder().encode(source);
  const digest = await globalThis.crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((value) => value.toString(16).padStart(2, "0")).join("");
}

export function normalizeOperatingReviewDeliveryOutcomes(
  value: unknown,
  context: OperatingReviewDeliveryContext,
): OperatingReviewDeliveryOutcome[] {
  if (!Array.isArray(value)) return [];
  const appliedRunIds = new Set(context.appliedRunIds);
  const deliverableArtifactIds = new Set(context.deliverableArtifactIds);
  const outcomes: OperatingReviewDeliveryOutcome[] = [];
  const ids = new Set<string>();
  for (const entry of value.slice(0, MAX_OPERATING_REVIEW_DELIVERIES * 2)) {
    if (!entry || typeof entry !== "object") continue;
    const candidate = entry as Partial<OperatingReviewDeliveryOutcome>;
    const runId = boundedString(candidate.runId, 240);
    const artifactId = boundedString(candidate.artifactId, 120);
    const id = boundedString(candidate.id, 380);
    const confirmedAt = boundedString(candidate.confirmedAt, 40);
    const method = candidate.method === "download" || candidate.method === "folder" ? candidate.method : undefined;
    const target =
      typeof candidate.target === "string" ? (candidate.target as OperatingReviewDeliveryTarget) : undefined;
    const rating =
      typeof candidate.rating === "string" ? (candidate.rating as OperatingReviewDeliveryRating) : undefined;
    const taskDurationMs = boundedInteger(candidate.taskDurationMs, MAX_OPERATING_REVIEW_DELIVERY_MS);
    const targetMatchesMethod =
      method === "folder"
        ? target === "folder"
        : method === "download" && DOWNLOAD_TARGETS.has(target as OperatingReviewDeliveryTarget);
    if (
      candidate.version !== 1 ||
      !id ||
      ids.has(id) ||
      !runId ||
      !artifactId ||
      !confirmedAt ||
      !appliedRunIds.has(runId) ||
      !deliverableArtifactIds.has(artifactId) ||
      id !== operatingReviewDeliveryId(runId, artifactId) ||
      Number.isNaN(Date.parse(confirmedAt)) ||
      !method ||
      !target ||
      !targetMatchesMethod ||
      !rating ||
      !RATINGS.has(rating) ||
      !SHA256.test(candidate.sourceSha256 ?? "") ||
      taskDurationMs == null
    )
      continue;
    ids.add(id);
    outcomes.push({
      version: 1,
      id,
      confirmedAt: new Date(confirmedAt).toISOString(),
      runId,
      artifactId,
      method,
      target,
      rating,
      sourceSha256: candidate.sourceSha256 as string,
      taskDurationMs,
    });
    if (outcomes.length >= MAX_OPERATING_REVIEW_DELIVERIES) break;
  }
  return outcomes.sort((left, right) => right.confirmedAt.localeCompare(left.confirmedAt));
}

export async function createOperatingReviewDeliveryOutcome(input: {
  run: OperatingReviewDeliveryRun;
  artifactId: string;
  source: string;
  method: OperatingReviewDeliveryMethod;
  target: OperatingReviewDeliveryTarget;
  rating: OperatingReviewDeliveryRating;
  now?: Date;
}) {
  if (input.run.status !== "applied") throw new Error("Only an applied task run can become a confirmed deliverable.");
  const confirmedAt = input.now ?? new Date();
  const completedAt = Date.parse(input.run.completedAt);
  if (Number.isNaN(completedAt) || Number.isNaN(confirmedAt.getTime()))
    throw new Error("The task run has no valid completion time.");
  const delay = Math.max(0, confirmedAt.getTime() - completedAt);
  const taskDurationMs = input.run.durationMs + delay;
  const [outcome] = normalizeOperatingReviewDeliveryOutcomes(
    [
      {
        version: 1,
        id: operatingReviewDeliveryId(input.run.id, input.artifactId),
        confirmedAt: confirmedAt.toISOString(),
        runId: input.run.id,
        artifactId: input.artifactId,
        method: input.method,
        target: input.target,
        rating: input.rating,
        sourceSha256: await sourceSha256(input.source),
        taskDurationMs,
      },
    ],
    {
      appliedRunIds: [input.run.id],
      deliverableArtifactIds: [input.artifactId],
    },
  );
  if (!outcome) throw new Error("The delivery confirmation is outside Orbit's bounded device record.");
  return outcome;
}

export function appendOperatingReviewDeliveryOutcome(
  outcomes: OperatingReviewDeliveryOutcome[],
  outcome: OperatingReviewDeliveryOutcome,
  context: OperatingReviewDeliveryContext,
) {
  return normalizeOperatingReviewDeliveryOutcomes([outcome, ...outcomes], context);
}

export function summarizeOperatingReviewDeliveryOutcomes(outcomes: OperatingReviewDeliveryOutcome[]) {
  const usable = outcomes.filter((outcome) => outcome.rating === "ready" || outcome.rating === "minor-edits");
  return {
    total: outcomes.length,
    ready: outcomes.filter((outcome) => outcome.rating === "ready").length,
    minorEdits: outcomes.filter((outcome) => outcome.rating === "minor-edits").length,
    notReady: outcomes.length - usable.length,
    usable: usable.length,
    usableRate: outcomes.length ? Math.round((usable.length / outcomes.length) * 100) : null,
    averageTaskDurationMs: outcomes.length
      ? Math.round(outcomes.reduce((total, outcome) => total + outcome.taskDurationMs, 0) / outcomes.length)
      : null,
  };
}
