# 하루한음 — Work 01

오늘을 잠깐 떠올린 뒤 12개의 색에 좌우로 반응하고, 제시된 전체 덱과 선택 흐름을 재현 가능한 JSON으로 남기는 모바일 우선 웹 프로토타입이다.

## 실행

```bash
npm install
npm run dev
```

자동 검증:

```bash
npm test
npm run build
```

## 핵심 구조

- `src/domain/deck.ts`: 결정적 색상 덱 생성과 검증
- `src/domain/session.ts`: 시작, 선택, 되돌리기, 완료, 내보내기 상태 전이
- `src/domain/types.ts`: Work 02 전달 데이터 계약
- `src/ui/App.tsx`: 모바일 UI와 단일 입력 커밋 경로
- `IMPLEMENTATION_ASSUMPTIONS.md`: 제품 결정이 아닌 임시 구현값
- `WORK_01_HANDOFF.md`: 다음 작업 인수인계

동일한 `deckVersion`과 `deckSeed`는 동일한 카드 값과 순서를 만든다. 덱 생성 경로는 `Math.random()`, 현재 시각, 로케일에 의존하지 않는다.
