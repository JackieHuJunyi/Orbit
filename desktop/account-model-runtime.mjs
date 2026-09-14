import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { constants } from "node:fs";
import { access, mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  accountModelChoices,
  createAccountModelChoice,
  defaultAccountModel,
} from "../shared/account-model-catalog.mjs";

const MAX_PROCESS_OUTPUT_BYTES = 2 * 1024 * 1024;
const MAX_REQUEST_BYTES = 1_000_000;
const STATUS_TIMEOUT_MS = 4_000;
const MODEL_CATALOG_TIMEOUT_MS = 8_000;
const GENERATION_TIMEOUT_MS = 55_000;
const MODEL_CATALOG_CACHE_MS = 30_000;
const MAX_CODEX_MODEL_PAGES = 4;
const MAX_CODEX_MODEL_CHOICES = 800;

const ACCOUNT_RUNTIMES = Object.freeze([
  {
    id: "codex",
    provider: "codex-account",
    label: "ChatGPT",
    sourceLabel: "Codex · ChatGPT account",
    executable: "codex",
    model: defaultAccountModel("codex-account"),
  },
  {
    id: "claude",
    provider: "claude-account",
    label: "Claude",
    sourceLabel: "Claude Code · Claude account",
    executable: "claude",
    model: defaultAccountModel("claude-account"),
  },
  {
    id: "gemini",
    provider: "gemini-account",
    label: "Gemini",
    sourceLabel: "Gemini CLI · Google account",
    executable: "gemini",
    model: defaultAccountModel("gemini-account"),
  },
]);

function accountOnlyEnvironment(environment) {
  const safe = { ...environment };
  for (const key of [
    "OPENAI_API_KEY",
    "OPENAI_ADMIN_KEY",
    "CODEX_ACCESS_TOKEN",
    "ANTHROPIC_API_KEY",
    "ANTHROPIC_AUTH_TOKEN",
    "CLAUDE_CODE_OAUTH_TOKEN",
    "GEMINI_API_KEY",
    "GOOGLE_API_KEY",
    "GOOGLE_APPLICATION_CREDENTIALS",
    "VERTEX_AI_API_KEY",
    "AWS_ACCESS_KEY_ID",
    "AWS_SECRET_ACCESS_KEY",
    "AWS_SESSION_TOKEN",
    "ORBIT_CREDENTIAL_ENCRYPTION_KEY",
    "ORBIT_MAC_SIGN_IDENTITY",
    "ORBIT_MAC_KEYCHAIN",
    "ORBIT_NOTARY_KEYCHAIN_PROFILE",
    "APPLE_APP_SPECIFIC_PASSWORD",
  ]) {
    delete safe[key];
  }
  safe.NO_COLOR = "1";
  return safe;
}

function cleanText(value, maximum) {
  if (typeof value !== "string") return "";
  const text = value.trim();
  return text && text.length <= maximum && !/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u.test(text) ? text : "";
}

async function findExecutable(name, homeDirectory, environment, capabilities) {
  const candidates = [
    ...(environment.PATH ?? "")
      .split(path.delimiter)
      .filter(Boolean)
      .map((directory) => path.join(directory, name)),
    path.join(homeDirectory, ".local", "bin", name),
    path.join(homeDirectory, ".npm-global", "bin", name),
    path.join("/opt/homebrew/bin", name),
    path.join("/usr/local/bin", name),
  ];
  for (const candidate of [...new Set(candidates)]) {
    try {
      await capabilities.access(candidate, constants.X_OK);
      const metadata = await capabilities.stat(candidate);
      if (metadata.isFile() || metadata.isSymbolicLink()) return candidate;
    } catch {
      // Missing and non-executable candidates are ordinary discovery results.
    }
  }
  return "";
}

