"use client";

import { useId, useMemo, type AnimationEvent, type CSSProperties, type SVGProps } from "react";
import { planGreetingMotion, type GreetingWritingScript } from "../lib/greeting-motion";
import { localeDirection, type RuneLocale } from "../lib/localization";

const SPECTRUM_INK = [
  ["#ff375f", "#ff6482"],
  ["#ff9f0a", "#ffc548"],
  ["#ffd60a", "#d9f13d"],
  ["#30d158", "#5ee49b"],
  ["#64d2ff", "#4bb8ff"],
  ["#0a84ff", "#5e8cff"],
  ["#5e5ce6", "#8b72ff"],
  ["#bf5af2", "#ee68d8"],
  ["#ff375f", "#ff765d"],
] as const;

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
  onWritingComplete,
  value,
}: {
  cycleDuration: number;
  locale: RuneLocale;
  onWritingComplete?: () => void;
  value: string;
}) {
  const direction = localeDirection(locale);
  const script = greetingScript(locale);
  const units = useMemo(() => greetingUnits(value, locale), [locale, value]);
  const identifier = useId().replaceAll(":", "");
  const gradientId = `rune-greeting-spectrum-${identifier}`;
  const glowId = `rune-greeting-glow-${identifier}`;
  const trailGlowId = `rune-greeting-trail-glow-${identifier}`;
  const inkTextureId = `rune-greeting-ink-texture-${identifier}`;
  const revealMaskId = `rune-greeting-reveal-${identifier}`;
  const textClipId = `rune-greeting-text-${identifier}`;
  const sheenId = `rune-greeting-sheen-${identifier}`;
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
      data-motion-renderer="calligraphic-mask"
      data-motion-script={script}
      data-ink-effect="spectrum-sheen"
      data-ink-trace="progressive"
      data-motion-sequence="write-settle-reveal"
      data-writing-style="pressure-calligraphy"
      data-stroke-count={motion.strokes.length}
      preserveAspectRatio="xMidYMid meet"
      role="img"
      style={
        {
          "--greeting-cycle-duration": `${cycleDuration}ms`,
          "--greeting-settle-delay": `${motion.settleDelayMs}ms`,
          "--greeting-sheen-delay": `${motion.settleDelayMs + 120}ms`,
          "--greeting-sheen-distance": `${Math.round(canvasWidth * 1.48)}px`,
          "--greeting-write-duration": `${motion.writeDurationMs}ms`,
        } as CSSProperties
      }
      viewBox={`0 0 ${canvasWidth} 220`}
    >
      <defs>
        <linearGradient
          className="welcome-greeting-spectrum"
          gradientUnits="userSpaceOnUse"
          id={gradientId}
          x1="22"
          x2={canvasWidth - 22}
          y1="34"
          y2="190"
        >
          {SPECTRUM_INK.map(([color, nextColor], index) => (
            <stop
              key={`${color}-${index}`}
              offset={index / (SPECTRUM_INK.length - 1)}
              stopColor={color}
              style={
                {
                  "--greeting-spectrum-color": color,
                  "--greeting-spectrum-next": nextColor,
                  "--greeting-spectrum-delay": `${index * -170}ms`,
                } as CSSProperties
              }
            />
          ))}
        </linearGradient>
        <linearGradient className="welcome-greeting-sheen-gradient" id={sheenId} x1="0" x2="1" y1="0" y2="0">
          <stop offset="0" stopColor="white" stopOpacity="0" />
          <stop offset="0.42" stopColor="white" stopOpacity="0" />
          <stop offset="0.5" stopColor="white" stopOpacity="0.7" />
          <stop offset="0.58" stopColor="white" stopOpacity="0" />
          <stop offset="1" stopColor="white" stopOpacity="0" />
        </linearGradient>
        <filter height="180%" id={glowId} width="130%" x="-15%" y="-40%">
          <feGaussianBlur stdDeviation="5.5" />
        </filter>
        <filter height="180%" id={trailGlowId} width="140%" x="-20%" y="-40%">
          <feGaussianBlur stdDeviation="2.8" />
        </filter>
        <filter height="130%" id={inkTextureId} width="106%" x="-3%" y="-15%">
          <feTurbulence baseFrequency="0.72" numOctaves="2" result="inkGrain" seed="17" type="fractalNoise" />
          <feDisplacementMap in="SourceGraphic" in2="inkGrain" scale="0.72" xChannelSelector="R" yChannelSelector="G" />
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
        <clipPath id={textClipId}>
          <text
            direction={direction}
            textAnchor={direction === "rtl" ? "end" : "start"}
            x={direction === "rtl" ? canvasWidth - 36 : 36}
            y="166"
          >
            {value}
          </text>
        </clipPath>
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
      <g className="welcome-greeting-ink-texture" filter={`url(#${inkTextureId})`}>
        <GreetingText
          className="welcome-greeting-fill welcome-greeting-fill-reveal"
          canvasWidth={canvasWidth}
          direction={direction}
          gradientId={gradientId}
          mask={`url(#${revealMaskId})`}
          value={value}
        />
      </g>
      <g
        aria-hidden="true"
        className="welcome-greeting-ink-trails welcome-greeting-ink-trails-glow"
        clipPath={`url(#${textClipId})`}
        filter={`url(#${trailGlowId})`}
      >
        {motion.strokes.map((stroke, index) => (
          <path
            className="welcome-greeting-ink-trail"
            d={stroke.path}
            fill="none"
            key={`trail-glow-${index}-${stroke.path}`}
            pathLength="1"
            stroke={`url(#${gradientId})`}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={Math.max(6, Math.round(stroke.strokeWidth * 0.2))}
            style={
              {
                "--greeting-stroke-delay": `${stroke.delayMs}ms`,
                "--greeting-stroke-duration": `${stroke.durationMs}ms`,
              } as CSSProperties
            }
          />
        ))}
      </g>
      <g aria-hidden="true" className="welcome-greeting-ink-trails" clipPath={`url(#${textClipId})`}>
        {motion.strokes.map((stroke, index) => (
          <path
            className="welcome-greeting-ink-trail"
            d={stroke.path}
            fill="none"
            key={`trail-${index}-${stroke.path}`}
            pathLength="1"
            stroke={`url(#${gradientId})`}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={Math.max(2.8, Math.round(stroke.strokeWidth * 0.075 * 10) / 10)}
            style={
              {
                "--greeting-stroke-delay": `${stroke.delayMs}ms`,
                "--greeting-stroke-duration": `${stroke.durationMs}ms`,
              } as CSSProperties
            }
          />
        ))}
      </g>
      <g
        aria-hidden="true"
        className="welcome-greeting-ink-trails welcome-greeting-ink-bristles"
        clipPath={`url(#${textClipId})`}
      >
        {motion.strokes.map((stroke, index) => (
          <path
            className="welcome-greeting-ink-trail welcome-greeting-ink-bristle"
            d={stroke.path}
            fill="none"
            key={`bristle-${index}-${stroke.path}`}
            pathLength="1"
            stroke="rgba(255,255,255,.72)"
            strokeDasharray="0.024 0.018"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={Math.max(0.9, Math.round(stroke.strokeWidth * 0.022 * 10) / 10)}
            style={
              {
                "--greeting-stroke-delay": `${stroke.delayMs + 24}ms`,
                "--greeting-stroke-duration": `${Math.max(110, stroke.durationMs - 24)}ms`,
              } as CSSProperties
            }
          />
        ))}
      </g>
      <g className="welcome-greeting-ink-texture" filter={`url(#${inkTextureId})`}>
        <GreetingText
          className="welcome-greeting-fill welcome-greeting-fill-settled"
          canvasWidth={canvasWidth}
          direction={direction}
          gradientId={gradientId}
          onAnimationEnd={(event: AnimationEvent<SVGTextElement>) => {
            if (event.animationName === "rune-greeting-ink-settle") onWritingComplete?.();
          }}
          value={value}
        />
      </g>
      <g aria-hidden="true" clipPath={`url(#${textClipId})`} mask={`url(#${revealMaskId})`}>
        <rect
          className="welcome-greeting-ink-sheen"
          fill={`url(#${sheenId})`}
          height="220"
          width={Math.round(canvasWidth * 0.42)}
          x={Math.round(canvasWidth * -0.46)}
          y="0"
        />
      </g>
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
          <ellipse className="welcome-greeting-stroke-head-bristle" cx="-1.2" cy="1.3" rx="3.1" ry=".42" />
          <ellipse className="welcome-greeting-stroke-head-bristle" cx="-.4" cy="-1.25" rx="2.6" ry=".34" />
          <ellipse className="welcome-greeting-stroke-head-light" cx="-0.8" cy="-0.6" rx="1.7" ry="0.55" />
        </g>
      ))}
    </svg>
  );
}
