"use client";

import {
  ArchiveRestore,
  BookOpen,
  Check,
  FileCode2,
  Files,
  FolderOpen,
  Palette,
  RefreshCw,
  RotateCcw,
  Save,
  Settings,
} from "lucide-react";
import type { RefObject } from "react";
import { useWorkbenchMenuFocus, type WorkbenchMenuFocusEdge } from "./use-workbench-menu-focus";
import { ORBIT_APPEARANCE_THEMES, type OrbitAppearanceTheme } from "../lib/appearance";
import { orbitText, orbitUICopy, type OrbitLocale, type OrbitUICopy } from "../lib/localization";
import { ORBIT_PRODUCT_NAME, ORBIT_PRODUCT_VERSION } from "../lib/product-meta";

type WorkbenchSettingsMenuProps = {
  appearanceTheme: OrbitAppearanceTheme;
  blocked: boolean;
  containerRef: RefObject<HTMLDivElement | null>;
  copy: OrbitUICopy["workbench"];
  directoryBusy: boolean;
  directoryChanged: boolean;
  directoryName: string | null;
  hasPilotEvidence: boolean;
  hasWorkspaceRecovery: boolean;
  workspaceResetBlocked: boolean;
  locale: OrbitLocale;
  open: boolean;
  pilotEvidenceBody: string;
  pilotEvidenceEmpty: string;
  pilotEvidenceTitle: string;
  requestedFocusRef: RefObject<WorkbenchMenuFocusEdge>;
  triggerRef: RefObject<HTMLButtonElement | null>;
  onExportPilotEvidence: () => void;
  onOpenChange: (open: boolean) => void;
  onOpenFolder: () => void;
  onOpenGuide: () => void;
  onOpenModels: () => void;
  onOpenPdfTools: () => void;
  onPullFolder: () => void;
  onPushFolder: () => void;
  onRestorePreviousWorkspace: () => void;
  onRestoreSampleWorkspace: () => void;
  onThemeChange: (theme: OrbitAppearanceTheme) => void;
};

