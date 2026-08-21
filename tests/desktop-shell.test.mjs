import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [main, legacyOffice, preload, packageJson, workbench, workspaceFileImport, workspaceFileExportRuntime] =
  await Promise.all([
    readFile(new URL("../desktop/main.mjs", import.meta.url), "utf8"),
    readFile(new URL("../desktop/legacy-office.mjs", import.meta.url), "utf8"),
    readFile(new URL("../desktop/preload.cjs", import.meta.url), "utf8"),
    readFile(new URL("../package.json", import.meta.url), "utf8"),
    readFile(new URL("../app/components/rune-workbench.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/lib/workspace-file-import.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/lib/workspace-file-export-runtime.ts", import.meta.url), "utf8"),
  ]);

test("ships one context-isolated desktop conversion capability without renderer Node access", () => {
  assert.match(main, /contextIsolation:\s*true/);
  assert.match(main, /nodeIntegration:\s*false/);
  assert.match(main, /sandbox:\s*true/);
  assert.match(preload, /rune:convert-legacy-office/);
  assert.match(preload, /rune:export-legacy-office/);
  assert.match(preload, /require\("electron"\)/);
  assert.doesNotMatch(preload, /ipcRenderer\.(?:send|on)|require\("node:/);
  assert.match(packageJson, /"desktop:dev"/);
});

test("protects the desktop model-vault master key with Electron safeStorage", () => {
  assert.match(main, /safeStorage\.isEncryptionAvailable\(\)/);
  assert.match(main, /safeStorage\.decryptString\(await readFile\(encryptedPath\)\)/);
  assert.match(main, /safeStorage\.encryptString\(key\)/);
  assert.match(main, /randomBytes\(32\)\.toString\("hex"\)/);
  assert.match(main, /writeFile\(temporaryPath,[\s\S]*mode: 0o600, flag: "wx"/);
  assert.match(main, /process\.env\.RUNE_CREDENTIAL_ENCRYPTION_KEY = key/);
  assert.doesNotMatch(preload, /credential|safeStorage|RUNE_CREDENTIAL/);
});

test("legacy Office conversion is bounded, macro-disabled, temporary, and review-first", () => {
  assert.match(legacyOffice, /MAX_LEGACY_BYTES = 12 \* 1024 \* 1024/);
  assert.match(legacyOffice, /CONVERSION_TIMEOUT_MS = 30_000/);
  assert.match(legacyOffice, /msoAutomationSecurityForceDisable/g);
  assert.match(legacyOffice, /mkdtemp\(/);
  assert.match(legacyOffice, /rm\(privateDirectory, \{ recursive: true, force: true \}\)/);
  assert.match(workspaceFileImport, /convertLegacyOfficeFile/);
  assert.match(workspaceFileImport, /convertOfficeFileWithAssets/);
  assert.match(workbench, /convertWorkspaceImportFiles/);
  assert.match(workbench, /prepareWorkspaceImportReview/);
  assert.match(legacyOffice, /format document97/);
  assert.match(legacyOffice, /save as presentation/);
  assert.match(workspaceFileExportRuntime, /exportLegacyOfficeFile/);
  assert.match(workbench, /workspace-file-export-runtime/);
  assert.match(workspaceFileExportRuntime, /Legacy Office output is a compatibility handoff/);
});

test("desktop navigation remains pinned to Rune's ephemeral loopback origin", () => {
  assert.match(main, /server\.listen\(0, "127\.0\.0\.1"/);
  assert.match(main, /serveStaticAsset\(request, response, url\)/);
  assert.match(main, /assetPath\.startsWith\(`\$\{clientDirectory\}\$\{path\.sep\}`\)/);
  assert.match(main, /"x-content-type-options": "nosniff"/);
  assert.match(main, /responseHeaders\["content-security-policy"\]/);
  assert.match(main, /setWindowOpenHandler\(\(\) => \(\{ action: "deny" \}\)\)/);
  assert.match(main, /if \(new URL\(target\)\.origin !== runeServer\.url\) event\.preventDefault\(\)/);
  assert.match(main, /app\.on\("activate"/);
});
