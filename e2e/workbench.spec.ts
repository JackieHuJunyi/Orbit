import { expect, test } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { PDFDocument } from "pdf-lib";
import { openWorkbench, selectWorkspaceFile } from "./helpers/workbench";

test("paints the handwritten first-run ritual before client JavaScript", async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const firstFrame = await context.newPage();
  await firstFrame.goto("/");

  const welcome = firstFrame.locator('.welcome-window[data-onboarding-sequence="spectrum-write-settle-setup"]');
  await expect(firstFrame.locator(".welcome-backdrop")).toHaveCSS("animation-name", "none");
  await expect(welcome).toBeVisible();
  await expect(welcome).toHaveAttribute("data-intro-phase", "writing");
  await expect(firstFrame.locator("[data-ambient-motion]")).toHaveCount(0);
  await expect(firstFrame.locator('.welcome-greeting[data-motion-renderer="vector-centerline"]')).toHaveAttribute(
    "aria-label",
    "Hello",
  );
  await expect(firstFrame.getByText("Preparing Rune…")).toHaveCount(0);
  expect(
    await firstFrame.evaluate(() =>
      Boolean(document.elementFromPoint(window.innerWidth / 2, window.innerHeight / 2)?.closest(".welcome-backdrop")),
    ),
  ).toBe(true);

  await context.close();
});

test("keeps a returning user on the server-rendered workbench before hydration", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("rune-onboarding-v1", "complete"));
  await page.route(/\.js(?:\?|$)/u, (route) => route.abort());
  await page.goto("/");

  await expect(page.locator(".welcome-backdrop")).toBeHidden();
  await expect(page.locator("header.topbar")).toBeVisible();
  await expect(page.locator("aside.file-rail").getByText("q2-review.md")).toBeVisible();
});

test("applies a saved appearance before hydration to prevent a light-theme flash", async ({ browser }) => {
  const context = await browser.newContext({
    storageState: {
      cookies: [],
      origins: [
        {
          origin: "http://localhost:3000",
          localStorage: [
            { name: "rune-onboarding-v1", value: "complete" },
            { name: "rune-appearance-theme-v1", value: "space-black" },
          ],
        },
      ],
    },
  });
  const firstFrame = await context.newPage();
  await firstFrame.route(/\.js(?:\?|$)/u, (route) => route.abort());
  await firstFrame.goto("/");

  await expect(firstFrame.locator("html")).toHaveAttribute("data-theme", "space-black");
  await expect(firstFrame.locator("body")).toHaveCSS("background-color", "rgb(0, 0, 0)");
  await context.close();
});

