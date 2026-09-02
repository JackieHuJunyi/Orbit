import { expect, test, type Locator, type Page } from "@playwright/test";

const LOCALES = [
  {
    id: "zh-CN",
    direction: "ltr",
    penSpeed: "0.922",
    renderer: "tegaki-font-centerline",
    script: "logographic",
    strokes: "2",
  },
  {
    id: "zh-TW",
    direction: "ltr",
    penSpeed: "0.922",
    renderer: "tegaki-font-centerline",
    script: "logographic",
    strokes: "2",
  },
  { id: "en", direction: "ltr", penSpeed: "reference", renderer: "vector-centerline", script: "cursive", strokes: "2" },
  { id: "fr", direction: "ltr", penSpeed: "1", renderer: "tegaki-font-centerline", script: "cursive", strokes: "7" },
  { id: "es", direction: "ltr", penSpeed: "1", renderer: "tegaki-font-centerline", script: "cursive", strokes: "4" },
  { id: "ru", direction: "ltr", penSpeed: "1", renderer: "tegaki-font-centerline", script: "cursive", strokes: "6" },
  { id: "ar", direction: "rtl", penSpeed: "1.068", renderer: "tegaki-font-centerline", script: "arabic", strokes: "5" },
  { id: "ja", direction: "ltr", penSpeed: "1.146", renderer: "tegaki-font-centerline", script: "kana", strokes: "5" },
  { id: "ko", direction: "ltr", penSpeed: "1.146", renderer: "tegaki-font-centerline", script: "hangul", strokes: "5" },
] as const;

const VIEWPORTS = [
  { name: "desktop", width: 1440, height: 900 },
  { name: "compact", width: 390, height: 844 },
] as const;

async function expectInsideViewport(page: Page, locator: Locator) {
  const bounds = await locator.boundingBox();
  expect(bounds).not.toBeNull();
  expect(bounds!.x).toBeGreaterThanOrEqual(-1);
  expect(bounds!.y).toBeGreaterThanOrEqual(-1);
  expect(bounds!.x + bounds!.width).toBeLessThanOrEqual((page.viewportSize()?.width ?? 0) + 1);
  expect(bounds!.y + bounds!.height).toBeLessThanOrEqual((page.viewportSize()?.height ?? 0) + 1);
}

async function expectInsideContainer(locator: Locator, container: Locator) {
  const [bounds, containerBounds] = await Promise.all([locator.boundingBox(), container.boundingBox()]);
  expect(bounds).not.toBeNull();
  expect(containerBounds).not.toBeNull();
  expect(bounds!.y).toBeGreaterThanOrEqual(containerBounds!.y - 1);
  expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(containerBounds!.y + containerBounds!.height + 1);
}

async function expectSeparated(first: Locator, second: Locator) {
  const [firstBounds, secondBounds] = await Promise.all([first.boundingBox(), second.boundingBox()]);
  expect(firstBounds).not.toBeNull();
  expect(secondBounds).not.toBeNull();
  const separated =
    firstBounds!.x + firstBounds!.width <= secondBounds!.x + 1 ||
    secondBounds!.x + secondBounds!.width <= firstBounds!.x + 1 ||
    firstBounds!.y + firstBounds!.height <= secondBounds!.y + 1 ||
    secondBounds!.y + secondBounds!.height <= firstBounds!.y + 1;
  expect(separated, JSON.stringify({ firstBounds, secondBounds })).toBe(true);
}

async function expectNoDocumentOverflow(page: Page) {
  const geometry = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
    bodyScrollWidth: document.body.scrollWidth,
    viewportWidth: window.innerWidth,
    offenders: Array.from(document.querySelectorAll<HTMLElement>("body *"))
      .map((element) => {
        const bounds = element.getBoundingClientRect();
        return {
          selector: `${element.tagName.toLowerCase()}.${element.className}`,
          left: Math.round(bounds.left),
          right: Math.round(bounds.right),
          width: Math.round(bounds.width),
        };
      })
      .filter(({ left, right }) => left < -1 || right > window.innerWidth + 1)
      .slice(0, 40),
  }));
  expect(geometry.scrollWidth, JSON.stringify(geometry)).toBeLessThanOrEqual(geometry.viewportWidth + 1);
  expect(geometry.bodyScrollWidth, JSON.stringify(geometry)).toBeLessThanOrEqual(geometry.viewportWidth + 1);
  expect(geometry.clientWidth, JSON.stringify(geometry)).toBe(geometry.viewportWidth);
}

