import { sourceSelectionError } from "./source-selection.ts";
import type { WorkspaceArtifact } from "./workspace.ts";
import type { OrbitWorkspaceView } from "./workspace-layout.ts";

export const MAX_SOURCE_NAVIGATION_REFERENCE_CHARS = 200;

export type SourceNavigationRequest =
  | Readonly<{
      origin: "preview";
      artifactId: string;
      sourceRevision: string;
      start: number;
      end: number;
      label: string;
    }>
  | Readonly<{
      origin: "diagnostic";
      artifactId: string;
      sourceRevision: string;
      reference?: string;
      label: string;
    }>;

export type PreparedSourceNavigation = Readonly<{
  origin: SourceNavigationRequest["origin"];
  artifactId: string;
  sourceRevision: string;
  start: number;
  end: number;
  label: string;
  changesArtifact: boolean;
  revealsSource: boolean;
  activateSelectionAgent: boolean;
  matchedReference: boolean;
}>;

export type SourceNavigationResult = Readonly<{
  plan: PreparedSourceNavigation | null;
  error: string;
}>;

export type PreviewNavigationCandidate = Readonly<{
  sourceId?: string;
  sectionId?: string;
  primary: boolean;
}>;

function frozenResult(plan: PreparedSourceNavigation | null, error = ""): SourceNavigationResult {
  return Object.freeze({ plan, error });
}

function diagnosticRange(source: string, reference?: string) {
  if (reference && reference.length > MAX_SOURCE_NAVIGATION_REFERENCE_CHARS) {
    return {
      start: 0,
      end: 0,
      matchedReference: false,
      error: `Source navigation references are limited to ${MAX_SOURCE_NAVIGATION_REFERENCE_CHARS} characters.`,
    };
  }
  const referenceStart = reference ? source.indexOf(reference) : -1;
  if (referenceStart >= 0 && reference) {
    return {
      start: referenceStart,
      end: referenceStart + reference.length,
      matchedReference: true,
      error: "",
    };
  }
  const firstLineEnd = source.indexOf("\n");
  return {
    start: 0,
    end: firstLineEnd >= 0 ? firstLineEnd : source.length,
    matchedReference: false,
    error: "",
  };
}

/**
 * Prepares one revision-bound Source navigation without reading the DOM or
 * changing workspace, selection, view, Agent, history, or persistence state.
 */
export function prepareSourceNavigation(
  input: Readonly<{
    artifacts: readonly WorkspaceArtifact[];
    selectedArtifactId: string;
    workspaceView: OrbitWorkspaceView;
    request: SourceNavigationRequest;
  }>,
): SourceNavigationResult {
  const artifact = input.artifacts.find((candidate) => candidate.id === input.request.artifactId);
  if (!artifact) return frozenResult(null, "The source artifact is no longer in this workspace.");
  if (artifact.source !== input.request.sourceRevision) {
    return frozenResult(null, "The source navigation target no longer matches the current artifact revision.");
  }

  let start: number;
  let end: number;
  let matchedReference = false;
  if (input.request.origin === "preview") {
    start = input.request.start;
    end = input.request.end;
    const error = sourceSelectionError(artifact.source, { start, end });
    if (error) return frozenResult(null, error);
  } else {
    const range = diagnosticRange(artifact.source, input.request.reference);
    if (range.error) return frozenResult(null, range.error);
    ({ start, end, matchedReference } = range);
  }

  const plan = Object.freeze({
    origin: input.request.origin,
    artifactId: artifact.id,
    sourceRevision: artifact.source,
    start,
    end,
    label: input.request.label,
    changesArtifact: artifact.id !== input.selectedArtifactId,
    revealsSource: input.workspaceView === "preview",
    activateSelectionAgent: input.request.origin === "preview",
    matchedReference,
  });
  return frozenResult(plan);
}

/**
 * Selects which already-rendered Preview node should receive a source-driven
 * scroll. DOM collection and scroll execution remain in the Workbench.
 */
export function selectPreviewNavigationCandidate(
  target: Readonly<{ id: string; kind: string }>,
  candidates: readonly PreviewNavigationCandidate[],
) {
  const primary = candidates.findIndex((candidate) => candidate.primary && candidate.sourceId === target.id);
  if (primary >= 0) return primary;
  if (target.kind === "document-section") {
    const section = candidates.findIndex((candidate) => candidate.sectionId === target.id);
    if (section >= 0) return section;
  }
  return candidates.findIndex((candidate) => candidate.sourceId === target.id);
}