test("starts a fresh user with language choice before outcome-first task choices", async ({ page }) => {
  await page.goto("/");

  const onboarding = page.getByRole("dialog", { name: "Choose your Rune language" });
  await expect(onboarding).toBeVisible();
  await expect(onboarding.getByRole("radio")).toHaveCount(9);

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

test("loads model setup after the handwritten opening without restarting it", async ({ page }) => {
  await page.goto("/");

  const welcomeWindow = page.locator(".welcome-window");
  await expect(welcomeWindow).toHaveAttribute("data-intro-phase", "ready");
  await page.locator(".welcome-language-card > .welcome-primary").click();

  const modelStep = page.getByRole("dialog", { name: "Let Rune find the models you already use" });
  await expect(modelStep).toBeVisible();
  await expect(modelStep.getByText(/The web app cannot read application settings/u)).toBeVisible();
  await expect(modelStep.getByRole("button", { name: /Continue without a model/u })).toBeVisible();
  await expect(modelStep.getByText("No model connected", { exact: true })).toHaveCount(0);
  await expect(modelStep.getByText("Use connected model", { exact: true })).toHaveCount(0);
  await expect(modelStep.getByText("Use local mode only", { exact: true })).toHaveCount(0);
  await expect(page.locator('.welcome-greeting[data-motion-renderer="vector-centerline"]')).toHaveCount(0);
});

test("makes model-assisted and model-free continuation visibly distinct", async ({ page }) => {
  const connectedState = {
    vaultAvailable: true,
    configured: true,
    activeProfileId: null,
    activeSource: "deployment",
    activeProfile: null,
    profiles: [],
    failoverEnabled: false,
    deployment: {
      configured: true,
      provider: "openai",
      model: "gpt-5.6",
      budget: { maxInputTokens: 50_000, maxOutputTokens: 4_000 },
      capabilities: {
        protocol: "responses",
        structuredOutput: "json-schema",
        modelCatalog: true,
        tokenUsage: "provider-reported",
        maximumOutputTokens: 8_000,
      },
      health: { status: "unknown", checkedAt: null, retryAt: null },
    },
  };
  await page.route("**/api/model-status", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        configured: true,
        provider: "openai",
        model: "gpt-5.6",
        source: "deployment",
        profileName: "Deployment OpenAI",
        budget: { maxInputTokens: 50_000, maxOutputTokens: 4_000 },
        capabilities: {
          protocol: "responses",
          structuredOutput: "json-schema",
          modelCatalog: true,
          tokenUsage: "provider-reported",
          maximumOutputTokens: 8_000,
        },
        health: { status: "unknown", checkedAt: null, retryAt: null },
      }),
    }),
  );
  await page.route("**/api/model-profiles", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(connectedState) }),
  );
  await page.goto("/");
  await page.locator(".welcome-language-card > .welcome-primary").click();

  const modelStep = page.getByRole("dialog", { name: "Let Rune find the models you already use" });
  const assisted = modelStep.getByRole("button", { name: /Continue with model assistance/u });
  const withoutModel = modelStep.getByRole("button", { name: /Continue without a model/u });
  await expect(assisted).toContainText("confirm every change");
  await expect(withoutModel).toContainText("send nothing to a model service");
  await expect(modelStep.getByText("Deployment connection", { exact: false })).toBeVisible();
  await expect(assisted).toBeVisible();
  await expect(withoutModel).toBeVisible();
});

test("reveals a discovered credential only after review and saves only after verification", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, "runeDesktop", {
      configurable: false,
      value: {
        discoverModels: async () => ({
          supported: true,
          candidates: [
            {
              id: "candidate-1",
              sourceKind: "app-config",
              sourceLabel: "Claude Code",
              locality: "cloud",
              provider: "anthropic",
              protocol: "anthropic-messages",
              name: "Anthropic",
              baseURL: "https://api.anthropic.com/v1",
              model: "claude-sonnet-5",
              models: [],
              credentialState: "detected",
            },
          ],
        }),
        importDiscoveredModel: async () => {
          window.sessionStorage.setItem("rune-test-credential-read", "yes");
          return {
            provider: "anthropic",
            protocol: "anthropic-messages",
            name: "Anthropic",
            baseURL: "https://api.anthropic.com/v1",
            model: "claude-sonnet-5",
            apiKey: "discovery-test-secret",
          };
        },
      },
    });
  });
  const writes: Array<{ action?: string; apiKey?: string }> = [];
  const emptyState = {
    vaultAvailable: true,
    configured: false,
    activeProfileId: null,
    activeSource: null,
    activeProfile: null,
    profiles: [],
    failoverEnabled: false,
    deployment: {
      configured: false,
      provider: null,
      model: null,
      budget: null,
      capabilities: null,
      health: { status: "unknown", checkedAt: null, retryAt: null },
    },
  };
  await page.route("**/api/model-status", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ configured: false }) }),
  );
  let profileState: Record<string, unknown> = emptyState;
  await page.route("**/api/model-profiles", async (route) => {
    if (route.request().method() === "GET") {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(profileState) });
      return;
    }
    const input = route.request().postDataJSON() as { action?: string; profile?: { apiKey?: string } };
    writes.push({ action: input.action, apiKey: input.profile?.apiKey });
    if (input.action === "models") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ models: ["claude-sonnet-5"] }),
      });
      return;
    }
    profileState = {
      ...emptyState,
      configured: true,
      activeProfileId: "saved",
      activeSource: "personal",
      activeProfile: {
        id: "saved",
        provider: "anthropic",
        name: "Anthropic",
        model: "claude-sonnet-5",
        credentialConfigured: true,
      },
    };
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(profileState),
    });
  });

  await page.goto("/");
  await page.locator(".welcome-language-card > .welcome-primary").click();
  const modelStep = page.getByRole("dialog", { name: "Let Rune find the models you already use" });
  await expect(modelStep.getByText("Claude Code", { exact: false })).toBeVisible();
  await expect(modelStep).not.toContainText("discovery-test-secret");
  await expect.poll(() => page.evaluate(() => sessionStorage.getItem("rune-test-credential-read"))).toBeNull();

  await modelStep.getByRole("button", { name: "Review", exact: true }).click();
  await expect(modelStep.getByRole("heading", { name: "Use this model connection?" })).toBeFocused();
  await expect(modelStep.getByText("Model", { exact: true })).toBeVisible();
  await expect(modelStep.getByText("Endpoint", { exact: true })).toBeVisible();
  await expect(modelStep).not.toContainText("discovery-test-secret");

  await modelStep.getByRole("button", { name: "Verify & use" }).click();
  await expect.poll(() => page.evaluate(() => sessionStorage.getItem("rune-test-credential-read"))).toBe("yes");
  await expect.poll(() => writes.map((item) => item.action)).toEqual(["models", "upsert"]);
  expect(writes.every((item) => item.apiKey === "discovery-test-secret")).toBe(true);
  await expect(modelStep.getByRole("button", { name: /Continue with model assistance/u })).toBeVisible();
  await expect(modelStep).not.toContainText("discovery-test-secret");
});

