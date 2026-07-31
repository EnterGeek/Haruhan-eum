import type { InterpretationMethod } from '../interpretation/types'
import type {
  AUDIO_PLAYBACK_PROFILE_VERSION,
  AUDIO_SCHEDULE_CONTRACT_VERSION,
  MELODY_GENERATOR_VERSION,
  MELODY_OUTPUT_CONTRACT_VERSION,
} from '../versions'
import type { AudioPlaybackProfileSnapshot } from './profile'

export interface ScheduledAudioNote {
  noteIndex: number
  sourceEventIndex: number
  startSeconds: number
  durationSeconds: number
  endSeconds: number
  midiNote: number
  frequencyHz: number
}

export interface AudioSchedule {
  versions: {
    scheduleContract: typeof AUDIO_SCHEDULE_CONTRACT_VERSION
    playbackProfile: typeof AUDIO_PLAYBACK_PROFILE_VERSION
    melodyOutputContract: typeof MELODY_OUTPUT_CONTRACT_VERSION
    melodyGenerator: typeof MELODY_GENERATOR_VERSION
  }
  method: InterpretationMethod
  profile: AudioPlaybackProfileSnapshot
  tempoBpm: number
  totalBeats: number
  totalDurationSeconds: number
  notes: readonly ScheduledAudioNote[]
}
