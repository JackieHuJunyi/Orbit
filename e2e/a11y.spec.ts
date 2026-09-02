import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

async function settleDefaultWorkspaceRuntime(page: Page) {
  await expect(page.getByText("$4.82M", { exact: true }).first()).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole("figure", { name: "Gross margin by region" }).first()).toBeVisible({ timeout: 30_000 });
}

test("fresh-user onboarding has no critical accessibility violations", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("dialog", { name: "Choose your Orbit language" })).toBeVisible();

  const results = await new AxeBuilder({ page }).analyze();
  const critical = results.violations.filter((violation) => violation.impact === "critical");

  expect(critical, critical.map((violation) => `${violation.id}: ${violation.help}`).join("\n")).toEqual([]);
});

test("workbench has no critical accessibility violations", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("rune-onboarding-v1", "complete"));
  await page.goto("/");
  await expect(page.getByRole("main")).toBeVisible();
  await expect(page.getByRole("button", { name: "New", exact: true }).first()).toBeEnabled();
  await settleDefaultWorkspaceRuntime(page);

  const results = await new AxeBuilder({ page }).analyze();
  const critical = results.violations.filter((violation) => violation.impact === "critical");

  // Serious and lower issues are tracked separately; the gate starts at
  // critical so a long-tail of minor findings does not block every change.
  expect(critical, critical.map((violation) => `${violation.id}: ${violation.help}`).join("\n")).toEqual([]);
});

test("operating-review setup has no serious accessibility violations", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("rune-onboarding-v1", "complete"));
  await page.goto("/");
  await expect(page.getByRole("button", { name: "Create operating review", exact: true })).toBeEnabled();
  await settleDefaultWorkspaceRuntime(page);
  await page.getByRole("button", { name: "Create operating review", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Prepare a verifiable operating-review chain" });
  await expect(dialog).toBeVisible();

  const results = await new AxeBuilder({ page }).include('[role="dialog"]').analyze();
  const blocking = results.violations.filter(
    (violation) => violation.impact === "critical" || violation.impact === "serious",
  );

  expect(blocking, blocking.map((violation) => `${violation.id}: ${violation.help}`).join("\n")).toEqual([]);
});

test("space-black operating-review setup has no serious accessibility violations", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("rune-onboarding-v1", "complete");
    localStorage.setItem("rune-appearance-theme-v1", "space-black");
  });
  await page.goto("/");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "space-black");
  await settleDefaultWorkspaceRuntime(page);
  await page.getByRole("button", { name: "Create operating review", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Prepare a verifiable operating-review chain" });
  await expect(dialog).toBeVisible();

  const results = await new AxeBuilder({ page }).include('[role="dialog"]').analyze();
  const blocking = results.violations.filter(
    (violation) => violation.impact === "critical" || violation.impact === "serious",
  );

  expect(blocking, blocking.map((violation) => `${violation.id}: ${violation.help}`).join("\n")).toEqual([]);
});
