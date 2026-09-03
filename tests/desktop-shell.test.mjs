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

test("ships narrow context-isolated desktop capabilities without renderer Node access", () => {
  assert.match(main, /contextIsolation:\s*true/);
  assert.match(main, /nodeIntegration:\s*false/);
  assert.match(main, /sandbox:\s*true/);
  assert.match(preload, /rune:convert-legacy-office/);
  assert.match(preload, /rune:export-legacy-office/);
  assert.match(preload, /rune:discover-models/);
  assert.match(preload, /rune:import-discovered-model/);
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
  assert.match(main, /RUNE_DESKTOP_RUNTIME = "1"/);
});

test("legacy Office conversion is bounded, macro-disabled, temporary, and review-first", () => {
  assert.match(legacyOffice, /MAX_LEGACY_BYTES = 12 \* 1024 \* 1024/);
  assert.match(legacyOffice, /CONVERSION_TIMEOUT_MS = 60_000/);
  assert.match(legacyOffice, /msoAutomationSecurityForceDisable/g);
  assert.equal(legacyOffice.match(/set display alerts to alerts none/g)?.length, 2);
  assert.equal(legacyOffice.match(/open POSIX file/g)?.length, 4);
  assert.equal(legacyOffice.match(/repeat 100 times/g)?.length, 4);
  assert.match(legacyOffice, /open POSIX file[\s\S]*set convertedDocument to active document/);
  assert.match(legacyOffice, /save as convertedDocument[\s\S]*set convertedDocument to active document/);
  assert.match(legacyOffice, /open POSIX file[\s\S]*set exportedDocument to active document/);
  assert.match(legacyOffice, /save as exportedDocument[\s\S]*set exportedDocument to active document/);
  assert.match(legacyOffice, /realpath\(await mkdtemp/);
  assert.equal(legacyOffice.match(/full name of openPresentation as text/g)?.length, 4);
  assert.match(legacyOffice, /save convertedPresentation[\s\S]*openPresentationPath is \$\{input\}/);
  assert.match(legacyOffice, /save exportedPresentation[\s\S]*openPresentationPath is \$\{output\}/);
  assert.match(legacyOffice, /mkdtemp\(/);
  assert.match(legacyOffice, /rm\(privateDirectory, \{ recursive: true, force: true \}\)/);
  assert.match(legacyOffice, /officeProcessRunning/);
  assert.match(legacyOffice, /process-inspection failure must never authorize Orbit to quit/);
  assert.equal(legacyOffice.match(/if \(!officeWasRunning\) await quitOfficeStartedByOrbit\(kind\)/g)?.length, 2);
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

test("desktop navigation remains pinned to Orbit's ephemeral loopback origin", () => {
  assert.match(main, /server\.listen\(0, "127\.0\.0\.1"/);
  assert.match(main, /serveStaticAsset\(request, response, url\)/);
  assert.match(main, /assetPath\.startsWith\(`\$\{clientDirectory\}\$\{path\.sep\}`\)/);
  assert.match(main, /"x-content-type-options": "nosniff"/);
  assert.match(main, /responseHeaders\["content-security-policy"\]/);
  assert.match(main, /setWindowOpenHandler\(\(\) => \(\{ action: "deny" \}\)\)/);
  assert.match(main, /if \(new URL\(target\)\.origin !== runeServer\.url\) event\.preventDefault\(\)/);
  assert.match(main, /app\.on\("activate"/);
});
