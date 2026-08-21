import { describe, expect, it, vi } from 'vitest'
import goldenSessions from '../../../docs/golden-sessions/representative-sessions.json'
import { expandGoldenCase } from '../golden/expandGoldenCase'
import { interpretFlow } from '../interpretation/interpretFlow'
import { generateMelody } from '../music/generator'
import {
  createWork02AudioPlayer,
  type AudioContextAdapter,
  type AudioNodeAdapter,
  type AudioParamAdapter,
  type GainNodeAdapter,
  type OscillatorNodeAdapter,
  Work02AudioPlaybackUnsupportedError,
  Work02AudioPlayerDisposedError,
} from './player'
import { createAudioSchedule } from './schedule'
import type { AudioSchedule } from './types'

type Automation = {
  operation: 'set' | 'linearRamp'
  value: number
  time: number
}

type SchedulingFailure =
  | 'frequency'
  | 'noteGain'
  | 'oscillatorConnect'
  | 'gainConnect'
  | 'start'
  | 'stop'

class FakeAudioParam implements AudioParamAdapter {
  readonly automations: Automation[] = []
  throwOnAutomation = false

  setValueAtTime(value: number, startTime: number): void {
    if (this.throwOnAutomation) throw new Error('synthetic scheduling failure')
    this.automations.push({ operation: 'set', value, time: startTime })
  }

  linearRampToValueAtTime(value: number, endTime: number): void {
    if (this.throwOnAutomation) throw new Error('synthetic scheduling failure')
    this.automations.push({ operation: 'linearRamp', value, time: endTime })
  }
}

class FakeAudioNode implements AudioNodeAdapter {
  readonly destinations: AudioNodeAdapter[] = []
  disconnectCalls = 0
  throwOnConnect = false

  connect(destination: AudioNodeAdapter): void {
    if (this.throwOnConnect) throw new Error('synthetic scheduling failure')
    this.destinations.push(destination)
  }

  disconnect(): void {
    this.disconnectCalls += 1
  }
}

class FakeGainNode extends FakeAudioNode implements GainNodeAdapter {
  readonly gain = new FakeAudioParam()
}

class FakeOscillatorNode extends FakeAudioNode implements OscillatorNodeAdapter {
  readonly frequency = new FakeAudioParam()
  type = ''
  readonly startTimes: number[] = []
  readonly stopTimes: Array<number | undefined> = []
  onended: (() => void) | null = null
  throwOnStart = false
  throwOnScheduledStop = false

  start(when: number): void {
    if (this.throwOnStart) throw new Error('synthetic scheduling failure')
    this.startTimes.push(when)
  }

  stop(when?: number): void {
    this.stopTimes.push(when)
    if (when !== undefined && this.throwOnScheduledStop) {
      throw new Error('synthetic scheduling failure')
    }
  }

  emitEnded(): void {
    this.onended?.()
  }
}

class FakeAudioContext implements AudioContextAdapter {
  state = 'running'
  currentTime = 4
  readonly destination = new FakeAudioNode()
  readonly gains: FakeGainNode[] = []
  readonly oscillators: FakeOscillatorNode[] = []
  resumeCalls = 0
  closeCalls = 0
  schedulingFailure: SchedulingFailure | null = null

  createGain(): FakeGainNode {
    const gain = new FakeGainNode()
    if (this.gains.length > 0) {
      gain.gain.throwOnAutomation = this.schedulingFailure === 'noteGain'
      gain.throwOnConnect = this.schedulingFailure === 'gainConnect'
    }
    this.gains.push(gain)
    return gain
  }

  createOscillator(): FakeOscillatorNode {
    const oscillator = new FakeOscillatorNode()
    oscillator.frequency.throwOnAutomation = this.schedulingFailure === 'frequency'
    oscillator.throwOnConnect = this.schedulingFailure === 'oscillatorConnect'
    oscillator.throwOnStart = this.schedulingFailure === 'start'
    oscillator.throwOnScheduledStop = this.schedulingFailure === 'stop'
    this.oscillators.push(oscillator)
    return oscillator
  }

  async resume(): Promise<void> {
    this.resumeCalls += 1
    this.state = 'running'
  }

  async close(): Promise<void> {
    this.closeCalls += 1
    this.state = 'closed'
  }
}

const scheduleFor = (caseId = 'same-deck-baseline'): AudioSchedule =>
  createAudioSchedule(generateMelody(interpretFlow(
    expandGoldenCase(goldenSessions, caseId),
    'absolute-hue',
  )))

