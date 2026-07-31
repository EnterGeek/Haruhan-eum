import type { AudioSchedule } from './types'
import { validateAudioSchedule } from './validateSchedule'

export interface AudioParamAdapter {
  setValueAtTime(value: number, startTime: number): unknown
  linearRampToValueAtTime(value: number, endTime: number): unknown
}

export interface AudioNodeAdapter {
  connect(destination: AudioNodeAdapter): unknown
  disconnect(): void
}

export interface GainNodeAdapter extends AudioNodeAdapter {
  gain: AudioParamAdapter
}

export interface OscillatorNodeAdapter extends AudioNodeAdapter {
  frequency: AudioParamAdapter
  type: string
  start(when: number): void
  stop(when?: number): void
}

export interface AudioContextAdapter {
  state: string
  currentTime: number
  destination: AudioNodeAdapter
  createGain(): GainNodeAdapter
  createOscillator(): OscillatorNodeAdapter
  resume(): Promise<void>
  close(): Promise<void>
}

export type AudioContextFactory = () => AudioContextAdapter

export interface Work02AudioPlayer {
  play(schedule: AudioSchedule): Promise<void>
  stop(): void
  dispose(): Promise<void>
  isPlaying(): boolean
}

export interface Work02AudioPlayerOptions {
  audioContextFactory?: AudioContextFactory
}

export class Work02AudioPlaybackUnsupportedError extends Error {
  constructor() {
    super('Web Audio is unavailable in this environment.')
    this.name = 'Work02AudioPlaybackUnsupportedError'
  }
}

export class Work02AudioPlayerDisposedError extends Error {
  constructor() {
    super('This Work 02 audio player has been disposed and cannot be reused.')
    this.name = 'Work02AudioPlayerDisposedError'
  }
}

interface ActiveAudioNodePair {
  oscillator: OscillatorNodeAdapter
  gain: GainNodeAdapter
}

const stopSilently = (oscillator: OscillatorNodeAdapter): void => {
  try {
    oscillator.stop()
  } catch {
    // A stopped or naturally ended oscillator may reject a second stop.
  }
}

const disconnectSilently = (node: AudioNodeAdapter): void => {
  try {
    node.disconnect()
  } catch {
    // Disconnection is best-effort during lifecycle cleanup.
  }
}

const browserAudioContextFactory = (): AudioContextAdapter => {
  const AudioContextConstructor = globalThis.AudioContext
  if (typeof AudioContextConstructor !== 'function') {
    throw new Work02AudioPlaybackUnsupportedError()
  }
  return new AudioContextConstructor() as unknown as AudioContextAdapter
}

/**
 * Creates the only Work 02 module that touches Web Audio. The context is lazy:
 * importing this module and constructing a player never access browser audio.
 */
export function createWork02AudioPlayer(
  options: Work02AudioPlayerOptions = {},
): Work02AudioPlayer {
  const audioContextFactory = options.audioContextFactory ?? browserAudioContextFactory
  let audioContext: AudioContextAdapter | null = null
  let masterGain: GainNodeAdapter | null = null
  let activeNodes: ActiveAudioNodePair[] = []
  let playing = false
  let disposed = false

  const stop = (): void => {
    activeNodes.forEach(({ oscillator, gain }) => {
      stopSilently(oscillator)
      disconnectSilently(oscillator)
      disconnectSilently(gain)
    })
    activeNodes = []
    if (masterGain !== null) disconnectSilently(masterGain)
    masterGain = null
    playing = false
  }

  return {
    async play(schedule: AudioSchedule): Promise<void> {
      if (disposed) throw new Work02AudioPlayerDisposedError()
      const validated = validateAudioSchedule(schedule)
      stop()

      const context = audioContext ?? audioContextFactory()
      audioContext = context
      if (context.state === 'suspended') await context.resume()
      const playbackStartTime = context.currentTime

      const nextMasterGain = context.createGain()
      nextMasterGain.gain.setValueAtTime(validated.profile.masterGain, playbackStartTime)
      nextMasterGain.connect(context.destination)
      masterGain = nextMasterGain

      try {
        validated.notes.forEach((note) => {
          const startTime = playbackStartTime + note.startSeconds
          const endTime = playbackStartTime + note.endSeconds
          const durationSeconds = note.durationSeconds
          const effectiveAttack = Math.min(
            validated.profile.attackSeconds,
            durationSeconds / 2,
          )
          const effectiveRelease = Math.min(
            validated.profile.releaseSeconds,
            durationSeconds / 2,
          )
          const attackEnd = startTime + effectiveAttack
          const releaseStart = Math.max(attackEnd, endTime - effectiveRelease)

          const oscillator = context.createOscillator()
          const gain = context.createGain()
          oscillator.type = validated.profile.waveform
          oscillator.frequency.setValueAtTime(note.frequencyHz, startTime)
          gain.gain.setValueAtTime(0, startTime)
          gain.gain.linearRampToValueAtTime(validated.profile.masterGain, attackEnd)
          gain.gain.setValueAtTime(validated.profile.masterGain, releaseStart)
          gain.gain.linearRampToValueAtTime(0, endTime)
          oscillator.connect(gain)
          gain.connect(nextMasterGain)
          oscillator.start(startTime)
          oscillator.stop(endTime)
          activeNodes.push({ oscillator, gain })
        })
        playing = true
      } catch (error) {
        stop()
        throw error
      }
    },

    stop,

    async dispose(): Promise<void> {
      if (disposed) return
      disposed = true
      stop()
      if (audioContext !== null) {
        const context = audioContext
        audioContext = null
        await context.close()
      }
    },

    isPlaying(): boolean {
      return playing
    },
  }
}
