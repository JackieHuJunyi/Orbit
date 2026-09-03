import { execFile } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const root = path.resolve(import.meta.dirname, "..");
const source = path.join(root, "app", "icon.svg");
const destination = path.join(root, "desktop", "orbit-app-icon.icns");

if (process.platform !== "darwin") throw new Error("The macOS icon can be prepared only on macOS.");

const temporaryDirectory = await mkdtemp(path.join(tmpdir(), "orbit-macos-icon-"));
const iconset = path.join(temporaryDirectory, "Orbit.iconset");
const representations = [
  ["icon_16x16.png", 16],
  ["icon_16x16@2x.png", 32],
  ["icon_32x32.png", 32],
  ["icon_32x32@2x.png", 64],
  ["icon_128x128.png", 128],
  ["icon_128x128@2x.png", 256],
  ["icon_256x256.png", 256],
  ["icon_256x256@2x.png", 512],
  ["icon_512x512.png", 512],
  ["icon_512x512@2x.png", 1024],
];

try {
  await execFileAsync("/bin/mkdir", ["-p", iconset]);
  for (const [name, size] of representations) {
    await execFileAsync("/usr/bin/sips", [
      "-s",
      "format",
      "png",
      source,
      "--resampleHeightWidth",
      String(size),
      String(size),
      "--out",
      path.join(iconset, String(name)),
    ]);
  }
  await execFileAsync("/usr/bin/iconutil", ["-c", "icns", iconset, "-o", destination]);
  process.stdout.write(`${destination}\n`);
} finally {
  await rm(temporaryDirectory, { recursive: true, force: true });
}
