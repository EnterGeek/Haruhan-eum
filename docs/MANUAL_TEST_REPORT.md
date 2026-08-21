# Public Baseline Verification Record

## 범위

이 문서는 과거 개인 세션 ID와 실제 timestamp를 포함했던 수동 보고서를 대체하는 공개용 검증 기록입니다. 현재 repository의 회귀 증거는 `docs/golden-sessions/representative-sessions.json`의 synthetic fixtures와 자동 테스트를 기준으로 합니다.

## 보존된 시나리오

| Fixture | 검증 의도 |
|---|---|
| `same-deck-baseline` | 동일 덱·기준 방향 흐름 |
| `all-left-fast-buttons` | 왼쪽 12회와 빠른 버튼 입력 |
| `all-right-same-deck-replay` | 같은 덱에서 오른쪽 12회 |
| `undo-and-reselect` | 3회 undo 후 반대 방향 재선택 |
| `swipe-only` | swipe 입력만 사용 |
| `mixed-button-and-swipe` | 두 입력 경로 혼합 |
| `pause-and-resume` | 긴 합성 완료 간격에서도 순서 유지 |

## 자동 검증

- 같은 seed 결정성
- 카드 ID와 제시 순서
- 500개 seed 기본 분포 검증
- nightly 10,000개 seed stress 검증
- 모두 왼쪽·모두 오른쪽·혼합 방향
- undo 후 최종 결정과 event history 분리
- Work 02 adapter·interpretation·generator·audio schedule 계약
- React StrictMode에서 Lab audio player lifecycle
- production build의 세 HTML entry 생성

## 제한

자동 검사는 실제 물리 기기의 시각·청각 품질과 사용자 경험을 증명하지 않습니다. iOS Safari·Android Chrome, 모바일 스피커·이어폰 및 접근성 설정은 별도의 QA가 필요합니다.

이 기록은 심리적 타당성 보고서가 아닙니다. 색 선택과 음악 간의 제품 의미는 독립된 실험 절차를 거쳐야 합니다.
