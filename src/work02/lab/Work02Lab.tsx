import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Work02AudioPlayer } from '../audio/player'
import { createWork02AudioPlayer } from '../audio/player'
import type { InterpretationMethod } from '../interpretation/types'
import type { LabMethodResult } from './model'
import { LAB_FIXTURE_IDS, createLabFixtureResult } from './model'

export type Work02LabPlayerFactory = () => Work02AudioPlayer

export interface Work02LabProps {
  playerFactory?: Work02LabPlayerFactory
}

const METHOD_LABELS: Record<InterpretationMethod, string> = {
  'absolute-hue': 'A · Absolute Hue',
  'relative-hue': 'B · Relative Hue',
  hybrid: 'C · Hybrid',
}

const directionMark = (direction: 'left' | 'right'): string =>
  direction === 'left' ? '←' : '→'

function ContourGraph({ result }: { result: LabMethodResult }) {
  const points = result.contourPositions.map((position, index) => {
    const x = 20 + index * (280 / 11)
    const y = 112 - position * 92
    return `${x},${y}`
  }).join(' ')
  const description = result.contourPositions
    .map((position, index) => `${index + 1}: ${position.toFixed(3)}`)
    .join(', ')

  return (
    <figure className="contour-figure">
      <figcaption>Normalized contour graph (0–1, not pitch)</figcaption>
      <svg viewBox="0 0 320 136" role="img" aria-label={`${METHOD_LABELS[result.method]} contour positions. ${description}`}>
        <path d="M20 20V112H300" className="axis" />
        <polyline points={points} className="contour-line" />
        {result.contourPositions.map((position, index) => (
          <circle key={index} cx={20 + index * (280 / 11)} cy={112 - position * 92} r="3" />
        ))}
      </svg>
    </figure>
  )
}

