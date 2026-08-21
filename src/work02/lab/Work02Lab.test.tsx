import { StrictMode, act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { AudioSchedule } from '../audio/types'
import type { Work02AudioPlayer } from '../audio/player'
import { Work02Lab } from './Work02Lab'

class FakePlayer implements Work02AudioPlayer {
  readonly schedules: AudioSchedule[] = []
  stopCalls = 0
  disposeCalls = 0
  playing = false
  playError: Error | null = null
  disposed = false

  async play(schedule: AudioSchedule): Promise<void> {
    if (this.disposed) {
      throw new Error(
        'This Work 02 audio player has been disposed and cannot be reused.',
      )
    }
    if (this.playError) throw this.playError
    this.schedules.push(schedule)
    this.playing = true
  }
  stop(): void { this.stopCalls += 1; this.playing = false }
  async dispose(): Promise<void> {
    this.disposeCalls += 1
    this.disposed = true
    this.playing = false
  }
  isPlaying(): boolean { return this.playing }
}

let container: HTMLDivElement
let root: Root
let player: FakePlayer

const button = (name: string): HTMLButtonElement => {
  const match = [...container.querySelectorAll('button')]
    .find((candidate) => candidate.getAttribute('aria-label') === name)
  if (!match) throw new Error(`Button not found: ${name}`)
  return match as HTMLButtonElement
}

const click = async (element: HTMLElement) => {
  await act(async () => { element.click(); await Promise.resolve() })
}

beforeEach(() => {
  ;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean })
    .IS_REACT_ACT_ENVIRONMENT = true
  container = document.createElement('div')
  document.body.append(container)
  root = createRoot(container)
  player = new FakePlayer()
  act(() => root.render(<Work02Lab playerFactory={() => player} />))
})

afterEach(() => {
  act(() => root.unmount())
  container.remove()
  if (vi.isFakeTimers()) vi.runOnlyPendingTimers()
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('Work02Lab', () => {
  it('renders seven fixtures with the approved initial selection', () => {
    const select = container.querySelector('#fixture-select') as HTMLSelectElement
    expect(select.options).toHaveLength(7)
    expect(select.value).toBe('same-deck-baseline')
    expect([...select.options].map((option) => option.value)).toContain('pause-and-resume')
  })

  it('renders equally structured A/B/C cards and Play controls', () => {
    expect(container.querySelectorAll('.method-card')).toHaveLength(3)
    expect(button('Play A · Absolute Hue')).toBeTruthy()
    expect(button('Play B · Relative Hue')).toBeTruthy()
    expect(button('Play C · Hybrid')).toBeTruthy()
  })

  it('changes the fixture model and resets playback', async () => {
    await click(button('Play A · Absolute Hue'))
    const select = container.querySelector('#fixture-select') as HTMLSelectElement
    await act(async () => {
      select.value = 'all-left-fast-buttons'
      select.dispatchEvent(new Event('change', { bubbles: true }))
    })
    expect(container.textContent).toContain('all-left-fast-buttons')
    expect(container.textContent).toContain('Playback stopped')
    expect(player.stopCalls).toBe(1)
  })

  it('plays A, replaces it with B, and reports only B as active', async () => {
    await click(button('Play A · Absolute Hue'))
    expect(container.textContent).toContain('Playing A · Absolute Hue')
    const stopsBeforeB = player.stopCalls
    await click(button('Play B · Relative Hue'))
    expect(player.stopCalls).toBe(stopsBeforeB + 1)
    expect(container.textContent).toContain('Playing B · Relative Hue')
    expect(player.schedules.at(-1)?.method).toBe('relative-hue')
  })

  it('stops when the active method is clicked again', async () => {
    await click(button('Play C · Hybrid'))
    await click(button('Stop C · Hybrid'))
    expect(container.textContent).toContain('Playback stopped')
    expect(player.isPlaying()).toBe(false)
  })

  it('shows play errors and permits a later retry', async () => {
    player.playError = new Error('synthetic audio error')
    await click(button('Play A · Absolute Hue'))
    expect(container.querySelector('[role="alert"]')?.textContent).toBe('synthetic audio error')
    player.playError = null
    await click(button('Play B · Relative Hue'))
    expect(container.querySelector('[role="alert"]')).toBeNull()
    expect(container.textContent).toContain('Playing B · Relative Hue')
  })

  it('disposes the single player on unmount', async () => {
    await click(button('Play A · Absolute Hue'))
    act(() => root.unmount())
    expect(player.disposeCalls).toBe(1)
    root = createRoot(container)
  })

  it('creates a usable player lazily under React StrictMode', async () => {
    act(() => root.unmount())

    const players: FakePlayer[] = []
    root = createRoot(container)
    act(() => {
      root.render(
        <StrictMode>
          <Work02Lab
            playerFactory={() => {
              const next = new FakePlayer()
              players.push(next)
              return next
            }}
          />
        </StrictMode>,
      )
    })

    expect(players).toHaveLength(0)

    await click(button('Play A · Absolute Hue'))

    expect(players).toHaveLength(1)
    expect(players[0].disposed).toBe(false)
    expect(players[0].schedules).toHaveLength(1)
    expect(container.textContent).toContain('Playing A · Absolute Hue')
  })

  it('displays MIDI, contour, direction, and timing data for every method', () => {
    const cards = [...container.querySelectorAll('.method-card')]
    cards.forEach((card) => {
      expect(card.textContent).toContain('MIDI')
      expect(card.textContent).toContain('Contour')
      expect(card.querySelectorAll('tbody tr')).toHaveLength(12)
      expect(card.querySelector('svg[role="img"]')?.getAttribute('aria-label')).toContain('contour positions')
    })
  })

  it('exposes a labelled fixture control and live playback status', () => {
    const select = container.querySelector('#fixture-select')
    expect(container.querySelector('label[for="fixture-select"]')?.textContent).toBe('Fixture')
    expect(select).toBeTruthy()
    expect(container.querySelector('[aria-live="polite"]')).toBeTruthy()
  })

  it('returns the UI to stopped after the schedule duration', async () => {
    vi.useFakeTimers()
    await click(button('Play A · Absolute Hue'))
    expect(container.textContent).toContain('Playing A · Absolute Hue')

    await act(async () => { vi.advanceTimersByTime(9000) })
    expect(container.textContent).toContain('Playback stopped')
    expect(button('Play A · Absolute Hue')).toBeTruthy()
  })

  it('does not let an earlier playback timeout stop its replacement', async () => {
    vi.useFakeTimers()
    await click(button('Play A · Absolute Hue'))
    await act(async () => { vi.advanceTimersByTime(4000) })
    await click(button('Play B · Relative Hue'))

    await act(async () => { vi.advanceTimersByTime(5000) })
    expect(container.textContent).toContain('Playing B · Relative Hue')
    expect(button('Stop B · Relative Hue')).toBeTruthy()

    await act(async () => { vi.advanceTimersByTime(4000) })
    expect(container.textContent).toContain('Playback stopped')
    expect(button('Play B · Relative Hue')).toBeTruthy()
  })
})
