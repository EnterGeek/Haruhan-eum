import { beforeEach, describe, expect, it, vi } from 'vitest'
import { generateDeck } from './deck'
import {
  commitDecision,
  createSession,
  exportSession,
  startSession,
  undoDecision,
} from './session'

beforeEach(() => {
  vi.stubGlobal('crypto', {
    randomUUID: () => '00000000-0000-4000-8000-000000000001',
  })
})

const clock = () => new Date('2026-07-31T01:02:03.000Z')
const at = (seconds: number) => `2026-07-31T01:02:${String(seconds).padStart(2, '0')}.000Z`

function started() {
  return startSession(createSession(generateDeck('session-seed'), clock), at(4))
}

describe('session state contract', () => {
  it.each([
    ['all left', Array(12).fill('left')],
    ['all right', Array(12).fill('right')],
    ['alternating', Array.from({ length: 12 }, (_, index) => index % 2 ? 'right' : 'left')],
  ])('records every card exactly once: %s', (_, directions) => {
    let state = started()
    directions.forEach((direction, index) => {
      state = commitDecision(state, direction as 'left' | 'right', 'button', at(index + 5))
    })
    const exported = exportSession(state)
    expect(exported.decisions).toHaveLength(12)
    expect(new Set(exported.decisions.map((decision) => decision.cardId)).size).toBe(12)
    expect(exported.decisions.map((decision) => decision.direction)).toEqual(directions)
    expect(exported.deck.cards.map((card) => card.cardId)).toEqual(
      exported.decisions.map((decision) => decision.cardId),
    )
  })

  it('removes an undone choice from decisions but preserves full event history', () => {
    let state = started()
    state = commitDecision(state, 'left', 'swipe', at(5))
    state = undoDecision(state, at(6))
    state = commitDecision(state, 'right', 'button', at(7))
    expect(state.decisions).toHaveLength(1)
    expect(state.decisions[0].direction).toBe('right')
    expect(state.interactionEvents.map((event) => event.type)).toEqual([
      'session_started',
      'decision_committed',
      'decision_undone',
      'decision_committed',
    ])
  })

  it('ignores decisions before start and after completion', () => {
    const initial = createSession(generateDeck('guarded'), clock)
    expect(commitDecision(initial, 'right', 'button', at(4))).toBe(initial)
    let state = startSession(initial, at(4))
    for (let index = 0; index < 12; index += 1) {
      state = commitDecision(state, 'right', 'button', at(index + 5))
    }
    const after = commitDecision(state, 'left', 'button', at(20))
    expect(after).toBe(state)
    expect(after.decisions).toHaveLength(12)
  })

  it('rejects export before all 12 decisions are committed', () => {
    expect(() => exportSession(started())).toThrow('Only completed sessions')
  })

  it('duplicates deck identity only as validated Work 02 convenience fields', () => {
    let state = started()
    for (let index = 0; index < 12; index += 1) {
      state = commitDecision(state, 'right', 'button', at(index + 5))
    }
    const data = exportSession(state)
    data.decisions.forEach((decision) => {
      expect(decision.deckSeed).toBe(data.deck.deckSeed)
      expect(decision.deckVersion).toBe(data.deck.deckVersion)
    })
  })
})
