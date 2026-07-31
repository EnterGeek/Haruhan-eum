# Work 01 — Session Data Contract

- 스키마 버전: `work01-session-v1`
- 덱 버전: `work01-oklch-v1`
- 상태: Work 01 고정 계약
- 주요 소비자: Work 02 색상 흐름 → 음악 변환 입력 어댑터

## 1. 계약 목적

이 계약은 하루한음 Work 01이 제시한 12개의 색과 사용자의 좌·우 반응을 재현 가능한 원시 데이터로 전달하기 위한 형식이다.

이 데이터는 색상 취향, 감정, 심리 상태를 판정하기 위한 것이 아니다. Work 02는 해석 전에 제시 순서와 최종 결정 전체를 손실 없이 읽어야 한다.

## 2. 최상위 구조

```ts
interface SessionExport {
  schemaVersion: 'work01-session-v1'
  sessionId: string
  localDate: string
  timeZone: string
  createdAt: string
  startedAt: string
  completedAt: string
  deck: ColorDeck
  decisions: Decision[]
  interactionEvents: InteractionEvent[]
}
```

## 3. 덱 구조

```ts
interface ColorDeck {
  deckVersion: 'work01-oklch-v1'
  deckSeed: string
  cards: ColorCard[]
}

interface ColorCard {
  cardId: string
  presentedOrder: number
  hex: string
  hue: number
  lightness: number
  chroma: number
}
```

### 필드 의미

| 필드 | 형식 | 의미 |
|---|---|---|
| `deckVersion` | 고정 문자열 | 덱 생성 알고리즘과 임시 분포 규칙 버전 |
| `deckSeed` | 문자열 | 동일 덱 재현에 사용하는 입력 시드 |
| `cards` | 12개 배열 | 실제 제시된 전체 카드와 제시 순서 |
| `cardId` | 문자열 | 덱 버전·시드·제시 순서 기반 안정 ID |
| `presentedOrder` | 정수 1..12 | 사용자에게 제시된 순서 |
| `hex` | `#RRGGBB` | 브라우저에 표시한 sRGB 색상 |
| `hue` | 0 이상 360 미만 | 원본 OKLCH Hue, degree |
| `lightness` | 0..1 | 원본 OKLCH Lightness |
| `chroma` | 0 이상 | 원본 OKLCH Chroma |

`hex`는 화면 표시값이며, 색 기반 음악 변환이나 후속 계산은 원본 `hue`, `lightness`, `chroma`를 기준으로 하는 것이 안전하다. sRGB 영역 밖의 값은 표시 HEX 생성 시 클램프될 수 있다.

## 4. 최종 결정 구조

```ts
interface Decision {
  cardId: string
  presentedOrder: number
  hex: string
  hue: number
  lightness: number
  chroma: number
  direction: 'left' | 'right'
  deckVersion: 'work01-oklch-v1'
  deckSeed: string
}
```

### 의미 규칙

- `left`는 싫음, 실패, 부정적 감정을 뜻하지 않는다.
- `right`는 좋음, 성공, 긍정적 감정을 뜻하지 않는다.
- 두 방향은 “지나가요”와 “머물러요”라는 현재 Work 01 상호작용 방향이다.
- Work 02는 오른쪽 선택만 추출하지 않고 12개 최종 결정을 모두 소비해야 한다.
- 배열 순서는 실제 제시 순서와 동일해야 한다.

`deckVersion`과 `deckSeed`는 카드 단위 파이프라인의 출처 보존을 위해 각 결정에 비정규화되어 있다. 기준값은 `deck` 객체이며, 내보내기 시 일치 검증된다.

## 5. 상호작용 이벤트 구조

```ts
type InteractionEvent =
  | {
      sequence: number
      type: 'session_started'
      occurredAt: string
    }
  | {
      sequence: number
      type: 'decision_committed'
      occurredAt: string
      cardId: string
      presentedOrder: number
      direction: 'left' | 'right'
      inputMethod: 'swipe' | 'button'
    }
  | {
      sequence: number
      type: 'decision_undone'
      occurredAt: string
      cardId: string
      presentedOrder: number
      previousDirection: 'left' | 'right'
    }
  | {
      sequence: number
      type: 'session_completed'
      occurredAt: string
    }
```

### 소비 규칙

