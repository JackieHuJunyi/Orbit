import type { RuneTaskProviderRequest } from "../app/lib/task-providers.ts";
import type { WorkspaceArtifact } from "../app/lib/workspace.ts";

export const RUNE_GOLDEN_TASK_SET_VERSION = 1;

export type GoldenEvidenceRow = {
  category: string;
  value: number;
  primaryValue?: number;
  comparisonValue?: number;
};

export type GoldenTaskExpected =
  | {
      outcome: "success";
      outputKinds: WorkspaceArtifact["kind"][];
      evidenceRows?: GoldenEvidenceRow[];
      slideCount?: number;
      refreshTargetId?: string;
      refreshTargetName?: string;
      refreshTheme?: "rune" | "rune-dark";
    }
  | { outcome: "rejected"; error: RegExp };

export type RuneGoldenTask = {
  version: 1;
  id: string;
  title: string;
  provenance: "synthetic";
  coverage: string[];
  artifacts: WorkspaceArtifact[];
  request: RuneTaskProviderRequest;
  expected: GoldenTaskExpected;
};

function data(id: string, source: string, name = `${id}.csv`): WorkspaceArtifact {
  return { id, name, kind: "data", language: "CSV / JSON", source };
}

function document(id: string, sections: Array<[string, string]>, name = `${id}.md`): WorkspaceArtifact {
  return {
    id,
    name,
    kind: "document",
    language: "Markdown",
    source: `# ${sections[0]?.[0] ?? "Source"}\n\n${sections.map(([title, body]) => `## ${title}\n\n${body}`).join("\n\n")}`,
  };
}

function blocker(id: string, name = `${id}.md`): WorkspaceArtifact {
  return document(id, [["Existing file", "This readable file intentionally occupies one generated identity in a collision regression task."]], name);
}

const decisionSections: Array<[string, string]> = [
  ["Context", "Customer adoption increased after the onboarding redesign, while the support team documented the remaining friction and its effect on activation."],
  ["Evidence", "The reviewed research notes distinguish observed behavior from assumptions and keep each decision connected to a named source section."],
  ["Risk", "The largest risk is expanding the workflow before repeated use proves that the current outcome saves meaningful preparation time."],
  ["Decision", "The next decision is to run a bounded pilot, compare the result with the existing process, and record the edits needed before delivery."],
  ["Owner", "Product owns the pilot definition, operations owns the source quality review, and every participant can reject a proposed write."],
  ["Next step", "Prepare the next reviewed briefing, confirm the evidence boundary, assign one owner, and return with a measured result."],
];

const refreshSource = document("refresh-memo", decisionSections.slice(0, 2));
const refreshTarget: WorkspaceArtifact = {
  id: "refresh-deck",
  name: "refresh-deck.deck.md",
  kind: "slides",
  language: "Deck Markdown",
  source: `---
version: 1
title: Existing briefing
theme: rune-dark
ratio: 16:9
lang: en
origin: refresh-memo
audience: team
purpose: Review the existing decision.
---

<!-- layout: cover -->

# Existing briefing

An earlier source-linked presentation.
`,
};

