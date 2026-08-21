import { describe, expect, it } from 'vitest'
import {
  ABSOLUTE_HUE_INTERPRETER_VERSION,
  MELODY_GENERATOR_VERSION,
  FLOW_INTERPRETATION_CONTRACT_VERSION,
  MELODY_OUTPUT_CONTRACT_VERSION,
  MUSIC_GRAMMAR_VERSION,
} from '../versions'
import { createMusicGrammarSnapshot, DEFAULT_MUSIC_GRAMMAR } from './grammar'
import { beatsToSeconds, secondsPerBeat } from './time'
import type { MelodyOutput, MusicGrammarSnapshot } from './types'
import { validateMusicGrammar } from './validateGrammar'
import { validateMelodyOutput } from './validateMelody'

const mutableGrammar = (): MusicGrammarSnapshot =>
  structuredClone(DEFAULT_MUSIC_GRAMMAR)

const note = (
  eventIndex: number,
  startBeat: number,
  durationBeats: number,
  midiNote: number,
  orders: number[],
) => ({
  kind: 'note' as const,
  eventIndex,
  startBeat,
  durationBeats,
  midiNote,
  source: {
    presentedOrders: orders,
    selectionDirections: orders.map((order) => order % 2 ? 'left' as const : 'right' as const),
    contourPositions: orders.map((order) => order / 12),
  },
})

const rest = (
  eventIndex: number,
  startBeat: number,
  durationBeats: number,
  orders: number[],
) => ({
  kind: 'rest' as const,
  eventIndex,
  startBeat,
  durationBeats,
  source: {
    presentedOrders: orders,
    selectionDirections: orders.map(() => 'left' as const),
    contourPositions: orders.map((order) => order / 12),
  },
})

const validOutput = (): MelodyOutput => ({
  versions: {
    outputContract: MELODY_OUTPUT_CONTRACT_VERSION,
    grammar: MUSIC_GRAMMAR_VERSION,
    interpretationContract: FLOW_INTERPRETATION_CONTRACT_VERSION,
    interpreter: ABSOLUTE_HUE_INTERPRETER_VERSION,
    generator: MELODY_GENERATOR_VERSION,
  },
  method: 'absolute-hue',
  grammar: createMusicGrammarSnapshot(),
  totalBeats: 12,
  events: [
    note(0, 0, 2, 60, [1, 2]),
    note(1, 2, 2, 64, [3, 4]),
    rest(2, 4, 2, [5, 6]),
    note(3, 6, 2, 67, [7, 8]),
    note(4, 8, 2, 72, [9, 10]),
    note(5, 10, 2, 76, [11, 12]),
  ],
})

const mutate = (
  change: (output: Record<string, any>) => void,
): Record<string, any> => {
  const output = structuredClone(validOutput()) as Record<string, any>
  change(output)
  return output
}

describe('music grammar contract', () => {
  it('accepts the temporary default grammar and derives nine seconds', () => {
    expect(validateMusicGrammar(DEFAULT_MUSIC_GRAMMAR)).toBe(DEFAULT_MUSIC_GRAMMAR)
    expect(secondsPerBeat(80)).toBe(0.75)
    expect(beatsToSeconds(12, 80)).toBe(9)
    expect(beatsToSeconds(
      DEFAULT_MUSIC_GRAMMAR.totalBeats,
      DEFAULT_MUSIC_GRAMMAR.tempoBpm,
    )).toBeGreaterThanOrEqual(DEFAULT_MUSIC_GRAMMAR.targetDurationSeconds.minimum)
    expect(beatsToSeconds(
      DEFAULT_MUSIC_GRAMMAR.totalBeats,
      DEFAULT_MUSIC_GRAMMAR.tempoBpm,
    )).toBeLessThanOrEqual(DEFAULT_MUSIC_GRAMMAR.targetDurationSeconds.maximum)
  })

  it.each([
    ['duplicate scale offset', (g: any) => { g.scale.semitoneOffsets = [0, 2, 2] }],
    ['unsorted scale', (g: any) => { g.scale.semitoneOffsets = [0, 4, 2] }],
    ['out-of-range scale', (g: any) => { g.scale.semitoneOffsets = [0, 12] }],
    ['missing scale root', (g: any) => { g.scale.semitoneOffsets = [2, 4] }],
    ['invalid tonic', (g: any) => { g.tonicMidi = 60.5 }],
    ['invalid MIDI range', (g: any) => { g.minimumMidi = 90; g.maximumMidi = 80 }],
    ['non-positive tempo', (g: any) => { g.tempoBpm = 0 }],
    ['invalid total beats', (g: any) => { g.totalBeats = Number.NaN }],
    ['non-finite duration', (g: any) => { g.allowedDurationsBeats = [1, Infinity] }],
    ['zero duration', (g: any) => { g.allowedDurationsBeats = [0, 1] }],
    ['negative duration', (g: any) => { g.allowedDurationsBeats = [-1, 1] }],
    ['invalid maximum leap', (g: any) => { g.maximumMelodicLeapSemitones = -1 }],
  ])('rejects %s', (_, change) => {
    const grammar = mutableGrammar()
    change(grammar)
    expect(() => validateMusicGrammar(grammar)).toThrow()
  })

  it('rejects a MIDI range with no actual scale note', () => {
    const grammar = mutableGrammar()
    grammar.tonicMidi = 60
    grammar.scale.semitoneOffsets = [0]
    grammar.minimumMidi = 61
    grammar.maximumMidi = 61
    expect(() => validateMusicGrammar(grammar)).toThrow(/scale note/)
  })

  it('rejects grammar timing outside its target instead of changing it', () => {
    const grammar = mutableGrammar()
    grammar.tempoBpm = 20
    expect(() => validateMusicGrammar(grammar)).toThrow(/target range/)
    expect(grammar.tempoBpm).toBe(20)
  })

  it('creates an immutable deep copy without linking defaults or source', () => {
    const source = mutableGrammar()
    const snapshot = createMusicGrammarSnapshot(source)
    expect(snapshot).toEqual(source)
    expect(snapshot).not.toBe(source)
    expect(snapshot.scale).not.toBe(source.scale)
    expect(snapshot.scale.semitoneOffsets).not.toBe(source.scale.semitoneOffsets)
    expect(snapshot.allowedDurationsBeats).not.toBe(source.allowedDurationsBeats)
    source.scale.semitoneOffsets = [0]
    source.allowedDurationsBeats = [1]
    expect(snapshot.scale.semitoneOffsets).toEqual([0, 2, 4, 7, 9])
    expect(snapshot.allowedDurationsBeats).toEqual([0.5, 1, 1.5, 2])
    expect(() => (snapshot.allowedDurationsBeats as number[]).push(4)).toThrow()
    expect(DEFAULT_MUSIC_GRAMMAR.scale.semitoneOffsets).toEqual([0, 2, 4, 7, 9])
    expect(JSON.parse(JSON.stringify(snapshot))).toEqual(snapshot)
  })

  it('rejects invalid helper inputs', () => {
    expect(() => secondsPerBeat(0)).toThrow()
    expect(() => beatsToSeconds(-1, 80)).toThrow()
  })
})

