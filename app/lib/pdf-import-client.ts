import * as pdfjs from "pdfjs-dist/legacy/build/pdf.mjs";
import pdfWorkerUrl from "pdfjs-dist/legacy/build/pdf.worker.min.mjs?url";
import { convertPdfFileWithLibrary } from "./pdf-import";
import type { PdfJsLibrary } from "./pdf-import";

pdfjs.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

export async function convertPdfFile(fileName: string, input: ArrayBuffer | Uint8Array) {
  return convertPdfFileWithLibrary(fileName, input, pdfjs as unknown as PdfJsLibrary);
}
