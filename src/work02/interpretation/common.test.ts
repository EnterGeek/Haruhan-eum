import { describe, expect, it } from 'vitest'
import type { Direction } from '../../domain/types'
import type { Work02Input } from '../types'
import { extractCommonFlowFeatures } from './common'

const makeInput = (
  directions: readonly Direction[],
  hues: readonly number[] = directions.map((_, index) => index * 30),
): Work02Input => directions.map((direction, index) => ({
  index: index + 1,
  cardId: `card-${index + 1}`,
  color: {
    hue: hues[index],
    lightness: 0.5,
    chroma: 0.1,
  },
  direction,
})) as unknown as Work02Input

const alternating = Array.from(
  { length: 12 },
  (_, index) => index % 2 === 0 ? 'left' : 'right',
) as Direction[]

describe('extractCommonFlowFeatures', () => {
  it.each([
    ['all left', Array(12).fill('left') as Direction[], 1, 0],
    ['all right', Array(12).fill('right') as Direction[], 1, 0],
    ['alternating', alternating, 12, 11],
  ])('extracts runs and turns for %s', (_, directions, runCount, turnCount) => {
    const result = extractCommonFlowFeatures(makeInput(directions), 'absolute-hue')
    expect(result.directionRuns).toHaveLength(runCount)
    expect(result.directionTurns).toHaveLength(turnCount)
    expect(result.items.map((item) => item.selectionDirection)).toEqual(directions)
  })

  it('preserves 12-item temporal order and keeps presentedOrder distinct from zero-based position', () => {
    const input = makeInput(alternating)
    const result = extractCommonFlowFeatures(input, 'relative-hue')
    expect(result.items.map((item) => item.presentedOrder)).toEqual(
      Array.from({ length: 12 }, (_, index) => index + 1),
    )
    expect(result.items.map((item) => item.sequencePosition)).toEqual(
      Array.from({ length: 12 }, (_, index) => index),
    )
  })

  it('summarizes direction counts, ratios, and positions without assigning meaning', () => {
    const result = extractCommonFlowFeatures(makeInput(alternating), 'hybrid')
    expect(result.directionSummary).toEqual({
      leftCount: 6,
      rightCount: 6,
      leftRatio: 0.5,
      rightRatio: 0.5,
      positionsByDirection: {
        left: [1, 3, 5, 7, 9, 11],
        right: [2, 4, 6, 8, 10, 12],
      },
    })
  })

  it('extracts circular Hue changes and aggregate movement', () => {
    const hues = [359, 1, 181, 180, 180, 200, 220, 240, 260, 280, 300, 320]
    const result = extractCommonFlowFeatures(makeInput(alternating, hues), 'relative-hue')
    expect(result.items[1].adjacentHueChange).toMatchObject({
      distance: 2,
      signedDelta: 2,
      direction: 'clockwise',
    })
    expect(result.items[2].adjacentHueChange).toMatchObject({
      distance: 180,
      signedDelta: 180,
      direction: 'clockwise',
    })
    expect(result.hueMovement.maximumDistance).toBe(180)
    expect(result.hueMovement.totalDistance).toBe(323)
    expect(result.hueMovement.meanDistance).toBeCloseTo(323 / 11)
  })

  it('leaves product-defined phrase and register candidates empty', () => {
    const result = extractCommonFlowFeatures(makeInput(alternating), 'absolute-hue')
    expect(result.phraseBoundaryCandidates).toEqual([])
    expect(result.registerContourCandidates).toEqual([])
  })

  it('is deterministic, pure, and independent of event/time data not present in Work02Input', () => {
    const input = makeInput(alternating)
    const snapshot = structuredClone(input)
    const first = extractCommonFlowFeatures(input, 'hybrid')
    const second = extractCommonFlowFeatures(input, 'hybrid')
    expect(second).toEqual(first)
    expect(input).toEqual(snapshot)
    expect(JSON.stringify(first)).not.toMatch(/interaction|timestamp|occurredAt|inputMethod/)
  })

  it('rejects loss or corruption of presentedOrder instead of repairing it', () => {
    const input = makeInput(alternating) as unknown as { index: number }[]
    input[0].index = 0
    expect(() =>
      extractCommonFlowFeatures(input as unknown as Work02Input, 'hybrid'),
    ).toThrow(/presentedOrder 1/)
  })
})
