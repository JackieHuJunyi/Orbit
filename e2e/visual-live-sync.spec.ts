import { expect, test, type Page } from "@playwright/test";

async function openWorkbench(page: Page) {
  await page.addInitScript(() => {
    if (window === window.top) localStorage.setItem("rune-onboarding-v1", "complete");
  });
  await page.goto("/");
  await expect(page.getByRole("main")).toBeVisible();
  await expect(page.getByRole("button", { name: "New", exact: true }).first()).toBeEnabled();
}

async function selectWorkspaceFile(page: Page, name: string) {
  await page.locator("aside.file-rail").getByText(name, { exact: true }).click();
}

test("recompiles Document, Data, and semantic HTML Preview from each canonical Source edit", async ({ page }) => {
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await openWorkbench(page);

  const editor = page.locator("textarea.source-editor");
  await editor.fill((await editor.inputValue()).replace("Q2 Business Review", "Q2 Business Review — live"));
  await expect(page.locator(".document-paper .markdown-body")).toContainText("Q2 Business Review — live");

  await selectWorkspaceFile(page, "regional-revenue.csv");
  await editor.fill((await editor.inputValue()).replace("Europe,970000", "Europe,980000"));
  await expect(page.locator("td.preview-data-cell").filter({ hasText: "980000" })).toBeVisible();

  await selectWorkspaceFile(page, "board-briefing.html");
  await editor.fill((await editor.inputValue()).replace("Growth became more durable.", "Growth is live from Source."));
  await expect(page.locator("iframe.slides-frame").first()).toHaveAttribute("srcdoc", /Growth is live from Source\./u);
  expect(pageErrors).toEqual([]);
});

test("mirrors a right-side Document draft into complete Source, then cancels or saves without divergence", async ({
  page,
}) => {
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await openWorkbench(page);

  const editor = page.locator("textarea.source-editor");
  const originalSource = await editor.inputValue();
  const editSection = page.getByRole("button", { name: "Edit Executive summary", exact: true });
  await editSection.click();

  const sectionEditor = page.locator("form.visual-document-editor");
  const draft = sectionEditor.getByRole("textbox", { name: "Edit Executive summary Markdown section" });
  const nextSection = (await draft.inputValue()).replace("Revenue reached", "Verified revenue reached");
  await draft.fill(nextSection);

  await expect(editor).toHaveValue(/Verified revenue reached/u);
  await expect(editor).not.toBeEditable();
  await expect(page.getByText("Visual edit · complete source draft synced live")).toBeVisible();
  await expect(sectionEditor.getByRole("region", { name: /Draft preview · Executive summary/ })).toContainText(
    "Verified revenue reached",
  );

  await sectionEditor.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(sectionEditor).toBeHidden();
  await expect(editor).toHaveValue(originalSource);
  await expect(editor).toBeEditable();

  await editSection.click();
  const savingDraft = sectionEditor.getByRole("textbox", { name: "Edit Executive summary Markdown section" });
  await savingDraft.fill((await savingDraft.inputValue()).replace("Revenue reached", "Verified revenue reached"));
  await sectionEditor.getByRole("button", { name: "Save section" }).click();

  await expect(sectionEditor).toBeHidden();
  await expect(editor).toHaveValue(/Verified revenue reached/u);
  await expect(editor).toBeEditable();
  await expect(page.locator(".document-paper .markdown-body")).toContainText("Verified revenue reached");
  expect(pageErrors).toEqual([]);
});

test("mirrors an exact Data-cell draft into complete Source, then cancels or saves without divergence", async ({
  page,
}) => {
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await openWorkbench(page);
  await selectWorkspaceFile(page, "regional-revenue.csv");

  const editor = page.locator("textarea.source-editor");
  const originalSource = await editor.inputValue();
  const editCell = page.getByRole("button", { name: "Edit Row 3 · Q2 Revenue", exact: true });
  await editCell.click();

  const cellEditor = page.locator("form.visual-cell-editor");
  const draft = cellEditor.getByRole("textbox", { name: "Edit Row 3 · Q2 Revenue" });
  await draft.fill("990000");

  await expect(editor).toHaveValue(/Europe,990000,920000,690000,84/u);
  await expect(editor).not.toBeEditable();
  await expect(draft).toHaveValue("990000");
  await expect(page.getByText("Visual edit · complete source draft synced live")).toBeVisible();

  await cellEditor.getByRole("button", { name: "Cancel cell edit" }).click();
  await expect(cellEditor).toBeHidden();
  await expect(editor).toHaveValue(originalSource);
  await expect(editor).toBeEditable();

  await editCell.click();
  await cellEditor.getByRole("textbox", { name: "Edit Row 3 · Q2 Revenue" }).fill("990000");
  await cellEditor.getByRole("button", { name: "Save Row 3 · Q2 Revenue" }).click();

  await expect(cellEditor).toBeHidden();
  await expect(editor).toHaveValue(/Europe,990000,920000,690000,84/u);
  await expect(editor).toBeEditable();
  await expect(page.locator("td.preview-data-cell").filter({ hasText: "990000" })).toBeVisible();
  expect(pageErrors).toEqual([]);
});

test("mirrors a right-side Chart configuration into complete Source and a live runtime draft", async ({ page }) => {
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await openWorkbench(page);
  await selectWorkspaceFile(page, "regional-revenue.chart.json");

  const editor = page.locator("textarea.source-editor");
  const originalSource = await editor.inputValue();
  const configure = page.getByRole("button", { name: "Configure", exact: true });
  await configure.click();

  const chartEditor = page.locator("form.visual-chart-editor");
  const title = chartEditor.getByRole("textbox", { name: "Edit Chart title" });
  await title.fill("Q2 revenue, verified live");

  await expect(editor).toHaveValue(/"title": "Q2 revenue, verified live"/u);
  await expect(editor).not.toBeEditable();
  await expect(chartEditor.getByRole("region", { name: "Draft Chart preview" })).toContainText(
    "Q2 revenue, verified live",
  );
  await expect(page.getByText("Visual edit · complete source draft synced live")).toBeVisible();

  await chartEditor.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(chartEditor).toBeHidden();
  await expect(editor).toHaveValue(originalSource);
  await expect(editor).toBeEditable();

  await configure.click();
  await chartEditor.getByRole("textbox", { name: "Edit Chart title" }).fill("Q2 revenue, verified live");
  await chartEditor.getByRole("button", { name: "Save Chart" }).click();

  await expect(chartEditor).toBeHidden();
  await expect(editor).toHaveValue(/"title": "Q2 revenue, verified live"/u);
  await expect(editor).toBeEditable();
  await expect(page.locator(".chart-stage")).toContainText("Q2 revenue, verified live");
  expect(pageErrors).toEqual([]);
});
