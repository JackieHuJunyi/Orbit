import { modelProviderStatus } from "../../lib/model-preference.ts";

export async function GET() {
  return Response.json(modelProviderStatus(process.env), {
    headers: { "cache-control": "no-store" },
  });
}
