import assert from "node:assert/strict";
import test from "node:test";

import { DEFAULT_MODEL_TOKEN_BUDGET, modelCapabilityManifest } from "../app/lib/model-profiles.ts";
import {
  MODEL_HEALTH_COOLDOWN_MS,
  executeModelRoute,
  modelConnectionHealth,
  recordModelConnectionHealth,
  resetModelConnectionHealthForTests,
} from "../app/lib/model-routing.ts";

function connection(id) {
  return {
    source: "personal",
    profileId: id,
    profileName: id,
    provider: "custom",
    protocol: "responses",
    apiKey: `secret-${id}`,
    baseURL: `https://${id}.example.com/v1`,
    model: "model-1",
    budget: { ...DEFAULT_MODEL_TOKEN_BUDGET },
    capabilities: modelCapabilityManifest("responses"),
  };
}

test.beforeEach(() => resetModelConnectionHealthForTests());

test("does not contact a fallback unless failover is explicitly enabled", async () => {
  const calls = [];
  await assert.rejects(
    () =>
      executeModelRoute({
        connections: [connection("primary"), connection("fallback")],
        failoverEnabled: false,
        signal: new AbortController().signal,
        run: async (candidate) => {
          calls.push(candidate.profileId);
          throw new Error("primary unavailable");
        },
      }),
    /primary unavailable/,
  );
  assert.deepEqual(calls, ["primary"]);
  assert.equal(modelConnectionHealth(connection("primary")).status, "unhealthy");
  assert.equal(modelConnectionHealth(connection("fallback")).status, "unknown");
});

test("uses configured order after explicit failover and records provider health", async () => {
  const calls = [];
  const routed = await executeModelRoute({
    connections: [connection("primary"), connection("fallback")],
    failoverEnabled: true,
    signal: new AbortController().signal,
    run: async (candidate) => {
      calls.push(candidate.profileId);
      if (candidate.profileId === "primary") throw new Error("primary unavailable");
      return "accepted";
    },
  });
  assert.equal(routed.result, "accepted");
  assert.equal(routed.connection.profileId, "fallback");
  assert.equal(routed.attempts, 2);
  assert.equal(routed.failoverUsed, true);
  assert.deepEqual(calls, ["primary", "fallback"]);
  assert.equal(modelConnectionHealth(connection("primary")).status, "unhealthy");
  assert.equal(modelConnectionHealth(connection("fallback")).status, "healthy");
});

test("skips a recently unhealthy primary when an authorized fallback exists", async () => {
  recordModelConnectionHealth(connection("primary"), "unhealthy");
  const calls = [];
  const routed = await executeModelRoute({
    connections: [connection("primary"), connection("fallback")],
    failoverEnabled: true,
    signal: new AbortController().signal,
    run: async (candidate) => {
      calls.push(candidate.profileId);
      return "accepted";
    },
  });
  assert.deepEqual(calls, ["fallback"]);
  assert.equal(routed.failoverUsed, true);
  assert.equal(routed.attempts, 1);
});

test("returns an unhealthy connection to unknown after its bounded cooldown", () => {
  const failedAt = Date.parse("2026-08-19T00:00:00.000Z");
  recordModelConnectionHealth(connection("primary"), "unhealthy", failedAt);
  const duringCooldown = modelConnectionHealth(connection("primary"), failedAt + MODEL_HEALTH_COOLDOWN_MS - 1);
  assert.equal(duringCooldown.status, "unhealthy");
  assert.equal(duringCooldown.retryAt, new Date(failedAt + MODEL_HEALTH_COOLDOWN_MS).toISOString());
  assert.equal(modelConnectionHealth(connection("primary"), failedAt + MODEL_HEALTH_COOLDOWN_MS).status, "unknown");
});

test("a profile budget rejection can route when authorized without marking provider health", async () => {
  const budgetError = new Error("above budget");
  budgetError.name = "ModelBudgetError";
  const routed = await executeModelRoute({
    connections: [connection("primary"), connection("fallback")],
    failoverEnabled: true,
    signal: new AbortController().signal,
    run: async (candidate) => {
      if (candidate.profileId === "primary") throw budgetError;
      return "accepted";
    },
  });
  assert.equal(routed.connection.profileId, "fallback");
  assert.equal(modelConnectionHealth(connection("primary")).status, "unknown");
  assert.equal(modelConnectionHealth(connection("fallback")).status, "healthy");
});

test("an aborted request never proceeds to another provider", async () => {
  const controller = new AbortController();
  const calls = [];
  await assert.rejects(
    () =>
      executeModelRoute({
        connections: [connection("primary"), connection("fallback")],
        failoverEnabled: true,
        signal: controller.signal,
        run: async (candidate) => {
          calls.push(candidate.profileId);
          controller.abort();
          throw new DOMException("aborted", "AbortError");
        },
      }),
    (error) => error instanceof DOMException && error.name === "AbortError",
  );
  assert.deepEqual(calls, ["primary"]);
  assert.equal(modelConnectionHealth(connection("primary")).status, "unknown");
  assert.equal(modelConnectionHealth(connection("fallback")).status, "unknown");
});
