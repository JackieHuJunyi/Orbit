"use client";

import { useId, useMemo, type CSSProperties, type SVGProps } from "react";
import { planGreetingMotion, type GreetingWritingScript } from "../lib/greeting-motion";
import { localeDirection, type RuneLocale } from "../lib/localization";

function greetingUnits(value: string, locale: RuneLocale) {
  if (localeDirection(locale) === "rtl") return [value];
  return value.match(/\P{Mark}\p{Mark}*|\p{Mark}+/gu) ?? Array.from(value);
}

function greetingScript(locale: RuneLocale): GreetingWritingScript {
  if (locale === "ar") return "arabic";
  if (locale === "ja") return "kana";
  if (locale === "ko") return "hangul";
  if (locale === "zh-CN" || locale === "zh-TW") return "logographic";
  return "cursive";
}

function GreetingText({
  className,
  canvasWidth,
  direction,
  gradientId,
  value,
  ...props
}: {
  className: string;
  canvasWidth: number;
  direction: "ltr" | "rtl";
  gradientId: string;
  value: string;
} & SVGProps<SVGTextElement>) {
  return (
    <text
      {...props}
      className={className}
      direction={direction}
      fill={className.includes("fill") ? `url(#${gradientId})` : "none"}
      stroke={className.includes("fill") ? "none" : `url(#${gradientId})`}
      textAnchor={direction === "rtl" ? "end" : "start"}
      x={direction === "rtl" ? canvasWidth - 36 : 36}
      y="166"
    >
      {value}
    </text>
  );
}

export function HandwrittenGreeting({
  cycleDuration,
  locale,
  value,
}: {
  cycleDuration: number;
  locale: RuneLocale;
  value: string;
}) {
  const direction = localeDirection(locale);
  const script = greetingScript(locale);
  const units = useMemo(() => greetingUnits(value, locale), [locale, value]);
  const identifier = useId().replaceAll(":", "");
  const gradientId = `rune-greeting-spectrum-${identifier}`;
  const glowId = `rune-greeting-glow-${identifier}`;
  const revealMaskId = `rune-greeting-reveal-${identifier}`;
  const compactScript = locale === "zh-CN" || locale === "zh-TW" || locale === "ja" || locale === "ko";
  const canvasWidth =
    locale === "ar" ? 680 : Math.round(Math.min(1040, Math.max(430, value.length * (compactScript ? 155 : 82) + 100)));
  const isLong = canvasWidth > 900;
  const motion = useMemo(
    () => planGreetingMotion({ canvasWidth, direction, script, unitCount: units.length, value }),
    [canvasWidth, direction, script, units.length, value],
  );

  return (
    <svg
      aria-label={value}
      className={`welcome-greeting ${isLong ? "long" : ""}`.trim()}
      data-direction={direction}
      data-greeting-locale={locale}
      data-motion-count={motion.motionCount}
      data-motion-script={script}
      data-stroke-count={motion.strokes.length}
      preserveAspectRatio="xMidYMid meet"
      role="img"
      style={
        {
          "--greeting-cycle-duration": `${cycleDuration}ms`,
          "--greeting-settle-delay": `${motion.settleDelayMs}ms`,
          "--greeting-write-duration": `${motion.writeDurationMs}ms`,
        } as CSSProperties
      }
      viewBox={`0 0 ${canvasWidth} 220`}
    >
      <defs>
        <linearGradient gradientUnits="userSpaceOnUse" id={gradientId} x1="22" x2={canvasWidth - 22} y1="34" y2="190">
          <stop offset="0" stopColor="#ff375f" />
          <stop offset="0.14" stopColor="#ff9f0a" />
          <stop offset="0.27" stopColor="#ffd60a" />
          <stop offset="0.4" stopColor="#30d158" />
          <stop offset="0.54" stopColor="#64d2ff" />
          <stop offset="0.67" stopColor="#0a84ff" />
          <stop offset="0.8" stopColor="#5e5ce6" />
          <stop offset="0.91" stopColor="#bf5af2" />
          <stop offset="1" stopColor="#ff375f" />
        </linearGradient>
        <filter height="180%" id={glowId} width="130%" x="-15%" y="-40%">
          <feGaussianBlur stdDeviation="5.5" />
        </filter>
        <mask height="220" id={revealMaskId} maskUnits="userSpaceOnUse" width={canvasWidth} x="0" y="0">
          {motion.strokes.map((stroke, index) => (
            <path
              className="welcome-greeting-reveal-stroke"
              d={stroke.path}
              fill="none"
              key={`${index}-${stroke.path}`}
              pathLength="1"
              stroke="white"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={stroke.strokeWidth}
              style={
                {
                  "--greeting-stroke-delay": `${stroke.delayMs}ms`,
                  "--greeting-stroke-duration": `${stroke.durationMs}ms`,
                } as CSSProperties
              }
            />
          ))}
        </mask>
      </defs>

      <GreetingText
        className="welcome-greeting-fill welcome-greeting-fill-glow"
        canvasWidth={canvasWidth}
        direction={direction}
        filter={`url(#${glowId})`}
        gradientId={gradientId}
        mask={`url(#${revealMaskId})`}
        value={value}
      />
      <GreetingText
        className="welcome-greeting-fill welcome-greeting-fill-reveal"
        canvasWidth={canvasWidth}
        direction={direction}
        gradientId={gradientId}
        mask={`url(#${revealMaskId})`}
        value={value}
      />
      <GreetingText
        className="welcome-greeting-fill welcome-greeting-fill-settled"
        canvasWidth={canvasWidth}
        direction={direction}
        gradientId={gradientId}
        value={value}
      />
      {motion.strokes.map((stroke, index) => (
        <g
          className="welcome-greeting-stroke-head"
          aria-hidden="true"
          data-stroke-index={index}
          key={`head-${index}-${stroke.path}`}
          style={
            {
              "--greeting-stroke-delay": `${stroke.delayMs}ms`,
              "--greeting-stroke-duration": `${stroke.durationMs}ms`,
              offsetPath: `path("${stroke.path}")`,
              offsetRotate: "auto",
            } as CSSProperties
          }
        >
          <circle className="welcome-greeting-stroke-head-bloom" cx="0" cy="0" r="10" />
          <ellipse
            className="welcome-greeting-stroke-head-ink"
            cx="0"
            cy="0"
            fill={`url(#${gradientId})`}
            rx="4.6"
            ry="2.3"
          />
        </g>
      ))}
    </svg>
  );
}
