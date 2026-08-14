import { createRuneSurfaceRegistry } from "./surface-registry.ts";

export const RUNE_WORKSPACE_SPLIT_STORAGE_KEY = "rune-workspace-split-v2";
export const RUNE_WORKSPACE_VIEW_STORAGE_KEY = "rune-workspace-view-v1";
export const DEFAULT_WORKSPACE_SOURCE_PERCENT = 44;
export const MIN_WORKSPACE_SOURCE_PERCENT = 35;
export const MAX_WORKSPACE_SOURCE_PERCENT = 65;
export const RUNE_WORKSPACE_VIEWS = ["split", "source", "preview"] as const;
export type RuneWorkspaceView = (typeof RUNE_WORKSPACE_VIEWS)[number];

export type RuneWorkspaceViewContribution = Readonly<{
  id: RuneWorkspaceView;
  shortcutCode: "Digit1" | "Digit2" | "Digit3";
  shortcutNumber: 1 | 2 | 3;
}>;

const workspaceViewRegistry = createRuneSurfaceRegistry<"workspace-view", RuneWorkspaceViewContribution>([
  { id: "workspace-view", kind: "list" },
]);

[
  { id: "split", shortcutCode: "Digit1", shortcutNumber: 1 },
  { id: "source", shortcutCode: "Digit2", shortcutNumber: 2 },
  { id: "preview", shortcutCode: "Digit3", shortcutNumber: 3 },
].forEach((view, index) => {
  workspaceViewRegistry.register({
    id: view.id,
    surface: "workspace-view",
    order: index * 10,
    value: view as RuneWorkspaceViewContribution,
  });
});

export const RUNE_WORKSPACE_VIEW_CONTRIBUTIONS = Object.freeze(
  workspaceViewRegistry.entries("workspace-view").map((entry) => entry.value),
);

export type RuneWorkspaceViewShortcutEvent = Pick<
  KeyboardEvent,
  "altKey" | "code" | "ctrlKey" | "metaKey" | "shiftKey"
>;

export type RuneWorkspaceSplitGeometry = Readonly<{
  basePercent: number;
  originX: number;
  width: number;
  rtl: boolean;
}>;

export function clampWorkspaceSourcePercent(value: number) {
  if (!Number.isFinite(value)) return DEFAULT_WORKSPACE_SOURCE_PERCENT;
  return Math.min(MAX_WORKSPACE_SOURCE_PERCENT, Math.max(MIN_WORKSPACE_SOURCE_PERCENT, Math.round(value * 10) / 10));
}

export function normalizeWorkspaceSourcePercent(value: unknown): number | null {
  if (typeof value !== "string" && typeof value !== "number") return null;
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed) || parsed < MIN_WORKSPACE_SOURCE_PERCENT || parsed > MAX_WORKSPACE_SOURCE_PERCENT)
    return null;
  return clampWorkspaceSourcePercent(parsed);
}

export function normalizeRuneWorkspaceView(value: unknown): RuneWorkspaceView | null {
  return RUNE_WORKSPACE_VIEWS.includes(value as RuneWorkspaceView) ? (value as RuneWorkspaceView) : null;
}

export function workspaceViewFromKeyboardShortcut(event: RuneWorkspaceViewShortcutEvent): RuneWorkspaceView | null {
  if (!(event.metaKey || event.ctrlKey) || !event.altKey || event.shiftKey) return null;
  return RUNE_WORKSPACE_VIEW_CONTRIBUTIONS.find((view) => view.shortcutCode === event.code)?.id ?? null;
}

export function workspaceSplitTracks(sourcePercent: number) {
  const source = clampWorkspaceSourcePercent(sourcePercent);
  return {
    source: `${source}fr`,
    preview: `${100 - source}fr`,
  } as const;
}

export function workspaceSplitPercentFromDrag(clientX: number, geometry: RuneWorkspaceSplitGeometry) {
  if (
    !Number.isFinite(clientX) ||
    !Number.isFinite(geometry.basePercent) ||
    !Number.isFinite(geometry.originX) ||
    !Number.isFinite(geometry.width) ||
    geometry.width <= 0
  ) {
    return DEFAULT_WORKSPACE_SOURCE_PERCENT;
  }
  const physicalDelta = ((clientX - geometry.originX) / geometry.width) * 100;
  return clampWorkspaceSourcePercent(geometry.basePercent + (geometry.rtl ? -physicalDelta : physicalDelta));
}