test("reviews a CC Switch model import without navigating or persisting its credential", async ({ page }) => {
  const profileWrites: string[] = [];
  await page.route("**/api/model-profiles", async (route) => {
    if (route.request().method() !== "GET") {
      profileWrites.push(route.request().postData() ?? "");
      await route.fulfill({ status: 500, contentType: "application/json", body: '{"error":"Unexpected write"}' });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        vaultAvailable: true,
        configured: false,
        activeProfileId: null,
        activeSource: null,
        activeProfile: null,
        profiles: [],
        failoverEnabled: false,
        deployment: {
          configured: false,
          provider: null,
          model: null,
          budget: null,
          capabilities: null,
          health: { status: "unknown", checkedAt: null, retryAt: null },
        },
      }),
    });
  });
  await openWorkbench(page);
  await page.getByRole("button", { name: "More tools" }).click();
  await page.getByRole("menuitem", { name: /Model settings/u }).click();

  const dialog = page.getByRole("dialog", { name: "Let Rune find the models you already use" });
  await expect(dialog.getByRole("button", { name: "Import config", exact: true })).toBeVisible();
  await dialog.getByRole("button", { name: "Import config", exact: true }).click();
  await expect(dialog.locator(".model-status-card")).toBeHidden();
  await expect(dialog.locator(".model-mode-options")).toBeHidden();

  const credential = "secret-import-only-key";
  const link = `ccswitch://v1/import?resource=provider&app=codex&name=Personal%20OpenAI&endpoint=https%3A%2F%2Fapi.openai.com%2Fv1&apiKey=${credential}&model=gpt-5.6`;
  await dialog.getByRole("textbox", { name: "Paste config or CC Switch link" }).fill(link);
  await dialog.getByRole("button", { name: "Review config", exact: true }).click();

  await expect(dialog.getByText("Confirm imported configuration", { exact: true })).toBeVisible();
  await expect(dialog.getByText("CC Switch import link", { exact: true })).toBeVisible();
  await expect(dialog.getByText("Detected; never shown in preview", { exact: true })).toBeVisible();
  await expect(dialog.getByText(credential, { exact: true })).toHaveCount(0);
  await expect.poll(() => dialog.locator(".welcome-page").evaluate((node) => node.scrollTop)).toBe(0);
  await expect.poll(() => dialog.locator(".model-profile-manager").evaluate((node) => node.scrollTop)).toBe(0);
  expect(await dialog.locator(".model-profile-manager").evaluate((node) => node.scrollWidth - node.clientWidth)).toBe(
    0,
  );
  expect(page.url()).not.toContain("ccswitch");
  expect(profileWrites).toEqual([]);

  await dialog.getByRole("button", { name: "Use this configuration", exact: true }).click();
  const editor = dialog.locator("form.model-profile-editor");
  await expect(editor.getByRole("radio", { name: "OpenAI", exact: true })).toHaveAttribute("aria-checked", "true");
  await expect(editor.getByRole("textbox", { name: "Default model ID" })).toHaveValue("gpt-5.6");
  const keyInput = editor.getByRole("textbox", { name: /^API Key/u });
  await expect(keyInput).toHaveAttribute("type", "password");
  await expect(keyInput).toHaveValue(credential);
  expect(profileWrites).toEqual([]);
  expect(
    await page.evaluate((secret) => Object.values(localStorage).some((value) => value.includes(secret)), credential),
  ).toBe(false);

  await editor.locator("footer").getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(keyInput).toHaveCount(0);
});

