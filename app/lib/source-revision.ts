export const PORTABLE_SOURCE_REVISION_PATTERN = /^r1-[0-9a-z]{1,8}-[0-9a-f]{16}$/u;

// This stable token is a portable change detector, not a cryptographic identity
// or write-authority boundary. Rune still re-reads and validates complete current
// source before preparing or applying every mutation.
export function portableSourceRevision(source: string) {
  const bytes = new TextEncoder().encode(source);
  let hash = BigInt("14695981039346656037");
  const prime = BigInt("1099511628211");
  for (const byte of bytes) {
    hash ^= BigInt(byte);
    hash = BigInt.asUintN(64, hash * prime);
  }
  return `r1-${bytes.length.toString(36)}-${hash.toString(16).padStart(16, "0")}`;
}
