import type { DirectoryWorkspaceHandle } from "./directory-workspace.ts";

type FileSystemObserverLike = {
  observe(handle: DirectoryWorkspaceHandle, options: { recursive: true }): Promise<void>;
  disconnect(): void;
};

type FileSystemObserverConstructor = new (
  callback: (records: readonly unknown[], observer: FileSystemObserverLike) => void,
) => FileSystemObserverLike;

type DirectoryObserverEnvironment = {
  FileSystemObserver?: FileSystemObserverConstructor;
  setInterval?: typeof setInterval;
  clearInterval?: typeof clearInterval;
};

export const DIRECTORY_OBSERVATION_INTERVAL_MS = 3_000;
const MAX_OBSERVED_DIRECTORY_ENTRIES = 128;

async function observationEntries(handle: DirectoryWorkspaceHandle) {
  const entries: Array<[string, number, number | null]> = [];
  for await (const [name, entry] of handle.entries()) {
    if (entry.kind === "file") {
      if (name !== "rune.workspace.json" && !/\.(?:md|markdown|csv|json|sql|html|htm)$/iu.test(name)) continue;
      const file = await entry.getFile();
      entries.push([name, file.size, Number.isFinite(file.lastModified) ? (file.lastModified as number) : null]);
    } else if (name === ".rune-assets" && entry.entries) {
      for await (const [assetName, asset] of entry.entries()) {
        if (asset.kind !== "file") continue;
        const file = await asset.getFile();
        entries.push([
          `${name}/${assetName}`,
          file.size,
          Number.isFinite(file.lastModified) ? (file.lastModified as number) : null,
        ]);
        if (entries.length > MAX_OBSERVED_DIRECTORY_ENTRIES) {
          throw new Error("The connected folder has too many Orbit files to monitor safely.");
        }
      }
    }
    if (entries.length > MAX_OBSERVED_DIRECTORY_ENTRIES) {
      throw new Error("The connected folder has too many Orbit files to monitor safely.");
    }
  }
  return entries.sort(([left], [right]) => left.localeCompare(right));
}

export async function directoryObservationFingerprint(handle: DirectoryWorkspaceHandle) {
  return JSON.stringify(await observationEntries(handle));
}

export function supportsDirectoryObservation(
  environment: DirectoryObserverEnvironment = globalThis as DirectoryObserverEnvironment,
) {
  return typeof environment.FileSystemObserver === "function";
}

export function observeWorkspaceDirectory(
  handle: DirectoryWorkspaceHandle,
  onChange: () => void,
  onError: (error: Error) => void,
  environment: DirectoryObserverEnvironment = globalThis as DirectoryObserverEnvironment,
) {
  const Observer = environment.FileSystemObserver;
  let active = true;
  if (Observer) {
    const observer = new Observer((records) => {
      if (!active || !records.length) return;
      if (records.some((record) => (record as { type?: unknown })?.type === "errored")) {
        active = false;
        onError(new Error("Folder observation permission or availability was lost."));
      } else onChange();
    });
    void observer.observe(handle, { recursive: true }).catch((cause: unknown) => {
      if (active) onError(cause instanceof Error ? cause : new Error("Folder observation failed."));
    });
    return () => {
      active = false;
      observer.disconnect();
    };
  }

  const schedule = environment.setInterval ?? globalThis.setInterval;
  const cancel = environment.clearInterval ?? globalThis.clearInterval;
  let fingerprint: string | undefined;
  let reading = false;
  let failed = false;
  const poll = async () => {
    if (!active || reading || failed) return;
    reading = true;
    try {
      const next = await directoryObservationFingerprint(handle);
      if (fingerprint !== undefined && next !== fingerprint) onChange();
      fingerprint = next;
    } catch (cause) {
      failed = true;
      onError(cause instanceof Error ? cause : new Error("Folder monitoring failed."));
    } finally {
      reading = false;
    }
  };
  void poll();
  const interval = schedule(() => void poll(), DIRECTORY_OBSERVATION_INTERVAL_MS);
  return () => {
    active = false;
    cancel(interval);
  };
}