test("moves backward and forward through every onboarding step without losing the flow", async ({ page }) => {
  await page.goto("/");

  const welcomeWindow = page.locator(".welcome-window");
  await expect(welcomeWindow).toHaveAttribute("data-intro-phase", "ready");
  await page.locator(".welcome-language-card > .welcome-primary").click();
  await expect(page.getByRole("dialog", { name: "Let Rune find the models you already use" })).toBeVisible();

  await welcomeWindow.getByRole("button", { name: "Back", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "Choose your Rune language" })).toBeVisible();
  await page.locator(".welcome-language-card > .welcome-primary").click();
  await welcomeWindow.getByRole("button", { name: /Continue without a model/u }).click();
  await expect(page.getByRole("dialog", { name: "Try four shortcuts yourself" })).toBeVisible();

  await welcomeWindow.getByRole("button", { name: "Back", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "Let Rune find the models you already use" })).toBeVisible();
  await welcomeWindow.getByRole("button", { name: /Continue without a model/u }).click();
  await welcomeWindow.getByRole("button", { name: "Learn later", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "Your workspace, under your control." })).toBeVisible();
  await welcomeWindow.getByRole("button", { name: "Back", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "Try four shortcuts yourself" })).toBeVisible();
});

test("writes the opening greeting as one restrained spectrum performance", async ({ page }) => {
  await page.goto("/");

  const welcomeWindow = page.locator(".welcome-window");
  const greeting = page.locator(".welcome-greeting");
  await expect(welcomeWindow).toHaveAttribute("data-onboarding-sequence", "spectrum-write-settle-setup");
  await expect(welcomeWindow).toHaveAttribute("data-intro-phase", "writing");
  await expect(welcomeWindow.locator(".welcome-chrome")).toBeHidden();
  await expect(page.locator(".welcome-backdrop")).toHaveCSS("background-color", "rgb(5, 5, 6)");
  await expect(greeting).toBeVisible();
  await expect(greeting).toHaveAttribute("data-motion-script", "cursive");
  await expect(greeting).toHaveAttribute("data-motion-renderer", "vector-centerline");
  await expect(greeting).toHaveAttribute("data-motion-timeline", "path-length-staggered");
  await expect(greeting).toHaveAttribute("data-ink-effect", "spectrum-write");
  await expect(greeting).toHaveAttribute("data-ink-material", "pressure-pencil-spectrum");
  await expect(greeting).toHaveAttribute("data-ink-motion", "path-reveal");
  await expect(greeting).toHaveAttribute("data-ink-trace", "progressive");
  await expect(greeting).toHaveAttribute("data-color-system", "apple-hello-spectrum");
  await expect(greeting).toHaveAttribute("data-boot-motion", "center-write-settle");
  await expect(greeting).toHaveAttribute("data-motion-sequence", "write-settle-reveal");
  await expect(greeting).toHaveAttribute("data-writing-continuity", "connected");
  await expect(greeting).toHaveAttribute("data-writing-style", "font-derived-centerline");
  await expect(greeting).toHaveAttribute("data-pen-speed", "reference");
  await expect(greeting).toHaveAttribute("data-stroke-count", "2");
  await expect(greeting.locator(".welcome-greeting-spectrum stop")).toHaveCount(9);
  await expect(greeting.locator(".welcome-greeting-vector-stroke")).toHaveCount(2);
  await expect(greeting.locator(".welcome-greeting-color-bloom, .welcome-greeting-stroke-head")).toHaveCount(0);
  await expect(greeting.locator("feTurbulence")).toHaveCount(1);
  await expect(greeting.locator(".welcome-greeting-vector-stroke").first()).toBeVisible();
  await expect(page.locator("[data-ambient-motion]")).toHaveCount(0);

  const openingGeometry = await page.locator(".welcome-greeting-stage").evaluate((stage) => {
    const bounds = stage.getBoundingClientRect();
    return {
      centerX: bounds.left + bounds.width / 2,
      centerY: bounds.top + bounds.height / 2,
      viewportCenterX: window.innerWidth / 2,
      viewportCenterY: window.innerHeight / 2,
    };
  });
  expect(Math.abs(openingGeometry.centerX - openingGeometry.viewportCenterX)).toBeLessThanOrEqual(2);
  expect(Math.abs(openingGeometry.centerY - openingGeometry.viewportCenterY)).toBeLessThanOrEqual(24);

  const animationNames = await greeting.evaluate((element) =>
    Array.from(element.querySelectorAll(".welcome-greeting-vector-stroke"))
      .flatMap((unit) => unit.getAnimations())
      .map((animation) => ("animationName" in animation ? String(animation.animationName) : "")),
  );
  expect(animationNames).toContain("rune-greeting-pencil-write");
  await expect(welcomeWindow).toHaveAttribute("data-intro-phase", "ready");
  await expect(welcomeWindow.locator(".welcome-chrome")).toBeVisible();
  await expect(page.locator('.welcome-intro-grid[data-intro-phase="ready"]')).toBeVisible();
});

