import { describe, expect, it } from 'vitest'
import { generateDeck, validateDeck } from './deck'

describe('deterministic color deck', () => {
  it('recreates every field and order for the same version and seed', () => {
    expect(generateDeck('same-seed')).toEqual(generateDeck('same-seed'))
  })

  it('creates a different deck for a different seed', () => {
    expect(generateDeck('seed-a')).not.toEqual(generateDeck('seed-b'))
  })

  it('passes distribution and adjacency validation across many seeds', () => {
    for (let index = 0; index < 500; index += 1) {
      expect(validateDeck(generateDeck(`distribution-${index}`))).toEqual([])
    }
  })

  it('uses stable unique IDs and presentation order', () => {
    const deck = generateDeck('identity')
    expect(new Set(deck.cards.map((card) => card.cardId)).size).toBe(12)
    expect(deck.cards.map((card) => card.presentedOrder)).toEqual(
      Array.from({ length: 12 }, (_, index) => index + 1),
    )
  })
})
