export type AgentDockPlacement = "docked" | "floating";

export type AgentDockPoint = Readonly<{ x: number; y: number }>;
export type AgentDockSize = Readonly<{ width: number; height: number }>;
export type AgentDockViewport = Readonly<{ width: number; height: number }>;
export type AgentDockAnchor = Readonly<{ left: number; right: number; top: number; bottom: number }>;

export const AGENT_DOCK_MARGIN = 12;
export const DEFAULT_FLOATING_AGENT_SIZE: AgentDockSize = Object.freeze({ width: 440, height: 360 });

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(Math.max(value, minimum), Math.max(minimum, maximum));
}

export function normalizeAgentDockPlacement(value: unknown): AgentDockPlacement {
  return value === "floating" ? "floating" : "docked";
}

export function normalizeAgentDockPoint(value: unknown): AgentDockPoint {
  if (!value || typeof value !== "object") return { x: AGENT_DOCK_MARGIN, y: AGENT_DOCK_MARGIN };
  const point = value as { x?: unknown; y?: unknown };
  return {
    x: typeof point.x === "number" && Number.isFinite(point.x) ? point.x : AGENT_DOCK_MARGIN,
    y: typeof point.y === "number" && Number.isFinite(point.y) ? point.y : AGENT_DOCK_MARGIN,
  };
}

export function clampFloatingAgentDock(
  point: AgentDockPoint,
  panel: AgentDockSize,
  viewport: AgentDockViewport,
): AgentDockPoint {
  return {
    x: clamp(point.x, AGENT_DOCK_MARGIN, viewport.width - panel.width - AGENT_DOCK_MARGIN),
    y: clamp(point.y, AGENT_DOCK_MARGIN, viewport.height - panel.height - AGENT_DOCK_MARGIN),
  };
}

export function placeFloatingAgentDock(
  anchor: AgentDockAnchor,
  viewport: AgentDockViewport,
  panel: AgentDockSize = DEFAULT_FLOATING_AGENT_SIZE,
): AgentDockPoint {
  const availableWidth = Math.min(panel.width, viewport.width - AGENT_DOCK_MARGIN * 2);
  const availableHeight = Math.min(panel.height, viewport.height - AGENT_DOCK_MARGIN * 2);
  const fittedPanel = { width: availableWidth, height: availableHeight };
  const leftOfSelection = anchor.left - availableWidth - AGENT_DOCK_MARGIN;
  const rightOfSelection = anchor.right + AGENT_DOCK_MARGIN;
  const x =
    leftOfSelection >= AGENT_DOCK_MARGIN
      ? leftOfSelection
      : rightOfSelection + availableWidth <= viewport.width - AGENT_DOCK_MARGIN
        ? rightOfSelection
        : (viewport.width - availableWidth) / 2;
  return clampFloatingAgentDock({ x, y: anchor.top - 28 }, fittedPanel, viewport);
}

export function moveFloatingAgentDock(
  origin: AgentDockPoint,
  delta: AgentDockPoint,
  panel: AgentDockSize,
  viewport: AgentDockViewport,
): AgentDockPoint {
  return clampFloatingAgentDock({ x: origin.x + delta.x, y: origin.y + delta.y }, panel, viewport);
}

export function placeAgentContextTrigger(
  anchor: AgentDockAnchor,
  viewport: AgentDockViewport,
  size: AgentDockSize = { width: 156, height: 36 },
): AgentDockPoint {
  return {
    x: clamp(anchor.right - size.width, AGENT_DOCK_MARGIN, viewport.width - size.width - AGENT_DOCK_MARGIN),
    y: clamp(anchor.top - size.height - 8, AGENT_DOCK_MARGIN, viewport.height - size.height - AGENT_DOCK_MARGIN),
  };
}
