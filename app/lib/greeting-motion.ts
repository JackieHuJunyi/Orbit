export type GreetingWritingDirection = "ltr" | "rtl";
export type GreetingWritingScript = "arabic" | "cursive" | "hangul" | "kana" | "logographic";

export type GreetingMotionStroke = Readonly<{
  delayMs: number;
  durationMs: number;
  path: string;
  strokeWidth: number;
}>;

export type GreetingMotionPlan = Readonly<{
  completeAfterMs: number;
  cycleDurationMs: number;
  durationScale: number;
  motionCount: number;
  settleDurationMs: number;
  settleDelayMs: number;
  strokes: readonly GreetingMotionStroke[];
  writeDurationMs: number;
}>;

type RawStroke = Readonly<{
  path: string;
  strokeWidth: number;
  weight: number;
}>;

const INITIAL_DELAY_MS = 120;
const STROKE_GAP_MS = 28;
const SETTLE_GAP_MS = 72;
const SETTLE_DURATION_MS = 620;
const MINIMUM_CYCLE_MS = 5_000;
const MAXIMUM_CYCLE_MS = 7_000;
const FINISHED_HOLD_MS = 1_200;

function boundedDurationScale(value: number | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value)) return 1;
  return Math.max(0.6, Math.min(1.6, value));
}

function scaledMilliseconds(value: number, durationScale: number) {
  return Math.round(value * durationScale);
}

function boundedCount(value: string) {
  const count = Array.from(value.normalize("NFC")).filter((character) =>
    /[^\p{Mark}\p{White_Space}]/u.test(character),
  ).length;
  return Math.max(1, Math.min(14, count));
}

function point(value: number) {
  return Math.round(value * 10) / 10;
}

function mirrorX(path: string, width: number) {
  let coordinateIndex = 0;
  return path.replace(/-?\d+(?:\.\d+)?/g, (token) => {
    const value = Number(token);
    const isX = coordinateIndex % 2 === 0;
    coordinateIndex += 1;
    return String(point(isX ? width - value : value));
  });
}

function cursiveBodyPaths(width: number, count: number) {
  const margin = 40;
  const openingWidth = Math.min(104, (width - margin * 2) / Math.max(2.8, count));
  const start = margin + openingWidth * 0.66;
  const end = width - margin;
  const segments = Math.max(1, Math.min(10, count - 1));
  const segmentWidth = (end - start) / segments;
  return Array.from({ length: segments }, (_, index) => {
    const segmentStart = start + segmentWidth * index;
    const segmentEnd = segmentStart + segmentWidth;
    const upper = 91 + (index % 3) * 6;
    const lower = 173 - (index % 2) * 7;
    const exit = index === segments - 1 ? Math.min(width - 24, segmentEnd + 17) : segmentEnd;
    return `M${point(segmentStart)} 148 C${point(segmentStart + segmentWidth * 0.14)} ${upper} ${point(
      segmentStart + segmentWidth * 0.4,
    )} ${upper - 9} ${point(segmentStart + segmentWidth * 0.49)} 132 C${point(
      segmentStart + segmentWidth * 0.57,
    )} ${lower} ${point(segmentStart + segmentWidth * 0.82)} ${lower} ${point(
      segmentEnd,
    )} ${index === segments - 1 ? 148 : 144} C${point(segmentEnd + (exit - segmentEnd) * 0.48)} 146 ${point(
      segmentEnd + (exit - segmentEnd) * 0.78,
    )} 140 ${point(exit)} 136`;
  });
}

function connectedCursiveBodyPath(width: number, count: number) {
  return cursiveBodyPaths(width, count)
    .map((path, index) => (index === 0 ? path : path.replace(/^M-?\d+(?:\.\d+)? -?\d+(?:\.\d+)? /, "")))
    .join(" ");
}

function cursiveStrokes(width: number, count: number, direction: GreetingWritingDirection): RawStroke[] {
  const margin = 40;
  const openingWidth = Math.min(104, (width - margin * 2) / Math.max(2.8, count));
  const openingEnd = margin + openingWidth;
  const raw: RawStroke[] = [
    {
      path: `M${margin + 8} 174 C${margin + 3} 128 ${margin + 5} 73 ${point(
        margin + openingWidth * 0.38,
      )} 69 C${point(margin + openingWidth * 0.76)} 66 ${point(margin + openingWidth * 0.72)} 112 ${point(
        margin + openingWidth * 0.43,
      )} 133 C${point(margin + openingWidth * 0.3)} 143 ${point(margin + openingWidth * 0.48)} 151 ${point(
        openingEnd,
      )} 146`,
      strokeWidth: 52,
      weight: 0.26,
    },
    {
      path: `M${point(margin + 4)} 121 C${point(margin + openingWidth * 0.28)} 116 ${point(
        margin + openingWidth * 0.62,
      )} 116 ${point(openingEnd - 3)} 121`,
      strokeWidth: 24,
      weight: 0.09,
    },
    {
      path: connectedCursiveBodyPath(width, count),
      strokeWidth: 52,
      weight: 0.65,
    },
  ];

  if (direction === "ltr") return raw;
  return raw.map((stroke) => ({ ...stroke, path: mirrorX(stroke.path, width) }));
}

