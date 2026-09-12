/** Clamp to [min, max]. A non-finite value falls back, so bad stored data can't poison math. */
export function clamp(value: number, min: number, max: number, fallback: number = min): number {
  if (!Number.isFinite(value)) return fallback
  return Math.min(max, Math.max(min, value))
}

/** Modulo that stays non-negative — `%` keeps the sign of the dividend, which breaks loop phase before a loop's start bar. */
export function mod(value: number, divisor: number): number {
  return ((value % divisor) + divisor) % divisor
}

export function gcd(a: number, b: number): number {
  let x = Math.abs(a)
  let y = Math.abs(b)
  while (y !== 0) [x, y] = [y, x % y]
  return x
}

export function lcm(a: number, b: number): number {
  return a === 0 || b === 0 ? 0 : Math.abs(a * b) / gcd(a, b)
}
