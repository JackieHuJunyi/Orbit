import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import {
  access as fsAccess,
  mkdir,
  mkdtemp,
  readFile as fsReadFile,
  rm,
  stat as fsStat,
  writeFile,
} from "node:fs/promises";
import path from "node:path";
import { PassThrough } from "node:stream";
import { tmpdir } from "node:os";
import test from "node:test";

import {
  accountRuntimeToken,
  createDesktopAccountModelRuntime,
  DESKTOP_ACCOUNT_RUNTIME_LIMITS,
} from "../desktop/account-model-runtime.mjs";
import { accountModelChoices, defaultAccountModel } from "../shared/account-model-catalog.mjs";

function processQueue(results, calls) {
  return (executable, args, options) => {
    const child = new EventEmitter();
    child.stdout = new PassThrough();
    child.stderr = new PassThrough();
    child.kill = () => undefined;
    let input = "";
    let started = false;
    const start = () => {
      if (started) return;
      started = true;
      calls.push({ executable, args, options, input });
      const result = results.shift() ?? { code: 0, stdout: "" };
      queueMicrotask(() => {
        if (result.stdout) child.stdout.write(result.stdout);
        if (result.stderr) child.stderr.write(result.stderr);
        child.stdout.end();
        child.stderr.end();
        child.emit("close", result.code ?? 0, null);
      });
    };
    child.stdin = {
      write(chunk) {
        input += String(chunk ?? "");
        start();
        return true;
      },
      end(chunk) {
        input += String(chunk ?? "");
        start();
      },
    };
    return child;
  };
}

function runtimeCapabilities(results, calls) {
  return {
    async access(filePath) {
      if (!["codex", "claude"].includes(path.basename(filePath))) throw new Error("missing");
    },
    async stat(filePath) {
      if (filePath.endsWith("result.json")) return { isFile: () => true, size: 15 };
      return { isFile: () => true, isSymbolicLink: () => false, size: 1 };
    },
    async mkdtemp() {
      return "/tmp/orbit-account-runtime-test";
    },
    async writeFile() {},
    async readFile(filePath) {
      if (filePath.endsWith("result.json")) return '{"ready":true}';
      throw new Error("unexpected read");
    },
    async rm() {},
    spawn: processQueue(results, calls),
  };
}

function codexRuntimeCapabilities(results, calls) {
  const capabilities = runtimeCapabilities(results, calls);
  return {
    ...capabilities,
    async access(filePath, mode) {
      if (!/codex/iu.test(path.basename(filePath))) throw new Error("missing");
      return capabilities.access(filePath, mode);
    },
  };
}

function readinessRequest(token, runtime) {
  return new Request(`http://127.0.0.1:54321/__orbit_account__/${runtime}/v1/responses`, {
    method: "POST",
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: JSON.stringify({
      model: defaultAccountModel(
        `${runtime === "codex" ? "codex" : runtime === "claude" ? "claude" : "gemini"}-account`,
      ),
      input: [
        { role: "system", content: "Return one readiness object." },
        { role: "user", content: "Confirm readiness." },
      ],
      text: {
        format: {
          type: "json_schema",
          name: "readiness",
          strict: true,
          schema: {
            type: "object",
            properties: { ready: { type: "boolean", const: true } },
            required: ["ready"],
            additionalProperties: false,
          },
        },
      },
    }),
  });
}

test("discovers account-owned sessions without returning credentials", async () => {
  const calls = [];
  const token = "a".repeat(64);
  const runtime = createDesktopAccountModelRuntime({
    accountToken: token,
    getOrigin: () => "http://127.0.0.1:54321",
    homeDirectory: "/Users/orbit",
    environment: {
      PATH: "/usr/local/bin",
      OPENAI_API_KEY: "api-key-must-not-reach-cli",
      ANTHROPIC_API_KEY: "anthropic-key-must-not-reach-cli",
      ORBIT_CREDENTIAL_ENCRYPTION_KEY: "orbit-master-key-must-not-reach-cli",
    },
    capabilities: runtimeCapabilities(
      [
        { code: 0, stderr: "Logged in using ChatGPT" },
        { code: 0, stdout: '{"loggedIn":true,"authMethod":"oauth_token"}' },
      ],
      calls,
    ),
  });
  const discovered = await runtime.discover();
  assert.deepEqual(
    discovered.accounts.map(({ id, status, installed }) => ({ id, status, installed })),
    [
      { id: "codex", status: "ready", installed: true },
      { id: "claude", status: "ready", installed: true },
      { id: "gemini", status: "not-installed", installed: false },
    ],
  );
  assert.equal(discovered.connections.length, 2);
  assert.doesNotMatch(JSON.stringify(discovered.accounts), /usr\/local|api-key|anthropic-key|"apiKey"/u);
  assert.equal(
    calls.every(
      (call) =>
        !call.options.env.OPENAI_API_KEY &&
        !call.options.env.ANTHROPIC_API_KEY &&
        !call.options.env.ORBIT_CREDENTIAL_ENCRYPTION_KEY,
    ),
    true,
  );
});

