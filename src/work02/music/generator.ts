import type { Direction } from '../../domain/types'
import type { FlowInterpretation } from '../interpretation/types'
import {
  ABSOLUTE_HUE_INTERPRETER_VERSION,
  MELODY_GENERATOR_VERSION,
  FLOW_INTERPRETATION_CONTRACT_VERSION,
  HYBRID_HUE_INTERPRETER_VERSION,
  MELODY_OUTPUT_CONTRACT_VERSION,
  MUSIC_GRAMMAR_VERSION,
  RELATIVE_HUE_INTERPRETER_VERSION,
  WORK02_INPUT_CARD_COUNT,
  WORK02_INPUT_VERSION,
} from '../versions'
import { createMusicGrammarSnapshot, DEFAULT_MUSIC_GRAMMAR } from './grammar'
import type { MelodyEvent, MelodyEventSource, MelodyOutput, MusicGrammar } from './types'
import { validateMelodyOutput } from './validateMelody'

export class FlowInterpretationForMelodyValidationError extends Error {
  constructor(message: string) {
    super(`Invalid FlowInterpretation for melody: ${message}`)
    this.name = 'FlowInterpretationForMelodyValidationError'
  }
}

const fail = (message: string): never => {
  throw new FlowInterpretationForMelodyValidationError(message)
}

const expectedInterpreter = (
  method: FlowInterpretation['method'],
): FlowInterpretation['versions']['interpreter'] => {
  switch (method) {
    case 'absolute-hue': return ABSOLUTE_HUE_INTERPRETER_VERSION
    case 'relative-hue': return RELATIVE_HUE_INTERPRETER_VERSION
    case 'hybrid': return HYBRID_HUE_INTERPRETER_VERSION
  }
}

const isScaleNote = (midiNote: number, grammar: MusicGrammar): boolean =>
  grammar.scale.semitoneOffsets.includes(
    ((midiNote - grammar.tonicMidi) % 12 + 12) % 12,
  )

export function buildScaleNotes(
  grammar: MusicGrammar = DEFAULT_MUSIC_GRAMMAR,
): readonly number[] {
  const notes: number[] = []
  for (let midiNote = grammar.minimumMidi; midiNote <= grammar.maximumMidi; midiNote += 1) {
    if (isScaleNote(midiNote, grammar)) notes.push(midiNote)
  }
  if (notes.length === 0) {
    throw new RangeError('Music grammar must contain at least one in-range scale note.')
  }
  return notes
}

export function quantizeContourIndex(
  normalizedPosition: number,
  scaleNoteCount: number,
): number {
  if (!Number.isFinite(normalizedPosition) ||
      normalizedPosition < 0 || normalizedPosition > 1) {
    throw new RangeError('normalizedPosition must be a finite number in [0, 1].')
  }
  if (!Number.isInteger(scaleNoteCount) || scaleNoteCount <= 0) {
    throw new RangeError('scaleNoteCount must be a positive integer.')
  }
  return Math.floor(normalizedPosition * (scaleNoteCount - 1) + 0.5)
}

export function selectLeapLimitedNote(
  scaleNotes: readonly number[],
  targetNote: number,
  previousNote: number | null,
  maximumLeapSemitones: number,
): number {
  if (scaleNotes.length === 0) throw new RangeError('scaleNotes must not be empty.')
  if (!Number.isFinite(targetNote)) throw new RangeError('targetNote must be finite.')
  if (!Number.isFinite(maximumLeapSemitones) || maximumLeapSemitones < 0) {
    throw new RangeError('maximumLeapSemitones must be finite and non-negative.')
  }
  if (previousNote === null) {
    if (!scaleNotes.includes(targetNote)) {
      throw new RangeError('The first targetNote must be in scaleNotes.')
    }
    return targetNote
  }
  if (!Number.isFinite(previousNote)) throw new RangeError('previousNote must be finite.')

  const eligible = scaleNotes.filter(
    (note) => Math.abs(note - previousNote) <= maximumLeapSemitones,
  )
  if (eligible.length === 0) {
    throw new RangeError('No scale note satisfies the maximum melodic leap.')
  }
  return eligible.reduce((best, candidate) => {
    const candidateTargetDistance = Math.abs(candidate - targetNote)
    const bestTargetDistance = Math.abs(best - targetNote)
    if (candidateTargetDistance !== bestTargetDistance) {
      return candidateTargetDistance < bestTargetDistance ? candidate : best
    }

    const candidatePreviousDistance = Math.abs(candidate - previousNote)
    const bestPreviousDistance = Math.abs(best - previousNote)
    if (candidatePreviousDistance !== bestPreviousDistance) {
      return candidatePreviousDistance < bestPreviousDistance ? candidate : best
    }

    return candidate < best ? candidate : best
  })
}

