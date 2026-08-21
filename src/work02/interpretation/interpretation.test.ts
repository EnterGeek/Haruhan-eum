import { describe, expect, it } from 'vitest'
import goldenSessions from '../../../docs/golden-sessions/representative-sessions.json'
import type { Direction } from '../../domain/types'
import { expandGoldenCase } from '../golden/expandGoldenCase'
import type { Work02Input } from '../types'
import {
  ABSOLUTE_HUE_INTERPRETER_VERSION,
  FLOW_INTERPRETATION_CONTRACT_VERSION,
  HYBRID_HUE_INTERPRETER_VERSION,
  RELATIVE_HUE_INTERPRETER_VERSION,
} from '../versions'
import { interpretAbsoluteHue } from './absolute'
import {
  HYBRID_ABSOLUTE_WEIGHT,
  HYBRID_RELATIVE_WEIGHT,
  calculateAbsoluteHuePositions,
  calculateHybridHuePositions,
  calculateRelativeHuePositions,
} from './contour'
import { interpretHybridHue } from './hybrid'
import { interpretFlow } from './interpretFlow'
import { interpretRelativeHue } from './relative'
import type { InterpretationMethod } from './types'

const makeInput = (
  hues: readonly number[],
  directions: readonly Direction[] = hues.map(() => 'left'),
): Work02Input => hues.map((hue, sequencePosition) => ({
  index: sequencePosition + 1,
  cardId: `card-${sequencePosition + 1}`,
  color: {
    hue,
    lightness: 0.4 + sequencePosition / 100,
    chroma: 0.1 + sequencePosition / 1000,
  },
  direction: directions[sequencePosition],
})) as unknown as Work02Input

const twelveHues = [0, 90, 180, 270, 359, 1, 10, 10, 190, 9.999, -1, 720]
const alternating = twelveHues.map(
  (_, index) => index % 2 === 0 ? 'left' : 'right',
) as Direction[]

const positions = (
  result: ReturnType<typeof interpretFlow>,
): number[] => result.registerContourCandidates.map(
  (candidate) => candidate.normalizedPosition,
)

describe('absolute Hue interpretation', () => {
  it('maps normalized absolute Hue positions without depending on prior cards', () => {
    const result = calculateAbsoluteHuePositions(makeInput(twelveHues))
    expect(result.slice(0, 5)).toEqual([0, 0.25, 0.5, 0.75, 359 / 360])
    expect(result[9]).toBeCloseTo(9.999 / 360)
    expect(result[10]).toBe(359 / 360)
    expect(result[11]).toBe(0)

    const changedPrior = [...twelveHues]
    changedPrior[4] = 125
    expect(calculateAbsoluteHuePositions(makeInput(changedPrior))[5]).toBe(
      result[5],
    )
  })

  it('changes when all Hue positions rotate', () => {
    const input = makeInput(twelveHues)
    const rotated = makeInput(twelveHues.map((hue) => hue + 30))
    expect(calculateAbsoluteHuePositions(rotated)).not.toEqual(
      calculateAbsoluteHuePositions(input),
    )
  })
})

describe('relative Hue interpretation', () => {
  it('uses the neutral first position and circular signed deltas', () => {
    const result = calculateRelativeHuePositions(
      makeInput([359, 1, 359, 359, 179, 358.999, 179.001, 0, 1, 2, 3, 4]),
    )
    expect(result[0]).toBe(0.5)
    expect(result[1]).toBe(0.5 + 2 / 360)
    expect(result[2]).toBe(0.5 - 2 / 360)
    expect(result[3]).toBe(0.5)
    expect(result[4]).toBe(1)
    expect(result[5]).toBeCloseTo(0.5 + 179.999 / 360)
    expect(result[6]).toBeCloseTo(0.5 - 179.998 / 360)
  })

  it('is invariant when every Hue receives the same rotation', () => {
    const input = makeInput(twelveHues)
    const rotated = makeInput(twelveHues.map((hue) => hue + 137.5))
    expect(calculateRelativeHuePositions(rotated)).toEqual(
      calculateRelativeHuePositions(input),
    )
  })

  it('matches for different absolute starts with the same signed deltas', () => {
    const first = makeInput([10, 30, 25, 45, 40, 60, 55, 75, 70, 90, 85, 105])
    const second = makeInput([210, 230, 225, 245, 240, 260, 255, 275, 270, 290, 285, 305])
    expect(calculateRelativeHuePositions(second)).toEqual(
      calculateRelativeHuePositions(first),
    )
  })
})

