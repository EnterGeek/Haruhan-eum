import type { InterpretationMethod } from '../interpretation/types'
import {
  AUDIO_PLAYBACK_PROFILE_VERSION,
  AUDIO_SCHEDULE_CONTRACT_VERSION,
  MELODY_GENERATOR_VERSION,
  MELODY_OUTPUT_CONTRACT_VERSION,
} from '../versions'
import { midiNoteToFrequencyHz } from './frequency'
import { DEFAULT_AUDIO_PLAYBACK_PROFILE } from './profile'
import type { AudioPlaybackProfileSnapshot } from './profile'
import type { AudioSchedule, ScheduledAudioNote } from './types'

export class AudioScheduleValidationError extends Error {
  constructor(message: string) {
    super(`Invalid AudioSchedule: ${message}`)
    this.name = 'AudioScheduleValidationError'
  }
}

const fail = (message: string): never => {
  throw new AudioScheduleValidationError(message)
}

const object = (value: unknown, path: string): Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : fail(`${path} must be an object.`)

const finite = (value: unknown, path: string): number =>
  typeof value === 'number' && Number.isFinite(value)
    ? value
    : fail(`${path} must be a finite number.`)

const positive = (value: unknown, path: string): number => {
  const result = finite(value, path)
  return result > 0 ? result : fail(`${path} must be positive.`)
}

const expectedMethod = (method: unknown): InterpretationMethod => {
  if (method === 'absolute-hue' || method === 'relative-hue' || method === 'hybrid') {
    return method
  }
  return fail('method is unsupported.')
}

const validateProfile = (value: unknown): AudioPlaybackProfileSnapshot => {
  const profile = object(value, 'profile')
  if (profile.version !== AUDIO_PLAYBACK_PROFILE_VERSION) {
    fail('playback profile version is unsupported.')
  }
  if (profile.waveform !== 'sine') fail('profile waveform is unsupported.')

  const masterGain = finite(profile.masterGain, 'profile.masterGain')
  if (masterGain < 0 || masterGain > 1) {
    fail('profile.masterGain must be in [0, 1].')
  }
  const attackSeconds = finite(profile.attackSeconds, 'profile.attackSeconds')
  const releaseSeconds = finite(profile.releaseSeconds, 'profile.releaseSeconds')
  if (attackSeconds < 0 || releaseSeconds < 0) {
    fail('profile attackSeconds and releaseSeconds must be non-negative.')
  }

  if (
    masterGain !== DEFAULT_AUDIO_PLAYBACK_PROFILE.masterGain ||
    attackSeconds !== DEFAULT_AUDIO_PLAYBACK_PROFILE.attackSeconds ||
    releaseSeconds !== DEFAULT_AUDIO_PLAYBACK_PROFILE.releaseSeconds
  ) {
    fail('profile must match the single shared A/B/C playback profile.')
  }
  return value as AudioPlaybackProfileSnapshot
}

const validateNote = (
  value: unknown,
  index: number,
  totalDurationSeconds: number,
  previousStartSeconds: number,
): ScheduledAudioNote => {
  const note = object(value, `notes[${index}]`)
  if (note.noteIndex !== index) fail(`notes[${index}].noteIndex must equal ${index}.`)
  if (
    typeof note.sourceEventIndex !== 'number' ||
    !Number.isInteger(note.sourceEventIndex) ||
    note.sourceEventIndex < 0
  ) {
    fail(`notes[${index}].sourceEventIndex must be a non-negative integer.`)
  }
  const startSeconds = finite(note.startSeconds, `notes[${index}].startSeconds`)
  const durationSeconds = positive(note.durationSeconds, `notes[${index}].durationSeconds`)
  const endSeconds = finite(note.endSeconds, `notes[${index}].endSeconds`)
  if (startSeconds < 0) fail(`notes[${index}].startSeconds must be non-negative.`)
  if (endSeconds !== startSeconds + durationSeconds) {
    fail(`notes[${index}].endSeconds must equal startSeconds + durationSeconds.`)
  }
  if (startSeconds < previousStartSeconds) {
    fail(`notes[${index}] must be sorted by startSeconds.`)
  }
  if (endSeconds > totalDurationSeconds) {
    fail(`notes[${index}] exceeds the total timeline.`)
  }

  const rawMidiNote = note.midiNote
  if (typeof rawMidiNote !== 'number' || !Number.isInteger(rawMidiNote)) {
    fail(`notes[${index}].midiNote must be an integer.`)
  }
  const midiNote = rawMidiNote as number
  const expectedFrequency = (() => {
    try {
      return midiNoteToFrequencyHz(midiNote)
    } catch {
      return fail(`notes[${index}].midiNote must be in the standard MIDI range.`)
    }
  })()
  if (note.frequencyHz !== expectedFrequency) {
    fail(`notes[${index}].frequencyHz must match the MIDI frequency formula.`)
  }
  return value as ScheduledAudioNote
}

/**
 * Validates the deterministic, browser-independent schedule boundary. It never
 * sorts, clamps, repairs, or fills input values.
 */
export function validateAudioSchedule(input: unknown): AudioSchedule {
  const schedule = object(input, 'schedule')
  const versions = object(schedule.versions, 'versions')
  if (versions.scheduleContract !== AUDIO_SCHEDULE_CONTRACT_VERSION) {
    fail('schedule contract version is unsupported.')
  }
  if (versions.playbackProfile !== AUDIO_PLAYBACK_PROFILE_VERSION) {
    fail('playback profile version is unsupported.')
  }
  if (versions.melodyOutputContract !== MELODY_OUTPUT_CONTRACT_VERSION) {
    fail('melody output contract version is unsupported.')
  }
  if (versions.melodyGenerator !== MELODY_GENERATOR_VERSION) {
    fail('melody generator version is unsupported.')
  }

  expectedMethod(schedule.method)
  const profile = validateProfile(schedule.profile)
  const tempoBpm = positive(schedule.tempoBpm, 'tempoBpm')
  const totalBeats = positive(schedule.totalBeats, 'totalBeats')
  const totalDurationSeconds = positive(
    schedule.totalDurationSeconds,
    'totalDurationSeconds',
  )
  if (totalDurationSeconds !== totalBeats * (60 / tempoBpm)) {
    fail('totalDurationSeconds must match totalBeats and tempoBpm.')
  }

  if (!Array.isArray(schedule.notes) || schedule.notes.length === 0) {
    fail('notes must be a non-empty array.')
  }
  let previousStartSeconds = 0
  ;(schedule.notes as unknown[]).forEach((note, index) => {
    const validated = validateNote(
      note,
      index,
      totalDurationSeconds,
      previousStartSeconds,
    )
    previousStartSeconds = validated.startSeconds

    const durationHalf = validated.durationSeconds / 2
    const effectiveAttack = Math.min(profile.attackSeconds, durationHalf)
    const effectiveRelease = Math.min(profile.releaseSeconds, durationHalf)
    const attackEnd = validated.startSeconds + effectiveAttack
    const releaseStart = Math.max(attackEnd, validated.endSeconds - effectiveRelease)
    if (attackEnd > releaseStart || releaseStart > validated.endSeconds) {
      fail(`notes[${index}] has an impossible attack/release envelope.`)
    }
  })

  return input as AudioSchedule
}
