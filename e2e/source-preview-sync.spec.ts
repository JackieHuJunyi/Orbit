import { expect, test, type Locator, type Page } from "@playwright/test";

async function openWorkbench(page: Page) {
  await page.addInitScript(() => localStorage.setItem("rune-onboarding-v1", "complete"));
  await page.goto("/");
  await expect(page.getByRole("main")).toBeVisible();
  await expect(page.getByRole("button", { name: "New", exact: true }).first()).toBeEnabled();
}

async function importTextSource(page: Page, file: { name: string; mimeType: string; source: string }) {
  await page
    .getByLabel("Import")
    .first()
    .setInputFiles({
      name: file.name,
      mimeType: file.mimeType,
      buffer: Buffer.from(file.source),
    });
  const review = page.getByRole("dialog", { name: "Review imported sources" });
  await expect(review).toBeVisible();
  await expect(review.getByText(file.name, { exact: true })).toBeVisible();
  await review.getByRole("button", { name: "Import 1 source" }).click();
  await expect(review).toBeHidden();
}

async function moveSourceCaret(editor: Locator, offset: number) {
  await editor.evaluate((element, nextOffset) => {
    const textarea = element as HTMLTextAreaElement;
    textarea.focus();
    textarea.setSelectionRange(nextOffset, nextOffset);
  }, offset);
  await editor.press("ArrowRight");
}

test("keeps long Markdown Source and Preview mutually positioned, including repeated moves inside one block", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await openWorkbench(page);
  const source = Array.from(
    { length: 48 },
    (_, index) =>
      `## Section ${String(index + 1).padStart(2, "0")}\n\nEvidence paragraph ${String(index + 1).padStart(2, "0")} keeps this source range distinct.`,
  ).join("\n\n");
  await importTextSource(page, { name: "long-review.md", mimeType: "text/markdown", source });

  const editor = page.locator("textarea.source-editor");
  const previewScroll = page.locator(".preview-scroll");
  const finalSectionButton = page
    .getByRole("navigation", { name: "Select or edit a document" })
    .getByRole("button", { name: "Select Section 48 in canonical source for Agent context" });
  await finalSectionButton.click();
  const finalSectionStart = source.indexOf("## Section 48");
  await expect
    .poll(() =>
      editor.evaluate((element) => {
        const textarea = element as HTMLTextAreaElement;
        return [textarea.selectionStart, textarea.selectionEnd];
      }),
    )
    .toEqual([finalSectionStart, source.length]);
  await expect.poll(() => editor.evaluate((element) => element.scrollTop)).toBeGreaterThan(0);

  const firstHeading = page
    .locator('.document-source-block[data-document-block-type="heading"]')
    .filter({ hasText: "Section 01" })
    .first();
  const firstSectionStart = source.indexOf("Section 01");
  await moveSourceCaret(editor, firstSectionStart + 1);
  await expect(firstHeading).toHaveClass(/active/);
  await expect(firstHeading).toBeInViewport();

  await previewScroll.evaluate((element) => element.scrollTo({ top: element.scrollHeight, behavior: "auto" }));
  await expect(firstHeading).not.toBeInViewport();
  await moveSourceCaret(editor, firstSectionStart + 2);
  await expect(firstHeading).toBeInViewport();
});

test("keeps long CSV Source and Preview mutually positioned down to an exact cell", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await openWorkbench(page);
  const source = [
    "Row,Label,Value",
    ...Array.from(
      { length: 80 },
      (_, index) => `${index + 1},Record-${String(index + 1).padStart(2, "0")},${(index + 1) * 10}`,
    ),
  ].join("\n");
  await importTextSource(page, { name: "long-table.csv", mimeType: "text/csv", source });

  const editor = page.locator("textarea.source-editor");
  const previewScroll = page.locator(".preview-scroll");
  const finalCellButton = page.getByRole("button", {
    name: "Select Row 80 · Label in canonical source for Agent context",
  });
  await finalCellButton.click();
  const finalValueStart = source.indexOf("Record-80");
  await expect
    .poll(() =>
      editor.evaluate((element) => {
        const textarea = element as HTMLTextAreaElement;
        return [textarea.selectionStart, textarea.selectionEnd];
      }),
    )
    .toEqual([finalValueStart, finalValueStart + "Record-80".length]);
  await expect.poll(() => editor.evaluate((element) => element.scrollTop)).toBeGreaterThan(0);

  const firstCell = page.locator("td.preview-data-cell").filter({ hasText: "Record-01" }).first();
  const firstValueStart = source.indexOf("Record-01");
  await moveSourceCaret(editor, firstValueStart + 1);
  await expect(firstCell).toHaveClass(/active/);
  await expect(firstCell).toBeInViewport();

  await previewScroll.evaluate((element) => element.scrollTo({ top: element.scrollHeight, behavior: "auto" }));
  await expect(firstCell).not.toBeInViewport();
  await moveSourceCaret(editor, firstValueStart + 2);
  await expect(firstCell).toBeInViewport();
});
