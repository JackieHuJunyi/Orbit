export type QpdfOperation = "compress" | "optimize" | "repair" | "protect" | "unlock";

function qpdfArguments(operation: QpdfOperation, options: { password?: string }) {
  if (operation === "compress") {
    return ["--object-streams=generate", "--compress-streams=y", "--recompress-flate", "--compression-level=9"];
  }
  if (operation === "optimize") return ["--linearize", "--object-streams=generate"];
  if (operation === "repair") return [];
  const password = options.password?.trim() ?? "";
  if (!password || password.length > 120) throw new Error("Enter a password between 1 and 120 characters.");
  if (operation === "unlock") return [`--password=${password}`, "--decrypt"];
  return ["--encrypt", password, password, "256", "--"];
}

export async function runQpdfOperation(
  operation: QpdfOperation,
  input: Uint8Array,
  options: { password?: string } = {},
): Promise<Uint8Array> {
  if (!input.length) throw new Error("Choose a non-empty PDF.");
  const worker = new Worker("/qpdf/qpdf-worker.js");
  const id = crypto.randomUUID();
  try {
    const result = await new Promise<ArrayBuffer>((resolve, reject) => {
      const timeout = window.setTimeout(() => reject(new Error("The local PDF operation timed out.")), 60_000);
      worker.onmessage = (event: MessageEvent<{ id: string; result?: ArrayBuffer; error?: string }>) => {
        if (event.data.id !== id) return;
        window.clearTimeout(timeout);
        if (event.data.result) resolve(event.data.result);
        else reject(new Error(event.data.error || "The local PDF operation failed."));
      };
      worker.onerror = () => {
        window.clearTimeout(timeout);
        reject(new Error("The local PDF worker could not start."));
      };
      const transferable = input.buffer.slice(input.byteOffset, input.byteOffset + input.byteLength);
      worker.postMessage({ id, input: transferable, args: qpdfArguments(operation, options) }, [transferable]);
    });
    return new Uint8Array(result);
  } finally {
    worker.terminate();
  }
}
