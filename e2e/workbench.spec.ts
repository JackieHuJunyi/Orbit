import { expect, test, type Page } from "@playwright/test";
import { PDFDocument } from "pdf-lib";

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

test("creates and renders a source-ordered area Chart", async ({ page }) => {
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await openWorkbench(page);
  await page.getByRole("button", { name: "New", exact: true }).first().click();
  const dialog = page.getByRole("dialog", { name: "Create a new artifact" });
  await dialog.getByRole("radio", { name: /Chart bound to Data or Query/ }).click();
  await dialog.getByRole("textbox", { name: "Title", exact: true }).fill("Revenue volume");
  await dialog.getByRole("combobox", { name: "Mark" }).selectOption("area");
  await expect(dialog.getByRole("region", { name: "New source preview" })).toContainText('"mark": "area"');
  await dialog.getByRole("button", { name: "Create source" }).click();

  await expect(dialog).toBeHidden();
  await expect(page.locator("aside.file-rail").getByText("revenue-volume.chart.json")).toBeVisible();
  await expect(page.locator(".chart-area-series")).toBeVisible();
  await expect(page.locator(".chart-line-point")).toHaveCount(4);
  expect(pageErrors).toEqual([]);
});

test("selects an on-device OCR region without writing the workspace", async ({ page }) => {
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await openWorkbench(page);
  const document = await PDFDocument.create();
  document.addPage([612, 792]);
  const bytes = await document.save({ useObjectStreams: false });
  await page
    .getByLabel("Import")
    .first()
    .setInputFiles({
      name: "regional-scan.pdf",
      mimeType: "application/pdf",
      buffer: Buffer.from(bytes),
    });

  const dialog = page.getByRole("dialog", { name: "Choose pages for OCR" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText("Whole page", { exact: true })).toBeVisible();
  await expect(dialog.locator(".pdf-ocr-region-surface")).toHaveCount(0);
  await dialog.getByRole("button", { name: "Preview and choose region" }).click();
  const surface = dialog.locator(".pdf-ocr-region-surface");
  await expect(surface).toBeVisible();
  const bounds = await surface.boundingBox();
  expect(bounds).not.toBeNull();
  await page.mouse.move(bounds!.x + bounds!.width * 0.15, bounds!.y + bounds!.height * 0.2);
  await page.mouse.down();
  await page.mouse.move(bounds!.x + bounds!.width * 0.8, bounds!.y + bounds!.height * 0.7);
  await page.mouse.up();

  await expect(dialog.getByRole("spinbutton", { name: "Left" })).toHaveValue("15");
  await expect(dialog.getByRole("spinbutton", { name: "Top" })).toHaveValue("20");
  await expect(dialog.getByRole("spinbutton", { name: "Width" })).toHaveValue("65");
  await expect(dialog.getByRole("spinbutton", { name: "Height" })).toHaveValue("50");
  await dialog.getByRole("spinbutton", { name: "Left" }).fill("10");
  await expect(dialog.getByRole("spinbutton", { name: "Left" })).toHaveValue("10");
  await dialog.getByRole("button", { name: "Reset to whole page" }).click();
  await expect(dialog.getByText("Whole page", { exact: true })).toBeVisible();
  await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(dialog).toBeHidden();
  expect(pageErrors).toEqual([]);
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

test("applies weekly and monthly operating-review presets without guessing the exact period", async ({ page }) => {
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await openWorkbench(page);
  await page.getByRole("button", { name: "Create operating review", exact: true }).click();

  const dialog = page.getByRole("dialog", { name: "Prepare a verifiable operating-review chain" });
  await expect(dialog).toBeVisible();
  const title = dialog.getByRole("textbox", { name: "Review title" });
  const period = dialog.getByRole("textbox", { name: "Reporting period" });
  const focus = dialog.getByRole("textbox", { name: "Review focus" });
  const audience = dialog.getByRole("combobox", { name: "Audience" });
  const report = dialog.getByRole("checkbox", { name: /Report/ });
  const slides = dialog.getByRole("checkbox", { name: /Slides/ });

  await dialog.getByRole("button", { name: /Weekly review/ }).click();
  expect(pageErrors).toEqual([]);
  await expect(dialog).toHaveAccessibleName("Prepare a verifiable operating-review chain");
  await expect(title).toHaveValue("Weekly operating review");
  await expect(period).toHaveValue("");
  await expect(focus).toHaveValue(
    "Identify the most material change since last week and assign the next decision or owner.",
  );
  await expect(audience).toHaveValue("team");
  await expect(report).toBeChecked();
  await expect(slides).not.toBeChecked();

  await dialog.getByRole("button", { name: /Monthly review/ }).click();
  await expect(title).toHaveValue("Monthly operating review");
  await expect(period).toHaveValue("");
  await expect(focus).toHaveValue(
    "Explain the largest movements this month and the decisions leadership should make next.",
  );
  await expect(audience).toHaveValue("leadership");
  await expect(report).toBeChecked();
  await expect(slides).toBeChecked();
});

test("builds multi-value, range, compound, and comparison scopes in the operating-review UI", async ({ page }) => {
  await openWorkbench(page);
  await page.getByRole("button", { name: "Create operating review", exact: true }).click();

  const dialog = page.getByRole("dialog", { name: "Prepare a verifiable operating-review chain" });
  await dialog.getByRole("button", { name: "Add condition" }).click();

  const primary = dialog.getByRole("group", { name: "Data scope" });
  await expect(primary.getByRole("combobox", { name: "Data scope" }).first()).toHaveValue("Region");
  await primary.getByRole("combobox", { name: "Scope filters" }).first().selectOption("oneOf");
  await primary.getByRole("listbox", { name: "Filter value" }).selectOption([{ label: "APAC" }, { label: "Europe" }]);

  await primary.getByRole("button", { name: "Add condition" }).click();
  await expect(primary.getByRole("combobox", { name: "Data scope" }).nth(1)).toHaveValue("Q2 Revenue");
  await primary.getByRole("combobox", { name: "Scope filters" }).nth(1).selectOption("numberRange");
  await primary.getByRole("spinbutton", { name: "From" }).fill("900000");
  await primary.getByRole("spinbutton", { name: "To" }).fill("1900000");

  await expect(dialog).toContainText("Region ∈ APAC, Europe");
  await expect(dialog).toContainText("Q2 Revenue = 900000…1900000");
  await dialog.getByRole("checkbox", { name: /Add comparison scope/ }).check();

  const comparison = dialog.getByRole("group", { name: "Compare with" });
  await expect(comparison).toBeVisible();
  await expect(comparison.getByRole("listbox", { name: "Filter value" }).locator("option:checked")).toHaveText(
    "North America",
  );
  await expect(comparison.getByRole("button", { name: "Add condition" })).toBeVisible();
});