function compactScriptStrokes(
  width: number,
  unitCount: number,
  script: Exclude<GreetingWritingScript, "arabic" | "cursive">,
): RawStroke[] {
  const margin = 40;
  const count = Math.max(1, Math.min(script === "logographic" ? 4 : 6, unitCount));
  const slot = (width - margin * 2) / count;
  const strokes: RawStroke[] = [];

  for (let index = 0; index < count; index += 1) {
    const left = margin + slot * index;
    const right = left + slot;
    const middle = left + slot * 0.5;
    const brushWidth = script === "hangul" ? 44 : script === "kana" ? 47 : 51;

    strokes.push({
      path: `M${point(left + slot * 0.12)} ${88 + (index % 2) * 8} C${point(
        left + slot * 0.34,
      )} ${77 + (index % 3) * 7} ${point(left + slot * 0.69)} ${82 + (index % 2) * 9} ${point(
        right - slot * 0.1,
      )} ${91 + (index % 3) * 5}`,
      strokeWidth: brushWidth,
      weight: 1,
    });
    strokes.push({
      path: `M${point(middle - slot * 0.13)} 63 C${point(middle + slot * 0.06)} 93 ${point(
        middle - slot * 0.08,
      )} 137 ${point(middle + slot * 0.12)} 179`,
      strokeWidth: brushWidth + 3,
      weight: 1.12,
    });
    if (strokes.length < 12 && (script === "logographic" || index % 2 === 0)) {
      strokes.push({
        path: `M${point(left + slot * 0.18)} 139 C${point(left + slot * 0.36)} 151 ${point(
          left + slot * 0.62,
        )} 165 ${point(right - slot * 0.08)} 170`,
        strokeWidth: brushWidth,
        weight: 0.86,
      });
    }
    if (strokes.length < 12 && (script === "logographic" || script === "kana")) {
      strokes.push({
        path: `M${point(left + slot * 0.22)} 171 C${point(left + slot * 0.4)} 145 ${point(
          left + slot * 0.67,
        )} 121 ${point(right - slot * 0.12)} 108`,
        strokeWidth: brushWidth - 3,
        weight: 0.82,
      });
    }
  }

  return strokes.slice(0, 12);
}

function arabicStrokes(width: number, count: number): RawStroke[] {
  const body = connectedCursiveBodyPath(width, Math.max(3, count));
  return [
    { path: mirrorX(body, width), strokeWidth: 78, weight: 0.78 },
    {
      path: `M${point(width * 0.76)} 91 C${point(width * 0.73)} 82 ${point(width * 0.7)} 82 ${point(width * 0.67)} 91`,
      strokeWidth: 29,
      weight: 0.11,
    },
    {
      path: `M${point(width * 0.42)} 78 C${point(width * 0.39)} 70 ${point(width * 0.36)} 71 ${point(width * 0.34)} 80`,
      strokeWidth: 29,
      weight: 0.11,
    },
  ];
}

function scheduleStrokes(rawStrokes: readonly RawStroke[], writeDurationMs: number, durationScale: number) {
  const initialDelayMs = scaledMilliseconds(INITIAL_DELAY_MS, durationScale);
  const strokeGapMs = scaledMilliseconds(STROKE_GAP_MS, durationScale);
  const totalGap = strokeGapMs * Math.max(0, rawStrokes.length - 1);
  const availableDuration = Math.max(560, writeDurationMs - totalGap);
  const totalWeight = rawStrokes.reduce((total, stroke) => total + stroke.weight, 0);
  let elapsed = initialDelayMs;

  return Object.freeze(
    rawStrokes.map((stroke, index) => {
      const weighted = Math.round((availableDuration * stroke.weight) / totalWeight);
      const durationMs = Math.max(110, weighted);
      const scheduled = Object.freeze({
        delayMs: elapsed,
        durationMs,
        path: stroke.path,
        strokeWidth: stroke.strokeWidth,
      });
      elapsed += durationMs + (index < rawStrokes.length - 1 ? strokeGapMs : 0);
      return scheduled;
    }),
  );
}

export function planGreetingMotion({
  canvasWidth,
  direction,
  durationScale,
  script = "cursive",
  unitCount,
  value,
}: {
  canvasWidth: number;
  direction: GreetingWritingDirection;
  durationScale?: number;
  script?: GreetingWritingScript;
  unitCount: number;
  value: string;
}): GreetingMotionPlan {
  const width = Number.isFinite(canvasWidth) ? Math.max(430, Math.min(1040, Math.round(canvasWidth))) : 430;
  const boundedUnitCount = Number.isFinite(unitCount) ? Math.max(1, Math.min(14, Math.round(unitCount))) : 1;
  const boundedScale = boundedDurationScale(durationScale);
  const motionCount = direction === "rtl" ? boundedCount(value) : boundedUnitCount;
  const writeDurationMs = scaledMilliseconds(Math.min(3_000, 1_050 + motionCount * 190), boundedScale);
  const rawStrokes =
    script === "arabic"
      ? arabicStrokes(width, motionCount)
      : script === "cursive"
        ? cursiveStrokes(width, motionCount, direction)
        : compactScriptStrokes(width, boundedUnitCount, script);
  const strokes = scheduleStrokes(rawStrokes, writeDurationMs, boundedScale);
  const settleDelayMs =
    scaledMilliseconds(INITIAL_DELAY_MS, boundedScale) +
    writeDurationMs +
    scaledMilliseconds(SETTLE_GAP_MS, boundedScale);
  const settleDurationMs = scaledMilliseconds(SETTLE_DURATION_MS, boundedScale);
  const completeAfterMs = settleDelayMs + settleDurationMs;
  const cycleDurationMs = Math.max(
    MINIMUM_CYCLE_MS,
    Math.min(MAXIMUM_CYCLE_MS, completeAfterMs + scaledMilliseconds(FINISHED_HOLD_MS, boundedScale)),
  );

  return Object.freeze({
    completeAfterMs,
    cycleDurationMs,
    durationScale: boundedScale,
    motionCount,
    settleDurationMs,
    settleDelayMs,
    strokes,
    writeDurationMs,
  });
}
