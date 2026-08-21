import { compileArtifactSource, queryMetricSourceIdsForArtifact } from "./bindings.ts";
import { chartQuerySourceIdsForArtifact } from "./charts.ts";
import type { ArtifactExportResult } from "./export-contract.ts";
import { extractRuneAssetIds, type PreparedRuneImageAsset } from "./local-assets.ts";
import { resolveQueryDataArtifact } from "./query-source.ts";
import type { WorkspaceQuerySnapshot } from "./query-snapshot.ts";
import {
  workspaceFileExportCapability,
  type WorkspaceFileExportCapability,
  type WorkspaceFileExportDestination,
} from "./workspace-file-export.ts";
import type { WorkspaceArtifact } from "./workspace.ts";

export type WorkspaceFileExportPorts = {
  runQuerySnapshot?: (
    queryArtifact: WorkspaceArtifact,
    dataArtifact: WorkspaceArtifact,
  ) => Promise<WorkspaceQuerySnapshot>;
  loadImageAsset?: (id: string) => Promise<PreparedRuneImageAsset | null>;
};

type WorkspaceFileExportContext = {
  capability: WorkspaceFileExportCapability;
  artifact: WorkspaceArtifact;
  exportArtifact: WorkspaceArtifact;
  artifacts: WorkspaceArtifact[];
  querySnapshots: WorkspaceQuerySnapshot[];
  imageAssets: PreparedRuneImageAsset[];
};

type WorkspaceFileExportConverter = (context: WorkspaceFileExportContext) => Promise<ArtifactExportResult>;

async function convertPortableData(context: WorkspaceFileExportContext) {
  const { exportPortableDataArtifact } = await import("./data-export.ts");
  if (context.capability.targetType !== "csv" && context.capability.targetType !== "json") {
    throw new Error("Portable Data export requires CSV or JSON.");
  }
  return exportPortableDataArtifact(context.exportArtifact, context.capability.targetType);
}

async function convertOffice(context: WorkspaceFileExportContext) {
  const { exportOfficeArtifact } = await import("./office-export.ts");
  return exportOfficeArtifact(context.exportArtifact, context.artifacts, context.querySnapshots, context.imageAssets);
}

async function convertLegacyOffice(context: WorkspaceFileExportContext) {
  const modernResult = await convertOffice(context);
  const { exportLegacyOfficeFile } = await import("./desktop-bridge.ts");
  const legacy = await exportLegacyOfficeFile({ bytes: modernResult.bytes, fileName: modernResult.fileName });
  const isDocument = context.capability.targetType === "doc";
  return {
    bytes: legacy.bytes,
    fileName: legacy.fileName,
    mimeType: isDocument ? "application/msword" : "application/vnd.ms-powerpoint",
    targetType: isDocument ? ("doc" as const) : ("ppt" as const),
    warnings: [
      ...modernResult.warnings,
      legacy.warning,
      "Legacy Office output is a compatibility handoff, not Rune's canonical source. Verify the downloaded file in Microsoft Office before delivery.",
    ],
  };
}

async function convertOdf(context: WorkspaceFileExportContext) {
  const { exportOdfArtifact } = await import("./odf-export.ts");
  return exportOdfArtifact(context.exportArtifact, context.artifacts, context.querySnapshots, context.imageAssets);
}

async function convertHtml(context: WorkspaceFileExportContext) {
  const { exportDeckHtml } = await import("./html-export.ts");
  return exportDeckHtml(context.artifact, context.artifacts, context.querySnapshots, context.imageAssets);
}

async function convertPdf(context: WorkspaceFileExportContext) {
  const { exportPdfArtifact } = await import("./pdf-export.ts");
  return exportPdfArtifact(context.artifact, context.artifacts, context.querySnapshots, undefined, context.imageAssets);
}

const WORKSPACE_FILE_EXPORT_CONVERTERS: Readonly<Record<WorkspaceFileExportDestination, WorkspaceFileExportConverter>> =
  Object.freeze({
    csv: convertPortableData,
    json: convertPortableData,
    office: convertOffice,
    "legacy-office": convertLegacyOffice,
    odf: convertOdf,
    html: convertHtml,
    pdf: convertPdf,
  });

