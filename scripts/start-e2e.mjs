import { spawn } from "node:child_process";
import { readFile, stat } from "node:fs/promises";
import { createServer, request as requestHttp } from "node:http";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const duckDbDirectory = resolve(root, "dist", "client", "duckdb");
const upstreamPort = 3001;
const publicPort = 3000;

export function isExpectedE2EStreamCancellation(line) {
  return /\[vinext\] Static file stream error for .*[/\\]dist[/\\]client[/\\]duckdb[/\\](?:duckdb-mvp\.wasm(?:\.part-\d+)?|duckdb-browser-mvp\.worker\.js): Premature close\s*$/u.test(
    line,
  );
}

export function isE2EDuckDbAssetPath(pathname) {
  return /^\/duckdb\/(?:duckdb-browser-mvp\.worker\.js|duckdb-mvp\.wasm\.manifest\.json|duckdb-mvp\.wasm\.part-\d+)$/u.test(
    pathname,
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

async function serveDuckDbAsset(request, response, url) {
  if ((request.method !== "GET" && request.method !== "HEAD") || !isE2EDuckDbAssetPath(url.pathname)) {
    return false;
  }
  const fileName = url.pathname.slice("/duckdb/".length);
  const filePath = resolve(duckDbDirectory, fileName);
  if (!filePath.startsWith(`${duckDbDirectory}/`)) return false;
  const metadata = await stat(filePath).catch(() => undefined);
  if (!metadata?.isFile()) return false;
  const contentType =
    fileName.endsWith(".wasm") || fileName.includes(".wasm.part-")
      ? "application/wasm"
      : fileName.endsWith(".json")
        ? "application/json; charset=utf-8"
        : "text/javascript; charset=utf-8";
  const bytes = request.method === "HEAD" ? null : await readFile(filePath);
  response.writeHead(200, {
    "cache-control": "no-cache",
    "content-length": metadata.size,
    "content-type": contentType,
    "cross-origin-resource-policy": "same-origin",
    "x-content-type-options": "nosniff",
  });
  response.end(bytes ?? undefined);
  return true;
}

function proxyToVinext(request, response) {
  const upstream = requestHttp(
    {
      hostname: "127.0.0.1",
      port: upstreamPort,
      path: request.url,
      method: request.method,
      headers: request.headers,
    },
    (upstreamResponse) => {
      response.writeHead(upstreamResponse.statusCode ?? 502, upstreamResponse.headers);
      upstreamResponse.pipe(response);
    },
  );
  upstream.on("error", (error) => {
    if (response.headersSent) response.destroy(error);
    else response.writeHead(502, { "content-type": "text/plain; charset=utf-8" }).end("E2E server is starting.");
  });
  request.pipe(upstream);
}

function startE2EServer() {
  const child = spawn(process.execPath, [resolve(root, "node_modules/vinext/dist/cli.js"), "start"], {
    cwd: root,
    env: {
      ...process.env,
      HOST: "127.0.0.1",
      PORT: String(upstreamPort),
      WRANGLER_LOG_PATH: process.env.WRANGLER_LOG_PATH ?? ".wrangler/wrangler.log",
    },
    stdio: ["inherit", "pipe", "pipe"],
  });
  pipeServerOutput(child.stdout, process.stdout);
  pipeServerOutput(child.stderr, process.stderr);

  const proxy = createServer(async (request, response) => {
    try {
      const url = new URL(request.url ?? "/", `http://${request.headers.host ?? `localhost:${publicPort}`}`);
      if (await serveDuckDbAsset(request, response, url)) return;
      proxyToVinext(request, response);
    } catch (error) {
      response.writeHead(500, { "content-type": "text/plain; charset=utf-8" });
      response.end(error instanceof Error ? error.message : "E2E proxy failed.");
    }
  });
  proxy.listen(publicPort, "0.0.0.0");

  for (const signal of ["SIGINT", "SIGTERM"]) {
    process.on(signal, () => {
      proxy.close();
      child.kill(signal);
    });
  }
  child.on("exit", (code, signal) => {
    proxy.close();
    if (signal) process.kill(process.pid, signal);
    else process.exitCode = code ?? 1;
  });
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) startE2EServer();
