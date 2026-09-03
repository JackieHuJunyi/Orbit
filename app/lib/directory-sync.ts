import type { DirectoryReadResult } from "./directory-workspace.ts";
import type { PreparedOrbitImageAsset } from "./local-assets.ts";
import { validateWorkspaceArtifacts } from "./patches.ts";
import type { WorkspaceArtifact } from "./workspace.ts";

export type DirectorySyncMode = "pull" | "push" | "initialize";

export type DirectorySyncAssetFact = Readonly<{
  id: string;
  name: string;
  mimeType: string;
  size: number;
}>;

export type DirectorySyncChange = Readonly<{
  name: string;
  entryType: "source" | "asset";
  kind: "add" | "update" | "remove" | "retain" | "unchanged";
}>;

export type DirectorySyncFacts = Readonly<{
  artifactCount: number;
  assetCount: number;
}>;

export type DirectorySyncPlan = Readonly<{
  mode: DirectorySyncMode;
  directoryName: string;
  baseDeviceStateSnapshot: string;
  baseWorkspaceSnapshot: string;
  baseDirectorySnapshot: string;
  device: DirectorySyncFacts;
  folder: DirectorySyncFacts;
  target: DirectorySyncFacts;
  changes: readonly DirectorySyncChange[];
  changedCount: number;
  unchangedCount: number;
  retainedCount: number;
}>;

export type PreparedDirectorySync = Readonly<{
  plan: DirectorySyncPlan | null;
  errors: readonly string[];
}>;

export type CommitDirectorySyncPorts = Readonly<{
  expectedPlan: DirectorySyncPlan;
  readCurrentDeviceStateSnapshot: () => string;
  readCurrentArtifacts: () => WorkspaceArtifact[];
  readCurrentAssets: () => Promise<PreparedOrbitImageAsset[]>;
  readDirectory: () => Promise<DirectoryReadResult>;
  apply: (
    plan: DirectorySyncPlan,
    directory: DirectoryReadResult,
    currentAssets: PreparedOrbitImageAsset[],
  ) => Promise<void>;
}>;

const ASSET_ID = /^[0-9a-f]{64}$/u;

function failed(...errors: string[]): PreparedDirectorySync {
  return Object.freeze({ plan: null, errors: Object.freeze(errors) });
}

function artifactSnapshot(artifacts: readonly WorkspaceArtifact[]) {
  return JSON.stringify(
    artifacts.map(({ id, name, kind, language, source }) => ({ id, name, kind, language, source })),
  );
}

function assetFacts(assets: readonly PreparedOrbitImageAsset[]): DirectorySyncAssetFact[] {
  return assets.map(({ id, name, mimeType, size }) => ({ id, name, mimeType, size }));
}

function normalizeAssetFacts(input: readonly DirectorySyncAssetFact[]) {
  const facts: DirectorySyncAssetFact[] = [];
  const ids = new Set<string>();
  for (const asset of input) {
    if (
      !ASSET_ID.test(asset.id) ||
      typeof asset.name !== "string" ||
      !asset.name.trim() ||
      typeof asset.mimeType !== "string" ||
      !Number.isInteger(asset.size) ||
      asset.size < 1 ||
      ids.has(asset.id)
    )
      return null;
    ids.add(asset.id);
    facts.push(Object.freeze({ ...asset }));
  }
  return facts;
}

export function serializeDirectoryReadResult(result: DirectoryReadResult) {
  return JSON.stringify({
    source: result.source,
    artifacts: result.artifacts.map(({ id, name, kind, language, source }) => ({ id, name, kind, language, source })),
    assets: assetFacts(result.assets),
    errors: result.errors,
  });
}

function artifactIdentity(artifact: WorkspaceArtifact) {
  return JSON.stringify({
    id: artifact.id,
    name: artifact.name,
    kind: artifact.kind,
    language: artifact.language,
    source: artifact.source,
  });
}

function fileKey(name: string) {
  return name.normalize("NFKC").toLocaleLowerCase("en-US");
}

function hasRepeatedFileKey(artifacts: readonly WorkspaceArtifact[]) {
  return new Set(artifacts.map((artifact) => fileKey(artifact.name))).size !== artifacts.length;
}

