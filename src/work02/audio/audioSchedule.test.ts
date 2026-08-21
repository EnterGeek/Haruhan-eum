import { describe, expect, it } from 'vitest'
import goldenSessions from '../../../docs/golden-sessions/representative-sessions.json'
import { expandGoldenCase } from '../golden/expandGoldenCase'
import { interpretFlow } from '../interpretation/interpretFlow'
import type { InterpretationMethod } from '../interpretation/types'
import { generateMelody } from '../music/generator'
import type { MelodyOutput } from '../music/types'
import {
  AUDIO_PLAYBACK_PROFILE_VERSION,
  AUDIO_SCHEDULE_CONTRACT_VERSION,
  MELODY_GENERATOR_VERSION,
  MELODY_OUTPUT_CONTRACT_VERSION,
} from '../versions'
import { midiNoteToFrequencyHz } from './frequency'
import {
  createAudioPlaybackProfileSnapshot,
  DEFAULT_AUDIO_PLAYBACK_PROFILE,
} from './profile'
import { createAudioSchedule } from './schedule'
import type { AudioPlaybackProfile } from './profile'
import type { AudioSchedule } from './types'
import { AudioScheduleValidationError, validateAudioSchedule } from './validateSchedule'

const methods: readonly InterpretationMethod[] = [
  'absolute-hue',
  'relative-hue',
  'hybrid',
]

const melodyFor = (
  caseId: string,
  method: InterpretationMethod = 'absolute-hue',
): MelodyOutput => generateMelody(interpretFlow(expandGoldenCase(goldenSessions, caseId), method))

const scheduleFor = (
  caseId: string,
  method: InterpretationMethod = 'absolute-hue',
): AudioSchedule => createAudioSchedule(melodyFor(caseId, method))

const mutableSchedule = (): Record<string, any> =>
  structuredClone(scheduleFor('same-deck-baseline')) as Record<string, any>

describe('MIDI frequency conversion', () => {
  it.each([
    [69, 440],
    [60, 261.6255653005986],
    [72, 523.2511306011972],
  ])('converts MIDI %i to the expected frequency', (midiNote, expected) => {
    expect(midiNoteToFrequencyHz(midiNote)).toBeCloseTo(expected, 10)
  })

  it.each([Number.NaN, Infinity, -Infinity, 60.5, -1, 128])(
    'rejects unsupported MIDI input %s without rounding or clamping',
    (midiNote) => {
      expect(() => midiNoteToFrequencyHz(midiNote)).toThrow()
    },
  )
})

describe('shared playback profile', () => {
  it('creates an immutable JSON-safe snapshot without sharing the input', () => {
    const source: AudioPlaybackProfile = {
      version: AUDIO_PLAYBACK_PROFILE_VERSION,
      waveform: 'sine',
      masterGain: 0.18,
      attackSeconds: 0.015,
      releaseSeconds: 0.08,
    }
    const snapshot = createAudioPlaybackProfileSnapshot(source)
    expect(snapshot).toEqual(DEFAULT_AUDIO_PLAYBACK_PROFILE)
    expect(snapshot).not.toBe(source)
    source.masterGain = 0.5
    expect(snapshot.masterGain).toBe(0.18)
    expect(Object.isFrozen(snapshot)).toBe(true)
    expect(Object.isFrozen(DEFAULT_AUDIO_PLAYBACK_PROFILE)).toBe(true)
    expect(JSON.parse(JSON.stringify(snapshot))).toEqual(snapshot)
  })
})

describe('MelodyOutput to AudioSchedule', () => {
  it('preserves a validated melody without mutation and emits exact versions', () => {
    const melody = melodyFor('same-deck-baseline', 'hybrid')
    const before = structuredClone(melody)
    const schedule = createAudioSchedule(melody)
    expect(schedule.versions).toEqual({
      scheduleContract: AUDIO_SCHEDULE_CONTRACT_VERSION,
      playbackProfile: AUDIO_PLAYBACK_PROFILE_VERSION,
      melodyOutputContract: MELODY_OUTPUT_CONTRACT_VERSION,
      melodyGenerator: MELODY_GENERATOR_VERSION,
    })
    expect(schedule.method).toBe('hybrid')
    expect(validateAudioSchedule(schedule)).toBe(schedule)
    expect(melody).toEqual(before)
  })

  it('derives timing from grammar BPM and beats rather than a stored nine-second constant', () => {
    const schedule = scheduleFor('all-right-same-deck-replay')
    expect(schedule.tempoBpm).toBe(80)
    expect(schedule.totalBeats).toBe(12)
    expect(60 / schedule.tempoBpm).toBe(0.75)
    expect(schedule.totalDurationSeconds).toBe(9)
    expect(schedule.notes[0]).toMatchObject({
      noteIndex: 0,
      sourceEventIndex: 0,
      startSeconds: 0,
      durationSeconds: 0.75,
      endSeconds: 0.75,
    })
    expect(schedule.notes.at(-1)?.endSeconds).toBe(9)
  })

  it('omits rest oscillators while preserving the original timing after every rest', () => {
    const melody = melodyFor('all-left-fast-buttons')
    const schedule = createAudioSchedule(melody)
    expect(melody.events).toHaveLength(24)
    expect(schedule.notes).toHaveLength(12)
    expect(schedule.notes.map((note) => note.noteIndex)).toEqual(
      Array.from({ length: 12 }, (_, index) => index),
    )
    expect(schedule.notes.map((note) => note.sourceEventIndex)).toEqual(
      Array.from({ length: 12 }, (_, index) => index * 2),
    )
    expect(schedule.notes.every((note) => note.durationSeconds === 0.375)).toBe(true)
    expect(schedule.notes.map((note) => note.startSeconds)).toEqual(
      Array.from({ length: 12 }, (_, index) => index * 0.75),
    )
  })

  it('makes same melody inputs byte-equivalent schedules', () => {
    const melody = melodyFor('mixed-button-and-swipe', 'relative-hue')
    const first = createAudioSchedule(melody)
    const second = createAudioSchedule(structuredClone(melody))
    expect(second).toEqual(first)
    expect(JSON.stringify(second)).toBe(JSON.stringify(first))
  })

  it('keeps the A/B/C timing and common profile identical for the same input', () => {
    const caseId = 'undo-and-reselect'
    const schedules = methods.map((method) => scheduleFor(caseId, method))
    schedules.forEach((schedule) => {
      expect(schedule.profile).toEqual(DEFAULT_AUDIO_PLAYBACK_PROFILE)
      expect(schedule.tempoBpm).toBe(80)
      expect(schedule.totalBeats).toBe(12)
      expect(schedule.totalDurationSeconds).toBe(9)
    })
    const timing = schedules.map((schedule) => schedule.notes.map((note) => ({
      startSeconds: note.startSeconds,
      durationSeconds: note.durationSeconds,
      endSeconds: note.endSeconds,
      sourceEventIndex: note.sourceEventIndex,
    })))
    expect(timing[1]).toEqual(timing[0])
    expect(timing[2]).toEqual(timing[0])
  })
})

