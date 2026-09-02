type DeferredRuneLocale = "zh-TW" | "fr" | "es" | "ru" | "ar" | "ja" | "ko";
type GeneratedRuneLocale = Exclude<DeferredRuneLocale, "zh-TW">;
type InterfaceCatalog = Readonly<Record<string, string>>;
type TraditionalChineseSegment = readonly [source: string, target: string];

const interfaceCatalogs: Partial<Record<GeneratedRuneLocale, InterfaceCatalog>> = {};
const localeLoads: Partial<Record<DeferredRuneLocale, Promise<void>>> = {};
let traditionalChineseSegments: readonly TraditionalChineseSegment[] | null = null;

const interfaceCatalogLoaders: Record<GeneratedRuneLocale, () => Promise<InterfaceCatalog>> = {
  fr: () => import("./interface-locales.runtime/fr.generated.ts").then((module) => module.INTERFACE_TRANSLATIONS),
  es: () => import("./interface-locales.runtime/es.generated.ts").then((module) => module.INTERFACE_TRANSLATIONS),
  ru: () => import("./interface-locales.runtime/ru.generated.ts").then((module) => module.INTERFACE_TRANSLATIONS),
  ar: () => import("./interface-locales.runtime/ar.generated.ts").then((module) => module.INTERFACE_TRANSLATIONS),
  ja: () => import("./interface-locales.runtime/ja.generated.ts").then((module) => module.INTERFACE_TRANSLATIONS),
  ko: () => import("./interface-locales.runtime/ko.generated.ts").then((module) => module.INTERFACE_TRANSLATIONS),
};

export function isRuneLocaleCatalogLoaded(locale: string) {
  if (locale === "en" || locale === "zh-CN") return true;
  if (locale === "zh-TW") return traditionalChineseSegments != null;
  return Object.hasOwn(interfaceCatalogs, locale);
}

export async function loadRuneLocaleCatalog(locale: string) {
  if (isRuneLocaleCatalogLoaded(locale)) return;
  if (!(locale === "zh-TW" || Object.hasOwn(interfaceCatalogLoaders, locale))) {
    throw new Error(`Orbit cannot load unsupported interface locale “${locale}”.`);
  }
  const deferredLocale = locale as DeferredRuneLocale;
  localeLoads[deferredLocale] ??=
    deferredLocale === "zh-TW"
      ? import("./traditional-chinese.generated.ts").then((module) => {
          traditionalChineseSegments = Object.freeze(
            module.TRADITIONAL_CHINESE_SEGMENTS.map(([source, target]) => Object.freeze([source, target] as const)),
          );
        })
      : interfaceCatalogLoaders[deferredLocale]().then((catalog) => {
          interfaceCatalogs[deferredLocale] = Object.freeze({ ...catalog });
        });
  try {
    await localeLoads[deferredLocale];
  } catch (error) {
    delete localeLoads[deferredLocale];
    throw error;
  }
}

export function loadedInterfaceTranslation(locale: string, english: string) {
  return interfaceCatalogs[locale as GeneratedRuneLocale]?.[english];
}

export function loadedTraditionalChineseSegments() {
  return traditionalChineseSegments;
}
