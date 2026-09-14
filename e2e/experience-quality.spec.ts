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

  // Let the current page finish its same-origin DuckDB load before navigating
  // away. WebKit reports a cancelled Wasm fetch as a page error even though
  // React correctly aborts the obsolete query during reload.
  await expect(page.locator("[data-chart-source-row]").first()).toBeVisible({ timeout: 30_000 });

  await page.reload();
  await expect(page.getByRole("main")).toBeVisible();
  await expect(page.locator('main[data-orbit-hydrated="true"]')).toBeVisible();
  await expect(page.locator(".workspace")).toBeVisible();
  expect(failures).toEqual([]);
});

test("Space Black preserves readable text and distinct workspace surface levels", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.addInitScript(() => localStorage.setItem("orbit-appearance-theme-v1", "space-black"));
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
  const modelStatus = await page.locator(".model-discovery").evaluate((element) => {
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
  const contextTrigger = page.getByRole("button", { name: "Ask Orbit about this" });
  await expect(contextTrigger).toBeVisible();
  await contextTrigger.click();
  const floatingAgent = page.locator(".agent-dock.open.floating");
  await expect(floatingAgent).toBeVisible();
  const floatingBounds = await floatingAgent.boundingBox();
  expect(floatingBounds).not.toBeNull();
  expect(floatingBounds!.x).toBeGreaterThanOrEqual(7);
  expect(floatingBounds!.x + floatingBounds!.width).toBeLessThanOrEqual(383);
  expect(floatingBounds!.y + floatingBounds!.height).toBeLessThanOrEqual(837);
});

test("moves the floating Agent with the keyboard without changing its source scope", async ({ page }) => {
  await openWorkbench(page);
  await page.locator(".agent-dock-trigger").click();
  await page.getByRole("button", { name: "Float Agent" }).click();
  const floatingAgent = page.locator(".agent-dock.open.floating");
  await expect(floatingAgent).toBeVisible();
  const beforeMove = await floatingAgent.boundingBox();
  const moveHandle = page.getByRole("button", { name: "Move Agent" });
  expect(beforeMove).not.toBeNull();
  await moveHandle.focus();
  await moveHandle.press("Shift+ArrowLeft");
  await moveHandle.press("Shift+ArrowDown");
  const afterMove = await floatingAgent.boundingBox();
  expect(afterMove).not.toBeNull();
  expect(Math.abs(afterMove!.x - beforeMove!.x) + Math.abs(afterMove!.y - beforeMove!.y)).toBeGreaterThan(80);
  await expect(page.getByRole("combobox", { name: "Agent change scope" })).toHaveValue("artifact");
});

test("Markdown preview keeps compact gutters and a readable optical measure in split and focus views", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await openWorkbench(page);

  async function previewGeometry() {
    return page.locator(".document-stage").evaluate((stage) => {
      const paper = stage.querySelector<HTMLElement>(".document-paper")!;
      const body = paper.querySelector<HTMLElement>(".markdown-body")!;
      const stageBounds = stage.getBoundingClientRect();
      const paperBounds = paper.getBoundingClientRect();
      const paperStyle = getComputedStyle(paper);
      const bodyStyle = getComputedStyle(body);
      return {
        stageWidth: stageBounds.width,
        paperWidth: paperBounds.width,
        outerStart: paperBounds.left - stageBounds.left,
        outerEnd: stageBounds.right - paperBounds.right,
        paddingStart: Number.parseFloat(paperStyle.paddingInlineStart),
        paddingEnd: Number.parseFloat(paperStyle.paddingInlineEnd),
        bodyFontSize: Number.parseFloat(bodyStyle.fontSize),
        bodyLineHeight: Number.parseFloat(bodyStyle.lineHeight),
        bodyWidth: body.getBoundingClientRect().width,
      };
    });
  }

  const split = await previewGeometry();
  expect(Math.abs(split.outerStart - split.outerEnd)).toBeLessThanOrEqual(2);
  expect(split.outerStart).toBeGreaterThanOrEqual(9);
  expect(split.outerStart).toBeLessThanOrEqual(24);
  expect(split.paddingStart).toBeGreaterThanOrEqual(28);
  expect(split.paddingStart).toBeLessThanOrEqual(60);
  expect(Math.abs(split.paddingStart - split.paddingEnd)).toBeLessThanOrEqual(1);
  expect(split.bodyWidth / split.paperWidth).toBeGreaterThanOrEqual(0.78);
  expect(split.bodyFontSize).toBeGreaterThanOrEqual(15.5);
  expect(split.bodyFontSize).toBeLessThanOrEqual(17);
  expect(split.bodyLineHeight / split.bodyFontSize).toBeGreaterThanOrEqual(1.68);

  await page.locator('[data-workspace-view-option="preview"]').click();
  await expect(page.locator(".workspace")).toHaveClass(/view-preview/);
  await expect.poll(async () => (await previewGeometry()).paperWidth).toBeGreaterThanOrEqual(820);
  const focused = await previewGeometry();
  expect(Math.abs(focused.outerStart - focused.outerEnd)).toBeLessThanOrEqual(2);
  expect(focused.paperWidth).toBeGreaterThanOrEqual(880);
  expect(focused.paperWidth).toBeLessThanOrEqual(922);
  expect(focused.bodyWidth).toBeGreaterThanOrEqual(758);
  expect(focused.bodyWidth).toBeLessThanOrEqual(802);
  expect(focused.bodyFontSize).toBeGreaterThanOrEqual(16.5);
});

test("acknowledges a large-file switch before deferred compilation and avoids a massive line-number DOM", async ({
  page,
}) => {
  await openWorkbench(page);
  await expect.poll(() => page.evaluate(() => localStorage.getItem("orbit-workspace-v0"))).not.toBeNull();
  await page.addInitScript(() => {
    const state = JSON.parse(localStorage.getItem("orbit-workspace-v0") ?? "null");
    if (!state?.artifacts) return;
    const document = state.artifacts.find((artifact: { id: string }) => artifact.id === "q2-review");
    document.source = `# Large review\n\n${Array.from({ length: 18_000 }, (_, index) => `Paragraph ${index + 1}: current source evidence.`).join("\n\n")}`;
    state.selectedId = "regional-revenue";
    localStorage.setItem("orbit-workspace-v0", JSON.stringify(state));
  });
  await page.reload();
  await expect(page.locator('main[data-orbit-hydrated="true"]')).toBeVisible({ timeout: 15_000 });

  const target = page.locator("button.artifact-row").filter({ hasText: "q2-review.md" });
  const elapsed = await target.evaluate(async (button) => {
    const startedAt = performance.now();
    (button as HTMLButtonElement).click();
    while (!button.classList.contains("active")) await new Promise(requestAnimationFrame);
    return performance.now() - startedAt;
  });
  expect(elapsed).toBeLessThan(500);
  await expect(page.locator('.workspace[data-artifact-switching="false"]')).toBeVisible({ timeout: 5_000 });
  await expect(page.locator('.editor-wrap[data-large-source="true"]')).toBeVisible();
  await expect(page.locator(".line-gutter")).toBeHidden();
  await expect(page.getByRole("textbox", { name: /Edit q2-review\.md source/u })).toHaveValue(/^# Large review/u);
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
