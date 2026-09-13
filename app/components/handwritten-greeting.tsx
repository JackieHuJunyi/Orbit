"use client";

import { useEffect, useRef, useState } from "react";
import { TegakiRenderer, type TegakiBundle, type TegakiRendererHandle } from "tegaki";
import { loadGreetingFontPlan } from "../lib/greeting-font-bundles.ts";
import type { GreetingPresentationPlan } from "../lib/greeting-presentation";

const ORBIT_SPECTRUM = [
  "#050506",
  "#30d158",
  "#ffd60a",
  "#ff9f0a",
  "#ff453a",
  "#ff375f",
  "#bf5af2",
  "#0a84ff",
  "#050506",
] as const;

export const WELCOME_SIGNATURE_DURATION_SECONDS = 2.8;
export const WELCOME_SIGNATURE_COMPLETE_AFTER_MS = 3_040;

const easeInOutCubic = (value: number) =>
  value < 0.5 ? 4 * value * value * value : 1 - Math.pow(-2 * value + 2, 3) / 2;

function normalizedPenSpeed(locale: GreetingPresentationPlan["locale"]) {
  const writingFontSize =
    locale === "zh-CN" || locale === "zh-TW"
      ? 204
      : locale === "ja" || locale === "ko"
        ? 164
        : locale === "ar"
          ? 176
          : 188;
  return Math.round((188 / writingFontSize) * 1_000) / 1_000;
}

function hasCompleteGlyphCoverage(bundle: TegakiBundle, value: string) {
  return Array.from(value.normalize("NFC")).every(
    (character) => /[\p{Mark}\p{White_Space}]/u.test(character) || Boolean(bundle.glyphData?.[character]),
  );
}

export function HandwrittenGreeting({
  onWritingComplete,
  presentation,
  variant = "hero",
}: {
  onWritingComplete?: () => void;
  presentation: GreetingPresentationPlan;
  variant?: "hero" | "inline";
}) {
  const { direction, isLong, locale, motion, script, value } = presentation;
  const [fontBundle, setFontBundle] = useState<TegakiBundle | null>(null);
  const [fontLoadFailed, setFontLoadFailed] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const rendererRef = useRef<TegakiRendererHandle>(null);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const synchronize = () => setReducedMotion(media.matches);
    synchronize();
    media.addEventListener("change", synchronize);
    return () => media.removeEventListener("change", synchronize);
  }, []);

  useEffect(() => {
    let active = true;
    void loadGreetingFontPlan(locale)
      .then(async (plan) => {
        if (plan.requiresShaper) {
          const [{ TegakiEngine }, { default: harfbuzzShaper }] = await Promise.all([
            import("tegaki/core"),
            import("tegaki/shaper-harfbuzz"),
          ]);
          TegakiEngine.registerShaper(harfbuzzShaper);
        }
        if (active) setFontBundle(plan.bundle);
      })
      .catch(() => {
        if (active) setFontLoadFailed(true);
      });

    return () => {
      active = false;
    };
  }, [locale]);

  useEffect(() => {
    if (!fontBundle || reducedMotion) return;
    const frame = window.requestAnimationFrame(() => {
      rendererRef.current?.engine?.restart();
    });
    return () => window.cancelAnimationFrame(frame);
  }, [fontBundle, locale, reducedMotion, value, variant]);

  const className = `${variant === "inline" ? "welcome-signature" : "welcome-greeting"} ${isLong ? "long" : ""}`.trim();
  const penSpeed = normalizedPenSpeed(locale);
  const sharedData = {
    "data-direction": direction,
    "data-duration-scale": motion.durationScale,
    "data-greeting-locale": locale,
    "data-motion-count": motion.motionCount,
    "data-motion-renderer": "tegaki-font-centerline",
    "data-motion-timeline": "path-length-staggered",
    "data-motion-script": script,
    "data-ink-effect": "spectrum-write",
    "data-ink-material": "pressure-pencil-spectrum",
    "data-ink-motion": "path-reveal",
    "data-ink-trace": "progressive",
    "data-color-system": "apple-hello-spectrum",
    "data-boot-motion": "center-write-settle",
    "data-motion-sequence": "write-settle-reveal",
    "data-writing-continuity": script === "cursive" || script === "arabic" ? "connected" : "stroke-ordered",
    "data-writing-style": "font-derived-centerline",
    "data-pen-speed": penSpeed,
    "data-stroke-count": motion.motionCount,
  } as const;

  return (
    <div
      aria-label={value}
      className={className}
      {...sharedData}
      data-font-family={fontBundle?.family ?? "loading"}
      data-font-ready={fontBundle ? "true" : "false"}
      data-font-state={fontBundle ? "ready" : fontLoadFailed ? "fallback" : "loading"}
      data-glyph-coverage={
        fontBundle ? (hasCompleteGlyphCoverage(fontBundle, value) ? "complete" : "partial") : "loading"
      }
      data-writing-progress="0"
      role="img"
    >
      {fontBundle ? (
        <TegakiRenderer
          className="welcome-greeting-tegaki"
          direction={direction}
          effects={{
            globalGradient: { colors: [...ORBIT_SPECTRUM], angle: direction === "rtl" ? 180 : 0 },
            pressureWidth: { strength: 0.82 },
            taper: { startLength: 0.035, endLength: 0.075 },
            wobble: { amplitude: 0.26, frequency: 4.2, mode: "noise" },
          }}
          font={fontBundle}
          onComplete={onWritingComplete}
          quality={{ pixelRatio: 1.35, segmentSize: 1.35, smoothing: true }}
          ref={rendererRef}
          shaper={locale === "ar"}
          showOverlay={false}
          style={{ color: "#f5f5f7", fontSize: "inherit", letterSpacing: "inherit", lineHeight: 1 }}
          text={value}
          time={
            reducedMotion
              ? "100%"
              : {
                  mode: "uncontrolled",
                  delay: 0.12,
                  ...(variant === "inline"
                    ? { duration: WELCOME_SIGNATURE_DURATION_SECONDS }
                    : { speed: penSpeed / motion.durationScale }),
                  easing: easeInOutCubic,
                  loop: false,
                  onTimeChange: (time) => {
                    const handle = rendererRef.current;
                    const duration = handle?.engine?.duration ?? 0;
                    handle?.element?.parentElement?.setAttribute(
                      "data-writing-progress",
                      duration > 0 ? String(Math.min(1, time / duration)) : "0",
                    );
                  },
                }
          }
          timing={{ deferDots: true, glyphGap: 0.04 }}
        />
      ) : (
        <span className={`welcome-greeting-loading ${fontLoadFailed ? "fallback" : ""}`.trim()} aria-hidden="true">
          {value}
        </span>
      )}
    </div>
  );
}
