import { app, BrowserWindow, dialog, ipcMain, safeStorage } from "electron";
import { randomBytes } from "node:crypto";
import { mkdir, readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import { lookup } from "node:dns/promises";
import { BlockList, isIP } from "node:net";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { convertLegacyOffice, exportLegacyOffice } from "./legacy-office.mjs";
import { accountRuntimeToken, createDesktopAccountModelRuntime } from "./account-model-runtime.mjs";
import { createDesktopModelDiscovery } from "./model-discovery.mjs";

const desktopDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectDirectory = path.resolve(desktopDirectory, "..");
const clientDirectory = path.join(projectDirectory, "dist/client");
const orbitAppIconPath = path.join(desktopDirectory, "orbit-app-icon.png");
const ORBIT_DESKTOP_PORT = 43_719;
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

// Orbit owns one application, profile, and Keychain identity. Data created by
// the former pre-release product identity is left untouched and never opened.
// Testers therefore receive a clean profile and configure a model once.
app.setName("Orbit");
const requestedQaProfile = process.env.ORBIT_DESKTOP_QA_PROFILE?.trim() ?? "";
const allowedQaProfileRoot = `${tmpdir()}${path.sep}`;
const qaProfileDirectory =
  path.isAbsolute(requestedQaProfile) &&
  requestedQaProfile.startsWith(allowedQaProfileRoot) &&
  path.basename(requestedQaProfile).startsWith("orbit-")
    ? requestedQaProfile
    : "";
app.setPath("userData", qaProfileDirectory || path.join(app.getPath("appData"), "Orbit"));
process.env.ORBIT_DESKTOP_RUNTIME = "1";
const primaryDesktopInstance = app.requestSingleInstanceLock();

async function initializeDesktopCredentialVault() {
  const configuredKey = process.env.ORBIT_CREDENTIAL_ENCRYPTION_KEY?.trim();
  if (/^[a-f0-9]{64}$/.test(configuredKey ?? "")) return true;
  if (await isInternalQaBuild()) return initializeInternalQaCredentialVault();
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
  process.env.ORBIT_CREDENTIAL_ENCRYPTION_KEY = key;
  return true;
}

async function isInternalQaBuild() {
  if (!app.isPackaged) return false;
  try {
    const channel = JSON.parse(await readFile(path.join(desktopDirectory, "build-channel.json"), "utf8"));
    return channel?.channel === "internal-qa";
  } catch {
    return false;
  }
}

async function initializeInternalQaCredentialVault() {
  const userDataDirectory = app.getPath("userData");
  const keyPath = path.join(userDataDirectory, "credential-vault-key.internal-qa");
  let key;
  try {
    key = (await readFile(keyPath, "utf8")).trim();
  } catch (error) {
    if (error?.code !== "ENOENT") return false;
    key = randomBytes(32).toString("hex");
    await mkdir(userDataDirectory, { recursive: true, mode: 0o700 });
    const temporaryPath = `${keyPath}.${process.pid}.tmp`;
    try {
      await writeFile(temporaryPath, `${key}\n`, { mode: 0o600, flag: "wx" });
      await rename(temporaryPath, keyPath);
    } finally {
      await rm(temporaryPath, { force: true });
    }
  }
  if (!/^[a-f0-9]{64}$/.test(key)) return false;
  process.env.ORBIT_CREDENTIAL_ENCRYPTION_KEY = key;
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

async function startOrbitServer() {
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
      const accountResponse = await desktopAccountRuntime?.fetch(webRequest, url);
      if (accountResponse) {
        const accountHeaders = Object.fromEntries(accountResponse.headers);
        accountHeaders["cache-control"] = "no-store";
        accountHeaders["x-content-type-options"] = "nosniff";
        response.writeHead(accountResponse.status, accountHeaders);
        if (accountResponse.body) for await (const chunk of accountResponse.body) response.write(chunk);
        response.end();
        return;
      }
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
  const requestedQaPort = Number(process.env.ORBIT_DESKTOP_QA_PORT ?? ORBIT_DESKTOP_PORT);
  if (
    process.env.ORBIT_DESKTOP_QA_PORT &&
    (!Number.isSafeInteger(requestedQaPort) || requestedQaPort < 1_024 || requestedQaPort > 65_535)
  ) {
    throw new Error("ORBIT_DESKTOP_QA_PORT must be an integer from 1024 through 65535.");
  }
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(requestedQaPort, "127.0.0.1", resolve);
  });
  const address = server.address();
  if (!address || typeof address === "string")
    throw new Error("Orbit Desktop could not start its local workspace server.");
  const url = `http://127.0.0.1:${address.port}`;
  process.env.ORBIT_DESKTOP_ORIGIN = url;
  return { server, url };
}

