import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createWork02AudioPlayer, type Work02AudioPlayer } from '../audio/player'
import { LAB_FIXTURE_IDS, type LabFixtureId } from '../lab/model'
import {
  createColorDimensionsFixtureResult,
  noteLocalPeakForLabSchedule,
  type ColorDimensionCondition,
  type ColorDimensionConditionResult,
  type SourceColorStep,
} from './model'

export type ColorDimensionsPlayerFactory = () => Work02AudioPlayer

const defaultPlayerFactory: ColorDimensionsPlayerFactory = () =>
  createWork02AudioPlayer({ noteGainPeakResolver: noteLocalPeakForLabSchedule })

const directionMark = (direction: 'left' | 'right') => direction === 'left' ? '←' : '→'
const inputMark = (input: 'button' | 'swipe') => input === 'button' ? 'B · Button' : 'S · Swipe'

function ColorSwatch({ step }: { step: SourceColorStep }) {
  return (
    <li className="color-source-card">
      <div className="swatch" style={{ backgroundColor: step.hex }} aria-label={`Actual color ${step.hex}`} />
      <strong>#{step.order}</strong><code>{step.hex}</code>
      <dl>
        <div><dt>H</dt><dd>{step.hue.toFixed(3)}°</dd></div>
        <div><dt>L</dt><dd>{step.lightness.toFixed(4)}</dd></div>
        <div><dt>C</dt><dd>{step.chroma.toFixed(4)}</dd></div>
        <div><dt>Dir</dt><dd>{directionMark(step.direction)}</dd></div>
        <div><dt>Input</dt><dd>{inputMark(step.commitInput)}</dd></div>
      </dl>
    </li>
  )
}

function ConditionCard({ result, active, onToggle }: {
  result: ColorDimensionConditionResult
  active: boolean
  onToggle: () => void
}) {
  return (
    <article className="condition-card" aria-labelledby={`${result.condition}-title`}>
      <header>
        <div><h2 id={`${result.condition}-title`}>{result.label}</h2><code>{result.condition}</code></div>
        <button type="button" onClick={onToggle} aria-label={`${active ? 'Stop' : 'Play'} ${result.label}`}>
          {active ? 'Stop' : 'Play'}
        </button>
      </header>
      <div className="condition-summary">
        <span>Hybrid contour</span><strong>same baseline</strong>
        <span>Timeline</span><strong>80 BPM · 12 beats · 9 seconds</strong>
        <span>Master gain</span><strong>0.18</strong>
        <span>Note-local peak</span><strong>{result.condition === 'hue-only' ? '1.00 fixed' : '0.75–1.00 from chroma'}</strong>
      </div>
      <div className="dimension-table-wrap">
        <table>
          <caption>Source color → Hybrid contour → experiment output</caption>
          <thead><tr><th>#</th><th>Color</th><th>Dir</th><th>Hue</th><th>Lightness</th><th>Chroma</th><th>Base contour</th><th>L offset</th><th>Final MIDI</th><th>Peak</th><th>Start</th><th>Duration</th></tr></thead>
          <tbody>{result.steps.map((step) => (
            <tr key={step.order}>
              <td>{step.order}</td>
              <td><span className="table-swatch" style={{ backgroundColor: step.hex }} aria-label={step.hex} /></td>
              <td>{directionMark(step.direction)}</td><td>{step.hue.toFixed(3)}°</td>
              <td>{step.lightness.toFixed(4)}</td><td>{step.chroma.toFixed(4)}</td>
              <td>{step.baseHybridContour.toFixed(3)}</td><td>{step.lightnessOffset > 0 ? '+' : ''}{step.lightnessOffset}</td>
              <td>{step.finalMidi}</td><td>{step.noteLocalPeak.toFixed(3)}</td>
              <td>{step.startSeconds.toFixed(3)}s</td><td>{step.durationSeconds.toFixed(3)}s</td>
            </tr>
          ))}</tbody>
        </table>
      </div>
    </article>
  )
}