describe('AudioSchedule validation boundary', () => {
  it.each([
    ['schedule version', (schedule: any) => { schedule.versions.scheduleContract = 'wrong' }],
    ['playback version', (schedule: any) => { schedule.versions.playbackProfile = 'wrong' }],
    ['melody output version', (schedule: any) => { schedule.versions.melodyOutputContract = 'wrong' }],
    ['generator version', (schedule: any) => { schedule.versions.melodyGenerator = 'wrong' }],
    ['method', (schedule: any) => { schedule.method = 'wrong' }],
    ['profile waveform', (schedule: any) => { schedule.profile.waveform = 'square' }],
    ['profile gain', (schedule: any) => { schedule.profile.masterGain = 1.1 }],
    ['profile mutation', (schedule: any) => { schedule.profile.releaseSeconds = 0.1 }],
    ['tempo', (schedule: any) => { schedule.tempoBpm = 0 }],
    ['total beats', (schedule: any) => { schedule.totalBeats = Number.NaN }],
    ['total duration', (schedule: any) => { schedule.totalDurationSeconds = 8.9 }],
    ['empty notes', (schedule: any) => { schedule.notes = [] }],
    ['note index', (schedule: any) => { schedule.notes[1].noteIndex = 4 }],
    ['source event index', (schedule: any) => { schedule.notes[0].sourceEventIndex = -1 }],
    ['negative start', (schedule: any) => { schedule.notes[0].startSeconds = -1 }],
    ['non-positive duration', (schedule: any) => { schedule.notes[0].durationSeconds = 0 }],
    ['end arithmetic', (schedule: any) => { schedule.notes[0].endSeconds += 0.01 }],
    ['sorting', (schedule: any) => { schedule.notes[1].startSeconds = -0.01 }],
    ['timeline overrun', (schedule: any) => { schedule.notes.at(-1).endSeconds = 10 }],
    ['non-integer MIDI', (schedule: any) => { schedule.notes[0].midiNote = 60.5 }],
    ['out-of-range MIDI', (schedule: any) => { schedule.notes[0].midiNote = 128 }],
    ['frequency mismatch', (schedule: any) => { schedule.notes[0].frequencyHz += 1 }],
  ])('rejects invalid %s without repair or mutation', (_, mutate) => {
    const schedule = mutableSchedule()
    mutate(schedule)
    const before = structuredClone(schedule)
    expect(() => validateAudioSchedule(schedule)).toThrow(AudioScheduleValidationError)
    expect(schedule).toEqual(before)
  })
})

describe('actual Work 01 golden fixture audio regressions', () => {
  const cases = goldenSessions.cases.map((goldenCase) => goldenCase.id)

  it.each(cases.flatMap((caseId) =>
    methods.map((method) => [caseId, method] as const),
  ))('creates and validates a deterministic schedule for %s / %s', (caseId, method) => {
    const first = scheduleFor(caseId, method)
    const second = scheduleFor(caseId, method)
    expect(validateAudioSchedule(first)).toBe(first)
    expect(first.totalDurationSeconds).toBe(9)
    expect(JSON.stringify(second)).toBe(JSON.stringify(first))
    expect(first.profile).toEqual(DEFAULT_AUDIO_PLAYBACK_PROFILE)
  })

  it('keeps all-left and all-right articulation at 12 scheduled notes each', () => {
    const allLeft = scheduleFor('all-left-fast-buttons')
    const allRight = scheduleFor('all-right-same-deck-replay')
    expect(allLeft.notes).toHaveLength(12)
    expect(allRight.notes).toHaveLength(12)
    expect(allLeft.notes.every((note) => note.durationSeconds === 0.375)).toBe(true)
    expect(allRight.notes.every((note) => note.durationSeconds === 0.75)).toBe(true)
  })
})
