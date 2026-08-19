import { resolveActiveModelConnection } from "../../lib/model-credential-vault.ts";
import { UNKNOWN_MODEL_CONNECTION_HEALTH } from "../../lib/model-profiles.ts";
import { modelConnectionHealth } from "../../lib/model-routing.ts";

export async function GET(request: Request = new Request("http://localhost/api/model-status")) {
  const connection = await resolveActiveModelConnection(request);
  return Response.json(
    {
      configured: Boolean(connection),
      provider: connection?.provider ?? null,
      model: connection?.model ?? null,
      source: connection?.source ?? null,
      profileName: connection?.profileName ?? null,
      budget: connection?.budget ?? null,
      capabilities: connection?.capabilities ?? null,
      health: connection ? modelConnectionHealth(connection) : { ...UNKNOWN_MODEL_CONNECTION_HEALTH },
    },
    {
      headers: { "cache-control": "no-store", vary: "Cookie" },
    },
  );
}
