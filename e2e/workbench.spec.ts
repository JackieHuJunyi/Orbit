import { expect, test, type Page } from "@playwright/test";
import { PDFDocument } from "pdf-lib";

async function openWorkbench(page: Page) {
  // A fresh browser profile otherwise opens the full-screen onboarding modal,
  // which covers the workbench. Mark onboarding complete before first paint.
  await page.addInitScript(() => {
    if (window === window.top) localStorage.setItem("rune-onboarding-v1", "complete");
  });
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

test("writes the opening greeting through ordered spectrum-ink strokes", async ({ page }) => {
  await page.goto("/");

  const greeting = page.locator(".welcome-greeting");
  await expect(greeting).toBeVisible();
  await expect(greeting).toHaveAttribute("data-motion-script", "cursive");
  await expect(greeting).toHaveAttribute("data-motion-renderer", "calligraphic-mask");
  await expect(greeting).toHaveAttribute("data-ink-effect", "spectrum-sheen");
  await expect(greeting).toHaveAttribute("data-stroke-count", "3");
  await expect(greeting.locator(".welcome-greeting-spectrum stop")).toHaveCount(9);
  await expect(greeting.locator(".welcome-greeting-reveal-stroke")).toHaveCount(3);
  await expect(greeting.locator(".welcome-greeting-stroke-head")).toHaveCount(3);
  await expect(greeting.locator(".welcome-greeting-fill-reveal")).toBeVisible();

  const animationNames = await greeting.evaluate((element) =>
    Array.from(
      element.querySelectorAll(
        ".welcome-greeting-reveal-stroke, .welcome-greeting-fill-settled, .welcome-greeting-stroke-head, .welcome-greeting-stroke-head-ink",
      ),
    )
      .flatMap((unit) => unit.getAnimations())
      .map((animation) => ("animationName" in animation ? String(animation.animationName) : "")),
  );
  expect(animationNames).toContain("rune-greeting-write");
  expect(animationNames).toContain("rune-greeting-ink-settle");
  expect(animationNames).toContain("rune-greeting-stroke-head");
  expect(animationNames).toContain("rune-greeting-pressure");
  await expect(greeting.locator(".welcome-greeting-ink-sheen")).toHaveCSS("animation-name", "rune-greeting-sheen");
  for (const head of await greeting.locator(".welcome-greeting-stroke-head").all()) {
    await expect(head).toHaveCSS("offset-path", /path\(/);
  }
});

test("moves the Arabic writing head right to left without splitting its shaping run", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("rune-locale-v1", "ar"));
  await page.goto("/");

  const greeting = page.locator('.welcome-greeting[data-greeting-locale="ar"]');
  await expect(greeting).toBeVisible();
  await expect(greeting).toHaveAttribute("data-direction", "rtl");
  await expect(greeting).toHaveAttribute("data-motion-count", "5");
  await expect(greeting).toHaveAttribute("data-motion-script", "arabic");
  await expect(greeting).toHaveAttribute("data-stroke-count", "3");
  await expect(greeting.locator(".welcome-greeting-fill-reveal")).toHaveText("مرحبًا");
  await expect(greeting.locator(".welcome-greeting-stroke-head").first()).toHaveCSS("offset-path", /M 571\.4 148/);
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

test("keeps quick actions scrollable and renders an icon for every command", async ({ page }) => {
  await openWorkbench(page);
  await page.locator(".command-menu-trigger").click();

  const dialog = page.getByRole("dialog", { name: "Quick actions" });
  const results = dialog.locator(".command-menu-results");
  await expect(dialog).toBeVisible();
  await expect(dialog.locator(".command-menu-glyph > svg")).toHaveCount(14);
  const iconAlignment = await dialog.locator(".command-menu-glyph").evaluateAll((glyphs) =>
    glyphs.map((glyph) => {
      const icon = glyph.querySelector("svg");
      const glyphBounds = glyph.getBoundingClientRect();
      const iconBounds = icon?.getBoundingClientRect();
      return {
        width: glyphBounds.width,
        height: glyphBounds.height,
        centerDeltaX: iconBounds
          ? Math.abs(iconBounds.left + iconBounds.width / 2 - (glyphBounds.left + glyphBounds.width / 2))
          : Number.POSITIVE_INFINITY,
        centerDeltaY: iconBounds
          ? Math.abs(iconBounds.top + iconBounds.height / 2 - (glyphBounds.top + glyphBounds.height / 2))
          : Number.POSITIVE_INFINITY,
      };
    }),
  );
  expect(iconAlignment).toHaveLength(14);
  expect(
    iconAlignment.every(({ width, height }) => Math.abs(width - 28) < 0.5 && Math.abs(height - 28) < 0.5),
    JSON.stringify(iconAlignment),
  ).toBe(true);
  expect(
    iconAlignment.every(({ centerDeltaX, centerDeltaY }) => centerDeltaX < 0.5 && centerDeltaY < 0.5),
    JSON.stringify(iconAlignment),
  ).toBe(true);

  const dimensions = await results.evaluate((element) => ({
    clientHeight: element.clientHeight,
    scrollHeight: element.scrollHeight,
  }));
  expect(dimensions.scrollHeight).toBeGreaterThan(dimensions.clientHeight);

  await results.hover();
  await page.mouse.wheel(0, dimensions.scrollHeight);
  await expect.poll(() => results.evaluate((element) => element.scrollTop)).toBeGreaterThan(0);
  const bottomScroll = await results.evaluate((element) => element.scrollTop);

  await dialog.getByRole("combobox").press("Home");
  await expect.poll(() => results.evaluate((element) => element.scrollTop)).toBeLessThan(bottomScroll);
  await expect(dialog.getByRole("option").first()).toBeInViewport();
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

test("imports semantic HTML as continuous source-linked slides", async ({ page }) => {
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await openWorkbench(page);
  const firstBody = Array.from(
    { length: 36 },
    (_, index) => `      <p>Opening evidence line ${String(index + 1).padStart(2, "0")}</p>`,
  ).join("\n");
  const source = `<!doctype html>
<html lang="en">
<head><style>section { font-family: system-ui; }</style></head>
<body>
  <main class="deck">
    <section class="cover">
      <h1>Opening</h1>
${firstBody}
    </section>
    <section class="decision">
      <h2>Commit now</h2>
      <p>One action.</p>
    </section>
  </main>
</body>
</html>`;

  await page
    .getByLabel("Import")
    .first()
    .setInputFiles({ name: "semantic-brief.html", mimeType: "text/html", buffer: Buffer.from(source) });

  const review = page.getByRole("dialog", { name: "Review imported sources" });
  await expect(review).toBeVisible();
  await expect(review.getByText("semantic-brief.html", { exact: true })).toBeVisible();
  await review.getByRole("button", { name: "Import 1 source" }).click();
  await expect(review).toBeHidden();

  const flow = page.locator(".deck-slide-flow");
  await expect(flow).toHaveAttribute("aria-label", "Rendered presentation preview");
  await expect(flow.locator(".deck-slide-page")).toHaveCount(2);
  await expect(page.locator(".slide-target")).toHaveCount(2);
  const frames = flow.locator("iframe.slides-frame");
  await expect(frames).toHaveCount(2);
  expect(await frames.nth(0).getAttribute("srcdoc")).toContain("Opening");
  expect(await frames.nth(0).getAttribute("srcdoc")).not.toContain("Commit now");
  expect(await frames.nth(1).getAttribute("srcdoc")).toContain("Commit now");
  expect(await frames.nth(1).getAttribute("srcdoc")).not.toContain("Opening evidence");

  await page.getByRole("button", { name: "Export", exact: true }).click();
  const exportMenu = page.getByRole("menu", { name: "Choose a handoff format" });
  await expect(exportMenu.getByRole("menuitem").filter({ hasText: "PPTX" })).toBeVisible();
  await expect(exportMenu.getByRole("menuitem").filter({ hasText: "ODP" })).toBeVisible();
  await expect(exportMenu.getByRole("menuitem").filter({ hasText: "PDF" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(exportMenu).toBeHidden();

  const secondSectionStart = source.indexOf('<section class="decision">');
  const secondSectionEnd = source.indexOf("</section>", secondSectionStart) + "</section>".length;
  await flow.getByRole("button", { name: "Select Commit now in canonical source for Agent context" }).click();
  const editor = page.locator("textarea.source-editor");
  await expect
    .poll(() =>
      editor.evaluate((element) => {
        const textarea = element as HTMLTextAreaElement;
        return [textarea.selectionStart, textarea.selectionEnd];
      }),
    )
    .toEqual([secondSectionStart, secondSectionEnd]);
  await expect.poll(() => editor.evaluate((element) => element.scrollTop)).toBeGreaterThan(0);

  const firstSectionStart = source.indexOf('<section class="cover">');
  const firstSectionEnd = source.indexOf("</section>", firstSectionStart) + "</section>".length;
  await editor.evaluate((element, caret) => {
    const textarea = element as HTMLTextAreaElement;
    textarea.focus();
    textarea.setSelectionRange(caret, caret);
  }, firstSectionStart + 1);
  await editor.press("ArrowRight");
  await expect(flow.locator(".deck-slide-canvas").first()).toHaveClass(/active/);
  await expect(flow.locator(".deck-slide-page").first()).toBeInViewport();

  const editedFirstSection = `<section class="cover" data-layout="cover">
      <h1>Opening, refined</h1>
      <p>Directly edited in canonical semantic HTML.</p>
    </section>`;
  const editedSource = `${source.slice(0, firstSectionStart)}${editedFirstSection}${source.slice(firstSectionEnd)}`;
  await page.getByRole("button", { name: "Edit Opening", exact: true }).click();
  const htmlEditor = page.locator("form.semantic-html-slide-editor");
  await expect(htmlEditor).toBeVisible();
  const htmlDraft = htmlEditor.getByRole("textbox", { name: "Slide HTML · Opening" });
  await htmlDraft.fill(editedFirstSection);
  await expect(editor).toHaveValue(editedSource);
  await expect(editor).not.toBeEditable();
  await expect(htmlEditor.locator("iframe")).toHaveAttribute("srcdoc", /Opening, refined/u);
  await htmlEditor.getByRole("button", { name: "Save HTML slide" }).click();
  await expect(htmlEditor).toBeHidden();
  await expect(editor).toHaveValue(editedSource);
  await expect(flow.locator("iframe.slides-frame").first()).toHaveAttribute("srcdoc", /Opening, refined/u);

  await page.getByRole("button", { name: "Create an editable Deck Markdown presentation" }).click();
  const copyReview = page.getByRole("dialog", { name: "Review imported sources" });
  await expect(copyReview).toBeVisible();
  await expect(copyReview.getByText("semantic-brief.deck.md", { exact: true })).toBeVisible();
  await expect(copyReview).toContainText("original semantic HTML remains unchanged");
  await copyReview.getByRole("button", { name: "Create an editable Deck Markdown presentation" }).click();
  await expect(copyReview).toBeHidden();

  const fileRail = page.locator("aside.file-rail");
  await expect(fileRail.getByText("semantic-brief.html", { exact: true })).toBeVisible();
  await expect(fileRail.getByText("semantic-brief.deck.md", { exact: true })).toBeVisible();
  await expect(editor).toHaveValue(/version: 1/);
  await expect(page.locator(".slide-target-edit")).toHaveCount(2);

  await fileRail.getByText("semantic-brief.html", { exact: true }).click();
  await expect(editor).toHaveValue(editedSource);
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
