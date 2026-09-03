export const ORBIT_ASSET_SCHEME = "orbit-asset:sha256:";
export const MAX_ORBIT_IMAGE_BYTES = 8 * 1_024 * 1_024;
export const MAX_ORBIT_LOCAL_IMAGES = 40;
export const MAX_ORBIT_LOCAL_IMAGE_BYTES = 64 * 1_024 * 1_024;
export const ORBIT_IMAGE_ACCEPT = ".png,.jpg,.jpeg,.webp,.gif,image/png,image/jpeg,image/webp,image/gif";

export type OrbitImageMimeType = "image/png" | "image/jpeg" | "image/webp" | "image/gif";

export type PreparedOrbitImageAsset = {
  id: string;
  name: string;
  mimeType: OrbitImageMimeType;
  size: number;
  bytes: Uint8Array;
};

export type OrbitImageInsertion = {
  nextSource: string;
  markdown: string;
  start: number;
  end: number;
};

export type OrbitExportImageAsset = Pick<PreparedOrbitImageAsset, "id" | "name" | "mimeType" | "size" | "bytes">;

export type OrbitImageDimensions = { width: number; height: number };

type OrbitLocalAssetRecord = Omit<PreparedOrbitImageAsset, "bytes"> & {
  blob: Blob;
  createdAt: string;
};

const DATABASE_NAME = "orbit-local-assets-v1";
const DATABASE_VERSION = 1;
const IMAGE_STORE = "images";
const SHA256_ID = /^[0-9a-f]{64}$/u;

function startsWith(bytes: Uint8Array, signature: readonly number[]) {
  return signature.every((value, index) => bytes[index] === value);
}

export function detectOrbitImageMimeType(bytes: Uint8Array): OrbitImageMimeType | null {
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return "image/png";
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) return "image/jpeg";
  if (
    bytes.length >= 12 &&
    startsWith(bytes, [0x52, 0x49, 0x46, 0x46]) &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  )
    return "image/webp";
  if (
    startsWith(bytes, [0x47, 0x49, 0x46, 0x38, 0x37, 0x61]) ||
    startsWith(bytes, [0x47, 0x49, 0x46, 0x38, 0x39, 0x61])
  )
    return "image/gif";
  return null;
}

function normalizedAssetName(name: string) {
  const normalized = name
    .normalize("NFKC")
    .replace(/[\u0000-\u001f\u007f]/gu, " ")
    .trim();
  return (normalized || "image").slice(0, 180);
}

export function orbitImageAltFromName(name: string) {
  const base =
    normalizedAssetName(name)
      .replace(/\.(?:png|jpe?g|webp|gif)$/iu, "")
      .trim() || "Image";
  return base.replace(/\s+/gu, " ").slice(0, 120);
}

function escapeMarkdownAlt(value: string) {
  return value
    .normalize("NFKC")
    .replace(/[\u0000-\u001f\u007f]/gu, " ")
    .replace(/\s+/gu, " ")
    .trim()
    .slice(0, 160)
    .replace(/\\/gu, "\\\\")
    .replace(/\[/gu, "\\[")
    .replace(/\]/gu, "\\]");
}

