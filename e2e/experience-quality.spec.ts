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

function relativeLuminance([red, green, blue]: number[]) {
  const channels = [red, green, blue]
    .map((channel) => channel / 255)
    .map((channel) => (channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4));
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

function contrastRatio(first: number[], second: number[]) {
  const luminance = [relativeLuminance(first), relativeLuminance(second)].sort((a, b) => b - a);
  return (luminance[0] + 0.05) / (luminance[1] + 0.05);
}

function cssRgb(value: string) {
  return value
    .match(/[\d.]+/gu)!
    .slice(0, 3)
    .map(Number);
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

test("Space Black preserves readable text and distinct workspace surface levels", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.addInitScript(() => localStorage.setItem("rune-appearance-theme-v1", "space-black"));
  await openWorkbench(page);
  await expect(page.locator("html")).toHaveAttribute("data-theme", "space-black");

  const colors = await page.evaluate(() => {
    const style = (selector: string) => getComputedStyle(document.querySelector(selector)!);
    return {
      fileRail: style(".file-rail").backgroundColor,
      sourcePane: style(".source-pane").backgroundColor,
      previewPane: style(".preview-pane").backgroundColor,
      sourceText: style(".source-editor").color,
      secondaryText: style(".artifact-label small").color,
      headingText: style(".markdown-body h1").color,
      paper: style(".document-paper").backgroundColor,
      smallestNavigationText: Number.parseFloat(style(".artifact-label small").fontSize),
    };
  });

  expect(new Set([colors.fileRail, colors.sourcePane, colors.previewPane]).size).toBe(3);
  expect(contrastRatio(cssRgb(colors.sourceText), cssRgb(colors.sourcePane))).toBeGreaterThanOrEqual(7);
  expect(contrastRatio(cssRgb(colors.secondaryText), cssRgb(colors.fileRail))).toBeGreaterThanOrEqual(4.5);
  expect(contrastRatio(cssRgb(colors.headingText), cssRgb(colors.paper))).toBeGreaterThanOrEqual(7);
  expect(colors.smallestNavigationText).toBeGreaterThanOrEqual(11);

  await page.locator("aside.file-rail").getByText("regional-revenue.csv", { exact: true }).click();
  const dataText = await page
    .locator(".data-grid tbody td")
    .first()
    .evaluate((element) => {
      const cell = getComputedStyle(element);
      const table = getComputedStyle(element.closest(".data-grid-wrap")!);
      return { color: cell.color, background: table.backgroundColor, fontSize: Number.parseFloat(cell.fontSize) };
    });
  expect(contrastRatio(cssRgb(dataText.color), cssRgb(dataText.background))).toBeGreaterThanOrEqual(7);
  expect(dataText.fontSize).toBeGreaterThanOrEqual(11);

  await page.getByRole("button", { name: "More tools" }).click();
  await page.getByRole("menuitem", { name: /Model settings/u }).click();
  const modelStatus = await page.locator(".model-status-card").evaluate((element) => {
    const card = getComputedStyle(element);
    const heading = getComputedStyle(element.querySelector("strong")!);
    const detail = getComputedStyle(element.querySelector("small")!);
    return {
      background: card.backgroundColor,
      heading: heading.color,
      detail: detail.color,
      detailSize: Number.parseFloat(detail.fontSize),
    };
  });
  expect(contrastRatio(cssRgb(modelStatus.heading), cssRgb(modelStatus.background))).toBeGreaterThanOrEqual(7);
  expect(contrastRatio(cssRgb(modelStatus.detail), cssRgb(modelStatus.background))).toBeGreaterThanOrEqual(4.5);
  expect(modelStatus.detailSize).toBeGreaterThanOrEqual(11);
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