test("reveals the Arabic writing path right to left without splitting its shaping run", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("rune-locale-v1", "ar"));
  await page.goto("/");

  const greeting = page.locator('.welcome-greeting[data-greeting-locale="ar"]');
  await expect(greeting).toBeVisible();
  await expect(greeting).toHaveAttribute("data-direction", "rtl");
  await expect(greeting).toHaveAttribute("data-motion-count", "5");
  await expect(greeting).toHaveAttribute("data-motion-script", "arabic");
  await expect(greeting).toHaveAttribute("data-motion-renderer", "tegaki-font-centerline");
  await expect(greeting).toHaveAttribute("data-stroke-count", "5");
  await expect(greeting).toHaveAttribute("data-font-ready", "true");
  await expect(greeting.locator('[data-tegaki="root"]')).toHaveAttribute("dir", "rtl");
  await expect(greeting.locator('[data-tegaki="overlay"]')).toHaveText("مرحبًا");
  await expect(greeting.locator('[data-tegaki="canvas"]')).toBeVisible();
});

test("renders the local-first workbench with its sample workspace", async ({ page }) => {
  await openWorkbench(page);
  await expect(page.getByRole("main")).toContainText("Rune");
  await expect(page.locator("aside.file-rail").getByText("q2-review.md")).toBeVisible();
  await expect(page.locator("aside.file-rail").getByText("board-briefing.html")).toBeVisible();
  await expect(page.locator("aside.file-rail").getByText("regional-revenue.csv")).toBeVisible();
  await expect(page.getByRole("button", { name: "More tools" })).toBeVisible();
});

test("reviews, cancels, and atomically persists a checkpoint restore", async ({ page }) => {
  await openWorkbench(page);
  const editor = page.locator("textarea.source-editor");
  const originalSource = await editor.inputValue();
  const versionTrigger = page.getByRole("button", { name: "Source and versions" });

  await versionTrigger.click();
  await page.getByRole("button", { name: "Save current", exact: true }).click();
  await versionTrigger.click();
  const changedSource = `${originalSource}\n\nTemporary restore review note.`;
  await editor.fill(changedSource);
  await expect(editor).toHaveValue(changedSource);
  await page.waitForTimeout(520);

  await versionTrigger.click();
  await page.getByRole("button", { name: "Restore", exact: true }).click();
  const review = page.getByRole("dialog", { name: "Review checkpoint restore" });
  await expect(review).toBeVisible();
  await expect(review.getByText("Reviewed baseline")).toHaveCount(0);
  await expect(review.getByText("Manual checkpoint", { exact: true })).toBeVisible();
  await expect(review.getByText(/Temporary restore review note/u)).toBeVisible();
  await expect(review.getByRole("button", { name: "Cancel", exact: true })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(review).toBeHidden();
  await expect(editor).toHaveValue(changedSource);

  await versionTrigger.click();
  await page.getByRole("button", { name: "Restore", exact: true }).click();
  await review.getByRole("button", { name: "Confirm restore", exact: true }).click();
  await expect(review).toBeHidden();
  await expect(editor).toHaveValue(originalSource);
  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem("rune-workspace-v0") ?? "{}"));
  expect(stored.artifacts.find((artifact: { id: string }) => artifact.id === "q2-review")?.source).toBe(originalSource);
  expect(
    stored.checkpoints["q2-review"].some((checkpoint: { source: string }) => checkpoint.source === changedSource),
  ).toBe(true);

  await page.reload();
  await expect(page.locator('main[data-rune-hydrated="true"]')).toBeVisible();
  await expect(editor).toHaveValue(originalSource);
});

