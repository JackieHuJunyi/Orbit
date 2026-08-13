import { z } from "zod";
import { detectArtifact, type ArtifactKind, type WorkspaceArtifact } from "./workspace.ts";
import { validateWorkspaceArtifacts } from "./patches.ts";
import {
  extractRuneAssetIds,
  MAX_RUNE_IMAGE_BYTES,
  MAX_RUNE_LOCAL_IMAGE_BYTES,
  MAX_RUNE_LOCAL_IMAGES,
  prepareRuneImageAsset,
  type PreparedRuneImageAsset,
} from "./local-assets.ts";

export const WORKSPACE_MANIFEST_NAME = "rune.workspace.json";
export const WORKSPACE_ASSET_DIRECTORY_NAME = ".rune-assets";
export const MAX_DIRECTORY_ARTIFACTS = 50;
export const MAX_DIRECTORY_FILE_BYTES = 2 * 1024 * 1024;
export const MAX_DIRECTORY_TOTAL_BYTES = 8 * 1024 * 1024;

export type DirectoryFile = {
  size: number;
  text(): Promise<string>;
  arrayBuffer(): Promise<ArrayBuffer>;
};

export type DirectoryWritable = {
  write(data: string | Uint8Array): Promise<void>;
  close(): Promise<void>;
};

export type DirectoryFileHandle = {
  kind: "file";
  name: string;
  getFile(): Promise<DirectoryFile>;
  createWritable(): Promise<DirectoryWritable>;
};

export type DirectoryEntryHandle = DirectoryFileHandle | { kind: "directory"; name: string };

export type DirectoryAssetHandle = {
  kind: "directory";
  name: string;
  getFileHandle(name: string, options?: { create?: boolean }): Promise<DirectoryFileHandle>;
};

export type DirectoryWorkspaceHandle = {
  kind: "directory";
  name: string;
  getFileHandle(name: string, options?: { create?: boolean }): Promise<DirectoryFileHandle>;
  getDirectoryHandle(name: string, options?: { create?: boolean }): Promise<DirectoryAssetHandle>;
  entries(): AsyncIterableIterator<[string, DirectoryEntryHandle]>;
};

const safeFileName = z.string().min(1).max(240).refine(
  (name) => name !== WORKSPACE_MANIFEST_NAME
    && name !== "."
    && name !== ".."
    && !name.startsWith(".")
    && !/[\\/\0]/.test(name),
  "Artifact names must be plain, non-hidden file names.",
);

const ManifestArtifactSchema = z.object({
  id: z.string().min(1).max(120),
  name: safeFileName,
  kind: z.enum(["document", "data", "query", "chart", "slides"]),
  language: z.string().min(1).max(80),
}).strict();

const ManifestAssetSchema = z.object({
  id: z.string().regex(/^[0-9a-f]{64}$/u),
  name: z.string().min(1).max(180).refine((name) => !/[\\/\0]/u.test(name), "Asset names must be plain file names."),
  mimeType: z.enum(["image/png", "image/jpeg", "image/webp", "image/gif"]),
  size: z.number().int().min(1).max(MAX_RUNE_IMAGE_BYTES),
}).strict();

export const WorkspaceManifestSchema = z.object({
  version: z.union([z.literal(1), z.literal(2)]),
  artifacts: z.array(ManifestArtifactSchema).min(1).max(MAX_DIRECTORY_ARTIFACTS),
  assets: z.array(ManifestAssetSchema).max(MAX_RUNE_LOCAL_IMAGES).optional(),
}).strict().superRefine((manifest, context) => {
  const ids = new Set<string>();
  const names = new Set<string>();
  manifest.artifacts.forEach((artifact, index) => {
    if (ids.has(artifact.id)) context.addIssue({ code: "custom", path: ["artifacts", index, "id"], message: "Artifact ids must be unique." });
    if (names.has(artifact.name)) context.addIssue({ code: "custom", path: ["artifacts", index, "name"], message: "Artifact names must be unique." });
    ids.add(artifact.id);
    names.add(artifact.name);
  });
  if (manifest.version === 1 && manifest.assets?.length) context.addIssue({ code: "custom", path: ["assets"], message: "Version 1 manifests cannot declare assets." });
  const assetIds = new Set<string>();
  let assetBytes = 0;
  (manifest.assets ?? []).forEach((asset, index) => {
    if (assetIds.has(asset.id)) context.addIssue({ code: "custom", path: ["assets", index, "id"], message: "Asset ids must be unique." });
    assetIds.add(asset.id);
    assetBytes += asset.size;
  });
  if (assetBytes > MAX_RUNE_LOCAL_IMAGE_BYTES) context.addIssue({ code: "custom", path: ["assets"], message: "Asset bytes exceed Rune's 64 MB folder limit." });
});

