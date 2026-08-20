export type GreetingWritingDirection = "ltr" | "rtl";
export type GreetingWritingScript = "arabic" | "cursive" | "hangul" | "kana" | "logographic";

export type GreetingMotionStroke = Readonly<{
  delayMs: number;
  durationMs: number;
  path: string;
  strokeWidth: number;
}>;

export type GreetingMotionPlan = Readonly<{
  motionCount: number;
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

function cursiveBodyPath(width: number, count: number) {
  const margin = 40;
  const openingWidth = Math.min(104, (width - margin * 2) / Math.max(2.8, count));
  const start = margin + openingWidth * 0.66;
  const end = width - margin;
  const segments = Math.max(2, Math.min(9, count));
  const segmentWidth = (end - start) / segments;
  let path = `M${point(start)} 148`;

  for (let index = 0; index < segments; index += 1) {
    const segmentStart = start + segmentWidth * index;
    const segmentEnd = segmentStart + segmentWidth;
    const upper = 91 + (index % 3) * 7;
    const lower = 174 - (index % 2) * 8;
    path += ` C${point(segmentStart + segmentWidth * 0.18)} ${upper} ${point(
      segmentStart + segmentWidth * 0.45,
    )} ${upper - 9} ${point(segmentStart + segmentWidth * 0.5)} 132`;
    path += ` C${point(segmentStart + segmentWidth * 0.56)} ${lower} ${point(
      segmentStart + segmentWidth * 0.82,
    )} ${lower} ${point(segmentEnd)} ${index === segments - 1 ? 148 : 144}`;
  }

  path += ` C${point(end + 9)} 146 ${point(end + 13)} 140 ${point(Math.min(width - 24, end + 17))} 136`;
  return path;
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
      path: cursiveBodyPath(width, count),
      strokeWidth: 58,
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
  }

  return strokes.slice(0, 12);
}

function arabicStrokes(width: number, count: number): RawStroke[] {
  const body = cursiveBodyPath(width, Math.max(3, count));
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

function scheduleStrokes(rawStrokes: readonly RawStroke[], writeDurationMs: number) {
  const totalGap = STROKE_GAP_MS * Math.max(0, rawStrokes.length - 1);
  const availableDuration = Math.max(560, writeDurationMs - totalGap);
  const totalWeight = rawStrokes.reduce((total, stroke) => total + stroke.weight, 0);
  let elapsed = INITIAL_DELAY_MS;

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
      elapsed += durationMs + (index < rawStrokes.length - 1 ? STROKE_GAP_MS : 0);
      return scheduled;
    }),
  );
}

export function planGreetingMotion({
  canvasWidth,
  direction,
  script = "cursive",
  unitCount,
  value,
}: {
  canvasWidth: number;
  direction: GreetingWritingDirection;
  script?: GreetingWritingScript;
  unitCount: number;
  value: string;
}): GreetingMotionPlan {
  const width = Number.isFinite(canvasWidth) ? Math.max(430, Math.min(1040, Math.round(canvasWidth))) : 430;
  const boundedUnitCount = Number.isFinite(unitCount) ? Math.max(1, Math.min(14, Math.round(unitCount))) : 1;
  const motionCount = direction === "rtl" ? boundedCount(value) : boundedUnitCount;
  const writeDurationMs = Math.min(3_000, 1_050 + motionCount * 190);
  const rawStrokes =
    script === "arabic"
      ? arabicStrokes(width, motionCount)
      : script === "cursive"
        ? cursiveStrokes(width, motionCount, direction)
        : compactScriptStrokes(width, boundedUnitCount, script);
  const strokes = scheduleStrokes(rawStrokes, writeDurationMs);

  return Object.freeze({
    motionCount,
    settleDelayMs: INITIAL_DELAY_MS + writeDurationMs + 72,
    strokes,
    writeDurationMs,
  });
}
