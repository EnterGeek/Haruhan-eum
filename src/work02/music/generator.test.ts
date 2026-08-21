import { describe, expect, it } from 'vitest'
import type { Direction } from '../../domain/types'
import goldenSessions from '../../../docs/golden-sessions/representative-sessions.json'
import { expandGoldenCase } from '../golden/expandGoldenCase'
import { interpretFlow } from '../interpretation/interpretFlow'
import type { InterpretationMethod } from '../interpretation/types'
import type { Work02Input } from '../types'
import {
  MELODY_GENERATOR_VERSION,
  MELODY_OUTPUT_CONTRACT_VERSION,
} from '../versions'
import {
  buildScaleNotes,
  generateMelody,
  quantizeContourIndex,
  selectLeapLimitedNote,
  validateFlowInterpretationForMelody,
} from './generator'
import { validateMelodyOutput } from './validateMelody'

const methods: readonly InterpretationMethod[] = [
  'absolute-hue',
  'relative-hue',
  'hybrid',
]

const makeInput = (
  hues: readonly number[],
  directions: readonly Direction[],
): Work02Input => hues.map((hue, index) => ({
  index: index + 1,
  cardId: `generator-card-${index + 1}`,
  color: { hue, lightness: 0.6, chroma: 0.12 },
  direction: directions[index],
})) as unknown as Work02Input

const syntheticInputs = [
  makeInput(
    [0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330],
    Array(12).fill('right'),
  ),
  makeInput(
    [330, 300, 270, 240, 210, 180, 150, 120, 90, 60, 30, 0],
    Array(12).fill('left'),
  ),
  makeInput(
    [0, 359, 1, 180, 181, 179, 90, 270, 45, 225, 135, 315],
    Array.from({ length: 12 }, (_, index) => index % 2 ? 'right' : 'left'),
  ),
  makeInput(
    [15, 15, 15, 15, 15, 15, 15, 15, 15, 15, 15, 15],
    Array.from({ length: 12 }, (_, index) => index < 6 ? 'left' : 'right'),
  ),
  makeInput(
    [10, 190, 10, 190, 10, 190, 10, 190, 10, 190, 10, 190],
    Array.from({ length: 12 }, (_, index) => index % 3 ? 'left' : 'right'),
  ),
  makeInput(
    [359, 1, 3, 5, 7, 9, 11, 13, 15, 17, 19, 21],
    Array.from({ length: 12 }, (_, index) => index % 4 === 0 ? 'left' : 'right'),
  ),
  makeInput(
    [42, 287, 103, 221, 8, 354, 176, 64, 299, 138, 250, 19],
    ['right', 'left', 'left', 'right', 'right', 'left',
      'right', 'left', 'right', 'left', 'left', 'right'],
  ),
] as const

const pitches = (method: InterpretationMethod, input: Work02Input): number[] =>
  generateMelody(interpretFlow(input, method)).events.flatMap(
    (event) => event.kind === 'note' ? [event.midiNote] : [],
  )

describe('baseline melody generator helpers', () => {
  it('builds the exact in-range major pentatonic scale notes', () => {
    expect(buildScaleNotes()).toEqual([60, 62, 64, 67, 69, 72, 74, 76])
  })

  it('quantizes endpoints and uses the upper index for exact midpoint ties', () => {
    expect(quantizeContourIndex(0, 8)).toBe(0)
    expect(quantizeContourIndex(1, 8)).toBe(7)
    expect(quantizeContourIndex(0.5 / 7, 8)).toBe(1)
    expect(quantizeContourIndex(3.49 / 7, 8)).toBe(3)
  })

  it('rejects invalid quantization inputs', () => {
    expect(() => quantizeContourIndex(Number.NaN, 8)).toThrow()
    expect(() => quantizeContourIndex(-0.01, 8)).toThrow()
    expect(() => quantizeContourIndex(0.5, 0)).toThrow()
  })

  it('limits leaps by target distance before the remaining tie-breaks', () => {
    const notes = buildScaleNotes()
    expect(selectLeapLimitedNote(notes, 76, 60, 7)).toBe(67)
    expect(selectLeapLimitedNote(notes, 64, null, 7)).toBe(64)
  })

  it('prefers the previous-note-closer candidate before lower MIDI on target ties', () => {
    expect(selectLeapLimitedNote([60, 64], 62, 64, 7)).toBe(64)
  })

  it('uses lower MIDI only when target and previous-note distances are both tied', () => {
    expect(selectLeapLimitedNote([60, 64], 62, 62, 7)).toBe(60)
  })
})

