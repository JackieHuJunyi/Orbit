import { expect, test, type Page } from "@playwright/test";

async function openWorkbench(page: Page) {
  // A fresh browser profile otherwise opens the full-screen onboarding modal,
  // which covers the workbench. Mark onboarding complete before first paint.
  await page.addInitScript(() => localStorage.setItem("rune-onboarding-v1", "complete"));
  await page.goto("/");
  await expect(page.getByRole("main")).toBeVisible();
  // The top-bar controls render disabled until React hydrates; wait for that
  // so every interaction below runs against the live event handlers.
  await expect(page.getByRole("button", { name: "New", exact: true }).first()).toBeEnabled();
}

test("starts a fresh user with outcome-first task choices", async ({ page }) => {
  await page.goto("/");

  const onboarding = page.getByRole("dialog", { name: "Every piece of work, with a clear source." });
  await expect(onboarding).toBeVisible();
  await expect(onboarding.getByText("Local first")).toBeVisible();
  await expect(onboarding.getByText("Review before write")).toBeVisible();

  await onboarding.getByRole("button", { name: "Skip", exact: true }).click();
  const ready = page.getByRole("dialog", { name: "Your workspace, under your control." });
  await expect(ready).toBeVisible();
  await expect(ready.getByRole("button", { name: /Create a review from data/ })).toBeVisible();
  await expect(ready.getByRole("button", { name: /Create presentation from document/ })).toBeVisible();
  await expect(ready.getByRole("button", { name: /Explore sample workspace/ })).toBeVisible();

  await ready.getByRole("button", { name: /Explore sample workspace/ }).click();
  await expect(ready).toBeHidden();
  await expect(page.getByRole("main")).toBeVisible();
  await expect(page.locator("aside.file-rail").getByText("q2-review.md")).toBeVisible();
});

test("renders the local-first workbench with its sample workspace", async ({ page }) => {
  await openWorkbench(page);
  await expect(page.getByRole("main")).toContainText("Rune");
  await expect(page.locator("aside.file-rail").getByText("q2-review.md")).toBeVisible();
  await expect(page.locator("aside.file-rail").getByText("regional-revenue.csv")).toBeVisible();
  await expect(page.getByRole("button", { name: "More tools" })).toBeVisible();
});

test("toggles the workspace file rail without losing the workbench", async ({ page }) => {
  await openWorkbench(page);
  const rail = page.locator("aside.file-rail");
  await expect(rail).toBeVisible();
  await page.getByRole("button", { name: "Hide workspace files" }).click();
  await expect(rail).toBeHidden();
  await page.getByRole("button", { name: "Show workspace files" }).click();
  await expect(rail).toBeVisible();
});

test("opens and closes the New artifact dialog from the top bar", async ({ page }) => {
  await openWorkbench(page);
  await page.getByRole("button", { name: "New", exact: true }).first().click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toBeHidden();
});

test("opens the settings panel from the bottom-left gear", async ({ page }) => {
  await openWorkbench(page);
  const panel = page.getByRole("menu", { name: "Workspace tools" });
  await page.getByRole("button", { name: "More tools" }).click();
  await expect(panel).toBeVisible();
  await expect(panel.getByRole("menuitem", { name: /Model settings/ })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(panel).toBeHidden();
});