function escapeHtmlAttribute(value: string) {
  return value
    .normalize("NFKC")
    .replace(/[\u0000-\u001f\u007f]/gu, " ")
    .replace(/\s+/gu, " ")
    .trim()
    .slice(0, 160)
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function validUtf16Boundary(value: string, offset: number) {
  if (!Number.isInteger(offset) || offset < 0 || offset > value.length) return false;
  if (offset === 0 || offset === value.length) return true;
  const previous = value.charCodeAt(offset - 1);
  const current = value.charCodeAt(offset);
  return !(previous >= 0xd800 && previous <= 0xdbff && current >= 0xdc00 && current <= 0xdfff);
}

export function createOrbitAssetReference(id: string) {
  if (!SHA256_ID.test(id)) throw new Error("Orbit asset identity must be one lowercase SHA-256 digest.");
  return `${ORBIT_ASSET_SCHEME}${id}`;
}

export function parseOrbitAssetReference(value: unknown): string | null {
  if (typeof value !== "string" || !value.startsWith(ORBIT_ASSET_SCHEME)) return null;
  const id = value.slice(ORBIT_ASSET_SCHEME.length);
  return SHA256_ID.test(id) ? id : null;
}

export function parseOrbitMarkdownImage(source: string) {
  const match = source.match(/^\s*!\[((?:\\.|[^\]])*)\]\(\s*(orbit-asset:sha256:[0-9a-f]{64})\s*\)\s*$/u);
  if (!match) return null;
  const id = parseOrbitAssetReference(match[2]);
  return id ? { id, alt: match[1].replace(/\\([\\`*_[\]{}#>+!~<>-])/gu, "$1").trim() } : null;
}

export function createOrbitHtmlImageMarkup(alt: string, assetId: string) {
  const safeAlt = escapeHtmlAttribute(alt);
  if (!safeAlt) throw new Error("Describe the image before inserting it.");
  return `<figure class="deck-image"><img src="${createOrbitAssetReference(assetId)}" alt="${safeAlt}" decoding="async" /></figure>`;
}

export function buildOrbitHtmlImageInsertion(
  source: string,
  offset: number,
  alt: string,
  assetId: string,
): OrbitImageInsertion {
  if (!validUtf16Boundary(source, offset)) throw new Error("The image insertion point is no longer valid.");
  const markdown = createOrbitHtmlImageMarkup(alt, assetId);
  const before = source.slice(0, offset);
  const after = source.slice(offset);
  const leading = before.length && !before.endsWith("\n") ? "\n" : "";
  const trailing = after.length && !after.startsWith("\n") ? "\n" : "";
  const start = before.length + leading.length;
  return {
    nextSource: `${before}${leading}${markdown}${trailing}${after}`,
    markdown,
    start,
    end: start + markdown.length,
  };
}

function safeOrbitImageRenderUrl(value: string | null) {
  if (!value) return null;
  return value.startsWith("blob:") || /^data:image\/(?:png|jpeg|webp|gif);base64,[a-z0-9+/=]+$/iu.test(value)
    ? value
    : null;
}

export function renderOrbitHtmlAssetReferences(
  source: string,
  resolveLocalAssetUrl?: (reference: string) => string | null,
) {
  if (!resolveLocalAssetUrl) return source;
  return source.replace(/<img\b[^>]*>/giu, (tag) => {
    const sourceAttribute = tag.match(/\bsrc\s*=\s*(["'])(orbit-asset:sha256:[0-9a-f]{64})\1/iu);
    if (!sourceAttribute) return tag;
    const reference = sourceAttribute[2];
    if (!parseOrbitAssetReference(reference)) return tag;
    const resolved = safeOrbitImageRenderUrl(resolveLocalAssetUrl(reference));
    if (!resolved) return tag;
    const escaped = resolved.replaceAll("&", "&amp;").replaceAll('"', "&quot;").replaceAll("<", "&lt;");
    return tag.replace(sourceAttribute[0], `src="${escaped}"`);
  });
}

export function extractOrbitAssetIds(source: string) {
  const ids: string[] = [];
  const seen = new Set<string>();
  const pattern = /orbit-asset:sha256:([0-9a-f]{64})/gu;
  for (const match of source.matchAll(pattern)) {
    const id = match[1];
    if (!seen.has(id)) {
      seen.add(id);
      ids.push(id);
    }
  }
  return ids;
}

export function orbitImageExtension(mimeType: OrbitImageMimeType) {
  return mimeType === "image/png"
    ? "png"
    : mimeType === "image/jpeg"
      ? "jpg"
      : mimeType === "image/webp"
        ? "webp"
        : "gif";
}

function uint16Le(bytes: Uint8Array, offset: number) {
  return bytes[offset] | (bytes[offset + 1] << 8);
}

function uint24Le(bytes: Uint8Array, offset: number) {
  return bytes[offset] | (bytes[offset + 1] << 8) | (bytes[offset + 2] << 16);
}

function uint32Be(bytes: Uint8Array, offset: number) {
  return (bytes[offset] * 0x1_000_000 + (bytes[offset + 1] << 16) + (bytes[offset + 2] << 8) + bytes[offset + 3]) >>> 0;
}

export function orbitImageDimensions(
  bytes: Uint8Array,
  mimeType = detectOrbitImageMimeType(bytes),
): OrbitImageDimensions | null {
  let dimensions: OrbitImageDimensions | null = null;
  if (mimeType === "image/png" && bytes.length >= 24) {
    dimensions = { width: uint32Be(bytes, 16), height: uint32Be(bytes, 20) };
  } else if (mimeType === "image/gif" && bytes.length >= 10) {
    dimensions = { width: uint16Le(bytes, 6), height: uint16Le(bytes, 8) };
  } else if (mimeType === "image/webp" && bytes.length >= 30) {
    const kind = String.fromCharCode(...bytes.slice(12, 16));
    if (kind === "VP8X") dimensions = { width: uint24Le(bytes, 24) + 1, height: uint24Le(bytes, 27) + 1 };
    else if (kind === "VP8L" && bytes[20] === 0x2f)
      dimensions = {
        width: 1 + bytes[21] + ((bytes[22] & 0x3f) << 8),
        height: 1 + (bytes[22] >> 6) + (bytes[23] << 2) + ((bytes[24] & 0x0f) << 10),
      };
    else if (kind === "VP8 " && bytes[23] === 0x9d && bytes[24] === 0x01 && bytes[25] === 0x2a)
      dimensions = {
        width: uint16Le(bytes, 26) & 0x3fff,
        height: uint16Le(bytes, 28) & 0x3fff,
      };
  } else if (mimeType === "image/jpeg") {
    let offset = 2;
    while (offset + 8 < bytes.length) {
      if (bytes[offset] !== 0xff) {
        offset += 1;
        continue;
      }
      const marker = bytes[offset + 1];
      if (marker === 0xda || marker === 0xd9) break;
      if (marker === 0x00 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
        offset += 2;
        continue;
      }
      const length = (bytes[offset + 2] << 8) | bytes[offset + 3];
      if (length < 2 || offset + 2 + length > bytes.length) break;
      if (
        [0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf].includes(marker) &&
        length >= 7
      ) {
        dimensions = {
          height: (bytes[offset + 5] << 8) | bytes[offset + 6],
          width: (bytes[offset + 7] << 8) | bytes[offset + 8],
        };
        break;
      }
      offset += 2 + length;
    }
  }
  return dimensions &&
    dimensions.width > 0 &&
    dimensions.height > 0 &&
    dimensions.width <= 32_768 &&
    dimensions.height <= 32_768
    ? dimensions
    : null;
}

export function orbitImageAssetMap(assets: readonly OrbitExportImageAsset[] = []) {
  const byId = new Map<string, OrbitExportImageAsset>();
  for (const asset of assets) {
    if (!SHA256_ID.test(asset.id)) throw new Error("Orbit export image identity must be one lowercase SHA-256 digest.");
    if (byId.has(asset.id)) throw new Error(`Orbit export image is duplicated: ${asset.id}`);
    const detected = detectOrbitImageMimeType(asset.bytes);
    if (
      !detected ||
      detected !== asset.mimeType ||
      !orbitImageDimensions(asset.bytes, detected) ||
      asset.size !== asset.bytes.length ||
      !asset.bytes.length ||
      asset.bytes.length > MAX_ORBIT_IMAGE_BYTES
    ) {
      throw new Error(`Orbit export image is invalid: ${asset.id}`);
    }
    byId.set(asset.id, asset);
  }
  return byId;
}

export function orbitImageDataUrl(asset: OrbitExportImageAsset) {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  let encoded = "";
  for (let index = 0; index < asset.bytes.length; index += 3) {
    const first = asset.bytes[index];
    const second = asset.bytes[index + 1];
    const third = asset.bytes[index + 2];
    const value = (first << 16) | ((second ?? 0) << 8) | (third ?? 0);
    encoded += alphabet[(value >>> 18) & 63];
    encoded += alphabet[(value >>> 12) & 63];
    encoded += second == null ? "=" : alphabet[(value >>> 6) & 63];
    encoded += third == null ? "=" : alphabet[value & 63];
  }
  return `data:${asset.mimeType};base64,${encoded}`;
}

export function buildOrbitImageInsertion(
  source: string,
  offset: number,
  alt: string,
  assetId: string,
): OrbitImageInsertion {
  if (!validUtf16Boundary(source, offset)) throw new Error("The image insertion point is no longer valid.");
  const safeAlt = escapeMarkdownAlt(alt);
  if (!safeAlt) throw new Error("Describe the image before inserting it.");
  const markdown = `![${safeAlt}](${createOrbitAssetReference(assetId)})`;
  const before = source.slice(0, offset);
  const after = source.slice(offset);
  const leading = before.length && !before.endsWith("\n\n") ? (before.endsWith("\n") ? "\n" : "\n\n") : "";
  const trailing = after.length && !after.startsWith("\n\n") ? (after.startsWith("\n") ? "\n" : "\n\n") : "";
  const start = before.length + leading.length;
  return {
    nextSource: `${before}${leading}${markdown}${trailing}${after}`,
    markdown,
    start,
    end: start + markdown.length,
  };
}

export async function prepareOrbitImageAsset(
  name: string,
  claimedMimeType: string,
  input: ArrayBuffer,
): Promise<PreparedOrbitImageAsset> {
  const bytes = new Uint8Array(input.slice(0));
  if (!bytes.length) throw new Error("The selected image is empty.");
  if (bytes.length > MAX_ORBIT_IMAGE_BYTES)
    throw new Error(`Images are limited to ${MAX_ORBIT_IMAGE_BYTES / 1_048_576} MB each.`);
  const mimeType = detectOrbitImageMimeType(bytes);
  if (!mimeType) throw new Error("Choose a real PNG, JPEG, WebP, or GIF image.");
  if (
    claimedMimeType &&
    claimedMimeType !== mimeType &&
    !(claimedMimeType === "image/jpg" && mimeType === "image/jpeg")
  ) {
    throw new Error("The image contents do not match its declared file type.");
  }
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  const id = [...new Uint8Array(digest)].map((value) => value.toString(16).padStart(2, "0")).join("");
  return { id, name: normalizedAssetName(name), mimeType, size: bytes.length, bytes };
}

function openAssetDatabase() {
  if (typeof indexedDB === "undefined")
    return Promise.reject(new Error("This browser cannot store local image assets."));
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(IMAGE_STORE))
        request.result.createObjectStore(IMAGE_STORE, { keyPath: "id" });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Orbit could not open its local image store."));
    request.onblocked = () => reject(new Error("Close other Orbit tabs before updating the local image store."));
  });
}

export async function putOrbitImageAsset(asset: PreparedOrbitImageAsset) {
  const database = await openAssetDatabase();
  try {
    return await new Promise<boolean>((resolve, reject) => {
      const transaction = database.transaction(IMAGE_STORE, "readwrite");
      const store = transaction.objectStore(IMAGE_STORE);
      let created = false;
      let policyError: Error | null = null;
      const lookup = store.get(asset.id);
      lookup.onsuccess = () => {
        if (lookup.result) return;
        const all = store.getAll();
        all.onsuccess = () => {
          const records = Array.isArray(all.result) ? (all.result as OrbitLocalAssetRecord[]) : [];
          if (records.length >= MAX_ORBIT_LOCAL_IMAGES) {
            policyError = new Error(`Orbit stores at most ${MAX_ORBIT_LOCAL_IMAGES} local images on one device.`);
            transaction.abort();
            return;
          }
          const currentBytes = records.reduce(
            (total, record) => total + (Number.isFinite(record.size) ? record.size : 0),
            0,
          );
          if (currentBytes + asset.size > MAX_ORBIT_LOCAL_IMAGE_BYTES) {
            policyError = new Error(
              `Orbit local images are limited to ${MAX_ORBIT_LOCAL_IMAGE_BYTES / 1_048_576} MB on one device.`,
            );
            transaction.abort();
            return;
          }
          created = true;
          const record: OrbitLocalAssetRecord = {
            id: asset.id,
            name: asset.name,
            mimeType: asset.mimeType,
            size: asset.size,
            blob: new Blob([asset.bytes.slice().buffer as ArrayBuffer], { type: asset.mimeType }),
            createdAt: new Date().toISOString(),
          };
          store.add(record);
        };
      };
      transaction.oncomplete = () => resolve(created);
      transaction.onabort = () =>
        reject(policyError ?? transaction.error ?? new Error("Orbit could not store this image locally."));
      transaction.onerror = () => reject(transaction.error ?? new Error("Orbit could not store this image locally."));
    });
  } finally {
    database.close();
  }
}

export async function getOrbitImageAsset(id: string): Promise<PreparedOrbitImageAsset | null> {
  if (!SHA256_ID.test(id)) return null;
  const database = await openAssetDatabase();
  try {
    const record = await new Promise<OrbitLocalAssetRecord | null>((resolve, reject) => {
      const request = database.transaction(IMAGE_STORE, "readonly").objectStore(IMAGE_STORE).get(id);
      request.onsuccess = () =>
        resolve(request.result?.blob instanceof Blob ? (request.result as OrbitLocalAssetRecord) : null);
      request.onerror = () => reject(request.error ?? new Error("Orbit could not read this local image."));
    });
    if (!record || !record.blob.size || record.blob.size > MAX_ORBIT_IMAGE_BYTES) return null;
    const bytes = new Uint8Array(await record.blob.arrayBuffer());
    const mimeType = detectOrbitImageMimeType(bytes);
    if (!mimeType) return null;
    const digest = await crypto.subtle.digest("SHA-256", bytes);
    const actualId = [...new Uint8Array(digest)].map((value) => value.toString(16).padStart(2, "0")).join("");
    if (actualId !== id || record.size !== bytes.length || record.mimeType !== mimeType) return null;
    return { id, name: normalizedAssetName(record.name), mimeType, size: bytes.length, bytes };
  } finally {
    database.close();
  }
}

export async function getOrbitImageBlob(id: string) {
  const asset = await getOrbitImageAsset(id);
  return asset ? new Blob([asset.bytes.buffer as ArrayBuffer], { type: asset.mimeType }) : null;
}

export async function deleteOrbitImageAsset(id: string) {
  if (!SHA256_ID.test(id)) return;
  const database = await openAssetDatabase();
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(IMAGE_STORE, "readwrite");
      transaction.objectStore(IMAGE_STORE).delete(id);
      transaction.oncomplete = () => resolve();
      transaction.onabort = () => reject(transaction.error ?? new Error("Orbit could not remove the local image."));
      transaction.onerror = () => reject(transaction.error ?? new Error("Orbit could not remove the local image."));
    });
  } finally {
    database.close();
  }
}