test("reviews a sample reset, preserves the full workspace, and restores it after reload", async ({ page }) => {
  await openWorkbench(page);
  const editor = page.locator("textarea.source-editor");
  const originalSource = await editor.inputValue();
  const changedSource = `${originalSource}\n\nRecover this complete workspace after sample reset.`;
  await editor.fill(changedSource);
  await expect(editor).toHaveValue(changedSource);
  await page.waitForTimeout(520);

  const tools = page.getByRole("button", { name: "More tools" });
  await tools.click();
  await page.getByRole("menuitem", { name: /Restore sample workspace/u }).click();
  const sampleReview = page.getByRole("dialog", { name: "Restore the sample workspace?" });
  await expect(sampleReview).toBeVisible();
  await expect(
    sampleReview.getByText(/current workspace becomes one complete device recovery version/iu),
  ).toBeVisible();
  await expect(sampleReview.getByRole("button", { name: "Cancel", exact: true })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(sampleReview).toBeHidden();
  await expect(editor).toHaveValue(changedSource);
  expect(
    await page.evaluate(() => JSON.parse(localStorage.getItem("rune-workspace-v0") ?? "{}").resetRecovery),
  ).toBeUndefined();

  await tools.click();
  await page.getByRole("menuitem", { name: /Restore sample workspace/u }).click();
  await sampleReview.getByRole("button", { name: "Restore sample", exact: true }).click();
  await expect(sampleReview).toBeHidden();
  await expect(editor).toHaveValue(originalSource);
  let stored = await page.evaluate(() => JSON.parse(localStorage.getItem("rune-workspace-v0") ?? "{}"));
  expect(stored.resetRecovery.artifacts.find((artifact: { id: string }) => artifact.id === "q2-review")?.source).toBe(
    changedSource,
  );

  await page.reload();
  await expect(page.locator('main[data-rune-hydrated="true"]')).toBeVisible();
  await expect(editor).toHaveValue(originalSource);
  await tools.click();
  await page.getByRole("menuitem", { name: /Restore previous workspace/u }).click();
  const recoveryReview = page.getByRole("dialog", { name: "Restore the previous workspace?" });
  await expect(recoveryReview).toBeVisible();
  await expect(recoveryReview.getByText(/swap safely/iu)).toBeVisible();
  await recoveryReview.getByRole("button", { name: "Restore previous workspace", exact: true }).click();
  await expect(recoveryReview).toBeHidden();
  await expect(editor).toHaveValue(changedSource);
  stored = await page.evaluate(() => JSON.parse(localStorage.getItem("rune-workspace-v0") ?? "{}"));
  expect(stored.artifacts.find((artifact: { id: string }) => artifact.id === "q2-review")?.source).toBe(changedSource);
  expect(stored.resetRecovery.artifacts.find((artifact: { id: string }) => artifact.id === "q2-review")?.source).toBe(
    originalSource,
  );

  await page.reload();
  await expect(page.locator('main[data-rune-hydrated="true"]')).toBeVisible();
  await expect(editor).toHaveValue(changedSource);
});

test("reviews canonical source before downloading its exact UTF-8 bytes", async ({ page }) => {
  await openWorkbench(page);
  const editor = page.locator("textarea.source-editor");
  const canonicalSource = await editor.inputValue();
  let downloadCount = 0;
  page.on("download", () => {
    downloadCount += 1;
  });

  await page.getByRole("button", { name: "Export", exact: true }).click();
  await page.getByRole("menuitem").filter({ hasText: "Canonical source" }).click();
  const review = page.getByRole("dialog", { name: "Review canonical source" });
  await expect(review).toBeVisible();
  await expect(review.getByText(/exact UTF-8 source/u)).toBeVisible();
  await expect(review.getByText("q2-review.md", { exact: true }).first()).toBeVisible();
  await review.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(review).toBeHidden();
  expect(downloadCount).toBe(0);

  await page.getByRole("button", { name: "Export", exact: true }).click();
  await page.getByRole("menuitem").filter({ hasText: "Canonical source" }).click();
  await expect(review).toBeVisible();
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    review.getByRole("button", { name: "Download MD", exact: true }).click(),
  ]);
  expect(download.suggestedFilename()).toBe("q2-review.md");
  const downloadPath = await download.path();
  expect(downloadPath).not.toBeNull();
  expect(await readFile(downloadPath!, "utf8")).toBe(canonicalSource);
  await expect(review).toBeHidden();
  expect(downloadCount).toBe(1);
});

