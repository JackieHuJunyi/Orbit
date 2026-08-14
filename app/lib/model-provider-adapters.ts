import { zodTextFormat } from "openai/helpers/zod";
import type { z } from "zod";
import type { ActiveModelConnection } from "./model-credential-vault.ts";

const PROVIDER_RESPONSE_LIMIT = 2_000_000;
const MODEL_LIST_LIMIT = 1_000_000;
const MAX_OUTPUT_TOKENS = 8_000;
const ANTHROPIC_VERSION = "2023-06-01";

export type ProviderUsage = {
  inputTokens: number | null;
  outputTokens: number | null;
};

export type ProviderPlan = {
  output: unknown;
  usage: ProviderUsage;
};

function nonNegativeInteger(value: unknown) {
  return Number.isInteger(value) && Number(value) >= 0 ? Number(value) : null;
}

async function readBoundedJson(response: Response, maximumBytes: number, subject: string) {
  if (!response.body) throw new Error(`The provider returned an empty ${subject}.`);
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let received = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    received += value.byteLength;
    if (received > maximumBytes) {
      await reader.cancel();
      throw new Error(`The provider returned an unexpectedly large ${subject}.`);
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(received);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  try {
    return JSON.parse(new TextDecoder().decode(bytes)) as unknown;
  } catch {
    throw new Error(`The provider returned an invalid ${subject}.`);
  }
}

function providerError(payload: unknown, status: number) {
  void payload;
  return new Error(`The model provider rejected Rune's request (${status}).`);
}

async function providerJson(url: string, init: RequestInit, signal: AbortSignal) {
  const response = await fetch(url, { ...init, redirect: "error", signal });
  const declaredLength = Number(response.headers.get("content-length") ?? "0");
  if (declaredLength > PROVIDER_RESPONSE_LIMIT)
    throw new Error("The provider returned an unexpectedly large Agent response.");
  const payload = await readBoundedJson(response, PROVIDER_RESPONSE_LIMIT, "Agent response");
  if (!response.ok) throw providerError(payload, response.status);
  return payload;
}

function schemaFormat<T extends z.ZodType>(schema: T, name: string) {
  const format = zodTextFormat(schema, name);
  return { name: format.name, strict: true, schema: format.schema };
}

function geminiSchema(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(geminiSchema);
  if (!value || typeof value !== "object") return value;
  const source = value as Record<string, unknown>;
  const target: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(source)) {
    if (["$schema", "minLength", "maxLength", "pattern"].includes(key)) continue;
    if (key === "const") {
      target.enum = [geminiSchema(item)];
      continue;
    }
    target[key] = geminiSchema(item);
  }
  return target;
}

function parseJsonText(value: unknown) {
  if (typeof value !== "string" || !value.trim()) throw new Error("The model did not return a structured plan.");
  try {
    return JSON.parse(value) as unknown;
  } catch {
    throw new Error("The model returned invalid structured JSON.");
  }
}

function firstResponsesText(payload: unknown) {
  if (!payload || typeof payload !== "object" || !Array.isArray((payload as { output?: unknown }).output)) return "";
  for (const item of (payload as { output: unknown[] }).output) {
    if (!item || typeof item !== "object" || !Array.isArray((item as { content?: unknown }).content)) continue;
    for (const part of (item as { content: unknown[] }).content) {
      if (
        part &&
        typeof part === "object" &&
        (part as { type?: unknown }).type === "output_text" &&
        typeof (part as { text?: unknown }).text === "string"
      )
        return (part as { text: string }).text;
    }
  }
  return "";
}

