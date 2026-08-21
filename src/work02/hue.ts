export type HueRotationDirection =
  | 'stationary'
  | 'clockwise'
  | 'counterclockwise'

const requireFiniteHue = (hue: number, name: string): number => {
  if (!Number.isFinite(hue)) {
    throw new TypeError(`${name} must be a finite number.`)
  }
  return hue
}

export function normalizeHue(hue: number): number {
  const finiteHue = requireFiniteHue(hue, 'hue')
  return ((finiteHue % 360) + 360) % 360
}

export function signedHueDelta(fromHue: number, toHue: number): number {
  const from = normalizeHue(requireFiniteHue(fromHue, 'fromHue'))
  const to = normalizeHue(requireFiniteHue(toHue, 'toHue'))
  const clockwiseDelta = (to - from + 360) % 360

  if (clockwiseDelta === 180) return 180
  return clockwiseDelta > 180 ? clockwiseDelta - 360 : clockwiseDelta
}

export function circularHueDistance(fromHue: number, toHue: number): number {
  return Math.abs(signedHueDelta(fromHue, toHue))
}

export function hueRotationDirection(
  fromHue: number,
  toHue: number,
): HueRotationDirection {
  const delta = signedHueDelta(fromHue, toHue)
  if (delta === 0) return 'stationary'
  return delta > 0 ? 'clockwise' : 'counterclockwise'
}

export function consecutiveHueDeltas(hues: readonly number[]): number[] {
  return hues.slice(1).map((hue, index) => signedHueDelta(hues[index], hue))
}
