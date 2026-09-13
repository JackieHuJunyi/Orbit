import { pdfToolById } from "./pdf-tool-registry.ts";
import {
  runPdfCoreTool,
  type PdfCoreToolOptions,
  type PdfToolInputFile,
  type PdfToolOutputFile,
} from "./pdf-core-tools.ts";

const QPDF_TOOLS = new Set(["compress", "optimize", "repair", "protect", "unlock"]);

function qpdfSuffix(toolId: string) {
  return toolId === "compress"
    ? "compressed"
    : toolId === "optimize"
      ? "optimized"
      : toolId === "repair"
        ? "repaired"
        : toolId === "protect"
          ? "protected"
          : "unlocked";
}

export async function executeDirectPdfTool(
  toolId: string,
  inputs: readonly PdfToolInputFile[],
  options: PdfCoreToolOptions = {},
): Promise<PdfToolOutputFile[]> {
  const definition = pdfToolById(toolId);
  if (!definition) throw new Error("Choose a supported PDF tool.");
  if (definition.runtime === "pdf-lib") return runPdfCoreTool(toolId, inputs, options);
  if (toolId === "pdf-to-images") {
    if (inputs.length !== 1) throw new Error("Choose exactly one PDF for this tool.");
    const { renderPdfPagesToPng } = await import("./pdf-render-tools.ts");
    return renderPdfPagesToPng(inputs[0], options);
  }
  if (toolId === "compare") {
    const { comparePdfFiles } = await import("./pdf-render-tools.ts");
    return comparePdfFiles(inputs);
  }
  if (toolId === "extract-images") {
    if (inputs.length !== 1) throw new Error("Choose exactly one PDF for this tool.");
    const { extractPdfImages } = await import("./pdf-render-tools.ts");
    return extractPdfImages(inputs[0]);
  }
  if (toolId === "redact") {
    if (inputs.length !== 1) throw new Error("Choose exactly one PDF for this tool.");
    const { redactPdf } = await import("./pdf-render-tools.ts");
    return redactPdf(inputs[0], options);
  }
  if (toolId === "pdfa") {
    if (inputs.length !== 1) throw new Error("Choose exactly one PDF for this tool.");
    const { convertPdfToPdfA } = await import("./pdf-ghostscript-client.ts");
    return [
      {
        name: `${inputs[0].name.replace(/\.pdf$/iu, "")}-pdfa.pdf`,
        bytes: await convertPdfToPdfA(inputs[0].bytes),
        type: "application/pdf",
      },
    ];
  }
  if (QPDF_TOOLS.has(toolId)) {
    if (inputs.length !== 1) throw new Error("Choose exactly one PDF for this tool.");
    const { runQpdfOperation } = await import("./pdf-qpdf-client.ts");
    const bytes = await runQpdfOperation(
      toolId as "compress" | "optimize" | "repair" | "protect" | "unlock",
      inputs[0].bytes,
      options,
    );
    return [
      {
        name: `${inputs[0].name.replace(/\.pdf$/iu, "")}-${qpdfSuffix(toolId)}.pdf`,
        bytes,
        type: "application/pdf",
      },
    ];
  }
  throw new Error("Continue this tool through Orbit's reviewed workspace flow.");
}

export function pdfToolRunsDirectly(toolId: string) {
  const definition = pdfToolById(toolId);
  return (
    definition?.runtime === "pdf-lib" ||
    QPDF_TOOLS.has(toolId) ||
    ["pdf-to-images", "extract-images", "compare", "redact", "pdfa"].includes(toolId)
  );
}