for (const viewport of VIEWPORTS) {
  test.describe(`${viewport.name} localized geometry`, () => {
    test.use({
      viewport: { width: viewport.width, height: viewport.height },
    });

    for (const locale of LOCALES) {
      test(`${locale.id} keeps onboarding and the empty workspace bounded`, async ({ page }) => {
        const pageErrors: string[] = [];
        page.on("pageerror", (error) => pageErrors.push(error.message));
        await page.emulateMedia({ reducedMotion: "reduce" });
        await page.addInitScript((localeId) => localStorage.setItem("rune-locale-v1", localeId), locale.id);
        await page.goto("/");

        const root = page.locator("html");
        const dialog = page.locator(".welcome-backdrop");
        const welcomeWindow = dialog.locator(".welcome-window");
        const languageOptions = dialog.locator(".language-options");
        const greeting = dialog.locator(`.welcome-greeting[data-greeting-locale="${locale.id}"]`);
        const greetingStage = dialog.locator(".welcome-greeting-stage");
        const languageCard = dialog.locator(".welcome-language-card");
        const selectedLanguage = languageOptions.locator('[role="radio"][aria-checked="true"]');
        const primaryAction = dialog.locator(".welcome-language-card > .welcome-primary");

        await expect(root).toHaveAttribute("data-locale", locale.id);
        await expect(root).toHaveAttribute("dir", locale.direction);
        await expect(dialog).toBeVisible();
        await expect(greeting).toHaveAttribute("data-motion-script", locale.script);
        await expect(greeting).toHaveAttribute("data-motion-renderer", locale.renderer);
        await expect(greeting).toHaveAttribute("data-pen-speed", locale.penSpeed);
        await expect(greeting).toHaveAttribute("data-stroke-count", locale.strokes);
        if (locale.renderer === "tegaki-font-centerline") {
          await expect(greeting).toHaveAttribute("data-font-state", "ready");
        }
        await expect(languageOptions.getByRole("radio")).toHaveCount(LOCALES.length);
        await expect(selectedLanguage).toHaveCount(1);
        await expectInsideContainer(selectedLanguage, languageOptions);
        await expectInsideViewport(page, welcomeWindow);
        if (viewport.name === "desktop") {
          const bounds = await welcomeWindow.boundingBox();
          expect(Math.abs(bounds!.x + bounds!.width / 2 - viewport.width / 2)).toBeLessThanOrEqual(1);
          expect(Math.abs(bounds!.y + bounds!.height / 2 - viewport.height / 2)).toBeLessThanOrEqual(1);
        }
        await expectSeparated(greetingStage, languageCard);
        await expectNoDocumentOverflow(page);

        await primaryAction.scrollIntoViewIfNeeded();
        await expect(primaryAction).toBeInViewport();
        const actionHeight = await primaryAction.evaluate((element) => element.getBoundingClientRect().height);
        expect(actionHeight).toBeGreaterThanOrEqual(44);

        await primaryAction.click();
        const modelPage = dialog.locator(".welcome-model");
        const modelTitle = modelPage.locator("h1");
        const modelPanel = modelPage.locator(".model-setup-panel");
        const modelActions = modelPage.locator(".welcome-model-actions");
        const modelBack = modelPage.locator(".welcome-step-back");
        await expect(modelPage).toBeVisible();
        await expect(modelPanel).toBeVisible();
        await modelActions.scrollIntoViewIfNeeded();
        await expect(modelActions).toBeInViewport();
        await expect(modelBack).toBeInViewport();
        await expect(modelPage.locator(".welcome-chrome .welcome-step-back")).toHaveCount(0);
        await expectInsideViewport(page, welcomeWindow);
        await expectNoDocumentOverflow(page);
        const titleMetrics = await modelTitle.evaluate((element) => {
          const style = getComputedStyle(element);
          const bounds = element.getBoundingClientRect();
          return {
            fontSize: Number.parseFloat(style.fontSize),
            lineHeight: Number.parseFloat(style.lineHeight),
            width: bounds.width,
          };
        });
        expect(titleMetrics.fontSize).toBeGreaterThanOrEqual(28);
        expect(titleMetrics.fontSize).toBeLessThanOrEqual(44);
        expect(titleMetrics.lineHeight / titleMetrics.fontSize).toBeGreaterThanOrEqual(1.05);
        expect(titleMetrics.width).toBeLessThanOrEqual(viewport.width - (viewport.width <= 680 ? 32 : 80));
        if (viewport.width <= 680) {
          const controlHeights = await modelPage
            .locator(".model-setup-panel button:visible, .welcome-step-navigation button:visible")
            .evaluateAll((elements) => elements.map((element) => element.getBoundingClientRect().height));
          expect(controlHeights.length).toBeGreaterThan(0);
          expect(Math.min(...controlHeights)).toBeGreaterThanOrEqual(44);
        }

        await page.evaluate(() => localStorage.setItem("rune-onboarding-v1", "complete"));
        await page.reload();
        await expect(root).toHaveAttribute("data-locale", locale.id);
        await expect(root).toHaveAttribute("dir", locale.direction);
        await expect(page.getByRole("main")).toBeVisible();
        await expect(page.locator(".topbar")).toBeVisible();

        const settingsTrigger = page.locator("[data-settings-trigger]");
        const settingsMenu = page.locator(".settings-popover");
        await settingsTrigger.focus();
        await settingsTrigger.press("ArrowDown");
        await expect(settingsMenu).toBeVisible();
        await expect(settingsMenu.locator('[role="menuitem"]:not(:disabled)').first()).toBeFocused();
        await expectInsideViewport(page, settingsMenu);
        await expectNoDocumentOverflow(page);
        await page.keyboard.press("Escape");
        await expect(settingsMenu).toBeHidden();
        await expect(settingsTrigger).toBeFocused();

        await page.evaluate(() =>
          window.dispatchEvent(
            new KeyboardEvent("keydown", { key: "w", ctrlKey: true, bubbles: true, cancelable: true }),
          ),
        );
        const emptyCanvas = page.locator(".empty-workspace-canvas");
        const dropZone = emptyCanvas.locator(".empty-drop-zone");
        await expect(emptyCanvas).toBeVisible();
        await expect(dropZone).toBeVisible();
        await expectNoDocumentOverflow(page);

        await dropZone.scrollIntoViewIfNeeded();
        const dropBounds = await dropZone.boundingBox();
        const canvasBounds = await emptyCanvas.boundingBox();
        expect(dropBounds).not.toBeNull();
        expect(canvasBounds).not.toBeNull();
        expect(dropBounds!.x).toBeGreaterThanOrEqual(canvasBounds!.x - 1);
        expect(dropBounds!.x + dropBounds!.width).toBeLessThanOrEqual(canvasBounds!.x + canvasBounds!.width + 1);
        expect(pageErrors).toEqual([]);
      });
    }
  });
}
