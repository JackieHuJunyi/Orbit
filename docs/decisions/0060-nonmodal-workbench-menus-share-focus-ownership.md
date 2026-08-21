# ADR 0060: Non-modal Workbench menus share focus ownership

## Status

Accepted for Rune v1.44.

## Context

Rune v1.42 made Export a controlled registry projection and gave it a complete keyboard contract. More Tools still kept about 150 lines of help, model, pilot-evidence, directory-sync, appearance, and version presentation inside `RuneWorkbench`. It declared menu roles but had no opening focus transfer, Arrow navigation, Home/End behavior, disabled-item skipping, Tab dismissal, or reliable Escape focus return. Export and Settings therefore implemented different interaction quality for the same non-modal surface pattern.

The inline branch also coupled current theme lookup and every menu icon/layout decision back into the main coordinator. Folder connection can add Pull and Push dynamically, so a correct focus owner must handle four or six actions plus twelve theme radios without retaining detached refs. Browser validation additionally found that the desktop activity-rail anchor survived at 390 px and pushed the fixed menu outside both LTR and RTL viewports.

## Decision

1. `useWorkbenchMenuFocus` owns the shared non-modal keyboard effect for ordered button menus. It accepts controlled open state, the current item count, an optional requested opening edge, and the trigger ref.
2. Opening from click or Arrow Down starts on the first enabled item; Arrow Up starts on the last. Arrow Up/Down wrap across enabled items, Home/End jump, Tab closes without trapping, and Escape closes and restores the trigger on the next frame.
3. Disabled native buttons are omitted from the movement list. The ref array is truncated to the current rendered item count before focus resolves, so folder connection or export-format changes cannot preserve detached controls.
4. `WorkbenchSettingsMenu` is controlled presentation. It receives current localized copy, theme, directory/evidence/busy facts, and callbacks. It may close itself before dispatching an action or keep the theme group open after selection, but it cannot access Artifact state, providers, credentials, storage, filesystem APIs, persistence, network, or downloads.
5. `WorkbenchActivityRail` remains props-only. Its trigger carries the ref and may request first- or last-edge opening; Workbench remains the only owner of Settings/Export mutual exclusion and business dispatch.
6. At widths up to 680 px, Settings explicitly replaces the desktop rail anchor with 10 px physical insets and a top origin for both LTR and RTL. The popover keeps its bounded internal scroll instead of widening or overflowing the page.

## Consequences

- Export and Settings now have one keyboard behavior owner without forcing unrelated action registries or business state into a generic component.
- Help, model, pilot, directory, and appearance presentation can evolve without adding JSX, icon, or theme lookup branches to the Workbench coordinator.
- Workbench falls from 5,957 to 5,826 lines. The shared hook is 88 lines and the settings surface is 212 lines, with no new mutation authority.
- The minified eager Workbench is 525,898 bytes under the unchanged 530 KB limit.
- Source/render contracts protect controlled composition, dynamic ref cleanup, disabled filtering, and the complete key set. Chromium proves real first/last entry, disabled-item skipping, Home/End, theme selection, Tab dismissal, Escape return, and all nine locale layouts at desktop and 390 px compact widths including Arabic RTL.
