import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import test from "node:test";

const officeModule = new URL("../app/lib/office-export.ts", import.meta.url).href;
const odfModule = new URL("../app/lib/odf-export.ts", import.meta.url).href;
const script = `
  import { createHash } from "node:crypto";
  import { exportOfficeArtifact } from ${JSON.stringify(officeModule)};
  import { exportOdfArtifact } from ${JSON.stringify(odfModule)};
  const artifact = { id: "report", name: "report.md", kind: "document", language: "Markdown", source: "# Report\\n" };
  for (const exportArtifact of [exportOfficeArtifact, exportOdfArtifact]) {
    const { bytes } = exportArtifact(artifact);
    console.log(createHash("sha256").update(bytes).digest("hex"));
  }
`;

test("Office and OpenDocument packages are valid and identical across time zones", () => {
  const exportIn = (timezone) =>
    spawnSync(process.execPath, ["--experimental-strip-types", "--input-type=module", "-e", script], {
      encoding: "utf8",
      env: { ...process.env, TZ: timezone },
    });
  const utc = exportIn("UTC");
  const newYork = exportIn("America/New_York");
  const shanghai = exportIn("Asia/Shanghai");

  for (const result of [utc, newYork, shanghai]) assert.equal(result.status, 0, result.stderr);
  assert.equal(newYork.stdout, utc.stdout);
  assert.equal(shanghai.stdout, utc.stdout);
});
