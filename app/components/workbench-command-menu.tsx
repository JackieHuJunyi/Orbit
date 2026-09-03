"use client";

import {
  BookOpen,
  ClipboardList,
  Code2,
  Columns2,
  CornerDownLeft,
  Eye,
  FilePlus2,
  FolderOpen,
  PanelLeftOpen,
  Presentation,
  Save,
  Search,
  Settings,
  Sparkles,
  Upload,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import {
  filterOrbitWorkbenchCommands,
  orbitCommandMenuCopy,
  type OrbitWorkbenchCommand,
  type OrbitWorkbenchCommandGroup,
  type OrbitWorkbenchCommandId,
} from "../lib/workbench-commands";
import type { OrbitLocale } from "../lib/localization";

const GROUP_ORDER: OrbitWorkbenchCommandGroup[] = ["create", "workspace", "view", "help"];

const COMMAND_ICONS = {
  "new-artifact": FilePlus2,
  "import-files": Upload,
  "open-folder": FolderOpen,
  "operating-review": ClipboardList,
  "document-briefing": Presentation,
  "focus-agent": Sparkles,
  "show-split": Columns2,
  "show-source": Code2,
  "show-preview": Eye,
  "save-checkpoint": Save,
  "close-file": X,
  "toggle-files": PanelLeftOpen,
  "open-guide": BookOpen,
  "open-models": Settings,
} satisfies Record<OrbitWorkbenchCommandId, typeof FilePlus2>;

function nextEnabledIndex(commands: readonly OrbitWorkbenchCommand[], start: number, direction: 1 | -1) {
  if (!commands.some((command) => !command.disabled)) return -1;
  for (let step = 1; step <= commands.length; step += 1) {
    const index = (start + direction * step + commands.length) % commands.length;
    if (!commands[index]?.disabled) return index;
  }
  return -1;
}

function revealCommandOption(index: number) {
  if (index < 0) return;
  requestAnimationFrame(() => {
    document.getElementById(`command-menu-option-${index}`)?.scrollIntoView({ block: "nearest" });
  });
}

export function WorkbenchCommandMenu({
  commands,
  locale,
  direction,
  onClose,
  onRun,
}: {
  commands: readonly OrbitWorkbenchCommand[];
  locale: OrbitLocale;
  direction: "ltr" | "rtl";
  onClose: () => void;
  onRun: (id: OrbitWorkbenchCommandId) => void;
}) {
  const copy = orbitCommandMenuCopy(locale);
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const results = useMemo(() => filterOrbitWorkbenchCommands(commands, query), [commands, query]);
  const [activeIndex, setActiveIndex] = useState(() => results.findIndex((command) => !command.disabled));

  useEffect(() => {
    previousFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    inputRef.current?.focus({ preventScroll: true });
    return () => previousFocusRef.current?.focus({ preventScroll: true });
  }, []);

  useEffect(() => {
    if (activeIndex < 0) return;
    document.getElementById(`command-menu-option-${activeIndex}`)?.scrollIntoView({ block: "nearest" });
  }, [activeIndex]);

  function run(command: OrbitWorkbenchCommand | undefined) {
    if (!command || command.disabled) return;
    onRun(command.id);
  }

  function onInputKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      onClose();
      return;
    }
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((current) => {
        const nextIndex = nextEnabledIndex(results, current, event.key === "ArrowDown" ? 1 : -1);
        revealCommandOption(nextIndex);
        return nextIndex;
      });
      return;
    }
    if (event.key === "Home" || event.key === "End") {
      event.preventDefault();
      const anchor = event.key === "Home" ? -1 : 0;
      const nextIndex = nextEnabledIndex(results, anchor, event.key === "Home" ? 1 : -1);
      setActiveIndex(nextIndex);
      revealCommandOption(nextIndex);
      return;
    }
    if (event.key === "Enter") {
      event.preventDefault();
      run(results[activeIndex]);
    }
  }

  return (
    <div className="command-menu-backdrop" role="presentation" onPointerDown={onClose}>
      <section
        className="command-menu"
        role="dialog"
        aria-modal="true"
        aria-labelledby="command-menu-title"
        dir={direction}
        onPointerDown={(event) => event.stopPropagation()}
      >
        <header className="command-menu-search">
          <Search aria-hidden="true" />
          <label id="command-menu-title" className="visually-hidden" htmlFor="command-menu-input">
            {copy.title}
          </label>
          <input
            ref={inputRef}
            id="command-menu-input"
            role="combobox"
            aria-autocomplete="list"
            aria-controls="command-menu-results"
            aria-expanded="true"
            aria-activedescendant={activeIndex >= 0 ? `command-menu-option-${activeIndex}` : undefined}
            autoComplete="off"
            spellCheck="false"
            value={query}
            placeholder={copy.placeholder}
            onChange={(event) => {
              const nextQuery = event.currentTarget.value;
              const nextIndex = filterOrbitWorkbenchCommands(commands, nextQuery).findIndex(
                (command) => !command.disabled,
              );
              setQuery(nextQuery);
              setActiveIndex(nextIndex);
              revealCommandOption(nextIndex);
            }}
            onKeyDown={onInputKeyDown}
          />
          <kbd>⌘ ⇧ P</kbd>
          <button
            type="button"
            className="icon-button small"
            onClick={onClose}
            aria-label={copy.close}
            title={copy.close}
          >
            <X aria-hidden="true" />
          </button>
        </header>

        <div id="command-menu-results" className="command-menu-results" role="listbox" aria-label={copy.title}>
          {results.length === 0 ? (
            <div className="command-menu-empty" role="status">
              {copy.noResults}
            </div>
          ) : (
            GROUP_ORDER.map((group) => {
              const groupCommands = results
                .map((command, index) => ({ command, index }))
                .filter((entry) => entry.command.group === group);
              if (groupCommands.length === 0) return null;
              return (
                <section className="command-menu-group" aria-labelledby={`command-menu-group-${group}`} key={group}>
                  <h3 id={`command-menu-group-${group}`}>{copy.groups[group]}</h3>
                  {groupCommands.map(({ command, index }) => {
                    const CommandIcon = COMMAND_ICONS[command.id];
                    return (
                      <button
                        id={`command-menu-option-${index}`}
                        type="button"
                        role="option"
                        aria-selected={index === activeIndex}
                        aria-disabled={command.disabled || undefined}
                        className={index === activeIndex ? "active" : ""}
                        disabled={command.disabled}
                        onPointerMove={() => {
                          if (!command.disabled) setActiveIndex(index);
                        }}
                        onFocus={() => {
                          if (!command.disabled) setActiveIndex(index);
                        }}
                        onClick={() => run(command)}
                        key={command.id}
                      >
                        <span className={`command-menu-glyph group-${command.group}`} aria-hidden="true">
                          <CommandIcon />
                        </span>
                        <span className="command-menu-copy">
                          <strong>{command.label}</strong>
                          <small>{command.disabled ? copy.unavailable : command.detail}</small>
                        </span>
                        {command.shortcut && <kbd>{command.shortcut}</kbd>}
                        {index === activeIndex && !command.disabled && (
                          <CornerDownLeft className="command-menu-enter" aria-hidden="true" />
                        )}
                      </button>
                    );
                  })}
                </section>
              );
            })
          )}
        </div>
      </section>
    </div>
  );
}
