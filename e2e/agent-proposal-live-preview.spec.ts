import { expect, test, type Page } from "@playwright/test";

async function openLocalAgentWorkbench(page: Page) {
  await page.addInitScript(() => {
    if (window !== window.top) return;
    localStorage.setItem("rune-onboarding-v1", "complete");
    localStorage.setItem("rune-model-mode-v1", "local");
  });
  await page.goto("/");
  await expect(page.getByRole("main")).toBeVisible();
  await expect(page.getByRole("button", { name: "New", exact: true }).first()).toBeEnabled();
}

async function prepareSummaryProposal(page: Page) {
  const composer = page.getByRole("textbox", { name: "Describe an artifact change" });
  await composer.fill("Rewrite the executive summary as three points");
  await page.getByRole("button", { name: "Prepare change" }).click();
  await expect(page.locator(".patch-card")).toBeVisible();
}

test("renders a local Agent proposal in complete Source and Preview before Discard or atomic Apply", async ({
  page,
}) => {
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await openLocalAgentWorkbench(page);

  const editor = page.locator("textarea.source-editor");
  const originalSource = await editor.inputValue();
  const proposedText = "became the leading growth engine after the partner launch";

  await prepareSummaryProposal(page);
  await expect(editor).toHaveAttribute("aria-label", "Proposed source · q2-review.md");
  await expect(editor).not.toBeEditable();
  await expect(editor).toHaveValue(new RegExp(proposedText, "u"));
  await expect(editor).toHaveValue(/- Revenue reached/u);
  await expect(page.getByRole("region", { name: "Compiled artifact preview · Proposal preview" })).toContainText(
    proposedText,
  );
  await expect(page.getByText("Proposed output · nothing written")).toBeVisible();
  await expect(page.getByText("Canonical source stays unchanged until Apply")).toBeVisible();
  const persistedBeforeApply = await page.evaluate(() => {
    const stored = localStorage.getItem("rune-workspace-v0");
    if (!stored) return null;
    const parsed = JSON.parse(stored) as { artifacts?: Array<{ id?: string; source?: string }> };
    return parsed.artifacts?.find((artifact) => artifact.id === "q2-review")?.source ?? null;
  });
  expect([null, originalSource]).toContain(persistedBeforeApply);

  await page.getByRole("button", { name: "Discard proposed patch" }).click();
  await expect(page.locator(".patch-card")).toBeHidden();
  await expect(editor).toHaveValue(originalSource);
  await expect(editor).toBeEditable();
  await expect(page.locator(".document-paper .markdown-body")).not.toContainText(proposedText);

  await prepareSummaryProposal(page);
  const reviewedSource = await editor.inputValue();
  expect(reviewedSource).not.toBe(originalSource);
  await page.locator(".patch-card").getByRole("button", { name: "Apply", exact: true }).click();

  await expect(page.locator(".patch-card")).toBeHidden();
  await expect(editor).toHaveValue(reviewedSource);
  await expect(editor).toBeEditable();
  await expect(page.locator(".document-paper .markdown-body")).toContainText(proposedText);

  await page.reload();
  await expect(page.getByRole("main")).toBeVisible();
  await expect(page.getByRole("button", { name: "New", exact: true }).first()).toBeEnabled();
  await expect(editor).toHaveValue(reviewedSource);
  await expect(page.locator(".document-paper .markdown-body")).toContainText(proposedText);
  expect(pageErrors).toEqual([]);
});

test("switches one multi-artifact Agent proposal between a coherent report and presentation snapshot", async ({
  page,
}) => {
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await openLocalAgentWorkbench(page);

  const editor = page.locator("textarea.source-editor");
  const originalReport = await editor.inputValue();
  const scope = page.getByRole("group", { name: "Agent change scope" });
  await scope.getByRole("button", { name: "Workspace", exact: true }).click();
  await page
    .getByRole("textbox", { name: "Describe a workspace change" })
    .fill("Synchronize the workspace quarterly conclusion across the report and presentation");
  await page.getByRole("button", { name: "Prepare change" }).click();

  const patch = page.locator(".patch-card");
  await expect(patch).toBeVisible();
  await expect(patch.locator(".patch-file-row")).toHaveCount(2);
  await expect(editor).toHaveAttribute("aria-label", "Proposed source · q2-review.md");
  await expect(page.locator(".document-paper .markdown-body")).toContainText(
    "became the leading growth engine after the partner launch",
  );

  await patch.getByRole("button", { name: "Review board-briefing.html", exact: true }).click();
  await expect(editor).toHaveAttribute("aria-label", "Proposed source · board-briefing.html");
  await expect(editor).toHaveValue(/Scale the repeatable channel, protect the margin\./u);
  await expect(page.locator(".deck-slide-page")).toHaveCount(5);
  await expect(page.locator("iframe.slides-frame").last()).toHaveAttribute(
    "srcdoc",
    /Scale the repeatable channel, protect the margin\./u,
  );

  const persistedBeforeApply = await page.evaluate(() => {
    const stored = localStorage.getItem("rune-workspace-v0");
    if (!stored) return null;
    const parsed = JSON.parse(stored) as { artifacts?: Array<{ id?: string; source?: string }> };
    return {
      report: parsed.artifacts?.find((artifact) => artifact.id === "q2-review")?.source ?? null,
      slides: parsed.artifacts?.find((artifact) => artifact.id === "board-briefing")?.source ?? null,
    };
  });
  if (persistedBeforeApply) {
    expect(persistedBeforeApply.report).toBe(originalReport);
    expect(persistedBeforeApply.slides).not.toContain("Scale the repeatable channel, protect the margin.");
  }

  await patch.getByRole("button", { name: "Discard proposed patch" }).click();
  await expect(patch).toBeHidden();
  await expect(editor).toHaveValue(originalReport);
  await page.locator("aside.file-rail").getByText("board-briefing.html", { exact: true }).click();
  await expect(page.locator(".deck-slide-page")).toHaveCount(4);
  await expect(editor).not.toHaveValue(/Scale the repeatable channel, protect the margin\./u);
  expect(pageErrors).toEqual([]);
});
