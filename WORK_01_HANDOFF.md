# Work 01 — 색상 덱·스와이프 세션 인수인계

작성일: 2026-07-31  
구현 버전: `0.1.0`  
덱 버전: `work01-oklch-v1`  
세션 스키마: `work01-session-v1`

## 1. 생성·수정한 파일

### 실행과 설정

- `package.json`, `package-lock.json`: 실행, 테스트, 빌드 의존성과 명령
- `index.html`: 모바일 뷰포트 진입점
- `vite.config.ts`: React 및 Vitest 설정
- `tsconfig.json`, `tsconfig.app.json`: TypeScript 엄격 모드
- `.gitignore`: 빌드 및 의존성 산출물 제외

### 구현

- `src/main.tsx`: 앱 진입점
- `src/ui/App.tsx`: 시작, 카드 세션, 결과, JSON 확인·다운로드 UI
- `src/ui/styles.css`: 모바일 우선 화면과 접근성/축소 모션 처리
- `src/domain/types.ts`: 덱, 결정, 이벤트, Work 02 세션 계약
- `src/domain/random.ts`: 문자열 시드 해시와 결정적 PRNG/셔플
- `src/domain/color.ts`: 고정 OKLCH→sRGB→HEX 변환 및 색 거리 계산
- `src/domain/deck.ts`: 12장 통제 랜덤 덱 생성과 검증
- `src/domain/session.ts`: 시작, 선택, 되돌리기, 완료, 내보내기 상태 전이

### 검증과 문서

- `src/domain/deck.test.ts`: 결정성, 다른 시드, 500개 시드 분포, ID/순서
- `src/domain/session.test.ts`: 모두 좌·우, 교차, 되돌리기, 중복 방지, 계약 검증
- `IMPLEMENTATION_ASSUMPTIONS.md`: 임시 구현 결정 6개
- `README.md`: 실행법과 구조
- `WORK_01_HANDOFF.md`: 본 문서

기준 PDF 3개와 `node_modules`, `dist`는 저장소 산출물에 포함하지 않는다.

## 2. 구현된 기능

- 사용자의 현지 날짜와 중립적인 회상 문구가 있는 시작 화면
- 모바일 세로 화면 중심의 12장 색상 카드
- 포인터/터치 좌우 스와이프
- 좌우 대체 버튼
- 스와이프와 버튼이 공유하는 단일 선택 커밋 경로
- 카드 전환 중 입력 잠금과 현재 상태 검증을 통한 중복 처리 방지
- 현재 카드와 전체 장수 진행도
- 한 단계 되돌리기 및 같은 카드 재선택
- 시드 기반 결정적 덱 생성
- Hue, Lightness, Chroma의 최소 분포 통제
- 인접 유사색 및 극단 대비 조합 제한
- 제시된 12개 카드 전부와 좌·우 선택 저장
- 최종 결정과 실제 상호작용 이벤트 로그 분리
- 제시 순서대로 전체 색 흐름과 방향을 보여주는 종료 화면
- 원시 JSON 화면 확인 및 다운로드
- 같은 덱 다시 실행 및 새 덱 생성
- 현지 기록 날짜와 ISO 시각/시간대 분리

## 3. 구현되지 않은 기능

- 정식 음악 매핑, 임시 음 재생, 멜로디 엔진
- 감정·심리·색 취향 분석
- 과거 선택 기반 추천 또는 개인화
- 로그인, 계정, 서버, 클라우드
- 브라우저 새로고침 후 진행 중 세션 복구
- 자동 저장, 달력 아카이브, 공유
- PWA 설치, 오프라인 캐시
- 생성형 AI API
- 실제 사용자 대상 문구 A/B 테스트

## 4. 임시로 내린 결정

모든 항목은 `IMPLEMENTATION_ASSUMPTIONS.md`에 근거와 교체 위치를 기록했다.

1. OKLCH 기반 12개 Hue 층화, 4개 Lightness 밴드, 3개 Chroma 밴드
2. OKLab 거리 0.075와 Hue/Lightness 조합을 이용한 인접 제한
3. `interactionEvents` 로그 포함
4. 카드 결정에 덱 버전과 시드를 편의상 비정규화
5. 완료 JSON 다운로드만 제공하고 자동 영속 저장은 제외
6. 좌우 문구를 `지나가요` / `머물러요`로 사용

## 5. 명세와 다르게 구현한 부분

- 없음.
- 선택 시 간단한 음은 선택 기능이었으므로 구현하지 않았다. 정식 음악 의미로 오해되거나 선택을 유도하지 않도록 Work 01에서는 무음으로 유지했다.
- 카드별 `deckVersion`/`deckSeed`는 명세대로 포함하되, `deck` 객체를 기준값으로 두는 비정규화 구조로 명확히 했다.

