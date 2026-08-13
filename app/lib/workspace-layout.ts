export const RUNE_WORKSPACE_SPLIT_STORAGE_KEY = "rune-workspace-split-v2";
export const RUNE_WORKSPACE_VIEW_STORAGE_KEY = "rune-workspace-view-v1";
export const DEFAULT_WORKSPACE_SOURCE_PERCENT = 44;
export const MIN_WORKSPACE_SOURCE_PERCENT = 35;
export const MAX_WORKSPACE_SOURCE_PERCENT = 65;
export const RUNE_WORKSPACE_VIEWS = ["split", "source", "preview"] as const;
export type RuneWorkspaceView = (typeof RUNE_WORKSPACE_VIEWS)[number];

export type RuneWorkspaceViewShortcutEvent = Pick<KeyboardEvent, "altKey" | "code" | "ctrlKey" | "metaKey" | "shiftKey">;

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

export function normalizeRuneWorkspaceView(value: unknown): RuneWorkspaceView | null {
  return RUNE_WORKSPACE_VIEWS.includes(value as RuneWorkspaceView) ? value as RuneWorkspaceView : null;
}

export function workspaceViewFromKeyboardShortcut(event: RuneWorkspaceViewShortcutEvent): RuneWorkspaceView | null {
  if (!(event.metaKey || event.ctrlKey) || !event.altKey || event.shiftKey) return null;
  if (event.code === "Digit1") return "split";
  if (event.code === "Digit2") return "source";
  if (event.code === "Digit3") return "preview";
  return null;
}

export function workspaceSplitTracks(sourcePercent: number) {
  const source = clampWorkspaceSourcePercent(sourcePercent);
  return {
    source: `${source}fr`,
    preview: `${100 - source}fr`,
  } as const;
}
