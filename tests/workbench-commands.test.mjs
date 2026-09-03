import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { orbitUICopy } from "../app/lib/localization.ts";
import {
  createOrbitWorkbenchCommands,
  filterOrbitWorkbenchCommands,
  orbitCommandMenuCopy,
} from "../app/lib/workbench-commands.ts";

function commands(overrides = {}) {
  return createOrbitWorkbenchCommands({
    ui: orbitUICopy("en").workbench,
    locale: "en",
    artifactCreationDisabled: false,
    canCreateBriefing: true,
    canUseWorkspace: true,
    canCheckpoint: true,
    canOpenFolder: true,
    ...overrides,
  });
}

test("declares one stable command identity with capability-derived availability", () => {
  const available = commands();
  assert.equal(available.length, 14);
  assert.equal(new Set(available.map((command) => command.id)).size, available.length);
  assert.equal(
    available.every((command) => !command.disabled),
    true,
  );

  const bounded = commands({
    artifactCreationDisabled: true,
    canCreateBriefing: false,
    canUseWorkspace: false,
    canCheckpoint: false,
    canOpenFolder: false,
  });
  const byId = new Map(bounded.map((command) => [command.id, command]));
  assert.equal(byId.get("new-artifact")?.disabled, true);
  assert.equal(byId.get("document-briefing")?.disabled, true);
  assert.equal(byId.get("show-preview")?.disabled, true);
  assert.equal(byId.get("save-checkpoint")?.disabled, true);
  assert.equal(byId.get("open-folder")?.disabled, true);
  assert.equal(byId.get("open-guide")?.disabled, undefined);
});

test("ranks labels before detail and keyword matches while retaining declaration order", () => {
  const registry = commands();
  assert.deepEqual(
    filterOrbitWorkbenchCommands(registry, "preview")
      .map((command) => command.id)
      .slice(0, 2),
    ["show-preview", "show-split"],
  );
  assert.deepEqual(
    filterOrbitWorkbenchCommands(registry, "folder").map((command) => command.id),
    ["open-folder"],
  );
  assert.deepEqual(
    filterOrbitWorkbenchCommands(registry, "docx").map((command) => command.id),
    ["import-files"],
  );
  assert.deepEqual(filterOrbitWorkbenchCommands(registry, "does not exist"), []);
  assert.deepEqual(filterOrbitWorkbenchCommands(registry, ""), registry);
});

test("matches Chinese command synonyms without language-specific UI branching", () => {
  const registry = createOrbitWorkbenchCommands({
    ui: orbitUICopy("zh-CN").workbench,
    locale: "zh-CN",
    artifactCreationDisabled: false,
    canCreateBriefing: true,
    canUseWorkspace: true,
    canCheckpoint: true,
    canOpenFolder: true,
  });
  assert.equal(filterOrbitWorkbenchCommands(registry, "复盘")[0]?.id, "operating-review");
  assert.equal(filterOrbitWorkbenchCommands(registry, "分屏")[0]?.id, "show-split");
  assert.equal(filterOrbitWorkbenchCommands(registry, "模型")[0]?.id, "open-models");
});

test("ships complete command-surface copy for every supported locale", () => {
  for (const locale of ["zh-CN", "zh-TW", "en", "fr", "es", "ru", "ar", "ja", "ko"]) {
    const copy = orbitCommandMenuCopy(locale);
    assert.ok(copy.title.length > 0, locale);
    assert.ok(copy.placeholder.length > 0, locale);
    assert.deepEqual(Object.keys(copy.groups), ["create", "workspace", "view", "help"]);
  }
});

test("keeps keyboard navigation, accessible ownership, and writes outside the command UI", async () => {
  const [component, workbench, styles] = await Promise.all([
    readFile(new URL("../app/components/workbench-command-menu.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/components/orbit-workbench.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/styles/overlays.css", import.meta.url), "utf8"),
  ]);
  assert.match(component, /role="dialog"/);
  assert.match(component, /role="combobox"/);
  assert.match(component, /role="listbox"/);
  assert.match(component, /role="option"/);
  assert.match(component, /ArrowDown/);
  assert.match(component, /ArrowUp/);
  assert.match(component, /COMMAND_ICONS/);
  assert.match(component, /command-menu-glyph group-\$\{command\.group\}/);
  assert.doesNotMatch(component, /command-menu-glyph \$\{command\.group\}/);
  assert.match(component, /scrollIntoView\(\{ block: "nearest" \}\)/);
  assert.match(component, /previousFocusRef/);
  assert.doesNotMatch(component, /setArtifacts|persistDeviceWorkspace|localStorage|fetch\(/);
  assert.match(workbench, /event\.shiftKey && event\.key\.toLowerCase\(\) === "p"/);
  assert.match(workbench, /function runWorkbenchCommand\(commandId: OrbitWorkbenchCommandId\)/);
  assert.match(styles, /\.command-menu-backdrop\s*\{[^}]*z-index:\s*var\(--orbit-layer-modal\)/s);
  assert.match(styles, /\.command-menu\s*\{[^}]*grid-template-rows:\s*auto minmax\(0, 1fr\)/s);
  assert.match(styles, /\.command-menu-results\s*\{[^}]*overflow-y:\s*auto/s);
});
