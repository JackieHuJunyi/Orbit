import { resolveArtifactConflicts } from "./artifact-identity.ts";
import { validateWorkspaceArtifacts } from "./patches.ts";
import {
  formatQueryDataSourceDirective,
  resolveQueryDataArtifact,
} from "./query-source.ts";
import { inferQueryOutputColumns } from "./sql.ts";
import { parseDataSource, type WorkspaceArtifact } from "./workspace.ts";

export const MAX_WORKSPACE_ARTIFACTS = 50;
export const MAX_ARTIFACT_TITLE_CHARS = 80;

export const creatableArtifactTypes = [
  {
    kind: "document",
    label: "Document",
    format: "Markdown",
    extension: ".md",
    description: "A readable report, memo, or brief.",
  },
  {
    kind: "data",
    label: "Data table",
    format: "CSV",
    extension: ".csv",
    description: "A typed table ready for grids and analysis.",
  },
  {
    kind: "query",
    label: "SQL analysis",
    format: "DuckDB SQL",
    extension: ".sql",
    description: "A readable query bound to one exact Data source.",
  },
  {
    kind: "chart",
    label: "Live chart",
    format: "Chart JSON",
    extension: ".chart.json",
    description: "A reusable visual bound to Data or Query output.",
  },
  {
    kind: "slides",
    label: "Presentation",
    format: "Deck Markdown",
    extension: ".deck.md",
    description: "A structured deck compiled to live HTML.",
  },
] as const;

export type CreatableArtifactKind = typeof creatableArtifactTypes[number]["kind"];

export type ChartCreationMark = "bar" | "line";
export type ChartCreationFormat = "number" | "currency" | "percent";

export type ArtifactCreationInput =
  | { kind: "document" | "data" | "slides"; title: string }
  | { kind: "query"; title: string; sourceArtifactId: string }
  | {
      kind: "chart";
      title: string;
      sourceArtifactId: string;
      category: string;
      value: string;
      mark: ChartCreationMark;
      format: ChartCreationFormat;
    };

export type ArtifactCreationSourceOption = {
  artifactId: string;
  name: string;
  kind: "data" | "query";
  columns: string[];
  numericColumns: string[];
};

export type PreparedArtifactCreation = {
  artifact?: WorkspaceArtifact;
  nextArtifacts: WorkspaceArtifact[];
  errors: string[];
};

export type ArtifactCreationCommit = {
  committed: boolean;
  error: string;
};

function normalizeArtifactTitle(value: string) {
  return value.normalize("NFKC").replace(/[\t ]+/g, " ").trim();
}

function validateArtifactTitle(value: string) {
  if (!value.trim()) return "Give the new artifact a title.";
  if (/[\u0000-\u001f\u007f<>]/.test(value)) return "Titles cannot contain line breaks, control characters, or angle brackets.";
  const normalized = normalizeArtifactTitle(value);
  if (normalized.length > MAX_ARTIFACT_TITLE_CHARS) return `Titles are limited to ${MAX_ARTIFACT_TITLE_CHARS} characters.`;
  return "";
}

function artifactSlug(title: string) {
  const words = normalizeArtifactTitle(title)
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLocaleLowerCase("en-US")
    .match(/[\p{L}\p{N}]+/gu);
  let slug = words ? [...words.join("-")].slice(0, 64).join("") : "untitled";
  if (/^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])$/i.test(slug)) slug = `rune-${slug}`;
  return slug;
}

function finiteChartNumber(value: unknown) {
  if (typeof value === "number") return Number.isFinite(value);
  if (typeof value !== "string" || !value.trim()) return false;
  return Number.isFinite(Number(value.replace(/[$,%\s]/g, "")));
}

function dataSourceOption(artifact: WorkspaceArtifact): ArtifactCreationSourceOption | null {
  const parsed = parseDataSource(artifact.source);
  if (parsed.errors.length || !parsed.columns.length) return null;
  return {
    artifactId: artifact.id,
    name: artifact.name,
    kind: "data",
    columns: parsed.columns,
    numericColumns: parsed.columns.filter((column) => (
      parsed.rows.length > 0 && parsed.rows.every((row) => finiteChartNumber(row[column]))
    )),
  };
}

function querySourceOption(
  artifact: WorkspaceArtifact,
  artifacts: WorkspaceArtifact[],
): ArtifactCreationSourceOption | null {
  const resolution = resolveQueryDataArtifact(artifact, artifacts);
  if (!resolution.artifact) return null;
  const parsed = parseDataSource(resolution.artifact.source);
  if (parsed.errors.length || !parsed.columns.length) return null;
  const output = inferQueryOutputColumns(artifact.source, parsed.columns);
  if (output.errors.length || !output.columns.length) return null;
  return {
    artifactId: artifact.id,
    name: artifact.name,
    kind: "query",
    columns: output.columns,
    numericColumns: [],
  };
}

