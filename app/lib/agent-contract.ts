import { z } from "zod";
import {
  MAX_WORKSPACE_AGENT_PINS,
  WORKSPACE_DEPENDENCY_KINDS,
} from "./dependency-graph.ts";
import { sourceSelectionError } from "./source-selection.ts";

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

export const AgentExactTextOperationSchema = z.object({
  type: z.literal("replace_text"),
  find: z.string().min(1).max(8_000),
  replace: z.string().max(16_000),
}).strict();

export const AgentMarkdownSectionOperationSchema = z.object({
  type: z.literal("replace_markdown_section"),
  heading: z.string().min(1).max(200),
  body: z.string().max(16_000),
}).strict();

export const AgentMarkdownSectionInsertOperationSchema = z.object({
  type: z.literal("insert_markdown_section_after"),
  heading: z.string().min(1).max(200),
  section: z.string().min(1).max(16_000),
}).strict();

export const AgentDataCellValueSchema = z.union([
  z.string().max(4_000),
  z.number(),
  z.boolean(),
  z.null(),
]);

export const AgentDataRowOperationSchema = z.object({
  type: z.literal("upsert_data_row"),
  keyColumn: z.string().min(1).max(200),
  keyValue: z.union([z.string().min(1).max(1_000), z.number(), z.boolean()]),
  cells: z.array(z.object({
    column: z.string().min(1).max(200),
    value: AgentDataCellValueSchema,
  }).strict()).min(1).max(32),
}).strict();

export const AgentDeckSlideOperationSchema = z.object({
  type: z.literal("replace_deck_slide"),
  title: z.string().min(1).max(200),
  slide: z.string().min(1).max(16_000),
}).strict();

export const AgentDeckSlideInsertOperationSchema = z.object({
  type: z.literal("insert_deck_slide_after"),
  title: z.string().min(1).max(200),
  slide: z.string().min(1).max(16_000),
}).strict();

export const AgentSourceOperationSchema = z.discriminatedUnion("type", [
  AgentExactTextOperationSchema,
  AgentMarkdownSectionOperationSchema,
  AgentMarkdownSectionInsertOperationSchema,
  AgentDataRowOperationSchema,
  AgentDeckSlideOperationSchema,
  AgentDeckSlideInsertOperationSchema,
]);

export const AgentOperationPatchSchema = z.object({
  summary: z.string().min(1).max(160),
  detail: z.string().min(1).max(500),
  edits: z.array(AgentSourceOperationSchema).min(1).max(8),
}).strict();

export const AgentFileOperationPatchSchema = AgentOperationPatchSchema.extend({
  type: z.literal("patch_artifact"),
  artifactId: z.string().min(1).max(120),
}).strict();

export const AgentArtifactCreationOperationSchema = AgentOperationPatchSchema.extend({
  type: z.literal("create_artifact"),
  kind: z.enum(["document", "data", "slides"]),
  title: z.string().trim().min(1).max(80),
}).strict();

export const AgentWorkspaceActionSchema = z.discriminatedUnion("type", [
  AgentFileOperationPatchSchema,
  AgentArtifactCreationOperationSchema,
]);

export const AgentWorkspaceOperationPlanSchema = z.object({
  summary: z.string().min(1).max(160),
  detail: z.string().min(1).max(500),
  actions: z.array(AgentWorkspaceActionSchema).min(1).max(4),
}).strict();

export const AgentCompiledPatchSchema = AgentPatchSchema.extend({
  operationCount: z.number().int().min(1).max(8),
});

export const AgentCompiledFilePatchSchema = AgentCompiledPatchSchema.extend({
  artifactId: z.string().min(1).max(120),
});

export const AgentCompiledArtifactCreationSchema = z.object({
  artifact: z.object({
    id: z.string().min(1).max(120),
    name: z.string().min(1).max(240),
    kind: z.enum(["document", "data", "slides"]),
    language: z.string().min(1).max(80),
    source: z.string().min(1).max(120_000),
  }).strict(),
  summary: z.string().min(1).max(160),
  detail: z.string().min(1).max(500),
  operationCount: z.number().int().min(1).max(8),
}).strict();