export const RUNE_GOLDEN_TASKS = [
  {
    version: 1,
    id: "review-whole-table-sum",
    title: "Whole-table weekly revenue review",
    provenance: "synthetic",
    coverage: ["CSV", "sum", "bar", "Document", "Slides"],
    artifacts: [data("weekly-revenue", "Region,Revenue\nAPAC,120\nEMEA,90\nLATAM,40\n")],
    request: { taskId: "operating-review", input: {
      title: "Weekly revenue review", dataArtifactId: "weekly-revenue", category: "Region", value: "Revenue",
      aggregation: "sum", mark: "bar", format: "currency", period: "Week 32", audience: "leadership",
      focus: "Choose the regional follow-up after reviewing the evidence.", deliverables: ["document", "slides"], locale: "en",
    } },
    expected: { outcome: "success", outputKinds: ["query", "chart", "document", "slides"], evidenceRows: [
      { category: "APAC", value: 120 }, { category: "EMEA", value: 90 }, { category: "LATAM", value: 40 },
    ] },
  },
  {
    version: 1,
    id: "review-exact-month-scope",
    title: "Exact month ignores malformed excluded rows",
    provenance: "synthetic",
    coverage: ["CSV", "exact scope", "excluded malformed values", "Document"],
    artifacts: [data("monthly-scope", "Period,Region,Revenue\nJuly,APAC,120\nJune,APAC,N/A\nJuly,Europe,90\nJune,Europe,$700\n")],
    request: { taskId: "operating-review", input: {
      title: "July revenue review", dataArtifactId: "monthly-scope", category: "Region", value: "Revenue",
      aggregation: "sum", mark: "bar", format: "currency", scope: { field: "Period", value: "July" },
      period: "July 2026", audience: "leadership", focus: "Review the exact current-month result.", deliverables: ["document"], locale: "en",
    } },
    expected: { outcome: "success", outputKinds: ["query", "chart", "document"], evidenceRows: [
      { category: "APAC", value: 120 }, { category: "Europe", value: 90 },
    ] },
  },
  {
    version: 1,
    id: "review-paired-month-change",
    title: "Paired exact month comparison",
    provenance: "synthetic",
    coverage: ["CSV", "paired exact scopes", "primary minus comparison", "shared categories"],
    artifacts: [data("monthly-change", "Period,Region,Revenue\nJuly,APAC,120\nJune,APAC,100\nJuly,Europe,90\nJune,Europe,110\nJuly,LATAM,40\nJune,North America,30\nMay,APAC,N/A\n")],
    request: { taskId: "operating-review", input: {
      title: "July change review", dataArtifactId: "monthly-change", category: "Region", value: "Revenue",
      aggregation: "sum", mark: "bar", format: "currency", scope: { field: "Period", value: "July" },
      comparisonScope: { field: "Period", value: "June" }, period: "July vs June 2026", audience: "board",
      focus: "Review the exact regional change before deciding.", deliverables: ["document", "slides"], locale: "en",
    } },
    expected: { outcome: "success", outputKinds: ["query", "chart", "document", "slides"], evidenceRows: [
      { category: "APAC", value: 20, primaryValue: 120, comparisonValue: 100 },
      { category: "Europe", value: -20, primaryValue: 90, comparisonValue: 110 },
    ] },
  },
  {
    version: 1,
    id: "review-average-line",
    title: "Average measure in stable source order",
    provenance: "synthetic",
    coverage: ["CSV", "duplicate categories", "average", "line"],
    artifacts: [data("average-score", "Region,Score\nAPAC,100\nAPAC,120\nEMEA,80\nEMEA,100\n")],
    request: { taskId: "operating-review", input: {
      title: "Average score review", dataArtifactId: "average-score", category: "Region", value: "Score",
      aggregation: "average", mark: "line", format: "number", period: "Current cohort", audience: "team",
      focus: "Review the average result in source order.", deliverables: ["document"], locale: "en",
    } },
    expected: { outcome: "success", outputKinds: ["query", "chart", "document"], evidenceRows: [
      { category: "APAC", value: 110 }, { category: "EMEA", value: 90 },
    ] },
  },
  {
    version: 1,
    id: "review-json-boolean-scope",
    title: "Typed Boolean scope over JSON",
    provenance: "synthetic",
    coverage: ["JSON", "Boolean scope", "typed identity", "Slides"],
    artifacts: [data("active-segments", '[{"Active":true,"Segment":"A","Score":30},{"Active":false,"Segment":"A","Score":"N/A"},{"Active":true,"Segment":"B","Score":20}]', "active-segments.json")],
    request: { taskId: "operating-review", input: {
      title: "Active segment review", dataArtifactId: "active-segments", category: "Segment", value: "Score",
      aggregation: "sum", mark: "bar", format: "number", scope: { field: "Active", value: true },
      period: "Active cohort", audience: "leadership", focus: "Review only the explicitly active cohort.", deliverables: ["slides"], locale: "en",
    } },
    expected: { outcome: "success", outputKinds: ["query", "chart", "slides"], evidenceRows: [
      { category: "A", value: 30 }, { category: "B", value: 20 },
    ] },
  },
  {
    version: 1,
    id: "review-date-string-scope",
    title: "Exact ISO date remains a string scope",
    provenance: "synthetic",
    coverage: ["CSV", "date string", "exact scope", "no date guessing"],
    artifacts: [data("daily-orders", "Date,Channel,Orders\n2026-08-01,Web,10\n2026-08-01,Retail,8\n2026-07-31,Web,N/A\n")],
    request: { taskId: "operating-review", input: {
      title: "Daily orders review", dataArtifactId: "daily-orders", category: "Channel", value: "Orders",
      aggregation: "sum", mark: "bar", format: "number", scope: { field: "Date", value: "2026-08-01" },
      period: "2026-08-01", audience: "team", focus: "Review the explicitly selected business date.", deliverables: ["document"], locale: "en",
    } },
    expected: { outcome: "success", outputKinds: ["query", "chart", "document"], evidenceRows: [
      { category: "Web", value: 10 }, { category: "Retail", value: 8 },
    ] },
  },
  {
    version: 1,
    id: "review-simplified-chinese",
    title: "Simplified Chinese operating review",
    provenance: "synthetic",
    coverage: ["CSV", "zh-CN", "Unicode fields", "Document"],
    artifacts: [data("cn-revenue", "地区,收入\n华东,80\n华南,60\n")],
    request: { taskId: "operating-review", input: {
      title: "本周收入复盘", dataArtifactId: "cn-revenue", category: "地区", value: "收入",
      aggregation: "sum", mark: "bar", format: "currency", period: "本周", audience: "leadership",
      focus: "审核区域差异后确认下一步行动。", deliverables: ["document"], locale: "zh-CN",
    } },
    expected: { outcome: "success", outputKinds: ["query", "chart", "document"], evidenceRows: [
      { category: "华东", value: 80 }, { category: "华南", value: 60 },
    ] },
  },
  {
    version: 1,
    id: "review-arabic-percent",
    title: "Arabic-locale percentage review",
    provenance: "synthetic",
    coverage: ["CSV", "Arabic locale", "percent", "Slides"],
    artifacts: [data("regional-margin", "Region,Margin\nNorth,42\nSouth,35\n")],
    request: { taskId: "operating-review", input: {
      title: "مراجعة الهامش", dataArtifactId: "regional-margin", category: "Region", value: "Margin",
      aggregation: "average", mark: "bar", format: "percent", period: "هذا الأسبوع", audience: "leadership",
      focus: "راجع الأدلة قبل تحديد المتابعة.", deliverables: ["slides"], locale: "ar",
    } },
    expected: { outcome: "success", outputKinds: ["query", "chart", "slides"], evidenceRows: [
      { category: "North", value: 42 }, { category: "South", value: 35 },
    ] },
  },
  {
    version: 1,
    id: "review-collision-safe-chain",
    title: "Every generated identity resolves collisions",
    provenance: "synthetic",
    coverage: ["CSV", "case-insensitive collisions", "complete chain"],
    artifacts: [
      data("collision-data", "Region,Revenue\nAPAC,55\nEMEA,45\n"),
      blocker("collision-review-analysis"), blocker("block-view", "collision-review-view.chart.json"),
      blocker("collision-review-report"), blocker("collision-review-briefing", "collision-review-briefing.deck.md"),
    ],
    request: { taskId: "operating-review", input: {
      title: "Collision review", dataArtifactId: "collision-data", category: "Region", value: "Revenue",
      aggregation: "sum", mark: "bar", format: "currency", period: "Current", audience: "leadership",
      focus: "Create one collision-safe complete result.", deliverables: ["document", "slides"], locale: "en",
    } },
    expected: { outcome: "success", outputKinds: ["query", "chart", "document", "slides"], evidenceRows: [
      { category: "APAC", value: 55 }, { category: "EMEA", value: 45 },
    ] },
  },
  {
    version: 1,
    id: "review-duplicate-rows-slides-only",
    title: "Duplicate rows aggregate into a Slides-only result",
    provenance: "synthetic",
    coverage: ["CSV", "duplicate rows", "sum", "Slides only"],
    artifacts: [data("duplicate-rows", "Region,Revenue\nAPAC,20\nAPAC,30\nEMEA,10\n")],
    request: { taskId: "operating-review", input: {
      title: "Duplicate row review", dataArtifactId: "duplicate-rows", category: "Region", value: "Revenue",
      aggregation: "sum", mark: "bar", format: "number", period: "Current", audience: "team",
      focus: "Confirm aggregation before sharing the presentation.", deliverables: ["slides"], locale: "en",
    } },
    expected: { outcome: "success", outputKinds: ["query", "chart", "slides"], evidenceRows: [
      { category: "APAC", value: 50 }, { category: "EMEA", value: 10 },
    ] },
  },
  {
    version: 1,
    id: "reject-missing-exact-field",
    title: "Missing field stops before output",
    provenance: "synthetic",
    coverage: ["failure", "missing field", "zero output"],
    artifacts: [data("missing-field", "Region,Revenue\nAPAC,20\n")],
    request: { taskId: "operating-review", input: {
      title: "Missing field review", dataArtifactId: "missing-field", category: "Market", value: "Revenue",
      aggregation: "sum", mark: "bar", format: "number", period: "Current", audience: "team",
      focus: "This task must stop.", deliverables: ["document"], locale: "en",
    } },
    expected: { outcome: "rejected", error: /fields are missing|category field/i },
  },
  {
    version: 1,
    id: "reject-duplicate-deliverables",
    title: "Duplicate deliverables stop instead of collapsing",
    provenance: "synthetic",
    coverage: ["failure", "duplicate deliverables", "zero output"],
    artifacts: [data("duplicate-deliverables", "Region,Revenue\nAPAC,20\n")],
    request: { taskId: "operating-review", input: {
      title: "Duplicate output review", dataArtifactId: "duplicate-deliverables", category: "Region", value: "Revenue",
      aggregation: "sum", mark: "bar", format: "number", period: "Current", audience: "team",
      focus: "This task must stop.", deliverables: ["document", "document"], locale: "en",
    } },
    expected: { outcome: "rejected", error: /deliverable choices must be unique/i },
  },
  {
    version: 1,
    id: "reject-formatted-eligible-number",
    title: "Formatted numeric text inside scope stops",
    provenance: "synthetic",
    coverage: ["failure", "formatted number", "exact eligible rows", "zero output"],
    artifacts: [data("formatted-current", "Period,Region,Revenue\nJuly,APAC,$120\nJune,APAC,100\n")],
    request: { taskId: "operating-review", input: {
      title: "Formatted number review", dataArtifactId: "formatted-current", category: "Region", value: "Revenue",
      aggregation: "sum", mark: "bar", format: "currency", scope: { field: "Period", value: "July" },
      period: "July", audience: "team", focus: "This task must stop.", deliverables: ["document"], locale: "en",
    } },
    expected: { outcome: "rejected", error: /finite numeric values|numeric values/i },
  },
  {
    version: 1,
    id: "reject-unshared-comparison",
    title: "Comparison with no shared categories stops",
    provenance: "synthetic",
    coverage: ["failure", "paired exact scopes", "no shared categories", "zero output"],
    artifacts: [data("unshared-comparison", "Period,Region,Revenue\nJuly,APAC,120\nJune,Europe,100\n")],
    request: { taskId: "operating-review", input: {
      title: "Unshared comparison", dataArtifactId: "unshared-comparison", category: "Region", value: "Revenue",
      aggregation: "sum", mark: "bar", format: "number", scope: { field: "Period", value: "July" },
      comparisonScope: { field: "Period", value: "June" }, period: "July vs June", audience: "team",
      focus: "This task must stop.", deliverables: ["document"], locale: "en",
    } },
    expected: { outcome: "rejected", error: /shared category/i },
  },
  {
    version: 1,
    id: "briefing-four-slide-english",
    title: "Four-slide English source briefing",
    provenance: "synthetic",
    coverage: ["Markdown", "Document to Presentation", "4 slides", "English"],
    artifacts: [document("brief-en", decisionSections.slice(0, 2))],
    request: { taskId: "document-briefing", input: {
      sourceArtifactId: "brief-en", title: "Decision briefing", audience: "leadership",
      focus: "Agree the next bounded pilot after reviewing the source.", slideCount: 4, locale: "en",
    } },
    expected: { outcome: "success", outputKinds: ["slides"], slideCount: 4 },
  },
  {
    version: 1,
    id: "briefing-six-slide-chinese",
    title: "Six-slide Simplified Chinese source briefing",
    provenance: "synthetic",
    coverage: ["Markdown", "Document to Presentation", "6 slides", "zh-CN"],
    artifacts: [document("brief-cn", decisionSections.slice(0, 4).map(([title, body], index) => [`部分${index + 1}·${title}`, `${body} 这一段保留可读来源，用于生成经过审核的中文演示内容。`]))],
    request: { taskId: "document-briefing", input: {
      sourceArtifactId: "brief-cn", title: "试点决策简报", audience: "team",
      focus: "审核来源后确认下一轮试点。", slideCount: 6, locale: "zh-CN",
    } },
    expected: { outcome: "success", outputKinds: ["slides"], slideCount: 6 },
  },
  {
    version: 1,
    id: "briefing-eight-slide-japanese",
    title: "Eight-slide Japanese-locale source briefing",
    provenance: "synthetic",
    coverage: ["Markdown", "Document to Presentation", "8 slides", "Japanese"],
    artifacts: [document("brief-ja", decisionSections)],
    request: { taskId: "document-briefing", input: {
      sourceArtifactId: "brief-ja", title: "意思決定ブリーフィング", audience: "leadership",
      focus: "根拠を確認して次の実験を決める。", slideCount: 8, locale: "ja",
    } },
    expected: { outcome: "success", outputKinds: ["slides"], slideCount: 8 },
  },
  {
    version: 1,
    id: "briefing-refresh-linked-dark-deck",
    title: "Refresh preserves exact target identity and theme",
    provenance: "synthetic",
    coverage: ["Markdown", "linked refresh", "exact identity", "dark theme"],
    artifacts: [refreshSource, refreshTarget],
    request: { taskId: "document-briefing", input: {
      sourceArtifactId: refreshSource.id, targetArtifactId: refreshTarget.id, title: "Refreshed briefing",
      audience: "team", focus: "Review the refreshed decision with the same presentation identity.", slideCount: 4, locale: "en",
    } },
    expected: {
      outcome: "success", outputKinds: ["slides"], slideCount: 4,
      refreshTargetId: refreshTarget.id, refreshTargetName: refreshTarget.name, refreshTheme: "rune-dark",
    },
  },
  {
    version: 1,
    id: "reject-briefing-insufficient-source",
    title: "Insufficient source stops an eight-slide briefing",
    provenance: "synthetic",
    coverage: ["failure", "Document to Presentation", "insufficient evidence", "zero output"],
    artifacts: [document("short-memo", [["Short note", "One short source note."]])],
    request: { taskId: "document-briefing", input: {
      sourceArtifactId: "short-memo", title: "Unsupported briefing", audience: "team",
      focus: "This task must stop.", slideCount: 8, locale: "en",
    } },
    expected: { outcome: "rejected", error: /enough readable material/i },
  },
  {
    version: 1,
    id: "reject-briefing-foreign-target",
    title: "Foreign presentation origin stops refresh",
    provenance: "synthetic",
    coverage: ["failure", "linked refresh", "wrong origin", "zero output"],
    artifacts: [
      document("current-memo", decisionSections.slice(0, 2)),
      { ...refreshTarget, id: "foreign-deck", name: "foreign-deck.deck.md", source: refreshTarget.source.replace("origin: refresh-memo", "origin: another-memo") },
    ],
    request: { taskId: "document-briefing", input: {
      sourceArtifactId: "current-memo", targetArtifactId: "foreign-deck", title: "Foreign refresh",
      audience: "team", focus: "This task must stop.", slideCount: 4, locale: "en",
    } },
    expected: { outcome: "rejected", error: /not linked to Document source/i },
  },
] as const satisfies readonly RuneGoldenTask[];
