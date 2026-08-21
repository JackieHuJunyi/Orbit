import type { ArtifactExportKind } from "./export-contract.ts";
import type { ArtifactKind, WorkspaceArtifact } from "./workspace.ts";

export type WorkspaceFileExportDestination =
  "source" | "csv" | "json" | "office" | "legacy-office" | "odf" | "html" | "pdf";

export type WorkspaceFileExportCapability = Readonly<{
  destination: WorkspaceFileExportDestination;
  targetType: ArtifactExportKind;
  label: string;
}>;

type WorkspaceFileExportDefinition = Readonly<{
  destination: WorkspaceFileExportDestination;
  resolveTarget: (artifact: WorkspaceArtifact) => ArtifactExportKind | null;
}>;

function sourceExportTarget(artifact: WorkspaceArtifact): ArtifactExportKind {
  if (artifact.kind === "document") return "md";
  if (artifact.kind === "query") return "sql";
  if (artifact.kind === "chart") return "chart-json";
  if (artifact.kind === "slides") return artifact.language === "Deck Markdown" ? "deck-md" : "html";
  return /\.json$/iu.test(artifact.name) ? "json" : "csv";
}

function targetResolver(targets: Readonly<Partial<Record<ArtifactKind, ArtifactExportKind>>>) {
  return (artifact: WorkspaceArtifact) => targets[artifact.kind] ?? null;
}

function targetLabel(target: ArtifactExportKind) {
  if (target === "deck-md") return "DECK.MD";
  if (target === "chart-json") return "CHART.JSON";
  return target.toUpperCase();
}

const WORKSPACE_FILE_EXPORT_DEFINITIONS: readonly WorkspaceFileExportDefinition[] = Object.freeze([
  Object.freeze({ destination: "source" as const, resolveTarget: sourceExportTarget }),
  Object.freeze({
    destination: "csv" as const,
    resolveTarget: targetResolver(Object.freeze({ data: "csv" as const })),
  }),
  Object.freeze({
    destination: "json" as const,
    resolveTarget: targetResolver(Object.freeze({ data: "json" as const })),
  }),
  Object.freeze({
    destination: "office" as const,
    resolveTarget: targetResolver(
      Object.freeze({ document: "docx" as const, data: "xlsx" as const, slides: "pptx" as const }),
    ),
  }),
  Object.freeze({
    destination: "legacy-office" as const,
    resolveTarget: targetResolver(Object.freeze({ document: "doc" as const, slides: "ppt" as const })),
  }),
  Object.freeze({
    destination: "odf" as const,
    resolveTarget: targetResolver(
      Object.freeze({ document: "odt" as const, data: "ods" as const, slides: "odp" as const }),
    ),
  }),
  Object.freeze({
    destination: "html" as const,
    resolveTarget: targetResolver(Object.freeze({ slides: "html" as const })),
  }),
  Object.freeze({
    destination: "pdf" as const,
    resolveTarget: targetResolver(
      Object.freeze({ document: "pdf" as const, data: "pdf" as const, slides: "pdf" as const }),
    ),
  }),
]);

function workspaceFileExportDefinition(destination: WorkspaceFileExportDestination) {
  const definition = WORKSPACE_FILE_EXPORT_DEFINITIONS.find((candidate) => candidate.destination === destination);
  if (!definition) throw new Error(`Unknown workspace export destination: ${destination}`);
  return definition;
}

export function workspaceFileExportCapability(
  artifact: WorkspaceArtifact,
  destination: WorkspaceFileExportDestination,
): WorkspaceFileExportCapability | null {
  const targetType = workspaceFileExportDefinition(destination).resolveTarget(artifact);
  return targetType ? Object.freeze({ destination, targetType, label: targetLabel(targetType) }) : null;
}

export function workspaceFileExportCapabilities(artifact: WorkspaceArtifact) {
  return Object.freeze(
    WORKSPACE_FILE_EXPORT_DEFINITIONS.flatMap((definition) => {
      const targetType = definition.resolveTarget(artifact);
      return targetType
        ? [
            Object.freeze({
              destination: definition.destination,
              targetType,
              label: targetLabel(targetType),
            }),
          ]
        : [];
    }),
  );
}
