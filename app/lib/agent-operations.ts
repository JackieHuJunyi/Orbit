import {
  AgentCompiledPatchSchema,
  AgentCompiledWorkspacePatchSchema,
  type AgentCompiledPatch,
  type AgentCompiledWorkspacePatch,
  type AgentOperationPatch,
  type AgentSourceOperation,
  type AgentWorkspaceOperationPlan,
} from "./agent-contract.ts";

export const MAX_COMPILED_AGENT_SOURCE_CHARS = 120_000;

type SourceOperationCompilation = {
  nextSource: string;
  errors: string[];
};

type PlanCompilation<Plan> = {
  plan?: Plan;
  errors: string[];
};

function exactMatch(source: string, find: string) {
  const first = source.indexOf(find);
  if (first < 0) return { count: 0, index: -1 };
  const second = source.indexOf(find, first + 1);
  return { count: second < 0 ? 1 : 2, index: first };
}

export function applyAgentSourceOperations(
  source: string,
  edits: AgentSourceOperation[],
): SourceOperationCompilation {
  if (!edits.length) return { nextSource: source, errors: ["The plan does not contain any source operations."] };
  let nextSource = source;

  for (let index = 0; index < edits.length; index += 1) {
    const edit = edits[index];
    const label = `Operation ${index + 1}`;
    if (!edit.find) return { nextSource: source, errors: [`${label} needs a non-empty exact anchor.`] };
    if (edit.find === edit.replace) return { nextSource: source, errors: [`${label} does not change its exact anchor.`] };
    const match = exactMatch(nextSource, edit.find);
    if (match.count === 0) {
      return { nextSource: source, errors: [`${label} does not match the current source revision.`] };
    }
    if (match.count > 1) {
      return { nextSource: source, errors: [`${label} is ambiguous in the current source revision.`] };
    }
    nextSource = `${nextSource.slice(0, match.index)}${edit.replace}${nextSource.slice(match.index + edit.find.length)}`;
    if (nextSource.length > MAX_COMPILED_AGENT_SOURCE_CHARS) {
      return { nextSource: source, errors: [`${label} would exceed Rune's 120,000-character Agent output limit.`] };
    }
  }

  if (nextSource === source) {
    return { nextSource: source, errors: ["The ordered source operations cancel out without changing the file."] };
  }
  return { nextSource, errors: [] };
}

export function compileAgentOperationPatch(
  source: string,
  patch: AgentOperationPatch,
): PlanCompilation<AgentCompiledPatch> {
  const compiled = applyAgentSourceOperations(source, patch.edits);
  if (compiled.errors.length) return { errors: compiled.errors };
  const plan = AgentCompiledPatchSchema.safeParse({
    summary: patch.summary,
    detail: patch.detail,
    nextSource: compiled.nextSource,
    operationCount: patch.edits.length,
  });
  return plan.success
    ? { plan: plan.data, errors: [] }
    : { errors: ["The compiled Agent patch exceeds Rune's bounded review contract."] };
}

export function compileAgentWorkspaceOperations(
  artifacts: Array<{ id: string; source: string }>,
  operationPlan: AgentWorkspaceOperationPlan,
): PlanCompilation<AgentCompiledWorkspacePatch> {
  const errors: string[] = [];
  const seen = new Set<string>();
  const compiledPatches: AgentCompiledWorkspacePatch["patches"] = [];

  operationPlan.patches.forEach((patch) => {
    if (seen.has(patch.artifactId)) {
      errors.push(`${patch.artifactId}: the operation plan contains duplicate file patches.`);
      return;
    }
    seen.add(patch.artifactId);
    const artifact = artifacts.find((candidate) => candidate.id === patch.artifactId);
    if (!artifact) {
      errors.push(`${patch.artifactId}: the operation plan references an unknown artifact.`);
      return;
    }
    const compiled = compileAgentOperationPatch(artifact.source, patch);
    if (!compiled.plan) {
      compiled.errors.forEach((error) => errors.push(`${patch.artifactId}: ${error}`));
      return;
    }
    compiledPatches.push({ artifactId: patch.artifactId, ...compiled.plan });
  });

  if (errors.length) return { errors: [...new Set(errors)] };
  const plan = AgentCompiledWorkspacePatchSchema.safeParse({
    summary: operationPlan.summary,
    detail: operationPlan.detail,
    patches: compiledPatches,
  });
  return plan.success
    ? { plan: plan.data, errors: [] }
    : { errors: ["The compiled workspace patch exceeds Rune's bounded review contract."] };
}