function runBoundedProcess(executable, args, { cwd, environment, input = "", signal, timeoutMs }, capabilities) {
  return new Promise((resolve, reject) => {
    const child = capabilities.spawn(executable, args, {
      cwd,
      env: accountOnlyEnvironment(environment),
      shell: false,
      stdio: ["pipe", "pipe", "pipe"],
    });
    let stdout = Buffer.alloc(0);
    let stderr = Buffer.alloc(0);
    let settled = false;
    const abort = () => {
      child.kill("SIGKILL");
      finish(() => reject(new Error("The signed-in model request was stopped.")));
    };
    const finish = (callback) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      signal?.removeEventListener("abort", abort);
      callback();
    };
    const append = (current, chunk) => {
      const next = Buffer.concat([current, Buffer.from(chunk)]);
      if (next.length > MAX_PROCESS_OUTPUT_BYTES) {
        child.kill("SIGKILL");
        finish(() => reject(new Error("The signed-in model client returned too much output.")));
      }
      return next;
    };
    child.stdout.on("data", (chunk) => {
      stdout = append(stdout, chunk);
    });
    child.stderr.on("data", (chunk) => {
      stderr = append(stderr, chunk);
    });
    child.once("error", (error) => finish(() => reject(error)));
    child.once("close", (code, signal) =>
      finish(() =>
        resolve({
          code: Number.isInteger(code) ? code : -1,
          signal: typeof signal === "string" ? signal : null,
          stdout: stdout.toString("utf8"),
          stderr: stderr.toString("utf8"),
        }),
      ),
    );
    const timeout = setTimeout(() => {
      child.kill("SIGKILL");
      finish(() => reject(new Error("The signed-in model client timed out.")));
    }, timeoutMs);
    if (signal?.aborted) {
      abort();
      return;
    }
    signal?.addEventListener("abort", abort, { once: true });
    child.stdin.end(input);
  });
}

function runBoundedJsonRpcProcess(executable, args, messages, responseId, context) {
  return new Promise((resolve, reject) => {
    const child = context.capabilities.spawn(executable, args, {
      cwd: context.cwd,
      env: accountOnlyEnvironment(context.environment),
      shell: false,
      stdio: ["pipe", "pipe", "pipe"],
    });
    let receivedBytes = 0;
    let pending = "";
    let response = null;
    let stderr = Buffer.alloc(0);
    let settled = false;
    const finish = (callback) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      callback();
    };
    const stopWith = (error) => {
      child.kill("SIGKILL");
      finish(() => reject(error));
    };
    child.stdout.setEncoding?.("utf8");
    child.stdout.on("data", (chunk) => {
      const text = String(chunk);
      receivedBytes += Buffer.byteLength(text);
      if (receivedBytes > MAX_PROCESS_OUTPUT_BYTES) {
        stopWith(new Error("The signed-in model client returned too much output."));
        return;
      }
      pending += text;
      while (pending.includes("\n")) {
        const newline = pending.indexOf("\n");
        const line = pending.slice(0, newline).trim();
        pending = pending.slice(newline + 1);
        if (!line) continue;
        try {
          const message = JSON.parse(line);
          if (message?.id === responseId && !response) {
            response = message;
            child.stdin.end();
          }
        } catch {
          // App-server notifications that are not valid JSON cannot satisfy
          // the requested response and remain bounded by the output limit.
        }
      }
    });
    child.stderr.on("data", (chunk) => {
      stderr = Buffer.concat([stderr, Buffer.from(chunk)]);
      if (stderr.length > MAX_PROCESS_OUTPUT_BYTES) stopWith(new Error("The signed-in model client failed."));
    });
    child.once("error", (error) => finish(() => reject(error)));
    child.once("close", (code) => {
      if (response) {
        finish(() => resolve(response));
        return;
      }
      const detail = cleanText(stderr.toString("utf8"), 300);
      finish(() =>
        reject(
          new Error(
            detail ||
              (code === 0
                ? "The signed-in model client closed before answering."
                : "The signed-in model client failed."),
          ),
        ),
      );
    });
    const timeout = setTimeout(
      () => stopWith(new Error("The signed-in model client timed out.")),
      MODEL_CATALOG_TIMEOUT_MS,
    );
    child.stdin.write(`${messages.map((message) => JSON.stringify(message)).join("\n")}\n`);
  });
}

