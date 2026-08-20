import { expect, test } from "@playwright/test";
import { importTextSource, moveSourceCaret, openWorkbench } from "./helpers/workbench";

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

test("keeps long JSON Source and Preview mutually positioned down to a typed scalar", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await openWorkbench(page);
  const source = JSON.stringify(
    Array.from({ length: 80 }, (_, index) => ({
      Row: index + 1,
      Label: `Record-${String(index + 1).padStart(2, "0")}`,
      Value: (index + 1) * 10,
      Active: index % 2 === 0,
    })),
    null,
    2,
  );
  await importTextSource(page, { name: "long-table.json", mimeType: "application/json", source });

  const editor = page.locator("textarea.source-editor");
  const previewScroll = page.locator(".preview-scroll");
  const finalCellButton = page.getByRole("button", {
    name: "Select Row 80 · Label in canonical source for Agent context",
  });
  await finalCellButton.click();
  const finalValueStart = source.indexOf('"Record-80"');
  await expect
    .poll(() =>
      editor.evaluate((element) => {
        const textarea = element as HTMLTextAreaElement;
        return [textarea.selectionStart, textarea.selectionEnd];
      }),
    )
    .toEqual([finalValueStart, finalValueStart + '"Record-80"'.length]);
  await expect.poll(() => editor.evaluate((element) => element.scrollTop)).toBeGreaterThan(0);

  const firstCell = page.locator("td.preview-data-cell").filter({ hasText: "Record-01" }).first();
  const firstValueStart = source.indexOf('"Record-01"');
  await moveSourceCaret(editor, firstValueStart + 2);
  await expect(firstCell).toHaveClass(/active/);
  await expect(firstCell).toBeInViewport();

  await previewScroll.evaluate((element) => element.scrollTo({ top: element.scrollHeight, behavior: "auto" }));
  await expect(firstCell).not.toBeInViewport();
  await moveSourceCaret(editor, firstValueStart + 3);
  await expect(firstCell).toBeInViewport();
});