function compareArtifacts(
  deviceArtifacts: readonly WorkspaceArtifact[],
  directoryArtifacts: readonly WorkspaceArtifact[],
  mode: DirectorySyncMode,
) {
  const source = mode === "pull" ? directoryArtifacts : deviceArtifacts;
  const destination = mode === "pull" ? deviceArtifacts : directoryArtifacts;
  const destinationByName = new Map(destination.map((artifact) => [fileKey(artifact.name), artifact] as const));
  const sourceNames = new Set(source.map((artifact) => fileKey(artifact.name)));
  const changes: DirectorySyncChange[] = source.map((artifact) => {
    const current = destinationByName.get(fileKey(artifact.name));
    return Object.freeze({
      name: artifact.name,
      entryType: "source" as const,
      kind: !current ? "add" : artifactIdentity(current) === artifactIdentity(artifact) ? "unchanged" : "update",
    });
  });
  for (const artifact of destination) {
    if (sourceNames.has(fileKey(artifact.name))) continue;
    changes.push(
      Object.freeze({
        name: artifact.name,
        entryType: "source" as const,
        kind: mode === "pull" ? ("remove" as const) : ("retain" as const),
      }),
    );
  }
  return changes;
}

function compareAssets(
  deviceAssets: readonly DirectorySyncAssetFact[],
  directoryAssets: readonly DirectorySyncAssetFact[],
  mode: DirectorySyncMode,
) {
  const source = mode === "pull" ? directoryAssets : deviceAssets;
  const destination = mode === "pull" ? deviceAssets : directoryAssets;
  const destinationById = new Map(destination.map((asset) => [asset.id, asset] as const));
  const sourceIds = new Set(source.map((asset) => asset.id));
  const changes: DirectorySyncChange[] = source.map((asset) => {
    const current = destinationById.get(asset.id);
    return Object.freeze({
      name: asset.name,
      entryType: "asset" as const,
      kind: !current ? "add" : JSON.stringify(current) === JSON.stringify(asset) ? "unchanged" : "update",
    });
  });
  for (const asset of destination) {
    if (sourceIds.has(asset.id)) continue;
    changes.push(
      Object.freeze({
        name: asset.name,
        entryType: "asset" as const,
        kind: mode === "pull" ? ("remove" as const) : ("retain" as const),
      }),
    );
  }
  return changes;
}

function exactAssetSet(left: readonly DirectorySyncAssetFact[], right: readonly DirectorySyncAssetFact[]) {
  if (left.length !== right.length) return false;
  const rightById = new Map(right.map((asset) => [asset.id, asset] as const));
  return left.every((asset) => JSON.stringify(asset) === JSON.stringify(rightById.get(asset.id)));
}

