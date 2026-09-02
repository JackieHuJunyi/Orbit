import type { TegakiBundle } from "tegaki";
import type { RuneLocale } from "./localization.ts";
import {
  JAPANESE_GREETING_GLYPHS,
  KOREAN_GREETING_GLYPHS,
  LATIN_GREETING_GLYPHS,
  SIMPLIFIED_CHINESE_GREETING_GLYPHS,
  TRADITIONAL_CHINESE_GREETING_GLYPHS,
} from "./greeting-glyph-data.ts";

type GreetingFontPlan = Readonly<{
  bundle: TegakiBundle;
  requiresShaper: boolean;
}>;

function asGlyphData(value: unknown) {
  return value as TegakiBundle["glyphData"];
}

function withoutShapedVariants(bundle: TegakiBundle): TegakiBundle {
  const plainBundle = { ...bundle };
  delete plainBundle.features;
  delete plainBundle.glyphDataById;
  return plainBundle;
}

function generatedBundle(
  base: TegakiBundle,
  input: Readonly<{
    ascender: number;
    descender: number;
    family: string;
    glyphData: TegakiBundle["glyphData"];
  }>,
): TegakiBundle {
  return {
    version: base.version,
    family: `Orbit ${input.family}`,
    lineCap: "round",
    fontUrl: base.fontUrl,
    fontFaceCSS: `@font-face { font-family: 'Orbit ${input.family}'; src: url(${base.fontUrl}); }`,
    unitsPerEm: 1_000,
    ascender: input.ascender,
    descender: input.descender,
    glyphData: input.glyphData,
  };
}

export async function loadGreetingFontPlan(locale: RuneLocale): Promise<GreetingFontPlan> {
  if (locale === "ar") {
    const { default: amiri } = await import("tegaki/fonts/amiri");
    return Object.freeze({ bundle: amiri, requiresShaper: true });
  }

  const { default: caveat } = await import("tegaki/fonts/caveat");

  if (locale === "fr" || locale === "es" || locale === "ru") {
    const plainCaveat = withoutShapedVariants(caveat);
    return Object.freeze({
      bundle: {
        ...plainCaveat,
        glyphData: asGlyphData({ ...caveat.glyphData, ...LATIN_GREETING_GLYPHS }),
      },
      requiresShaper: false,
    });
  }

  if (locale === "zh-CN") {
    return Object.freeze({
      bundle: generatedBundle(caveat, {
        ascender: 880,
        descender: -120,
        family: "Ma Shan Zheng",
        glyphData: asGlyphData(SIMPLIFIED_CHINESE_GREETING_GLYPHS),
      }),
      requiresShaper: false,
    });
  }

  if (locale === "zh-TW") {
    return Object.freeze({
      bundle: generatedBundle(caveat, {
        ascender: 940,
        descender: -180,
        family: "Iansui",
        glyphData: asGlyphData(TRADITIONAL_CHINESE_GREETING_GLYPHS),
      }),
      requiresShaper: false,
    });
  }

  if (locale === "ja") {
    return Object.freeze({
      bundle: generatedBundle(caveat, {
        ascender: 1_160,
        descender: -288,
        family: "Klee One",
        glyphData: asGlyphData(JAPANESE_GREETING_GLYPHS),
      }),
      requiresShaper: false,
    });
  }

  return Object.freeze({
    bundle: generatedBundle(caveat, {
      ascender: 800,
      descender: -200,
      family: "Nanum Pen Script",
      glyphData: asGlyphData(KOREAN_GREETING_GLYPHS),
    }),
    requiresShaper: false,
  });
}
