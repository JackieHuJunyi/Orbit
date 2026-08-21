import assert from "node:assert/strict";
import test from "node:test";

import { commitDirectorySync, prepareDirectorySync, serializeDirectoryReadResult } from "../app/lib/directory-sync.ts";

const deviceArtifacts = [
  { id: "report", name: "report.md", kind: "document", language: "Markdown", source: "# Device report" },
  { id: "notes", name: "notes.md", kind: "document", language: "Markdown", source: "# Device notes" },
];
const folderArtifacts = [
  { id: "report", name: "report.md", kind: "document", language: "Markdown", source: "# Folder report" },
  { id: "brief", name: "brief.md", kind: "document", language: "Markdown", source: "# Folder brief" },
];
const emptyFolder = { artifacts: [], assets: [], errors: [], source: "empty" };
const populatedFolder = { artifacts: folderArtifacts, assets: [], errors: [], source: "manifest" };
const deviceStateSnapshot = "complete-device-state:v1";
const folderAsset = {
  id: "a".repeat(64),
  name: "folder-chart.png",
  mimeType: "image/png",
  size: 24,
  bytes: new Uint8Array(24),
};

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  Object.freeze(value);
  Object.values(value).forEach(deepFreeze);
  return value;
}

test("plans an exact pull with explicit add, update, and remove facts without mutating input", () => {
  const frozenDevice = deepFreeze(structuredClone(deviceArtifacts));
  const frozenFolder = deepFreeze(structuredClone(populatedFolder));
  const beforeDevice = JSON.stringify(frozenDevice);
  const beforeFolder = JSON.stringify(frozenFolder);
  const prepared = prepareDirectorySync({
    mode: "pull",
    directoryName: "Quarterly reports",
    deviceStateSnapshot,
    deviceArtifacts: frozenDevice,
    deviceAssets: [],
    directory: frozenFolder,
  });
  assert.deepEqual(prepared.errors, []);
  assert.ok(prepared.plan);
  assert.deepEqual(
    prepared.plan.changes.map(({ name, kind }) => [name, kind]),
    [
      ["report.md", "update"],
      ["brief.md", "add"],
      ["notes.md", "remove"],
    ],
  );
  assert.equal(prepared.plan.changedCount, 3);
  assert.equal(prepared.plan.target.artifactCount, 2);
  assert.equal(prepared.plan.baseDirectorySnapshot, serializeDirectoryReadResult(frozenFolder));
  assert.equal(JSON.stringify(frozenDevice), beforeDevice);
  assert.equal(JSON.stringify(frozenFolder), beforeFolder);
  assert.ok(Object.isFrozen(prepared.plan.changes));
});

test("distinguishes empty-folder initialization, retained files, and an already matching manifest", () => {
  const initialized = prepareDirectorySync({
    mode: "initialize",
    directoryName: "New folder",
    deviceStateSnapshot,
    deviceArtifacts,
    deviceAssets: [],
    directory: emptyFolder,
  });
  assert.ok(initialized.plan);
  assert.equal(initialized.plan.changedCount, 2);
  assert.ok(initialized.plan.changes.every((change) => change.kind === "add"));

  const pushed = prepareDirectorySync({
    mode: "push",
    directoryName: "Quarterly reports",
    deviceStateSnapshot,
    deviceArtifacts,
    deviceAssets: [],
    directory: populatedFolder,
  });
  assert.ok(pushed.plan);
  assert.deepEqual(
    pushed.plan.changes.map(({ name, kind }) => [name, kind]),
    [
      ["report.md", "update"],
      ["notes.md", "add"],
      ["brief.md", "retain"],
    ],
  );
  assert.equal(pushed.plan.retainedCount, 1);

  const pulledAsset = prepareDirectorySync({
    mode: "pull",
    directoryName: "Quarterly reports",
    deviceStateSnapshot,
    deviceArtifacts,
    deviceAssets: [],
    directory: { ...populatedFolder, assets: [folderAsset] },
  });
  assert.ok(pulledAsset.plan);
  assert.deepEqual(
    pulledAsset.plan.changes.filter((change) => change.entryType === "asset").map(({ name, kind }) => [name, kind]),
    [["folder-chart.png", "add"]],
  );
  assert.equal(pulledAsset.plan.target.assetCount, 1);

  const matching = prepareDirectorySync({
    mode: "push",
    directoryName: "Quarterly reports",
    deviceStateSnapshot,
    deviceArtifacts: structuredClone(folderArtifacts),
    deviceAssets: [],
    directory: populatedFolder,
  });
  assert.equal(matching.plan, null);
  assert.match(matching.errors[0], /already matches/u);
});

