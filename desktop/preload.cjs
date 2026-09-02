// Electron's sandboxed preload loader executes CommonJS, so this narrow bridge cannot use ESM imports.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld(
  "runeDesktop",
  Object.freeze({
    convertLegacyOffice(input) {
      return ipcRenderer.invoke("rune:convert-legacy-office", input);
    },
    exportLegacyOffice(input) {
      return ipcRenderer.invoke("rune:export-legacy-office", input);
    },
    discoverModels() {
      return ipcRenderer.invoke("rune:discover-models");
    },
    importDiscoveredModel(id) {
      return ipcRenderer.invoke("rune:import-discovered-model", id);
    },
  }),
);