async function prepareQuerySnapshots(
  artifact: WorkspaceArtifact,
  artifacts: WorkspaceArtifact[],
  runner: NonNullable<WorkspaceFileExportPorts["runQuerySnapshot"]>,
) {
  const referencedQueryIds = new Set([
    ...chartQuerySourceIdsForArtifact(artifact, artifacts),
    ...queryMetricSourceIdsForArtifact(artifact.source),
  ]);
  const snapshots = await Promise.all(
    artifacts
      .filter((candidate) => candidate.kind === "query" && referencedQueryIds.has(candidate.id))
      .map(async (queryArtifact) => {
        const dataResolution = resolveQueryDataArtifact(queryArtifact, artifacts);
        if (!dataResolution.artifact) {
          throw new Error(dataResolution.errors[0] ?? `Data source not found for ${queryArtifact.name}`);
        }
        return runner(queryArtifact, dataResolution.artifact);
      }),
  );
  const truncated = snapshots.find((snapshot) => snapshot.result.truncated);
  if (truncated)
    throw new Error(`Narrow ${truncated.queryArtifactName} to 500 rows or fewer before exporting its consumers.`);
  return snapshots;
}

async function prepareImageAssets(
  artifact: WorkspaceArtifact,
  loader: NonNullable<WorkspaceFileExportPorts["loadImageAsset"]>,
) {
  if (artifact.kind !== "document" && artifact.kind !== "slides") return [];
  const ids = [...new Set(extractRuneAssetIds(artifact.source))];
  const assets: PreparedRuneImageAsset[] = [];
  for (const id of ids) {
    const asset = await loader(id);
    if (!asset) throw new Error(`Referenced local image is missing or corrupt: ${id}`);
    assets.push(asset);
  }
  return assets;
}

function compilePackageArtifact(
  artifact: WorkspaceArtifact,
  artifacts: WorkspaceArtifact[],
  querySnapshots: WorkspaceQuerySnapshot[],
  destination: WorkspaceFileExportDestination,
) {
  if (artifact.kind !== "document" && artifact.kind !== "slides") return artifact;
  const compiled = compileArtifactSource(artifact.source, artifacts, querySnapshots);
  const family = destination === "odf" ? "OpenDocument" : "Office";
  if (compiled.metricBindingErrors.length) throw new Error(compiled.metricBindingErrors[0]);
  if (compiled.unresolved.length) {
    throw new Error(
      `Resolve ${compiled.unresolved.length} missing metric ${compiled.unresolved.length === 1 ? "reference" : "references"} before ${family} export.`,
    );
  }
  if (compiled.unresolvedQueryMetrics.length) throw new Error(compiled.unresolvedQueryMetrics[0]);
  if (compiled.pendingQueryMetrics.length)
    throw new Error(`Run ${compiled.pendingQueryMetrics[0]} before ${family} export.`);
  if (compiled.queryMetricRuntimeErrors.length) throw new Error(compiled.queryMetricRuntimeErrors[0]);
  if (compiled.unresolvedCharts.length) {
    throw new Error(
      `Resolve ${compiled.unresolvedCharts.length} missing chart ${compiled.unresolvedCharts.length === 1 ? "reference" : "references"} before ${family} export.`,
    );
  }
  return { ...artifact, source: compiled.source };
}

export async function prepareWorkspaceFileExport(
  destination: WorkspaceFileExportDestination,
  artifact: WorkspaceArtifact,
  artifacts: WorkspaceArtifact[],
  ports: WorkspaceFileExportPorts = {},
) {
  const capability = workspaceFileExportCapability(artifact, destination);
  if (!capability) throw new Error(`${artifact.kind} cannot export to ${destination}.`);
  const runQuerySnapshot =
    ports.runQuerySnapshot ??
    (async (queryArtifact, dataArtifact) => {
      const { runWorkspaceQuerySnapshot } = await import("./duckdb-client.ts");
      return runWorkspaceQuerySnapshot(queryArtifact, dataArtifact);
    });
  const loadImageAsset =
    ports.loadImageAsset ??
    (async (id) => {
      const { getRuneImageAsset } = await import("./local-assets.ts");
      return getRuneImageAsset(id);
    });
  const [querySnapshots, imageAssets] = await Promise.all([
    prepareQuerySnapshots(artifact, artifacts, runQuerySnapshot),
    prepareImageAssets(artifact, loadImageAsset),
  ]);
  const compileBindings = destination === "office" || destination === "legacy-office" || destination === "odf";
  const exportArtifact = compileBindings
    ? compilePackageArtifact(artifact, artifacts, querySnapshots, destination)
    : artifact;
  return WORKSPACE_FILE_EXPORT_CONVERTERS[destination]({
    capability,
    artifact,
    exportArtifact,
    artifacts,
    querySnapshots,
    imageAssets,
  });
}
