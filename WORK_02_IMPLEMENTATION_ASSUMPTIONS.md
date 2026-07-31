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

TEMPORARY IMPLEMENTATION ASSUMPTION
- 결정 내용: 상대 Hue 해석의 첫 항목은 이전 카드가 없으므로 정규화 위치 `0.5`를
  사용한다.
- 필요한 이유: 12개 입력 모두에 contour 후보를 제공하면서 첫 항목에 방향을
  임의 부여하지 않는 중립 기준이 필요하다.
- 영향을 받는 파일과 함수: `src/work02/interpretation/contour.ts`의
  `RELATIVE_HUE_NEUTRAL_POSITION`, `calculateRelativeHuePositions()`.
- 향후 대체되어야 하는 제품 결정: 첫 항목을 중립점으로 유지할지 또는 별도
  시작 문법을 적용할지.

TEMPORARY IMPLEMENTATION ASSUMPTION
- 결정 내용: 상대 Hue 변화는 `0.5 + signedHueDelta / 360`으로 정규화한다.
- 필요한 이유: `-180..+180`의 원형 이동을 방향 없는 중립점 `0.5`를 중심으로
  `[0, 1]` contour에 보존해야 한다.
- 영향을 받는 파일과 함수: `src/work02/interpretation/contour.ts`의
  `calculateRelativeHuePositions()`, `src/work02/interpretation/relative.ts`.
- 향후 대체되어야 하는 제품 결정: 상대 Hue 변화가 후속 음악 문법에서 어떤 역할을
  가져야 하는지.

TEMPORARY IMPLEMENTATION ASSUMPTION
- 결정 내용: 혼합형은 absolute `0.5` / relative `0.5`의 고정 가중치를 사용한다.
- 필요한 이유: 두 Hue 해석을 외부 설정 없이 동일 비중으로 비교하는 현재 실험
  계약을 구현해야 한다.
- 영향을 받는 파일과 함수: `src/work02/interpretation/contour.ts`의
  `HYBRID_ABSOLUTE_WEIGHT`, `HYBRID_RELATIVE_WEIGHT`,
  `calculateHybridHuePositions()`, `src/work02/interpretation/hybrid.ts`.
- 향후 대체되어야 하는 제품 결정: 혼합 비율을 유지할지와 조정 가능성.

TEMPORARY IMPLEMENTATION ASSUMPTION
- 결정 내용: 선택 방향은 Hue contour 수식에 직접 합성하지 않고 공통 특징의
  `selectionDirection`, run, turn, summary, 방향별 위치에만 보존한다.
- 필요한 이유: A/B/C 사이에서 Hue 매핑 방식만 격리해 비교하고 다음 음악 문법이
  동일한 방향 규칙을 적용할 수 있어야 한다.
- 영향을 받는 파일과 함수: `extractCommonFlowFeatures()`,
  `calculateAbsoluteHuePositions()`, `calculateRelativeHuePositions()`,
  `calculateHybridHuePositions()`.
- 향후 대체되어야 하는 제품 결정: 공통 음악 문법에서 방향 정보를 사용하는 방식.

TEMPORARY IMPLEMENTATION ASSUMPTION
- 결정 내용: Lightness와 Chroma는 A/B/C Hue contour 계산에 사용하지 않고
  항목별 공통 특징에 원본 수치로만 보존한다.
- 필요한 이유: 두 좌표의 음악적 역할이 아직 제품 결정이 아니며 자의적인 감정·음량·
  음색·음역 의미를 부여하면 안 된다.
- 영향을 받는 파일과 함수: `extractCommonFlowFeatures()`와
  `src/work02/interpretation/contour.ts`의 세 계산 함수.
- 향후 대체되어야 하는 제품 결정: Lightness와 Chroma의 공통 음악적 역할.

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

음계, 리듬, 음색, `variationSeed`에 관한 임시 결정은 후속 단계에서 별도로
기록해야 한다.

## 공통 음악 계약의 임시 구현 가정

아래 값은 제품 결정이 아니라 후속 generator의 자의적 선택을 막기 위한 현재
계약 기준이다.

TEMPORARY IMPLEMENTATION ASSUMPTION
- 결정 내용: 음계는 major pentatonic이며 기준음 대비 반음 오프셋
  `[0, 2, 4, 7, 9]`를 명시적으로 사용한다.
- 필요한 이유: 모든 해석 방식이 같은 음 집합을 사용하는 validator 경계가 필요하다.
- 영향을 받는 파일과 함수: `src/work02/music/grammar.ts`의
  `DEFAULT_MUSIC_GRAMMAR`, `validateMusicGrammar()`, `validateMelodyOutput()`.
- 향후 대체되어야 하는 제품 결정: 제품의 공통 음계와 음계 명칭.

TEMPORARY IMPLEMENTATION ASSUMPTION
- 결정 내용: tonic은 MIDI 60이며 허용 음역은 MIDI `60..76`이다.
- 필요한 이유: 음계 포함 여부와 출력 음역을 공통으로 검증할 수 있어야 한다.
- 영향을 받는 파일과 함수: `DEFAULT_MUSIC_GRAMMAR`,
  `validateMusicGrammar()`, `validateMelodyOutput()`.
