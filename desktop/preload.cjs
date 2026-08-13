// Electron's sandboxed preload loader executes CommonJS, so this narrow bridge cannot use ESM imports.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("runeDesktop", Object.freeze({
  convertLegacyOffice(input) {
    return ipcRenderer.invoke("rune:convert-legacy-office", input);
  },
}));