test(
  "executes an installed Windows npm account client through Node without a shell",
  { skip: process.platform !== "win32" },
  async () => {
    const home = await mkdtemp(path.join(tmpdir(), "orbit-account-shim-"));
    const bin = path.join(home, "npm");
    const packageDirectory = path.join(bin, "node_modules", "@openai", "codex", "bin");
    const script = path.join(packageDirectory, "codex.js");
    const shim = path.join(bin, "codex.cmd");
    await mkdir(packageDirectory, { recursive: true });
    await writeFile(script, "// test-only codex entrypoint\n");
    await writeFile(shim, '@ECHO off\n"%_prog%" "%dp0%\\node_modules\\@openai\\codex\\bin\\codex.js" %*\n');
    const calls = [];
    const runtime = createDesktopAccountModelRuntime({
      accountToken: "f".repeat(64),
      getOrigin: () => "http://127.0.0.1:54321",
      homeDirectory: home,
      environment: { PATH: bin },
      capabilities: {
        access: fsAccess,
        stat: fsStat,
        mkdtemp: async () => path.join(home, "request"),
        writeFile: async () => undefined,
        readFile: async (filePath) => {
          if (filePath.endsWith("result.json")) return '{"ready":true}';
          return fsReadFile(filePath, "utf8");
        },
        rm: async () => undefined,
        spawn: processQueue(
          [
            { code: 0, stderr: "Logged in using ChatGPT" },
            {
              code: 0,
              stdout: `${JSON.stringify({ result: { data: [{ model: "gpt-5.6-luna", isDefault: true }] } })}\n`,
            },
          ],
          calls,
        ),
      },
    });
    try {
      const discovered = await runtime.discover();
      assert.equal(discovered.accounts.find((account) => account.id === "codex")?.status, "ready");
      assert.equal(calls[0].executable, process.execPath);
      assert.deepEqual(calls[0].args, [script, "login", "status"]);
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  },
);

test(
  "prefers the native Codex binary from a Windows npm install when the launcher exposes one",
  { skip: process.platform !== "win32" },
  async () => {
    const home = await mkdtemp(path.join(tmpdir(), "orbit-account-native-"));
    const bin = path.join(home, "npm");
    const packageDirectory = path.join(bin, "node_modules", "@openai", "codex");
    const script = path.join(packageDirectory, "bin", "codex.js");
    const platformPackage = process.arch === "arm64" ? "codex-win32-arm64" : "codex-win32-x64";
    const targetTriple = process.arch === "arm64" ? "aarch64-pc-windows-msvc" : "x86_64-pc-windows-msvc";
    const native = path.join(
      packageDirectory,
      "node_modules",
      "@openai",
      platformPackage,
      "vendor",
      targetTriple,
      "bin",
      "codex.exe",
    );
    const shim = path.join(bin, "codex.cmd");
    await mkdir(path.dirname(script), { recursive: true });
    await mkdir(path.dirname(native), { recursive: true });
    await writeFile(script, "// test-only codex entrypoint\n");
    await writeFile(native, "test-only native binary\n");
    await writeFile(shim, '@ECHO off\n"%_prog%" "%dp0%\\node_modules\\@openai\\codex\\bin\\codex.js" %*\n');
    const calls = [];
    const runtime = createDesktopAccountModelRuntime({
      accountToken: "9".repeat(64),
      getOrigin: () => "http://127.0.0.1:54321",
      homeDirectory: home,
      environment: { PATH: bin },
      capabilities: {
        access: fsAccess,
        stat: fsStat,
        readFile: (filePath, encoding) => fsReadFile(filePath, encoding),
        spawn: processQueue(
          [
            { code: 0, stderr: "Logged in using ChatGPT" },
            {
              code: 0,
              stdout:
                '{"result":{"data":[{"model":"gpt-5.6-luna","isDefault":true,"supportedReasoningEfforts":[{"reasoningEffort":"low"}]}]}}\n',
            },
          ],
          calls,
        ),
      },
    });
    try {
      const discovered = await runtime.discover();
      assert.equal(discovered.accounts.find((account) => account.id === "codex")?.status, "ready");
      assert.equal(calls[0].executable, native);
      assert.deepEqual(calls[0].args, ["login", "status"]);
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  },
);

test("runs signed-in Codex with ephemeral structured output and model tools disabled", async () => {
  const calls = [];
  const token = "b".repeat(64);
  const runtime = createDesktopAccountModelRuntime({
    accountToken: token,
    getOrigin: () => "http://127.0.0.1:54321",
    homeDirectory: "/Users/orbit",
    environment: { PATH: "/usr/local/bin" },
    capabilities: runtimeCapabilities(
      [
        { code: 0, stderr: "Logged in using ChatGPT" },
        { code: 0, stdout: '{"loggedIn":true,"authMethod":"oauth_token"}' },
        { code: 0 },
      ],
      calls,
    ),
  });
  await runtime.discover();
  const request = readinessRequest(token, "codex");
  const response = await runtime.fetch(request, new URL(request.url));
  assert.equal(response.status, 200);
  const payload = await response.json();
  assert.equal(payload.output[0].content[0].text, '{"ready":true}');
  const invocation = calls.at(-1);
  assert.equal(invocation.args.includes("--ephemeral"), true);
  assert.equal(invocation.args.includes("--ignore-user-config"), true);
  assert.equal(invocation.args.includes("--output-schema"), true);
  assert.equal(invocation.args.includes("gpt-5.6-luna"), true);
  assert.equal(invocation.args.includes('model_reasoning_effort="low"'), true);
  assert.equal(invocation.args.includes("shell_tool"), true);
  assert.equal(invocation.args.includes("unified_exec"), true);
  assert.match(invocation.input, /Do not use tools, inspect files, or add commentary/u);
});

test("prefers proxy environment variables and normalizes them for Codex children", async () => {
  const calls = [];
  let systemResolutionCalls = 0;
  const token = "4".repeat(64);
  const runtime = createDesktopAccountModelRuntime({
    accountToken: token,
    getOrigin: () => "http://127.0.0.1:54321",
    homeDirectory: "/Users/orbit",
    environment: {
      PATH: "/usr/local/bin",
      HTTPS_PROXY: "env-proxy.example.test:8443",
      HTTP_PROXY: "",
    },
    resolveSystemProxy: async () => {
      systemResolutionCalls += 1;
      return "PROXY system-proxy.example.test:8080; DIRECT";
    },
    capabilities: codexRuntimeCapabilities(
      [
        { code: 0, stderr: "Logged in using ChatGPT" },
        { code: 0, stdout: '{"loggedIn":true,"authMethod":"oauth_token"}' },
        { code: 0 },
      ],
      calls,
    ),
  });
  await runtime.discover();
  const request = readinessRequest(token, "codex");
  const response = await runtime.fetch(request, new URL(request.url));
  assert.equal(response.status, 200);
  assert.equal(systemResolutionCalls, 0);
  const proxyEnvironment = calls.at(-1).options.env;
  assert.equal(proxyEnvironment.HTTPS_PROXY, "http://env-proxy.example.test:8443");
  assert.equal(proxyEnvironment.HTTP_PROXY, "http://env-proxy.example.test:8443");
});

test("uses the Electron-resolved system proxy for Codex children", async () => {
  const calls = [];
  const resolvedUrls = [];
  const token = "5".repeat(64);
  const runtime = createDesktopAccountModelRuntime({
    accountToken: token,
    getOrigin: () => "http://127.0.0.1:54321",
    homeDirectory: "/Users/orbit",
    environment: { PATH: "/usr/local/bin" },
    resolveSystemProxy: async (url) => {
      resolvedUrls.push(url);
      return "PROXY system-proxy.example.test:8080; DIRECT";
    },
    capabilities: codexRuntimeCapabilities(
      [
        { code: 0, stderr: "Logged in using ChatGPT" },
        { code: 0, stdout: '{"loggedIn":true,"authMethod":"oauth_token"}' },
        { code: 0 },
      ],
      calls,
    ),
  });
  await runtime.discover();
  const request = readinessRequest(token, "codex");
  const response = await runtime.fetch(request, new URL(request.url));
  assert.equal(response.status, 200);
  assert.deepEqual(resolvedUrls, ["https://chatgpt.com"]);
  const proxyEnvironment = calls.at(-1).options.env;
  assert.equal(proxyEnvironment.HTTPS_PROXY, "http://system-proxy.example.test:8080");
  assert.equal(proxyEnvironment.HTTP_PROXY, "http://system-proxy.example.test:8080");
});

test("selects the HTTPS entry from a multi-protocol system proxy resolution", async () => {
  const calls = [];
  const token = "8".repeat(64);
  const runtime = createDesktopAccountModelRuntime({
    accountToken: token,
    getOrigin: () => "http://127.0.0.1:54321",
    homeDirectory: "/Users/orbit",
    environment: { PATH: "/usr/local/bin" },
    resolveSystemProxy: async () => "http=http-proxy.example.test:8080;https=https-proxy.example.test:8443",
    capabilities: codexRuntimeCapabilities(
      [
        { code: 0, stderr: "Logged in using ChatGPT" },
        { code: 0, stdout: '{"loggedIn":true,"authMethod":"oauth_token"}' },
        { code: 0 },
      ],
      calls,
    ),
  });
  await runtime.discover();
  const request = readinessRequest(token, "codex");
  const response = await runtime.fetch(request, new URL(request.url));
  assert.equal(response.status, 200);
  const proxyEnvironment = calls.at(-1).options.env;
  assert.equal(proxyEnvironment.HTTPS_PROXY, "http://https-proxy.example.test:8443");
  assert.equal(proxyEnvironment.HTTP_PROXY, "http://https-proxy.example.test:8443");
});

test("falls back to direct Codex child connections when system proxy resolution is DIRECT", async () => {
  const calls = [];
  let systemResolutionCalls = 0;
  const token = "6".repeat(64);
  const runtime = createDesktopAccountModelRuntime({
    accountToken: token,
    getOrigin: () => "http://127.0.0.1:54321",
    homeDirectory: "/Users/orbit",
    environment: { PATH: "/usr/local/bin" },
    resolveSystemProxy: async () => {
      systemResolutionCalls += 1;
      return "DIRECT";
    },
    capabilities: codexRuntimeCapabilities(
      [
        { code: 0, stderr: "Logged in using ChatGPT" },
        { code: 0, stdout: '{"loggedIn":true,"authMethod":"oauth_token"}' },
        { code: 0 },
      ],
      calls,
    ),
  });
  await runtime.discover();
  const request = readinessRequest(token, "codex");
  const response = await runtime.fetch(request, new URL(request.url));
  assert.equal(response.status, 200);
  assert.equal(systemResolutionCalls, 1);
  const proxyEnvironment = calls.at(-1).options.env;
  assert.equal(proxyEnvironment.HTTPS_PROXY, undefined);
  assert.equal(proxyEnvironment.HTTP_PROXY, undefined);
  assert.equal(proxyEnvironment.ALL_PROXY, undefined);
});

test("runs Claude OAuth with no tools or session persistence and rejects foreign callers", async () => {
  const calls = [];
  const token = "c".repeat(64);
  const runtime = createDesktopAccountModelRuntime({
    accountToken: token,
    getOrigin: () => "http://127.0.0.1:54321",
    homeDirectory: "/Users/orbit",
    environment: { PATH: "/usr/local/bin" },
    capabilities: runtimeCapabilities(
      [
        { code: 0, stderr: "Logged in using ChatGPT" },
        { code: 0, stdout: '{"loggedIn":true,"authMethod":"oauth_token"}' },
        { code: 1 },
        {
          code: 0,
          stdout: '{"structured_output":{"ready":true},"usage":{"input_tokens":8,"output_tokens":3}}',
        },
      ],
      calls,
    ),
  });
  await runtime.discover();
  const unauthorized = readinessRequest("d".repeat(64), "claude");
  assert.equal((await runtime.fetch(unauthorized, new URL(unauthorized.url))).status, 401);
  const request = readinessRequest(token, "claude");
  const response = await runtime.fetch(request, new URL(request.url));
  assert.equal(response.status, 200);
  const invocation = calls.at(-1);
  assert.equal(invocation.args.includes("--safe-mode"), true);
  assert.equal(invocation.args.includes("--no-session-persistence"), true);
  assert.equal(invocation.args.includes("--model"), true);
  assert.equal(invocation.args.includes("fable"), true);
  assert.equal(invocation.args.includes("--effort"), true);
  assert.equal(invocation.args.includes("low"), true);
});

test("publishes bounded account model and effort choices instead of one symbolic model", async () => {
  assert.equal(accountModelChoices("codex-account").length, 10);
  assert.equal(accountModelChoices("claude-account").length, 7);
  assert.equal(accountModelChoices("gemini-account").length, 2);
  assert.equal(
    accountModelChoices("codex-account").some((choice) => choice.id === "gpt-5.6-luna@max"),
    true,
  );
  assert.equal(
    accountModelChoices("codex-account").some((choice) => choice.id === "gpt-5.6-sol@high"),
    true,
  );
});

test("reads the signed-in Codex model catalog and each model's supported reasoning efforts", async () => {
  const calls = [];
  const token = "e".repeat(64);
  const modelList = {
    id: 2,
    result: {
      data: [
        {
          id: "gpt-6-astra",
          model: "gpt-6-astra",
          displayName: "GPT-6-Astra",
          hidden: false,
          isDefault: true,
          defaultReasoningEffort: "medium",
          supportedReasoningEfforts: [
            { reasoningEffort: "low" },
            { reasoningEffort: "medium" },
            { reasoningEffort: "max" },
          ],
        },
        {
          id: "gpt-5.6-luna",
          model: "gpt-5.6-luna",
          displayName: "GPT-5.6-Luna",
          hidden: false,
          supportedReasoningEfforts: [{ reasoningEffort: "low" }],
        },
      ],
      nextCursor: null,
    },
  };
  const runtime = createDesktopAccountModelRuntime({
    accountToken: token,
    getOrigin: () => "http://127.0.0.1:54321",
    homeDirectory: "/Users/orbit",
    appVersion: "1.64.0",
    environment: { PATH: "/usr/local/bin" },
    capabilities: runtimeCapabilities(
      [
        { code: 0, stderr: "Logged in using ChatGPT" },
        { code: 0, stdout: '{"loggedIn":true,"authMethod":"oauth_token"}' },
        { code: 0, stdout: `${JSON.stringify(modelList)}\n` },
      ],
      calls,
    ),
  });
  const discovery = await runtime.discover();
  const request = new Request("http://127.0.0.1:54321/__orbit_account__/codex/v1/models", {
    headers: { authorization: `Bearer ${token}` },
  });
  const response = await runtime.fetch(request, new URL(request.url));
  assert.equal(response.status, 200);
  const payload = await response.json();
  assert.deepEqual(
    payload.data.map((model) => model.id),
    ["gpt-6-astra@low", "gpt-6-astra@medium", "gpt-6-astra@max", "gpt-5.6-luna@low"],
  );
  assert.equal(discovery.connections[0].model, "gpt-6-astra@medium");
  assert.deepEqual(
    discovery.connections[0].models,
    payload.data.map((model) => model.id),
  );
  const invocation = calls.at(-1);
  assert.deepEqual(invocation.args, ["app-server", "--listen", "stdio://"]);
  assert.match(invocation.input, /"method":"initialize"/u);
  assert.match(invocation.input, /"method":"model\/list"/u);
  assert.match(invocation.input, /"includeHidden":false/u);
});

test("derives a stable private bridge token and publishes strict runtime bounds", () => {
  assert.match(accountRuntimeToken("a".repeat(64)), /^[a-f0-9]{64}$/u);
  assert.equal(accountRuntimeToken("a".repeat(64)), accountRuntimeToken("a".repeat(64)));
  assert.deepEqual(DESKTOP_ACCOUNT_RUNTIME_LIMITS, {
    generationTimeoutMs: 55_000,
    modelCatalogTimeoutMs: 8_000,
    maximumOutputBytes: 2 * 1024 * 1024,
    maximumRequestBytes: 1_000_000,
    statusTimeoutMs: 4_000,
  });
});

test("retries transient Windows account workspace cleanup without masking a successful response", async () => {
  const calls = [];
  let cleanupAttempts = 0;
  const token = "7".repeat(64);
  const runtime = createDesktopAccountModelRuntime({
    accountToken: token,
    getOrigin: () => "http://127.0.0.1:54321",
    homeDirectory: "/Users/orbit",
    environment: { PATH: "/usr/local/bin" },
    capabilities: {
      ...runtimeCapabilities(
        [
          { code: 0, stderr: "Logged in using ChatGPT" },
          { code: 0, stdout: '{"loggedIn":true,"authMethod":"oauth_token"}' },
          {
            code: 0,
            stdout:
              '{"result":{"data":[{"model":"gpt-5.6-luna","isDefault":true,"supportedReasoningEfforts":[{"reasoningEffort":"low"}]}]}}\n',
          },
          { code: 0 },
        ],
        calls,
      ),
      rm: async () => {
        cleanupAttempts += 1;
        if (cleanupAttempts === 1) throw Object.assign(new Error("workspace is busy"), { code: "EBUSY" });
      },
    },
  });
  await runtime.discover();
  const request = readinessRequest(token, "codex");
  const response = await runtime.fetch(request, new URL(request.url));
  assert.equal(response.status, 200);
  assert.equal(cleanupAttempts, 2);
});
