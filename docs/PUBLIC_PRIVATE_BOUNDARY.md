# Public / Private Boundary

## 목적

하루한음은 공개 가능한 재현성 기반과 비공개 경쟁력·사용자 연구를 분리합니다. 공개 저장소를 나중에 private로 바꾸는 방식은 이미 공개된 commit과 clone을 회수하지 못하므로, 처음부터 경계를 명시합니다.

## 공개 저장소에 유지하는 것

- Work 01 색상 덱·세션 계약
- synthetic regression fixture
- Work 02 input adapter와 versioned contracts
- Absolute / Relative / Hybrid Hue baseline
- baseline melody generator와 audio schedule/player
- 개발용 비교 Lab
- 결정성·범위·provenance·수명주기 테스트
- 제품이 진단 도구가 아니라는 공개 정책

## 비공개 엔진 저장소로 이동하는 것

- 잠재 음악 상태 추정 policy
- 개인화와 사용자별 calibration
- production Hue·Lightness·Chroma mapping
- 사용자 연구 응답과 평가 결과
- blind experiment assignment와 분석 코드
- production generator parameter 및 release candidate
- 실제 사용자 데이터 처리·보존 정책

## 입력 경계

비공개 엔진은 raw `SessionExport` 전체를 요구하지 않습니다. 공개 adapter가 다음 최소 입력만 전달하도록 설계합니다.

```ts
interface EngineSelection {
  presentedOrder: number
  color: { hue: number; lightness: number; chroma: number }
  direction: 'left' | 'right'
}
```

이름, 이메일, 계정 ID, 실제 timestamp, time zone, 원본 파일명 및 interaction history는 명시적 실험 승인이 없는 한 엔진 입력에 포함하지 않습니다.

## 출력 경계

비공개 엔진 출력은 심리 진단이 아니라 음악 생성용 수치 벡터와 plan입니다.

- 허용: brightness, activity, continuity, tension, sustain, uncertainty
- 금지: 우울·불안·성격·질환·위험도 등의 사용자 판정 label

제품은 사용자에게 수치 프로필을 기본 노출하지 않고, "고른 색들이 오늘의 멜로디가 되었다"는 경험을 제공합니다.

## 버전 규칙

공개 input contract, private policy, music plan과 production generator를 각각 독립 버전으로 기록합니다. 같은 입력·같은 버전은 같은 출력을 생성해야 합니다.
