import { beforeEach, describe, expect, it, vi } from 'vitest'
import { generateDeck } from '../domain/deck'
import {
  commitDecision,
  createSession,
  exportSession,
  startSession,
} from '../domain/session'
import type { SessionExport } from '../domain/types'
import {
  adaptSessionExport,
  SessionExportValidationError,
  validateSessionExport,
} from './sessionAdapter'

beforeEach(() => {
  vi.stubGlobal('crypto', {
    randomUUID: () => '00000000-0000-4000-8000-000000000002',
  })
})

const iso = (second: number) =>
  `2026-07-31T01:02:${String(second).padStart(2, '0')}.000Z`

function validSession(): SessionExport {
  let state = createSession(
    generateDeck('work02-adapter-seed'),
    () => new Date(iso(1)),
  )
  state = startSession(state, iso(2))
  for (let index = 0; index < 12; index += 1) {
    state = commitDecision(
      state,
      index % 3 === 0 ? 'left' : 'right',
      index % 2 === 0 ? 'button' : 'swipe',
      iso(index + 3),
    )
  }
  return exportSession(state)
}

const clone = <T>(value: T): T => structuredClone(value)

describe('validateSessionExport and adaptSessionExport', () => {
  it('validates and copies a complete SessionExport into exactly 12 Work 02 items', () => {
    const session = validSession()
    expect(validateSessionExport(session)).toEqual(session)
    const adapted = adaptSessionExport(session)
    expect(adapted).toHaveLength(12)
    expect(adapted).toEqual(session.deck.cards.map((card, index) => ({
      index: index + 1,
      cardId: card.cardId,
      color: {
        hue: card.hue,
        lightness: card.lightness,
        chroma: card.chroma,
      },
      direction: session.decisions[index].direction,
    })))
    expect(adapted[0].color).not.toBe(session.deck.cards[0])
  })

  it.each([
    ['schema version', (session: Record<string, unknown>) => {
      session.schemaVersion = 'work01-session-v2'
    }],
    ['deck version', (session: Record<string, unknown>) => {
      ;(session.deck as Record<string, unknown>).deckVersion = 'work01-oklch-v2'
    }],
  ])('rejects an invalid %s', (_, mutate) => {
    const session = clone(validSession()) as unknown as Record<string, unknown>
    mutate(session)
    expect(() => adaptSessionExport(session)).toThrow(SessionExportValidationError)
  })

  it.each([
    ['card', (session: SessionExport) => session.deck.cards.pop()],
    ['decision', (session: SessionExport) => session.decisions.pop()],
  ])('rejects a session whose %s count is not 12', (_, mutate) => {
    const session = clone(validSession())
    mutate(session)
    expect(() => adaptSessionExport(session)).toThrow(/exactly 12/)
  })

  it('rejects duplicate and out-of-position presentedOrder values instead of sorting', () => {
    const duplicate = clone(validSession())
    duplicate.deck.cards[1].presentedOrder = 1
    expect(() => adaptSessionExport(duplicate)).toThrow(/presentedOrder/)

    const reordered = clone(validSession())
    ;[reordered.decisions[0], reordered.decisions[1]] = [
      reordered.decisions[1],
      reordered.decisions[0],
    ]
    expect(() => adaptSessionExport(reordered)).toThrow(/presentedOrder/)
  })

  it.each([
    ['card ID', (session: SessionExport) => {
      session.deck.cards[0].cardId = 'wrong-card'
    }],
    ['decision ID', (session: SessionExport) => {
      session.decisions[0].cardId = session.decisions[1].cardId
    }],
    ['decision seed', (session: SessionExport) => {
      session.decisions[0].deckSeed = 'wrong-seed'
    }],
    ['decision version', (session: SessionExport) => {
      session.decisions[0].deckVersion =
        'work01-oklch-v2' as SessionExport['decisions'][number]['deckVersion']
    }],
  ])('rejects a mismatched %s source', (_, mutate) => {
    const session = clone(validSession())
    mutate(session)
    expect(() => adaptSessionExport(session)).toThrow(SessionExportValidationError)
  })

  it.each([
    ['direction', (session: SessionExport) => {
      session.decisions[0].direction =
        'up' as SessionExport['decisions'][number]['direction']
    }],
    ['hex', (session: SessionExport) => {
      session.deck.cards[0].hex = '#XYZ123'
      session.decisions[0].hex = '#XYZ123'
    }],
    ['hue', (session: SessionExport) => {
      session.deck.cards[0].hue = 360
      session.decisions[0].hue = 360
    }],
    ['lightness', (session: SessionExport) => {
      session.deck.cards[0].lightness = -0.1
      session.decisions[0].lightness = -0.1
    }],
    ['chroma', (session: SessionExport) => {
      session.deck.cards[0].chroma = Number.NaN
      session.decisions[0].chroma = Number.NaN
    }],
  ])('rejects an invalid %s value', (_, mutate) => {
    const session = clone(validSession())
    mutate(session)
    expect(() => adaptSessionExport(session)).toThrow(SessionExportValidationError)
  })

  it('ignores session identity, timestamps, event timing/history input method, and extra metadata', () => {
    const baseline = validSession()
    const variant = clone(baseline) as SessionExport & {
      inputMethod?: string
    }
    variant.sessionId = 'different-session'
    variant.localDate = '2030-01-02'
    variant.createdAt = '2030-01-02T03:04:05.000Z'
    variant.startedAt = '2030-01-02T03:04:06.000Z'
    variant.completedAt = '2030-01-02T03:04:30.000Z'
    variant.inputMethod = 'external-metadata'
    variant.interactionEvents.forEach((event, index) => {
      event.occurredAt = `2030-01-02T03:05:${String(index).padStart(2, '0')}.000Z`
      if (event.type === 'decision_committed') {
        event.inputMethod = event.inputMethod === 'button' ? 'swipe' : 'button'
      }
    })
    variant.interactionEvents.splice(-1, 0, {
      sequence: 0,
      type: 'decision_undone',
      occurredAt: '2030-01-02T03:05:30.000Z',
      cardId: variant.deck.cards[0].cardId,
      presentedOrder: 1,
      previousDirection: 'right',
    })
    variant.interactionEvents.forEach((event, index) => {
      event.sequence = index + 1
    })
    expect(adaptSessionExport(variant)).toEqual(adaptSessionExport(baseline))
  })
})
