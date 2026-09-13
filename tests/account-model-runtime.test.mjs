import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import path from "node:path";
import { PassThrough } from "node:stream";
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
    child.stdin = {
      end(input) {
        calls.push({ executable, args, options, input: String(input ?? "") });
        const result = results.shift() ?? { code: 0, stdout: "" };
        queueMicrotask(() => {
          if (result.stdout) child.stdout.write(result.stdout);
          if (result.stderr) child.stderr.write(result.stderr);
          child.stdout.end();
          child.stderr.end();
          child.emit("close", result.code ?? 0, null);
        });
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

test("derives a stable private bridge token and publishes strict runtime bounds", () => {
  assert.match(accountRuntimeToken("a".repeat(64)), /^[a-f0-9]{64}$/u);
  assert.equal(accountRuntimeToken("a".repeat(64)), accountRuntimeToken("a".repeat(64)));
  assert.deepEqual(DESKTOP_ACCOUNT_RUNTIME_LIMITS, {
    generationTimeoutMs: 55_000,
    maximumOutputBytes: 2 * 1024 * 1024,
    maximumRequestBytes: 1_000_000,
    statusTimeoutMs: 4_000,
  });
});
