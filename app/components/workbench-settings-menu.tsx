"use client";

import { BookOpen, Check, FileCode2, FolderOpen, Palette, RefreshCw, Save, Settings } from "lucide-react";
import type { RefObject } from "react";
import { useWorkbenchMenuFocus, type WorkbenchMenuFocusEdge } from "./use-workbench-menu-focus";
import { RUNE_APPEARANCE_THEMES, type RuneAppearanceTheme } from "../lib/appearance";
import { runeText, type RuneLocale, type RuneUICopy } from "../lib/localization";
import { RUNE_PRODUCT_VERSION } from "../lib/product-meta";

type WorkbenchSettingsMenuProps = {
  appearanceTheme: RuneAppearanceTheme;
  blocked: boolean;
  containerRef: RefObject<HTMLDivElement | null>;
  copy: RuneUICopy["workbench"];
  directoryBusy: boolean;
  directoryChanged: boolean;
  directoryName: string | null;
  hasPilotEvidence: boolean;
  locale: RuneLocale;
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
  onPullFolder: () => void;
  onPushFolder: () => void;
  onThemeChange: (theme: RuneAppearanceTheme) => void;
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
  onPullFolder,
  onPushFolder,
  onThemeChange,
}: WorkbenchSettingsMenuProps) {
  const activeAppearance =
    RUNE_APPEARANCE_THEMES.find((theme) => theme.id === appearanceTheme) ?? RUNE_APPEARANCE_THEMES[0];
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
            detail: directoryChanged ? runeText(locale, "Changes detected", "检测到变化") : directoryName,
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
  ];
  const { onMenuKeyDown, setItemRef } = useWorkbenchMenuFocus({
    itemCount: actions.length + RUNE_APPEARANCE_THEMES.length,
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
          <strong>{runeText(locale, activeAppearance.english, activeAppearance.chinese)}</strong>
        </span>
      </div>
      <div className="tools-theme-grid" role="group" aria-label={copy.appearanceBody}>
        {RUNE_APPEARANCE_THEMES.map((theme, index) => {
          const themeName = runeText(locale, theme.english, theme.chinese);
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
        <strong>Rune {RUNE_PRODUCT_VERSION}</strong>
      </footer>
    </div>
  );
}
