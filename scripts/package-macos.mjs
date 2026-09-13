import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { access, chmod, cp, mkdir, mkdtemp, readFile, rename, rm, stat, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { createPackageWithOptions, getRawHeader, listPackage } from "@electron/asar";
import { downloadArtifact } from "@electron/get";
import { FuseV1Options, FuseVersion, flipFuses } from "@electron/fuses";
import { notarize } from "@electron/notarize";
import { sign } from "@electron/osx-sign";
import plist from "plist";

const execFileAsync = promisify(execFile);
const root = path.resolve(import.meta.dirname, "..");
const packageJson = JSON.parse(await readFile(path.join(root, "package.json"), "utf8"));
const electronVersion = JSON.parse(
  await readFile(path.join(root, "node_modules", "electron", "package.json"), "utf8"),
).version;
const requestedArch = process.argv.find((argument) => argument.startsWith("--arch="))?.slice("--arch=".length);
const arch = requestedArch || process.arch;
const requireSigning = process.argv.includes("--require-signing");
const allowedArchitectures = new Set(["arm64", "x64"]);
if (process.platform !== "darwin") throw new Error("Orbit macOS packages must be built on macOS.");
if (!allowedArchitectures.has(arch)) throw new Error("Choose --arch=arm64 or --arch=x64.");
if (typeof packageJson.version !== "string" || !/^\d+\.\d+\.\d+$/u.test(packageJson.version)) {
  throw new Error("Orbit requires a three-part package version for macOS releases.");
}

const signIdentity = process.env.ORBIT_MAC_SIGN_IDENTITY?.trim() || "";
const signKeychain = process.env.ORBIT_MAC_KEYCHAIN?.trim() || undefined;
const notaryProfile = process.env.ORBIT_NOTARY_KEYCHAIN_PROFILE?.trim() || "";
const appleId = process.env.APPLE_ID?.trim() || "";
const appleIdPassword = process.env.APPLE_APP_SPECIFIC_PASSWORD?.trim() || "";
const appleTeamId = process.env.APPLE_TEAM_ID?.trim() || "";
const internalQa = !requireSigning;
const artifactSuffix = internalQa ? "-internal-qa" : "";
const passwordNotaryReady = Boolean(appleId && appleIdPassword && appleTeamId);
const anyPasswordNotaryValue = Boolean(appleId || appleIdPassword || appleTeamId);
if (anyPasswordNotaryValue && !passwordNotaryReady) {
  throw new Error("APPLE_ID, APPLE_APP_SPECIFIC_PASSWORD, and APPLE_TEAM_ID must be supplied together.");
}
if (requireSigning && !signIdentity) throw new Error("ORBIT_MAC_SIGN_IDENTITY is required for a release package.");
if (requireSigning && !notaryProfile && !passwordNotaryReady) {
  throw new Error("Release packaging requires a notary keychain profile or complete Apple ID credentials.");
}
if (
  requireSigning &&
  process.env.GITHUB_REF_TYPE === "tag" &&
  process.env.GITHUB_REF_NAME !== `v${packageJson.version}`
) {
  throw new Error(
    `Release tag ${process.env.GITHUB_REF_NAME ?? ""} must match package version v${packageJson.version}.`,
  );
}

const outputBase = path.join(root, "out", "macos", packageJson.version, arch);
const allowedOutputRoot = `${path.join(root, "out", "macos")}${path.sep}`;
if (!outputBase.startsWith(allowedOutputRoot))
  throw new Error("The macOS output path escaped Orbit's release directory.");
await rm(outputBase, { recursive: true, force: true });
await mkdir(outputBase, { recursive: true });

const temporaryDirectory = await mkdtemp(path.join(tmpdir(), `orbit-macos-${arch}-`));
const extractedDirectory = path.join(temporaryDirectory, "electron");
const payloadDirectory = path.join(temporaryDirectory, "payload");
const dmgDirectory = path.join(temporaryDirectory, "dmg");
const appPath = path.join(outputBase, "Orbit.app");
const resourcesPath = path.join(appPath, "Contents", "Resources");
const appAsarPath = path.join(resourcesPath, "app.asar");
const executablePath = path.join(appPath, "Contents", "MacOS", "Orbit");
const infoPath = path.join(appPath, "Contents", "Info.plist");
const zipPath = path.join(outputBase, `Orbit-${packageJson.version}-macos-${arch}${artifactSuffix}.zip`);
const dmgPath = path.join(outputBase, `Orbit-${packageJson.version}-macos-${arch}${artifactSuffix}.dmg`);
const manifestPath = path.join(outputBase, `Orbit-${packageJson.version}-macos-${arch}-manifest.json`);

function notaryCredentials() {
  if (notaryProfile) return { keychainProfile: notaryProfile, ...(signKeychain ? { keychain: signKeychain } : {}) };
  if (passwordNotaryReady) return { appleId, appleIdPassword, teamId: appleTeamId };
  return null;
}

async function sha256(filePath) {
  return createHash("sha256")
    .update(await readFile(filePath))
    .digest("hex");
}

async function createDiskImage(sourceDirectory, destination) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      await execFileAsync("/usr/bin/hdiutil", [
        "create",
        "-volname",
        internalQa ? "Orbit Internal QA" : "Orbit",
        "-srcfolder",
        sourceDirectory,
        "-ov",
        "-format",
        "UDZO",
        destination,
      ]);
      return;
    } catch (error) {
      const message = `${error?.stderr ?? ""} ${error instanceof Error ? error.message : ""}`;
      if (attempt === 2 || !/device not configured|resource busy|设备未配置/iu.test(message)) throw error;
      await rm(destination, { force: true });
      await new Promise((resolve) => setTimeout(resolve, 500 * (attempt + 1)));
    }
  }
}

