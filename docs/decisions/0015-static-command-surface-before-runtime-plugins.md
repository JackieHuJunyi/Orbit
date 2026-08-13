# ADR 0015: Use a static command surface before runtime UI plugins

## Status

Accepted — Rune v0.97.

## Context

Rune's New, Import, task, view, checkpoint, guide, model, and workspace actions had clear handlers but no shared discoverable directory. Adding a global search UI directly inside the Workbench would duplicate labels, shortcuts, eligibility rules, and ordering in an already large React component. DeepSeek Harness demonstrates a useful separation between command catalog, selection UI, and the service that performs the command, but its dynamic Cordis plugin and slot lifecycle solves third-party runtime composition that Rune does not yet need.

## Decision

Rune uses one static typed command registry. It owns stable ids, groups, localized copy, keywords, shortcut labels, deterministic search ranking, and capability-derived disabled state. The Quick Actions component owns only query/focus/keyboard presentation and emits one selected id. The Workbench composes current capability facts and dispatches that id to the existing business handler.

The component cannot write Artifacts, persist a workspace, call a provider, or fetch. The registry cannot retain browser state or execute callbacks. `⌘⇧P / Ctrl Shift P` and a top-bar search control open the same surface; unavailable capabilities remain visible and explicitly disabled. All nine interface locales receive authored command-surface copy, including RTL Arabic.

## Consequences

Rune gains one searchable interaction vocabulary and a lower-cost place to add future human commands without introducing a plugin runtime. Static composition remains tree-shakeable, testable, and auditable. A dynamic command/slot host will be reconsidered only when runtime install/uninstall, third-party ownership, conflict ordering, and reversible effects are demonstrated requirements.