function MethodCard({
  result,
  directions,
  isPlaying,
  onToggle,
}: {
  result: LabMethodResult
  directions: readonly ('left' | 'right')[]
  isPlaying: boolean
  onToggle: () => void
}) {
  const noteByOrder = new Map(result.melody.events
    .filter((event) => event.kind === 'note')
    .map((event) => [event.source.presentedOrders[0], event]))
  const scheduledByEvent = new Map(result.schedule.notes
    .map((note) => [note.sourceEventIndex, note]))
  const restCount = result.melody.events.filter((event) => event.kind === 'rest').length
  const frequencyRange = result.schedule.notes.map((note) => note.frequencyHz)

  return (
    <article className="method-card" aria-labelledby={`${result.method}-title`}>
      <header>
        <div>
          <h2 id={`${result.method}-title`}>{METHOD_LABELS[result.method]}</h2>
          <code>{result.method}</code>
        </div>
        <button type="button" onClick={onToggle} aria-label={`${isPlaying ? 'Stop' : 'Play'} ${METHOD_LABELS[result.method]}`}>
          {isPlaying ? 'Stop' : 'Play'}
        </button>
      </header>

      <ContourGraph result={result} />

      <div className="summary-grid">
        <span>MIDI</span><code>{result.midiNotes.join(' ')}</code>
        <span>Frequency</span><code>{Math.min(...frequencyRange).toFixed(2)}–{Math.max(...frequencyRange).toFixed(2)} Hz</code>
        <span>Contour</span><code>{result.contourPositions.map((value) => value.toFixed(3)).join(' ')}</code>
        <span>Versions</span><code>{result.interpretation.versions.interpreter}<br />{result.melody.versions.generator}<br />{result.schedule.versions.scheduleContract}</code>
        <span>Events / rests</span><code>{result.melody.events.length} / {restCount}</code>
        <span>Total</span><code>{result.schedule.totalDurationSeconds}s</code>
      </div>

      <div className="step-table-wrap">
        <table>
          <caption>Presented steps and generated timing</caption>
          <thead><tr><th>#</th><th>Dir</th><th>Contour</th><th>MIDI</th><th>Start</th><th>Duration</th></tr></thead>
          <tbody>
            {result.contourPositions.map((contour, index) => {
              const order = index + 1
              const note = noteByOrder.get(order)
              const scheduled = note ? scheduledByEvent.get(note.eventIndex) : undefined
              return (
                <tr key={order}>
                  <td>{order}</td><td>{directionMark(directions[index])}</td>
                  <td>{contour.toFixed(3)}</td><td>{note?.midiNote ?? '—'}</td>
                  <td>{scheduled?.startSeconds.toFixed(3) ?? '—'}s</td>
                  <td>{scheduled?.durationSeconds.toFixed(3) ?? '—'}s</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </article>
  )
}

export function Work02Lab({ playerFactory = createWork02AudioPlayer }: Work02LabProps) {
  const [fixtureId, setFixtureId] = useState<string>(LAB_FIXTURE_IDS[0])
  const [playingMethod, setPlayingMethod] = useState<InterpretationMethod | null>(null)
  const [error, setError] = useState<string | null>(null)
  const result = useMemo(() => createLabFixtureResult(fixtureId), [fixtureId])
  const playerRef = useRef<Work02AudioPlayer | null>(null)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const playbackTokenRef = useRef(0)

  if (playerRef.current === null) playerRef.current = playerFactory()

  const clearPlaybackState = useCallback(() => {
    playbackTokenRef.current += 1
    if (timeoutRef.current !== null) clearTimeout(timeoutRef.current)
    timeoutRef.current = null
    playerRef.current?.stop()
    setPlayingMethod(null)
  }, [])

  useEffect(() => () => {
    playbackTokenRef.current += 1
    if (timeoutRef.current !== null) clearTimeout(timeoutRef.current)
    void playerRef.current?.dispose()
  }, [])

  const selectFixture = (nextFixtureId: string) => {
    clearPlaybackState()
    setError(null)
    setFixtureId(nextFixtureId)
  }

  const toggleMethod = async (methodResult: LabMethodResult) => {
    if (playingMethod === methodResult.method) {
      clearPlaybackState()
      return
    }
    clearPlaybackState()
    setError(null)
    const token = ++playbackTokenRef.current
    try {
      await playerRef.current?.play(methodResult.schedule)
      if (token !== playbackTokenRef.current) return
      setPlayingMethod(methodResult.method)
      timeoutRef.current = setTimeout(() => {
        if (token !== playbackTokenRef.current) return
        setPlayingMethod(null)
        timeoutRef.current = null
      }, methodResult.schedule.totalDurationSeconds * 1000)
    } catch (playError) {
      if (token !== playbackTokenRef.current) return
      setPlayingMethod(null)
      setError(playError instanceof Error ? playError.message : 'Audio playback failed.')
    }
  }

  const profile = result.methods[0].schedule.profile
  return (
    <main className="lab-shell">
      <header className="lab-heading">
        <p className="eyebrow">Work 02</p>
        <h1>Work 02 · A/B/C Melody Lab</h1>
        <p>개발용 비교 화면 — 제품 UI 아님</p>
      </header>

      <section className="controls" aria-label="Lab controls">
        <label htmlFor="fixture-select">Fixture</label>
        <select id="fixture-select" value={fixtureId} onChange={(event) => selectFixture(event.target.value)}>
          {LAB_FIXTURE_IDS.map((id) => <option key={id} value={id}>{id}</option>)}
        </select>
        <p className="playback-status" aria-live="polite">
          {playingMethod ? `Playing ${METHOD_LABELS[playingMethod]}` : 'Playback stopped'}
        </p>
        {error && <p role="alert" className="error">{error}</p>}
      </section>

      <section className="fixture-summary" aria-label="Common fixture and playback information">
        <dl>
          <div><dt>Case ID</dt><dd><code>{result.caseId}</code></dd></div>
          <div><dt>Directions</dt><dd><code>{result.directions.map(directionMark).join(' ')}</code></dd></div>
          <div><dt>Timeline</dt><dd>80 BPM · 12 beats · 9 seconds</dd></div>
          <div><dt>Playback</dt><dd>{profile.waveform} · gain {profile.masterGain} · attack {profile.attackSeconds}s · release {profile.releaseSeconds}s</dd></div>
        </dl>
        <p>Left/right are input directions only; no good/bad or emotional meaning is assigned.</p>
      </section>

      <section className="method-grid" aria-label="A B C melody comparison">
        {result.methods.map((methodResult) => (
          <MethodCard key={methodResult.method} result={methodResult} directions={result.directions}
            isPlaying={playingMethod === methodResult.method} onToggle={() => void toggleMethod(methodResult)} />
        ))}
      </section>
    </main>
  )
}
