import type { Work02Input, Work02InputItem } from '../types'
import {
  SUPPORTED_DECK_VERSION,
  SUPPORTED_SESSION_SCHEMA_VERSION,
  WORK02_INPUT_CARD_COUNT,
} from '../versions'

type JsonObject = Record<string, unknown>
type GoldenColorTuple = readonly [string, number, number, number]

const fail = (message: string): never => {
  throw new Error(`Invalid golden session fixture: ${message}`)
}

const object = (value: unknown, path: string): JsonObject =>
  typeof value === 'object' && value !== null && !Array.isArray(value)
    ? value as JsonObject
    : fail(`${path} must be an object.`)

const string = (value: unknown, path: string): string =>
  typeof value === 'string' && value.length > 0
    ? value
    : fail(`${path} must be a non-empty string.`)

const finite = (value: unknown, path: string): number =>
  typeof value === 'number' && Number.isFinite(value)
    ? value
    : fail(`${path} must be a finite number.`)

const validateTuple = (value: unknown, path: string): GoldenColorTuple => {
  if (!Array.isArray(value) || value.length !== 4) {
    fail(`${path} must be [hex, hue, lightness, chroma].`)
  }
  const tuple = value as unknown[]
  const hex = string(tuple[0], `${path}[0]`)
  if (!/^#[0-9A-Fa-f]{6}$/.test(hex)) fail(`${path}[0] must use #RRGGBB format.`)
  const hue = finite(tuple[1], `${path}[1]`)
  const lightness = finite(tuple[2], `${path}[2]`)
  const chroma = finite(tuple[3], `${path}[3]`)
  if (hue < 0 || hue >= 360) fail(`${path}[1] must be in [0, 360).`)
  if (lightness < 0 || lightness > 1) fail(`${path}[2] must be in [0, 1].`)
  if (chroma < 0) fail(`${path}[3] must be non-negative.`)
  return [hex, hue, lightness, chroma]
}

export function expandGoldenCase(collectionInput: unknown, caseId: string): Work02Input {
  const collection = object(collectionInput, 'collection')
  if (collection.collectionVersion !== 'work01-golden-sessions-v1') {
    fail('collectionVersion is unsupported.')
  }
  if (collection.schemaVersion !== SUPPORTED_SESSION_SCHEMA_VERSION) {
    fail('schemaVersion is unsupported.')
  }
  if (collection.deckVersion !== SUPPORTED_DECK_VERSION) {
    fail('deckVersion is unsupported.')
  }

  const cases = Array.isArray(collection.cases)
    ? collection.cases
    : fail('cases must be an array.')
  const matching = cases.filter((candidate) =>
    typeof candidate === 'object' &&
    candidate !== null &&
    !Array.isArray(candidate) &&
    (candidate as JsonObject).id === caseId)
  if (matching.length !== 1) {
    fail(`case "${caseId}" must exist exactly once.`)
  }
  const goldenCase = object(matching[0], `case[${caseId}]`)
  const deckSeed = string(goldenCase.deckSeed, `case[${caseId}].deckSeed`)
  const directions = string(goldenCase.directions, `case[${caseId}].directions`)
  if (!/^[LR]{12}$/.test(directions)) {
    fail(`case[${caseId}].directions must contain exactly 12 L/R characters.`)
  }

  const decks = object(collection.decks, 'decks')
  const rawDeck = decks[deckSeed]
  if (!Array.isArray(rawDeck) || rawDeck.length !== WORK02_INPUT_CARD_COUNT) {
    fail(`decks[${deckSeed}] must contain exactly 12 color tuples.`)
  }
  const deckTuples = rawDeck as unknown[]
  const colors: GoldenColorTuple[] = deckTuples.map((value, index) =>
    validateTuple(value, `decks[${deckSeed}][${index}]`))

  const items: Work02InputItem[] = colors.map(([, hue, lightness, chroma], index) => {
    const presentedOrder = index + 1
    return {
      index: presentedOrder,
      cardId:
        `${SUPPORTED_DECK_VERSION}:${deckSeed}:${String(presentedOrder).padStart(2, '0')}`,
      color: { hue, lightness, chroma },
      direction: directions[index] === 'L' ? 'left' : 'right',
    }
  })
  return items as unknown as Work02Input
}
