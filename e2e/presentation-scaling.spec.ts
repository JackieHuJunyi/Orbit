import { expect, test } from "@playwright/test";
import { openWorkbench, selectWorkspaceFile } from "./helpers/workbench";

test("keeps Q2 Board Briefing on a fixed canvas while the preview pane shrinks", async ({ page }) => {
  await openWorkbench(page);
  await selectWorkspaceFile(page, "board-briefing.html");

  const firstCanvas = page.locator(".deck-slide-canvas").first();
  const firstFrame = firstCanvas.locator("iframe.slides-frame");
  const firstSlide = page.frameLocator("iframe.slides-frame").first().locator("body > main > section");
  await expect(firstFrame).toHaveAttribute("width", "1120");
  await expect(firstFrame).toHaveAttribute("height", "630");
  await expect(firstFrame).toHaveAttribute("srcdoc", /data-rune-preview-canvas="1120x630"/u);
  await expect(firstSlide).toHaveCSS("width", "1120px");
  await expect(firstSlide).toHaveCSS("height", "630px");

  const initialCanvas = await firstCanvas.boundingBox();
  expect(initialCanvas).not.toBeNull();
  const initialType = await firstSlide.locator("h1").evaluate((element) => getComputedStyle(element).fontSize);

  const splitter = page.getByRole("separator", { name: "Resize source and preview" });
  await splitter.focus();
  await splitter.press("Shift+ArrowRight");
  await splitter.press("Shift+ArrowRight");
  await splitter.press("Shift+ArrowRight");
  await splitter.press("Shift+ArrowRight");

  await expect(splitter).toHaveAttribute("aria-valuenow", "64");
  await expect
    .poll(async () => (await firstCanvas.boundingBox())?.width ?? Number.POSITIVE_INFINITY)
    .toBeLessThan(initialCanvas!.width);
  await expect(firstSlide).toHaveCSS("width", "1120px");
  await expect(firstSlide).toHaveCSS("height", "630px");
  expect(await firstSlide.locator("h1").evaluate((element) => getComputedStyle(element).fontSize)).toBe(initialType);

  const readFrameMetrics = () =>
    firstFrame.evaluate((element) => {
      const iframe = element as HTMLIFrameElement;
      const viewport = iframe.parentElement as HTMLElement;
      return {
        iframeWidth: iframe.getBoundingClientRect().width,
        viewportWidth: viewport.getBoundingClientRect().width,
        canvas: viewport.dataset.presentationCanvas,
        scale: Number(getComputedStyle(viewport).getPropertyValue("--presentation-frame-scale")),
      };
    });
  await expect
    .poll(async () => {
      const metrics = await readFrameMetrics();
      return metrics.iframeWidth <= metrics.viewportWidth;
    })
    .toBe(true);
  const frameMetrics = await readFrameMetrics();
  expect(frameMetrics.canvas).toBe("1120x630");
  expect(frameMetrics.scale).toBeLessThan(1);
  expect(frameMetrics.iframeWidth).toBeLessThanOrEqual(frameMetrics.viewportWidth);
  expect(frameMetrics.viewportWidth - frameMetrics.iframeWidth).toBeLessThanOrEqual(4);

  const frameCount = await page.locator("iframe.slides-frame").count();
  for (let index = 0; index < frameCount; index += 1) {
    const slideMetrics = await page
      .frameLocator("iframe.slides-frame")
      .nth(index)
      .locator("body > main > section")
      .evaluate((section) => ({
        clientHeight: section.clientHeight,
        clientWidth: section.clientWidth,
        scrollHeight: section.scrollHeight,
        scrollWidth: section.scrollWidth,
      }));
    expect(slideMetrics.scrollWidth).toBeLessThanOrEqual(slideMetrics.clientWidth);
    expect(slideMetrics.scrollHeight).toBeLessThanOrEqual(slideMetrics.clientHeight);
  }
});
