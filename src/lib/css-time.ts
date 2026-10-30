/** CSS minification can rewrite milliseconds as seconds; JS animation APIs use ms. */
export function cssTimeToMilliseconds(value: string, fallback = 0): number {
  const match = value.trim().match(/^([+-]?(?:\d+\.?\d*|\.\d+))(ms|s)?$/i);
  if (!match) return fallback;

  const amount = Number(match[1]);
  if (!Number.isFinite(amount)) return fallback;
  return amount * (match[2]?.toLowerCase() === "s" ? 1000 : 1);
}
