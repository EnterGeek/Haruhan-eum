import type {
  ColorCard,
  Decision,
  InteractionEvent,
  SessionExport,
} from '../domain/types'
import type { Work02Input, Work02InputItem } from './types'
import {
  SUPPORTED_DECK_VERSION,
  SUPPORTED_SESSION_SCHEMA_VERSION,
  WORK02_INPUT_CARD_COUNT,
} from './versions'

export class SessionExportValidationError extends Error {
  constructor(message: string) {
    super(`Invalid SessionExport: ${message}`)
    this.name = 'SessionExportValidationError'
  }
}

type JsonObject = Record<string, unknown>

const fail = (message: string): never => {
  throw new SessionExportValidationError(message)
}

const isObject = (value: unknown): value is JsonObject =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const requireObject = (value: unknown, path: string): JsonObject =>
  isObject(value) ? value : fail(`${path} must be an object.`)

const requireArray = (value: unknown, path: string): unknown[] =>
  Array.isArray(value) ? value : fail(`${path} must be an array.`)

const requireString = (value: unknown, path: string): string =>
  typeof value === 'string' && value.length > 0
    ? value
    : fail(`${path} must be a non-empty string.`)

const requireFiniteNumber = (value: unknown, path: string): number =>
  typeof value === 'number' && Number.isFinite(value)
    ? value
    : fail(`${path} must be a finite number.`)

const requireInteger = (value: unknown, path: string): number => {
  const number = requireFiniteNumber(value, path)
  return Number.isInteger(number) ? number : fail(`${path} must be an integer.`)
}

const requireIsoTimestamp = (value: unknown, path: string): string => {
  const timestamp = requireString(value, path)
  return !Number.isNaN(Date.parse(timestamp)) && timestamp.includes('T')
    ? timestamp
    : fail(`${path} must be an ISO 8601 timestamp.`)
}

const requireDirection = (value: unknown, path: string): 'left' | 'right' =>
  value === 'left' || value === 'right'
    ? value
    : fail(`${path} must be "left" or "right".`)

const validateColor = (value: JsonObject, path: string) => {
  const hex = requireString(value.hex, `${path}.hex`)
  if (!/^#[0-9A-Fa-f]{6}$/.test(hex)) {
    fail(`${path}.hex must use #RRGGBB format.`)
  }

  const hue = requireFiniteNumber(value.hue, `${path}.hue`)
  if (hue < 0 || hue >= 360) fail(`${path}.hue must be in [0, 360).`)

  const lightness = requireFiniteNumber(value.lightness, `${path}.lightness`)
  if (lightness < 0 || lightness > 1) {
    fail(`${path}.lightness must be in [0, 1].`)
  }

  const chroma = requireFiniteNumber(value.chroma, `${path}.chroma`)
  if (chroma < 0) fail(`${path}.chroma must be non-negative.`)

  return { hex, hue, lightness, chroma }
}

const validateCard = (value: unknown, index: number, deckSeed: string): ColorCard => {
  const path = `deck.cards[${index}]`
  const card = requireObject(value, path)
  const presentedOrder = requireInteger(card.presentedOrder, `${path}.presentedOrder`)
  if (presentedOrder !== index + 1) {
    fail(`${path}.presentedOrder must equal ${index + 1}.`)
  }
  const expectedId =
    `${SUPPORTED_DECK_VERSION}:${deckSeed}:${String(presentedOrder).padStart(2, '0')}`
  const cardId = requireString(card.cardId, `${path}.cardId`)
  if (cardId !== expectedId) fail(`${path}.cardId does not match its deck source.`)
  return { cardId, presentedOrder, ...validateColor(card, path) }
}

const validateDecision = (
  value: unknown,
  index: number,
  deckSeed: string,
  card: ColorCard,
): Decision => {
  const path = `decisions[${index}]`
  const decision = requireObject(value, path)
  const presentedOrder = requireInteger(decision.presentedOrder, `${path}.presentedOrder`)
  if (presentedOrder !== index + 1) {
    fail(`${path}.presentedOrder must equal ${index + 1}.`)
  }

  const cardId = requireString(decision.cardId, `${path}.cardId`)
  if (cardId !== card.cardId) fail(`${path}.cardId does not match the presented card.`)
  if (decision.deckVersion !== SUPPORTED_DECK_VERSION) {
    fail(`${path}.deckVersion is unsupported or does not match the deck.`)
  }
  if (decision.deckSeed !== deckSeed) {
    fail(`${path}.deckSeed does not match the deck.`)
  }

  const color = validateColor(decision, path)
  if (
    color.hex !== card.hex ||
    color.hue !== card.hue ||
    color.lightness !== card.lightness ||
    color.chroma !== card.chroma
  ) {
    fail(`${path} color does not match the presented card.`)
  }

  return {
    cardId,
    presentedOrder,
    ...color,
    direction: requireDirection(decision.direction, `${path}.direction`),
    deckVersion: SUPPORTED_DECK_VERSION,
    deckSeed,
  }
}

