import { useCallback, useMemo, useRef, useState } from 'react'
import { createDeckSeed, generateDeck } from '../domain/deck'
import {
  commitDecision,
  createSession,
  exportSession,
  startSession,
  undoDecision,
  type SessionState,
} from '../domain/session'
import type { Direction, InputMethod } from '../domain/types'

type Screen = 'intro' | 'session' | 'result'

const nowIso = () => new Date().toISOString()
const formatDate = (date: string) =>
  new Intl.DateTimeFormat('ko-KR', {
    month: 'long',
    day: 'numeric',
    weekday: 'long',
  }).format(new Date(`${date}T12:00:00`))

function downloadJson(data: unknown, filename: string) {
  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: 'application/json',
  })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  URL.revokeObjectURL(url)
}

export function App() {
  const [session, setSession] = useState<SessionState>(() =>
    createSession(generateDeck(createDeckSeed())),
  )
  const [screen, setScreen] = useState<Screen>('intro')
  const [showJson, setShowJson] = useState(false)
  const [dragX, setDragX] = useState(0)
  const pointerStart = useRef<{ x: number; y: number; id: number } | null>(null)
  const inputLocked = useRef(false)

  const currentCard = session.deck.cards[session.decisions.length]
  const completedExport = useMemo(
    () => (session.completedAt ? exportSession(session) : null),
    [session],
  )

  const begin = () => {
    setSession((current) => startSession(current, nowIso()))
    setScreen('session')
  }

  const decide = useCallback((direction: Direction, method: InputMethod) => {
    if (inputLocked.current) return
    inputLocked.current = true
    setDragX(direction === 'left' ? -420 : 420)
    window.setTimeout(() => {
      setSession((current) => {
        const next = commitDecision(current, direction, method, nowIso())
        if (next.completedAt) setScreen('result')
        return next
      })
      setDragX(0)
      inputLocked.current = false
    }, 180)
  }, [])

  const undo = () => {
    if (inputLocked.current || session.decisions.length === 0) return
    setSession((current) => undoDecision(current, nowIso()))
    setScreen('session')
  }

  const replaySameDeck = () => {
    setSession(createSession(generateDeck(session.deck.deckSeed)))
    setShowJson(false)
    setScreen('intro')
  }

  const makeNewDeck = () => {
    setSession(createSession(generateDeck(createDeckSeed())))
    setShowJson(false)
    setScreen('intro')
  }

  const onPointerDown = (event: React.PointerEvent) => {
    if (inputLocked.current) return
    pointerStart.current = { x: event.clientX, y: event.clientY, id: event.pointerId }
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  const onPointerMove = (event: React.PointerEvent) => {
    const start = pointerStart.current
    if (!start || start.id !== event.pointerId) return
    const horizontal = event.clientX - start.x
    const vertical = event.clientY - start.y
    if (Math.abs(horizontal) > Math.abs(vertical)) setDragX(horizontal)
  }

  const onPointerEnd = (event: React.PointerEvent) => {
    const start = pointerStart.current
    pointerStart.current = null
    if (!start) return
    const deltaX = event.clientX - start.x
    const deltaY = event.clientY - start.y
    if (Math.abs(deltaX) >= 60 && Math.abs(deltaX) > Math.abs(deltaY) * 1.2) {
      decide(deltaX < 0 ? 'left' : 'right', 'swipe')
    } else {
      setDragX(0)
    }
  }

  return (
    <main className="app-shell">
      <div className="ambient ambient-one" />
      <div className="ambient ambient-two" />
      {screen === 'intro' && (
        <section className="intro page" aria-labelledby="intro-title">
          <header className="wordmark">하루한음</header>
          <div className="intro-copy">
            <p className="date-label">{formatDate(session.localDate)}</p>
            <h1 id="intro-title">오늘을 잠깐<br />떠올려보세요.</h1>
            <p>설명하지 않아도 괜찮아요.<br />지금 마음이 가는 대로 넘겨보세요.</p>
          </div>
          <button className="primary-button" onClick={begin}>오늘의 색 만나기</button>
          <p className="privacy-note">12개의 색 · 약 1분 · 분석하지 않아요</p>
        </section>
      )}

      {screen === 'session' && currentCard && (
        <section className="session page" aria-label="색상 카드 세션">
          <header className="session-header">
            <button
              className="text-button"
              onClick={undo}
              disabled={session.decisions.length === 0}
            >
              ↶ 한 단계
            </button>
            <span>{session.decisions.length + 1} / {session.deck.cards.length}</span>
          </header>
          <div
            className="card-stage"
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerEnd}
            onPointerCancel={() => {
              pointerStart.current = null
              setDragX(0)
            }}
          >
            <div className="card-shadow" />
            <article
              className="color-card"
              aria-label={`${currentCard.presentedOrder}번째 색상 카드`}
              style={{
                backgroundColor: currentCard.hex,
                transform: `translateX(${dragX}px) rotate(${dragX / 25}deg)`,
              }}
            >
              <span className={`gesture-label left ${dragX < -25 ? 'visible' : ''}`}>
                지나가요
              </span>
              <span className={`gesture-label right ${dragX > 25 ? 'visible' : ''}`}>
                머물러요
              </span>
            </article>
          </div>
          <div className="progress-track" aria-label="세션 진행도">
            <span style={{ width: `${(session.decisions.length / 12) * 100}%` }} />
          </div>
          <p className="gentle-guide">좋고 나쁨이 아닌, 지금의 방향이에요</p>
          <div className="decision-buttons">
            <button onClick={() => decide('left', 'button')} aria-label="지나가요">
              <span>←</span> 지나가요
            </button>
            <button onClick={() => decide('right', 'button')} aria-label="머물러요">
              머물러요 <span>→</span>
            </button>
          </div>
        </section>
      )}

      {screen === 'result' && completedExport && (
        <section className="result page" aria-labelledby="result-title">
          <header className="result-header">
            <p className="date-label">{formatDate(session.localDate)}</p>
            <h1 id="result-title">오늘 머물고<br />지나간 색</h1>
            <p>해석하지 않은, 오늘의 선택 흐름이에요.</p>
          </header>
          <ol className="color-flow" aria-label="제시된 색과 선택 결과">
            {session.decisions.map((decision) => (
              <li key={decision.cardId}>
                <span
                  className="flow-color"
                  style={{ backgroundColor: decision.hex }}
                  title={decision.hex}
                />
                <span className="flow-direction">
                  {decision.direction === 'right' ? '→' : '←'}
                </span>
                <span className="sr-only">
                  {decision.presentedOrder}번째, {decision.direction === 'right' ? '머물러요' : '지나가요'}
                </span>
              </li>
            ))}
          </ol>
          <div className="legend">
            <span>← 지나간 색</span><span>머문 색 →</span>
          </div>
          <div className="result-actions">
            <button
              className="primary-button"
              onClick={() => downloadJson(
                completedExport,
                `haru-haneum-${session.localDate}-${session.sessionId.slice(0, 8)}.json`,
              )}
            >
              원시 JSON 다운로드
            </button>
            <button className="secondary-button" onClick={() => setShowJson(!showJson)}>
              {showJson ? 'JSON 닫기' : '원시 JSON 보기'}
            </button>
          </div>
          {showJson && (
            <pre className="json-view" tabIndex={0}>
              {JSON.stringify(completedExport, null, 2)}
            </pre>
          )}
          <div className="restart-actions">
            <button onClick={replaySameDeck}>같은 덱 다시 실행</button>
            <button onClick={makeNewDeck}>새 덱 생성</button>
          </div>
        </section>
      )}
    </main>
  )
}
