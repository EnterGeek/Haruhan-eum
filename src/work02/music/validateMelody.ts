import {
  ABSOLUTE_HUE_INTERPRETER_VERSION,
  FLOW_INTERPRETATION_CONTRACT_VERSION,
  HYBRID_HUE_INTERPRETER_VERSION,
  MELODY_OUTPUT_CONTRACT_VERSION,
  MUSIC_GRAMMAR_VERSION,
  RELATIVE_HUE_INTERPRETER_VERSION,
  WORK02_INPUT_CARD_COUNT,
} from '../versions'
import { DEFAULT_MUSIC_GRAMMAR } from './grammar'
import { beatsToSeconds } from './time'
import type {
  MelodyEventSource,
  MelodyOutput,
  MusicGrammarSnapshot,
} from './types'
import { validateMusicGrammar } from './validateGrammar'

export class MelodyOutputValidationError extends Error {
  constructor(message: string) {
    super(`Invalid MelodyOutput: ${message}`)
    this.name = 'MelodyOutputValidationError'
  }
}

const fail = (message: string): never => {
  throw new MelodyOutputValidationError(message)
}

const object = (value: unknown, path: string): Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : fail(`${path} must be an object.`)

const finite = (value: unknown, path: string): number =>
  typeof value === 'number' && Number.isFinite(value)
    ? value
    : fail(`${path} must be a finite number.`)

const validateSource = (
  value: unknown,
  path: string,
  previousGlobalOrder: number,
): { source: MelodyEventSource; finalOrder: number } => {
  const source = object(value, path)
  const orders = source.presentedOrders
  const directions = source.selectionDirections
  const contours = source.contourPositions
  if (!Array.isArray(orders) || !Array.isArray(directions) || !Array.isArray(contours)) {
    fail(`${path} arrays are required.`)
  }
  const rawOrders = orders as unknown[]
  const rawDirections = directions as unknown[]
  const rawContours = contours as unknown[]
  if (rawOrders.length === 0 || rawOrders.length !== rawDirections.length ||
      rawOrders.length !== rawContours.length) {
    fail(`${path} arrays must have the same non-zero length.`)
  }

  let lastOrder = previousGlobalOrder
  rawOrders.forEach((order, index) => {
    if (typeof order !== 'number' || !Number.isInteger(order)) {
      fail(`${path}.presentedOrders[${index}] must be an integer.`)
    }
    const orderNumber = order as number
    if (orderNumber < 1 || orderNumber > WORK02_INPUT_CARD_COUNT) {
      fail(`${path}.presentedOrders[${index}] must be in [1, 12].`)
    }
    if (orderNumber < lastOrder) fail(`${path} must preserve chronological order.`)
    lastOrder = orderNumber
    if (rawDirections[index] !== 'left' && rawDirections[index] !== 'right') {
      fail(`${path}.selectionDirections[${index}] is invalid.`)
    }
    const contour = rawContours[index]
    if (typeof contour !== 'number' || !Number.isFinite(contour) ||
        contour < 0 || contour > 1) {
      fail(`${path}.contourPositions[${index}] must be in [0, 1].`)
    }
  })

  return {
    source: value as MelodyEventSource,
    finalOrder: lastOrder,
  }
}

const expectedInterpreter = (method: unknown): string => {
  switch (method) {
    case 'absolute-hue': return ABSOLUTE_HUE_INTERPRETER_VERSION
    case 'relative-hue': return RELATIVE_HUE_INTERPRETER_VERSION
    case 'hybrid': return HYBRID_HUE_INTERPRETER_VERSION
    default: return fail('method is unsupported.')
  }
}

const isScaleNote = (midi: number, grammar: MusicGrammarSnapshot): boolean =>
  grammar.scale.semitoneOffsets.includes(
    ((midi - grammar.tonicMidi) % 12 + 12) % 12,
  )

const matchesSharedGrammar = (grammar: MusicGrammarSnapshot): boolean =>
  grammar.version === DEFAULT_MUSIC_GRAMMAR.version &&
  grammar.scale.name === DEFAULT_MUSIC_GRAMMAR.scale.name &&
  grammar.scale.semitoneOffsets.length ===
    DEFAULT_MUSIC_GRAMMAR.scale.semitoneOffsets.length &&
  grammar.scale.semitoneOffsets.every(
    (offset, index) => offset === DEFAULT_MUSIC_GRAMMAR.scale.semitoneOffsets[index],
  ) &&
  grammar.tonicMidi === DEFAULT_MUSIC_GRAMMAR.tonicMidi &&
  grammar.minimumMidi === DEFAULT_MUSIC_GRAMMAR.minimumMidi &&
  grammar.maximumMidi === DEFAULT_MUSIC_GRAMMAR.maximumMidi &&
  grammar.tempoBpm === DEFAULT_MUSIC_GRAMMAR.tempoBpm &&
  grammar.totalBeats === DEFAULT_MUSIC_GRAMMAR.totalBeats &&
  grammar.allowedDurationsBeats.length ===
    DEFAULT_MUSIC_GRAMMAR.allowedDurationsBeats.length &&
  grammar.allowedDurationsBeats.every(
    (duration, index) =>
      duration === DEFAULT_MUSIC_GRAMMAR.allowedDurationsBeats[index],
  ) &&
  grammar.maximumMelodicLeapSemitones ===
    DEFAULT_MUSIC_GRAMMAR.maximumMelodicLeapSemitones &&
  grammar.targetDurationSeconds.minimum ===
    DEFAULT_MUSIC_GRAMMAR.targetDurationSeconds.minimum &&
  grammar.targetDurationSeconds.maximum ===
    DEFAULT_MUSIC_GRAMMAR.targetDurationSeconds.maximum &&
  grammar.restsAllowed === DEFAULT_MUSIC_GRAMMAR.restsAllowed

