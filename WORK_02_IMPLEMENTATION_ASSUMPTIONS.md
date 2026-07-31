# Work 02 — Implementation Assumptions

작성일: 2026-07-31

## 현재 임시 구현 가정

TEMPORARY IMPLEMENTATION ASSUMPTION
- 결정 내용: `Work02InputItem.index`는 배열의 0 기반 위치가 아니라 Work 01의
  `presentedOrder`를 그대로 보존하는 `1..12` 값으로 사용한다.
- 필요한 이유: Work 01 제시 순서의 의미를 Work 02 입력 경계에서 손실 없이 보존해야 한다.
- 영향을 받는 파일과 함수: `src/work02/types.ts`, `adaptSessionExport()`,
  `expandGoldenCase()`, `extractCommonFlowFeatures()`.
- 향후 대체되어야 하는 제품 결정: Work 02 공개 계약에서 필드명을
  `presentedOrder`로 변경할지 여부.

TEMPORARY IMPLEMENTATION ASSUMPTION
- 결정 내용: 정확히 `180°`인 signed shortest delta는 항상 `+180`이며
  `clockwise`로 분류한다.
- 필요한 이유: 두 방향의 거리가 같은 antipodal Hue 쌍에 결정적인 결과가 필요하다.
- 영향을 받는 파일과 함수: `src/work02/hue.ts`의 `signedHueDelta()`와
  `hueRotationDirection()`, 그리고 모든 후속 해석기.
- 향후 대체되어야 하는 제품 결정: antipodal 이동을 이전 문맥으로 해소할지,
  별도 방향으로 표현할지, 고정 방향을 유지할지.

TEMPORARY IMPLEMENTATION ASSUMPTION
- 결정 내용: 프레이즈 경계와 register contour는 공통 계약에 후보 타입과 빈 배열만
  제공하고, 공통 특징 추출에서는 후보를 생성하지 않는다.
- 필요한 이유: 현재 확정된 중립적 입력 특징만으로는 음악적 임계값 없이 후보를
  산출할 제품 규칙이 없다.
- 영향을 받는 파일과 함수: `src/work02/interpretation/types.ts`,
  `extractCommonFlowFeatures()`.
- 향후 대체되어야 하는 제품 결정: A/B/C 비교에서 공유할 후보 생성 규칙과 임계값.

이번 단계에서도 Hue·선택 방향·색 좌표에 감정 또는 음악적 의미를 부여하지 않았다.

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