describe('hybrid Hue interpretation', () => {
  it('uses the one shared pair of equal weights at every position', () => {
    const input = makeInput(twelveHues)
    const absolute = calculateAbsoluteHuePositions(input)
    const relative = calculateRelativeHuePositions(input)
    const hybrid = calculateHybridHuePositions(input)

    expect(HYBRID_ABSOLUTE_WEIGHT).toBe(0.5)
    expect(HYBRID_RELATIVE_WEIGHT).toBe(0.5)
    hybrid.forEach((value, index) => {
      expect(value).toBe((absolute[index] + relative[index]) / 2)
      expect(value).toBeGreaterThanOrEqual(0)
      expect(value).toBeLessThanOrEqual(1)
    })
    expect(hybrid[0]).toBe((absolute[0] + 0.5) / 2)
  })
})

describe('Hue interpretation contract and dispatcher', () => {
  const methods: readonly InterpretationMethod[] = [
    'absolute-hue',
    'relative-hue',
    'hybrid',
  ]

  it.each([
    ['absolute-hue', ABSOLUTE_HUE_INTERPRETER_VERSION],
    ['relative-hue', RELATIVE_HUE_INTERPRETER_VERSION],
    ['hybrid', HYBRID_HUE_INTERPRETER_VERSION],
  ] as const)('dispatches %s with its exact method and version', (method, version) => {
    const result = interpretFlow(makeInput(twelveHues, alternating), method)
    expect(result.method).toBe(method)
    expect(result.versions.interpreter).toBe(version)
    expect(result.versions.contract).toBe(FLOW_INTERPRETATION_CONTRACT_VERSION)
    expect(result.registerContourCandidates).toHaveLength(12)
    expect(result.registerContourCandidates.map((candidate) =>
      candidate.presentedOrder)).toEqual(
      Array.from({ length: 12 }, (_, index) => index + 1),
    )
    expect(result.registerContourCandidates.every((candidate) =>
      candidate.source === `${method}@${version}`)).toBe(true)
  })

  it('delegates to the three dedicated interpreters', () => {
    const input = makeInput(twelveHues, alternating)
    expect(interpretFlow(input, 'absolute-hue')).toEqual(interpretAbsoluteHue(input))
    expect(interpretFlow(input, 'relative-hue')).toEqual(interpretRelativeHue(input))
    expect(interpretFlow(input, 'hybrid')).toEqual(interpretHybridHue(input))
  })

  it('rejects unsupported runtime methods instead of substituting a default', () => {
    expect(() => interpretFlow(
      makeInput(twelveHues),
      'unknown' as InterpretationMethod,
    )).toThrow(/Unsupported interpretation method/)
  })

  it('is deterministic and does not mutate input', () => {
    const input = makeInput(twelveHues, alternating)
    const snapshot = structuredClone(input)
    methods.forEach((method) => {
      expect(interpretFlow(input, method)).toEqual(interpretFlow(input, method))
    })
    expect(input).toEqual(snapshot)
  })

  it('keeps direction features while direction changes leave Hue contours intact', () => {
    const input = makeInput(twelveHues, alternating)
    const flipped = makeInput(
      twelveHues,
      alternating.map((direction) => direction === 'left' ? 'right' : 'left'),
    )
    methods.forEach((method) => {
      const original = interpretFlow(input, method)
      const changed = interpretFlow(flipped, method)
      expect(changed.directionSummary).not.toEqual(original.directionSummary)
      expect(positions(changed)).toEqual(positions(original))
    })
  })

  it.each([
    ['all left', Array(12).fill('left') as Direction[]],
    ['all right', Array(12).fill('right') as Direction[]],
    ['alternating', alternating],
  ])('preserves %s direction flow for every method', (_, directions) => {
    methods.forEach((method) => {
      const result = interpretFlow(makeInput(twelveHues, directions), method)
      expect(result.items.map((item) => item.selectionDirection)).toEqual(directions)
    })
  })

  it('ignores Lightness and Chroma when calculating every Hue contour', () => {
    const input = makeInput(twelveHues, alternating)
    const changed = structuredClone(input) as unknown as {
      color: { lightness: number; chroma: number }
    }[]
    changed.forEach((item, index) => {
      item.color.lightness = index % 2
      item.color.chroma = index * 0.03
    })
    methods.forEach((method) => {
      expect(positions(interpretFlow(
        changed as unknown as Work02Input,
        method,
      ))).toEqual(positions(interpretFlow(input, method)))
    })
  })

  it('keeps phrase candidates empty and emits no note or audio concepts', () => {
    methods.forEach((method) => {
      const result = interpretFlow(makeInput(twelveHues), method)
      expect(result.phraseBoundaryCandidates).toEqual([])
      expect(JSON.stringify(result)).not.toMatch(
        /midi|note|pitch|frequency|audio|rhythm|tempo/i,
      )
    })
  })

  it('produces distinct representative contours', () => {
    const input = makeInput(twelveHues, alternating)
    const contours = methods.map((method) => positions(interpretFlow(input, method)))
    expect(contours[0]).not.toEqual(contours[1])
    expect(contours[0]).not.toEqual(contours[2])
    expect(contours[1]).not.toEqual(contours[2])
  })
})