let orbitServer;
let mainWindow;
let desktopModelDiscovery;
let desktopAccountRuntime;

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

async function waitForQaWorkspaceHydration(window) {
  for (let attempt = 0; attempt < 120; attempt += 1) {
    if (window.isDestroyed()) throw new Error("Orbit Desktop closed before the workspace hydrated.");
    const hydrated = await window.webContents
      .executeJavaScript('document.querySelector("main[data-orbit-hydrated=\\"true\\"]") !== null', true)
      .catch(() => false);
    if (hydrated) return;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error("Orbit Desktop did not hydrate its workspace within 30 seconds.");
}

function safePublicWebUrl(value) {
  if (typeof value !== "string" || value.length > 2_048) throw new Error("Enter a valid HTTPS page URL.");
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error("Enter a valid HTTPS page URL.");
  }
  const hostname = url.hostname.toLowerCase();
  if (
    url.protocol !== "https:" ||
    (url.port && url.port !== "443") ||
    url.username ||
    url.password ||
    !hostname.includes(".") ||
    /^(?:localhost|\d+(?:\.\d+){3}|\[[a-f0-9:]+\])$/iu.test(hostname) ||
    [".localhost", ".local", ".internal", ".home", ".lan"].some((suffix) => hostname.endsWith(suffix))
  ) {
    throw new Error("Web to PDF accepts only a public HTTPS page.");
  }
  return url.href;
}

const nonPublicWebAddresses = new BlockList();
for (const [address, prefix] of [
  ["0.0.0.0", 8],
  ["10.0.0.0", 8],
  ["100.64.0.0", 10],
  ["127.0.0.0", 8],
  ["169.254.0.0", 16],
  ["172.16.0.0", 12],
  ["192.0.0.0", 24],
  ["192.0.2.0", 24],
  ["192.168.0.0", 16],
  ["198.18.0.0", 15],
  ["198.51.100.0", 24],
  ["203.0.113.0", 24],
  ["224.0.0.0", 3],
]) {
  nonPublicWebAddresses.addSubnet(address, prefix, "ipv4");
}
for (const [address, prefix] of [
  ["::", 128],
  ["::1", 128],
  ["fc00::", 7],
  ["fe80::", 10],
  ["ff00::", 8],
  ["2001:db8::", 32],
]) {
  nonPublicWebAddresses.addSubnet(address, prefix, "ipv6");
}

function isPublicWebAddress(address, family) {
  const normalizedFamily = family === 6 || family === "IPv6" ? "ipv6" : "ipv4";
  if (!isIP(address)) return false;
  if (address.toLowerCase().startsWith("::ffff:")) {
    const mapped = address.slice(7);
    return isIP(mapped) === 4 && !nonPublicWebAddresses.check(mapped, "ipv4");
  }
  return !nonPublicWebAddresses.check(address, normalizedFamily);
}

async function validatePublicWebTarget(value) {
  const href = safePublicWebUrl(value);
  const hostname = new URL(href).hostname;
  const addresses = await Promise.race([
    lookup(hostname, { all: true, verbatim: true }),
    new Promise((_, reject) => setTimeout(() => reject(new Error("The web address lookup timed out.")), 5_000)),
  ]);
  if (!addresses.length || addresses.some(({ address, family }) => !isPublicWebAddress(address, family))) {
    throw new Error("Web to PDF cannot connect to a local, private, or reserved network address.");
  }
  return href;
}