- 향후 대체되어야 하는 제품 결정: 기준음과 최종 사용 음역.

TEMPORARY IMPLEMENTATION ASSUMPTION
- 결정 내용: tempo는 80 BPM이고 전체 길이는 12 beats이다.
- 필요한 이유: 방식별로 달라질 수 없는 시간축과 정확한 종료 경계를 고정해야 한다.
- 영향을 받는 파일과 함수: `DEFAULT_MUSIC_GRAMMAR`, `secondsPerBeat()`,
  `beatsToSeconds()`, 두 validator.
- 향후 대체되어야 하는 제품 결정: 최종 템포와 전체 박자 수.

TEMPORARY IMPLEMENTATION ASSUMPTION
- 결정 내용: 허용 duration은 beat 단위 `[0.5, 1, 1.5, 2]`이다.
- 필요한 이유: 향후 generator 출력의 리듬 단위를 공통 validator가 판정해야 한다.
- 영향을 받는 파일과 함수: `DEFAULT_MUSIC_GRAMMAR`,
  `validateMusicGrammar()`, `validateMelodyOutput()`.
- 향후 대체되어야 하는 제품 결정: 공통 리듬 어휘와 세분도.

TEMPORARY IMPLEMENTATION ASSUMPTION
- 결정 내용: 인접 note 사이 최대 도약은 7 semitones이며 중간 rest가 있어도
  앞뒤 note 사이에 동일하게 적용한다.
- 필요한 이유: generator 방식과 무관한 출력 안전 경계를 먼저 고정해야 한다.
- 영향을 받는 파일과 함수: `DEFAULT_MUSIC_GRAMMAR`,
  `validateMusicGrammar()`, `validateMelodyOutput()`.
- 향후 대체되어야 하는 제품 결정: 허용 최대 도약과 rest 전후 적용 여부.

TEMPORARY IMPLEMENTATION ASSUMPTION
- 결정 내용: 목표 재생 시간은 `8..15초`이며 BPM과 beats에서 계산한다.
- 필요한 이유: 임의 저장 문자열 없이 실제 음악 시간축이 제품 범위에 드는지
  판정해야 한다.
- 영향을 받는 파일과 함수: `DEFAULT_MUSIC_GRAMMAR`, `beatsToSeconds()`,
  `validateMusicGrammar()`, `validateMelodyOutput()`.
- 향후 대체되어야 하는 제품 결정: 허용 재생 시간 범위.

TEMPORARY IMPLEMENTATION ASSUMPTION
- 결정 내용: 무음은 timeline gap이 아니라 명시적인 `rest` 이벤트로 표현한다.
- 필요한 이유: 출력의 전체 12 beats를 손실 없이 검사하고 숨겨진 공백을
  구분해야 한다.
- 영향을 받는 파일과 함수: `src/work02/music/types.ts`의
  `MelodyRestEvent`, `validateMelodyOutput()`.
- 향후 대체되어야 하는 제품 결정: rest 허용 여부와 무음 표현 계약.

TEMPORARY IMPLEMENTATION ASSUMPTION
- 결정 내용: Work 01의 `presentedOrder 1..12`는 출력 전체 provenance에서
  각각 적어도 한 번 추적 가능해야 한다.
- 필요한 이유: 모든 선택 입력이 결과와 인과적으로 연결됐는지 최소 수준에서
  검증할 수 있어야 한다.
- 영향을 받는 파일과 함수: `MelodyEventSource`, `validateMelodyOutput()`.
- 향후 대체되어야 하는 제품 결정: 각 입력의 영향 강도 및 중복 provenance 허용 규칙.

## baseline melody generator의 임시 구현 가정

TEMPORARY IMPLEMENTATION ASSUMPTION
- 결정 내용: 허용 음역의 실제 scale note 목록을 낮은 MIDI부터 구성하고,
  contour `p`를 `floor(p × (N - 1) + 0.5)` 인덱스로 양자화한다. 정확한
  절반 tie는 높은 인덱스를 선택한다.
- 필요한 이유: 연속 contour를 결정적인 단일 목표 음으로 변환하는 최소 규칙이
  필요하다.
- 영향을 받는 파일과 함수: `src/work02/music/generator.ts`의
  `buildScaleNotes()`, `quantizeContourIndex()`, `generateMelody()`.
- 향후 대체되어야 하는 제품 결정: contour 양자화 방식과 경계 tie-break.

`quantizeContourIndex(normalizedPosition, scaleNoteCount)`는 MIDI note가 아니라
`0..scaleNoteCount - 1` 범위의 scale index를 반환한다. MIDI 선택은
`generateMelody()`가 해당 index로 `buildScaleNotes()` 결과를 조회하는 별도 단계다.