test("opens every registry-backed export choice with complete menu keyboard behavior", async ({ page }) => {
  await openWorkbench(page);
  const trigger = page.getByRole("button", { name: "Export", exact: true });
  const menu = page.getByRole("menu", { name: "Choose a handoff format" });

  await trigger.focus();
  await trigger.press("ArrowDown");
  const documentItems = menu.getByRole("menuitem");
  await expect(documentItems).toHaveCount(4);
  await expect(documentItems.nth(0)).toContainText("Canonical source");
  await expect(documentItems.nth(0)).toBeFocused();
  await page.keyboard.press("End");
  await expect(documentItems.nth(3)).toContainText("PDF");
  await expect(documentItems.nth(3)).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(menu).toBeHidden();
  await expect(trigger).toBeFocused();

  await selectWorkspaceFile(page, "regional-revenue.csv");
  await trigger.press("ArrowUp");
  const dataItems = menu.getByRole("menuitem");
  await expect(dataItems).toHaveCount(6);
  await expect(dataItems).toContainText(["Canonical source", "CSV", "JSON", "XLSX", "ODS", "PDF"]);
  await expect(dataItems.nth(5)).toBeFocused();
  await page.keyboard.press("Home");
  await expect(dataItems.nth(0)).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(trigger).toBeFocused();

  await selectWorkspaceFile(page, "q2-review.md");
  await trigger.press("ArrowDown");
  await expect(menu.getByRole("menuitem")).toHaveCount(4);
  await page.keyboard.press("End");
  await expect(menu.getByRole("menuitem").nth(3)).toBeFocused();
  await page.keyboard.press("Escape");

  await trigger.press("ArrowDown");
  await page.keyboard.press("Tab");
  await expect(menu).toBeHidden();
  await expect.poll(() => page.evaluate(() => document.activeElement?.closest(".export-menu") == null)).toBe(true);
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
  const trigger = page.getByRole("button", { name: "New", exact: true }).first();
  const dialog = page.getByRole("dialog", { name: "Create a new artifact" });
  for (let attempt = 0; attempt < 3; attempt += 1) {
    await trigger.click();
    await expect(dialog).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
  }
});

