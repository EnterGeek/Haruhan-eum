const clamp = (value: number, min = 0, max = 1) =>
  Math.min(max, Math.max(min, value))

const toByte = (value: number) => Math.round(clamp(value) * 255)
const toHexByte = (value: number) => toByte(value).toString(16).padStart(2, '0')

function linearToSrgb(value: number): number {
  return value <= 0.0031308
    ? 12.92 * value
    : 1.055 * Math.pow(value, 1 / 2.4) - 0.055
}

export function oklchToHex(
  lightness: number,
  chroma: number,
  hue: number,
): string {
  const radians = (hue * Math.PI) / 180
  const a = chroma * Math.cos(radians)
  const b = chroma * Math.sin(radians)

  const lPrime = lightness + 0.3963377774 * a + 0.2158037573 * b
  const mPrime = lightness - 0.1055613458 * a - 0.0638541728 * b
  const sPrime = lightness - 0.0894841775 * a - 1.291485548 * b

  const l = lPrime ** 3
  const m = mPrime ** 3
  const s = sPrime ** 3

  const red = linearToSrgb(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s)
  const green = linearToSrgb(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s)
  const blue = linearToSrgb(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s)

  return `#${toHexByte(red)}${toHexByte(green)}${toHexByte(blue)}`.toUpperCase()
}

export function circularHueDistance(a: number, b: number): number {
  const direct = Math.abs(a - b)
  return Math.min(direct, 360 - direct)
}

export function perceptualDistance(
  a: Pick<import('./types').ColorCard, 'hue' | 'lightness' | 'chroma'>,
  b: Pick<import('./types').ColorCard, 'hue' | 'lightness' | 'chroma'>,
): number {
  const aRadians = (a.hue * Math.PI) / 180
  const bRadians = (b.hue * Math.PI) / 180
  const ax = a.chroma * Math.cos(aRadians)
  const ay = a.chroma * Math.sin(aRadians)
  const bx = b.chroma * Math.cos(bRadians)
  const by = b.chroma * Math.sin(bRadians)
  return Math.hypot(a.lightness - b.lightness, ax - bx, ay - by)
}
