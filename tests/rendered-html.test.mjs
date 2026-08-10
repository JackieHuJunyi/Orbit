import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import test from "node:test";

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request("http://localhost/", {
      headers: { accept: "text/html" },
    }),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );
}

test("server-renders the Rune artifact workbench", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<title>Rune — AI-native artifact workspace<\/title>/i);
  assert.match(html, /Artifact workspace/);
  assert.match(html, /q2-review\.md/);
  assert.match(html, /Rune Agent/);
  assert.match(html, /Open folder/);
  assert.match(html, /\.docx,\.xlsx,\.pptx/);
  assert.match(html, /Live preview/);
  assert.match(html, /metrics compiled live/);
  assert.match(html, /Q2 revenue by region/);
  assert.match(html, /chart-card embedded/);
  assert.match(html, /linked metrics/);
  assert.match(html, /Saved on device/);
  assert.doesNotMatch(html, /codex-preview|react-loading-skeleton|Your site is taking shape/i);
});

test("renders all five canonical artifact modes", async () => {
  const response = await render();
  const html = await response.text();
  assert.match(html, /q2-review\.md/);
  assert.match(html, /CSV \/ JSON/);
  assert.match(html, /regional-analysis\.sql/);
  assert.match(html, /DuckDB SQL/);
  assert.match(html, /regional-revenue\.chart\.json/);
  assert.match(html, /Chart JSON/);
  assert.match(html, /board-briefing\.deck\.md/);
  assert.match(html, /Deck Markdown/);
  assert.match(html, /Rune v0\.8/);
  assert.match(html, /Export q2-review\.md as DOCX/);
  assert.match(html, /Compiled output/);
  assert.match(html, /Every write is reviewable and undoable/);
});

test("keeps the Office compatibility parser out of the initial client bundle", async () => {
  const manifestUrl = new URL("../dist/client/.vite/manifest.json", import.meta.url);
  const manifest = JSON.parse(await readFile(manifestUrl, "utf8"));
  assert.equal(manifest["app/lib/office-import.ts"]?.isDynamicEntry, true);
  assert.ok(manifest["app/components/rune-workbench.tsx"]?.dynamicImports?.includes("app/lib/office-import.ts"));
  assert.equal(manifest["app/lib/office-export.ts"]?.isDynamicEntry, true);
  assert.ok(manifest["app/components/rune-workbench.tsx"]?.dynamicImports?.includes("app/lib/office-export.ts"));
});

test("ships a review-before-write import surface in the client", async () => {
  const assetsUrl = new URL("../dist/client/assets/", import.meta.url);
  const files = (await readdir(assetsUrl)).filter((name) => name.endsWith(".js"));
  const clientSource = (await Promise.all(files.map((name) => readFile(new URL(name, assetsUrl), "utf8")))).join("\n");
  assert.match(clientSource, /Review imported sources/);
  assert.match(clientSource, /Nothing is written until you confirm/);
  assert.match(clientSource, /One atomic device write after confirmation/);
  assert.match(clientSource, /aria-modal/);
  assert.match(clientSource, /Review Office export/);
  assert.match(clientSource, /No workspace or device draft changes/);
});
