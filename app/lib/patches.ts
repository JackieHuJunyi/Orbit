import { compileArtifactSource } from "./bindings.ts";
import { resolveChartModel } from "./charts.ts";
import { parseDataSource, validateArtifact, type WorkspaceArtifact } from "./workspace.ts";

export type ArtifactSourcePatch = {
  artifactId: string;
  summary: string;
  detail: string;
  nextSource: string;
};

export type PreparedWorkspacePatch = {
  nextArtifacts: WorkspaceArtifact[];
  errors: string[];
};

export type PatchDiffLine = {
  kind: "context" | "addition" | "removal";
  text: string;
};

export function validateWorkspaceArtifacts(artifacts: WorkspaceArtifact[]): string[] {
  const errors: string[] = [];
  if (!artifacts.length) return ["The workspace does not contain any artifacts."];
  const ids = new Set<string>();
  const names = new Set<string>();

  artifacts.forEach((artifact) => {
    if (ids.has(artifact.id)) errors.push(`Duplicate artifact id: ${artifact.id}`);
    if (names.has(artifact.name)) errors.push(`Duplicate artifact name: ${artifact.name}`);
    ids.add(artifact.id);
    names.add(artifact.name);
    validateArtifact(artifact).forEach((error) => errors.push(`${artifact.name}: ${error}`));
  });

  artifacts.forEach((artifact) => {
    const compiled = compileArtifactSource(artifact.source, artifacts);
    compiled.unresolved.forEach((key) => errors.push(`${artifact.name}: unresolved metric ${key}.`));
    compiled.unresolvedCharts.forEach((key) => errors.push(`${artifact.name}: unresolved chart ${key}.`));
  });

  artifacts.filter((artifact) => artifact.kind === "chart").forEach((artifact) => {
    const resolution = resolveChartModel(artifact, artifacts, parseDataSource);
    resolution.errors.forEach((error) => errors.push(`${artifact.name}: ${error}`));
  });

  return [...new Set(errors)];
}

export function createLineDiffPreview(
  before: string,
  after: string,
  maxChangedLines = 14,
): PatchDiffLine[] {
  const lineBudget = Math.max(2, maxChangedLines);
  const beforeLines = before.split("\n");
  const afterLines = after.split("\n");
  let start = 0;
  while (start < beforeLines.length
    && start < afterLines.length
    && beforeLines[start] === afterLines[start]) start += 1;

  let beforeEnd = beforeLines.length - 1;
  let afterEnd = afterLines.length - 1;
  while (beforeEnd >= start
    && afterEnd >= start
    && beforeLines[beforeEnd] === afterLines[afterEnd]) {
    beforeEnd -= 1;
    afterEnd -= 1;
  }

  const contextBefore = start > 0
    ? [{ kind: "context" as const, text: beforeLines[start - 1] }]
    : [];
  const changed: PatchDiffLine[] = [
    ...beforeLines.slice(start, beforeEnd + 1).map((text) => ({ kind: "removal" as const, text })),
    ...afterLines.slice(start, afterEnd + 1).map((text) => ({ kind: "addition" as const, text })),
  ];
  const contextAfter = afterEnd + 1 < afterLines.length
    ? [{ kind: "context" as const, text: afterLines[afterEnd + 1] }]
    : [];

  if (changed.length <= lineBudget) return [...contextBefore, ...changed, ...contextAfter];
  const leadingCount = Math.ceil(lineBudget / 2);
  const trailingCount = Math.floor(lineBudget / 2);
  return [
    ...contextBefore,
    ...changed.slice(0, leadingCount),
    { kind: "context", text: "… changed lines omitted …" },
    ...changed.slice(-trailingCount),
    ...contextAfter,
  ];
}

export function prepareWorkspacePatch(
  artifacts: WorkspaceArtifact[],
  patches: ArtifactSourcePatch[],
): PreparedWorkspacePatch {
  const errors: string[] = [];
  const patchByArtifact = new Map<string, ArtifactSourcePatch>();

  if (!patches.length) errors.push("The plan does not contain any file changes.");
  patches.forEach((patch) => {
    const artifact = artifacts.find((item) => item.id === patch.artifactId);
    if (!artifact) {
      errors.push(`Unknown artifact: ${patch.artifactId}`);
      return;
    }
    if (patchByArtifact.has(patch.artifactId)) {
      errors.push(`${artifact.name}: the plan contains duplicate patches.`);
      return;
    }
    if (patch.nextSource === artifact.source) {
      errors.push(`${artifact.name}: the proposed source is unchanged.`);
      return;
    }
    patchByArtifact.set(patch.artifactId, patch);
  });

  const nextArtifacts = artifacts.map((artifact) => {
    const source = patchByArtifact.get(artifact.id)?.nextSource;
    return source == null ? artifact : { ...artifact, source };
  });

  errors.push(...validateWorkspaceArtifacts(nextArtifacts));

  const uniqueErrors = [...new Set(errors)];
  return { nextArtifacts: uniqueErrors.length ? artifacts : nextArtifacts, errors: uniqueErrors };
}
