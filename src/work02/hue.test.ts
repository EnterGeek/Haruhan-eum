import { describe, expect, it } from 'vitest'
import {
  circularHueDistance,
  consecutiveHueDeltas,
  hueRotationDirection,
  normalizeHue,
  signedHueDelta,
} from './hue'

describe('Hue circle utilities', () => {
  it.each([
    [0, 0],
    [360, 0],
    [-1, 359],
    [-720, 0],
    [720, 0],
    [1081, 1],
  ])('normalizes %s to %s', (input, expected) => {
    expect(normalizeHue(input)).toBe(expected)
  })

  it.each([Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY])(
    'rejects non-finite values',
    (input) => {
      expect(() => normalizeHue(input)).toThrow(TypeError)
      expect(() => signedHueDelta(0, input)).toThrow(TypeError)
      expect(() => circularHueDistance(input, 0)).toThrow(TypeError)
    },
  )

  it('treats the 0/360 boundary as continuous', () => {
    expect(signedHueDelta(359, 1)).toBe(2)
    expect(signedHueDelta(1, 359)).toBe(-2)
    expect(circularHueDistance(359, 1)).toBe(2)
    expect(signedHueDelta(0, 360)).toBe(0)
    expect(signedHueDelta(360, 0)).toBe(0)
  })

  it('returns zero for the same normalized Hue', () => {
    expect(signedHueDelta(25, 25)).toBe(0)
    expect(circularHueDistance(25, 385)).toBe(0)
    expect(hueRotationDirection(25, 385)).toBe('stationary')
  })

  it('uses clockwise +180 as the deterministic antipodal tie-break', () => {
    expect(signedHueDelta(0, 180)).toBe(180)
    expect(signedHueDelta(180, 0)).toBe(180)
    expect(hueRotationDirection(0, 180)).toBe('clockwise')
    expect(hueRotationDirection(180, 0)).toBe('clockwise')
  })

  it('preserves direction immediately around the antipodal boundary', () => {
    expect(signedHueDelta(0, 179.999)).toBeCloseTo(179.999)
    expect(signedHueDelta(0, 180.001)).toBeCloseTo(-179.999)
    expect(hueRotationDirection(0, 179.999)).toBe('clockwise')
    expect(hueRotationDirection(0, 180.001)).toBe('counterclockwise')
  })

  it('is antisymmetric except at the documented 180-degree tie', () => {
    for (const [from, to] of [[359, 1], [10, 200], [-20, 50], [720, 721]]) {
      expect(signedHueDelta(from, to)).toBe(-signedHueDelta(to, from))
    }
  })

  it('calculates consecutive signed changes without mutating the input', () => {
    const hues = Object.freeze([359, 1, 181, 180.999])
    const deltas = consecutiveHueDeltas(hues)
    expect(deltas.slice(0, 2)).toEqual([2, 180])
    expect(deltas[2]).toBeCloseTo(-0.001)
    expect(hues).toEqual([359, 1, 181, 180.999])
  })
})
