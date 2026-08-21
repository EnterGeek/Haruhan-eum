# Synthetic Golden Sessions

`representative-sessions.json`은 공개 저장소의 결정적 회귀를 위한 합성 fixture collection입니다.

## 포함하는 것

- 고정된 12개 OKLCH 색 좌표
- 좌우 방향 패턴
- button / swipe 패턴
- undo·reselection edge case
- 빠른 완료·일시 중단과 유사한 합성 시간 간격

## 포함하지 않는 것

- 실제 사용자 session ID
- 실제 날짜·시간·time zone
- 실제 원본 다운로드 파일명
- 이름·계정·기기 식별자
- 개인 심리 또는 연구 응답

fixture ID는 테스트 계약이므로 안정적으로 유지합니다. 데이터 변경 시 해당 변경이 어떤 회귀 의도를 갖는지 PR에 기록해야 합니다.
