/* qpdf runs in this dedicated worker so PDF optimization never blocks Orbit's interface. */
importScripts("./qpdf.js");

self.onmessage = async (event) => {
  const { id, input, args } = event.data;
  try {
    const qpdf = await Module({
      locateFile: (name) => (name.endsWith(".wasm") ? new URL("./qpdf.wasm", self.location.href).href : name),
    });
    qpdf.FS.mkdir("/input");
    qpdf.FS.mkdir("/output");
    qpdf.FS.writeFile("/input/source.pdf", new Uint8Array(input));
    qpdf.callMain([...args, "/input/source.pdf", "/output/result.pdf"]);
    const result = qpdf.FS.readFile("/output/result.pdf");
    const transferable = result.buffer.slice(result.byteOffset, result.byteOffset + result.byteLength);
    self.postMessage({ id, result: transferable }, [transferable]);
  } catch (error) {
    self.postMessage({ id, error: error instanceof Error ? error.message : "qpdf could not process this PDF." });
  }
};