async function accountStatus(runtime, executable, context) {
  if (!executable) return "not-installed";
  try {
    if (runtime.id === "codex") {
      const result = await runBoundedProcess(
        executable,
        ["login", "status"],
        { ...context, timeoutMs: STATUS_TIMEOUT_MS },
        context.capabilities,
      );
      return result.code === 0 && /Logged in using ChatGPT/iu.test(`${result.stdout}\n${result.stderr}`)
        ? "ready"
        : "sign-in-required";
    }
    if (runtime.id === "claude") {
      const result = await runBoundedProcess(
        executable,
        ["auth", "status"],
        { ...context, timeoutMs: STATUS_TIMEOUT_MS },
        context.capabilities,
      );
      const parsed = JSON.parse(result.stdout);
      return result.code === 0 && parsed?.loggedIn === true && parsed?.authMethod === "oauth_token"
        ? "ready"
        : "sign-in-required";
    }
    // Gemini CLI has no stable read-only auth-status command. An installed
    // client is verified by the same bounded, tool-free readiness call used
    // before Orbit saves it.
    return "verify-required";
  } catch {
    return "sign-in-required";
  }
}

function codexModelChoices(payload) {
  const models = Array.isArray(payload?.data) ? payload.data : [];
  const choices = models.flatMap((entry) => {
    if (!entry || typeof entry !== "object" || entry.hidden === true) return [];
    const model = cleanText(entry.model || entry.id, 110);
    const displayName = cleanText(entry.displayName, 100);
    if (!model) return [];
    const efforts = Array.isArray(entry.supportedReasoningEfforts)
      ? entry.supportedReasoningEfforts
          .map((item) => cleanText(item?.reasoningEffort, 16))
          .filter((effort, index, all) => effort && all.indexOf(effort) === index)
      : [];
    const resolvedEfforts = efforts.length ? efforts : [null];
    return resolvedEfforts.flatMap((effort) => {
      const choice = createAccountModelChoice(model, effort, displayName);
      if (!choice) return [];
      return [
        Object.freeze({
          ...choice,
          isDefault:
            entry.isDefault === true &&
            (cleanText(entry.defaultReasoningEffort, 16) ? effort === entry.defaultReasoningEffort : effort === null),
        }),
      ];
    });
  });
  return choices
    .filter((choice, index, all) => all.findIndex((item) => item.id === choice.id) === index)
    .slice(0, MAX_CODEX_MODEL_CHOICES);
}

async function readCodexModelPage(executable, context, appVersion, cursor) {
  const messages = [
    {
      method: "initialize",
      id: 1,
      params: { clientInfo: { name: "orbit_desktop", title: "Orbit", version: appVersion } },
    },
    { method: "initialized", params: {} },
    {
      method: "model/list",
      id: 2,
      params: { limit: 100, includeHidden: false, ...(cursor ? { cursor } : {}) },
    },
  ];
  const response = await runBoundedJsonRpcProcess(
    executable,
    ["app-server", "--listen", "stdio://"],
    messages,
    2,
    context,
  );
  if (response.error) throw new Error("Codex returned an invalid signed-in model catalog.");
  return response.result;
}

async function readCodexModelChoices(executable, context, appVersion) {
  const data = [];
  const seenCursors = new Set();
  let cursor = "";
  for (let pageIndex = 0; pageIndex < MAX_CODEX_MODEL_PAGES; pageIndex += 1) {
    const page = await readCodexModelPage(executable, context, appVersion, cursor);
    if (Array.isArray(page?.data)) data.push(...page.data);
    const nextCursor = cleanText(page?.nextCursor, 240);
    if (!nextCursor || seenCursors.has(nextCursor)) break;
    seenCursors.add(nextCursor);
    cursor = nextCursor;
  }
  const choices = codexModelChoices({ data });
  if (!choices.length) throw new Error("Codex returned no visible models for this account.");
  return choices;
}