export function artifactCreationSourceOptions(
  artifacts: WorkspaceArtifact[],
  kind: "query" | "chart",
): ArtifactCreationSourceOption[] {
  const data = artifacts
    .filter((artifact) => artifact.kind === "data")
    .flatMap((artifact) => {
      const option = dataSourceOption(artifact);
      return option ? [option] : [];
    });
  if (kind === "query") return data;
  const queries = artifacts
    .filter((artifact) => artifact.kind === "query")
    .flatMap((artifact) => {
      const option = querySourceOption(artifact, artifacts);
      return option ? [option] : [];
    });
  return [...data, ...queries];
}

function sourceFor(input: ArtifactCreationInput, title: string) {
  if (input.kind === "document") return `# ${title}\n\n`;
  if (input.kind === "data") return "Item,Value\n";
  if (input.kind === "query") {
    return `${formatQueryDataSourceDirective(input.sourceArtifactId)}\nSELECT *\nFROM workspace_data;\n`;
  }
  if (input.kind === "chart") {
    return `${JSON.stringify({
      version: 1,
      title,
      description: "",
      source: input.sourceArtifactId,
      mark: input.mark,
      category: input.category,
      value: input.value,
      sort: input.mark === "line" ? "source" : "descending",
      format: input.format,
      color: "#ff5c35",
      maxItems: 8,
    }, null, 2)}\n`;
  }
  return `---
version: 1
title: ${title}
theme: rune
ratio: 16:9
lang: en
---

<!-- layout: cover -->

# ${title}
`;
}

function artifactFor(input: ArtifactCreationInput): WorkspaceArtifact {
  const title = normalizeArtifactTitle(input.title);
  const slug = artifactSlug(title);
  if (input.kind === "document") {
    return { id: slug, name: `${slug}.md`, kind: "document", language: "Markdown", source: sourceFor(input, title) };
  }
  if (input.kind === "data") {
    return { id: slug, name: `${slug}.csv`, kind: "data", language: "CSV / JSON", source: sourceFor(input, title) };
  }
  if (input.kind === "query") {
    return { id: slug, name: `${slug}.sql`, kind: "query", language: "DuckDB SQL", source: sourceFor(input, title) };
  }
  if (input.kind === "chart") {
    return { id: slug, name: `${slug}.chart.json`, kind: "chart", language: "Chart JSON", source: sourceFor(input, title) };
  }
  return { id: slug, name: `${slug}.deck.md`, kind: "slides", language: "Deck Markdown", source: sourceFor(input, title) };
}

function validateCreationBinding(existing: WorkspaceArtifact[], input: ArtifactCreationInput) {
  if (input.kind === "query") {
    const source = existing.find((artifact) => artifact.id === input.sourceArtifactId);
    if (!source) return `Choose an existing Data source for the new Query.`;
    if (source.kind !== "data") return `Query source must be a Data artifact: ${input.sourceArtifactId}`;
    return "";
  }
  if (input.kind !== "chart") return "";
  const source = artifactCreationSourceOptions(existing, "chart")
    .find((option) => option.artifactId === input.sourceArtifactId);
  if (!source) return "Choose a valid Data or Query source for the new Chart.";
  const categoryMatches = source.columns.filter((column) => column === input.category).length;
  const valueMatches = source.columns.filter((column) => column === input.value).length;
  if (categoryMatches !== 1) return `Choose one exact category field from ${source.name}.`;
  if (valueMatches !== 1) return `Choose one exact value field from ${source.name}.`;
  if (!["bar", "line"].includes(input.mark)) return "Choose a supported Chart mark.";
  if (!["number", "currency", "percent"].includes(input.format)) return "Choose a supported Chart number format.";
  return "";
}

export function prepareArtifactCreation(
  existing: WorkspaceArtifact[],
  input: ArtifactCreationInput,
): PreparedArtifactCreation {
  if (existing.length >= MAX_WORKSPACE_ARTIFACTS) {
    return { nextArtifacts: existing, errors: [`Rune workspaces are limited to ${MAX_WORKSPACE_ARTIFACTS} artifacts.`] };
  }
  if (!creatableArtifactTypes.some((type) => type.kind === input.kind)) {
    return { nextArtifacts: existing, errors: ["Choose a supported artifact type."] };
  }
  const titleError = validateArtifactTitle(input.title);
  if (titleError) return { nextArtifacts: existing, errors: [titleError] };
  const bindingError = validateCreationBinding(existing, input);
  if (bindingError) return { nextArtifacts: existing, errors: [bindingError] };

  const artifact = resolveArtifactConflicts(existing, [artifactFor(input)])[0];
  const nextArtifacts = [...existing, artifact];
  const errors = validateWorkspaceArtifacts(nextArtifacts);
  return errors.length
    ? { nextArtifacts: existing, errors }
    : { artifact, nextArtifacts, errors: [] };
}

export function commitPreparedArtifactCreation(
  prepared: PreparedArtifactCreation,
  persist: (artifacts: WorkspaceArtifact[], selectedId: string) => void,
): ArtifactCreationCommit {
  if (!prepared.artifact || prepared.errors.length) {
    return { committed: false, error: prepared.errors[0] ?? "Rune could not create that artifact." };
  }
  try {
    persist(prepared.nextArtifacts, prepared.artifact.id);
    return { committed: true, error: "" };
  } catch {
    return { committed: false, error: "Device storage is full, so Rune kept the workspace unchanged." };
  }
}
