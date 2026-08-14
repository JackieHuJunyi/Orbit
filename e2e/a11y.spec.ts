import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

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