export type WorkspaceManifest = z.infer<typeof WorkspaceManifestSchema>;

export type DirectoryReadResult = {
  artifacts: WorkspaceArtifact[];
  assets: PreparedRuneImageAsset[];
  errors: string[];
  source: "manifest" | "scan" | "empty";
};

function formatManifestError(error: z.ZodError) {
  return error.issues.map((issue) => {
    const path = issue.path.length ? `${issue.path.join(".")}: ` : "";
    return `${path}${issue.message}`;
  });
}

function assetExtension(mimeType: PreparedRuneImageAsset["mimeType"]) {
  return mimeType === "image/png" ? "png" : mimeType === "image/jpeg" ? "jpg" : mimeType === "image/webp" ? "webp" : "gif";
}

export function workspaceAssetFileName(asset: Pick<PreparedRuneImageAsset, "id" | "mimeType">) {
  return `${asset.id}.${assetExtension(asset.mimeType)}`;
}

export function buildWorkspaceManifest(artifacts: WorkspaceArtifact[], assets: PreparedRuneImageAsset[] = []): WorkspaceManifest {
  const mismatched = artifacts.find((artifact) => !validateDetectedKind(artifact.name, artifact.source, artifact.kind));
  if (mismatched) throw new Error(`${mismatched.name} does not match its declared ${mismatched.kind} kind.`);
  const referencedIds = new Set(artifacts.flatMap((artifact) => extractRuneAssetIds(artifact.source)));
  const assetById = new Map(assets.map((asset) => [asset.id, asset] as const));
  const missing = [...referencedIds].find((id) => !assetById.has(id));
  if (missing) throw new Error(`Referenced local image is missing: ${missing}`);
  const unreferenced = assets.find((asset) => !referencedIds.has(asset.id));
  if (unreferenced) throw new Error(`Folder asset is not referenced by this workspace: ${unreferenced.id}`);
  return WorkspaceManifestSchema.parse({
    version: assets.length ? 2 : 1,
    artifacts: artifacts.map(({ id, name, kind, language }) => ({ id, name, kind, language })),
    ...(assets.length ? { assets: assets.map(({ id, name, mimeType, size }) => ({ id, name, mimeType, size })) } : {}),
  });
}

export function serializeWorkspaceManifest(artifacts: WorkspaceArtifact[], assets: PreparedRuneImageAsset[] = []) {
  return `${JSON.stringify(buildWorkspaceManifest(artifacts, assets), null, 2)}\n`;
}

export function parseWorkspaceManifest(source: string): { manifest?: WorkspaceManifest; errors: string[] } {
  let value: unknown;
  try {
    value = JSON.parse(source);
  } catch (error) {
    return { errors: [error instanceof Error ? `Invalid workspace manifest: ${error.message}` : "Invalid workspace manifest."] };
  }
  const parsed = WorkspaceManifestSchema.safeParse(value);
  return parsed.success ? { manifest: parsed.data, errors: [] } : { errors: formatManifestError(parsed.error) };
}

function stableArtifactId(name: string, usedIds: Set<string>) {
  const base = name.toLowerCase()
    .replace(/\.(?:chart\.json|deck\.md|md|markdown|csv|json|sql|html|htm)$/i, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "") || "artifact";
  let id = base;
  let suffix = 2;
  while (usedIds.has(id)) {
    id = `${base}-${suffix}`;
    suffix += 1;
  }
  usedIds.add(id);
  return id;
}

async function readBoundedFile(handle: DirectoryFileHandle, budget: { total: number }) {
  const file = await handle.getFile();
  if (file.size > MAX_DIRECTORY_FILE_BYTES) throw new Error(`${handle.name} exceeds the 2 MB per-file limit.`);
  budget.total += file.size;
  if (budget.total > MAX_DIRECTORY_TOTAL_BYTES) throw new Error("The folder exceeds Rune's 8 MB source limit.");
  return file.text();
}

