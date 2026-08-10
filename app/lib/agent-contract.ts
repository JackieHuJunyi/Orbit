import { z } from "zod";

export const AgentPatchSchema = z.object({
  summary: z.string().min(1).max(160),
  detail: z.string().min(1).max(500),
  nextSource: z.string().min(1).max(120_000),
});

export const AgentFilePatchSchema = AgentPatchSchema.extend({
  artifactId: z.string().min(1).max(120),
});

export const AgentWorkspacePatchSchema = z.object({
  summary: z.string().min(1).max(160),
  detail: z.string().min(1).max(500),
  patches: z.array(AgentFilePatchSchema).min(1).max(4),
});

export const AgentSourceOperationSchema = z.object({
  find: z.string().min(1).max(8_000),
  replace: z.string().max(16_000),
}).strict();

export const AgentOperationPatchSchema = z.object({
  summary: z.string().min(1).max(160),
  detail: z.string().min(1).max(500),
  edits: z.array(AgentSourceOperationSchema).min(1).max(8),
}).strict();

export const AgentFileOperationPatchSchema = AgentOperationPatchSchema.extend({
  artifactId: z.string().min(1).max(120),
}).strict();

export const AgentWorkspaceOperationPlanSchema = z.object({
  summary: z.string().min(1).max(160),
  detail: z.string().min(1).max(500),
  patches: z.array(AgentFileOperationPatchSchema).min(1).max(4),
}).strict();

export const AgentCompiledPatchSchema = AgentPatchSchema.extend({
  operationCount: z.number().int().min(1).max(8),
});

export const AgentCompiledFilePatchSchema = AgentCompiledPatchSchema.extend({
  artifactId: z.string().min(1).max(120),
});

export const AgentCompiledWorkspacePatchSchema = z.object({
  summary: z.string().min(1).max(160),
  detail: z.string().min(1).max(500),
  patches: z.array(AgentCompiledFilePatchSchema).min(1).max(4),
});

const AgentArtifactSchema = z.object({
  id: z.string().min(1).max(120),
  name: z.string().min(1).max(240),
  kind: z.enum(["document", "data", "query", "chart", "slides"]),
  language: z.string().min(1).max(80),
  source: z.string().min(1).max(100_000),
});

export const AgentRequestSchema = z.object({
  scope: z.enum(["artifact", "workspace"]).default("artifact"),
  artifact: AgentArtifactSchema,
  workspaceArtifacts: z.array(AgentArtifactSchema).min(2).max(6).optional(),
  prompt: z.string().trim().min(1).max(2_000),
  metrics: z.record(z.string(), z.string().max(200)).default({}),
}).superRefine((request, context) => {
  if (request.scope !== "workspace") return;
  const workspace = request.workspaceArtifacts ?? [];
  if (!workspace.some((artifact) => artifact.id === request.artifact.id)) {
    context.addIssue({ code: "custom", message: "The selected artifact must be part of the workspace." });
  }
  if (new Set(workspace.map((artifact) => artifact.id)).size !== workspace.length) {
    context.addIssue({ code: "custom", message: "Workspace artifact ids must be unique." });
  }
  if (workspace.reduce((total, artifact) => total + artifact.source.length, 0) > 180_000) {
    context.addIssue({ code: "custom", message: "The workspace source context is too large." });
  }
});

export type AgentPatch = z.infer<typeof AgentPatchSchema>;
export type AgentWorkspacePatch = z.infer<typeof AgentWorkspacePatchSchema>;
export type AgentSourceOperation = z.infer<typeof AgentSourceOperationSchema>;
export type AgentOperationPatch = z.infer<typeof AgentOperationPatchSchema>;
export type AgentWorkspaceOperationPlan = z.infer<typeof AgentWorkspaceOperationPlanSchema>;
export type AgentCompiledPatch = z.infer<typeof AgentCompiledPatchSchema>;
export type AgentCompiledWorkspacePatch = z.infer<typeof AgentCompiledWorkspacePatchSchema>;
export type AgentRequest = z.infer<typeof AgentRequestSchema>;