function combinedPrompt(body) {
  const messages = Array.isArray(body?.input) ? body.input : [];
  const sections = messages.flatMap((message) => {
    if (!message || typeof message !== "object") return [];
    const role = message.role === "system" ? "SYSTEM" : "USER";
    const content = cleanText(message.content, 400_000);
    return content ? [`${role}\n${content}`] : [];
  });
  return `${sections.join("\n\n")}\n\nReturn only the JSON value required by the supplied schema. Do not use tools, inspect files, or add commentary.`;
}

function responseSchema(body) {
  const schema = body?.text?.format?.schema;
  if (!schema || typeof schema !== "object" || Array.isArray(schema)) {
    throw new Error("Orbit did not provide a structured response schema.");
  }
  const encoded = JSON.stringify(schema);
  if (encoded.length > 200_000) throw new Error("Orbit's structured response schema is too large.");
  return { schema, encoded };
}

function parseJsonValue(value) {
  if (value && typeof value === "object") return value;
  const text = cleanText(value, MAX_PROCESS_OUTPUT_BYTES);
  if (!text) throw new Error("The signed-in model client returned no structured result.");
  try {
    return JSON.parse(text);
  } catch {
    const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/iu)?.[1];
    if (!fenced) throw new Error("The signed-in model client returned invalid JSON.");
    return JSON.parse(fenced);
  }
}

async function runCodex(runtime, executable, prompt, schema, selection, context) {
  const directory = await context.capabilities.mkdtemp(path.join(context.tmpDirectory, "orbit-codex-account-"));
  try {
    const schemaPath = path.join(directory, "schema.json");
    const outputPath = path.join(directory, "result.json");
    await context.capabilities.writeFile(schemaPath, `${schema.encoded}\n`, { mode: 0o600 });
    const args = [
      "exec",
      "--ignore-user-config",
      "--ignore-rules",
      "--ephemeral",
      "--skip-git-repo-check",
      "--sandbox",
      "read-only",
      "--color",
      "never",
      "--model",
      selection.model,
      ...(selection.effort ? ["--config", `model_reasoning_effort="${selection.effort}"`] : []),
      "--disable",
      "shell_tool",
      "--disable",
      "unified_exec",
      "--disable",
      "browser_use",
      "--disable",
      "computer_use",
      "--disable",
      "apps",
      "--disable",
      "hooks",
      "--output-schema",
      schemaPath,
      "--output-last-message",
      outputPath,
      "-C",
      directory,
      "-",
    ];
    const result = await runBoundedProcess(
      executable,
      args,
      { ...context, cwd: directory, input: prompt, timeoutMs: GENERATION_TIMEOUT_MS },
      context.capabilities,
    );
    if (result.code !== 0) throw new Error("Codex could not use the signed-in ChatGPT account.");
    const metadata = await context.capabilities.stat(outputPath);
    if (!metadata.isFile() || metadata.size <= 0 || metadata.size > MAX_PROCESS_OUTPUT_BYTES) {
      throw new Error("Codex returned an invalid structured result.");
    }
    return { output: parseJsonValue(await context.capabilities.readFile(outputPath, "utf8")), usage: null };
  } finally {
    await context.capabilities.rm(directory, { recursive: true, force: true });
  }
}

async function runClaude(runtime, executable, prompt, schema, selection, context) {
  const result = await runBoundedProcess(
    executable,
    [
      "--safe-mode",
      "--model",
      selection.model,
      "--effort",
      selection.effort,
      "--tools",
      "",
      "--no-session-persistence",
      "--permission-mode",
      "dontAsk",
      "--output-format",
      "json",
      "--json-schema",
      schema.encoded,
      "--print",
      prompt,
    ],
    { ...context, timeoutMs: GENERATION_TIMEOUT_MS },
    context.capabilities,
  );
  if (result.code !== 0) throw new Error("Claude Code could not use the signed-in Claude account.");
  const payload = parseJsonValue(result.stdout);
  const output = payload.structured_output ?? parseJsonValue(payload.result);
  const usage = payload.usage && typeof payload.usage === "object" ? payload.usage : null;
  return { output, usage };
}

