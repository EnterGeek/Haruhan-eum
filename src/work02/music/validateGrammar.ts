import { MUSIC_GRAMMAR_VERSION } from '../versions'
import { beatsToSeconds } from './time'
import type { MusicGrammarSnapshot } from './types'

export class MusicGrammarValidationError extends Error {
  constructor(message: string) {
    super(`Invalid MusicGrammar: ${message}`)
    this.name = 'MusicGrammarValidationError'
  }
}

const fail = (message: string): never => {
  throw new MusicGrammarValidationError(message)
}

const object = (value: unknown, path: string): Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : fail(`${path} must be an object.`)

const finite = (value: unknown, path: string): number =>
  typeof value === 'number' && Number.isFinite(value)
    ? value
    : fail(`${path} must be a finite number.`)

const integer = (value: unknown, path: string): number => {
  const result = finite(value, path)
  return Number.isInteger(result) ? result : fail(`${path} must be an integer.`)
}

export function validateMusicGrammar(input: unknown): MusicGrammarSnapshot {
  const grammar = object(input, 'grammar')
  if (grammar.version !== MUSIC_GRAMMAR_VERSION) fail('version is unsupported.')

  const scale = object(grammar.scale, 'scale')
  if (typeof scale.name !== 'string' || scale.name.length === 0) {
    fail('scale.name must be a non-empty string.')
  }
  if (!Array.isArray(scale.semitoneOffsets) || scale.semitoneOffsets.length === 0) {
    fail('scale.semitoneOffsets must be a non-empty array.')
  }
  const rawOffsets = scale.semitoneOffsets as unknown[]
  const offsets = rawOffsets.map((value, index) =>
    integer(value, `scale.semitoneOffsets[${index}]`))
  if (offsets.some((value) => value < 0 || value > 11)) {
    fail('scale.semitoneOffsets values must be in [0, 11].')
  }
  if (offsets[0] !== 0) fail('scale.semitoneOffsets must begin with 0.')
  if (new Set(offsets).size !== offsets.length) {
    fail('scale.semitoneOffsets must not contain duplicates.')
  }
  if (offsets.some((value, index) => index > 0 && value <= offsets[index - 1])) {
    fail('scale.semitoneOffsets must be strictly ascending.')
  }

  const tonic = integer(grammar.tonicMidi, 'tonicMidi')
  const minimum = integer(grammar.minimumMidi, 'minimumMidi')
  const maximum = integer(grammar.maximumMidi, 'maximumMidi')
  if ([tonic, minimum, maximum].some((value) => value < 0 || value > 127)) {
    fail('tonicMidi and MIDI range must be in [0, 127].')
  }
  if (minimum > maximum) fail('minimumMidi must not exceed maximumMidi.')

  const hasScaleNote = Array.from(
    { length: maximum - minimum + 1 },
    (_, index) => minimum + index,
  ).some((midi) => offsets.includes(((midi - tonic) % 12 + 12) % 12))
  if (!hasScaleNote) fail('MIDI range must contain at least one scale note.')

  const tempo = finite(grammar.tempoBpm, 'tempoBpm')
  if (tempo <= 0) fail('tempoBpm must be positive.')
  const totalBeats = finite(grammar.totalBeats, 'totalBeats')
  if (totalBeats <= 0) fail('totalBeats must be positive.')

  if (
    !Array.isArray(grammar.allowedDurationsBeats) ||
    grammar.allowedDurationsBeats.length === 0
  ) {
    fail('allowedDurationsBeats must be a non-empty array.')
  }
  const rawDurations = grammar.allowedDurationsBeats as unknown[]
  const durations = rawDurations.map((value, index) =>
    finite(value, `allowedDurationsBeats[${index}]`))
  if (durations.some((duration) => duration <= 0)) {
    fail('allowedDurationsBeats values must be positive.')
  }
  if (new Set(durations).size !== durations.length) {
    fail('allowedDurationsBeats must not contain duplicates.')
  }

  const leap = integer(
    grammar.maximumMelodicLeapSemitones,
    'maximumMelodicLeapSemitones',
  )
  if (leap < 0) fail('maximumMelodicLeapSemitones must be non-negative.')

  const target = object(grammar.targetDurationSeconds, 'targetDurationSeconds')
  const targetMinimum = finite(target.minimum, 'targetDurationSeconds.minimum')
  const targetMaximum = finite(target.maximum, 'targetDurationSeconds.maximum')
  if (targetMinimum <= 0 || targetMaximum < targetMinimum) {
    fail('targetDurationSeconds must define a positive ordered range.')
  }
  if (typeof grammar.restsAllowed !== 'boolean') {
    fail('restsAllowed must be a boolean.')
  }

  const durationSeconds = beatsToSeconds(totalBeats, tempo)
  if (durationSeconds < targetMinimum || durationSeconds > targetMaximum) {
    fail('tempoBpm and totalBeats produce a duration outside the target range.')
  }

  return input as MusicGrammarSnapshot
}