export function validateMelodyOutput(input: unknown): MelodyOutput {
  const output = object(input, 'output')
  const versions = object(output.versions, 'versions')
  if (versions.outputContract !== MELODY_OUTPUT_CONTRACT_VERSION) {
    fail('output contract version is unsupported.')
  }
  if (versions.grammar !== MUSIC_GRAMMAR_VERSION) {
    fail('grammar version is unsupported.')
  }
  if (versions.interpretationContract !== FLOW_INTERPRETATION_CONTRACT_VERSION) {
    fail('interpretation contract version is unsupported.')
  }
  if (versions.interpreter !== expectedInterpreter(output.method)) {
    fail('method and interpreter version do not match.')
  }

  const grammar = validateMusicGrammar(output.grammar)
  if (versions.grammar !== grammar.version) fail('grammar versions do not match.')
  if (!matchesSharedGrammar(grammar)) {
    fail('grammar snapshot must match the single shared A/B/C grammar.')
  }
  const totalBeats = finite(output.totalBeats, 'totalBeats')
  if (totalBeats !== grammar.totalBeats) {
    fail('totalBeats must match the grammar snapshot.')
  }
  const durationSeconds = beatsToSeconds(totalBeats, grammar.tempoBpm)
  if (
    durationSeconds < grammar.targetDurationSeconds.minimum ||
    durationSeconds > grammar.targetDurationSeconds.maximum
  ) {
    fail('calculated playback duration is outside the target range.')
  }

  if (!Array.isArray(output.events) || output.events.length === 0) {
    fail('events must be a non-empty array.')
  }
  const rawEvents = output.events as unknown[]
  let expectedStart = 0
  let previousNote: number | null = null
  let previousGlobalOrder = 0
  let noteCount = 0
  const tracedOrders = new Set<number>()

  rawEvents.forEach((rawEvent, index) => {
    const path = `events[${index}]`
    const event = object(rawEvent, path)
    if (event.eventIndex !== index) fail(`${path}.eventIndex must equal ${index}.`)
    const start = finite(event.startBeat, `${path}.startBeat`)
    const duration = finite(event.durationBeats, `${path}.durationBeats`)
    if (start < 0 || duration <= 0) fail(`${path} timing must be positive.`)
    if (!grammar.allowedDurationsBeats.includes(duration)) {
      fail(`${path}.durationBeats is not allowed by the grammar.`)
    }
    if (start !== expectedStart) {
      fail(`${path} must begin at ${expectedStart}; gaps and overlaps are invalid.`)
    }
    expectedStart = start + duration

    const validatedSource = validateSource(
      event.source,
      `${path}.source`,
      previousGlobalOrder,
    )
    previousGlobalOrder = validatedSource.finalOrder
    validatedSource.source.presentedOrders.forEach((order) => tracedOrders.add(order))

    if (event.kind === 'rest') {
      if (!grammar.restsAllowed) fail(`${path} uses a rest forbidden by the grammar.`)
      if ('midiNote' in event) fail(`${path} rest must not contain midiNote.`)
      return
    }
    if (event.kind !== 'note') fail(`${path}.kind is unsupported.`)
    const rawMidi = event.midiNote
    if (typeof rawMidi !== 'number' || !Number.isInteger(rawMidi)) {
      fail(`${path}.midiNote must be an integer.`)
    }
    const midi = rawMidi as number
    if (midi < grammar.minimumMidi || midi > grammar.maximumMidi) {
      fail(`${path}.midiNote is outside the allowed range.`)
    }
    if (!isScaleNote(midi, grammar)) fail(`${path}.midiNote is outside the scale.`)
    if (
      previousNote !== null &&
      Math.abs(midi - previousNote) > grammar.maximumMelodicLeapSemitones
    ) {
      fail(`${path}.midiNote exceeds the maximum melodic leap.`)
    }
    previousNote = midi
    noteCount += 1
  })

  if (expectedStart !== totalBeats) fail('events must end exactly at totalBeats.')
  if (noteCount === 0) fail('events must contain at least one note.')
  for (let order = 1; order <= WORK02_INPUT_CARD_COUNT; order += 1) {
    if (!tracedOrders.has(order)) fail(`provenance does not trace presentedOrder ${order}.`)
  }

  return input as MelodyOutput
}
