export const RUNE_ASSET_SCHEME = "rune-asset:sha256:";
export const MAX_RUNE_IMAGE_BYTES = 8 * 1_024 * 1_024;
export const MAX_RUNE_LOCAL_IMAGES = 40;
export const MAX_RUNE_LOCAL_IMAGE_BYTES = 64 * 1_024 * 1_024;
export const RUNE_IMAGE_ACCEPT = ".png,.jpg,.jpeg,.webp,.gif,image/png,image/jpeg,image/webp,image/gif";

export type RuneImageMimeType = "image/png" | "image/jpeg" | "image/webp" | "image/gif";

export type PreparedRuneImageAsset = {
  id: string;
  name: string;
  mimeType: RuneImageMimeType;
  size: number;
  bytes: Uint8Array;
};

export type RuneImageInsertion = {
  nextSource: string;
  markdown: string;
  start: number;
  end: number;
};

type RuneLocalAssetRecord = Omit<PreparedRuneImageAsset, "bytes"> & {
  blob: Blob;
  createdAt: string;
};

const DATABASE_NAME = "rune-local-assets-v1";
const DATABASE_VERSION = 1;
const IMAGE_STORE = "images";
const SHA256_ID = /^[0-9a-f]{64}$/u;

function startsWith(bytes: Uint8Array, signature: readonly number[]) {
  return signature.every((value, index) => bytes[index] === value);
}

export function detectRuneImageMimeType(bytes: Uint8Array): RuneImageMimeType | null {
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return "image/png";
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) return "image/jpeg";
  if (bytes.length >= 12
    && startsWith(bytes, [0x52, 0x49, 0x46, 0x46])
    && bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50) return "image/webp";
  if (startsWith(bytes, [0x47, 0x49, 0x46, 0x38, 0x37, 0x61])
    || startsWith(bytes, [0x47, 0x49, 0x46, 0x38, 0x39, 0x61])) return "image/gif";
  return null;
}

function normalizedAssetName(name: string) {
  const normalized = name.normalize("NFKC").replace(/[\u0000-\u001f\u007f]/gu, " ").trim();
  return (normalized || "image").slice(0, 180);
}

export function runeImageAltFromName(name: string) {
  const base = normalizedAssetName(name).replace(/\.(?:png|jpe?g|webp|gif)$/iu, "").trim() || "Image";
  return base.replace(/\s+/gu, " ").slice(0, 120);
}

function escapeMarkdownAlt(value: string) {
  return value.normalize("NFKC")
    .replace(/[\u0000-\u001f\u007f]/gu, " ")
    .replace(/\s+/gu, " ")
    .trim()
    .slice(0, 160)
    .replace(/\\/gu, "\\\\")
    .replace(/\[/gu, "\\[")
    .replace(/\]/gu, "\\]");
}

function validUtf16Boundary(value: string, offset: number) {
  if (!Number.isInteger(offset) || offset < 0 || offset > value.length) return false;
  if (offset === 0 || offset === value.length) return true;
  const previous = value.charCodeAt(offset - 1);
  const current = value.charCodeAt(offset);
  return !(previous >= 0xd800 && previous <= 0xdbff && current >= 0xdc00 && current <= 0xdfff);
}

export function createRuneAssetReference(id: string) {
  if (!SHA256_ID.test(id)) throw new Error("Rune asset identity must be one lowercase SHA-256 digest.");
  return `${RUNE_ASSET_SCHEME}${id}`;
}

export function parseRuneAssetReference(value: unknown): string | null {
  if (typeof value !== "string" || !value.startsWith(RUNE_ASSET_SCHEME)) return null;
  const id = value.slice(RUNE_ASSET_SCHEME.length);
  return SHA256_ID.test(id) ? id : null;
}

export function extractRuneAssetIds(source: string) {
  const ids: string[] = [];
  const seen = new Set<string>();
  const pattern = /rune-asset:sha256:([0-9a-f]{64})/gu;
  for (const match of source.matchAll(pattern)) {
    const id = match[1];
    if (!seen.has(id)) {
      seen.add(id);
      ids.push(id);
    }
  }
  return ids;
}

