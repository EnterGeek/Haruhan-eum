import { describe, expect, it } from 'vitest'
import { generateDeck, validateDeck } from './deck'

const stressDescribe = process.env.HARUHAN_STRESS === '1' ? describe : describe.skip

stressDescribe('deterministic deck nightly stress', () => {
  it('validates 10,000 deterministic seeds', () => {
    for (let index = 0; index < 10_000; index += 1) {
      const deck = generateDeck(`nightly-stress-${index}`)
      expect(validateDeck(deck)).toEqual([])
      expect(generateDeck(`nightly-stress-${index}`)).toEqual(deck)
    }
  })
})