## 6. 알려진 오류와 한계

- 진행 중 새로고침을 하면 세션이 복구되지 않는다.
- 스와이프 판정은 거리 60px 및 수평 우세 비율 1.2라는 임시 임계값을 사용한다.
- 덱 분포 규칙은 제품 연구로 확정된 값이 아니다.
- OKLCH에서 sRGB 영역 밖의 값은 채널 단위로 클램프한다. Work 02가 원색 좌표를 사용할 때는 기록된 OKLCH 값을 기준으로 해야 한다.
- Google Fonts가 차단된 환경에서는 시스템 글꼴로 대체된다. 기능에는 영향이 없다.
- 실제 iOS Safari/Android Chrome 물리 기기 테스트는 이 환경에서 수행하지 못했다.
- `interactionEvents`는 Work 01의 임시 확장 필드이며 Work 02 필수 입력 여부가 확정되지 않았다.

## 7. 테스트한 환경

- Node.js: 현재 Codex 런타임
- Vite: 6.4.3
- TypeScript: 5.8.x
- Vitest: 3.2.7, jsdom
- `npm test`: 2개 테스트 파일, 11개 테스트 통과
- 덱 검증: 500개 결정적 시드에서 카드 수·범위·ID·순서·인접 제한 통과
- 세션 검증: 모두 왼쪽, 모두 오른쪽, 교차, 되돌리기 후 재선택, 완료 전후 입력 방어 통과
- `npm run build`: TypeScript 검사 및 프로덕션 번들 생성 성공

## 8. 다음 작업자가 읽어야 할 파일

권장 순서:

1. `README.md`
2. `IMPLEMENTATION_ASSUMPTIONS.md`
3. `src/domain/types.ts`
4. `src/domain/session.ts`
5. `src/domain/deck.ts`
6. `src/domain/session.test.ts`
7. `src/domain/deck.test.ts`
8. `src/ui/App.tsx`

## 9. Work 02가 사용할 세션 데이터 형식

```ts
interface SessionExport {
  schemaVersion: 'work01-session-v1'
  sessionId: string
  localDate: string             // YYYY-MM-DD, 사용자 현지 날짜
  timeZone: string              // IANA 시간대
  createdAt: string             // ISO timestamp
  startedAt: string             // ISO timestamp
  completedAt: string           // ISO timestamp
  deck: {
    deckVersion: 'work01-oklch-v1'
    deckSeed: string
    cards: Array<{
      cardId: string
      presentedOrder: number    // 1..12
      hex: string
      hue: number               // OKLCH Hue, degree
      lightness: number         // OKLCH L, 0..1
      chroma: number            // OKLCH C
    }>
  }
  decisions: Array<{
    cardId: string
    presentedOrder: number
    hex: string
    hue: number
    lightness: number
    chroma: number
    direction: 'left' | 'right'
    deckVersion: 'work01-oklch-v1' // 비정규화, deck과 일치 검증됨
    deckSeed: string                // 비정규화, deck과 일치 검증됨
  }>
  interactionEvents: Array<
    | { sequence: number; type: 'session_started'; occurredAt: string }
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
    | { sequence: number; type: 'session_completed'; occurredAt: string }
  >
}
```

Work 02는 기본적으로 `deck.cards`와 최종 `decisions`를 `presentedOrder` 기준으로 함께 소비하면 된다. `interactionEvents`는 되돌리기를 포함한 사용성 연구용 원시 로그이며, 멜로디 입력의 기본값은 아니다.

무결성 조건:

- `deck.cards.length === decisions.length === 12`
- 같은 인덱스의 `cardId`와 `presentedOrder`가 일치
- 모든 `cardId`가 유일
- 각 decision의 `deckVersion`/`deckSeed`가 `deck` 기준값과 일치
- 되돌려 취소된 선택은 `decisions`에 없고 `interactionEvents`에만 존재

## 10. 다음 작업의 권장 시작점

1. Work 02는 `SessionExport`를 변경하지 말고 입력 어댑터부터 작성한다.
2. 멜로디 해석 입력에는 최종 `decisions` 전체 12개를 사용한다.
3. 왼쪽 선택을 부정적 음으로 해석하지 않는다.
4. 해석 결과와 음표 생성을 별도 순수 함수 및 별도 버전으로 둔다.
5. 동일 세션 JSON과 알고리즘 버전/시드에서 동일한 결과가 나오는 테스트를 먼저 작성한다.
6. `interactionEvents` 사용 여부는 제품 결정으로 확정하지 말고 실험 분석 경로로 분리한다.
