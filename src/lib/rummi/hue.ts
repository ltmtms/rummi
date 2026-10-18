/** CSS hue angle written into `oklch()` in avatar backgrounds. */
export const HUE_MIN = 0;
export const HUE_MAX = 360;

const PLAIN_NUMBER = /^[+-]?(?:\d+(?:\.\d+)?|\.\d+)$/;

/**
 * Finite hue in [0, 360], or null when `value` is not a plain number.
 * Numeric strings are accepted; anything that could escape a CSS value is not.
 */
export function numericHue(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!PLAIN_NUMBER.test(trimmed)) return null;
  const n = Number(trimmed);
  return Number.isFinite(n) ? n : null;
}

/** Clamp a hue for inline CSS. Non-numeric input becomes 0 so it cannot break out of `oklch()`. */
export function safeHue(value: unknown): number {
  const n = numericHue(value);
  if (n === null) return 0;
  return Math.min(HUE_MAX, Math.max(HUE_MIN, n));
}
