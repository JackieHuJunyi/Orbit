import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [
  main,
  legacyOffice,
  preload,
  packageJson,
  workbench,
  workspaceFileImport,
  workspaceFileExportRuntime,
  macPackage,
  macVerify,
  macReleaseWorkflow,
  macSmoke,
  releaseQualityWorkflow,
] = await Promise.all([
  readFile(new URL("../desktop/main.mjs", import.meta.url), "utf8"),
  readFile(new URL("../desktop/legacy-office.mjs", import.meta.url), "utf8"),
  readFile(new URL("../desktop/preload.cjs", import.meta.url), "utf8"),
  readFile(new URL("../package.json", import.meta.url), "utf8"),
  readFile(new URL("../app/components/rune-workbench.tsx", import.meta.url), "utf8"),
  readFile(new URL("../app/lib/workspace-file-import.ts", import.meta.url), "utf8"),
  readFile(new URL("../app/lib/workspace-file-export-runtime.ts", import.meta.url), "utf8"),
  readFile(new URL("../scripts/package-macos.mjs", import.meta.url), "utf8"),
  readFile(new URL("../scripts/verify-macos-release.mjs", import.meta.url), "utf8"),
  readFile(new URL("../.github/workflows/macos-release.yml", import.meta.url), "utf8"),
  readFile(new URL("../scripts/smoke-macos-package.mjs", import.meta.url), "utf8"),
  readFile(new URL("../.github/workflows/release-quality.yml", import.meta.url), "utf8"),
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
  assert.match(main, /if \(\/\^\[a-f0-9\]\{64\}\$\/\.test\(configuredKey/);
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
  assert.match(main, /server\.listen\(requestedQaPort, "127\.0\.0\.1"/);
  assert.match(main, /ORBIT_DESKTOP_QA_PORT must be an integer from 1024 through 65535/);
  assert.match(main, /serveStaticAsset\(request, response, url\)/);
  assert.match(main, /assetPath\.startsWith\(`\$\{clientDirectory\}\$\{path\.sep\}`\)/);
  assert.match(main, /"x-content-type-options": "nosniff"/);
  assert.match(main, /responseHeaders\["content-security-policy"\]/);
  assert.match(main, /setWindowOpenHandler\(\(\) => \(\{ action: "deny" \}\)\)/);
  assert.match(main, /if \(new URL\(target\)\.origin !== runeServer\.url\) event\.preventDefault\(\)/);
  assert.match(main, /app\.on\("activate"/);
  assert.match(main, /async function loadDesktopWorkspace/);
  assert.match(main, /for \(let attempt = 0; attempt < 3; attempt \+= 1\)/);
  assert.match(main, /dialog\.showErrorBox/);
  assert.match(main, /show: false/);
  assert.match(main, /mainWindow = window[\s\S]*window\.center\(\)[\s\S]*window\.show\(\)[\s\S]*window\.focus\(\)/);
  assert.match(main, /app\.setActivationPolicy\("regular"\)/);
});

test("ships a bounded signed, notarized, integrity-checked macOS release chain", () => {
  const parsedPackage = JSON.parse(packageJson);
  assert.equal(parsedPackage.main, "desktop/main.mjs");
  assert.equal(parsedPackage.productName, "Orbit");
  assert.match(parsedPackage.scripts["desktop:release:mac"], /--arch=arm64 --require-signing/);
  assert.match(parsedPackage.scripts["desktop:release:mac"], /--arch=x64 --require-signing/);
  assert.equal(parsedPackage.scripts["desktop:smoke:mac"], "node scripts/smoke-macos-package.mjs");
  assert.match(macPackage, /createPackageWithOptions/);
  assert.match(macPackage, /ElectronAsarIntegrity/);
  assert.match(macPackage, /strictlyRequireAllFuses: true/);
  assert.match(macPackage, /EnableEmbeddedAsarIntegrityValidation/);
  assert.match(macPackage, /OnlyLoadAppFromAsar/);
  assert.match(macPackage, /WasmTrapHandlers/);
  assert.match(macPackage, /await sign\(/);
  assert.equal(macPackage.match(/await notarize\(/g)?.length, 2);
  assert.match(macPackage, /\/usr\/bin\/hdiutil/);
  assert.match(macPackage, /attempt < 3/);
  assert.match(macPackage, /device not configured\|resource busy\|设备未配置/);
  assert.match(macPackage, /NSAppleEventsUsageDescription/);
  assert.doesNotMatch(macPackage, /(?:app|tests\?|e2e|docs|scripts|node_modules).*payloadDirectory/);
  assert.match(macVerify, /getCurrentFuseWire/);
  assert.match(macVerify, /stapler", "validate"/);
  assert.match(macReleaseWorkflow, /tags: \["v\*"\]/);
  assert.match(macReleaseWorkflow, /MACOS_CERTIFICATE/);
  assert.match(macReleaseWorkflow, /APPLE_APP_SPECIFIC_PASSWORD/);
  assert.match(macReleaseWorkflow, /gh release create/);
  assert.match(macSmoke, /ORBIT_DESKTOP_QA_PORT/);
  assert.match(macSmoke, /RUNE_CREDENTIAL_ENCRYPTION_KEY: "a"\.repeat\(64\)/);
  assert.match(macSmoke, /Packaged Orbit did not return the expected product document/);
  assert.match(releaseQualityWorkflow, /macos-package:[\s\S]*smoke-macos-package\.mjs/);
});