describe('FlowInterpretation melody input boundary', () => {
  const valid = () => interpretFlow(syntheticInputs[2], 'hybrid')

  it('accepts a valid interpretation without mutation', () => {
    const input = valid()
    const before = structuredClone(input)
    expect(validateFlowInterpretationForMelody(input)).toBe(input)
    expect(input).toEqual(before)
  })

  it.each([
    ['an arbitrary source', (value: any) => { value.registerContourCandidates[2].source = 'arbitrary' }],
    ['a different method source', (value: any) => {
      value.registerContourCandidates[2].source =
        `relative-hue@${value.versions.interpreter}`
    }],
    ['the current method with a different interpreter version', (value: any) => {
      value.registerContourCandidates[2].source = 'hybrid@work02-hybrid-hue-v0'
    }],
  ])('rejects %s without mutation', (_, change) => {
    const value = structuredClone(valid())
    change(value)
    const beforeValidation = structuredClone(value)
    expect(() => validateFlowInterpretationForMelody(value)).toThrow(
      /source must equal hybrid@work02-hybrid-hue-v1/,
    )
    expect(value).toEqual(beforeValidation)
  })

  it('accepts an exact current method and interpreter source without mutation', () => {
    const value = valid()
    const before = structuredClone(value)
    expect(validateFlowInterpretationForMelody(value)).toBe(value)
    expect(value).toEqual(before)
  })

  it.each([
    ['input version', (value: any) => { value.versions.input = 'wrong' }],
    ['contract version', (value: any) => { value.versions.contract = 'wrong' }],
    ['interpreter pair', (value: any) => { value.versions.interpreter = 'wrong' }],
    ['item count', (value: any) => { value.inputItemCount = 11 }],
    ['item order', (value: any) => { value.items[2].presentedOrder = 4 }],
    ['item sequence', (value: any) => { value.items[2].sequencePosition = 4 }],
    ['direction', (value: any) => { value.items[2].selectionDirection = 'up' }],
    ['contour order', (value: any) => {
      value.registerContourCandidates[2].presentedOrder = 4
    }],
    ['non-finite contour', (value: any) => {
      value.registerContourCandidates[2].normalizedPosition = Number.NaN
    }],
    ['out-of-range contour', (value: any) => {
      value.registerContourCandidates[2].normalizedPosition = 1.01
    }],
  ])('rejects invalid %s', (_, change) => {
    const value = structuredClone(valid())
    change(value)
    expect(() => validateFlowInterpretationForMelody(value)).toThrow(
      /Invalid FlowInterpretation for melody/,
    )
  })
})

describe('baseline melody output', () => {
  it.each(methods)('uses the shared grammar and exact %s version chain', (method) => {
    const output = generateMelody(interpretFlow(syntheticInputs[2], method))
    expect(output.versions.outputContract).toBe(MELODY_OUTPUT_CONTRACT_VERSION)
    expect(output.versions.generator).toBe(MELODY_GENERATOR_VERSION)
    expect(output.method).toBe(method)
    expect(output.totalBeats).toBe(12)
    expect(validateMelodyOutput(output)).toBe(output)
  })

  it('maps each selection to one exact 1-beat time cell', () => {
    const input = syntheticInputs[6]
    const output = generateMelody(interpretFlow(input, 'absolute-hue'))
    let eventIndex = 0
    input.forEach((item, index) => {
      const note = output.events[eventIndex]
      expect(note).toMatchObject({
        kind: 'note',
        startBeat: index,
        durationBeats: item.direction === 'right' ? 1 : 0.5,
      })
      expect(note.source.presentedOrders).toEqual([index + 1])
      expect(note.source.selectionDirections).toEqual([item.direction])
      eventIndex += 1
      if (item.direction === 'left') {
        expect(output.events[eventIndex]).toMatchObject({
          kind: 'rest',
          startBeat: index + 0.5,
          durationBeats: 0.5,
        })
        eventIndex += 1
      }
    })
    expect(eventIndex).toBe(output.events.length)
  })

  it('is deterministic, does not mutate input, and contains no variation seed', () => {
    const input = interpretFlow(syntheticInputs[6], 'hybrid')
    const before = structuredClone(input)
    expect(generateMelody(input)).toEqual(generateMelody(input))
    expect(input).toEqual(before)
    expect(JSON.stringify(generateMelody(input))).not.toMatch(/variationSeed/)
  })

  it('keeps A/B/C output structure shared while contour-derived pitches differ', () => {
    const outputs = methods.map((method) =>
      generateMelody(interpretFlow(syntheticInputs[6], method)))
    outputs.forEach((output) => {
      expect(output.grammar).toEqual(outputs[0].grammar)
      expect(output.events.map((event) => [
        event.kind, event.startBeat, event.durationBeats,
      ])).toEqual(outputs[0].events.map((event) => [
        event.kind, event.startBeat, event.durationBeats,
      ]))
    })
    expect(new Set(outputs.map((output) => JSON.stringify(
      output.events.flatMap((event) => event.kind === 'note' ? [event.midiNote] : []),
    ))).size).toBeGreaterThan(1)
  })

  it('keeps synthetic mathematical edge-case MIDI regressions separate from Work 01 fixtures', () => {
    const actual = syntheticInputs.flatMap((input) =>
      methods.map((method) => pitches(method, input)))
    expect(actual).toEqual([
      [60, 62, 62, 64, 64, 67, 69, 69, 72, 72, 74, 74],
      [69, 69, 69, 69, 69, 69, 69, 69, 69, 69, 69, 69],
      [64, 64, 67, 67, 67, 69, 69, 69, 69, 72, 72, 72],
      [74, 74, 72, 72, 69, 69, 67, 64, 64, 62, 62, 60],
      [69, 67, 67, 67, 67, 67, 67, 67, 67, 67, 67, 67],
      [72, 69, 69, 69, 69, 67, 67, 67, 64, 64, 64, 62],
      [60, 67, 60, 67, 69, 67, 64, 69, 62, 69, 67, 74],
      [69, 67, 69, 76, 69, 67, 64, 69, 74, 76, 69, 76],
      [64, 69, 64, 69, 69, 67, 64, 69, 69, 74, 67, 74],
      [60, 60, 60, 60, 60, 60, 60, 60, 60, 60, 60, 60],
      [69, 69, 69, 69, 69, 69, 69, 69, 69, 69, 69, 69],
      [64, 64, 64, 64, 64, 64, 64, 64, 64, 64, 64, 64],
      [60, 67, 60, 67, 60, 67, 60, 67, 60, 67, 60, 67],
      [69, 76, 76, 76, 76, 76, 76, 76, 76, 76, 76, 76],
      [64, 69, 69, 72, 69, 72, 69, 72, 69, 72, 69, 72],
      [76, 69, 62, 60, 60, 60, 60, 60, 60, 60, 60, 60],
      [69, 69, 69, 69, 69, 69, 69, 69, 69, 69, 69, 69],
      [72, 67, 64, 64, 64, 64, 64, 64, 64, 64, 64, 64],
      [62, 69, 64, 69, 62, 69, 67, 62, 69, 67, 72, 67],
      [69, 62, 69, 74, 74, 67, 60, 62, 62, 60, 67, 74],
      [64, 67, 69, 72, 67, 72, 67, 62, 67, 64, 69, 67],
    ])
  })

  it('keeps synthetic all-left and all-right articulation edge cases explicit', () => {
    const allRight = generateMelody(interpretFlow(syntheticInputs[0], 'absolute-hue'))
    const allLeft = generateMelody(interpretFlow(syntheticInputs[1], 'absolute-hue'))
    expect(allRight.events.filter((event) => event.kind === 'note')).toHaveLength(12)
    expect(allRight.events.filter((event) => event.kind === 'rest')).toHaveLength(0)
    expect(allLeft.events.filter((event) => event.kind === 'note')).toHaveLength(12)
    expect(allLeft.events.filter((event) => event.kind === 'rest')).toHaveLength(12)
  })
})

