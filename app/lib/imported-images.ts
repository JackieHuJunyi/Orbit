import {
  MAX_RUNE_LOCAL_IMAGE_BYTES,
  MAX_RUNE_LOCAL_IMAGES,
  createRuneAssetReference,
  prepareRuneImageAsset,
  runeImageAltFromName,
  runeImageAssetMap,
  type PreparedRuneImageAsset,
} from "./local-assets.ts";
import type { WorkspaceArtifact } from "./workspace.ts";

export type ImportedImageCandidate = {
  artifactId: string;
  token: string;
  name: string;
  claimedMimeType: string;
  bytes: Uint8Array;
};

export type FinalizedImportedImages = {
  artifacts: WorkspaceArtifact[];
  assets: PreparedRuneImageAsset[];
  warnings: string[];
};

const IMPORT_IMAGE_TOKEN_PREFIX = "RUNEIMPORTIMAGEPLACEHOLDER";

export function createImportedImageToken(index: number) {
  if (!Number.isSafeInteger(index) || index < 0)
    throw new Error("Imported image positions must be non-negative integers.");
  return `${IMPORT_IMAGE_TOKEN_PREFIX}${String(index).padStart(4, "0")}END`;
}

function tokenOccurrences(source: string, token: string) {
  return source.split(token).length - 1;
}

function normalizedWarningDetail(error: unknown) {
  const detail = error instanceof Error ? error.message : "the embedded bytes are not a supported Orbit image";
  return detail
    .replace(/^The selected image/iu, "The embedded image")
    .replace(/^Choose/iu, "Orbit requires")
    .replace(/[.!?]+$/u, "");
}

function importedImageMarkdown(name: string, id: string) {
  const alt = runeImageAltFromName(name).replace(/\\/gu, "\\\\").replace(/\[/gu, "\\[").replace(/\]/gu, "\\]");
  return `![${alt}](${createRuneAssetReference(id)})`;
}

export async function finalizeImportedImages(
  artifacts: WorkspaceArtifact[],
  candidates: readonly ImportedImageCandidate[],
  warnings: readonly string[] = [],
): Promise<FinalizedImportedImages> {
  const tokens = new Set<string>();
  const artifactIds = new Set(artifacts.map((artifact) => artifact.id));
  for (const candidate of candidates) {
    if (!artifactIds.has(candidate.artifactId))
      throw new Error(`Imported image targets an unknown artifact: ${candidate.artifactId}`);
    if (!candidate.token.startsWith(IMPORT_IMAGE_TOKEN_PREFIX) || tokens.has(candidate.token)) {
      throw new Error("Imported image placeholders must be unique and converter-owned.");
    }
    tokens.add(candidate.token);
    const targetCount = artifacts.reduce(
      (total, artifact) => total + tokenOccurrences(artifact.source, candidate.token),
      0,
    );
    if (targetCount !== 1)
      throw new Error("Imported image placement changed during conversion; Orbit refused an ambiguous result.");
  }

  const replacements = new Map<string, string>();
  const assetsById = new Map<string, PreparedRuneImageAsset>();
  const nextWarnings = [...warnings];
  for (const candidate of candidates) {
    try {
      const asset = await prepareRuneImageAsset(
        candidate.name,
        candidate.claimedMimeType,
        candidate.bytes.slice().buffer as ArrayBuffer,
      );
      runeImageAssetMap([asset]);
      assetsById.set(asset.id, assetsById.get(asset.id) ?? asset);
      replacements.set(candidate.token, importedImageMarkdown(candidate.name, asset.id));
    } catch (error) {
      replacements.set(candidate.token, "");
      nextWarnings.push(`Embedded image “${candidate.name}” was omitted: ${normalizedWarningDetail(error)}.`);
    }
  }

  const assets = [...assetsById.values()];
  if (assets.length > MAX_RUNE_LOCAL_IMAGES)
    throw new Error(`One import can preserve at most ${MAX_RUNE_LOCAL_IMAGES} local images.`);
  const totalBytes = assets.reduce((total, asset) => total + asset.size, 0);
  if (totalBytes > MAX_RUNE_LOCAL_IMAGE_BYTES) {
    throw new Error(`One import can preserve at most ${MAX_RUNE_LOCAL_IMAGE_BYTES / 1_048_576} MB of local images.`);
  }
  runeImageAssetMap(assets);

  const nextArtifacts = artifacts.map((artifact) => {
    let source = artifact.source;
    candidates
      .filter((candidate) => candidate.artifactId === artifact.id)
      .forEach((candidate) => {
        source = source.replace(candidate.token, replacements.get(candidate.token) ?? "");
      });
    if (source.includes(IMPORT_IMAGE_TOKEN_PREFIX)) {
      throw new Error("An imported image placeholder escaped finalization; Orbit kept the workspace unchanged.");
    }
    return source === artifact.source ? artifact : { ...artifact, source: source.replace(/\n{3,}/gu, "\n\n") };
  });

  if (assets.length) {
    nextWarnings.push(
      `${assets.length} verified local image${assets.length === 1 ? " was" : "s were"} preserved as portable content-hash assets.`,
    );
  }
  return { artifacts: nextArtifacts, assets, warnings: [...new Set(nextWarnings)] };
}