describe('golden Hue interpretation regression', () => {
  const caseIds = goldenSessions.cases.map((goldenCase) => goldenCase.id)
  const methods: readonly InterpretationMethod[] = [
    'absolute-hue',
    'relative-hue',
    'hybrid',
  ]

  it.each(caseIds)('is deterministic and valid for %s', (caseId) => {
    const firstInput = expandGoldenCase(goldenSessions, caseId)
    const secondInput = expandGoldenCase(structuredClone(goldenSessions), caseId)
    methods.forEach((method) => {
      const first = interpretFlow(firstInput, method)
      const second = interpretFlow(secondInput, method)
      expect(second).toEqual(first)
      expect(first.registerContourCandidates).toHaveLength(12)
      first.registerContourCandidates.forEach((candidate) => {
        expect(Number.isFinite(candidate.normalizedPosition)).toBe(true)
        expect(candidate.normalizedPosition).toBeGreaterThanOrEqual(0)
        expect(candidate.normalizedPosition).toBeLessThanOrEqual(1)
      })
    })
  })

  it('does not consume golden event summaries', () => {
    const changed = structuredClone(goldenSessions) as unknown as {
      cases: Array<{
        commitInputs?: string
        commitOrders?: number[]
        undoEvents?: Array<[number, string]>
        createdAt?: string
      }>
    }
    changed.cases[0].commitInputs = 'SSSSSSSSSSSS'
    changed.cases[0].commitOrders = [12, 11, 10]
    changed.cases[0].undoEvents = [[1, 'L'], [12, 'R']]
    changed.cases[0].createdAt = '2099-01-01T00:00:00.000Z'
    const baseline = expandGoldenCase(goldenSessions, 'same-deck-baseline')
    const modified = expandGoldenCase(changed, 'same-deck-baseline')
    methods.forEach((method) => {
      expect(interpretFlow(modified, method)).toEqual(
        interpretFlow(baseline, method),
      )
    })
  })

  it('distinguishes all three methods on a representative case', () => {
    const input = expandGoldenCase(goldenSessions, 'same-deck-baseline')
    const contours = methods.map((method) => positions(interpretFlow(input, method)))
    expect(new Set(contours.map((contour) => JSON.stringify(contour))).size).toBe(3)
  })
})
