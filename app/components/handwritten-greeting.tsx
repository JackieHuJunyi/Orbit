"use client";

import { useId, useMemo, type CSSProperties, type SVGProps } from "react";
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
  units,
  ...props
}: {
  className: string;
  canvasWidth: number;
  direction: "ltr" | "rtl";
  gradientId: string;
  units: string[];
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
      {units.map((unit, index) => (
        <tspan
          className="welcome-greeting-ink-unit"
          style={{ "--greeting-order": index } as CSSProperties}
          key={`${unit}-${index}`}
        >
          {unit}
        </tspan>
      ))}
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
  const compactScript = locale === "zh-CN" || locale === "zh-TW" || locale === "ja" || locale === "ko";
  const canvasWidth =
    locale === "ar" ? 680 : Math.round(Math.min(1040, Math.max(430, value.length * (compactScript ? 155 : 82) + 100)));
  const isLong = canvasWidth > 900;
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
      preserveAspectRatio="xMinYMid meet"
      role="img"
      style={
        {
          "--greeting-count": units.length,
          "--greeting-cycle-duration": `${cycleDuration}ms`,
        } as CSSProperties
      }
      viewBox={`0 0 ${canvasWidth} 220`}
    >
      <defs>
        <linearGradient gradientUnits="userSpaceOnUse" id={gradientId} x1="22" x2={canvasWidth - 22} y1="34" y2="190">
          <stop offset="0" stopColor="#ff375f" />
          <stop offset="0.18" stopColor="#ff9f0a" />
          <stop offset="0.32" stopColor="#ffd60a" />
          <stop offset="0.49" stopColor="#30d158" />
          <stop offset="0.65" stopColor="#64d2ff" />
          <stop offset="0.8" stopColor="#0a84ff" />
          <stop offset="1" stopColor="#bf5af2" />
        </linearGradient>
        <filter height="180%" id={glowId} width="130%" x="-15%" y="-40%">
          <feGaussianBlur stdDeviation="5.5" />
        </filter>
      </defs>

      <GreetingText
        className="welcome-greeting-trace welcome-greeting-trace-glow"
        canvasWidth={canvasWidth}
        direction={direction}
        filter={`url(#${glowId})`}
        gradientId={gradientId}
        units={units}
      />
      <GreetingText
        className="welcome-greeting-trace welcome-greeting-trace-edge"
        canvasWidth={canvasWidth}
        direction={direction}
        gradientId={gradientId}
        units={units}
      />
      <GreetingText
        className="welcome-greeting-fill"
        canvasWidth={canvasWidth}
        direction={direction}
        gradientId={gradientId}
        units={units}
      />
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
