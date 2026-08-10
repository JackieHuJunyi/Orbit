import { z } from "zod";

export const AgentPatchSchema = z.object({
  summary: z.string().min(1).max(160),
  detail: z.string().min(1).max(500),
  nextSource: z.string().min(1).max(120_000),
});

export const AgentRequestSchema = z.object({
  artifact: z.object({
    id: z.string().min(1).max(120),
    name: z.string().min(1).max(240),
    kind: z.enum(["document", "data", "slides"]),
    language: z.string().min(1).max(80),
    source: z.string().min(1).max(100_000),
  }),
  prompt: z.string().trim().min(1).max(2_000),
  metrics: z.record(z.string(), z.string().max(200)).default({}),
});

export type AgentPatch = z.infer<typeof AgentPatchSchema>;
export type AgentRequest = z.infer<typeof AgentRequestSchema>;

const kindRules: Record<AgentRequest["artifact"]["kind"], string> = {
  document: "Return valid GitHub-Flavored Markdown. Preserve useful headings, tables, task lists, and every {{ metric(...) }} token unless the user explicitly asks to change a binding.",
  data: "Return valid CSV or JSON matching the input format. Preserve headers and types, and never invent hidden rows. Derived values must be deterministic from visible source values.",
  slides: "Return one complete semantic HTML document. Keep scripts out, use accessible section-based slides, preserve shared design tokens, and preserve every {{ metric(...) }} token unless the user explicitly asks to change a binding.",
};

export function buildAgentInstructions(request: AgentRequest) {
  return [
    "You are Rune's artifact editing agent.",
    "Plan one conservative, reviewable edit to the selected canonical source.",
    "Return a short summary, a concrete detail sentence, and the complete next source.",
    "Never wrap nextSource in Markdown fences and never claim that the change was already applied.",
    "Do not change unrelated content. Do not remove provenance or metric bindings silently.",
    kindRules[request.artifact.kind],
  ].join(" ");
}

export function buildAgentInput(request: AgentRequest) {
  return JSON.stringify({
    instruction: request.prompt,
    artifact: request.artifact,
    compiledWorkspaceMetrics: request.metrics,
  });
}
