/* Ghostscript runs off the main thread and receives only the explicitly selected PDF. */
importScripts("./gs.js");

self.onmessage = async (event) => {
  const { id, input } = event.data;
  try {
    const gs = await Module({
      locateFile: (name) => (name.endsWith(".wasm") ? new URL("./gs.wasm", self.location.href).href : name),
    });
    gs.FS.mkdir("/input");
    gs.FS.mkdir("/output");
    gs.FS.writeFile("/input/source.pdf", new Uint8Array(input));
    const status = gs.callMain([
      "-dSAFER",
      "-dBATCH",
      "-dNOPAUSE",
      "-sDEVICE=pdfwrite",
      "-dPDFA=2",
      "-dPDFACompatibilityPolicy=1",
      "-sColorConversionStrategy=RGB",
      "-sOutputFile=/output/result.pdf",
      "/input/source.pdf",
    ]);
    if (status !== 0) throw new Error(`Ghostscript stopped with status ${status}.`);
    const result = gs.FS.readFile("/output/result.pdf");
    const transferable = result.buffer.slice(result.byteOffset, result.byteOffset + result.byteLength);
    self.postMessage({ id, result: transferable }, [transferable]);
  } catch (error) {
    self.postMessage({ id, error: error instanceof Error ? error.message : "Ghostscript could not create PDF/A." });
  }
};