async function runGemini(runtime, executable, prompt, schema, selection, context) {
  const schemaInstruction = `JSON schema:\n${schema.encoded}\n\n${prompt}`;
  const result = await runBoundedProcess(
    executable,
    ["--approval-mode", "plan", "--model", selection.model, "--output-format", "json", "--prompt", schemaInstruction],
    { ...context, timeoutMs: GENERATION_TIMEOUT_MS },
    context.capabilities,
  );
  if (result.code !== 0) throw new Error("Gemini CLI could not use the signed-in Google account.");
  const payload = parseJsonValue(result.stdout);
  return { output: parseJsonValue(payload.response), usage: payload.stats ?? null };
}

function usageValue(value) {
  return Number.isInteger(value) && value >= 0 ? value : undefined;
}

function responsesPayload(result) {
  const inputTokens = usageValue(result.usage?.input_tokens ?? result.usage?.inputTokens);
  const outputTokens = usageValue(result.usage?.output_tokens ?? result.usage?.outputTokens);
  return {
    output: [
      {
        type: "message",
        role: "assistant",
        content: [{ type: "output_text", text: JSON.stringify(result.output) }],
      },
    ],
    usage: {
      ...(inputTokens === undefined ? {} : { input_tokens: inputTokens }),
      ...(outputTokens === undefined ? {} : { output_tokens: outputTokens }),
    },
  };
}

async function boundedRequestJson(request) {
  const declared = Number(request.headers.get("content-length") ?? "0");
  if (declared > MAX_REQUEST_BYTES) throw new Error("The account-model request is too large.");
  const text = await request.text();
  if (new TextEncoder().encode(text).byteLength > MAX_REQUEST_BYTES) {
    throw new Error("The account-model request is too large.");
  }
  return JSON.parse(text);
}

