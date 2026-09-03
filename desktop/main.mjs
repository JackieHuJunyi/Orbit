import { app, BrowserWindow, dialog, ipcMain, safeStorage } from "electron";
import { randomBytes } from "node:crypto";
import { mkdir, readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { convertLegacyOffice, exportLegacyOffice } from "./legacy-office.mjs";
import { createDesktopModelDiscovery } from "./model-discovery.mjs";

const desktopDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectDirectory = path.resolve(desktopDirectory, "..");
const clientDirectory = path.join(projectDirectory, "dist/client");
const orbitAppIconPath = path.join(desktopDirectory, "orbit-app-icon.png");
const STATIC_CONTENT_TYPES = Object.freeze({
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".wasm": "application/wasm",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
});

// Keep the established on-device vault and Electron profile after the public
// rename. `safeStorage` is keyed to the application identity on macOS, so the
// legacy name must remain active until its encrypted master key is loaded.
// No window is created until the public Orbit identity is restored below.
const legacyRuneUserDataDirectory = path.join(app.getPath("appData"), "Rune");
app.setName("Rune");
app.setPath("userData", legacyRuneUserDataDirectory);
process.env.RUNE_DESKTOP_RUNTIME = "1";

async function initializeDesktopCredentialVault() {
  const configuredKey = process.env.RUNE_CREDENTIAL_ENCRYPTION_KEY?.trim();
  if (/^[a-f0-9]{64}$/.test(configuredKey ?? "")) return true;
  if (!safeStorage.isEncryptionAvailable()) return false;
  const userDataDirectory = app.getPath("userData");
  const encryptedPath = path.join(userDataDirectory, "credential-vault-key.bin");
  let key;
  try {
    key = safeStorage.decryptString(await readFile(encryptedPath));
  } catch (error) {
    if (error?.code !== "ENOENT") return false;
    key = randomBytes(32).toString("hex");
    await mkdir(userDataDirectory, { recursive: true, mode: 0o700 });
    const temporaryPath = `${encryptedPath}.${process.pid}.tmp`;
    try {
      await writeFile(temporaryPath, safeStorage.encryptString(key), { mode: 0o600, flag: "wx" });
      await rename(temporaryPath, encryptedPath);
    } finally {
      await rm(temporaryPath, { force: true });
    }
  }
  if (!/^[a-f0-9]{64}$/.test(key)) return false;
  process.env.RUNE_CREDENTIAL_ENCRYPTION_KEY = key;
  return true;
}

async function serveStaticAsset(request, response, url) {
  if (request.method !== "GET" && request.method !== "HEAD") return false;
  let decodedPath;
  try {
    decodedPath = decodeURIComponent(url.pathname);
  } catch {
    return false;
  }
  const assetPath = path.resolve(clientDirectory, `.${decodedPath}`);
  if (!assetPath.startsWith(`${clientDirectory}${path.sep}`)) return false;
  const metadata = await stat(assetPath).catch(() => undefined);
  if (!metadata?.isFile()) return false;
  const contentType = STATIC_CONTENT_TYPES[path.extname(assetPath).toLowerCase()] ?? "application/octet-stream";
  const immutable = decodedPath.startsWith("/assets/");
  response.writeHead(200, {
    "cache-control": immutable ? "public, max-age=31536000, immutable" : "no-cache",
    "content-length": metadata.size,
    "content-type": contentType,
    "x-content-type-options": "nosniff",
  });
  if (request.method === "HEAD") response.end();
  else response.end(await readFile(assetPath));
  return true;
}

async function startRuneServer() {
  const worker = (await import(pathToFileURL(path.join(projectDirectory, "dist/server/index.js")).href)).default;
  const server = createServer(async (request, response) => {
    try {
      const origin = `http://${request.headers.host}`;
      const url = new URL(request.url ?? "/", origin);
      if (await serveStaticAsset(request, response, url)) return;
      const body = request.method === "GET" || request.method === "HEAD" ? undefined : request;
      const webRequest = new Request(url, {
        method: request.method,
        headers: request.headers,
        body,
        duplex: body ? "half" : undefined,
      });
      const webResponse = await worker.fetch(webRequest, {}, { waitUntil() {}, passThroughOnException() {} });
      const responseHeaders = Object.fromEntries(webResponse.headers);
      responseHeaders["content-security-policy"] =
        "default-src 'self'; base-uri 'none'; connect-src 'self' https:; font-src 'self' data:; frame-ancestors 'none'; img-src 'self' data: blob: https:; object-src 'none'; script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval' https://cdn.jsdelivr.net; style-src 'self' 'unsafe-inline'; worker-src 'self' blob:";
      responseHeaders["x-content-type-options"] = "nosniff";
      response.writeHead(webResponse.status, responseHeaders);
      if (webResponse.body) for await (const chunk of webResponse.body) response.write(chunk);
      response.end();
    } catch (error) {
      console.error("Orbit Desktop request failed", error);
      if (response.headersSent) {
        response.destroy(error instanceof Error ? error : undefined);
        return;
      }
      response.writeHead(500, { "content-type": "text/plain;charset=utf-8" });
      response.end(error instanceof Error ? error.message : "Orbit Desktop server error");
    }
  });
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  if (!address || typeof address === "string")
    throw new Error("Orbit Desktop could not start its local workspace server.");
  return { server, url: `http://127.0.0.1:${address.port}` };
}

let runeServer;
let mainWindow;
let desktopModelDiscovery;

async function loadDesktopWorkspace(window, url) {
  let lastError;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      await window.loadURL(url);
      return;
    } catch (error) {
      lastError = error;
      if (window.isDestroyed() || attempt === 2) break;
      await new Promise((resolve) => setTimeout(resolve, 180 * (attempt + 1)));
    }
  }
  throw lastError instanceof Error ? lastError : new Error("Orbit Desktop could not load its local workspace.");
}

