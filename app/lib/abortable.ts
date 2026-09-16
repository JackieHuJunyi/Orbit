export function createAbortError(message: string) {
  return new DOMException(message, "AbortError");
}

export async function raceWithAbort<T>(promise: Promise<T>, signal: AbortSignal | undefined, message: string) {
  if (!signal) return promise;
  if (signal.aborted) throw createAbortError(message);

  let rejectAbort: ((reason: DOMException) => void) | undefined;
  const aborted = new Promise<never>((_resolve, reject) => {
    rejectAbort = reject;
  });
  const onAbort = () => rejectAbort?.(createAbortError(message));
  signal.addEventListener("abort", onAbort, { once: true });
  try {
    return await Promise.race([promise, aborted]);
  } finally {
    signal.removeEventListener("abort", onAbort);
  }
}
