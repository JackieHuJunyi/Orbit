import { validateWorkspaceArtifacts } from "./patches.ts";
import { resolveArtifactConflicts } from "./artifact-identity.ts";
import {
  MAX_RUNE_LOCAL_IMAGE_BYTES,
  MAX_RUNE_LOCAL_IMAGES,
  extractRuneAssetIds,
  runeImageAssetMap,
  type PreparedRuneImageAsset,
} from "./local-assets.ts";
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
  assets: PreparedRuneImageAsset[];
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
  assets: PreparedRuneImageAsset[] = [],
): PreparedWorkspaceImportReview {
  if (!sourceName.trim()) return { review: null, errors: ["The import source needs a filename."] };
  const prepared = prepareWorkspaceImport(existing, imported);
  if (prepared.errors.length) return { review: null, errors: prepared.errors };
  const assetsById = new Map<string, PreparedRuneImageAsset>();
  try {
    assets.forEach((asset) => {
      runeImageAssetMap([asset]);
      const existingAsset = assetsById.get(asset.id);
      if (existingAsset && (existingAsset.size !== asset.size
        || existingAsset.mimeType !== asset.mimeType
        || existingAsset.bytes.some((value, index) => value !== asset.bytes[index]))) {
        throw new Error(`Imported image identity is bound to conflicting bytes: ${asset.id}`);
      }
      assetsById.set(asset.id, existingAsset ?? asset);
    });
  } catch (error) {
    return { review: null, errors: [error instanceof Error ? error.message : "The imported image assets are invalid."] };
  }
  const reviewedAssets = [...assetsById.values()];
  if (reviewedAssets.length > MAX_RUNE_LOCAL_IMAGES) {
    return { review: null, errors: [`One import can preserve at most ${MAX_RUNE_LOCAL_IMAGES} local images.`] };
  }
  if (reviewedAssets.reduce((total, asset) => total + asset.size, 0) > MAX_RUNE_LOCAL_IMAGE_BYTES) {
    return { review: null, errors: [`One import can preserve at most ${MAX_RUNE_LOCAL_IMAGE_BYTES / 1_048_576} MB of local images.`] };
  }
  if (reviewedAssets.length) {
    const referencedIds = new Set(prepared.importedArtifacts.flatMap((artifact) => extractRuneAssetIds(artifact.source)));
    const assetIds = new Set(reviewedAssets.map((asset) => asset.id));
    const missing = [...referencedIds].filter((id) => !assetIds.has(id));
    const unused = [...assetIds].filter((id) => !referencedIds.has(id));
    if (missing.length || unused.length) {
      return { review: null, errors: ["Imported sources and their local image assets do not form one exact portable transaction."] };
    }
  }
  return {
    review: {
      sourceName,
      baseArtifacts: existing,
      importedArtifacts: prepared.importedArtifacts,
      nextArtifacts: prepared.nextArtifacts,
      warnings: [...new Set(warnings)],
      assets: reviewedAssets,
    },
    errors: [],
  };
}

export function validateWorkspaceImportReview(
  current: WorkspaceArtifact[],
  review: WorkspaceImportReview,
) {
  if (current !== review.baseArtifacts) {
    return ["The workspace changed while this file was being converted. Cancel and import it again to review a fresh transaction."];
  }
  try {
    runeImageAssetMap(review.assets);
  } catch (error) {
    return [error instanceof Error ? error.message : "The reviewed image assets are invalid."];
  }
  if (review.assets.length) {
    const referencedIds = new Set(review.importedArtifacts.flatMap((artifact) => extractRuneAssetIds(artifact.source)));
    const assetIds = new Set(review.assets.map((asset) => asset.id));
    if (referencedIds.size !== assetIds.size || [...referencedIds].some((id) => !assetIds.has(id))) {
      return ["The reviewed sources and local images no longer form one exact transaction."];
    }
  }
  return [];
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
