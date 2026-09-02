"use client";

import { ChevronDown, FileArchive, FileCode2, FileOutput, FileText, LoaderCircle } from "lucide-react";
import { useRef, type RefObject } from "react";
import { useWorkbenchMenuFocus } from "./use-workbench-menu-focus";
import type { RuneUICopy } from "../lib/localization";
import type { WorkspaceFileExportCapability, WorkspaceFileExportDestination } from "../lib/workspace-file-export";

type WorkbenchExportMenuProps = {
  artifactName: string;
  capabilities: readonly WorkspaceFileExportCapability[];
  containerRef: RefObject<HTMLDivElement | null>;
  copy: RuneUICopy["workbench"];
  disabled: boolean;
  legacyOfficeAvailable: boolean;
  open: boolean;
  preparing: boolean;
  onOpenChange: (open: boolean) => void;
  onPrepare: (destination: WorkspaceFileExportDestination) => void;
};

function capabilityIcon(capability: WorkspaceFileExportCapability) {
  switch (capability.presentation.icon) {
    case "archive":
      return <FileArchive aria-hidden="true" />;
    case "document":
      return <FileText aria-hidden="true" />;
    case "code":
      return <FileCode2 aria-hidden="true" />;
    default: {
      const exhaustive: never = capability.presentation.icon;
      return exhaustive;
    }
  }
}

function capabilityDetail(
  capability: WorkspaceFileExportCapability,
  artifactName: string,
  copy: RuneUICopy["workbench"],
) {
  switch (capability.presentation.detail) {
    case "canonical-source":
      return artifactName;
    case "desktop-compatibility":
      return `${copy.exportAs(capability.label)} · Orbit Desktop`;
    case "open-document":
      return copy.exportAsOpenDocument(capability.label);
    case "standalone-html":
      return copy.exportStandaloneHtml;
    case "fixed-pdf":
      return copy.exportFixedPdf;
    case "portable-format":
      return copy.exportAs(capability.label);
    default: {
      const exhaustive: never = capability.presentation.detail;
      return exhaustive;
    }
  }
}

export function WorkbenchExportMenu({
  artifactName,
  capabilities,
  containerRef,
  copy,
  disabled,
  legacyOfficeAvailable,
  open,
  preparing,
  onOpenChange,
  onPrepare,
}: WorkbenchExportMenuProps) {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const visibleCapabilities = capabilities.filter(
    (capability) => !capability.presentation.desktopOnly || legacyOfficeAvailable,
  );
  const { onMenuKeyDown, requestOpen, setItemRef } = useWorkbenchMenuFocus({
    itemCount: visibleCapabilities.length,
    open,
    onOpenChange,
    restoreFocusRef: triggerRef,
  });

  return (
    <div className="export-menu" ref={containerRef}>
      <button
        ref={triggerRef}
        className={`button ghost-button export-menu-trigger ${open ? "active" : ""}`.trim()}
        type="button"
        onClick={() => {
          if (open) onOpenChange(false);
          else requestOpen("first");
        }}
        onKeyDown={(event) => {
          if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
          event.preventDefault();
          requestOpen(event.key === "ArrowUp" ? "last" : "first");
        }}
        disabled={disabled}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        {preparing ? <LoaderCircle className="agent-spinner" aria-hidden="true" /> : <FileOutput aria-hidden="true" />}
        <span>{copy.exportMenu}</span>
        <ChevronDown aria-hidden="true" />
      </button>
      {open && (
        <div className="export-popover" role="menu" aria-label={copy.exportMenuBody} onKeyDown={onMenuKeyDown}>
          <div>
            <span className="overline">{copy.exportMenu}</span>
            <strong>{copy.exportMenuBody}</strong>
          </div>
          {visibleCapabilities.map((capability, index) => (
            <button
              ref={(element) => {
                setItemRef(index, element);
              }}
              type="button"
              role="menuitem"
              onClick={() => {
                onOpenChange(false);
                onPrepare(capability.destination);
              }}
              key={capability.destination}
            >
              {capabilityIcon(capability)}
              <span>
                <strong>{capability.destination === "source" ? copy.canonicalSource : capability.label}</strong>
                <small>{capabilityDetail(capability, artifactName, copy)}</small>
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
