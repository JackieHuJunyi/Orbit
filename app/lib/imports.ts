import { validateWorkspaceArtifacts } from "./patches.ts";
import { resolveArtifactConflicts } from "./artifact-identity.ts";
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

export function prepareWorkspaceImport(
  existing: WorkspaceArtifact[],
  imported: WorkspaceArtifact[],
): PreparedWorkspaceImport {
  if (!imported.length) return {
    importedArtifacts: [],
    nextArtifacts: existing,
    errors: ["The import did not produce any readable artifacts."],
  };
  const importedArtifacts = resolveArtifactConflicts(existing, imported);
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
