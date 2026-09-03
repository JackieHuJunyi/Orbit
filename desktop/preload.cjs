// Electron's sandboxed preload loader executes CommonJS, so this narrow bridge cannot use ESM imports.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld(
  "orbitDesktop",
  Object.freeze({
    convertLegacyOffice(input) {
      return ipcRenderer.invoke("orbit:convert-legacy-office", input);
    },
    exportLegacyOffice(input) {
      return ipcRenderer.invoke("orbit:export-legacy-office", input);
    },
    discoverModels() {
      return ipcRenderer.invoke("orbit:discover-models");
    },
    importDiscoveredModel(id) {
      return ipcRenderer.invoke("orbit:import-discovered-model", id);
    },
  }),
);
