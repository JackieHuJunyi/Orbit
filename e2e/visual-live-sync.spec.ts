import { expect, test } from "@playwright/test";
import { importTextSource, openWorkbench, selectWorkspaceFile } from "./helpers/workbench";

test("recompiles Document, Data, and semantic HTML Preview from each canonical Source edit", async ({ page }) => {
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await openWorkbench(page);

  const editor = page.locator("textarea.source-editor");
  const initialDocument = await editor.inputValue();
  const titleEnd = initialDocument.indexOf("\n");
  await editor.evaluate((element, offset) => {
    const textarea = element as HTMLTextAreaElement;
    textarea.focus();
    textarea.setSelectionRange(offset, offset);
  }, titleEnd);
  await editor.pressSequentially(" — live");
  await expect(editor).toBeFocused();
  await expect(editor).toHaveValue(/Q2 Business Review — live/u);
  await expect(page.locator(".document-paper .markdown-body")).toContainText("Q2 Business Review — live");

  await selectWorkspaceFile(page, "regional-revenue.csv");
  await editor.fill((await editor.inputValue()).replace("Europe,970000", "Europe,980000"));
  await expect(page.getByRole("textbox", { name: "Edit Row 3 · Q2 Revenue", exact: true })).toHaveValue("980000");

  await selectWorkspaceFile(page, "board-briefing.html");
  for (let slideIndex = 0; slideIndex < 4; slideIndex += 1) {
    await expect(
      page.frameLocator("iframe.slides-frame").nth(slideIndex).locator('[data-orbit-slide-text-editor="true"]').first(),
    ).toBeVisible();
  }
  const editableSlideText = async (slideIndex: number) =>
    page
      .frameLocator("iframe.slides-frame")
      .nth(slideIndex)
      .locator('[data-orbit-slide-text-editor="true"]')
      .allTextContents();
  expect(await editableSlideText(0)).toEqual(
    expect.arrayContaining([
      "Q2 · Board Briefing",
      "Growth became more durable.",
      "A shared story compiled from the same source as the operating data and written report.",
      "01 / 04",
    ]),
  );
  expect(await editableSlideText(1)).toEqual(
    expect.arrayContaining([
      "The quarter at a glance",
      "Momentum with healthier economics.",
      "Q2 revenue",
      "Quarter over quarter",
      "Gross margin",
      "02 / 04",
    ]),
  );
  expect(await editableSlideText(2)).toEqual(
    expect.arrayContaining([
      "Regional signal",
      "is now the growth engine.",
      "Partner distribution created a repeatable acquisition channel.",
      "03 / 04",
    ]),
  );
  expect(await editableSlideText(3)).toEqual(
    expect.arrayContaining([
      "Query-backed signal",
      "Margin varies by region.",
      "This chart is computed from readable DuckDB SQL, not copied into the deck.",
      "04 / 04",
    ]),
  );
  const boundSlideHeading = page
    .frameLocator("iframe.slides-frame")
    .nth(1)
    .locator('h1 [data-orbit-slide-text-editor="true"]');
  await boundSlideHeading.fill("Momentum with healthier economics, refined.");
  await editor.click();
  await expect(editor).toHaveValue(/Momentum with healthier economics, refined\./u);
  expect((await editor.inputValue()).match(/\{\{\s*metric/gu)?.length).toBe(4);
  const chartSlideHeading = page
    .frameLocator("iframe.slides-frame")
    .nth(3)
    .locator('h1 [data-orbit-slide-text-editor="true"]');
  await chartSlideHeading.fill("Margin by region, refined.");
  await editor.click();
  await expect(editor).toHaveValue(/Margin by region, refined\./u);
  expect((await editor.inputValue()).match(/\{\{\s*chart/gu)?.length).toBe(2);
  await editor.fill((await editor.inputValue()).replace("Growth became more durable.", "Growth is live from Source."));
  await expect(page.locator("iframe.slides-frame").first()).toHaveAttribute("srcdoc", /Growth is live from Source\./u);
  expect(pageErrors).toEqual([]);
});

test("edits ordinary Document text directly in Preview while mirroring complete Source", async ({ page }) => {
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await openWorkbench(page);

  const editor = page.locator("textarea.source-editor");
  const originalSource = await editor.inputValue();
  const headingBlock = page
    .locator('.document-source-block[data-document-block-type="heading"]')
    .filter({ hasText: "What changed" })
    .first();

  let inlineEditor = headingBlock.locator('[contenteditable="true"]');
  await expect(inlineEditor).toBeEditable();
  const restingBox = await inlineEditor.boundingBox();
  expect(restingBox).not.toBeNull();
  await inlineEditor.click();
  await inlineEditor.press("ControlOrMeta+A");
  await inlineEditor.pressSequentially("What changed today", { delay: 8 });
  await expect(inlineEditor).toBeFocused();
  await expect(editor).toHaveValue(/## What changed today/u);
  await expect(editor).toBeEditable();
  await expect(page.getByText("Visual edit · complete source draft synced live")).toHaveCount(0);
  const typingBox = await inlineEditor.boundingBox();
  expect(typingBox).not.toBeNull();
  expect(Math.abs((typingBox?.x ?? 0) - (restingBox?.x ?? 0))).toBeLessThanOrEqual(1);
  expect(Math.abs((typingBox?.width ?? 0) - (restingBox?.width ?? 0))).toBeLessThanOrEqual(1);
  expect(Math.abs((typingBox?.height ?? 0) - (restingBox?.height ?? 0))).toBeLessThanOrEqual(1);

  await inlineEditor.press("Escape");
  await expect(editor).toHaveValue(originalSource);
  await expect(headingBlock).toContainText("What changed");
  await expect(inlineEditor).not.toHaveAttribute("data-orbit-cancelled");

  inlineEditor = headingBlock.locator('[contenteditable="true"]');
  await inlineEditor.click();
  await inlineEditor.fill("What changed today");
  await expect(inlineEditor).toBeFocused();
  await editor.click();

  await expect(editor).toHaveValue(/## What changed today/u);
  await expect(editor).toBeEditable();
  await expect(editor).toBeFocused();
  await expect(inlineEditor).toBeVisible();
  await expect(page.locator(".document-paper .markdown-body")).toContainText("What changed today");

  inlineEditor = headingBlock.locator('[contenteditable="true"]');
  await inlineEditor.click();
  await inlineEditor.evaluate((element) => {
    element.dispatchEvent(new CompositionEvent("compositionstart", { bubbles: true, data: "中" }));
    element.textContent = "What changed today 中文输入";
    element.dispatchEvent(
      new InputEvent("input", {
        bubbles: true,
        data: "中文输入",
        inputType: "insertCompositionText",
        isComposing: true,
      }),
    );
  });
  await expect(editor).not.toHaveValue(/中文输入/u);
  await inlineEditor.evaluate((element) => {
    element.dispatchEvent(new CompositionEvent("compositionend", { bubbles: true, data: "中文输入" }));
  });
  await expect(editor).toHaveValue(/## What changed today 中文输入/u);
  await page.locator(".paper-meta").click();
  await expect(editor).toHaveValue(/## What changed today 中文输入/u);

  const metricParagraph = page
    .locator('.document-source-block[data-document-block-type="paragraph"]')
    .filter({ hasText: "Revenue reached" })
    .first();
  const metricEditor = metricParagraph.locator('[contenteditable="true"]');
  await expect(metricEditor).toBeEditable();
  await metricEditor.click();
  await expect(metricEditor.locator(".locked-binding")).toHaveCount(4);
  await metricEditor.evaluate((element) => {
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
    let node = walker.nextNode();
    while (node) {
      if (node.textContent?.includes("Revenue reached")) {
        node.textContent = node.textContent.replace("Revenue reached", "Verified revenue reached");
        break;
      }
      node = walker.nextNode();
    }
    element.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText" }));
  });
  await expect(editor).toHaveValue(/Verified revenue reached \*\*\{\{ metric/u);
  await metricEditor.press("Escape");

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
  const draft = page.getByRole("textbox", { name: "Edit Row 3 · Q2 Revenue", exact: true });
  await draft.fill("990000");

  await expect(editor).toHaveValue(/Europe,990000,920000,690000,84/u);
  await expect(editor).toBeEditable();
  await expect(draft).toHaveValue("990000");
  await expect(page.getByText("Visual edit · complete source draft synced live")).toHaveCount(0);

  await draft.press("Escape");
  await expect(editor).toHaveValue(originalSource);
  await expect(editor).toBeEditable();
  await expect(draft).toHaveValue("970000");

  await draft.fill("990000");
  await editor.click();

  await expect(editor).toHaveValue(/Europe,990000,920000,690000,84/u);
  await expect(editor).toBeEditable();
  await expect(page.getByRole("textbox", { name: "Edit Row 3 · Q2 Revenue", exact: true })).toHaveValue("990000");

  const region = page.getByRole("textbox", { name: "Edit Row 3 · Region", exact: true });
  await region.focus();
  await region.press("Tab");
  await expect(page.getByRole("textbox", { name: "Edit Row 3 · Q2 Revenue", exact: true })).toBeFocused();
  await region.focus();
  await region.evaluate((element) => {
    element.dispatchEvent(new CompositionEvent("compositionstart", { bubbles: true, data: "欧" }));
    (element as HTMLInputElement).value = "欧洲";
    element.dispatchEvent(
      new InputEvent("input", { bubbles: true, data: "欧洲", inputType: "insertCompositionText", isComposing: true }),
    );
  });
  await expect(editor).not.toHaveValue(/欧洲/u);
  await region.evaluate((element) =>
    element.dispatchEvent(new CompositionEvent("compositionend", { bubbles: true, data: "欧洲" })),
  );
  await expect(editor).toHaveValue(/"欧洲",990000/u);
  await region.press("Escape");
  await expect(editor).toHaveValue(/Europe,990000/u);
  expect(pageErrors).toEqual([]);
});

test("keeps typed JSON canonical while Source and Data Preview edit the same scalar", async ({ page }) => {
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await openWorkbench(page);
  const importedSource = JSON.stringify(
    [
      { Region: "North", Revenue: 120, Active: true, Note: null },
      { Region: "South", Revenue: 240, Active: false, Note: "review" },
    ],
    null,
    2,
  );
  await importTextSource(page, {
    name: "typed-regions.json",
    mimeType: "application/json",
    source: importedSource,
  });

  const editor = page.locator("textarea.source-editor");
  const sourceEdited = importedSource.replace('"Revenue": 240', '"Revenue": 260');
  await editor.fill(sourceEdited);
  await expect(page.getByRole("textbox", { name: "Edit Row 2 · Revenue", exact: true })).toHaveValue("260");

  const editRevenue = page.getByRole("textbox", { name: "Edit Row 2 · Revenue", exact: true });
  await editRevenue.fill("275");

  const revenueDraftSource = sourceEdited.replace('"Revenue": 260', '"Revenue": 275');
  await expect(editor).toHaveValue(revenueDraftSource);
  await expect(editor).toBeEditable();
  await expect(page.getByText("Visual edit · complete source draft synced live")).toHaveCount(0);

  await editRevenue.press("Escape");
  await expect(editor).toHaveValue(sourceEdited);
  await expect(editor).toBeEditable();

  await editRevenue.fill("275");
  await editor.click();
  await expect(editor).toHaveValue(revenueDraftSource);
  await expect(page.getByRole("textbox", { name: "Edit Row 2 · Revenue", exact: true })).toHaveValue("275");

  const editActive = page.getByRole("textbox", { name: "Edit Row 2 · Active", exact: true });
  await editActive.fill("true");
  const finalSource = revenueDraftSource.replace('"Active": false', '"Active": true');
  await expect(editor).toHaveValue(finalSource);
  await editor.click();
  await expect(editor).toHaveValue(finalSource);

  await page.reload();
  await expect(page.locator('main[data-orbit-hydrated="true"]')).toBeVisible();
  await expect(page.getByRole("main")).toBeVisible();
  await expect(page.locator("textarea.source-editor")).toHaveValue(finalSource);
  await expect(page.getByRole("textbox", { name: "Edit Row 2 · Revenue", exact: true })).toHaveValue("275");
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
  await expect(page.locator(".workspace")).toHaveClass(/view-split/u);
  await configure.click();
  await expect(page.locator(".workspace")).toHaveClass(/view-preview/u);

  const chartEditor = page.locator("form.visual-chart-editor");
  await expect(page.locator("section.source-pane")).toBeHidden();
  await expect(chartEditor).toBeVisible();
  const title = chartEditor.getByRole("textbox", { name: "Edit Chart title" });
  await title.fill("Q2 revenue, verified live");

  await expect(editor).toHaveValue(/"title": "Q2 revenue, verified live"/u);
  await expect(editor).not.toBeEditable();
  await expect(chartEditor.getByRole("region", { name: "Draft Chart preview" })).toContainText(
    "Q2 revenue, verified live",
  );
  await expect(page.getByText("Visual edit · complete source draft synced live")).toBeHidden();

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
