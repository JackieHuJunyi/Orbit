export type GreetingWritingDirection = "ltr" | "rtl";

export type GreetingMotionPlan = Readonly<{
  finishDelayMs: number;
  motionCount: number;
  settleDelayMs: number;
  unitDurationMs: number;
  writeDurationMs: number;
  writePath: string;
}>;

function boundedCount(value: string) {
  const count = Array.from(value.normalize("NFC")).filter((character) =>
    /[^\p{Mark}\p{White_Space}]/u.test(character),
  ).length;
  return Math.max(1, Math.min(14, count));
}

export function planGreetingMotion({
  canvasWidth,
  direction,
  unitCount,
  value,
}: {
  canvasWidth: number;
  direction: GreetingWritingDirection;
  unitCount: number;
  value: string;
}): GreetingMotionPlan {
  const width = Number.isFinite(canvasWidth) ? Math.max(430, Math.min(1040, Math.round(canvasWidth))) : 430;
  const boundedUnitCount = Number.isFinite(unitCount) ? Math.max(1, Math.min(14, Math.round(unitCount))) : 1;
  const motionCount = direction === "rtl" ? boundedCount(value) : boundedUnitCount;
  const unitDurationMs = direction === "rtl" ? Math.min(2_650, 1_260 + motionCount * 145) : 1_180;
  const writeDurationMs = direction === "rtl" ? unitDurationMs : unitDurationMs + Math.max(0, motionCount - 1) * 124;
  const settleDelayMs = direction === "rtl" ? Math.round(writeDurationMs * 0.54) : 610;
  const finishDelayMs = Math.max(960, writeDurationMs - 100);
  const start = direction === "rtl" ? width - 40 : 40;
  const end = direction === "rtl" ? 40 : width - 40;
  const firstControl = direction === "rtl" ? width * 0.82 : width * 0.18;
  const secondControl = direction === "rtl" ? width * 0.66 : width * 0.34;
  const fourthControl = direction === "rtl" ? width * 0.22 : width * 0.78;
  const writePath = `M${start} 145 C${Math.round(firstControl)} 116 ${Math.round(secondControl)} 172 ${Math.round(width * 0.5)} 142 S${Math.round(fourthControl)} 120 ${end} 148`;

  return Object.freeze({
    finishDelayMs,
    motionCount,
    settleDelayMs,
    unitDurationMs,
    writeDurationMs,
    writePath,
  });
}
