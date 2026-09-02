export const MAX_LEGACY_OFFICE_IMPORT_BYTES = 12 * 1024 * 1024;
export const MAX_LEGACY_OFFICE_EXPORT_BYTES = 12 * 1024 * 1024;

export type LegacyOfficeConversion = {
  bytes: Uint8Array;
  fileName: string;
  warning: string;
};

export type DiscoveredModelConnection = {
  id: string;
  sourceKind: "environment" | "app-config" | "cc-switch" | "local-runtime";
  sourceLabel: string;
  locality: "cloud" | "device";
  provider: "openai" | "openrouter" | "deepseek" | "anthropic" | "gemini" | "ollama" | "lmstudio" | "custom";
  protocol: "responses" | "chat-completions" | "anthropic-messages" | "gemini-generate-content";
  name: string;
  baseURL: string;
  model: string;
  models: string[];
  credentialState: "detected" | "not-required";
};

export type DesktopModelDiscovery = {
  supported: true;
  candidates: DiscoveredModelConnection[];
};

export type DiscoveredModelProfile = Pick<
  DiscoveredModelConnection,
  "provider" | "protocol" | "name" | "baseURL" | "model"
> & { apiKey: string };

type RuneDesktopApi = {
  convertLegacyOffice(input: { bytes: Uint8Array; fileName: string }): Promise<{
    bytes: Uint8Array | ArrayBuffer | number[];
    fileName: string;
    warning: string;
  }>;
  exportLegacyOffice(input: { bytes: Uint8Array; fileName: string }): Promise<{
    bytes: Uint8Array | ArrayBuffer | number[];
    fileName: string;
    warning: string;
  }>;
  discoverModels(): Promise<unknown>;
  importDiscoveredModel(id: string): Promise<unknown>;
};

declare global {
  interface Window {
    runeDesktop?: RuneDesktopApi;
  }
}

export function legacyOfficeFileName(name: string) {
  return /\.(?:doc|ppt)$/i.test(name);
}

export function supportsLegacyOfficeDesktopConversion() {
  return typeof window !== "undefined" && typeof window.runeDesktop?.convertLegacyOffice === "function";
}

export function supportsLegacyOfficeDesktopExport() {
  return typeof window !== "undefined" && typeof window.runeDesktop?.exportLegacyOffice === "function";
}

export function supportsDesktopModelDiscovery() {
  return (
    typeof window !== "undefined" &&
    typeof window.runeDesktop?.discoverModels === "function" &&
    typeof window.runeDesktop?.importDiscoveredModel === "function"
  );
}

function modelProvider(value: unknown): DiscoveredModelConnection["provider"] | null {
  return value === "openai" ||
    value === "openrouter" ||
    value === "deepseek" ||
    value === "anthropic" ||
    value === "gemini" ||
    value === "ollama" ||
    value === "lmstudio" ||
    value === "custom"
    ? value
    : null;
}

function modelProtocol(value: unknown): DiscoveredModelConnection["protocol"] | null {
  return value === "responses" ||
    value === "chat-completions" ||
    value === "anthropic-messages" ||
    value === "gemini-generate-content"
    ? value
    : null;
}

function boundedBridgeText(value: unknown, maximum: number) {
  return typeof value === "string" && value.trim() && value.length <= maximum && !/[\u0000-\u001f\u007f]/u.test(value)
    ? value.trim()
    : "";
}

export async function discoverDesktopModelConnections(): Promise<DesktopModelDiscovery> {
  if (!supportsDesktopModelDiscovery()) return { supported: true, candidates: [] };
  const result = await window.runeDesktop!.discoverModels();
  if (!result || typeof result !== "object" || (result as { supported?: unknown }).supported !== true) {
    throw new Error("The Rune desktop bridge returned an invalid model discovery result.");
  }
  const rawCandidates = (result as { candidates?: unknown }).candidates;
  if (!Array.isArray(rawCandidates) || rawCandidates.length > 32) {
    throw new Error("The Rune desktop bridge returned too many model discovery results.");
  }
  const candidates = rawCandidates.flatMap((value) => {
    if (!value || typeof value !== "object" || "apiKey" in value || "credential" in value) return [];
    const item = value as Record<string, unknown>;
    const provider = modelProvider(item.provider);
    const protocol = modelProtocol(item.protocol);
    const id = boundedBridgeText(item.id, 80);
    const sourceLabel = boundedBridgeText(item.sourceLabel, 80);
    const name = boundedBridgeText(item.name, 60);
    const baseURL = boundedBridgeText(item.baseURL, 300);
    const model = boundedBridgeText(item.model, 120);
    const sourceKind = item.sourceKind;
    const locality = item.locality;
    const credentialState = item.credentialState;
    if (
      !id ||
      !sourceLabel ||
      !name ||
      !baseURL ||
      !model ||
      !provider ||
      !protocol ||
      (sourceKind !== "environment" &&
        sourceKind !== "app-config" &&
        sourceKind !== "cc-switch" &&
        sourceKind !== "local-runtime") ||
      (locality !== "cloud" && locality !== "device") ||
      (credentialState !== "detected" && credentialState !== "not-required")
    )
      return [];
    const models = Array.isArray(item.models)
      ? item.models
          .map((entry) => boundedBridgeText(entry, 120))
          .filter(Boolean)
          .slice(0, 80)
      : [];
    return [
      {
        id,
        sourceKind,
        sourceLabel,
        locality,
        provider,
        protocol,
        name,
        baseURL,
        model,
        models,
        credentialState,
      } as DiscoveredModelConnection,
    ];
  });
  return { supported: true, candidates };
}

