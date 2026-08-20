"use client";

import { useId, useMemo, type CSSProperties, type SVGProps } from "react";
import { planGreetingMotion } from "../lib/greeting-motion";
import { localeDirection, type RuneLocale } from "../lib/localization";

function greetingUnits(value: string, locale: RuneLocale) {
  if (localeDirection(locale) === "rtl") return [value];
  return value.match(/\P{Mark}\p{Mark}*|\p{Mark}+/gu) ?? Array.from(value);
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
    () => planGreetingMotion({ canvasWidth, direction, unitCount: units.length, value }),
    [canvasWidth, direction, units.length, value],
  );
  const flourishPath =
    direction === "rtl"
      ? `M${canvasWidth - 40} 179 C${canvasWidth * 0.76} 202 ${canvasWidth * 0.38} 190 40 179`
      : `M40 179 C${canvasWidth * 0.38} 190 ${canvasWidth * 0.76} 202 ${canvasWidth - 40} 179`;

  return (
    <svg
      aria-label={value}
      className={`welcome-greeting ${isLong ? "long" : ""}`.trim()}
      data-direction={direction}
      data-greeting-locale={locale}
      data-motion-count={motion.motionCount}
      preserveAspectRatio="xMidYMid meet"
      role="img"
      style={
        {
          "--greeting-cycle-duration": `${cycleDuration}ms`,
          "--greeting-finish-delay": `${motion.finishDelayMs}ms`,
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
          <path
            className="welcome-greeting-reveal"
            d={motion.writePath}
            fill="none"
            pathLength="1"
            stroke="white"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="176"
          />
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
      <g
        className="welcome-greeting-writehead"
        aria-hidden="true"
        style={{ offsetPath: `path("${motion.writePath}")`, offsetRotate: "auto" }}
      >
        <circle className="welcome-greeting-writehead-halo" cx="0" cy="0" r="14" />
        <ellipse className="welcome-greeting-writehead-nib" cx="0" cy="0" rx="4.8" ry="2.1" />
      </g>
      <path
        className="welcome-greeting-flourish"
        d={flourishPath}
        fill="none"
        pathLength="1"
        stroke={`url(#${gradientId})`}
      />
      <g
        className="welcome-greeting-pen"
        aria-hidden="true"
        style={{ offsetPath: `path("${flourishPath}")`, offsetRotate: "0deg" }}
      >
        <circle className="welcome-greeting-pen-halo" cx="0" cy="0" r="13" />
        <circle className="welcome-greeting-pen-point" cx="0" cy="0" r="3.6" />
      </g>
    </svg>
  );
}