export function ColorDimensionsLab({ playerFactory = defaultPlayerFactory }: {
  playerFactory?: ColorDimensionsPlayerFactory
}) {
  const [fixtureId, setFixtureId] = useState<LabFixtureId>(LAB_FIXTURE_IDS[0])
  const [playing, setPlaying] = useState<ColorDimensionCondition | null>(null)
  const [error, setError] = useState<string | null>(null)
  const result = useMemo(() => createColorDimensionsFixtureResult(fixtureId), [fixtureId])
  const playerRef = useRef<Work02AudioPlayer | null>(null)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const playbackTokenRef = useRef(0)

  const getOrCreatePlayer = useCallback(() => {
    if (playerRef.current !== null) return playerRef.current
    const player = playerFactory()
    playerRef.current = player
    return player
  }, [playerFactory])

  const stopPlayback = useCallback(() => {
    playbackTokenRef.current += 1
    if (timeoutRef.current !== null) clearTimeout(timeoutRef.current)
    timeoutRef.current = null
    playerRef.current?.stop()
    setPlaying(null)
  }, [])

  useEffect(() => () => {
    playbackTokenRef.current += 1
    if (timeoutRef.current !== null) clearTimeout(timeoutRef.current)
    timeoutRef.current = null
    const player = playerRef.current
    playerRef.current = null
    void player?.dispose()
  }, [])

  const toggle = async (condition: ColorDimensionConditionResult) => {
    if (playing === condition.condition) return stopPlayback()
    stopPlayback()
    setError(null)
    const token = ++playbackTokenRef.current
    try {
      await getOrCreatePlayer().play(condition.schedule)
      if (token !== playbackTokenRef.current) return
      setPlaying(condition.condition)
      timeoutRef.current = setTimeout(() => {
        if (token !== playbackTokenRef.current) return
        setPlaying(null)
        timeoutRef.current = null
      }, condition.schedule.totalDurationSeconds * 1000)
    } catch (reason) {
      if (token !== playbackTokenRef.current) return
      setPlaying(null)
      setError(reason instanceof Error ? reason.message : 'Audio playback failed.')
    }
  }

  const metadata = result.metadata
  return (
    <main className="dimensions-shell">
      <header className="dimensions-heading">
        <p className="eyebrow">Work 02 · Temporary experiment</p>
        <h1>Color Dimensions Lab</h1>
        <p>“좋은 음악”이 아니라, 원본 색 차이가 더 잘 전달되는지만 비교합니다.</p>
      </header>
      <section className="dimensions-controls" aria-label="Color dimensions Lab controls">
        <label htmlFor="color-fixture-select">Fixture</label>
        <select id="color-fixture-select" value={fixtureId} onChange={(event) => {
          stopPlayback(); setError(null); setFixtureId(event.target.value as LabFixtureId)
        }}>
          {LAB_FIXTURE_IDS.map((id) => <option key={id} value={id}>{id}</option>)}
        </select>
        <p aria-live="polite" className="playback-status">{playing ? `Playing ${result.conditions.find((item) => item.condition === playing)?.label}` : 'Playback stopped'}</p>
        {error && <p role="alert" className="error">{error}</p>}
      </section>

      <section className="metadata-panel" aria-label="Fixture metadata">
        <dl>
          <div><dt>Directions</dt><dd><code>{metadata.directions}</code></dd></div>
          <div><dt>Commit inputs</dt><dd><code>{metadata.commitInputSequence}</code></dd></div>
          <div><dt>Undo events</dt><dd><code>{metadata.undoEvents.length ? JSON.stringify(metadata.undoEvents) : 'none'}</code></dd></div>
          <div><dt>Session elapsed</dt><dd>{metadata.elapsedSeconds.toFixed(3)}s</dd></div>
        </dl>
        <aside><strong>Not currently mapped to audio:</strong><ul><li>button vs swipe</li><li>exact selection timing</li><li>undo/reselection history</li></ul></aside>
      </section>

      <section aria-labelledby="source-colors-title">
        <h2 id="source-colors-title">Original 12-color sequence</h2>
        <ol className="color-source-grid">{result.sourceColors.map((step) => <ColorSwatch key={step.order} step={step} />)}</ol>
      </section>

      <section className="condition-grid" aria-label="Two equal color dimension conditions">
        {result.conditions.map((condition) => <ConditionCard key={condition.condition} result={condition}
          active={playing === condition.condition} onToggle={() => void toggle(condition)} />)}
      </section>
    </main>
  )
}
