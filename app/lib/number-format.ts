const COMPACT_UNITS = [
  { divisor: 1_000, suffix: "K" },
  { divisor: 1_000_000, suffix: "M" },
  { divisor: 1_000_000_000, suffix: "B" },
  { divisor: 1_000_000_000_000, suffix: "T" },
] as const;

function boundedFractionDigits(value: number) {
  return Math.max(0, Math.min(8, Math.trunc(value)));
}

function formatAbsolute(value: number, maximumFractionDigits: number) {
  const digits = boundedFractionDigits(maximumFractionDigits);
  if (value >= 1e21) {
    return value.toExponential(digits).replace(/\.0+(?=e)/, "").replace(/(\.\d*?)0+(?=e)/, "$1");
  }
  const [integer = "0", fraction = ""] = value.toFixed(digits).split(".");
  const grouped = integer.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  const trimmedFraction = fraction.replace(/0+$/, "");
  return trimmedFraction ? `${grouped}.${trimmedFraction}` : grouped;
}

export function formatDeterministicNumber(value: number, maximumFractionDigits = 2) {
  if (!Number.isFinite(value)) return String(value);
  const negative = value < 0;
  return `${negative ? "-" : ""}${formatAbsolute(Math.abs(value), maximumFractionDigits)}`;
}

function formatCompactMagnitude(value: number, threshold: number, maximumFractionDigits: number) {
  if (value < threshold) return formatAbsolute(value, maximumFractionDigits);
  let unitIndex = -1;
  for (let index = 0; index < COMPACT_UNITS.length; index += 1) {
    if (value >= COMPACT_UNITS[index].divisor) unitIndex = index;
  }
  if (unitIndex < 0) return formatAbsolute(value, maximumFractionDigits);
  let scaled = value / COMPACT_UNITS[unitIndex].divisor;
  const digits = boundedFractionDigits(maximumFractionDigits);
  let rounded = Number(scaled.toFixed(digits));
  if (rounded >= 1_000 && unitIndex < COMPACT_UNITS.length - 1) {
    unitIndex += 1;
    scaled = value / COMPACT_UNITS[unitIndex].divisor;
    rounded = Number(scaled.toFixed(digits));
  }
  return `${formatAbsolute(rounded, digits)}${COMPACT_UNITS[unitIndex].suffix}`;
}

export function formatCompactNumber(value: number, threshold = 10_000, maximumFractionDigits = 2) {
  if (!Number.isFinite(value)) return String(value);
  const negative = value < 0;
  return `${negative ? "-" : ""}${formatCompactMagnitude(Math.abs(value), threshold, maximumFractionDigits)}`;
}

export function formatCompactCurrency(value: number) {
  if (!Number.isFinite(value)) return String(value);
  const negative = value < 0;
  return `${negative ? "-" : ""}$${formatCompactMagnitude(Math.abs(value), 1_000, 2)}`;
}

export function formatFixedPercent(value: number, showSign = false) {
  if (!Number.isFinite(value)) return `${String(value)}%`;
  const sign = value < 0 ? "-" : showSign && value > 0 ? "+" : "";
  return `${sign}${Math.abs(value).toFixed(1)}%`;
}

export function formatInteger(value: number) {
  return formatDeterministicNumber(Math.round(value), 0);
}
