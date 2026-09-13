export async function convertPdfToPdfA(input: Uint8Array): Promise<Uint8Array> {
  if (!input.length || input.length > 80 * 1024 * 1024) throw new Error("Choose a PDF between 1 byte and 80 MB.");
  const worker = new Worker("/ghostscript/ghostscript-worker.js");
  const id = crypto.randomUUID();
  try {
    const result = await new Promise<ArrayBuffer>((resolve, reject) => {
      const timeout = window.setTimeout(() => reject(new Error("The local PDF/A conversion timed out.")), 90_000);
      worker.onmessage = (event: MessageEvent<{ id: string; result?: ArrayBuffer; error?: string }>) => {
        if (event.data.id !== id) return;
        window.clearTimeout(timeout);
        if (event.data.result) resolve(event.data.result);
        else reject(new Error(event.data.error || "The local PDF/A conversion failed."));
      };
      worker.onerror = () => {
        window.clearTimeout(timeout);
        reject(new Error("The local PDF/A worker could not start."));
      };
      const transferable = input.buffer.slice(input.byteOffset, input.byteOffset + input.byteLength);
      worker.postMessage({ id, input: transferable }, [transferable]);
    });
    return new Uint8Array(result);
  } finally {
    worker.terminate();
  }
}