describe('melody output contract', () => {
  it('accepts a valid note-and-rest fixture deterministically without mutation', () => {
    const output = validOutput()
    const before = structuredClone(output)
    expect(validateMelodyOutput(output)).toBe(output)
    expect(validateMelodyOutput(output)).toBe(output)
    expect(output).toEqual(before)
  })

  it('accepts a valid all-note fixture', () => {
    const output = validOutput()
    output.events = output.events.map((event) =>
      event.kind === 'rest' ? note(2, 4, 2, 64, [5, 6]) : event)
    expect(validateMelodyOutput(output)).toBe(output)
  })

  it.each([
    ['non-contiguous event index', (o: any) => { o.events[2].eventIndex = 8 }],
    ['sort error', (o: any) => { [o.events[1], o.events[2]] = [o.events[2], o.events[1]] }],
    ['overlap', (o: any) => { o.events[2].startBeat = 3.5 }],
    ['hidden gap', (o: any) => { o.events[2].startBeat = 4.5 }],
    ['wrong final beat', (o: any) => { o.events.at(-1).durationBeats = 1.5 }],
    ['unsupported duration', (o: any) => { o.events[0].durationBeats = 1.25 }],
    ['MIDI outside range', (o: any) => { o.events[1].midiNote = 77 }],
    ['MIDI outside scale', (o: any) => { o.events[1].midiNote = 61 }],
    ['maximum leap', (o: any) => { o.events[1].midiNote = 72 }],
    ['maximum leap across rest', (o: any) => { o.events[1].midiNote = 60; o.events[3].midiNote = 72 }],
    ['no note', (o: any) => { o.events = [rest(0, 0, 2, [1, 2]), rest(1, 2, 2, [3, 4]), rest(2, 4, 2, [5, 6]), rest(3, 6, 2, [7, 8]), rest(4, 8, 2, [9, 10]), rest(5, 10, 2, [11, 12])] }],
    ['method/interpreter mismatch', (o: any) => { o.method = 'relative-hue' }],
    ['wrong output version', (o: any) => { o.versions.outputContract = 'wrong' }],
    ['wrong generator version', (o: any) => { o.versions.generator = 'wrong' }],
    ['wrong grammar version', (o: any) => { o.versions.grammar = 'wrong' }],
    ['wrong interpretation version', (o: any) => { o.versions.interpretationContract = 'wrong' }],
    ['method-specific grammar', (o: any) => { o.grammar.maximumMelodicLeapSemitones = 8 }],
    ['source length mismatch', (o: any) => { o.events[0].source.contourPositions.pop() }],
    ['invalid presented order', (o: any) => { o.events[0].source.presentedOrders[0] = 0 }],
    ['contour outside range', (o: any) => { o.events[0].source.contourPositions[0] = 1.1 }],
    ['missing order provenance', (o: any) => { o.events.at(-1).source.presentedOrders = [11, 11] }],
    ['reverse provenance', (o: any) => { o.events[1].source.presentedOrders = [4, 3] }],
    ['rest with fake MIDI', (o: any) => { o.events[2].midiNote = -1 }],
  ])('rejects %s without correcting it', (_, change) => {
    const output = mutate(change)
    const before = structuredClone(output)
    expect(() => validateMelodyOutput(output)).toThrow()
    expect(output).toEqual(before)
  })

  it('rejects rests when the snapshot forbids them', () => {
    const output = mutate((o) => { o.grammar.restsAllowed = false })
    expect(() => validateMelodyOutput(output)).toThrow(/shared A\/B\/C grammar/)
  })
})

describe('contract purity boundary', () => {
  it('does not expose time, randomness, browser, or audio behavior', async () => {
    const now = Date.now
    const random = Math.random
    Date.now = () => { throw new Error('clock used') }
    Math.random = () => { throw new Error('random used') }
    try {
      expect(validateMelodyOutput(validOutput())).toBeTruthy()
      expect(createMusicGrammarSnapshot()).toBeTruthy()
    } finally {
      Date.now = now
      Math.random = random
    }
    const source = [
      await import('./grammar'),
      await import('./time'),
      await import('./validateGrammar'),
      await import('./validateMelody'),
    ].map((module) => Object.keys(module).join(',')).join(',')
    expect(source).not.toMatch(/audio|window|document/i)
  })
})