export function validateFlowInterpretationForMelody(
  input: FlowInterpretation,
): FlowInterpretation {
  if (input.versions.input !== WORK02_INPUT_VERSION ||
      input.versions.contract !== FLOW_INTERPRETATION_CONTRACT_VERSION) {
    fail('input or interpretation contract version is unsupported.')
  }
  if (input.versions.interpreter !== expectedInterpreter(input.method)) {
    fail('method and interpreter version do not match.')
  }
  if (input.inputItemCount !== WORK02_INPUT_CARD_COUNT ||
      input.items.length !== WORK02_INPUT_CARD_COUNT ||
      input.registerContourCandidates.length !== WORK02_INPUT_CARD_COUNT) {
    fail('exactly 12 items and 12 contour candidates are required.')
  }

  input.items.forEach((item, index) => {
    const order = index + 1
    if (item.sequencePosition !== index || item.presentedOrder !== order) {
      fail('items must preserve sequencePosition and presentedOrder.')
    }
    if (item.selectionDirection !== 'left' && item.selectionDirection !== 'right') {
      fail(`item ${order} has an unsupported selectionDirection.`)
    }
  })
  input.registerContourCandidates.forEach((candidate, index) => {
    const order = index + 1
    const expectedSource = `${input.method}@${input.versions.interpreter}`
    if (candidate.presentedOrder !== order) {
      fail('contour candidates must preserve presentedOrder.')
    }
    if (candidate.source !== expectedSource) {
      fail(`contour candidate ${order} source must equal ${expectedSource}.`)
    }
    if (!Number.isFinite(candidate.normalizedPosition) ||
        candidate.normalizedPosition < 0 || candidate.normalizedPosition > 1) {
      fail(`contour candidate ${order} must be finite and in [0, 1].`)
    }
  })
  return input
}

const sourceFor = (
  presentedOrder: number,
  direction: Direction,
  contourPosition: number,
): MelodyEventSource => ({
  presentedOrders: [presentedOrder],
  selectionDirections: [direction],
  contourPositions: [contourPosition],
})

export function generateMelody(input: FlowInterpretation): MelodyOutput {
  const interpretation = validateFlowInterpretationForMelody(input)
  const grammar = createMusicGrammarSnapshot()
  const scaleNotes = buildScaleNotes(grammar)
  const events: MelodyEvent[] = []
  let previousNote: number | null = null

  interpretation.registerContourCandidates.forEach((candidate, index) => {
    const item = interpretation.items[index]
    const targetIndex = quantizeContourIndex(
      candidate.normalizedPosition,
      scaleNotes.length,
    )
    const midiNote = selectLeapLimitedNote(
      scaleNotes,
      scaleNotes[targetIndex],
      previousNote,
      grammar.maximumMelodicLeapSemitones,
    )
    const source = sourceFor(
      candidate.presentedOrder,
      item.selectionDirection,
      candidate.normalizedPosition,
    )
    const startBeat = index
    const noteDuration = item.selectionDirection === 'right' ? 1 : 0.5
    events.push({
      kind: 'note',
      eventIndex: events.length,
      startBeat,
      durationBeats: noteDuration,
      midiNote,
      source,
    })
    if (item.selectionDirection === 'left') {
      events.push({
        kind: 'rest',
        eventIndex: events.length,
        startBeat: startBeat + 0.5,
        durationBeats: 0.5,
        source: sourceFor(
          candidate.presentedOrder,
          item.selectionDirection,
          candidate.normalizedPosition,
        ),
      })
    }
    previousNote = midiNote
  })

  return validateMelodyOutput({
    versions: {
      outputContract: MELODY_OUTPUT_CONTRACT_VERSION,
      grammar: MUSIC_GRAMMAR_VERSION,
      interpretationContract: FLOW_INTERPRETATION_CONTRACT_VERSION,
      interpreter: interpretation.versions.interpreter,
      generator: MELODY_GENERATOR_VERSION,
    },
    method: interpretation.method,
    grammar,
    totalBeats: grammar.totalBeats,
    events,
  })
}
