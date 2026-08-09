import { StrictMode, act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Work02AudioPlayer } from '../audio/player'
import type { AudioSchedule } from '../audio/types'
import { ColorDimensionsLab } from './ColorDimensionsLab'

class FakePlayer implements Work02AudioPlayer {
  schedules: AudioSchedule[] = []
  stopCalls = 0
  disposeCalls = 0
  playing = false
  async play(schedule: AudioSchedule) { this.schedules.push(schedule); this.playing = true }
  stop() { this.stopCalls += 1; this.playing = false }
  async dispose() { this.disposeCalls += 1; this.playing = false }
  isPlaying() { return this.playing }
}

let container: HTMLDivElement
let root: Root
let player: FakePlayer

const button = (name: string) => {
  const result = [...container.querySelectorAll('button')]
    .find((item) => item.getAttribute('aria-label') === name)
  if (!result) throw new Error(`Missing button: ${name}`)
  return result as HTMLButtonElement
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
  act(() => root.render(<ColorDimensionsLab playerFactory={() => player} />))
})

afterEach(() => {
  act(() => root.unmount())
  container.remove()
  if (vi.isFakeTimers()) vi.runOnlyPendingTimers()
  vi.useRealTimers()
})

describe('ColorDimensionsLab', () => {
  it('offers all seven fixtures and renders twelve traceable source swatches', () => {
    const select = container.querySelector('#color-fixture-select') as HTMLSelectElement
    expect(select.options).toHaveLength(7)
    expect(container.querySelectorAll('.color-source-card')).toHaveLength(12)
    expect(container.textContent).toContain('#2CD395')
    expect(container.textContent).toContain('H')
    expect(container.textContent).toContain('L')
    expect(container.textContent).toContain('C')
    expect(container.textContent).toContain('B · Button')
  })

  it('shows the not-mapped notice and two equally structured comparison conditions', () => {
    expect(container.textContent).toContain('Not currently mapped to audio:')
    expect(container.textContent).toContain('button vs swipe')
    expect(container.textContent).toContain('exact selection timing')
    expect(container.textContent).toContain('undo/reselection history')
    const cards = container.querySelectorAll('.condition-card')
    expect(cards).toHaveLength(2)
    cards.forEach((card) => expect(card.querySelectorAll('tbody tr')).toHaveLength(12))
  })

  it('plays only one condition, stops on repeat, and stops on fixture change', async () => {
    await click(button('Play A · Hybrid / Hue only'))
    expect(container.textContent).toContain('Playing A · Hybrid / Hue only')
    await click(button('Play B · Hybrid / Hue + L + C'))
    expect(container.textContent).toContain('Playing B · Hybrid / Hue + L + C')
    expect(player.stopCalls).toBeGreaterThan(0)
    await click(button('Stop B · Hybrid / Hue + L + C'))
    expect(container.textContent).toContain('Playback stopped')

    await click(button('Play A · Hybrid / Hue only'))
    const select = container.querySelector('#color-fixture-select') as HTMLSelectElement
    act(() => { select.value = 'mixed-button-and-swipe'; select.dispatchEvent(new Event('change', { bubbles: true })) })
    expect(container.textContent).toContain('Playback stopped')
  })

  it('creates one usable player lazily under StrictMode', async () => {
    act(() => root.unmount())
    const players: FakePlayer[] = []
    root = createRoot(container)
    act(() => root.render(<StrictMode><ColorDimensionsLab playerFactory={() => {
      const next = new FakePlayer(); players.push(next); return next
    }} /></StrictMode>))
    expect(players).toHaveLength(0)
    await click(button('Play A · Hybrid / Hue only'))
    expect(players).toHaveLength(1)
    expect(players[0].schedules).toHaveLength(1)
    expect(container.textContent).toContain('Playing A · Hybrid / Hue only')
  })
})
