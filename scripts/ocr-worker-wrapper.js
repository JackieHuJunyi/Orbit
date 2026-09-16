/*
 * Tesseract.js 7 accepts language descriptors ({ code, data }) when loading
 * in-memory traineddata, but its initialize message reads descriptor.data as
 * the language name. Normalize only that later message; loadLanguage still
 * receives the original bytes and writes them to the worker filesystem.
 */
self.addEventListener("message", (event) => {
  const packet = event.data;
  if (packet?.action !== "initialize") return;
  const languages = packet.payload?.langs;
  if (!Array.isArray(languages)) return;
  packet.payload.langs = languages.map((language) => (typeof language === "string" ? language : language.code));
});

importScripts(new URL("worker.min.js", self.location.href).href);