export function prepareDirectorySync(input: {
  mode: DirectorySyncMode;
  directoryName: string;
  deviceStateSnapshot: string;
  deviceArtifacts: WorkspaceArtifact[];
  deviceAssets: readonly DirectorySyncAssetFact[];
  directory: DirectoryReadResult;
}): PreparedDirectorySync {
  const directoryName = input.directoryName.normalize("NFKC").trim();
  if (!directoryName || directoryName.length > 240) return failed("The selected folder name is not valid.");
  if (!input.deviceStateSnapshot) return failed("The current device workspace snapshot is not available.");
  const deviceErrors = validateWorkspaceArtifacts(input.deviceArtifacts);
  if (deviceErrors.length) return failed(`The current workspace is not safe to sync. ${deviceErrors[0]}`);
  if (hasRepeatedFileKey(input.deviceArtifacts)) {
    return failed("The current workspace contains filenames that collide on a case-insensitive folder.");
  }
  if (input.directory.errors.length) return failed(input.directory.errors[0]);
  if (input.mode === "initialize" && input.directory.source !== "empty") {
    return failed("That folder is no longer empty. Review its current files before writing.");
  }
  if (input.mode === "pull" && input.directory.source === "empty") {
    return failed("That folder does not contain a Orbit workspace to pull.");
  }
  if (input.mode === "push" && input.directory.source === "empty") {
    return failed("Use the empty-folder initialization review for this folder.");
  }
  const folderErrors = input.directory.artifacts.length ? validateWorkspaceArtifacts(input.directory.artifacts) : [];
  if (folderErrors.length) return failed(`The folder workspace is not safe to sync. ${folderErrors[0]}`);
  if (hasRepeatedFileKey(input.directory.artifacts)) {
    return failed("The folder contains filenames that collide after case and Unicode normalization.");
  }
  const deviceAssets = normalizeAssetFacts(input.deviceAssets);
  const folderAssets = normalizeAssetFacts(assetFacts(input.directory.assets));
  if (!deviceAssets) return failed("The current workspace contains invalid or repeated local image identities.");
  if (!folderAssets) return failed("The folder contains invalid or repeated local image identities.");

  const baseWorkspaceSnapshot = artifactSnapshot(input.deviceArtifacts);
  const baseDirectorySnapshot = serializeDirectoryReadResult(input.directory);
  const changes = [
    ...compareArtifacts(input.deviceArtifacts, input.directory.artifacts, input.mode),
    ...compareAssets(deviceAssets, folderAssets, input.mode),
  ];
  const targetArtifacts = input.mode === "pull" ? input.directory.artifacts : input.deviceArtifacts;
  const targetAssets = input.mode === "pull" ? folderAssets : deviceAssets;
  const alreadyMatches =
    input.directory.source === "manifest" &&
    changes.every((change) => change.kind === "unchanged") &&
    exactAssetSet(deviceAssets, folderAssets);
  if (alreadyMatches) {
    return failed(
      input.mode === "pull"
        ? "This device workspace already matches the connected folder."
        : "The connected folder already matches this device workspace.",
    );
  }

  const frozenChanges = Object.freeze(changes.map((change) => Object.freeze({ ...change })));
  const plan: DirectorySyncPlan = Object.freeze({
    mode: input.mode,
    directoryName,
    baseDeviceStateSnapshot: input.deviceStateSnapshot,
    baseWorkspaceSnapshot,
    baseDirectorySnapshot,
    device: Object.freeze({ artifactCount: input.deviceArtifacts.length, assetCount: deviceAssets.length }),
    folder: Object.freeze({ artifactCount: input.directory.artifacts.length, assetCount: folderAssets.length }),
    target: Object.freeze({ artifactCount: targetArtifacts.length, assetCount: targetAssets.length }),
    changes: frozenChanges,
    changedCount: frozenChanges.filter((change) => ["add", "update", "remove"].includes(change.kind)).length,
    unchangedCount: frozenChanges.filter((change) => change.kind === "unchanged").length,
    retainedCount: frozenChanges.filter((change) => change.kind === "retain").length,
  });
  return Object.freeze({ plan, errors: Object.freeze([]) });
}

function planIdentity(plan: DirectorySyncPlan) {
  return JSON.stringify({
    mode: plan.mode,
    directoryName: plan.directoryName,
    baseDeviceStateSnapshot: plan.baseDeviceStateSnapshot,
    baseWorkspaceSnapshot: plan.baseWorkspaceSnapshot,
    baseDirectorySnapshot: plan.baseDirectorySnapshot,
    changes: plan.changes,
    device: plan.device,
    folder: plan.folder,
    target: plan.target,
    changedCount: plan.changedCount,
    unchangedCount: plan.unchangedCount,
    retainedCount: plan.retainedCount,
  });
}

export async function commitDirectorySync({
  expectedPlan,
  readCurrentDeviceStateSnapshot,
  readCurrentArtifacts,
  readCurrentAssets,
  readDirectory,
  apply,
}: CommitDirectorySyncPorts) {
  if (readCurrentDeviceStateSnapshot() !== expectedPlan.baseDeviceStateSnapshot) {
    throw new Error("The complete device workspace changed after this folder review opened. Review the sync again.");
  }
  const currentArtifacts = readCurrentArtifacts();
  if (artifactSnapshot(currentArtifacts) !== expectedPlan.baseWorkspaceSnapshot) {
    throw new Error("The device workspace changed after this folder review opened. Review the sync again.");
  }
  const [currentAssets, directory] = await Promise.all([readCurrentAssets(), readDirectory()]);
  if (serializeDirectoryReadResult(directory) !== expectedPlan.baseDirectorySnapshot) {
    throw new Error("The folder changed after this review opened. Read it again before syncing.");
  }
  const prepared = prepareDirectorySync({
    mode: expectedPlan.mode,
    directoryName: expectedPlan.directoryName,
    deviceStateSnapshot: expectedPlan.baseDeviceStateSnapshot,
    deviceArtifacts: currentArtifacts,
    deviceAssets: assetFacts(currentAssets),
    directory,
  });
  if (!prepared.plan || prepared.errors.length) {
    throw new Error(prepared.errors[0] ?? "Orbit could not validate this folder sync.");
  }
  if (planIdentity(prepared.plan) !== planIdentity(expectedPlan)) {
    throw new Error("The folder sync plan changed after review. Review the current files again.");
  }
  await apply(prepared.plan, directory, currentAssets);
  return prepared.plan;
}
