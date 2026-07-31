# Work 01 — Temporary Implementation Assumptions

아래 항목은 제품 결정이 아니라 Work 01 검증을 위한 임시 구현값이다.

## A-01 — 색공간과 분포

**TEMPORARY IMPLEMENTATION ASSUMPTION**

- 항목: 색 생성 색공간
- 임시값: OKLCH. Hue 12개 층화 구간, Lightness 4개 밴드, Chroma 3개 밴드를 사용한다.
- 선택 이유: 지각적으로 비교 가능한 축을 직접 기록하면서 완전 무작위 RGB 편중을 피할 수 있다.
- 교체 위치: `src/domain/deck.ts`, `src/domain/color.ts`

## A-02 — 인접 제한

**TEMPORARY IMPLEMENTATION ASSUMPTION**

- 항목: 거의 동일한 색과 극단 대비의 인접 판정
- 임시값: OKLab 유클리드 거리 0.075 미만을 인접 후보에서 강하게 회피한다. Hue 거리 155도 초과이며 Lightness 차이 0.12 초과인 조합도 회피한다.
- 선택 이유: 연속 편향만 제한하고 음악적 색 진행은 만들지 않기 위한 최소 규칙이다.
- 교체 위치: `src/domain/deck.ts`

## A-03 — 상호작용 이벤트 로그

**TEMPORARY IMPLEMENTATION ASSUMPTION**

- 항목: 최종 결정 외 실제 반응 흐름 보존
- 임시값: `interactionEvents`에 시작, 선택, 되돌리기, 재선택, 완료를 순서대로 기록한다. 되돌린 선택은 최종 `decisions`에서는 제거한다.
- 선택 이유: Work 02가 최종 결과를 바로 소비하면서도 실험 분석에서 실제 상호작용을 잃지 않게 한다.
- 교체 위치: `src/domain/types.ts`, `src/domain/session.ts`

## A-04 — 카드별 덱 정보 비정규화

**TEMPORARY IMPLEMENTATION ASSUMPTION**

- 항목: `deckVersion`, `deckSeed` 중복
- 임시값: 기준값은 `deck` 객체에 두며, Work 02 전달 편의를 위해 각 `decision`에도 복제한다. 내보내기 전에 일치성을 검증한다.
- 선택 이유: 카드 단위 파이프라인에서도 출처를 잃지 않게 한다.
- 교체 위치: `src/domain/session.ts`, `src/domain/types.ts`

## A-05 — 저장과 세션 복구

**TEMPORARY IMPLEMENTATION ASSUMPTION**

- 항목: 브라우저 영속 저장
- 임시값: 완료 JSON은 화면 확인과 다운로드만 제공한다. 새로고침 복구와 자동 저장은 포함하지 않는다.
- 선택 이유: 서버·아카이브 없는 최소 프로토타입 범위를 유지한다.
- 교체 위치: 후속 Work의 저장 계층

## A-06 — 좌우 문구

**TEMPORARY IMPLEMENTATION ASSUMPTION**

- 항목: 선택 방향 표현
- 임시값: `머물러요` / `지나가요`
- 선택 이유: 좋음/싫음 평가를 피하면서 현재 제품 문서 후보 중 의미가 가장 직접적이다.
- 교체 위치: `src/ui/App.tsx`
