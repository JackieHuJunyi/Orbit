import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  isOrbitLocaleCatalogLoaded,
  loadedInterfaceTranslation,
  loadedTraditionalChineseSegments,
  loadOrbitLocaleCatalog,
} from "../app/lib/interface-locale-runtime.ts";
import { orbitText } from "../app/lib/localization.ts";

test("loads only the requested local interface catalog before synchronous localization", async () => {
  assert.equal(isOrbitLocaleCatalogLoaded("en"), true);
  assert.equal(isOrbitLocaleCatalogLoaded("zh-CN"), true);
  assert.equal(isOrbitLocaleCatalogLoaded("fr"), false);
  assert.equal(isOrbitLocaleCatalogLoaded("es"), false);
  assert.throws(() => orbitText("fr", "Appearance", "外观"), /must be loaded/);

  await Promise.all([loadOrbitLocaleCatalog("fr"), loadOrbitLocaleCatalog("fr")]);
  assert.equal(isOrbitLocaleCatalogLoaded("fr"), true);
  assert.equal(isOrbitLocaleCatalogLoaded("es"), false);
  assert.equal(loadedInterfaceTranslation("fr", "Appearance"), "Apparence");
  assert.equal(orbitText("fr", "Appearance", "外观"), "Apparence");
});

test("loads Traditional Chinese conversion data independently and rejects unknown locales", async () => {
  assert.equal(isOrbitLocaleCatalogLoaded("zh-TW"), false);
  await loadOrbitLocaleCatalog("zh-TW");
  assert.equal(isOrbitLocaleCatalogLoaded("zh-TW"), true);
  assert.ok((loadedTraditionalChineseSegments()?.length ?? 0) > 100);
  assert.equal(orbitText("zh-TW", "", "实时预览"), "即時預覽");
  await assert.rejects(() => loadOrbitLocaleCatalog("de"), /unsupported interface locale/);
  await assert.rejects(() => loadOrbitLocaleCatalog("toString"), /unsupported interface locale/);
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