export const AgentCompiledWorkspacePatchSchema = z.object({
  summary: z.string().min(1).max(160),
  detail: z.string().min(1).max(500),
  patches: z.array(AgentCompiledFilePatchSchema).max(4),
  creations: z.array(AgentCompiledArtifactCreationSchema).max(4),
}).strict().superRefine((plan, context) => {
  const actionCount = plan.patches.length + plan.creations.length;
  if (actionCount < 1 || actionCount > 4) {
    context.addIssue({ code: "custom", message: "A compiled workspace plan needs one to four actions." });
  }
});

const AgentArtifactSchema = z.object({
  id: z.string().min(1).max(120),
  name: z.string().min(1).max(240),
  kind: z.enum(["document", "data", "query", "chart", "slides"]),
  language: z.string().min(1).max(80),
  source: z.string().min(1).max(100_000),
});

export const AgentWorkspaceDependencySchema = z.object({
  fromArtifactId: z.string().min(1).max(120),
  toArtifactId: z.string().min(1).max(120),
  kind: z.enum(WORKSPACE_DEPENDENCY_KINDS),
  references: z.array(z.string().min(1).max(200)).max(16),
}).strict();

export const AgentSourceSelectionSchema = z.object({
  start: z.number().int().min(0).max(100_000),
  end: z.number().int().min(1).max(100_000),
}).strict();

export const AgentRequestSchema = z.object({
  scope: z.enum(["selection", "artifact", "workspace"]).default("artifact"),
  artifact: AgentArtifactSchema,
  selection: AgentSourceSelectionSchema.optional(),
  workspaceArtifacts: z.array(AgentArtifactSchema).min(2).max(6).optional(),
  workspaceDependencies: z.array(AgentWorkspaceDependencySchema).max(32).optional(),
  workspacePinnedArtifactIds: z.array(z.string().min(1).max(120)).max(MAX_WORKSPACE_AGENT_PINS).optional(),
  prompt: z.string().trim().min(1).max(2_000),
  metrics: z.record(z.string(), z.string().max(200)).default({}),
}).superRefine((request, context) => {
  if (request.scope !== "workspace"
    && (request.workspaceDependencies !== undefined || request.workspacePinnedArtifactIds !== undefined)) {
    context.addIssue({ code: "custom", message: "Workspace graph context is only accepted in workspace scope." });
  }
  if (request.scope === "selection") {
    if (!request.selection) {
      context.addIssue({ code: "custom", message: "Selection scope requires exact source offsets." });
      return;
    }
    const selectionError = sourceSelectionError(request.artifact.source, request.selection);
    if (selectionError) context.addIssue({ code: "custom", message: selectionError });
    return;
  }
  if (request.selection) {
    context.addIssue({ code: "custom", message: "Source offsets are only accepted in selection scope." });
  }
  if (request.scope !== "workspace") return;
  if (request.workspaceDependencies === undefined) {
    context.addIssue({ code: "custom", message: "Workspace scope requires an explicit dependency context." });
  }
  if (request.workspacePinnedArtifactIds === undefined) {
    context.addIssue({ code: "custom", message: "Workspace scope requires an explicit pin context." });
  }
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
  const workspaceIds = new Set(workspace.map((artifact) => artifact.id));
  const pinnedIds = request.workspacePinnedArtifactIds ?? [];
  if (new Set(pinnedIds).size !== pinnedIds.length) {
    context.addIssue({ code: "custom", message: "Workspace context pins must be unique." });
  }
  if (pinnedIds.some((artifactId) => !workspaceIds.has(artifactId))) {
    context.addIssue({ code: "custom", message: "Workspace context pins must belong to the supplied context." });
  }
  const dependencyKeys = new Set<string>();
  (request.workspaceDependencies ?? []).forEach((dependency) => {
    if (!workspaceIds.has(dependency.fromArtifactId) || !workspaceIds.has(dependency.toArtifactId)) {
      context.addIssue({ code: "custom", message: "Workspace dependency endpoints must belong to the supplied context." });
    }
    const key = `${dependency.fromArtifactId}\u0000${dependency.toArtifactId}\u0000${dependency.kind}`;
    if (dependencyKeys.has(key)) {
      context.addIssue({ code: "custom", message: "Workspace dependencies must be unique." });
    }
    dependencyKeys.add(key);
  });
});

