import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const packageJson = JSON.parse(await readFile(path.join(root, "package.json"), "utf8"));
const requestedArch = process.argv.find((argument) => argument.startsWith("--arch="))?.slice("--arch=".length);
const arch = requestedArch || process.arch;
if (process.platform !== "darwin") throw new Error("The packaged Orbit smoke test requires macOS.");
if (!new Set(["arm64", "x64"]).has(arch)) throw new Error("Choose --arch=arm64 or --arch=x64.");

async function availableLoopbackPort() {
  const server = createServer();
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Could not reserve a loopback QA port.");
  await new Promise((resolve) => server.close(resolve));
  return address.port;
}

const port = await availableLoopbackPort();
const qaProfile = await mkdtemp(path.join(tmpdir(), "orbit-package-smoke-"));
const executable = path.join(
  root,
  "out",
  "macos",
  packageJson.version,
  arch,
  "Orbit.app",
  "Contents",
  "MacOS",
  "Orbit",
);
let output = "";
const child = spawn(executable, [], {
  cwd: root,
  detached: true,
  env: {
    ...process.env,
    ORBIT_DESKTOP_QA_PORT: String(port),
    ORBIT_DESKTOP_QA_PROFILE: qaProfile,
    ORBIT_CREDENTIAL_ENCRYPTION_KEY: "a".repeat(64),
  },
  stdio: ["ignore", "pipe", "pipe"],
});
for (const stream of [child.stdout, child.stderr]) {
  stream.setEncoding("utf8");
  stream.on("data", (chunk) => {
    output = `${output}${chunk}`.slice(-4_000);
  });
}

const stop = async () => {
  if (!child.pid || child.exitCode != null || child.signalCode) return;
  try {
    process.kill(-child.pid, "SIGINT");
  } catch {
    return;
  }
  await Promise.race([
    new Promise((resolve) => child.once("exit", resolve)),
    new Promise((resolve) => setTimeout(resolve, 3_000)),
  ]);
  if (child.exitCode == null && !child.signalCode) {
    try {
      process.kill(-child.pid, "SIGKILL");
    } catch {
      // The process group exited between the check and the final bounded stop.
    }
  }
};

try {
  let html = "";
  let lastError;
  for (let attempt = 0; attempt < 120; attempt += 1) {
    if (child.exitCode != null || child.signalCode) {
      throw new Error(`Packaged Orbit exited before its local workspace was ready.\n${output}`);
    }
    try {
      const response = await fetch(`http://127.0.0.1:${port}/`, { signal: AbortSignal.timeout(1_000) });
      if (response.ok) {
        html = await response.text();
        break;
      }
      lastError = new Error(`Orbit returned HTTP ${response.status}.`);
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  if (!html)
    throw lastError instanceof Error ? lastError : new Error("Packaged Orbit did not start within 30 seconds.");
  if (!html.includes("<title>Orbit — Work that traces back to source</title>")) {
    throw new Error("Packaged Orbit did not return the expected product document.");
  }
  process.stdout.write(`${JSON.stringify({ version: packageJson.version, arch, port: "loopback", ready: true })}\n`);
} finally {
  await stop();
  await rm(qaProfile, { recursive: true, force: true });
}
