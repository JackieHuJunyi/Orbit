import { expect, test } from "@playwright/test";
import { openWorkbench } from "./helpers/workbench";

declare global {
  interface Window {
    __runeFolderTest: {
      clear(): void;
      seedFromDevice(source: string): void;
      set(name: string, source: string): void;
      get(name: string): string | null;
      writes(): number;
    };
  }
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    const files = new Map<string, string>();
    let writes = 0;
    const missing = (name: string) => new DOMException(`${name} not found`, "NotFoundError");

    class TestFileHandle {
      kind = "file" as const;
      constructor(public name: string) {}
      async getFile() {
        if (!files.has(this.name)) throw missing(this.name);
        const source = files.get(this.name) ?? "";
        return {
          size: new TextEncoder().encode(source).byteLength,
          lastModified: 1,
          text: async () => source,
          arrayBuffer: async () => new TextEncoder().encode(source).buffer,
        };
      }
      async createWritable() {
        let next = "";
        return {
          write: async (value: string | Uint8Array) => {
            next = typeof value === "string" ? value : new TextDecoder().decode(value);
          },
          close: async () => {
            files.set(this.name, next);
            writes += 1;
          },
        };
      }
    }

    const root = {
      kind: "directory" as const,
      name: "Reviewed folder",
      async getFileHandle(name: string, options?: { create?: boolean }) {
        if (!files.has(name) && !options?.create) throw missing(name);
        if (!files.has(name)) files.set(name, "");
        return new TestFileHandle(name);
      },
      async getDirectoryHandle(name: string) {
        throw missing(name);
      },
      async *entries() {
        for (const name of [...files.keys()].sort()) yield [name, new TestFileHandle(name)] as const;
      },
    };

    Object.assign(window, {
      showDirectoryPicker: async () => root,
      __runeFolderTest: {
        clear() {
          files.clear();
          writes = 0;
        },
        seedFromDevice(source: string) {
          const state = JSON.parse(localStorage.getItem("rune-workspace-v0") ?? "null");
          if (!state?.artifacts?.length) throw new Error("Device workspace is not ready");
          files.clear();
          const artifacts = state.artifacts.map(
            (artifact: { id: string; name: string; kind: string; language: string }) => ({
              id: artifact.id,
              name: artifact.name,
              kind: artifact.kind,
              language: artifact.language,
            }),
          );
          for (const artifact of state.artifacts) {
            files.set(artifact.name, artifact.id === "q2-review" ? source : artifact.source);
          }
          files.set("rune.workspace.json", `${JSON.stringify({ version: 1, artifacts }, null, 2)}\n`);
          writes = 0;
        },
        set(name: string, source: string) {
          files.set(name, source);
        },
        get(name: string) {
          return files.get(name) ?? null;
        },
        writes() {
          return writes;
        },
      },
    });
  });
});

test("reviews an empty-folder initialization before writing readable sources", async ({ page }) => {
  await openWorkbench(page);
  await page.evaluate(() => window.__runeFolderTest.clear());
  const source = await page.locator("textarea.source-editor").inputValue();
  const tools = page.getByRole("button", { name: "More tools" });

  await tools.click();
  await page.getByRole("menuitem", { name: /^Open folder\b/u }).click();
  const review = page.getByRole("dialog", { name: "Initialize the folder with this workspace?" });
  await expect(review).toBeVisible();
  await expect(review.getByRole("button", { name: "Cancel", exact: true })).toBeFocused();
  await page.keyboard.press("Escape");
  expect(await page.evaluate(() => window.__runeFolderTest.writes())).toBe(0);

  await tools.click();
  await page.getByRole("menuitem", { name: /^Open folder\b/u }).click();
  await review.getByRole("button", { name: "Initialize folder", exact: true }).click();
  await expect(review).toBeHidden();
  expect(await page.evaluate(() => window.__runeFolderTest.get("q2-review.md"))).toBe(source);
  expect(await page.evaluate(() => window.__runeFolderTest.get("rune.workspace.json"))).toContain('"version": 1');
});

test("reviews folder Pull and Push, preserves recovery, and blocks external drift", async ({ page }) => {
  let nativeDialogs = 0;
  page.on("dialog", async (dialog) => {
    nativeDialogs += 1;
    await dialog.dismiss();
  });
  await openWorkbench(page);
  const editor = page.locator("textarea.source-editor");
  const originalSource = await editor.inputValue();
  const folderSource = `${originalSource}\n\nFolder-reviewed revision.`;
  await page.waitForTimeout(520);
  await page.evaluate((source) => {
    window.__runeFolderTest.seedFromDevice(source);
  }, folderSource);

  const tools = page.getByRole("button", { name: "More tools" });
  await tools.click();
  await page.getByRole("menuitem", { name: /^Open folder\b/u }).click();
  const pullReview = page.getByRole("dialog", { name: "Pull these folder changes?" });
  await expect(pullReview).toBeVisible();
  await expect(pullReview.locator("code").filter({ hasText: "q2-review.md" })).toBeVisible();
  await expect(pullReview.getByRole("button", { name: "Cancel", exact: true })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(pullReview).toBeHidden();
  await expect(editor).toHaveValue(originalSource);
  expect(await page.evaluate(() => window.__runeFolderTest.writes())).toBe(0);

  await tools.click();
  await page.getByRole("menuitem", { name: /^Open folder\b/u }).click();
  await pullReview.getByRole("button", { name: "Confirm pull", exact: true }).click();
  await expect(pullReview).toBeHidden();
  await expect(editor).toHaveValue(folderSource);
  const storedAfterPull = await page.evaluate(() => JSON.parse(localStorage.getItem("rune-workspace-v0") ?? "{}"));
  expect(
    storedAfterPull.resetRecovery.artifacts.find((artifact: { id: string }) => artifact.id === "q2-review")?.source,
  ).toBe(originalSource);
  expect(nativeDialogs).toBe(0);

  const devicePushSource = `${folderSource}\n\nDevice-reviewed push.`;
  await editor.fill(devicePushSource);
  await page.waitForTimeout(520);
  await tools.click();
  await page.getByRole("menuitem", { name: /^Push workspace files\b/u }).click();
  const pushReview = page.getByRole("dialog", { name: "Push these changes to the folder?" });
  await expect(pushReview).toBeVisible();
  await page.evaluate(() => window.__runeFolderTest.set("q2-review.md", "# External folder edit"));
  await pushReview.getByRole("button", { name: "Confirm push", exact: true }).click();
  await expect(pushReview.getByRole("alert")).toContainText("folder changed after this review opened");
  expect(await page.evaluate(() => window.__runeFolderTest.writes())).toBe(0);
  expect(await page.evaluate(() => window.__runeFolderTest.get("q2-review.md"))).toBe("# External folder edit");

  await pushReview.getByRole("button", { name: "Cancel", exact: true }).click();
  await tools.click();
  await page.getByRole("menuitem", { name: /^Push workspace files\b/u }).click();
  await pushReview.getByRole("button", { name: "Confirm push", exact: true }).click();
  await expect(pushReview).toBeHidden();
  expect(await page.evaluate(() => window.__runeFolderTest.get("q2-review.md"))).toBe(devicePushSource);
  expect(await page.evaluate(() => window.__runeFolderTest.writes())).toBeGreaterThan(0);
  expect(nativeDialogs).toBe(0);
});