try {
  const iconPath = path.join(root, "desktop", "orbit-app-icon.icns");
  await access(iconPath).catch(() => {
    throw new Error("Run npm run prepare:macos-icon before packaging Orbit.");
  });
  const localElectronApp = path.join(root, "node_modules", "electron", "dist", "Electron.app");
  const localElectronAvailable = await access(localElectronApp).then(
    () => true,
    () => false,
  );
  if (arch === process.arch && localElectronAvailable) {
    await cp(localElectronApp, appPath, { recursive: true, verbatimSymlinks: true });
  } else {
    const electronArchive = await downloadArtifact({
      version: electronVersion,
      artifactName: "electron",
      platform: "darwin",
      arch,
    });
    await mkdir(extractedDirectory, { recursive: true });
    await execFileAsync("/usr/bin/ditto", ["-x", "-k", electronArchive, extractedDirectory]);
    await cp(path.join(extractedDirectory, "Electron.app"), appPath, { recursive: true, verbatimSymlinks: true });
  }
  await rename(path.join(appPath, "Contents", "MacOS", "Electron"), executablePath);
  await chmod(executablePath, 0o755);
  await rm(path.join(resourcesPath, "default_app.asar"), { force: true });
  await cp(iconPath, path.join(resourcesPath, "orbit.icns"));

  await mkdir(payloadDirectory, { recursive: true });
  for (const relative of ["dist", "desktop", "shared", "package.json", "THIRD_PARTY_NOTICES.md"]) {
    await cp(path.join(root, relative), path.join(payloadDirectory, relative), {
      recursive: true,
      verbatimSymlinks: true,
    });
  }
  await writeFile(
    path.join(payloadDirectory, "desktop", "build-channel.json"),
    `${JSON.stringify({ channel: internalQa ? "internal-qa" : "release" })}\n`,
    "utf8",
  );
  await createPackageWithOptions(payloadDirectory, appAsarPath, { dot: true, unpack: "**/*.node" });
  const packagedFiles = listPackage(appAsarPath, { isPack: false });
  for (const required of [
    "/package.json",
    "/desktop/main.mjs",
    "/desktop/build-channel.json",
    "/shared/account-model-catalog.mjs",
    "/dist/server/index.js",
  ]) {
    if (!packagedFiles.includes(required)) throw new Error(`The packaged ASAR is missing ${required}.`);
  }
  if (packagedFiles.some((file) => /^\/(?:app|tests?|e2e|docs|scripts|node_modules)\//u.test(file))) {
    throw new Error("The packaged ASAR contains development source, dependencies, or test files.");
  }

  const info = plist.parse(await readFile(infoPath, "utf8"));
  const asarHeaderHash = createHash("sha256").update(getRawHeader(appAsarPath).headerString).digest("hex");
  Object.assign(info, {
    CFBundleDisplayName: "Orbit",
    CFBundleExecutable: "Orbit",
    CFBundleIconFile: "orbit.icns",
    CFBundleIdentifier: "com.jackiehu.orbit",
    CFBundleName: "Orbit",
    CFBundleShortVersionString: packageJson.version,
    CFBundleVersion: packageJson.version,
    OrbitBuildChannel: internalQa ? "internal-qa" : "release",
    LSApplicationCategoryType: "public.app-category.productivity",
    NSAppleEventsUsageDescription:
      "Orbit uses Microsoft Word or PowerPoint only when you explicitly import or export a legacy Office file.",
    ElectronAsarIntegrity: {
      "Resources/app.asar": { algorithm: "SHA256", hash: asarHeaderHash },
    },
  });
  await writeFile(infoPath, plist.build(info), "utf8");
  await execFileAsync("/usr/bin/plutil", ["-lint", infoPath]);

  await flipFuses(appPath, {
    version: FuseVersion.V1,
    resetAdHocDarwinSignature: true,
    strictlyRequireAllFuses: true,
    [FuseV1Options.RunAsNode]: false,
    // Chromium cookie encryption uses the macOS Keychain and requires a stable
    // signing identity. Ad-hoc internal builds do not persist provider login
    // cookies, so enabling it there can block the first loopback navigation.
    [FuseV1Options.EnableCookieEncryption]: !internalQa,
    [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
    [FuseV1Options.EnableNodeCliInspectArguments]: false,
    [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: true,
    [FuseV1Options.OnlyLoadAppFromAsar]: true,
    // The stock Electron archive ships one architecture-specific snapshot,
    // not a separate browser-process snapshot file.
    [FuseV1Options.LoadBrowserProcessSpecificV8Snapshot]: false,
    [FuseV1Options.GrantFileProtocolExtraPrivileges]: false,
    [FuseV1Options.WasmTrapHandlers]: true,
  });

  let signed = false;
  let notarized = false;
  if (signIdentity) {
    await sign({
      app: appPath,
      identity: signIdentity,
      ...(signKeychain ? { keychain: signKeychain } : {}),
      platform: "darwin",
      optionsForFile: (filePath) =>
        path.resolve(filePath) === path.resolve(appPath)
          ? { entitlements: path.join(root, "desktop", "entitlements.mac.plist"), hardenedRuntime: true }
          : {},
    });
    signed = true;
    const credentials = notaryCredentials();
    if (credentials) {
      await notarize({ appPath, ...credentials });
      notarized = true;
    }
  } else {
    await execFileAsync("/usr/bin/codesign", ["--force", "--deep", "--sign", "-", appPath]);
  }

  await execFileAsync("/usr/bin/codesign", ["--verify", "--deep", "--strict", appPath]);
  const { stdout: packagedArchitectures } = await execFileAsync("/usr/bin/lipo", ["-archs", executablePath]);
  const expectedBinaryArchitecture = arch === "x64" ? "x86_64" : arch;
  if (!packagedArchitectures.trim().split(/\s+/u).includes(expectedBinaryArchitecture)) {
    throw new Error(`The packaged executable does not contain the requested ${arch} architecture.`);
  }

  await execFileAsync("/usr/bin/ditto", ["-c", "-k", "--sequesterRsrc", "--keepParent", appPath, zipPath]);
  await mkdir(dmgDirectory, { recursive: true });
  await cp(appPath, path.join(dmgDirectory, "Orbit.app"), { recursive: true, verbatimSymlinks: true });
  await symlink("/Applications", path.join(dmgDirectory, "Applications"));
  await createDiskImage(dmgDirectory, dmgPath);
  if (signIdentity) {
    await execFileAsync("/usr/bin/codesign", ["--force", "--timestamp", "--sign", signIdentity, dmgPath]);
    const credentials = notaryCredentials();
    if (credentials) {
      await notarize({ appPath: dmgPath, ...credentials });
    }
  }

  const [appAsarStat, zipStat, dmgStat] = await Promise.all([stat(appAsarPath), stat(zipPath), stat(dmgPath)]);
  const manifest = {
    schemaVersion: 1,
    product: "Orbit",
    version: packageJson.version,
    arch,
    electronVersion,
    bundleIdentifier: "com.jackiehu.orbit",
    channel: internalQa ? "internal-qa" : "release",
    distributionReady: !internalQa && signed && notarized,
    signed,
    notarized,
    artifacts: {
      appAsar: { bytes: appAsarStat.size, sha256: await sha256(appAsarPath) },
      zip: { fileName: path.basename(zipPath), bytes: zipStat.size, sha256: await sha256(zipPath) },
      dmg: { fileName: path.basename(dmgPath), bytes: dmgStat.size, sha256: await sha256(dmgPath) },
    },
  };
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  process.stdout.write(`${JSON.stringify(manifest, null, 2)}\n`);
} finally {
  await rm(temporaryDirectory, { recursive: true, force: true });
}
