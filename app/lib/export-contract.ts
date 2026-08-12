export type ArtifactExportKind = "docx" | "xlsx" | "pptx" | "odt" | "ods" | "odp" | "html" | "pdf";

export type ArtifactExportResult<Target extends ArtifactExportKind = ArtifactExportKind> = {
  bytes: Uint8Array;
  fileName: string;
  mimeType: string;
  warnings: string[];
  targetType: Target;
};

export function safeExportBaseName(name: string) {
  const cleaned = name
    .replace(/\.(?:deck\.md|chart\.json|markdown|md|csv|json|sql|html|htm)$/i, "")
    .normalize("NFKC")
    .replace(/[<>:"/\\|?*\u0000-\u001f]+/g, "-")
    .replace(/^\.+|\.+$/g, "")
    .trim()
    .slice(0, 96) || "rune-export";
  return /^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(cleaned) ? `rune-${cleaned}` : cleaned;
}
