import { validateWorkspaceArtifacts } from "./patches.ts";
import type { WorkspaceArtifact } from "./workspace.ts";

export type PreparedWorkspaceImport = {
  importedArtifacts: WorkspaceArtifact[];
  nextArtifacts: WorkspaceArtifact[];
  errors: string[];
};

export type WorkspaceImportReview = {
  sourceName: string;
  baseArtifacts: WorkspaceArtifact[];
  importedArtifacts: WorkspaceArtifact[];
  nextArtifacts: WorkspaceArtifact[];
  warnings: string[];
};

export type PreparedWorkspaceImportReview = {
  review: WorkspaceImportReview | null;
  errors: string[];
};

export type ImportSourcePreview = {
  text: string;
  lineCount: number;
  charCount: number;
  truncated: boolean;
};

const MAX_IMPORT_PREVIEW_LINES = 12;
const MAX_IMPORT_PREVIEW_CHARS = 1_600;

function artifactNameParts(name: string) {
  const lower = name.toLowerCase();
  const compound = [".deck.md", ".chart.json"].find((extension) => lower.endsWith(extension));
  if (compound) return { stem: name.slice(0, -compound.length), extension: name.slice(-compound.length) };
  const dot = name.lastIndexOf(".");
  return dot > 0 ? { stem: name.slice(0, dot), extension: name.slice(dot) } : { stem: name, extension: "" };
}

export function resolveImportConflicts(existing: WorkspaceArtifact[], imported: WorkspaceArtifact[]) {
  const names = new Set(existing.map((artifact) => artifact.name.normalize("NFKC").toLocaleLowerCase("en-US")));
  const ids = new Set(existing.map((artifact) => artifact.id));
  return imported.map((artifact) => {
    const parts = artifactNameParts(artifact.name);
    let name = artifact.name;
    let nameSuffix = 2;
    while (names.has(name.normalize("NFKC").toLocaleLowerCase("en-US"))) {
      name = `${parts.stem}-${nameSuffix}${parts.extension}`;
      nameSuffix += 1;
    }
    names.add(name.normalize("NFKC").toLocaleLowerCase("en-US"));
    let id = artifact.id;
    let idSuffix = 2;
    while (ids.has(id)) {
      id = `${artifact.id}-${idSuffix}`;
      idSuffix += 1;
    }
    ids.add(id);
    return { ...artifact, id, name };
  });
}

export function prepareWorkspaceImport(
  existing: WorkspaceArtifact[],
  imported: WorkspaceArtifact[],
): PreparedWorkspaceImport {
  if (!imported.length) return {
    importedArtifacts: [],
    nextArtifacts: existing,
    errors: ["The import did not produce any readable artifacts."],
  };
  const importedArtifacts = resolveImportConflicts(existing, imported);
  const nextArtifacts = [...existing, ...importedArtifacts];
  const errors = validateWorkspaceArtifacts(nextArtifacts);
  return errors.length
    ? { importedArtifacts: [], nextArtifacts: existing, errors }
    : { importedArtifacts, nextArtifacts, errors: [] };
}

export function prepareWorkspaceImportReview(
  existing: WorkspaceArtifact[],
  imported: WorkspaceArtifact[],
  sourceName: string,
  warnings: string[] = [],
): PreparedWorkspaceImportReview {
  if (!sourceName.trim()) return { review: null, errors: ["The import source needs a filename."] };
  const prepared = prepareWorkspaceImport(existing, imported);
  if (prepared.errors.length) return { review: null, errors: prepared.errors };
  return {
    review: {
      sourceName,
      baseArtifacts: existing,
      importedArtifacts: prepared.importedArtifacts,
      nextArtifacts: prepared.nextArtifacts,
      warnings: [...new Set(warnings)],
    },
    errors: [],
  };
}

export function validateWorkspaceImportReview(
  current: WorkspaceArtifact[],
  review: WorkspaceImportReview,
) {
  return current === review.baseArtifacts
    ? []
    : ["The workspace changed while this file was being converted. Cancel and import it again to review a fresh transaction."];
}

export function createImportSourcePreview(source: string): ImportSourcePreview {
  const normalized = source.replace(/\r\n?/g, "\n");
  const lines = normalized.split("\n");
  const linePreview = lines.slice(0, MAX_IMPORT_PREVIEW_LINES).join("\n");
  const text = linePreview.slice(0, MAX_IMPORT_PREVIEW_CHARS);
  return {
    text: text || " ",
    lineCount: lines.length,
    charCount: source.length,
    truncated: lines.length > MAX_IMPORT_PREVIEW_LINES || linePreview.length > MAX_IMPORT_PREVIEW_CHARS,
  };
}