export function buildRuneImageInsertion(source: string, offset: number, alt: string, assetId: string): RuneImageInsertion {
  if (!validUtf16Boundary(source, offset)) throw new Error("The image insertion point is no longer valid.");
  const safeAlt = escapeMarkdownAlt(alt);
  if (!safeAlt) throw new Error("Describe the image before inserting it.");
  const markdown = `![${safeAlt}](${createRuneAssetReference(assetId)})`;
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

export async function prepareRuneImageAsset(name: string, claimedMimeType: string, input: ArrayBuffer): Promise<PreparedRuneImageAsset> {
  const bytes = new Uint8Array(input.slice(0));
  if (!bytes.length) throw new Error("The selected image is empty.");
  if (bytes.length > MAX_RUNE_IMAGE_BYTES) throw new Error(`Images are limited to ${MAX_RUNE_IMAGE_BYTES / 1_048_576} MB each.`);
  const mimeType = detectRuneImageMimeType(bytes);
  if (!mimeType) throw new Error("Choose a real PNG, JPEG, WebP, or GIF image.");
  if (claimedMimeType && claimedMimeType !== mimeType && !(claimedMimeType === "image/jpg" && mimeType === "image/jpeg")) {
    throw new Error("The image contents do not match its declared file type.");
  }
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  const id = [...new Uint8Array(digest)].map((value) => value.toString(16).padStart(2, "0")).join("");
  return { id, name: normalizedAssetName(name), mimeType, size: bytes.length, bytes };
}

function openAssetDatabase() {
  if (typeof indexedDB === "undefined") return Promise.reject(new Error("This browser cannot store local image assets."));
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(IMAGE_STORE)) request.result.createObjectStore(IMAGE_STORE, { keyPath: "id" });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Rune could not open its local image store."));
    request.onblocked = () => reject(new Error("Close other Rune tabs before updating the local image store."));
  });
}

export async function putRuneImageAsset(asset: PreparedRuneImageAsset) {
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
          const records = Array.isArray(all.result) ? all.result as RuneLocalAssetRecord[] : [];
          if (records.length >= MAX_RUNE_LOCAL_IMAGES) {
            policyError = new Error(`Rune stores at most ${MAX_RUNE_LOCAL_IMAGES} local images on one device.`);
            transaction.abort();
            return;
          }
          const currentBytes = records.reduce((total, record) => total + (Number.isFinite(record.size) ? record.size : 0), 0);
          if (currentBytes + asset.size > MAX_RUNE_LOCAL_IMAGE_BYTES) {
            policyError = new Error(`Rune local images are limited to ${MAX_RUNE_LOCAL_IMAGE_BYTES / 1_048_576} MB on one device.`);
            transaction.abort();
            return;
          }
          created = true;
          const record: RuneLocalAssetRecord = {
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
      transaction.onabort = () => reject(policyError ?? transaction.error ?? new Error("Rune could not store this image locally."));
      transaction.onerror = () => reject(transaction.error ?? new Error("Rune could not store this image locally."));
    });
  } finally {
    database.close();
  }
}

export async function getRuneImageAsset(id: string): Promise<PreparedRuneImageAsset | null> {
  if (!SHA256_ID.test(id)) return null;
  const database = await openAssetDatabase();
  try {
    const record = await new Promise<RuneLocalAssetRecord | null>((resolve, reject) => {
      const request = database.transaction(IMAGE_STORE, "readonly").objectStore(IMAGE_STORE).get(id);
      request.onsuccess = () => resolve(request.result?.blob instanceof Blob ? request.result as RuneLocalAssetRecord : null);
      request.onerror = () => reject(request.error ?? new Error("Rune could not read this local image."));
    });
    if (!record || !record.blob.size || record.blob.size > MAX_RUNE_IMAGE_BYTES) return null;
    const bytes = new Uint8Array(await record.blob.arrayBuffer());
    const mimeType = detectRuneImageMimeType(bytes);
    if (!mimeType) return null;
    const digest = await crypto.subtle.digest("SHA-256", bytes);
    const actualId = [...new Uint8Array(digest)].map((value) => value.toString(16).padStart(2, "0")).join("");
    if (actualId !== id || record.size !== bytes.length || record.mimeType !== mimeType) return null;
    return { id, name: normalizedAssetName(record.name), mimeType, size: bytes.length, bytes };
  } finally {
    database.close();
  }
}

export async function getRuneImageBlob(id: string) {
  const asset = await getRuneImageAsset(id);
  return asset ? new Blob([asset.bytes.buffer as ArrayBuffer], { type: asset.mimeType }) : null;
}

export async function deleteRuneImageAsset(id: string) {
  if (!SHA256_ID.test(id)) return;
  const database = await openAssetDatabase();
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(IMAGE_STORE, "readwrite");
      transaction.objectStore(IMAGE_STORE).delete(id);
      transaction.oncomplete = () => resolve();
      transaction.onabort = () => reject(transaction.error ?? new Error("Rune could not remove the local image."));
      transaction.onerror = () => reject(transaction.error ?? new Error("Rune could not remove the local image."));
    });
  } finally {
    database.close();
  }
}