async function renderPublicWebPageToPdf(_event, input) {
  const url = await validatePublicWebTarget(input?.url);
  const window = new BrowserWindow({
    show: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      partition: `orbit-web-pdf-${randomBytes(12).toString("hex")}`,
    },
  });
  window.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  const requestVerdicts = new Map();
  window.webContents.session.webRequest.onBeforeRequest((details, callback) => {
    let candidate;
    try {
      candidate = new URL(details.url);
    } catch {
      callback({ cancel: true });
      return;
    }
    if (candidate.protocol === "data:" || candidate.protocol === "blob:") {
      callback({ cancel: false });
      return;
    }
    const cacheKey = `${candidate.protocol}//${candidate.host}`;
    const verdict = requestVerdicts.get(cacheKey) ?? validatePublicWebTarget(candidate.href);
    requestVerdicts.set(cacheKey, verdict);
    void verdict.then(
      () => callback({ cancel: false }),
      () => callback({ cancel: true }),
    );
  });
  try {
    let loadTimer;
    try {
      const timeout = new Promise((_, reject) => {
        loadTimer = setTimeout(() => reject(new Error("The web page took too long to load.")), 20_000);
      });
      await Promise.race([window.loadURL(url), timeout]);
    } finally {
      clearTimeout(loadTimer);
    }
    const bytes = await window.webContents.printToPDF({
      printBackground: true,
      preferCSSPageSize: true,
      pageSize: "A4",
    });
    if (!bytes.length || bytes.length > 80 * 1024 * 1024) {
      throw new Error("The rendered PDF is outside Orbit's size limit.");
    }
    return {
      bytes: new Uint8Array(bytes),
      fileName: `${new URL(url).hostname.replace(/[^a-z0-9.-]/giu, "-")}.pdf`,
    };
  } finally {
    if (!window.isDestroyed()) window.destroy();
  }
}

async function createOrbitWindow() {
  if (!orbitServer) orbitServer = await startOrbitServer();
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
    const workspaceOrigin = new URL(orbitServer.url).origin;
    if (new URL(target).origin !== workspaceOrigin) event.preventDefault();
  });
  if (qaProfileDirectory) {
    window.webContents.on("did-fail-load", (_event, code, description) =>
      console.error(`[Orbit QA] window load failed ${code} ${description}`),
    );
  }
  try {
    await loadDesktopWorkspace(window, orbitServer.url);
    if (qaProfileDirectory) {
      await waitForQaWorkspaceHydration(window);
      console.error("[Orbit QA] renderer hydrated");
    }
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

if (!primaryDesktopInstance) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (mainWindow?.isMinimized()) mainWindow.restore();
    mainWindow?.show();
    mainWindow?.focus();
  });
  app.whenReady().then(async () => {
    const vaultReady = await initializeDesktopCredentialVault();
    if (process.platform === "darwin") {
      app.setActivationPolicy("regular");
      app.dock.setIcon(orbitAppIconPath);
    }
    const masterKey = process.env.ORBIT_CREDENTIAL_ENCRYPTION_KEY ?? "";
    desktopAccountRuntime = vaultReady
      ? createDesktopAccountModelRuntime({
          accountToken: accountRuntimeToken(masterKey),
          getOrigin: () => orbitServer?.url,
          homeDirectory: app.getPath("home"),
          appVersion: app.getVersion(),
        })
      : undefined;
    desktopModelDiscovery = createDesktopModelDiscovery({
      accountRuntime: desktopAccountRuntime,
      homeDirectory: app.getPath("home"),
      includeApiConnections: true,
    });
    ipcMain.handle("orbit:convert-legacy-office", convertLegacyOffice);
    ipcMain.handle("orbit:export-legacy-office", exportLegacyOffice);
    ipcMain.handle("orbit:discover-models", () => desktopModelDiscovery.scan());
    ipcMain.handle("orbit:import-discovered-model", (_event, id) => desktopModelDiscovery.importCandidate(id));
    ipcMain.handle("orbit:render-web-pdf", renderPublicWebPageToPdf);
    await createOrbitWindow();
    app.on("activate", () => {
      void createOrbitWindow();
    });
  });

  app.on("window-all-closed", () => {
    orbitServer?.server?.close();
    if (process.platform !== "darwin") app.quit();
  });
}
