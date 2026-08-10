import assert from "node:assert/strict";
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
  assert.match(html, /Live preview/);
  assert.match(html, /Saved on device/);
  assert.doesNotMatch(html, /codex-preview|react-loading-skeleton|Your site is taking shape/i);
});

test("renders all three canonical artifact modes", async () => {
  const response = await render();
  const html = await response.text();
  assert.match(html, /Markdown/);
  assert.match(html, /CSV \/ JSON/);
  assert.match(html, /Semantic HTML/);
  assert.match(html, /Compiled output/);
  assert.match(html, /Every write is reviewable and undoable/);
});