const validateInteractionEvent = (
  value: unknown,
  index: number,
  cardsById: ReadonlyMap<string, ColorCard>,
): InteractionEvent => {
  const path = `interactionEvents[${index}]`
  const event = requireObject(value, path)
  const sequence = requireInteger(event.sequence, `${path}.sequence`)
  if (sequence !== index + 1) fail(`${path}.sequence must equal ${index + 1}.`)
  const occurredAt = requireIsoTimestamp(event.occurredAt, `${path}.occurredAt`)

  if (event.type === 'session_started' || event.type === 'session_completed') {
    return { sequence, type: event.type, occurredAt }
  }

  if (event.type !== 'decision_committed' && event.type !== 'decision_undone') {
    fail(`${path}.type is unsupported.`)
  }
  const cardId = requireString(event.cardId, `${path}.cardId`)
  const card = cardsById.get(cardId)
  if (!card) fail(`${path}.cardId does not identify a deck card.`)
  const validatedCard = card as ColorCard
  const presentedOrder = requireInteger(event.presentedOrder, `${path}.presentedOrder`)
  if (presentedOrder !== validatedCard.presentedOrder) {
    fail(`${path}.presentedOrder does not match its card.`)
  }

  const eventType = event.type
  if (eventType === 'decision_committed') {
    const inputMethod = event.inputMethod
    if (inputMethod !== 'swipe' && inputMethod !== 'button') {
      fail(`${path}.inputMethod must be "swipe" or "button".`)
    }
    return {
      sequence,
      type: eventType,
      occurredAt,
      cardId,
      presentedOrder,
      direction: requireDirection(event.direction, `${path}.direction`),
      inputMethod: inputMethod as 'swipe' | 'button',
    }
  }

  return {
    sequence,
    type: 'decision_undone',
    occurredAt,
    cardId,
    presentedOrder,
    previousDirection: requireDirection(
      event.previousDirection,
      `${path}.previousDirection`,
    ),
  }
}

export function validateSessionExport(input: unknown): SessionExport {
  const session = requireObject(input, 'session')
  if (session.schemaVersion !== SUPPORTED_SESSION_SCHEMA_VERSION) {
    fail(`schemaVersion must be "${SUPPORTED_SESSION_SCHEMA_VERSION}".`)
  }

  const deck = requireObject(session.deck, 'deck')
  if (deck.deckVersion !== SUPPORTED_DECK_VERSION) {
    fail(`deck.deckVersion must be "${SUPPORTED_DECK_VERSION}".`)
  }
  const deckSeed = requireString(deck.deckSeed, 'deck.deckSeed')
  const rawCards = requireArray(deck.cards, 'deck.cards')
  if (rawCards.length !== WORK02_INPUT_CARD_COUNT) {
    fail(`deck.cards must contain exactly ${WORK02_INPUT_CARD_COUNT} cards.`)
  }
  const cards = rawCards.map((card, index) => validateCard(card, index, deckSeed))
  if (new Set(cards.map((card) => card.cardId)).size !== WORK02_INPUT_CARD_COUNT) {
    fail('deck.cards cardId values must be unique.')
  }

  const rawDecisions = requireArray(session.decisions, 'decisions')
  if (rawDecisions.length !== WORK02_INPUT_CARD_COUNT) {
    fail(`decisions must contain exactly ${WORK02_INPUT_CARD_COUNT} decisions.`)
  }
  const decisions = rawDecisions.map((decision, index) =>
    validateDecision(decision, index, deckSeed, cards[index]))

  const rawEvents = requireArray(session.interactionEvents, 'interactionEvents')
  const cardsById = new Map(cards.map((card) => [card.cardId, card]))
  const interactionEvents = rawEvents.map((event, index) =>
    validateInteractionEvent(event, index, cardsById))
  if (interactionEvents.filter((event) => event.type === 'session_started').length !== 1) {
    fail('interactionEvents must contain exactly one session_started event.')
  }
  if (interactionEvents.filter((event) => event.type === 'session_completed').length !== 1) {
    fail('interactionEvents must contain exactly one session_completed event.')
  }
  if (interactionEvents.at(-1)?.type !== 'session_completed') {
    fail('session_completed must be the final interaction event.')
  }

  const localDate = requireString(session.localDate, 'localDate')
  if (!/^\d{4}-\d{2}-\d{2}$/.test(localDate)) {
    fail('localDate must use YYYY-MM-DD format.')
  }

  return {
    schemaVersion: SUPPORTED_SESSION_SCHEMA_VERSION,
    sessionId: requireString(session.sessionId, 'sessionId'),
    localDate,
    timeZone: requireString(session.timeZone, 'timeZone'),
    createdAt: requireIsoTimestamp(session.createdAt, 'createdAt'),
    startedAt: requireIsoTimestamp(session.startedAt, 'startedAt'),
    completedAt: requireIsoTimestamp(session.completedAt, 'completedAt'),
    deck: { deckVersion: SUPPORTED_DECK_VERSION, deckSeed, cards },
    decisions,
    interactionEvents,
  }
}

export function adaptSessionExport(input: unknown): Work02Input {
  const session = validateSessionExport(input)
  const items: Work02InputItem[] = session.deck.cards.map((card, index) => ({
    index: card.presentedOrder,
    cardId: card.cardId,
    color: {
      hue: card.hue,
      lightness: card.lightness,
      chroma: card.chroma,
    },
    direction: session.decisions[index].direction,
  }))
  return items as unknown as Work02Input
}
