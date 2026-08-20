import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  isRuneLocaleCatalogLoaded,
  loadedInterfaceTranslation,
  loadedTraditionalChineseSegments,
  loadRuneLocaleCatalog,
} from "../app/lib/interface-locale-runtime.ts";
import { runeText } from "../app/lib/localization.ts";

test("loads only the requested local interface catalog before synchronous localization", async () => {
  assert.equal(isRuneLocaleCatalogLoaded("en"), true);
  assert.equal(isRuneLocaleCatalogLoaded("zh-CN"), true);
  assert.equal(isRuneLocaleCatalogLoaded("fr"), false);
  assert.equal(isRuneLocaleCatalogLoaded("es"), false);
  assert.throws(() => runeText("fr", "Appearance", "外观"), /must be loaded/);

  await Promise.all([loadRuneLocaleCatalog("fr"), loadRuneLocaleCatalog("fr")]);
  assert.equal(isRuneLocaleCatalogLoaded("fr"), true);
  assert.equal(isRuneLocaleCatalogLoaded("es"), false);
  assert.equal(loadedInterfaceTranslation("fr", "Appearance"), "Apparence");
  assert.equal(runeText("fr", "Appearance", "外观"), "Apparence");
});

test("loads Traditional Chinese conversion data independently and rejects unknown locales", async () => {
  assert.equal(isRuneLocaleCatalogLoaded("zh-TW"), false);
  await loadRuneLocaleCatalog("zh-TW");
  assert.equal(isRuneLocaleCatalogLoaded("zh-TW"), true);
  assert.ok((loadedTraditionalChineseSegments()?.length ?? 0) > 100);
  assert.equal(runeText("zh-TW", "", "实时预览"), "即時預覽");
  await assert.rejects(() => loadRuneLocaleCatalog("de"), /unsupported interface locale/);
  await assert.rejects(() => loadRuneLocaleCatalog("toString"), /unsupported interface locale/);
});

test("keeps source catalogs out of the synchronous localization entry", async () => {
  const [localization, runtime] = await Promise.all([
    readFile(new URL("../app/lib/localization.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/lib/interface-locale-runtime.ts", import.meta.url), "utf8"),
  ]);
  assert.doesNotMatch(localization, /interface-locales\.generated|interface-locales\.manual/);
  for (const locale of ["fr", "es", "ru", "ar", "ja", "ko"]) {
    assert.match(runtime, new RegExp(`import\\("\\./interface-locales\\.runtime/${locale}\\.generated\\.ts"\\)`));
  }
  assert.match(runtime, /import\("\.\/traditional-chinese\.generated\.ts"\)/);
});
