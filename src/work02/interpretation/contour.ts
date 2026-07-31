import { normalizeHue, signedHueDelta } from '../hue'
import type { Work02Input } from '../types'
import type {
  InterpretationMethod,
  InterpreterVersion,
  RegisterContourCandidate,
} from './types'

export const HYBRID_ABSOLUTE_WEIGHT = 0.5 as const
export const HYBRID_RELATIVE_WEIGHT = 0.5 as const
export const RELATIVE_HUE_NEUTRAL_POSITION = 0.5 as const

export function calculateAbsoluteHuePositions(
  input: Work02Input,
): number[] {
  return input.map((item) => normalizeHue(item.color.hue) / 360)
}

export function calculateRelativeHuePositions(
  input: Work02Input,
): number[] {
  return input.map((item, sequencePosition) => {
    if (sequencePosition === 0) return RELATIVE_HUE_NEUTRAL_POSITION
    const previous = input[sequencePosition - 1]
    return RELATIVE_HUE_NEUTRAL_POSITION +
      signedHueDelta(previous.color.hue, item.color.hue) / 360
  })
}

export function calculateHybridHuePositions(
  input: Work02Input,
): number[] {
  const absolute = calculateAbsoluteHuePositions(input)
  const relative = calculateRelativeHuePositions(input)
  return absolute.map((position, sequencePosition) =>
    HYBRID_ABSOLUTE_WEIGHT * position +
    HYBRID_RELATIVE_WEIGHT * relative[sequencePosition])
}

export function buildContourCandidates(
  input: Work02Input,
  positions: readonly number[],
  method: InterpretationMethod,
  interpreterVersion: InterpreterVersion,
): RegisterContourCandidate[] {
  if (positions.length !== input.length) {
    throw new RangeError('Contour positions must match the Work02Input length.')
  }

  return positions.map((normalizedPosition, sequencePosition) => {
    if (!Number.isFinite(normalizedPosition)) {
      throw new RangeError('Contour positions must be finite.')
    }
    if (normalizedPosition < 0 || normalizedPosition > 1) {
      throw new RangeError('Contour positions must be in [0, 1].')
    }
    return {
      presentedOrder: input[sequencePosition].index,
      normalizedPosition,
      source: `${method}@${interpreterVersion}`,
    }
  })
}