export type AgentPatch = z.infer<typeof AgentPatchSchema>;
export type AgentWorkspacePatch = z.infer<typeof AgentWorkspacePatchSchema>;
export type AgentSourceOperation = z.infer<typeof AgentSourceOperationSchema>;
export type AgentSourceSelection = z.infer<typeof AgentSourceSelectionSchema>;
export type AgentOperationPatch = z.infer<typeof AgentOperationPatchSchema>;
export type AgentWorkspaceAction = z.infer<typeof AgentWorkspaceActionSchema>;
export type AgentWorkspaceOperationPlan = z.infer<typeof AgentWorkspaceOperationPlanSchema>;
export type AgentCompiledPatch = z.infer<typeof AgentCompiledPatchSchema>;
export type AgentCompiledWorkspacePatch = z.infer<typeof AgentCompiledWorkspacePatchSchema>;
export type AgentRequest = z.infer<typeof AgentRequestSchema>;

const kindRules: Record<AgentRequest["artifact"]["kind"], string> = {
  document: "The resulting source must be valid GitHub-Flavored Markdown. Prefer replace_markdown_section or insert_markdown_section_after for section work; use replace_text only for a precise inline edit. Preserve useful headings, tables, task lists, and every {{ metric(...) }} token unless the user explicitly asks to change a binding.",
  data: "The resulting source must remain valid CSV or flat object JSON in the input format. Prefer upsert_data_row with an existing unique key column and typed cell values; use replace_text only for a precise structural edit. Preserve headers and types, and never invent hidden rows. Derived values must be deterministic from visible source values.",
  query: "Use only replace_text. The resulting source must be one read-only DuckDB SELECT or WITH query. Read the bound Data artifact through workspace_data, avoid remote URLs and side effects, and keep the result useful as a live grid. Preserve an existing first-line -- rune:data \"artifact-id\" directive exactly. In Workspace scope, add or change that directive only to an exact existing Data artifact id from visible context; never invent an id.",
  chart: "Use only replace_text. The resulting source must be one strict Chart JSON object with version, title, description, source, mark, category, value, sort, format, color, and maxItems. Use an existing Data or Query artifact id and exact source/output column names; give every derived Query field an explicit AS alias. Keep mark as bar, color as a six-digit hex value, and maxItems between 1 and 20.",
  slides: "For legacy semantic HTML use only replace_text. Keep scripts out, use accessible section-based slides, preserve shared design tokens, and preserve every {{ metric(...) }} token unless the user explicitly asks to change a binding.",
};

