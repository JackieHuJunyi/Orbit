import { planGreetingMotion, type GreetingMotionPlan, type GreetingWritingScript } from "./greeting-motion.ts";
import { localeDirection, type OrbitLocale } from "./localization.ts";

export type GreetingPresentationPlan = Readonly<{
  canvasWidth: number;
  completeAfterMs: number;
  direction: "ltr" | "rtl";
  isLong: boolean;
  locale: OrbitLocale;
  motion: GreetingMotionPlan;
  renderMode: "tegaki-font";
  script: GreetingWritingScript;
  value: string;
}>;

function greetingUnits(value: string, locale: OrbitLocale) {
  if (localeDirection(locale) === "rtl") return [value];
  return value.match(/\P{Mark}\p{Mark}*|\p{Mark}+/gu) ?? Array.from(value);
}

function greetingScript(locale: OrbitLocale): GreetingWritingScript {
  if (locale === "ar") return "arabic";
  if (locale === "ja") return "kana";
  if (locale === "ko") return "hangul";
  if (locale === "zh-CN" || locale === "zh-TW") return "logographic";
  return "cursive";
}

export function planGreetingPresentation({
  durationScale,
  locale,
  value,
}: {
  durationScale?: number;
  locale: OrbitLocale;
  value: string;
}): GreetingPresentationPlan {
  const direction = localeDirection(locale);
  const script = greetingScript(locale);
  const units = greetingUnits(value, locale);
  const renderMode = "tegaki-font" as const;
  const compactScript = script === "logographic" || script === "kana" || script === "hangul";
  const canvasWidth =
    locale === "ar" ? 680 : Math.round(Math.min(1040, Math.max(430, value.length * (compactScript ? 155 : 82) + 100)));
  const motion = planGreetingMotion({
    canvasWidth,
    direction,
    durationScale,
    script,
    unitCount: units.length,
    value,
  });
  const isLong = canvasWidth > 900;

  return Object.freeze({
    canvasWidth,
    completeAfterMs: Math.round(9_000 * motion.durationScale),
    direction,
    isLong,
    locale,
    motion,
    renderMode,
    script,
    value,
  });
}
