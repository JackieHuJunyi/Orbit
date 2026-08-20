import { expect, test, type Locator, type Page } from "@playwright/test";

const LOCALES = [
  { id: "zh-CN", direction: "ltr" },
  { id: "zh-TW", direction: "ltr" },
  { id: "en", direction: "ltr" },
  { id: "fr", direction: "ltr" },
  { id: "es", direction: "ltr" },
  { id: "ru", direction: "ltr" },
  { id: "ar", direction: "rtl" },
  { id: "ja", direction: "ltr" },
  { id: "ko", direction: "ltr" },
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
        const introCopy = dialog.locator(".welcome-intro-copy");
        const languageCard = dialog.locator(".welcome-language-card");
        const selectedLanguage = languageOptions.locator('[role="radio"][aria-checked="true"]');
        const primaryAction = dialog.locator(".welcome-language-card > .welcome-primary");

        await expect(root).toHaveAttribute("data-locale", locale.id);
        await expect(root).toHaveAttribute("dir", locale.direction);
        await expect(dialog).toBeVisible();
        await expect(languageOptions.getByRole("radio")).toHaveCount(LOCALES.length);
        await expect(selectedLanguage).toHaveCount(1);
        await expectInsideContainer(selectedLanguage, languageOptions);
        await expectInsideViewport(page, welcomeWindow);
        await expectSeparated(introCopy, languageCard);
        await expectNoDocumentOverflow(page);

        await primaryAction.scrollIntoViewIfNeeded();
        await expect(primaryAction).toBeInViewport();
        const actionHeight = await primaryAction.evaluate((element) => element.getBoundingClientRect().height);
        expect(actionHeight).toBeGreaterThanOrEqual(44);

        await page.evaluate(() => localStorage.setItem("rune-onboarding-v1", "complete"));
        await page.reload();
        await expect(root).toHaveAttribute("data-locale", locale.id);
        await expect(root).toHaveAttribute("dir", locale.direction);
        await expect(page.getByRole("main")).toBeVisible();
        await expect(page.locator(".topbar")).toBeVisible();

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
