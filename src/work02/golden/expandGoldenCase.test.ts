import { describe, expect, it } from 'vitest'
import goldenSessions from '../../../docs/golden-sessions/representative-sessions.json'
import { expandGoldenCase } from './expandGoldenCase'

describe('expandGoldenCase', () => {
  it('restores representative fixture order, canonical card IDs, and direction strings', () => {
    const input = expandGoldenCase(goldenSessions, 'same-deck-baseline')
    expect(input).toHaveLength(12)
    expect(input.map((item) => item.index)).toEqual(
      Array.from({ length: 12 }, (_, index) => index + 1),
    )
    expect(input.map((item) => item.cardId)).toEqual(
      Array.from(
        { length: 12 },
        (_, index) =>
          `work01-oklch-v1:1yz198b-ulry7g-1qye45s:${String(index + 1).padStart(2, '0')}`,
      ),
    )
    expect(input.map((item) => item.direction).join(',')).toBe(
      'right,left,right,right,right,left,right,right,right,left,right,right',
    )
    expect(input[0].color).toEqual({
      hue: 162.06,
      lightness: 0.7696,
      chroma: 0.1587,
    })
  })

  it('rejects malformed compressed direction strings instead of repairing them', () => {
    const malformed = structuredClone(goldenSessions)
    malformed.cases[0].directions = 'RLR'
    expect(() => expandGoldenCase(malformed, 'same-deck-baseline')).toThrow(
      /exactly 12 L\/R/,
    )
  })
})
