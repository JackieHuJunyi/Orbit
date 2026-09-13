import { expect, type Locator, type Page } from "@playwright/test";

export async function openWorkbench(page: Page) {
  await page.addInitScript(() => {
    if (window === window.top) localStorage.setItem("orbit-onboarding-v1", "complete");
  });
  await page.goto("/");
  await expect(page.getByRole("main")).toBeVisible();
  await expect(page.locator('main[data-orbit-hydrated="true"]')).toBeVisible();
  await expect(page.getByRole("button", { name: "New", exact: true }).first()).toBeEnabled();
}

export async function selectWorkspaceFile(page: Page, name: string) {
  await page.locator("aside.file-rail").getByText(name, { exact: true }).click();
  await expect(page.getByRole("textbox", { name: `Edit ${name} source` })).toBeVisible();
}

export async function importTextSource(page: Page, file: { name: string; mimeType: string; source: string }) {
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

export async function moveSourceCaret(editor: Locator, offset: number) {
  await editor.evaluate((element, nextOffset) => {
    const textarea = element as HTMLTextAreaElement;
    textarea.focus();
    textarea.setSelectionRange(nextOffset, nextOffset);
  }, offset);
  await editor.press("ArrowRight");
}
