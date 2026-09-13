import type { TegakiBundle } from "tegaki";
import type { OrbitLocale } from "./localization.ts";
import caveatGlyphData from "./greeting-glyph-data/caveat.json";
import iansuiGlyphData from "./greeting-glyph-data/iansui.json";
import maShanZhengGlyphData from "./greeting-glyph-data/ma-shan-zheng.json";
import nanumPenScriptGlyphData from "./greeting-glyph-data/nanum-pen-script.json";

type GreetingFontPlan = Readonly<{
  bundle: TegakiBundle;
  requiresShaper: boolean;
}>;

function asGlyphData(value: unknown) {
  return value as TegakiBundle["glyphData"];
}

function generatedBundle(
  input: Readonly<{
    ascender: number;
    descender: number;
    family: string;
    fontUrl: string;
    glyphData: TegakiBundle["glyphData"];
  }>,
): TegakiBundle {
  return {
    version: 0,
    family: `Orbit ${input.family}`,
    lineCap: "round",
    fontUrl: input.fontUrl,
    fontFaceCSS: `@font-face { font-family: 'Orbit ${input.family}'; src: url(${input.fontUrl}) format('truetype'); }`,
    unitsPerEm: 1_000,
    ascender: input.ascender,
    descender: input.descender,
    glyphData: input.glyphData,
  };
}

export async function loadGreetingFontPlan(locale: OrbitLocale): Promise<GreetingFontPlan> {
  if (locale === "ar") {
    const { default: amiri } = await import("tegaki/fonts/amiri");
    return Object.freeze({ bundle: amiri, requiresShaper: true });
  }

  if (locale === "zh-CN") {
    return Object.freeze({
      bundle: generatedBundle({
        ascender: 880,
        descender: -120,
        family: "Ma Shan Zheng",
        fontUrl: "/fonts/greeting/ma-shan-zheng.ttf",
        glyphData: asGlyphData(maShanZhengGlyphData),
      }),
      requiresShaper: false,
    });
  }

  if (locale === "zh-TW") {
    return Object.freeze({
      bundle: generatedBundle({
        ascender: 940,
        descender: -180,
        family: "Iansui",
        fontUrl: "/fonts/greeting/iansui.ttf",
        glyphData: asGlyphData(iansuiGlyphData),
      }),
      requiresShaper: false,
    });
  }

  if (locale === "ja") {
    const { default: kleeOne } = await import("tegaki/fonts/klee-one");
    return Object.freeze({
      bundle: kleeOne,
      requiresShaper: false,
    });
  }

  if (locale === "ko") {
    return Object.freeze({
      bundle: generatedBundle({
        ascender: 800,
        descender: -200,
        family: "Nanum Pen Script",
        fontUrl: "/fonts/greeting/nanum-pen-script.ttf",
        glyphData: asGlyphData(nanumPenScriptGlyphData),
      }),
      requiresShaper: false,
    });
  }

  return Object.freeze({
    bundle: generatedBundle({
      ascender: 960,
      descender: -300,
      family: "Caveat",
      fontUrl: "/fonts/greeting/caveat.ttf",
      glyphData: asGlyphData(caveatGlyphData),
    }),
    requiresShaper: false,
  });
}