export function createDesktopAccountModelRuntime({
  accountToken,
  getOrigin,
  homeDirectory,
  appVersion = "1",
  environment = process.env,
  capabilities: overrides = {},
} = {}) {
  if (!/^[a-f0-9]{64}$/u.test(accountToken ?? "")) throw new Error("Account runtime requires one private token.");
  const capabilities = { access, mkdtemp, readFile, rm, spawn, stat, writeFile, ...overrides };
  const home = homeDirectory || environment.HOME || "";
  const context = {
    capabilities,
    cwd: home || process.cwd(),
    environment,
    tmpDirectory: tmpdir(),
  };
  let latest = [];
  const modelCatalogCache = new Map();

  async function runtimeModelChoices(runtime, executable) {
    if (runtime.provider !== "codex-account") return accountModelChoices(runtime.provider);
    const cached = modelCatalogCache.get(runtime.id);
    if (cached && Date.now() - cached.readAt < MODEL_CATALOG_CACHE_MS) return cached.choices;
    try {
      const choices = await readCodexModelChoices(executable, context, cleanText(appVersion, 32) || "1");
      modelCatalogCache.set(runtime.id, { choices, readAt: Date.now(), source: "codex-app-server" });
      return choices;
    } catch {
      const choices = accountModelChoices(runtime.provider);
      modelCatalogCache.set(runtime.id, { choices, readAt: Date.now(), source: "fallback" });
      return choices;
    }
  }

  async function discover() {
    modelCatalogCache.clear();
    const discoveredAccounts = await Promise.all(
      ACCOUNT_RUNTIMES.map(async (runtime) => {
        const executable = await findExecutable(runtime.executable, home, environment, capabilities);
        const status = await accountStatus(runtime, executable, context);
        return Object.freeze({ ...runtime, executable, status });
      }),
    );
    const accounts = await Promise.all(
      discoveredAccounts.map(async (account) => {
        if (account.provider !== "codex-account" || account.status !== "ready" || !account.executable) return account;
        const modelChoices = await runtimeModelChoices(account, account.executable);
        const model = modelChoices.find((choice) => choice.isDefault)?.id ?? modelChoices[0]?.id ?? account.model;
        return Object.freeze({ ...account, model, modelChoices });
      }),
    );
    latest = accounts;
    const origin = getOrigin?.();
    const connections = origin
      ? accounts
          .filter((account) => account.status === "ready" || account.status === "verify-required")
          .map((account) => ({
            sourceKind: "account-runtime",
            sourceLabel: account.sourceLabel,
            sourceIdentity: `account:${account.id}`,
            provider: account.provider,
            name: account.sourceLabel,
            baseURL: `${origin}/__orbit_account__/${account.id}/v1`,
            model: account.model,
            models: account.modelChoices?.map((choice) => choice.id) ?? [],
            apiKey: accountToken,
            protocol: "responses",
            locality: "device",
            credentialState: "account-session",
          }))
      : [];
    return {
      accounts: accounts.map(({ id, provider, label, sourceLabel, model, status, executable }) => ({
        id,
        provider,
        label,
        sourceLabel,
        model,
        status,
        installed: Boolean(executable),
      })),
      connections,
    };
  }

  async function fetchAccountRequest(request, url) {
    const match = url.pathname.match(/^\/__orbit_account__\/(codex|claude|gemini)\/v1\/(models|responses)$/u);
    if (!match) return null;
    const supplied = request.headers.get("authorization")?.replace(/^Bearer\s+/iu, "") ?? "";
    if (supplied !== accountToken) return Response.json({ error: "Unauthorized account runtime." }, { status: 401 });
    const runtime = ACCOUNT_RUNTIMES.find((item) => item.id === match[1]);
    if (!runtime) return Response.json({ error: "Unknown account runtime." }, { status: 404 });
    if (!latest.length) await discover();
    const current = latest.find((item) => item.id === runtime.id);
    const executable = latest.find((item) => item.id === runtime.id)?.executable ?? "";
    if (!current || !executable) {
      return Response.json({ error: `${runtime.label} client is not installed.` }, { status: 503 });
    }
    if (current.status === "sign-in-required") {
      return Response.json({ error: `Sign in through ${runtime.sourceLabel} first.` }, { status: 401 });
    }
    if (match[2] === "models") {
      const choices = await runtimeModelChoices(runtime, executable);
      return Response.json({
        object: "list",
        data: choices.map((choice) => ({ id: choice.id, object: "model" })),
      });
    }
    try {
      const body = await boundedRequestJson(request);
      const prompt = combinedPrompt(body);
      const schema = responseSchema(body);
      const choices = await runtimeModelChoices(runtime, executable);
      const selection = choices.find((choice) => choice.id === cleanText(body?.model, 120));
      if (!selection) {
        return Response.json({ error: "Choose a supported model and effort level for this account." }, { status: 400 });
      }
      const requestContext = { ...context, signal: request.signal };
      const result =
        runtime.id === "codex"
          ? await runCodex(runtime, executable, prompt, schema, selection, requestContext)
          : runtime.id === "claude"
            ? await runClaude(runtime, executable, prompt, schema, selection, requestContext)
            : await runGemini(runtime, executable, prompt, schema, selection, requestContext);
      return Response.json(responsesPayload(result), { headers: { "cache-control": "no-store" } });
    } catch (error) {
      return Response.json(
        { error: error instanceof Error ? error.message : "The signed-in account runtime failed." },
        { status: 502, headers: { "cache-control": "no-store" } },
      );
    }
  }

  return Object.freeze({ discover, fetch: fetchAccountRequest });
}

export function accountRuntimeToken(masterKey) {
  return createHash("sha256").update(`orbit-account-runtime\0${masterKey}`).digest("hex");
}

export const DESKTOP_ACCOUNT_RUNTIME_LIMITS = Object.freeze({
  generationTimeoutMs: GENERATION_TIMEOUT_MS,
  modelCatalogTimeoutMs: MODEL_CATALOG_TIMEOUT_MS,
  maximumOutputBytes: MAX_PROCESS_OUTPUT_BYTES,
  maximumRequestBytes: MAX_REQUEST_BYTES,
  statusTimeoutMs: STATUS_TIMEOUT_MS,
});