TEMPORARY IMPLEMENTATION ASSUMPTION
- 결정 내용: 목표 음이 이전 note에서 최대 7 semitones를 넘으면 허용 범위의
  scale note를 다음 순서로 선택한다: 목표 MIDI와의 거리, 이전 note와의 거리,
  MIDI 오름차순. 즉 목표 거리 동률이면 이전 note에 가까운 후보가 먼저이며,
  두 거리까지 같을 때만 낮은 MIDI를 선택한다.
- 필요한 이유: contour 목표를 최대한 보존하면서 공통 leap 계약을 항상 만족해야
  한다.
- 영향을 받는 파일과 함수: `selectLeapLimitedNote()`, `generateMelody()`.
- 향후 대체되어야 하는 제품 결정: 도약 제한 시 음 선택 우선순위와 tie-break.

TEMPORARY IMPLEMENTATION ASSUMPTION
- 결정 내용: 12개 입력 각각은 시작 beat `presentedOrder - 1`인 1-beat time
  cell 하나에 대응한다. `right`는 1-beat note, `left`는 0.5-beat note 뒤
  0.5-beat explicit rest를 생성한다.
- 필요한 이유: 방향을 감정이나 음고로 해석하지 않으면서도 손실 없이 보존되는
  최소 articulation이 필요하다.
- 영향을 받는 파일과 함수: `generateMelody()`, `validateMelodyOutput()`.
- 향후 대체되어야 하는 제품 결정: 방향별 articulation과 time-cell 리듬.

TEMPORARY IMPLEMENTATION ASSUMPTION
- 결정 내용: baseline generator는 난수와 `variationSeed` 없이 하나의
  `FlowInterpretation`에서 항상 같은 `MelodyOutput`을 생성하며, generator
  버전은 `work02-melody-generator-v0`이다.
- 필요한 이유: A/B/C contour 차이만 비교 가능한 재현 가능한 기준 출력이
  필요하다.
- 영향을 받는 파일과 함수: `src/work02/versions.ts`,
  `generateMelody()`, `validateMelodyOutput()`.
- 향후 대체되어야 하는 제품 결정: 향후 변형 생성의 버전·seed 계약.

TEMPORARY IMPLEMENTATION ASSUMPTION
- 결정 내용: 합성 Hue edge-case의 21개 MIDI literal 배열은 최종 음악 제품의 정답이 아니라
  `work02-melody-generator-v0`의 결정적 회귀 기준이다. 실제 Work 01 fixture는
  별도 pipeline 회귀로 검증한다. 음계, 양자화,
  도약 선택, articulation 같은 임시 음악 규칙이 달라지면 먼저 generator
  버전을 변경하고 새 회귀 기준을 의도적으로 승인한다. 같은 버전에서 기대 배열만
  덮어쓰지 않는다.
- 필요한 이유: 골든 배열 검증은 A/B/C 공통 문법, 12 beats·9초, provenance,
  articulation, 최대 도약의 독립적인 수학적 계약 검증을 대체하지 않아야 한다.
- 영향을 받는 파일과 함수: `src/work02/music/generator.test.ts`,
  `generateMelody()`, `validateMelodyOutput()`.
- 향후 대체되어야 하는 제품 결정: 제품 음악 규칙 승인 절차와 generator 버전 정책.

TEMPORARY IMPLEMENTATION ASSUMPTION
- 결정 내용: 실제 Work 01 golden fixture 회귀는 fixture의 7개 case ID
  (`same-deck-baseline`, `all-left-fast-buttons`, `all-right-same-deck-replay`,
  `undo-and-reselect`, `swipe-only`, `mixed-button-and-swipe`,
  `pause-and-resume`)를 `cases`에서 읽어
  `expandGoldenCase() → interpretFlow() → generateMelody() → validateMelodyOutput()`으로
  A/B/C 각각에 통과시킨다. 이는 `work02-melody-generator-v0`의 회귀 기준이며,
  합성 Hue 입력은 수학적 edge-case 검증으로만 별도 유지한다.
- 필요한 이유: 합성 입력을 실제 Work 01 사용자 세션 회귀라고 잘못 표기하지 않고,
  provenance와 방향을 포함한 실제 fixture 경계를 독립적으로 보존해야 한다.
- 영향을 받는 파일과 함수: `docs/golden-sessions/representative-sessions.json`,
  `src/work02/golden/expandGoldenCase.ts`, `src/work02/music/generator.test.ts`.
- 향후 대체되어야 하는 제품 결정: 대표 golden fixture의 승인된 case 구성과 수.

TEMPORARY IMPLEMENTATION ASSUMPTION
- 결정 내용: melody generator 입력 validator는 각 contour candidate의 `source`가
  정확히 `${method}@${interpreter}`와 같을 때만 수용한다.
- 필요한 이유: 다른 해석 방식 또는 다른 interpreter version의 contour가 현재 method의
  것으로 잘못 재사용되는 것을 방지해야 한다.
- 영향을 받는 파일과 함수: `validateFlowInterpretationForMelody()`.
- 향후 대체되어야 하는 제품 결정: candidate provenance가 복합 source를 허용할지 여부.