async function createRuneWindow() {
  if (!runeServer) runeServer = await startRuneServer();
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.show();
    mainWindow.focus();
    return;
  }
  const window = new BrowserWindow({
    width: 1480,
    height: 940,
    minWidth: 960,
    minHeight: 640,
    show: false,
    title: "Orbit",
    titleBarStyle: "hiddenInset",
    backgroundColor: "#f6f5f1",
    icon: orbitAppIconPath,
    webPreferences: {
      preload: path.join(desktopDirectory, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  mainWindow = window;
  window.center();
  window.show();
  window.focus();
  window.on("closed", () => {
    if (mainWindow === window) mainWindow = undefined;
  });
  window.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  window.webContents.on("will-navigate", (event, target) => {
    if (new URL(target).origin !== runeServer.url) event.preventDefault();
  });
  try {
    await loadDesktopWorkspace(window, runeServer.url);
    if (!window.isDestroyed()) {
      window.show();
    }
  } catch (error) {
    console.error("Orbit Desktop window failed to load", error);
    dialog.showErrorBox(
      "Orbit could not open",
      "The local workspace did not finish loading. Close Orbit and try again; your device files were not changed.",
    );
  }
}

app.whenReady().then(async () => {
  await initializeDesktopCredentialVault();
  app.setName("Orbit");
  if (process.platform === "darwin") {
    app.setActivationPolicy("regular");
    app.dock.setIcon(orbitAppIconPath);
  }
  desktopModelDiscovery = createDesktopModelDiscovery({ homeDirectory: app.getPath("home") });
  ipcMain.handle("rune:convert-legacy-office", convertLegacyOffice);
  ipcMain.handle("rune:export-legacy-office", exportLegacyOffice);
  ipcMain.handle("rune:discover-models", () => desktopModelDiscovery.scan());
  ipcMain.handle("rune:import-discovered-model", (_event, id) => desktopModelDiscovery.importCandidate(id));
  await createRuneWindow();
  app.on("activate", () => {
    void createRuneWindow();
  });
});

app.on("window-all-closed", () => {
  runeServer?.server?.close();
  if (process.platform !== "darwin") app.quit();
});
