import { describe, expect, it } from 'vitest'
import { generateDeck, validateDeck } from './deck'

const runtime = globalThis as typeof globalThis & {
  process?: { env?: Record<string, string | undefined> }
}
const stressDescribe = runtime.process?.env?.HARUHAN_STRESS === '1'
  ? describe
  : describe.skip

stressDescribe('deterministic deck nightly stress', () => {
  it('validates 10,000 deterministic seeds', () => {
    for (let index = 0; index < 10_000; index += 1) {
      const seed = `nightly-stress-${index}`
      const deck = generateDeck(seed)
      expect(validateDeck(deck)).toEqual([])
      expect(generateDeck(seed)).toEqual(deck)
    }
  })
})
