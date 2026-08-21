# Work 01 — Public Baseline Handoff

## 상태

Work 01은 하루한음의 공개 입력·세션 기준선입니다. 12개의 결정적 OKLCH 색상 카드를 제시하고, 사용자의 좌우 반응과 되돌리기 이력을 재현 가능한 JSON으로 보존합니다.

이 문서는 공개 저장소용으로 정리됐습니다. 과거 실제 조작에서 만들어진 식별자·timestamp·파일명은 현재 fixture에서 제거했으며, 회귀 검사는 synthetic data를 사용합니다.

## 핵심 계약

- `work01-session-v1`
- `work01-oklch-v1`
- 정확히 12개 카드와 12개 최종 결정
- `presentedOrder` 1..12 유지
- 동일 `deckVersion` + `deckSeed`는 동일한 색 값과 순서 생성
- 취소 선택은 최종 `decisions`가 아니라 `interactionEvents`에만 보존
- 좌우는 긍정·부정 또는 감정 label이 아님

## 주요 파일

- `src/domain/deck.ts`: 결정적 색상 덱 생성·검증
- `src/domain/session.ts`: 시작·선택·되돌리기·완료 상태 전이
- `src/domain/types.ts`: 공개 세션 계약
- `src/ui/App.tsx`: 모바일 우선 프로토타입
- `docs/SESSION_DATA_CONTRACT.md`: 데이터 형식
- `docs/golden-sessions/representative-sessions.json`: synthetic regression fixtures

## Work 02 전달 원칙

Work 02는 raw 이벤트 전체가 아니라 최종 12개 결정과 원본 OKLCH 좌표를 기본 입력으로 사용합니다. interaction timing, input method, undo history는 별도 실험에서 명시적으로 승인되기 전까지 음악 의미로 해석하지 않습니다.

## 비진단 경계

Work 01은 감정·성격·정신건강 분석을 수행하지 않습니다. 향후 엔진이 음악 생성용 잠재 신호를 사용하더라도 사용자에게 심리 판정으로 제시하지 않습니다.

## 검증

```bash
npm test
npm run build
```

CI는 Node 22와 24에서 테스트·빌드를 재현하고, nightly workflow가 10,000개 seed에 대한 덱 검증을 실행합니다.