async function optionalFileHandle(directory: DirectoryWorkspaceHandle, name: string) {
  try {
    return await directory.getFileHandle(name);
  } catch (error) {
    if (typeof DOMException !== "undefined" && error instanceof DOMException && error.name === "NotFoundError") return null;
    if (error instanceof Error && /not found/i.test(error.message)) return null;
    throw error;
  }
}

async function optionalAssetDirectory(directory: DirectoryWorkspaceHandle) {
  try {
    return await directory.getDirectoryHandle(WORKSPACE_ASSET_DIRECTORY_NAME);
  } catch (error) {
    if (typeof DOMException !== "undefined" && error instanceof DOMException && error.name === "NotFoundError") return null;
    if (error instanceof Error && /not found/i.test(error.message)) return null;
    throw error;
  }
}

function validateDetectedKind(name: string, source: string, expected: ArtifactKind) {
  return detectArtifact(name, source)?.kind === expected;
}

export async function readWorkspaceDirectory(directory: DirectoryWorkspaceHandle): Promise<DirectoryReadResult> {
  const budget = { total: 0 };
  const manifestHandle = await optionalFileHandle(directory, WORKSPACE_MANIFEST_NAME);
  if (manifestHandle) {
    const manifestSource = await readBoundedFile(manifestHandle, budget);
    const parsed = parseWorkspaceManifest(manifestSource);
    if (!parsed.manifest) return { artifacts: [], assets: [], errors: parsed.errors, source: "manifest" };
    const artifacts: WorkspaceArtifact[] = [];
    for (const entry of parsed.manifest.artifacts) {
      let fileHandle: DirectoryFileHandle;
      try {
        fileHandle = await directory.getFileHandle(entry.name);
      } catch {
        return { artifacts: [], assets: [], errors: [`Manifest file not found: ${entry.name}`], source: "manifest" };
      }
      const source = await readBoundedFile(fileHandle, budget);
      if (!validateDetectedKind(entry.name, source, entry.kind)) {
        return { artifacts: [], assets: [], errors: [`${entry.name} does not match its declared ${entry.kind} kind.`], source: "manifest" };
      }
      artifacts.push({ ...entry, source });
    }
    const errors = validateWorkspaceArtifacts(artifacts);
    const referencedIds = new Set(artifacts.flatMap((artifact) => extractRuneAssetIds(artifact.source)));
    const manifestAssets = parsed.manifest.assets ?? [];
    if (referencedIds.size !== manifestAssets.length || manifestAssets.some((asset) => !referencedIds.has(asset.id))) {
      errors.push("Workspace image references do not exactly match the manifest asset list.");
    }
    const assets: PreparedRuneImageAsset[] = [];
    if (manifestAssets.length) {
      const assetDirectory = await optionalAssetDirectory(directory);
      if (!assetDirectory) errors.push(`Manifest asset folder not found: ${WORKSPACE_ASSET_DIRECTORY_NAME}`);
      else for (const asset of manifestAssets) {
        try {
          const handle = await assetDirectory.getFileHandle(workspaceAssetFileName(asset));
          const file = await handle.getFile();
          if (file.size !== asset.size) throw new Error("size does not match the manifest");
          const prepared = await prepareRuneImageAsset(asset.name, asset.mimeType, await file.arrayBuffer());
          if (prepared.id !== asset.id) throw new Error("content hash does not match the manifest");
          assets.push(prepared);
        } catch (error) {
          errors.push(`Invalid folder asset ${asset.id}: ${error instanceof Error ? error.message : "could not be read"}`);
        }
      }
    }
    return { artifacts: errors.length ? [] : artifacts, assets: errors.length ? [] : assets, errors, source: "manifest" };
  }

  const candidates: Array<{ name: string; handle: DirectoryFileHandle }> = [];
  for await (const [name, handle] of directory.entries()) {
    if (handle.kind !== "file" || name.startsWith(".")) continue;
    if (detectArtifact(name, "") != null) candidates.push({ name, handle });
  }
  candidates.sort((left, right) => left.name.localeCompare(right.name));
  if (!candidates.length) return { artifacts: [], assets: [], errors: [], source: "empty" };
  if (candidates.length > MAX_DIRECTORY_ARTIFACTS) {
    return { artifacts: [], assets: [], errors: [`The folder contains more than ${MAX_DIRECTORY_ARTIFACTS} supported source files.`], source: "scan" };
  }

  const usedIds = new Set<string>();
  const artifacts: WorkspaceArtifact[] = [];
  for (const candidate of candidates) {
    const source = await readBoundedFile(candidate.handle, budget);
    const detected = detectArtifact(candidate.name, source);
    if (detected) artifacts.push({ ...detected, id: stableArtifactId(candidate.name, usedIds) });
  }
  const errors = validateWorkspaceArtifacts(artifacts);
  if (artifacts.some((artifact) => extractRuneAssetIds(artifact.source).length)) errors.push("A manifest-free folder cannot resolve Rune local image references.");
  return { artifacts: errors.length ? [] : artifacts, assets: [], errors, source: "scan" };
}