test("rejects invalid direction, folder evidence, workspace content, and asset identity", () => {
  assert.match(
    prepareDirectorySync({
      mode: "push",
      directoryName: "Missing revision",
      deviceStateSnapshot: "",
      deviceArtifacts,
      deviceAssets: [],
      directory: populatedFolder,
    }).errors[0],
    /snapshot is not available/u,
  );
  assert.match(
    prepareDirectorySync({
      mode: "pull",
      directoryName: "Empty",
      deviceStateSnapshot,
      deviceArtifacts,
      deviceAssets: [],
      directory: emptyFolder,
    }).errors[0],
    /does not contain/u,
  );
  assert.match(
    prepareDirectorySync({
      mode: "initialize",
      directoryName: "Populated",
      deviceStateSnapshot,
      deviceArtifacts,
      deviceAssets: [],
      directory: populatedFolder,
    }).errors[0],
    /no longer empty/u,
  );
  assert.match(
    prepareDirectorySync({
      mode: "push",
      directoryName: "Broken",
      deviceStateSnapshot,
      deviceArtifacts,
      deviceAssets: [],
      directory: { ...populatedFolder, errors: ["Broken manifest"] },
    }).errors[0],
    /Broken manifest/u,
  );
  assert.match(
    prepareDirectorySync({
      mode: "push",
      directoryName: "Assets",
      deviceStateSnapshot,
      deviceArtifacts,
      deviceAssets: [{ id: "bad", name: "x.png", mimeType: "image/png", size: 10 }],
      directory: populatedFolder,
    }).errors[0],
    /invalid or repeated/u,
  );
  assert.match(
    prepareDirectorySync({
      mode: "push",
      directoryName: "Filename collision",
      deviceStateSnapshot,
      deviceArtifacts: [deviceArtifacts[0], { ...deviceArtifacts[1], name: "REPORT.md" }],
      deviceAssets: [],
      directory: populatedFolder,
    }).errors[0],
    /case-insensitive folder/u,
  );
});

test("rechecks exact device and folder snapshots before opening the injected write boundary", async () => {
  const expected = prepareDirectorySync({
    mode: "push",
    directoryName: "Quarterly reports",
    deviceStateSnapshot,
    deviceArtifacts,
    deviceAssets: [],
    directory: populatedFolder,
  }).plan;
  assert.ok(expected);
  let applied = 0;
  const commit = (overrides = {}) =>
    commitDirectorySync({
      expectedPlan: expected,
      readCurrentDeviceStateSnapshot: () => deviceStateSnapshot,
      readCurrentArtifacts: () => structuredClone(deviceArtifacts),
      readCurrentAssets: async () => [],
      readDirectory: async () => structuredClone(populatedFolder),
      apply: async (plan, directory) => {
        applied += 1;
        assert.equal(plan.mode, "push");
        assert.equal(serializeDirectoryReadResult(directory), expected.baseDirectorySnapshot);
      },
      ...overrides,
    });

  await commit();
  assert.equal(applied, 1);
  await assert.rejects(
    () => commit({ readCurrentDeviceStateSnapshot: () => "changed-device-state" }),
    /complete device workspace changed/u,
  );
  await assert.rejects(
    () => commit({ readCurrentArtifacts: () => [{ ...deviceArtifacts[0], source: "# Changed" }, deviceArtifacts[1]] }),
    /device workspace changed/u,
  );
  await assert.rejects(
    () =>
      commit({
        readDirectory: async () => ({
          ...structuredClone(populatedFolder),
          artifacts: [{ ...folderArtifacts[0], source: "# External edit" }, folderArtifacts[1]],
        }),
      }),
    /folder changed/u,
  );
  await assert.rejects(
    () => commit({ expectedPlan: { ...expected, changedCount: expected.changedCount + 1 } }),
    /plan changed after review/u,
  );
  assert.equal(applied, 1);
});

test("contains injected write failures outside frozen caller state", async () => {
  const current = deepFreeze(structuredClone(deviceArtifacts));
  const directory = deepFreeze(structuredClone(populatedFolder));
  const beforeCurrent = JSON.stringify(current);
  const beforeDirectory = JSON.stringify(directory);
  const expected = prepareDirectorySync({
    mode: "push",
    directoryName: "Quarterly reports",
    deviceStateSnapshot,
    deviceArtifacts: current,
    deviceAssets: [],
    directory,
  }).plan;
  assert.ok(expected);
  await assert.rejects(
    () =>
      commitDirectorySync({
        expectedPlan: expected,
        readCurrentDeviceStateSnapshot: () => deviceStateSnapshot,
        readCurrentArtifacts: () => current,
        readCurrentAssets: async () => [],
        readDirectory: async () => directory,
        apply: async () => {
          throw new Error("permission lost");
        },
      }),
    /permission lost/u,
  );
  assert.equal(JSON.stringify(current), beforeCurrent);
  assert.equal(JSON.stringify(directory), beforeDirectory);
});
