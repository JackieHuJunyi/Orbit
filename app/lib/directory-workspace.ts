import { z } from "zod";
import { detectArtifact, type ArtifactKind, type WorkspaceArtifact } from "./workspace.ts";
import { validateWorkspaceArtifacts } from "./patches.ts";

export const WORKSPACE_MANIFEST_NAME = "rune.workspace.json";
export const MAX_DIRECTORY_ARTIFACTS = 50;
export const MAX_DIRECTORY_FILE_BYTES = 2 * 1024 * 1024;
export const MAX_DIRECTORY_TOTAL_BYTES = 8 * 1024 * 1024;

export type DirectoryFile = {
  size: number;
  text(): Promise<string>;
};

export type DirectoryWritable = {
  write(data: string): Promise<void>;
  close(): Promise<void>;
};

export type DirectoryFileHandle = {
  kind: "file";
  name: string;
  getFile(): Promise<DirectoryFile>;
  createWritable(): Promise<DirectoryWritable>;
};

export type DirectoryEntryHandle = DirectoryFileHandle | { kind: "directory"; name: string };

export type DirectoryWorkspaceHandle = {
  kind: "directory";
  name: string;
  getFileHandle(name: string, options?: { create?: boolean }): Promise<DirectoryFileHandle>;
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

export const WorkspaceManifestSchema = z.object({
  version: z.literal(1),
  artifacts: z.array(ManifestArtifactSchema).min(1).max(MAX_DIRECTORY_ARTIFACTS),
}).strict().superRefine((manifest, context) => {
  const ids = new Set<string>();
  const names = new Set<string>();
  manifest.artifacts.forEach((artifact, index) => {
    if (ids.has(artifact.id)) context.addIssue({ code: "custom", path: ["artifacts", index, "id"], message: "Artifact ids must be unique." });
    if (names.has(artifact.name)) context.addIssue({ code: "custom", path: ["artifacts", index, "name"], message: "Artifact names must be unique." });
    ids.add(artifact.id);
    names.add(artifact.name);
  });
});

export type WorkspaceManifest = z.infer<typeof WorkspaceManifestSchema>;

export type DirectoryReadResult = {
  artifacts: WorkspaceArtifact[];
  errors: string[];
  source: "manifest" | "scan" | "empty";
};

function formatManifestError(error: z.ZodError) {
  return error.issues.map((issue) => {
    const path = issue.path.length ? `${issue.path.join(".")}: ` : "";
    return `${path}${issue.message}`;
  });
}

export function buildWorkspaceManifest(artifacts: WorkspaceArtifact[]): WorkspaceManifest {
  const mismatched = artifacts.find((artifact) => !validateDetectedKind(artifact.name, artifact.source, artifact.kind));
  if (mismatched) throw new Error(`${mismatched.name} does not match its declared ${mismatched.kind} kind.`);
  return WorkspaceManifestSchema.parse({
    version: 1,
    artifacts: artifacts.map(({ id, name, kind, language }) => ({ id, name, kind, language })),
  });
}

export function serializeWorkspaceManifest(artifacts: WorkspaceArtifact[]) {
  return `${JSON.stringify(buildWorkspaceManifest(artifacts), null, 2)}\n`;
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

function validateDetectedKind(name: string, source: string, expected: ArtifactKind) {
  return detectArtifact(name, source)?.kind === expected;
}

export async function readWorkspaceDirectory(directory: DirectoryWorkspaceHandle): Promise<DirectoryReadResult> {
  const budget = { total: 0 };
  const manifestHandle = await optionalFileHandle(directory, WORKSPACE_MANIFEST_NAME);
  if (manifestHandle) {
    const manifestSource = await readBoundedFile(manifestHandle, budget);
    const parsed = parseWorkspaceManifest(manifestSource);
    if (!parsed.manifest) return { artifacts: [], errors: parsed.errors, source: "manifest" };
    const artifacts: WorkspaceArtifact[] = [];
    for (const entry of parsed.manifest.artifacts) {
      let fileHandle: DirectoryFileHandle;
      try {
        fileHandle = await directory.getFileHandle(entry.name);
      } catch {
        return { artifacts: [], errors: [`Manifest file not found: ${entry.name}`], source: "manifest" };
      }
      const source = await readBoundedFile(fileHandle, budget);
      if (!validateDetectedKind(entry.name, source, entry.kind)) {
        return { artifacts: [], errors: [`${entry.name} does not match its declared ${entry.kind} kind.`], source: "manifest" };
      }
      artifacts.push({ ...entry, source });
    }
    const errors = validateWorkspaceArtifacts(artifacts);
    return { artifacts: errors.length ? [] : artifacts, errors, source: "manifest" };
  }

  const candidates: Array<{ name: string; handle: DirectoryFileHandle }> = [];
  for await (const [name, handle] of directory.entries()) {
    if (handle.kind !== "file" || name.startsWith(".")) continue;
    if (detectArtifact(name, "") != null) candidates.push({ name, handle });
  }
  candidates.sort((left, right) => left.name.localeCompare(right.name));
  if (!candidates.length) return { artifacts: [], errors: [], source: "empty" };
  if (candidates.length > MAX_DIRECTORY_ARTIFACTS) {
    return { artifacts: [], errors: [`The folder contains more than ${MAX_DIRECTORY_ARTIFACTS} supported source files.`], source: "scan" };
  }

  const usedIds = new Set<string>();
  const artifacts: WorkspaceArtifact[] = [];
  for (const candidate of candidates) {
    const source = await readBoundedFile(candidate.handle, budget);
    const detected = detectArtifact(candidate.name, source);
    if (detected) artifacts.push({ ...detected, id: stableArtifactId(candidate.name, usedIds) });
  }
  const errors = validateWorkspaceArtifacts(artifacts);
  return { artifacts: errors.length ? [] : artifacts, errors, source: "scan" };
}

export async function writeWorkspaceDirectory(
  directory: DirectoryWorkspaceHandle,
  artifacts: WorkspaceArtifact[],
): Promise<string[]> {
  const validationErrors = validateWorkspaceArtifacts(artifacts);
  if (validationErrors.length) throw new Error(validationErrors[0]);
  buildWorkspaceManifest(artifacts);
  const totalBytes = artifacts.reduce((total, artifact) => {
    const size = new TextEncoder().encode(artifact.source).byteLength;
    if (size > MAX_DIRECTORY_FILE_BYTES) throw new Error(`${artifact.name} exceeds the 2 MB per-file limit.`);
    return total + size;
  }, 0);
  if (totalBytes > MAX_DIRECTORY_TOTAL_BYTES) throw new Error("The workspace exceeds Rune's 8 MB source limit.");

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
    await manifestWritable.write(serializeWorkspaceManifest(artifacts));
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