test("keeps one reviewed operation in control until it closes", async ({ page }) => {
  await openWorkbench(page);
  const newArtifact = page.getByRole("dialog", { name: "Create a new artifact" });
  const quickActions = page.getByRole("dialog", { name: "Quick actions" });

  await page.getByRole("button", { name: "New", exact: true }).first().click();
  await expect(newArtifact).toBeVisible();
  await page.keyboard.press("Control+Shift+P");
  await expect(newArtifact).toBeVisible();
  await expect(quickActions).toBeHidden();

  await page.keyboard.press("Escape");
  await expect(newArtifact).toBeHidden();
  await page.keyboard.press("Control+Shift+P");
  await expect(quickActions).toBeVisible();
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

test("creates semantic HTML as the readable default presentation source", async ({ page }) => {
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await openWorkbench(page);
  await page.getByRole("button", { name: "New", exact: true }).first().click();
  const dialog = page.getByRole("dialog", { name: "Create a new artifact" });
  await dialog.getByRole("radio", { name: /Presentation authored in semantic HTML/ }).click();
  await dialog.getByRole("textbox", { name: "Title", exact: true }).fill("Launch narrative");
  const preview = dialog.getByRole("region", { name: "New source preview" });
  await expect(preview).toContainText('data-rune-format="presentation-v1"');
  await expect(preview).toContainText('<section class="slide cover"');
  await dialog.getByRole("button", { name: "Create source" }).click();

  await expect(dialog).toBeHidden();
  await expect(page.locator("aside.file-rail").getByText("launch-narrative.html", { exact: true })).toBeVisible();
  const editor = page.locator("textarea.source-editor");
  await expect(editor).toHaveValue(/data-rune-title="Launch narrative"/u);
  await expect(editor).toHaveValue(/<span class="number">01 \/ 01<\/span>/u);
  await expect(page.locator(".deck-slide-page")).toHaveCount(1);

  await page.getByRole("button", { name: "Edit Launch narrative", exact: true }).click();
  const htmlEditor = page.locator("form.semantic-html-slide-editor");
  const htmlDraft = htmlEditor.getByRole("textbox", { name: "Slide HTML · Launch narrative" });
  const currentSection = await htmlDraft.inputValue();
  await htmlDraft.fill(currentSection.replace("Launch narrative", "Launch narrative refined"));
  await expect(editor).toHaveValue(/<h1>Launch narrative refined<\/h1>/u);
  await expect(editor).not.toBeEditable();
  await htmlEditor.getByRole("button", { name: "Save HTML slide" }).click();
  await expect(htmlEditor).toBeHidden();
  await expect(page.locator("iframe.slides-frame")).toHaveAttribute("srcdoc", /Launch narrative refined/u);
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

  const previewScroll = page.locator(".preview-scroll");
  await previewScroll.evaluate((element) => element.scrollTo({ top: element.scrollHeight, behavior: "auto" }));
  await expect(flow.locator(".deck-slide-page").first()).not.toBeInViewport({ ratio: 0.8 });
  await editor.evaluate((element, caret) => {
    const textarea = element as HTMLTextAreaElement;
    textarea.focus();
    textarea.setSelectionRange(caret, caret);
  }, firstSectionStart + 3);
  await editor.press("ArrowRight");
  await expect(flow.locator(".deck-slide-page").first()).toBeInViewport({ ratio: 0.8 });

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
  await expect(copyReview.getByText("semantic-brief-2.deck.md", { exact: true })).toBeVisible();
  await expect(copyReview).toContainText("original semantic HTML remains unchanged");
  await copyReview.getByRole("button", { name: "Create an editable Deck Markdown presentation" }).click();
  await expect(copyReview).toBeHidden();

  const fileRail = page.locator("aside.file-rail");
  await expect(fileRail.getByText("semantic-brief.html", { exact: true })).toBeVisible();
  await expect(fileRail.getByText("semantic-brief-2.deck.md", { exact: true })).toBeVisible();
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

test("owns complete keyboard focus in the bottom-left settings menu", async ({ page }) => {
  await openWorkbench(page);
  const trigger = page.getByRole("button", { name: "More tools" });
  const panel = page.getByRole("menu", { name: "Workspace tools" });
  const actions = panel.getByRole("menuitem");
  const themes = panel.getByRole("menuitemradio");

  await trigger.focus();
  await trigger.press("ArrowDown");
  await expect(panel).toBeVisible();
  await expect(actions).toHaveCount(5);
  await expect(themes).toHaveCount(12);
  await expect(actions.nth(0)).toBeFocused();
  await page.keyboard.press("ArrowDown");
  await expect(actions.nth(1)).toBeFocused();
  await page.keyboard.press("ArrowDown");
  await expect(actions.nth(2)).toBeDisabled();
  await expect(actions.nth(3)).toBeFocused();
  await page.keyboard.press("End");
  await expect(themes.nth(11)).toHaveAccessibleName("Space Black");
  await expect(themes.nth(11)).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "space-black");
  await expect(panel).toBeVisible();
  await page.keyboard.press("Home");
  await expect(actions.nth(0)).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(panel).toBeHidden();
  await expect(trigger).toBeFocused();

  await trigger.press("ArrowUp");
  await expect(themes.nth(11)).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(panel).toBeHidden();
  await expect.poll(() => page.evaluate(() => document.activeElement?.closest(".settings-popover") == null)).toBe(true);
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
