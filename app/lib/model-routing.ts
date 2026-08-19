import type { ActiveModelConnection } from "./model-credential-vault.ts";
import type { ModelConnectionHealth } from "./model-profiles.ts";

export const MODEL_HEALTH_COOLDOWN_MS = 60_000;

type MutableHealth = {
  status: "healthy" | "unhealthy";
  checkedAt: number;
  retryAt: number | null;
};

const healthRegistry = new Map<string, MutableHealth>();

function connectionKey(connection: ActiveModelConnection) {
  return JSON.stringify([
    connection.source,
    connection.profileId,
    connection.provider,
    connection.protocol,
    connection.baseURL,
    connection.model,
  ]);
}

export function modelConnectionHealth(connection: ActiveModelConnection, now = Date.now()): ModelConnectionHealth {
  const health = healthRegistry.get(connectionKey(connection));
  if (!health) return { status: "unknown", checkedAt: null, retryAt: null };
  if (health.status === "unhealthy" && health.retryAt != null && health.retryAt <= now) {
    healthRegistry.delete(connectionKey(connection));
    return { status: "unknown", checkedAt: null, retryAt: null };
  }
  return {
    status: health.status,
    checkedAt: new Date(health.checkedAt).toISOString(),
    retryAt: health.retryAt == null ? null : new Date(health.retryAt).toISOString(),
  };
}

export function recordModelConnectionHealth(
  connection: ActiveModelConnection,
  status: "healthy" | "unhealthy",
  now = Date.now(),
) {
  healthRegistry.set(connectionKey(connection), {
    status,
    checkedAt: now,
    retryAt: status === "unhealthy" ? now + MODEL_HEALTH_COOLDOWN_MS : null,
  });
}

export function resetModelConnectionHealthForTests() {
  healthRegistry.clear();
}

export async function executeModelRoute<T>({
  connections,
  failoverEnabled,
  signal,
  run,
}: {
  connections: ActiveModelConnection[];
  failoverEnabled: boolean;
  signal: AbortSignal;
  run: (connection: ActiveModelConnection) => Promise<T>;
}) {
  if (!connections.length) throw new Error("No model provider is configured.");
  const candidates = failoverEnabled
    ? connections.filter((connection, index) => index === 0 || modelConnectionHealth(connection).status !== "unhealthy")
    : connections.slice(0, 1);
  // A recently failed primary is skipped only when an authorized healthy/unknown fallback exists.
  if (failoverEnabled && candidates.length > 1 && modelConnectionHealth(candidates[0]).status === "unhealthy") {
    candidates.shift();
  }
  let lastError: unknown;
  for (const [index, connection] of candidates.entries()) {
    if (signal.aborted) throw new DOMException("The model request was aborted.", "AbortError");
    try {
      const result = await run(connection);
      recordModelConnectionHealth(connection, "healthy");
      return {
        result,
        connection,
        attempts: index + 1,
        failoverUsed: connectionKey(connection) !== connectionKey(connections[0]),
      };
    } catch (error) {
      if (signal.aborted || (error instanceof DOMException && error.name === "AbortError")) throw error;
      if (!(error instanceof Error && error.name === "ModelBudgetError")) {
        recordModelConnectionHealth(connection, "unhealthy");
      }
      lastError = error;
      if (!failoverEnabled) break;
    }
  }
  throw lastError instanceof Error ? lastError : new Error("Every authorized model provider failed.");
}