const deckMarkdownRule = "The resulting source must remain complete Deck Markdown with strict version: 1, title, theme, ratio, and lang frontmatter. Prefer replace_deck_slide or insert_deck_slide_after for slide work; use replace_text only for frontmatter or a precise inline edit. A slide operation's slide field contains one complete slide without a --- separator. Keep only supported layout/eyebrow comments, headings, paragraphs, lists, tables, and metric/chart bindings. Never introduce raw HTML or manual slide numbers.";

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
      "Plan one coordinated, reviewable outcome across the smallest useful set of canonical sources, including a new Office-core artifact when the instruction asks for one. workspaceArtifacts is a bounded context pack selected from the current dependency graph; workspaceDependencies lists source-to-consumer edges inside that pack, and workspacePinnedArtifactIds identifies files the user deliberately included across otherwise disconnected components. Treat pins as intentional context, not an instruction to patch every pinned file. Do not assume omitted workspace files do not exist; Rune revalidates the complete workspace before applying anything.",
      "Return one top-level summary and detail plus 1-4 actions. Use patch_artifact only with artifactId values present in workspaceArtifacts and never patch an unchanged file. Use create_artifact only for document, data, or slides, and provide only kind, title, summary, detail, and ordered edits. Never provide an id, filename, extension, language, source, or nextSource for a new artifact; Rune owns its identity and initial template.",
      "Every action needs its own short summary, concrete detail, and 1-8 ordered edits. Choose only operations allowed for that artifact: replace_text, replace_markdown_section, insert_markdown_section_after, upsert_data_row, replace_deck_slide, or insert_deck_slide_after.",
      "Rune creates new documents from '# {title}\\n\\n', new data tables from 'Item,Value\\n', and new presentations from strict Deck Markdown with a cover slide titled {title}. Target those exact templates with the action's edits. Put all edits for a new file in its create_artifact action; do not patch a newly created file in the same plan.",
      "Semantic operations identify Markdown by exact heading, data by exact typed key column/value, and Deck slides by exact title. replace_text uses exact find and replace fields; copy enough surrounding source to make find unique. Never use line numbers, regular expressions, nextSource, or an unchanged complete-file copy. Rune applies operations sequentially and rejects missing, ambiguous, type-incompatible, or invalid targets.",
      "Keep cross-file facts, metric bindings, provenance, and narrative consistent. Never claim that a patch was already applied.",
      ...rules,
    ].join(" ");
  }
  if (request.scope === "selection") {
    return [
      "You are Rune's source-selection editing agent.",
      "Plan one conservative, reviewable edit whose complete effect stays inside selectedSource. The selection offsets are bound to the supplied artifact revision. Do not change, delete, or insert anything before selection.start or after selection.end.",
      "Return a short summary, a concrete detail sentence, and 1-8 ordered edits. Prefer replace_text with an exact anchor entirely inside selectedSource. A semantic Markdown section, data row, or Deck slide operation is allowed only when the complete structure it changes is inside selectedSource.",
      "Semantic operations identify Markdown by exact heading, data by exact typed key column/value, and Deck slides by exact title. Never use line numbers, regular expressions, nextSource, or an unchanged complete-file copy. Rune compiles against the full current source and rejects any result that crosses the selected range.",
      "Never claim that the change was already applied. Preserve provenance and metric/chart bindings unless the user explicitly selected and asked to change them.",
      ruleForArtifact(request.artifact),
    ].join(" ");
  }
  return [
    "You are Rune's artifact editing agent.",
    "Plan one conservative, reviewable edit to the selected canonical source.",
    "Return a short summary, a concrete detail sentence, and 1-8 ordered edits. Choose only operations allowed for this artifact: replace_text, replace_markdown_section, insert_markdown_section_after, upsert_data_row, replace_deck_slide, or insert_deck_slide_after.",
    "Semantic operations identify Markdown by exact heading, data by exact typed key column/value, and Deck slides by exact title. replace_text uses exact find and replace fields; copy enough surrounding source to make find unique. Never use line numbers, regular expressions, nextSource, or an unchanged complete-file copy. Rune applies operations sequentially and rejects missing, ambiguous, type-incompatible, or invalid targets.",
    "Never claim that the change was already applied.",
    "Do not change unrelated content. Do not remove provenance or metric bindings silently.",
    ruleForArtifact(request.artifact),
  ].join(" ");
}

export function buildAgentInput(request: AgentRequest) {
  const selection = request.scope === "selection" && request.selection
    ? {
        ...request.selection,
        selectedSource: request.artifact.source.slice(request.selection.start, request.selection.end),
      }
    : undefined;
  return JSON.stringify({
    instruction: request.prompt,
    selectedArtifactId: request.artifact.id,
    artifact: request.scope === "workspace" ? undefined : request.artifact,
    selection,
    workspaceArtifacts: request.scope === "workspace" ? request.workspaceArtifacts : undefined,
    workspaceDependencies: request.scope === "workspace" ? request.workspaceDependencies : undefined,
    workspacePinnedArtifactIds: request.scope === "workspace" ? request.workspacePinnedArtifactIds : undefined,
    compiledWorkspaceMetrics: request.metrics,
  });
}