export async function requestProviderPlan<T extends z.ZodType>({
  connection,
  instructions,
  input,
  schema,
  schemaName,
  responseDescription = "Return Rune's required structured plan for local validation.",
  signal,
}: {
  connection: ActiveModelConnection;
  instructions: string;
  input: string;
  schema: T;
  schemaName: string;
  responseDescription?: string;
  signal: AbortSignal;
}): Promise<ProviderPlan> {
  const format = schemaFormat(schema, schemaName);
  if (connection.protocol === "responses") {
    const payload = (await providerJson(
      `${connection.baseURL}/responses`,
      {
        method: "POST",
        headers: { authorization: `Bearer ${connection.apiKey}`, "content-type": "application/json" },
        body: JSON.stringify({
          model: connection.model,
          store: false,
          input: [
            { role: "system", content: instructions },
            { role: "user", content: input },
          ],
          text: { format: { type: "json_schema", ...format } },
          max_output_tokens: MAX_OUTPUT_TOKENS,
        }),
      },
      signal,
    )) as { output?: unknown; usage?: { input_tokens?: unknown; output_tokens?: unknown } };
    return {
      output: parseJsonText(firstResponsesText(payload)),
      usage: {
        inputTokens: nonNegativeInteger(payload.usage?.input_tokens),
        outputTokens: nonNegativeInteger(payload.usage?.output_tokens),
      },
    };
  }

  if (connection.protocol === "chat-completions") {
    const payload = (await providerJson(
      `${connection.baseURL}/chat/completions`,
      {
        method: "POST",
        headers: { authorization: `Bearer ${connection.apiKey}`, "content-type": "application/json" },
        body: JSON.stringify({
          model: connection.model,
          messages: [
            { role: "system", content: instructions },
            { role: "user", content: input },
          ],
          response_format: { type: "json_schema", json_schema: format },
          max_tokens: MAX_OUTPUT_TOKENS,
          store: false,
        }),
      },
      signal,
    )) as {
      choices?: Array<{ message?: { content?: unknown } }>;
      usage?: { prompt_tokens?: unknown; completion_tokens?: unknown };
    };
    return {
      output: parseJsonText(payload.choices?.[0]?.message?.content),
      usage: {
        inputTokens: nonNegativeInteger(payload.usage?.prompt_tokens),
        outputTokens: nonNegativeInteger(payload.usage?.completion_tokens),
      },
    };
  }

  if (connection.protocol === "anthropic-messages") {
    const toolName = "submit_rune_plan";
    const payload = (await providerJson(
      `${connection.baseURL}/messages`,
      {
        method: "POST",
        headers: {
          "x-api-key": connection.apiKey,
          "anthropic-version": ANTHROPIC_VERSION,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          model: connection.model,
          max_tokens: MAX_OUTPUT_TOKENS,
          system: instructions,
          messages: [{ role: "user", content: input }],
          tools: [{ name: toolName, description: responseDescription, input_schema: format.schema }],
          tool_choice: { type: "tool", name: toolName, disable_parallel_tool_use: true },
        }),
      },
      signal,
    )) as {
      content?: Array<{ type?: unknown; name?: unknown; input?: unknown }>;
      usage?: { input_tokens?: unknown; output_tokens?: unknown };
    };
    const tool = payload.content?.find((part) => part.type === "tool_use" && part.name === toolName);
    if (!tool) throw new Error("Anthropic did not return the required Rune plan tool input.");
    return {
      output: tool.input,
      usage: {
        inputTokens: nonNegativeInteger(payload.usage?.input_tokens),
        outputTokens: nonNegativeInteger(payload.usage?.output_tokens),
      },
    };
  }

  const modelName = encodeURIComponent(connection.model.replace(/^models\//u, ""));
  const payload = (await providerJson(
    `${connection.baseURL}/models/${modelName}:generateContent`,
    {
      method: "POST",
      headers: { "x-goog-api-key": connection.apiKey, "content-type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: instructions }] },
        contents: [{ role: "user", parts: [{ text: input }] }],
        generationConfig: {
          responseMimeType: "application/json",
          responseJsonSchema: geminiSchema(format.schema),
          maxOutputTokens: MAX_OUTPUT_TOKENS,
        },
      }),
    },
    signal,
  )) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: unknown }> } }>;
    usageMetadata?: { promptTokenCount?: unknown; candidatesTokenCount?: unknown };
  };
  const text = payload.candidates?.[0]?.content?.parts?.find((part) => typeof part.text === "string")?.text;
  return {
    output: parseJsonText(text),
    usage: {
      inputTokens: nonNegativeInteger(payload.usageMetadata?.promptTokenCount),
      outputTokens: nonNegativeInteger(payload.usageMetadata?.candidatesTokenCount),
    },
  };
}

function modelId(item: unknown, protocol: ActiveModelConnection["protocol"]) {
  if (!item || typeof item !== "object") return "";
  const raw =
    typeof (item as { id?: unknown }).id === "string"
      ? (item as { id: string }).id
      : protocol === "gemini-generate-content" && typeof (item as { name?: unknown }).name === "string"
        ? (item as { name: string }).name.replace(/^models\//u, "")
        : "";
  return raw.trim().slice(0, 120);
}

export async function listProviderModels(connection: ActiveModelConnection, signal: AbortSignal) {
  const url = `${connection.baseURL}/models`;
  const headers = new Headers({ accept: "application/json" });
  if (connection.protocol === "anthropic-messages") {
    headers.set("x-api-key", connection.apiKey);
    headers.set("anthropic-version", ANTHROPIC_VERSION);
  } else if (connection.protocol === "gemini-generate-content") {
    headers.set("x-goog-api-key", connection.apiKey);
  } else {
    headers.set("authorization", `Bearer ${connection.apiKey}`);
  }
  const response = await fetch(url, { headers, redirect: "error", signal });
  const declaredLength = Number(response.headers.get("content-length") ?? "0");
  if (declaredLength > MODEL_LIST_LIMIT) throw new Error("The provider returned an unexpectedly large model list.");
  const payload = (await readBoundedJson(response, MODEL_LIST_LIMIT, "model-list response")) as {
    data?: unknown;
    models?: unknown;
  };
  if (!response.ok) throw providerError(payload, response.status);
  const items = Array.isArray(payload.data) ? payload.data : Array.isArray(payload.models) ? payload.models : [];
  const models = items
    .flatMap((item) => {
      if (
        connection.protocol === "gemini-generate-content" &&
        item &&
        typeof item === "object" &&
        Array.isArray((item as { supportedGenerationMethods?: unknown }).supportedGenerationMethods) &&
        !(item as { supportedGenerationMethods: unknown[] }).supportedGenerationMethods.includes("generateContent")
      )
        return [];
      const id = modelId(item, connection.protocol);
      return id ? [id] : [];
    })
    .filter((id, index, all) => all.indexOf(id) === index)
    .sort()
    .slice(0, 80);
  if (!models.length) throw new Error("The provider returned no usable model IDs.");
  return models;
}
