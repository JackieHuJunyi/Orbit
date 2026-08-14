import type { ArtifactKind, WorkspaceArtifact } from "./workspace.ts";

export const MAX_ARTIFACT_DIAGNOSTICS = 12;
export const MAX_ARTIFACT_DIAGNOSTIC_DETAIL_CHARS = 2_000;
export const MAX_ARTIFACT_DIAGNOSTIC_REFERENCE_CHARS = 200;

export type ArtifactDiagnosticCategory =
  | "source"
  | "metric-binding"
  | "unresolved-metric"
  | "query-metric-binding"
  | "unresolved-chart"
  | "chart-binding"
  | "query-binding";

export type ArtifactDiagnosticCode =
  | "source-empty"
  | "source-unsafe"
  | "document-source-invalid"
  | "data-source-invalid"
  | "query-source-invalid"
  | "chart-source-invalid"
  | "slides-source-invalid"
  | "live-binding-invalid"
  | "metric-missing"
  | "query-metric-invalid"
  | "chart-missing"
  | "chart-binding-invalid"
  | "query-binding-invalid";

export type ArtifactDiagnosticInput = Readonly<{
  category: ArtifactDiagnosticCategory;
  detail: string;
  reference?: string;
}>;

export type ArtifactDiagnostic = Readonly<{
  id: string;
  code: ArtifactDiagnosticCode;
  detail: string;
  detailTruncated: boolean;
  reference?: string;
}>;

function sourceDiagnosticCode(kind: ArtifactKind, detail: string): ArtifactDiagnosticCode {
  if (/^the source is empty\.?$/i.test(detail.trim())) return "source-empty";
  if (/script|unsafe|blocked/i.test(detail)) return "source-unsafe";
  if (kind === "data") return "data-source-invalid";
  if (kind === "query") return "query-source-invalid";
  if (kind === "chart") return "chart-source-invalid";
  if (kind === "slides") return "slides-source-invalid";
  return "document-source-invalid";
}

function diagnosticCode(
  kind: ArtifactKind,
  category: ArtifactDiagnosticCategory,
  detail: string,
): ArtifactDiagnosticCode {
  if (category === "source") return sourceDiagnosticCode(kind, detail);
  if (category === "metric-binding") return "live-binding-invalid";
  if (category === "unresolved-metric") return "metric-missing";
  if (category === "query-metric-binding") return "query-metric-invalid";
  if (category === "unresolved-chart") return "chart-missing";
  if (category === "chart-binding") return "chart-binding-invalid";
  return "query-binding-invalid";
}

function boundedText(value: string, limit: number) {
  const normalized = value.normalize("NFKC").trim();
  return normalized.length <= limit
    ? { value: normalized, truncated: false }
    : { value: `${normalized.slice(0, Math.max(0, limit - 1))}…`, truncated: true };
}

/**
 * Turns compiler-owned issue facts into a bounded, stable UI contract.
 * It classifies but never translates, repairs, persists, or mutates source.
 */
export function prepareArtifactDiagnostics(
  artifact: Pick<WorkspaceArtifact, "id" | "kind">,
  inputs: readonly ArtifactDiagnosticInput[],
): readonly ArtifactDiagnostic[] {
  const seen = new Set<string>();
  const diagnostics: ArtifactDiagnostic[] = [];

  for (const input of inputs) {
    if (diagnostics.length >= MAX_ARTIFACT_DIAGNOSTICS) break;
    if (!input || typeof input.detail !== "string") continue;
    const detail = boundedText(input.detail, MAX_ARTIFACT_DIAGNOSTIC_DETAIL_CHARS);
    if (!detail.value) continue;
    const reference =
      typeof input.reference === "string"
        ? boundedText(input.reference, MAX_ARTIFACT_DIAGNOSTIC_REFERENCE_CHARS).value
        : "";
    const identity = `${input.category}\u0000${detail.value}\u0000${reference}`;
    if (seen.has(identity)) continue;
    seen.add(identity);
    diagnostics.push(
      Object.freeze({
        id: `${artifact.id}:${input.category}:${diagnostics.length + 1}`,
        code: diagnosticCode(artifact.kind, input.category, detail.value),
        detail: detail.value,
        detailTruncated: detail.truncated,
        ...(reference ? { reference } : {}),
      }),
    );
  }

  return Object.freeze(diagnostics);
}