const goldenCaseIds = goldenSessions.cases.map((goldenCase) => goldenCase.id)
const expectedGoldenCaseIds = [
  'same-deck-baseline',
  'all-left-fast-buttons',
  'all-right-same-deck-replay',
  'undo-and-reselect',
  'swipe-only',
  'mixed-button-and-swipe',
  'pause-and-resume',
] as const

describe('actual Work 01 golden fixture melody regression', () => {
  it('uses the approved seven Work 01 representative case IDs', () => {
    expect(goldenCaseIds).toEqual(expectedGoldenCaseIds)
  })

  it.each(goldenCaseIds.flatMap((caseId) =>
    methods.map((method) => [caseId, method] as const),
  ))('runs %s through the %s pipeline deterministically', (caseId, method) => {
    const input = expandGoldenCase(goldenSessions, caseId)
    const interpretation = interpretFlow(input, method)
    const output = generateMelody(interpretation)

    expect(validateMelodyOutput(output)).toBe(output)
    expect(output.totalBeats).toBe(12)
    expect(output.grammar.totalBeats * 60 / output.grammar.tempoBpm).toBe(9)
    expect([...new Set(output.events.flatMap((event) => event.source.presentedOrders))])
      .toEqual(Array.from({ length: 12 }, (_, index) => index + 1))
    expect(JSON.stringify(generateMelody(interpretFlow(
      expandGoldenCase(goldenSessions, caseId), method,
    )))).toBe(JSON.stringify(output))
  })

  it('distinguishes at least one fixture case across A/B/C MIDI results', () => {
    const differs = goldenCaseIds.some((caseId) => {
      const input = expandGoldenCase(goldenSessions, caseId)
      const midiResults = methods.map((method) => pitches(method, input))
      return new Set(midiResults.map((midi) => JSON.stringify(midi))).size > 1
    })
    expect(differs).toBe(true)
  })

  it('preserves the actual all-left and all-right fixture articulations', () => {
    const allLeft = generateMelody(interpretFlow(
      expandGoldenCase(goldenSessions, 'all-left-fast-buttons'),
      'absolute-hue',
    ))
    const allRight = generateMelody(interpretFlow(
      expandGoldenCase(goldenSessions, 'all-right-same-deck-replay'),
      'absolute-hue',
    ))

    expect(allLeft.events.filter((event) => event.kind === 'note')).toHaveLength(12)
    expect(allLeft.events.filter((event) => event.kind === 'rest')).toHaveLength(12)
    expect(allRight.events.filter((event) => event.kind === 'note')).toHaveLength(12)
    expect(allRight.events.filter((event) => event.kind === 'rest')).toHaveLength(0)
  })
})
