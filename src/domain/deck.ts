import { circularHueDistance, oklchToHex, perceptualDistance } from './color'
import { createSeededRandom, shuffle } from './random'
import { DECK_VERSION, type ColorCard, type ColorDeck } from './types'

const CARD_COUNT = 12
const LIGHTNESS_BANDS = [0.55, 0.62, 0.69, 0.76] as const
const CHROMA_BANDS = [0.08, 0.12, 0.16] as const

const round = (value: number, digits: number) => {
  const factor = 10 ** digits
  return Math.round(value * factor) / factor
}

function scoreAdjacency(previous: ColorCard | undefined, candidate: ColorCard): number {
  if (!previous) return 0
  const distance = perceptualDistance(previous, candidate)
  const hueDistance = circularHueDistance(previous.hue, candidate.hue)
  const nearDuplicatePenalty = distance < 0.075 ? 100 : 0
  const extremeContrastPenalty =
    hueDistance > 155 && Math.abs(previous.lightness - candidate.lightness) > 0.12
      ? 20
      : 0
  return nearDuplicatePenalty + extremeContrastPenalty - distance
}

function arrangeWithoutDirectedArc(cards: ColorCard[], seed: string): ColorCard[] {
  const random = createSeededRandom(`${DECK_VERSION}|${seed}|order`)
  let best = shuffle(cards, random)
  let bestScore = Number.POSITIVE_INFINITY

  for (let attempt = 0; attempt < 96; attempt += 1) {
    const candidate = shuffle(cards, random)
    const score = candidate.slice(1).reduce(
      (total, card, index) => total + scoreAdjacency(candidate[index], card),
      0,
    )
    if (score < bestScore) {
      best = candidate
      bestScore = score
    }
    const hasForbiddenPair = candidate.slice(1).some((card, index) => {
      const previous = candidate[index]
      return (
        perceptualDistance(previous, card) < 0.075 ||
        (
          circularHueDistance(previous.hue, card.hue) > 155 &&
          Math.abs(previous.lightness - card.lightness) > 0.12
        )
      )
    })
    if (!hasForbiddenPair) return candidate
  }
  return best
}

export function generateDeck(seed: string): ColorDeck {
  if (!seed.trim()) throw new Error('Deck seed must not be empty.')
  const random = createSeededRandom(`${DECK_VERSION}|${seed}|values`)
  const hueStrata = shuffle(Array.from({ length: CARD_COUNT }, (_, index) => index), random)
  const lightness = shuffle(
    LIGHTNESS_BANDS.flatMap((value) => [value, value, value]),
    random,
  )
  const chroma = shuffle(
    CHROMA_BANDS.flatMap((value) => [value, value, value, value]),
    random,
  )

  const candidates = hueStrata.map((stratum, index): ColorCard => {
    const hue = round(stratum * 30 + 4 + random() * 22, 3)
    const l = round(lightness[index] + (random() - 0.5) * 0.026, 4)
    const c = round(chroma[index] + (random() - 0.5) * 0.012, 4)
    return {
      cardId: '',
      presentedOrder: 0,
      hex: oklchToHex(l, c, hue),
      hue,
      lightness: l,
      chroma: c,
    }
  })

  const cards = arrangeWithoutDirectedArc(candidates, seed).map((card, index) => ({
    ...card,
    cardId: `${DECK_VERSION}:${seed}:${String(index + 1).padStart(2, '0')}`,
    presentedOrder: index + 1,
  }))

  return { deckVersion: DECK_VERSION, deckSeed: seed, cards }
}

export function validateDeck(deck: ColorDeck): string[] {
  const errors: string[] = []
  if (deck.cards.length !== CARD_COUNT) errors.push('Deck must contain 12 cards.')
  if (new Set(deck.cards.map((card) => card.cardId)).size !== deck.cards.length) {
    errors.push('Card IDs must be unique.')
  }
  deck.cards.forEach((card, index) => {
    if (card.presentedOrder !== index + 1) errors.push(`Invalid order at card ${index + 1}.`)
    if (card.hue < 0 || card.hue >= 360) errors.push(`Hue out of range at card ${index + 1}.`)
    if (card.lightness < 0.52 || card.lightness > 0.79) {
      errors.push(`Lightness out of range at card ${index + 1}.`)
    }
    if (card.chroma < 0.07 || card.chroma > 0.17) {
      errors.push(`Chroma out of range at card ${index + 1}.`)
    }
    if (index > 0 && perceptualDistance(deck.cards[index - 1], card) < 0.075) {
      errors.push(`Adjacent cards ${index} and ${index + 1} are too similar.`)
    }
  })
  return errors
}

export function createDeckSeed(): string {
  const bytes = new Uint32Array(3)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (value) => value.toString(36)).join('-')
}
