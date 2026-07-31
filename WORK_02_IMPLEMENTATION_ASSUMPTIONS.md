# Work 02 — Implementation Assumptions

작성일: 2026-07-31

## 현재 임시 구현 가정

1. `Work02InputItem.index`는 배열의 0 기반 위치가 아니라 Work 01의
   `presentedOrder`를 그대로 보존하는 `1..12` 값으로 사용한다. 후속 해석 계층이
   0 기반 위치를 원하면 별도 지역 계산을 사용하고, 입력 계약의 의미는 바꾸지 않는다.

이번 입력 검증·어댑터 단계에서 위 인덱스 표현 외의 새로운 음악 규칙이나 제품 의미를
임시로 확정하지 않았다.

다음 항목은 임시 가정이 아니라 동결된 Work 01 계약을 그대로 적용한 검증 경계다.

- OKLCH Hue는 `0 <= hue < 360`, Lightness는 `0 <= lightness <= 1`,
  Chroma는 `chroma >= 0`인 유한수여야 한다.
- HEX는 `#RRGGBB` 형식이어야 하며, 카드와 결정 사이에서는 문자열까지 동일해야 한다.
- 카드 ID는 `work01-oklch-v1:<deckSeed>:<01..12>` 형식과 출처가 일치해야 한다.
- 실제 `SessionExport`의 이벤트 로그도 Work 01 계약 형상으로 검증하지만,
  `Work02Input`에는 복사하지 않는다.
- 골든 세션은 실제 `SessionExport`가 아니므로 전용 helper가 압축 형식을 직접
  `Work02Input`으로 복원한다.

음악 해석, A/B/C 매핑, 음계, 리듬, 음색, `variationSeed`에 관한 임시 결정은
후속 단계에서 별도로 기록해야 한다.
