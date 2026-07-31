import {
  SESSION_SCHEMA_VERSION,
  type ColorDeck,
  type Decision,
  type Direction,
  type InputMethod,
  type InteractionEvent,
  type SessionExport,
} from './types'

export interface SessionState {
  deck: ColorDeck
  sessionId: string
  localDate: string
  timeZone: string
  createdAt: string
  startedAt: string | null
  completedAt: string | null
  decisions: Decision[]
  interactionEvents: InteractionEvent[]
}

type EventWithoutSequence<T = InteractionEvent> =
  T extends InteractionEvent ? Omit<T, 'sequence'> : never

export function createSession(
  deck: ColorDeck,
  clock: () => Date = () => new Date(),
): SessionState {
  const now = clock()
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
  const localDate = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0'),
  ].join('-')
  return {
    deck,
    sessionId: crypto.randomUUID(),
    localDate,
    timeZone,
    createdAt: now.toISOString(),
    startedAt: null,
    completedAt: null,
    decisions: [],
    interactionEvents: [],
  }
}

const appendEvent = (
  state: SessionState,
  event: EventWithoutSequence,
): InteractionEvent[] => [
  ...state.interactionEvents,
  { ...event, sequence: state.interactionEvents.length + 1 } as InteractionEvent,
]

export function startSession(state: SessionState, now: string): SessionState {
  if (state.startedAt) return state
  return {
    ...state,
    startedAt: now,
    interactionEvents: appendEvent(state, {
      type: 'session_started',
      occurredAt: now,
    }),
  }
}

export function commitDecision(
  state: SessionState,
  direction: Direction,
  inputMethod: InputMethod,
  now: string,
): SessionState {
  if (!state.startedAt || state.completedAt) return state
  const card = state.deck.cards[state.decisions.length]
  if (!card) return state
  const decision: Decision = {
    ...card,
    direction,
    deckVersion: state.deck.deckVersion,
    deckSeed: state.deck.deckSeed,
  }
  const decisions = [...state.decisions, decision]
  let interactionEvents = appendEvent(state, {
    type: 'decision_committed',
    occurredAt: now,
    cardId: card.cardId,
    presentedOrder: card.presentedOrder,
    direction,
    inputMethod,
  })
  const completedAt = decisions.length === state.deck.cards.length ? now : null
  if (completedAt) {
    interactionEvents = [
      ...interactionEvents,
      {
        sequence: interactionEvents.length + 1,
        type: 'session_completed',
        occurredAt: now,
      },
    ]
  }
  return { ...state, decisions, interactionEvents, completedAt }
}

export function undoDecision(state: SessionState, now: string): SessionState {
  const previous = state.decisions.at(-1)
  if (!previous) return state
  return {
    ...state,
    completedAt: null,
    decisions: state.decisions.slice(0, -1),
    interactionEvents: appendEvent(state, {
      type: 'decision_undone',
      occurredAt: now,
      cardId: previous.cardId,
      presentedOrder: previous.presentedOrder,
      previousDirection: previous.direction,
    }),
  }
}

export function exportSession(state: SessionState): SessionExport {
  if (!state.startedAt || !state.completedAt) {
    throw new Error('Only completed sessions can be exported.')
  }
  if (state.decisions.length !== state.deck.cards.length) {
    throw new Error('Completed session must include every card decision.')
  }
  state.decisions.forEach((decision, index) => {
    const card = state.deck.cards[index]
    if (
      decision.cardId !== card.cardId ||
      decision.deckSeed !== state.deck.deckSeed ||
      decision.deckVersion !== state.deck.deckVersion
    ) {
      throw new Error(`Decision/deck mismatch at order ${index + 1}.`)
    }
  })
  return {
    schemaVersion: SESSION_SCHEMA_VERSION,
    sessionId: state.sessionId,
    localDate: state.localDate,
    timeZone: state.timeZone,
    createdAt: state.createdAt,
    startedAt: state.startedAt,
    completedAt: state.completedAt,
    deck: state.deck,
    decisions: state.decisions,
    interactionEvents: state.interactionEvents,
  }
}
