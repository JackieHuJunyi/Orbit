import type { ArtifactExportKind } from "./export-contract.ts";
import type { ArtifactKind, WorkspaceArtifact } from "./workspace.ts";

const WORKSPACE_FILE_EXPORT_DESTINATIONS = Object.freeze([
  "source",
  "csv",
  "json",
  "office",
  "legacy-office",
  "odf",
  "html",
  "pdf",
] as const);

export type WorkspaceFileExportDestination = (typeof WORKSPACE_FILE_EXPORT_DESTINATIONS)[number];

export type WorkspaceFileExportPresentation = Readonly<{
  icon: "code" | "archive" | "document";
  detail:
    | "canonical-source"
    | "portable-format"
    | "desktop-compatibility"
    | "open-document"
    | "standalone-html"
    | "fixed-pdf";
  desktopOnly: boolean;
}>;

export type WorkspaceFileExportCapability = Readonly<{
  destination: WorkspaceFileExportDestination;
  targetType: ArtifactExportKind;
  label: string;
  presentation: WorkspaceFileExportPresentation;
}>;

type WorkspaceFileExportDefinition = Readonly<{
  resolveTarget: (artifact: WorkspaceArtifact) => ArtifactExportKind | null;
  presentation: WorkspaceFileExportPresentation;
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

const WORKSPACE_FILE_EXPORT_DEFINITIONS = Object.freeze({
  source: Object.freeze({
    resolveTarget: sourceExportTarget,
    presentation: Object.freeze({ icon: "code", detail: "canonical-source", desktopOnly: false }),
  }),
  csv: Object.freeze({
    resolveTarget: targetResolver(Object.freeze({ data: "csv" as const })),
    presentation: Object.freeze({ icon: "code", detail: "portable-format", desktopOnly: false }),
  }),
  json: Object.freeze({
    resolveTarget: targetResolver(Object.freeze({ data: "json" as const })),
    presentation: Object.freeze({ icon: "code", detail: "portable-format", desktopOnly: false }),
  }),
  office: Object.freeze({
    resolveTarget: targetResolver(
      Object.freeze({ document: "docx" as const, data: "xlsx" as const, slides: "pptx" as const }),
    ),
    presentation: Object.freeze({ icon: "archive", detail: "portable-format", desktopOnly: false }),
  }),
  "legacy-office": Object.freeze({
    resolveTarget: targetResolver(Object.freeze({ document: "doc" as const, slides: "ppt" as const })),
    presentation: Object.freeze({ icon: "archive", detail: "desktop-compatibility", desktopOnly: true }),
  }),
  odf: Object.freeze({
    resolveTarget: targetResolver(
      Object.freeze({ document: "odt" as const, data: "ods" as const, slides: "odp" as const }),
    ),
    presentation: Object.freeze({ icon: "archive", detail: "open-document", desktopOnly: false }),
  }),
  html: Object.freeze({
    resolveTarget: targetResolver(Object.freeze({ slides: "html" as const })),
    presentation: Object.freeze({ icon: "code", detail: "standalone-html", desktopOnly: false }),
  }),
  pdf: Object.freeze({
    resolveTarget: targetResolver(
      Object.freeze({ document: "pdf" as const, data: "pdf" as const, slides: "pdf" as const }),
    ),
    presentation: Object.freeze({ icon: "document", detail: "fixed-pdf", desktopOnly: false }),
  }),
}) satisfies Readonly<Record<WorkspaceFileExportDestination, WorkspaceFileExportDefinition>>;

function workspaceFileExportDefinition(destination: WorkspaceFileExportDestination) {
  return WORKSPACE_FILE_EXPORT_DEFINITIONS[destination];
}

export function workspaceFileExportCapability(
  artifact: WorkspaceArtifact,
  destination: WorkspaceFileExportDestination,
): WorkspaceFileExportCapability | null {
  const definition = workspaceFileExportDefinition(destination);
  const targetType = definition.resolveTarget(artifact);
  return targetType
    ? Object.freeze({ destination, targetType, label: targetLabel(targetType), presentation: definition.presentation })
    : null;
}

export function workspaceFileExportCapabilities(artifact: WorkspaceArtifact) {
  return Object.freeze(
    WORKSPACE_FILE_EXPORT_DESTINATIONS.flatMap((destination) => {
      const definition = workspaceFileExportDefinition(destination);
      const targetType = definition.resolveTarget(artifact);
      return targetType
        ? [
            Object.freeze({
              destination,
              targetType,
              label: targetLabel(targetType),
              presentation: definition.presentation,
            }),
          ]
        : [];
    }),
  );
}
