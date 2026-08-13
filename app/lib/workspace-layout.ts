export const RUNE_WORKSPACE_SPLIT_STORAGE_KEY = "rune-workspace-split-v1";
export const DEFAULT_WORKSPACE_SOURCE_PERCENT = 47;
export const MIN_WORKSPACE_SOURCE_PERCENT = 35;
export const MAX_WORKSPACE_SOURCE_PERCENT = 65;

export function clampWorkspaceSourcePercent(value: number) {
  if (!Number.isFinite(value)) return DEFAULT_WORKSPACE_SOURCE_PERCENT;
  return Math.min(MAX_WORKSPACE_SOURCE_PERCENT, Math.max(MIN_WORKSPACE_SOURCE_PERCENT, Math.round(value * 10) / 10));
}

export function normalizeWorkspaceSourcePercent(value: unknown): number | null {
  if (typeof value !== "string" && typeof value !== "number") return null;
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed) || parsed < MIN_WORKSPACE_SOURCE_PERCENT || parsed > MAX_WORKSPACE_SOURCE_PERCENT) return null;
  return clampWorkspaceSourcePercent(parsed);
}

export function workspaceSplitTracks(sourcePercent: number) {
  const source = clampWorkspaceSourcePercent(sourcePercent);
  return {
    source: `${source}fr`,
    preview: `${100 - source}fr`,
  } as const;
}
