import {
  AUDIO_PLAYBACK_PROFILE_VERSION,
  AUDIO_SCHEDULE_CONTRACT_VERSION,
  MELODY_GENERATOR_VERSION,
  MELODY_OUTPUT_CONTRACT_VERSION,
} from '../versions'
import type { MelodyOutput } from '../music/types'
import { validateMelodyOutput } from '../music/validateMelody'
import { midiNoteToFrequencyHz } from './frequency'
import { createAudioPlaybackProfileSnapshot } from './profile'
import type { AudioSchedule, ScheduledAudioNote } from './types'
import { validateAudioSchedule } from './validateSchedule'

/**
 * Converts a validated melody's beat timeline into a deterministic, JSON-safe
 * audio schedule. Rests remain in the timeline but never become audio notes.
 */
export function createAudioSchedule(melody: MelodyOutput): AudioSchedule {
  const output = validateMelodyOutput(melody)
  const profile = createAudioPlaybackProfileSnapshot()
  const secondsPerBeat = 60 / output.grammar.tempoBpm
  const notes: ScheduledAudioNote[] = []

  output.events.forEach((event) => {
    if (event.kind !== 'note') return
    const startSeconds = event.startBeat * secondsPerBeat
    const durationSeconds = event.durationBeats * secondsPerBeat
    notes.push({
      noteIndex: notes.length,
      sourceEventIndex: event.eventIndex,
      startSeconds,
      durationSeconds,
      endSeconds: startSeconds + durationSeconds,
      midiNote: event.midiNote,
      frequencyHz: midiNoteToFrequencyHz(event.midiNote),
    })
  })

  return validateAudioSchedule({
    versions: {
      scheduleContract: AUDIO_SCHEDULE_CONTRACT_VERSION,
      playbackProfile: AUDIO_PLAYBACK_PROFILE_VERSION,
      melodyOutputContract: MELODY_OUTPUT_CONTRACT_VERSION,
      melodyGenerator: MELODY_GENERATOR_VERSION,
    },
    method: output.method,
    profile,
    tempoBpm: output.grammar.tempoBpm,
    totalBeats: output.totalBeats,
    totalDurationSeconds: output.totalBeats * secondsPerBeat,
    notes,
  })
}
