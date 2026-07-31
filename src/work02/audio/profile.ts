import { AUDIO_PLAYBACK_PROFILE_VERSION } from '../versions'

export interface AudioPlaybackProfile {
  version: typeof AUDIO_PLAYBACK_PROFILE_VERSION
  waveform: 'sine'
  masterGain: number
  attackSeconds: number
  releaseSeconds: number
}

export type AudioPlaybackProfileSnapshot = Readonly<AudioPlaybackProfile>

export const DEFAULT_AUDIO_PLAYBACK_PROFILE: AudioPlaybackProfileSnapshot = Object.freeze({
  version: AUDIO_PLAYBACK_PROFILE_VERSION,
  waveform: 'sine',
  masterGain: 0.18,
  attackSeconds: 0.015,
  releaseSeconds: 0.08,
})

/**
 * Returns a JSON-safe, immutable copy so schedules never share mutable profile
 * state with their caller or the default profile.
 */
export function createAudioPlaybackProfileSnapshot(
  profile: Readonly<AudioPlaybackProfile> = DEFAULT_AUDIO_PLAYBACK_PROFILE,
): AudioPlaybackProfileSnapshot {
  return Object.freeze({
    version: profile.version,
    waveform: profile.waveform,
    masterGain: profile.masterGain,
    attackSeconds: profile.attackSeconds,
    releaseSeconds: profile.releaseSeconds,
  })
}
