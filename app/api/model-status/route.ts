import { resolveActiveModelConnection } from "../../lib/model-credential-vault.ts";

export async function GET(request: Request = new Request("http://localhost/api/model-status")) {
  const connection = await resolveActiveModelConnection(request);
  return Response.json({
    configured: Boolean(connection),
    provider: connection?.provider ?? null,
    model: connection?.model ?? null,
    source: connection?.source ?? null,
    profileName: connection?.profileName ?? null,
  }, {
    headers: { "cache-control": "no-store", vary: "Cookie" },
  });
}