- `interactionEvents`는 실제 조작 이력을 보존하는 원시 로그다.
- 되돌린 선택은 이벤트에서 삭제하지 않는다.
- 되돌린 선택은 최종 `decisions`에서는 제거한다.
- Work 02 멜로디 입력의 기본값은 `decisions`이며, `interactionEvents`는 기본 음악 입력이 아니다.
- 이벤트 로그를 음악적으로 사용할지는 별도의 제품 결정과 버전이 필요하다.

## 6. 날짜·시각 필드

| 필드 | 형식 | 의미 |
|---|---|---|
| `localDate` | `YYYY-MM-DD` | 사용자의 현지 날짜, 하루 기록의 대표 날짜 |
| `timeZone` | IANA 문자열 | 예: `Asia/Seoul` |
| `createdAt` | ISO 8601 | 세션 객체 생성 시각 |
| `startedAt` | ISO 8601 | 사용자가 세션을 시작한 시각 |
| `completedAt` | ISO 8601 | 12번째 최종 결정이 커밋된 시각 |

UTC 기준 날짜를 하루 기록의 대표 날짜로 사용하지 않는다. `localDate`와 ISO 타임스탬프는 서로 다른 목적을 가진다.

## 7. 필수 무결성 조건

수신 측은 최소한 다음을 검증해야 한다.

```text
deck.cards.length === 12
decisions.length === 12
```

추가 조건:

1. `schemaVersion === 'work01-session-v1'`
2. `deck.deckVersion === 'work01-oklch-v1'`
3. 모든 `cardId`가 유일함
4. `deck.cards[n].presentedOrder === n + 1`
5. `decisions[n].presentedOrder === n + 1`
6. 같은 인덱스의 카드와 결정이 동일한 `cardId`를 가짐
7. 같은 인덱스의 카드와 결정이 동일한 HEX·OKLCH 좌표를 가짐
8. 모든 결정의 `deckVersion`과 `deckSeed`가 덱 기준값과 일치함
9. `interactionEvents.sequence`가 1부터 순차 증가함
10. `session_started`가 정확히 한 번 존재함
11. `session_completed`가 정확히 한 번 존재함
12. 마지막 최종 결정 이후 추가 결정이 없음
13. 되돌린 선택은 최종 `decisions`에 잔존하지 않음

계약 불일치가 발견되면 Work 02는 자동 보정하거나 일부 데이터만 사용하지 말고 입력을 거부해야 한다.

## 8. Work 02 권장 입력 모델

Work 02는 기존 스키마를 직접 변경하지 않고 입력 어댑터를 둔다.

```ts
interface Work02InputItem {
  index: number
  cardId: string
  color: {
    hue: number
    lightness: number
    chroma: number
  }
  direction: 'left' | 'right'
}
```

권장 절차:

1. `SessionExport` 런타임 검증
2. `presentedOrder` 기준 12개 정렬 확인
3. `deck.cards`와 `decisions` 교차 검증
4. 내부 Work 02 입력 형식으로 복사
5. 음악 해석 함수와 음표 생성 함수를 분리
6. 변환 알고리즘 버전과 필요한 난수 시드를 별도 기록
7. 동일 세션·동일 알고리즘 버전에서 동일 결과가 나오는 결정성 테스트 작성

## 9. 버전 변경 규칙

다음 변경은 새 `schemaVersion`이 필요하다.

- 필수 필드 추가·삭제·이름 변경
- 필드 의미 변경
- 좌·우 방향 의미 변경
- 배열 순서 의미 변경
- 이벤트 타입의 의미 변경
- 완료 조건 변경

다음 변경은 덱 버전 변경이 필요하다.

- 색 생성 알고리즘 변경
- PRNG 또는 셔플 변경
- 색공간·밴드·범위 변경
- 인접 색 제한 규칙 변경
- 반올림 또는 OKLCH→HEX 변환 규칙 변경
- 카드 ID 생성 규칙 변경

기존 버전의 데이터는 수정하지 않는다. 새 버전을 추가하고 소비 측에서 버전별 어댑터를 제공한다.

## 10. Golden Sessions

회귀 검증용 대표 세션은 다음 파일에 보존한다.

```text
docs/golden-sessions/representative-sessions.json
```

이 파일은 다음 사례를 포함한다.

- 모두 왼쪽
- 모두 오른쪽
- 스와이프만 사용
- 버튼·스와이프 혼합
- 되돌리기 후 재선택
- 같은 덱 재현
- 잠시 중단 후 재개

Golden Sessions는 제품 분석용 데이터셋이 아니라 스키마·변환·결정성 회귀 테스트의 고정 입력이다.