export async function writeWorkspaceDirectory(
  directory: DirectoryWorkspaceHandle,
  artifacts: WorkspaceArtifact[],
  assets: PreparedRuneImageAsset[] = [],
): Promise<string[]> {
  const validationErrors = validateWorkspaceArtifacts(artifacts);
  if (validationErrors.length) throw new Error(validationErrors[0]);
  buildWorkspaceManifest(artifacts, assets);
  for (const asset of assets) {
    const verified = await prepareRuneImageAsset(asset.name, asset.mimeType, asset.bytes.slice().buffer as ArrayBuffer);
    if (verified.id !== asset.id || verified.size !== asset.size) throw new Error(`Folder asset failed content verification: ${asset.id}`);
  }
  const totalBytes = artifacts.reduce((total, artifact) => {
    const size = new TextEncoder().encode(artifact.source).byteLength;
    if (size > MAX_DIRECTORY_FILE_BYTES) throw new Error(`${artifact.name} exceeds the 2 MB per-file limit.`);
    return total + size;
  }, 0);
  if (totalBytes > MAX_DIRECTORY_TOTAL_BYTES) throw new Error("The workspace exceeds Rune's 8 MB source limit.");

  if (assets.length) {
    const assetDirectory = await directory.getDirectoryHandle(WORKSPACE_ASSET_DIRECTORY_NAME, { create: true });
    for (const asset of assets) {
      try {
        const handle = await assetDirectory.getFileHandle(workspaceAssetFileName(asset), { create: true });
        const writable = await handle.createWritable();
        await writable.write(asset.bytes);
        await writable.close();
      } catch (error) {
        const detail = error instanceof Error ? error.message : "The asset could not be written.";
        throw new Error(`Folder write stopped at ${workspaceAssetFileName(asset)}: ${detail}`);
      }
    }
  }

  const written: string[] = [];
  for (const artifact of artifacts) {
    try {
      const handle = await directory.getFileHandle(artifact.name, { create: true });
      const writable = await handle.createWritable();
      await writable.write(artifact.source);
      await writable.close();
      written.push(artifact.name);
    } catch (error) {
      const detail = error instanceof Error ? error.message : "The file could not be written.";
      throw new Error(`Folder write stopped at ${artifact.name}: ${detail}`);
    }
  }
  try {
    const manifestHandle = await directory.getFileHandle(WORKSPACE_MANIFEST_NAME, { create: true });
    const manifestWritable = await manifestHandle.createWritable();
    await manifestWritable.write(serializeWorkspaceManifest(artifacts, assets));
    await manifestWritable.close();
    written.push(WORKSPACE_MANIFEST_NAME);
  } catch (error) {
    const detail = error instanceof Error ? error.message : "The manifest could not be written.";
    throw new Error(`Folder write stopped at ${WORKSPACE_MANIFEST_NAME}: ${detail}`);
  }
  return written;
}

type DirectoryPickerWindow = Window & {
  showDirectoryPicker?: (options: { mode: "readwrite" }) => Promise<DirectoryWorkspaceHandle>;
};

export function supportsDirectoryWorkspace() {
  return typeof window !== "undefined" && typeof (window as DirectoryPickerWindow).showDirectoryPicker === "function";
}

export async function chooseWorkspaceDirectory() {
  const picker = (window as DirectoryPickerWindow).showDirectoryPicker;
  if (!picker) throw new Error("Folder workspaces require a browser with the File System Access API.");
  return picker({ mode: "readwrite" });
}
