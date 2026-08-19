import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test("fresh-user onboarding has no critical accessibility violations", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("dialog", { name: "Every piece of work, with a clear source." })).toBeVisible();

  const results = await new AxeBuilder({ page }).analyze();
  const critical = results.violations.filter((violation) => violation.impact === "critical");

  expect(critical, critical.map((violation) => `${violation.id}: ${violation.help}`).join("\n")).toEqual([]);
});

test("workbench has no critical accessibility violations", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("rune-onboarding-v1", "complete"));
  await page.goto("/");
  await expect(page.getByRole("main")).toBeVisible();
  await expect(page.getByRole("button", { name: "New", exact: true }).first()).toBeEnabled();

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
  await page.getByRole("button", { name: "Create operating review", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Prepare a verifiable operating-review chain" });
  await expect(dialog).toBeVisible();

  const results = await new AxeBuilder({ page }).include('[role="dialog"]').analyze();
  const blocking = results.violations.filter(
    (violation) => violation.impact === "critical" || violation.impact === "serious",
  );

  expect(blocking, blocking.map((violation) => `${violation.id}: ${violation.help}`).join("\n")).toEqual([]);
});
