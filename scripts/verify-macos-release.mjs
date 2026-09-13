import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { FuseState, FuseV1Options, getCurrentFuseWire } from "@electron/fuses";

const execFileAsync = promisify(execFile);
const root = path.resolve(import.meta.dirname, "..");
const packageJson = JSON.parse(await readFile(path.join(root, "package.json"), "utf8"));
const requestedArch = process.argv.find((argument) => argument.startsWith("--arch="))?.slice("--arch=".length);
const arch = requestedArch || process.arch;
const directory = path.join(root, "out", "macos", packageJson.version, arch);
const manifest = JSON.parse(
  await readFile(path.join(directory, `Orbit-${packageJson.version}-macos-${arch}-manifest.json`), "utf8"),
);
const appPath = path.join(directory, "Orbit.app");
const executablePath = path.join(appPath, "Contents", "MacOS", "Orbit");

if (manifest.channel !== "internal-qa" && manifest.channel !== "release") {
  throw new Error("The package manifest has an unknown distribution channel.");
}
if (manifest.distributionReady !== (manifest.channel === "release" && manifest.signed && manifest.notarized)) {
  throw new Error("The package manifest overstates or understates distribution readiness.");
}
for (const artifact of [manifest.artifacts.zip, manifest.artifacts.dmg]) {
  const markedInternal = artifact.fileName.includes("-internal-qa.");
  if ((manifest.channel === "internal-qa") !== markedInternal) {
    throw new Error(`${artifact.fileName} does not match the declared distribution channel.`);
  }
}

for (const artifact of [manifest.artifacts.zip, manifest.artifacts.dmg]) {
  const filePath = path.join(directory, artifact.fileName);
  const metadata = await stat(filePath);
  const digest = createHash("sha256")
    .update(await readFile(filePath))
    .digest("hex");
  if (metadata.size !== artifact.bytes || digest !== artifact.sha256) {
    throw new Error(`${artifact.fileName} does not match the release manifest.`);
  }
}
await execFileAsync("/usr/bin/codesign", ["--verify", "--deep", "--strict", appPath]);
const { stdout: architectures } = await execFileAsync("/usr/bin/lipo", ["-archs", executablePath]);
const expectedBinaryArchitecture = arch === "x64" ? "x86_64" : arch;
if (!architectures.trim().split(/\s+/u).includes(expectedBinaryArchitecture)) {
  throw new Error(`Orbit.app is not a ${arch} build.`);
}
const fuseWire = await getCurrentFuseWire(appPath);
for (const [option, state] of [
  [FuseV1Options.RunAsNode, FuseState.DISABLE],
  [FuseV1Options.EnableCookieEncryption, manifest.channel === "release" ? FuseState.ENABLE : FuseState.DISABLE],
  [FuseV1Options.EnableNodeOptionsEnvironmentVariable, FuseState.DISABLE],
  [FuseV1Options.EnableNodeCliInspectArguments, FuseState.DISABLE],
  [FuseV1Options.EnableEmbeddedAsarIntegrityValidation, FuseState.ENABLE],
  [FuseV1Options.OnlyLoadAppFromAsar, FuseState.ENABLE],
  [FuseV1Options.WasmTrapHandlers, FuseState.ENABLE],
]) {
  if (fuseWire[option] !== state) throw new Error(`The release fuse contract is incomplete at option ${option}.`);
}
if (manifest.signed) await execFileAsync("/usr/sbin/spctl", ["--assess", "--type", "execute", "--verbose=2", appPath]);
if (manifest.notarized) {
  await execFileAsync("/usr/bin/xcrun", ["stapler", "validate", appPath]);
  await execFileAsync("/usr/bin/xcrun", ["stapler", "validate", path.join(directory, manifest.artifacts.dmg.fileName)]);
}
process.stdout.write(
  `${JSON.stringify({
    version: manifest.version,
    arch,
    channel: manifest.channel,
    distributionReady: manifest.distributionReady,
    signed: manifest.signed,
    notarized: manifest.notarized,
  })}\n`,
);
