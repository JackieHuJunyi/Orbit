"use client";

import { Move, Pin, Sparkles, X } from "lucide-react";
import type { KeyboardEvent, PointerEvent as ReactPointerEvent, ReactNode, RefObject } from "react";
import type { AgentDockPlacement, AgentDockPoint } from "../lib/agent-dock-layout";

export type AgentDockShellProps = Readonly<{
  panelRef: RefObject<HTMLDivElement | null>;
  open: boolean;
  placement: AgentDockPlacement;
  position: AgentDockPoint;
  triggerLabel: string;
  moveLabel: string;
  dockLabel: string;
  floatLabel: string;
  closeLabel: string;
  onOpen: () => void;
  onTogglePlacement: () => void;
  onClose: () => void;
  onMovePointerDown: (event: ReactPointerEvent<HTMLButtonElement>) => void;
  onMoveKeyDown: (event: KeyboardEvent<HTMLButtonElement>) => void;
  children: ReactNode;
}>;

/**
 * Presentation boundary for the movable Agent surface. The Workbench owns
 * planning and source mutation; this component owns only dock chrome and the
 * stable order of conversation, proposal, error, and composer content.
 */
export function AgentDockShell({
  panelRef,
  open,
  placement,
  position,
  triggerLabel,
  moveLabel,
  dockLabel,
  floatLabel,
  closeLabel,
  onOpen,
  onTogglePlacement,
  onClose,
  onMovePointerDown,
  onMoveKeyDown,
  children,
}: AgentDockShellProps) {
  return (
    <div
      ref={panelRef}
      className={`agent-dock ${open ? `open ${placement}` : "collapsed docked"}`}
      style={open && placement === "floating" ? { left: position.x, top: position.y } : undefined}
    >
      {!open && (
        <button type="button" className="agent-dock-trigger" onClick={onOpen} aria-expanded="false">
          <Sparkles aria-hidden="true" />
          <span>{triggerLabel}</span>
          <kbd>⌘ ↵</kbd>
        </button>
      )}
      {open && (
        <div className="agent-dock-toolbar">
          {placement === "floating" ? (
            <button
              type="button"
              className="agent-dock-grabber"
              onPointerDown={onMovePointerDown}
              onKeyDown={onMoveKeyDown}
              aria-label={moveLabel}
              title={moveLabel}
            >
              <Move aria-hidden="true" />
              <span>{triggerLabel}</span>
            </button>
          ) : (
            <span className="agent-dock-title">{triggerLabel}</span>
          )}
          <div>
            <button
              type="button"
              onClick={onTogglePlacement}
              aria-label={placement === "floating" ? dockLabel : floatLabel}
              title={placement === "floating" ? dockLabel : floatLabel}
            >
              {placement === "floating" ? <Pin aria-hidden="true" /> : <Move aria-hidden="true" />}
            </button>
            <button type="button" onClick={onClose} aria-label={closeLabel} title={closeLabel}>
              <X aria-hidden="true" />
            </button>
          </div>
        </div>
      )}
      {children}
    </div>
  );
}
