"use client";

import { useId, type AnimationEvent, type CSSProperties, type SVGProps } from "react";
import type { GreetingPresentationPlan } from "../lib/greeting-presentation";

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
  onWritingComplete,
  presentation,
}: {
  onWritingComplete?: () => void;
  presentation: GreetingPresentationPlan;
}) {
  const { canvasWidth, direction, isLong, locale, motion, script, value } = presentation;
  const identifier = useId().replaceAll(":", "");
  const gradientId = `rune-greeting-spectrum-${identifier}`;
  const auraId = `rune-greeting-aura-${identifier}`;
  const inkTextureId = `rune-greeting-ink-texture-${identifier}`;
  const revealMaskId = `rune-greeting-reveal-${identifier}`;

  return (
    <svg
      aria-label={value}
      className={`welcome-greeting ${isLong ? "long" : ""}`.trim()}
      data-direction={direction}
      data-duration-scale={motion.durationScale}
      data-greeting-locale={locale}
      data-motion-count={motion.motionCount}
      data-motion-renderer="calligraphic-mask"
      data-motion-timeline="path-length-staggered"
      data-motion-script={script}
      data-ink-effect="spectrum-path"
      data-ink-material="luminous-spectrum"
      data-ink-motion="path-front"
      data-ink-trace="progressive"
      data-color-system="apple-six-color"
      data-boot-motion="center-write-dock-unfold"
      data-motion-sequence="write-settle-reveal"
      data-writing-continuity={script === "cursive" || script === "arabic" ? "connected" : "stroke-ordered"}
      data-writing-style="pressure-calligraphy"
      data-stroke-count={motion.strokes.length}
      preserveAspectRatio="xMidYMid meet"
      role="img"
      style={
        {
          "--greeting-cycle-duration": `${motion.cycleDurationMs}ms`,
          "--greeting-settle-delay": `${motion.settleDelayMs}ms`,
          "--greeting-settle-duration": `${motion.settleDurationMs}ms`,
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
        <filter colorInterpolationFilters="sRGB" height="190%" id={auraId} width="136%" x="-18%" y="-45%">
          <feGaussianBlur stdDeviation="8" />
        </filter>
        <filter colorInterpolationFilters="sRGB" height="130%" id={inkTextureId} width="106%" x="-3%" y="-15%">
          <feTurbulence baseFrequency="0.72" numOctaves="2" result="inkGrain" seed="17" type="fractalNoise" />
          <feDisplacementMap in="SourceGraphic" in2="inkGrain" scale="0.44" xChannelSelector="R" yChannelSelector="G" />
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

      <g aria-hidden="true" className="welcome-greeting-color-bloom" filter={`url(#${auraId})`}>
        <GreetingText
          className="welcome-greeting-fill welcome-greeting-fill-aura"
          canvasWidth={canvasWidth}
          direction={direction}
          gradientId={gradientId}
          mask={`url(#${revealMaskId})`}
          value={value}
        />
      </g>
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
          <path
            className="welcome-greeting-stroke-head-ink"
            d="M -5.8 1.2 C -3.6 -2.4 1.4 -3.1 5.3 -1 C 2.8 2.2 -2.1 3.4 -5.8 1.2 Z"
            fill={`url(#${gradientId})`}
          />
        </g>
      ))}
    </svg>
  );
}