const kindRules: Record<AgentRequest["artifact"]["kind"], string> = {
  document: "The resulting source must be valid GitHub-Flavored Markdown. Preserve useful headings, tables, task lists, and every {{ metric(...) }} token unless the user explicitly asks to change a binding.",
  data: "The resulting source must remain valid CSV or JSON in the input format. Preserve headers and types, and never invent hidden rows. Derived values must be deterministic from visible source values.",
  query: "The resulting source must be one read-only DuckDB SELECT or WITH query. Read the canonical source through workspace_data, avoid remote URLs and side effects, and keep the result useful as a live grid.",
  chart: "The resulting source must be one strict Chart JSON object with version, title, description, source, mark, category, value, sort, format, color, and maxItems. Use an existing data artifact id and exact column names; keep mark as bar, color as a six-digit hex value, and maxItems between 1 and 20.",
  slides: "The resulting source must remain one complete semantic HTML document. Keep scripts out, use accessible section-based slides, preserve shared design tokens, and preserve every {{ metric(...) }} token unless the user explicitly asks to change a binding.",
};

const deckMarkdownRule = "The resulting source must remain complete Deck Markdown with strict version: 1, title, theme, ratio, and lang frontmatter; slides separated by ---; and only supported layout/eyebrow comments, headings, paragraphs, lists, tables, and metric/chart bindings. Never introduce raw HTML or manual slide numbers.";

function ruleForArtifact(artifact: AgentRequest["artifact"]) {
  return artifact.kind === "slides" && artifact.language === "Deck Markdown"
    ? deckMarkdownRule
    : kindRules[artifact.kind];
}

export function buildAgentInstructions(request: AgentRequest) {
  if (request.scope === "workspace") {
    const rules = [...new Set((request.workspaceArtifacts ?? []).map(ruleForArtifact))];
    return [
      "You are Rune's workspace editing agent.",
      "Plan one coordinated, reviewable outcome across the smallest useful set of canonical sources.",
      "Return one top-level summary and detail plus 1-4 source-operation patches; use only artifactId values present in workspaceArtifacts and never include an unchanged file.",
      "Every patch needs its own short summary, concrete detail, artifactId, and 1-8 ordered edits. Every edit has find and replace: find must copy an exact non-empty substring that occurs exactly once in that file at that step, and replace is its exact replacement.",
      "Use enough surrounding source in find to make the anchor unique and keep both fields as small as possible. To insert, retain the anchor inside replace plus the new content; an empty replace deletes the anchor. Never use line numbers, regular expressions, nextSource, or an unchanged complete-file copy. Rune applies edits sequentially and rejects missing or ambiguous anchors.",
      "Keep cross-file facts, metric bindings, provenance, and narrative consistent. Never claim that a patch was already applied.",
      ...rules,
    ].join(" ");
  }
  return [
    "You are Rune's artifact editing agent.",
    "Plan one conservative, reviewable edit to the selected canonical source.",
    "Return a short summary, a concrete detail sentence, and 1-8 ordered edits. Every edit has find and replace: find must copy an exact non-empty substring that occurs exactly once in the source at that step, and replace is its exact replacement.",
    "Use enough surrounding source in find to make the anchor unique and keep both fields as small as possible. To insert, retain the anchor inside replace plus the new content; an empty replace deletes the anchor. Never use line numbers, regular expressions, nextSource, or an unchanged complete-file copy. Rune applies edits sequentially and rejects missing or ambiguous anchors.",
    "Never claim that the change was already applied.",
    "Do not change unrelated content. Do not remove provenance or metric bindings silently.",
    ruleForArtifact(request.artifact),
  ].join(" ");
}

export function buildAgentInput(request: AgentRequest) {
  return JSON.stringify({
    instruction: request.prompt,
    selectedArtifactId: request.artifact.id,
    artifact: request.scope === "artifact" ? request.artifact : undefined,
    workspaceArtifacts: request.scope === "workspace" ? request.workspaceArtifacts : undefined,
    compiledWorkspaceMetrics: request.metrics,
  });
}
