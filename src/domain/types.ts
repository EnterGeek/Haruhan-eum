export const DECK_VERSION = 'work01-oklch-v1' as const
export const SESSION_SCHEMA_VERSION = 'work01-session-v1' as const

export type Direction = 'left' | 'right'
export type InputMethod = 'swipe' | 'button'

export interface ColorCard {
  cardId: string
  presentedOrder: number
  hex: string
  hue: number
  lightness: number
  chroma: number
}

export interface ColorDeck {
  deckVersion: typeof DECK_VERSION
  deckSeed: string
  cards: ColorCard[]
}

export interface Decision {
  cardId: string
  presentedOrder: number
  hex: string
  hue: number
  lightness: number
  chroma: number
  direction: Direction
  deckVersion: typeof DECK_VERSION
  deckSeed: string
}

export type InteractionEvent =
  | {
      sequence: number
      type: 'session_started'
      occurredAt: string
    }
  | {
      sequence: number
      type: 'decision_committed'
      occurredAt: string
      cardId: string
      presentedOrder: number
      direction: Direction
      inputMethod: InputMethod
    }
  | {
      sequence: number
      type: 'decision_undone'
      occurredAt: string
      cardId: string
      presentedOrder: number
      previousDirection: Direction
    }
  | {
      sequence: number
      type: 'session_completed'
      occurredAt: string
    }

export interface SessionExport {
  schemaVersion: typeof SESSION_SCHEMA_VERSION
  sessionId: string
  localDate: string
  timeZone: string
  createdAt: string
  startedAt: string
  completedAt: string
  deck: ColorDeck
  decisions: Decision[]
  interactionEvents: InteractionEvent[]
}
