import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

export function isExpectedE2EStreamCancellation(line) {
  return /\[vinext\] Static file stream error for .*[/\\]dist[/\\]client[/\\]duckdb[/\\]duckdb-mvp\.wasm: Premature close\s*$/u.test(
    line,
  );
}

function pipeServerOutput(source, target) {
  source.setEncoding("utf8");
  let pending = "";
  source.on("data", (chunk) => {
    pending += chunk;
    const lines = pending.split(/\r?\n/u);
    pending = lines.pop() ?? "";
    for (const line of lines) {
      if (!isExpectedE2EStreamCancellation(line)) target.write(`${line}\n`);
    }
  });
  source.on("end", () => {
    if (pending && !isExpectedE2EStreamCancellation(pending)) target.write(pending);
  });
}

function startE2EServer() {
  const child = spawn(process.execPath, [resolve(root, "node_modules/vinext/dist/cli.js"), "start"], {
    cwd: root,
    env: { ...process.env, WRANGLER_LOG_PATH: process.env.WRANGLER_LOG_PATH ?? ".wrangler/wrangler.log" },
    stdio: ["inherit", "pipe", "pipe"],
  });
  pipeServerOutput(child.stdout, process.stdout);
  pipeServerOutput(child.stderr, process.stderr);

  for (const signal of ["SIGINT", "SIGTERM"]) {
    process.on(signal, () => child.kill(signal));
  }
  child.on("exit", (code, signal) => {
    if (signal) process.kill(process.pid, signal);
    else process.exitCode = code ?? 1;
  });
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) startE2EServer();