describe('Work02AudioPlayer', () => {
  it('creates the context lazily, resumes it, and schedules each note from the context time', async () => {
    const context = new FakeAudioContext()
    context.state = 'suspended'
    const factory = vi.fn(() => context)
    const player = createWork02AudioPlayer({ audioContextFactory: factory })
    const schedule = scheduleFor()

    expect(factory).not.toHaveBeenCalled()
    expect(player.isPlaying()).toBe(false)
    await player.play(schedule)

    expect(factory).toHaveBeenCalledTimes(1)
    expect(context.resumeCalls).toBe(1)
    expect(player.isPlaying()).toBe(true)
    expect(context.oscillators).toHaveLength(schedule.notes.length)
    expect(context.gains).toHaveLength(schedule.notes.length + 1)
    expect(context.gains[0].gain.automations).toEqual([
      { operation: 'set', value: 0.18, time: 4 },
    ])
    expect(context.oscillators[0].type).toBe('sine')
    expect(context.oscillators[0].frequency.automations).toEqual([
      {
        operation: 'set',
        value: schedule.notes[0].frequencyHz,
        time: 4 + schedule.notes[0].startSeconds,
      },
    ])
    expect(context.oscillators[0].startTimes).toEqual([4])
    expect(context.oscillators[0].stopTimes).toEqual([4.75])
  })

  it('uses the prescribed attack, sustain, release, and note-end stop envelope', async () => {
    const context = new FakeAudioContext()
    const player = createWork02AudioPlayer({ audioContextFactory: () => context })
    await player.play(scheduleFor())

    expect(context.gains[1].gain.automations).toEqual([
      { operation: 'set', value: 0, time: 4 },
      { operation: 'linearRamp', value: 1, time: 4.015 },
      { operation: 'set', value: 1, time: 4.67 },
      { operation: 'linearRamp', value: 0, time: 4.75 },
    ])
  })

  it('supports a validated Lab-only note peak resolver without changing master gain', async () => {
    const context = new FakeAudioContext()
    const player = createWork02AudioPlayer({
      audioContextFactory: () => context,
      noteGainPeakResolver: (_schedule, note) => note.noteIndex === 0 ? 0.75 : 1,
    })
    await player.play(scheduleFor())

    expect(context.gains[0].gain.automations[0].value).toBe(0.18)
    expect(context.gains[1].gain.automations.map((automation) => automation.value)).toEqual([0, 0.75, 0.75, 0])
    expect(context.gains[2].gain.automations.map((automation) => automation.value)).toEqual([0, 1, 1, 0])
  })

  it('caps attack and release at half of a short note without extending beyond its end', async () => {
    const context = new FakeAudioContext()
    const player = createWork02AudioPlayer({ audioContextFactory: () => context })
    const schedule = structuredClone(scheduleFor())
    schedule.notes[0].durationSeconds = 0.02
    schedule.notes[0].endSeconds = 0.02

    await player.play(schedule)
    expect(context.gains[1].gain.automations).toEqual([
      { operation: 'set', value: 0, time: 4 },
      { operation: 'linearRamp', value: 1, time: 4.01 },
      { operation: 'set', value: 1, time: 4.01 },
      { operation: 'linearRamp', value: 0, time: 4.02 },
    ])
    expect(context.oscillators[0].stopTimes).toEqual([4.02])
  })

  it('does not create oscillators for rest events', async () => {
    const context = new FakeAudioContext()
    const player = createWork02AudioPlayer({ audioContextFactory: () => context })
    const schedule = scheduleFor('all-left-fast-buttons')
    await player.play(schedule)

    expect(schedule.notes).toHaveLength(12)
    expect(context.oscillators).toHaveLength(12)
  })

  it('keeps playing until the final oscillator ends, then disconnects the master', async () => {
    const context = new FakeAudioContext()
    const player = createWork02AudioPlayer({ audioContextFactory: () => context })
    await player.play(scheduleFor())
    const master = context.gains[0]

    context.oscillators.slice(0, -1).forEach((oscillator) => oscillator.emitEnded())
    expect(player.isPlaying()).toBe(true)
    expect(master.disconnectCalls).toBe(0)
    expect(context.gains.slice(1, -1).every((gain) => gain.disconnectCalls === 1)).toBe(true)

    context.oscillators.at(-1)?.emitEnded()
    expect(player.isPlaying()).toBe(false)
    expect(master.disconnectCalls).toBe(1)
  })

  it('ignores a prior playback onended callback after replacement', async () => {
    const context = new FakeAudioContext()
    const player = createWork02AudioPlayer({ audioContextFactory: () => context })
    await player.play(scheduleFor())
    const staleCallbacks = context.oscillators.map((oscillator) => oscillator.onended)
    await player.play(scheduleFor('all-right-same-deck-replay'))

    staleCallbacks.forEach((callback) => callback?.())
    expect(player.isPlaying()).toBe(true)
  })

  it('makes late onended callbacks harmless after stop and dispose', async () => {
    const context = new FakeAudioContext()
    const player = createWork02AudioPlayer({ audioContextFactory: () => context })
    await player.play(scheduleFor())
    const afterStop = context.oscillators[0].onended
    player.stop()
    afterStop?.()
    expect(player.isPlaying()).toBe(false)

    await player.play(scheduleFor())
    const afterDispose = context.oscillators.at(-1)?.onended
    await player.dispose()
    afterDispose?.()
    expect(player.isPlaying()).toBe(false)
  })

  it('can play again after every oscillator ended naturally', async () => {
    const context = new FakeAudioContext()
    const player = createWork02AudioPlayer({ audioContextFactory: () => context })
    await player.play(scheduleFor())
    context.oscillators.forEach((oscillator) => oscillator.emitEnded())
    expect(player.isPlaying()).toBe(false)

    await player.play(scheduleFor('all-right-same-deck-replay'))
    expect(player.isPlaying()).toBe(true)
  })

  it('cleans partial nodes after a scheduling error and remains reusable', async () => {
    const context = new FakeAudioContext()
    const originalCreateOscillator = context.createOscillator.bind(context)
    let calls = 0
    context.createOscillator = () => {
      calls += 1
      if (calls === 2) throw new Error('synthetic scheduling failure')
      return originalCreateOscillator()
    }
    const player = createWork02AudioPlayer({ audioContextFactory: () => context })

    await expect(player.play(scheduleFor())).rejects.toThrow('synthetic scheduling failure')
    expect(player.isPlaying()).toBe(false)
    expect(context.oscillators[0].disconnectCalls).toBe(1)
    expect(context.gains[0].disconnectCalls).toBe(1)

    context.createOscillator = originalCreateOscillator
    await player.play(scheduleFor())
    expect(player.isPlaying()).toBe(true)
  })

  it.each([
    'frequency',
    'noteGain',
    'oscillatorConnect',
    'gainConnect',
    'start',
    'stop',
  ] satisfies SchedulingFailure[])('cleans the current node pair when %s scheduling fails', async (failure) => {
    const context = new FakeAudioContext()
    context.schedulingFailure = failure
    const player = createWork02AudioPlayer({ audioContextFactory: () => context })

    await expect(player.play(scheduleFor())).rejects.toThrow('synthetic scheduling failure')
    expect(player.isPlaying()).toBe(false)
    expect(context.gains[0].disconnectCalls).toBe(1)
    expect(context.oscillators[0].disconnectCalls).toBe(1)
    expect(context.gains[1].disconnectCalls).toBe(1)
    expect(context.oscillators[0].stopTimes).toContain(undefined)

    const staleOnended = context.oscillators[0].onended
    context.schedulingFailure = null
    await player.play(scheduleFor('all-right-same-deck-replay'))
    staleOnended?.()
    expect(player.isPlaying()).toBe(true)
  })

  it('cleans up the active nodes before playing a replacement schedule', async () => {
    const context = new FakeAudioContext()
    const player = createWork02AudioPlayer({ audioContextFactory: () => context })
    await player.play(scheduleFor())
    const firstRun = [...context.oscillators]

    await player.play(scheduleFor('all-right-same-deck-replay'))
    expect(firstRun.every((oscillator) => oscillator.stopTimes.includes(undefined))).toBe(true)
    expect(firstRun.every((oscillator) => oscillator.disconnectCalls > 0)).toBe(true)
    expect(player.isPlaying()).toBe(true)
  })

  it('makes stop idempotent when active and inactive', async () => {
    const context = new FakeAudioContext()
    const player = createWork02AudioPlayer({ audioContextFactory: () => context })
    player.stop()
    await player.play(scheduleFor())
    player.stop()
    player.stop()
    expect(player.isPlaying()).toBe(false)
    expect(context.oscillators.every((oscillator) => oscillator.disconnectCalls === 1)).toBe(true)
  })

  it('closes its owned context once and explicitly rejects reuse after dispose', async () => {
    const context = new FakeAudioContext()
    const factory = vi.fn(() => context)
    const player = createWork02AudioPlayer({ audioContextFactory: factory })
    await player.play(scheduleFor())
    await player.dispose()
    await player.dispose()

    expect(context.closeCalls).toBe(1)
    expect(player.isPlaying()).toBe(false)
    await expect(player.play(scheduleFor())).rejects.toBeInstanceOf(
      Work02AudioPlayerDisposedError,
    )
    expect(factory).toHaveBeenCalledTimes(1)
  })

  it('rejects an invalid schedule before creating any browser audio nodes', async () => {
    const context = new FakeAudioContext()
    const factory = vi.fn(() => context)
    const player = createWork02AudioPlayer({ audioContextFactory: factory })
    const invalid = structuredClone(scheduleFor())
    invalid.notes = []

    await expect(player.play(invalid)).rejects.toThrow(/Invalid AudioSchedule/)
    expect(factory).not.toHaveBeenCalled()
    expect(context.gains).toHaveLength(0)
    expect(context.oscillators).toHaveLength(0)
  })

  it('throws a dedicated error only at play time when Web Audio is unavailable', async () => {
    vi.stubGlobal('AudioContext', undefined)
    try {
      const player = createWork02AudioPlayer()
      await expect(player.play(scheduleFor())).rejects.toBeInstanceOf(
        Work02AudioPlaybackUnsupportedError,
      )
    } finally {
      vi.unstubAllGlobals()
    }
  })
})