export async function importDesktopModelConnection(id: string): Promise<DiscoveredModelProfile> {
  if (!supportsDesktopModelDiscovery()) throw new Error("Model discovery is available only in the Rune desktop app.");
  const result = await window.runeDesktop!.importDiscoveredModel(id);
  if (!result || typeof result !== "object") {
    throw new Error("The discovered model connection is invalid.");
  }
  const item = result as Record<string, unknown>;
  const provider = modelProvider(item.provider);
  const protocol = modelProtocol(item.protocol);
  const name = boundedBridgeText(item.name, 60);
  const baseURL = boundedBridgeText(item.baseURL, 300);
  const model = boundedBridgeText(item.model, 120);
  const apiKey = typeof item.apiKey === "string" && item.apiKey.length <= 512 ? item.apiKey.trim() : "";
  if (
    !provider ||
    !protocol ||
    !name ||
    !baseURL ||
    !model ||
    (provider !== "ollama" && provider !== "lmstudio" && !apiKey)
  ) {
    throw new Error("The discovered model connection is incomplete.");
  }
  return { provider, protocol, name, baseURL, model, apiKey };
}

function resultBytes(value: Uint8Array | ArrayBuffer | number[]) {
  return value instanceof Uint8Array
    ? value
    : value instanceof ArrayBuffer
      ? new Uint8Array(value)
      : Array.isArray(value)
        ? Uint8Array.from(value)
        : new Uint8Array();
}

export async function convertLegacyOfficeFile(file: File): Promise<LegacyOfficeConversion> {
  if (!legacyOfficeFileName(file.name)) throw new Error("Desktop legacy conversion supports .doc and .ppt files only.");
  if (!supportsLegacyOfficeDesktopConversion()) {
    throw new Error(
      "Legacy .doc/.ppt import requires the Rune desktop app with Microsoft Word or PowerPoint installed. The web app will not upload or guess this binary format.",
    );
  }
  if (!file.size) throw new Error(`${file.name}: the selected legacy Office file is empty.`);
  if (file.size > MAX_LEGACY_OFFICE_IMPORT_BYTES)
    throw new Error(`${file.name}: legacy Office import is limited to 12 MB.`);
  const inputBytes = new Uint8Array(await file.arrayBuffer());
  const result = await window.runeDesktop!.convertLegacyOffice({ fileName: file.name, bytes: inputBytes });
  if (!result || !/\.(?:docx|pptx)$/i.test(result.fileName) || typeof result.warning !== "string") {
    throw new Error("The Rune desktop bridge returned an invalid legacy Office conversion.");
  }
  const bytes = resultBytes(result.bytes);
  if (!bytes.length || bytes.length > MAX_LEGACY_OFFICE_IMPORT_BYTES) {
    throw new Error("The converted Office package is empty or exceeds Rune's 12 MB import limit.");
  }
  return { bytes, fileName: result.fileName, warning: result.warning };
}

export async function exportLegacyOfficeFile(input: {
  bytes: Uint8Array;
  fileName: string;
}): Promise<LegacyOfficeConversion> {
  if (!/^[^/\\\0]+\.(?:docx|pptx)$/i.test(input.fileName))
    throw new Error("Desktop legacy export supports DOCX and PPTX packages only.");
  if (!supportsLegacyOfficeDesktopExport()) {
    throw new Error(
      "Legacy DOC/PPT export requires the Rune desktop app with Microsoft Word or PowerPoint installed. The web app will not offer a fake legacy download.",
    );
  }
  if (!input.bytes.length || input.bytes.length > MAX_LEGACY_OFFICE_EXPORT_BYTES) {
    throw new Error("The modern Office package must be between 1 byte and 12 MB before legacy export.");
  }
  const result = await window.runeDesktop!.exportLegacyOffice({ fileName: input.fileName, bytes: input.bytes });
  const expectedExtension = /\.docx$/i.test(input.fileName) ? ".doc" : ".ppt";
  if (!result || !result.fileName.toLowerCase().endsWith(expectedExtension) || typeof result.warning !== "string") {
    throw new Error("The Rune desktop bridge returned an invalid legacy Office export.");
  }
  const bytes = resultBytes(result.bytes);
  if (!bytes.length || bytes.length > MAX_LEGACY_OFFICE_EXPORT_BYTES) {
    throw new Error("The converted legacy Office file is empty or exceeds Rune's 12 MB export limit.");
  }
  return { bytes, fileName: result.fileName, warning: result.warning };
}
