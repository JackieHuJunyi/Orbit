import { expect, test, type Page } from "@playwright/test";
import { openWorkbench } from "./helpers/workbench";

function collectRuntimeFailures(page: Page) {
  const failures: string[] = [];
  page.on("pageerror", (error) => failures.push(error.message));
  page.on("console", (message) => {
    if (message.type() !== "error") return;
    const text = message.text();
    if (/hydration|server rendered|unhandled script error/i.test(text)) failures.push(text);
  });
  return failures;
}

test("hydrates cleanly and reveals the Agent only when requested", async ({ page }) => {
  const failures = collectRuntimeFailures(page);
  await openWorkbench(page);
  const dock = page.locator(".agent-dock");
  await expect(dock).toHaveClass(/collapsed/);
  await expect(page.getByRole("textbox", { name: "Describe an artifact change" })).toHaveCount(0);

  await page.locator(".agent-dock-trigger").click();
  await expect(dock).toHaveClass(/open/);
  await expect(page.getByRole("textbox", { name: "Describe an artifact change" })).toBeFocused();

  await page.reload();
  await expect(page.getByRole("main")).toBeVisible();
  await expect(page.locator('main[data-rune-hydrated="true"]')).toBeVisible();
  await expect(page.locator(".workspace")).toBeVisible();
  expect(failures).toEqual([]);
});

test("compact Preview selection opens and centers its exact Source range", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await openWorkbench(page);
  const workspace = page.locator(".workspace");
  await expect(workspace).toHaveClass(/view-preview/);

  await page
    .locator('.document-source-block[data-document-block-type="heading"] h2')
    .filter({ hasText: "Next actions" })
    .click();
  await expect(workspace).toHaveClass(/view-source/);
  const selection = await page.locator("textarea.source-editor").evaluate((element: HTMLTextAreaElement) => ({
    start: element.selectionStart,
    end: element.selectionEnd,
    scrollTop: element.scrollTop,
    viewportHeight: element.clientHeight,
    scrollHeight: element.scrollHeight,
  }));
  expect(selection.end).toBeGreaterThan(selection.start);
  expect(selection.scrollTop).toBeGreaterThan(0);
  expect(selection.scrollTop).toBeLessThanOrEqual(selection.scrollHeight - selection.viewportHeight + 1);
});

for (const viewport of [
  { name: "desktop", width: 1440, height: 900, minimumCanvasRatio: 0.7 },
  { name: "compact", width: 390, height: 844, minimumCanvasRatio: 0.75 },
] as const) {
  test(`${viewport.name} empty workspace owns the complete content track`, async ({ page }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await openWorkbench(page);
    await page.getByLabel("Close current file").evaluate((element: HTMLButtonElement) => element.click());

    const geometry = await page.locator(".empty-workspace-canvas").evaluate((element) => {
      const canvas = element.getBoundingClientRect();
      const workspace = element.parentElement!.getBoundingClientRect();
      const zone = element.querySelector<HTMLElement>(".empty-drop-zone")!.getBoundingClientRect();
      return {
        canvasWidth: canvas.width,
        workspaceWidth: workspace.width,
        canvasRight: canvas.right,
        workspaceRight: workspace.right,
        zoneLeft: zone.left,
        zoneRight: zone.right,
        canvasLeft: canvas.left,
      };
    });
    expect(geometry.canvasWidth / geometry.workspaceWidth).toBeGreaterThanOrEqual(viewport.minimumCanvasRatio);
    expect(Math.abs(geometry.canvasRight - geometry.workspaceRight)).toBeLessThanOrEqual(18);
    expect(geometry.zoneLeft).toBeGreaterThanOrEqual(geometry.canvasLeft - 1);
    expect(geometry.zoneRight).toBeLessThanOrEqual(geometry.canvasRight + 1);
    await expect(page.getByRole("button", { name: "Open files" })).toBeVisible();

    if (viewport.name === "compact") {
      await expect(page.locator('[data-workspace-view-option="split"]')).toBeHidden();
      const workspaceHeight = await page
        .locator(".workspace")
        .evaluate((element) => element.getBoundingClientRect().height);
      expect(workspaceHeight).toBeLessThanOrEqual(viewport.height);
    }
  });
}
