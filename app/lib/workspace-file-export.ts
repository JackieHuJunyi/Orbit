import type { ArtifactExportKind } from "./export-contract.ts";
import type { ArtifactKind, WorkspaceArtifact } from "./workspace.ts";

export type WorkspaceFileExportDestination = "csv" | "json" | "office" | "legacy-office" | "odf" | "html" | "pdf";

export type WorkspaceFileExportCapability = Readonly<{
  destination: WorkspaceFileExportDestination;
  targetType: ArtifactExportKind;
  label: string;
}>;

type WorkspaceFileExportDefinition = Readonly<{
  destination: WorkspaceFileExportDestination;
  targets: Readonly<Partial<Record<ArtifactKind, ArtifactExportKind>>>;
}>;

const WORKSPACE_FILE_EXPORT_DEFINITIONS: readonly WorkspaceFileExportDefinition[] = Object.freeze([
  Object.freeze({ destination: "csv" as const, targets: Object.freeze({ data: "csv" as const }) }),
  Object.freeze({ destination: "json" as const, targets: Object.freeze({ data: "json" as const }) }),
  Object.freeze({
    destination: "office" as const,
    targets: Object.freeze({ document: "docx" as const, data: "xlsx" as const, slides: "pptx" as const }),
  }),
  Object.freeze({
    destination: "legacy-office" as const,
    targets: Object.freeze({ document: "doc" as const, slides: "ppt" as const }),
  }),
  Object.freeze({
    destination: "odf" as const,
    targets: Object.freeze({ document: "odt" as const, data: "ods" as const, slides: "odp" as const }),
  }),
  Object.freeze({ destination: "html" as const, targets: Object.freeze({ slides: "html" as const }) }),
  Object.freeze({
    destination: "pdf" as const,
    targets: Object.freeze({ document: "pdf" as const, data: "pdf" as const, slides: "pdf" as const }),
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
  const targetType = workspaceFileExportDefinition(destination).targets[artifact.kind];
  return targetType ? Object.freeze({ destination, targetType, label: targetType.toUpperCase() }) : null;
}

export function workspaceFileExportCapabilities(artifact: WorkspaceArtifact) {
  return Object.freeze(
    WORKSPACE_FILE_EXPORT_DEFINITIONS.flatMap((definition) => {
      const targetType = definition.targets[artifact.kind];
      return targetType
        ? [
            Object.freeze({
              destination: definition.destination,
              targetType,
              label: targetType.toUpperCase(),
            }),
          ]
        : [];
    }),
  );
}