export function WorkbenchSettingsMenu({
  appearanceTheme,
  blocked,
  containerRef,
  copy,
  directoryBusy,
  directoryChanged,
  directoryName,
  hasPilotEvidence,
  hasWorkspaceRecovery,
  workspaceResetBlocked,
  locale,
  open,
  pilotEvidenceBody,
  pilotEvidenceEmpty,
  pilotEvidenceTitle,
  requestedFocusRef,
  triggerRef,
  onExportPilotEvidence,
  onOpenChange,
  onOpenFolder,
  onOpenGuide,
  onOpenModels,
  onOpenPdfTools,
  onPullFolder,
  onPushFolder,
  onRestorePreviousWorkspace,
  onRestoreSampleWorkspace,
  onThemeChange,
}: WorkbenchSettingsMenuProps) {
  const activeAppearance =
    ORBIT_APPEARANCE_THEMES.find((theme) => theme.id === appearanceTheme) ?? ORBIT_APPEARANCE_THEMES[0];
  const workspaceResetCopy = orbitUICopy(locale).workspaceReset;
  const actions = [
    {
      id: "guide",
      icon: <BookOpen aria-hidden="true" />,
      label: copy.help,
      detail: copy.brandSubtitle,
      disabled: blocked,
      onSelect: onOpenGuide,
    },
    {
      id: "models",
      icon: <Settings aria-hidden="true" />,
      label: copy.models,
      detail: copy.localFirst,
      disabled: blocked,
      onSelect: onOpenModels,
    },
    {
      id: "pdf-tools",
      icon: <Files aria-hidden="true" />,
      label: copy.pdfTools,
      detail: copy.pdfToolsBody,
      disabled: blocked,
      onSelect: onOpenPdfTools,
    },
    {
      id: "pilot-evidence",
      icon: <FileCode2 aria-hidden="true" />,
      label: pilotEvidenceTitle,
      detail: hasPilotEvidence ? pilotEvidenceBody : pilotEvidenceEmpty,
      disabled: !hasPilotEvidence || blocked,
      onSelect: onExportPilotEvidence,
    },
    {
      id: "folder",
      icon: <FolderOpen aria-hidden="true" />,
      label: directoryName ?? copy.openFolder,
      detail: copy.workspace,
      disabled: directoryBusy || blocked,
      onSelect: onOpenFolder,
    },
    ...(directoryName
      ? [
          {
            id: "pull",
            icon: <RefreshCw aria-hidden="true" />,
            label: copy.pull,
            detail: directoryChanged ? orbitText(locale, "Changes detected", "检测到变化") : directoryName,
            disabled: directoryBusy || blocked,
            onSelect: onPullFolder,
          },
          {
            id: "push",
            icon: <Save aria-hidden="true" />,
            label: copy.push,
            detail: directoryName,
            disabled: directoryBusy || blocked,
            onSelect: onPushFolder,
          },
        ]
      : []),
    ...(hasWorkspaceRecovery
      ? [
          {
            id: "restore-previous-workspace",
            icon: <ArchiveRestore aria-hidden="true" />,
            label: workspaceResetCopy.previousAvailable,
            detail: workspaceResetCopy.previousAvailableDetail,
            disabled: blocked || workspaceResetBlocked,
            onSelect: onRestorePreviousWorkspace,
          },
        ]
      : []),
    {
      id: "restore-sample-workspace",
      icon: <RotateCcw aria-hidden="true" />,
      label: copy.resetSample,
      detail: workspaceResetCopy.sampleDetail,
      disabled: blocked || workspaceResetBlocked,
      onSelect: onRestoreSampleWorkspace,
    },
  ];
  const { onMenuKeyDown, setItemRef } = useWorkbenchMenuFocus({
    itemCount: actions.length + ORBIT_APPEARANCE_THEMES.length,
    open,
    onOpenChange,
    requestedFocusRef,
    restoreFocusRef: triggerRef,
  });

  if (!open) return null;

  return (
    <div
      className="tools-popover settings-popover"
      role="menu"
      aria-label={copy.workspaceTools}
      ref={containerRef}
      onKeyDown={onMenuKeyDown}
    >
      <header role="presentation">
        <span className="overline">{copy.workspaceTools}</span>
        <strong>{copy.workspaceToolsBody}</strong>
      </header>
      <div className="tools-menu-actions" role="group" aria-label={copy.workspaceTools}>
        {actions.map((action, index) => (
          <button
            ref={(element) => setItemRef(index, element)}
            type="button"
            role="menuitem"
            data-settings-action={action.id}
            disabled={action.disabled}
            onClick={() => {
              onOpenChange(false);
              action.onSelect();
            }}
            key={action.id}
          >
            {action.icon}
            <span>
              <strong>{action.label}</strong>
              <small>{action.detail}</small>
            </span>
          </button>
        ))}
      </div>
      <div className="tools-appearance-header" role="presentation">
        <Palette aria-hidden="true" />
        <span>
          <strong>{copy.appearance}</strong>
          <small>{copy.appearanceBody}</small>
        </span>
      </div>
      <div className="tools-material-preview" role="presentation">
        <span
          className="appearance-swatch"
          aria-hidden="true"
          style={{
            background: `linear-gradient(145deg, ${activeAppearance.finish[0]}, ${activeAppearance.finish[1]})`,
          }}
        />
        <span>
          <small>{copy.activeTheme}</small>
          <strong>{orbitText(locale, activeAppearance.english, activeAppearance.chinese)}</strong>
        </span>
      </div>
      <div className="tools-theme-grid" role="group" aria-label={copy.appearanceBody}>
        {ORBIT_APPEARANCE_THEMES.map((theme, index) => {
          const themeName = orbitText(locale, theme.english, theme.chinese);
          return (
            <button
              ref={(element) => setItemRef(actions.length + index, element)}
              type="button"
              role="menuitemradio"
              aria-checked={appearanceTheme === theme.id}
              className={appearanceTheme === theme.id ? "selected" : ""}
              aria-label={themeName}
              title={themeName}
              onClick={() => onThemeChange(theme.id)}
              key={theme.id}
            >
              <span
                className="appearance-swatch"
                aria-hidden="true"
                style={{ background: `linear-gradient(145deg, ${theme.finish[0]}, ${theme.finish[1]})` }}
              />
              <span className="tools-theme-name">{themeName}</span>
              {appearanceTheme === theme.id && <Check aria-hidden="true" />}
            </button>
          );
        })}
      </div>
      <footer className="tools-version" role="presentation">
        <span>{copy.version}</span>
        <strong dir="ltr">
          {ORBIT_PRODUCT_NAME} {ORBIT_PRODUCT_VERSION}
        </strong>
      </footer>
    </div>
  );
}
