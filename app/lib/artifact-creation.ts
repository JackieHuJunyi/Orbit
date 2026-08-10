import { resolveArtifactConflicts } from "./artifact-identity.ts";
import { validateWorkspaceArtifacts } from "./patches.ts";
import type { WorkspaceArtifact } from "./workspace.ts";

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
    kind: "slides",
    label: "Presentation",
    format: "Deck Markdown",
    extension: ".deck.md",
    description: "A structured deck compiled to live HTML.",
  },
] as const;

export type CreatableArtifactKind = typeof creatableArtifactTypes[number]["kind"];

export type ArtifactCreationInput = {
  kind: CreatableArtifactKind;
  title: string;
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

function sourceFor(kind: CreatableArtifactKind, title: string) {
  if (kind === "document") return `# ${title}\n\n`;
  if (kind === "data") return "Item,Value\n";
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
    return { id: slug, name: `${slug}.md`, kind: "document", language: "Markdown", source: sourceFor(input.kind, title) };
  }
  if (input.kind === "data") {
    return { id: slug, name: `${slug}.csv`, kind: "data", language: "CSV / JSON", source: sourceFor(input.kind, title) };
  }
  return { id: slug, name: `${slug}.deck.md`, kind: "slides", language: "Deck Markdown", source: sourceFor(input.kind, title) };
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
