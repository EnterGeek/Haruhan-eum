# Security Policy

## Supported scope

현재 지원 대상은 `main`의 공개 baseline과 GitHub Actions 설정입니다. 실험 branch는 연구 중인 코드이며 production 보안 보장을 제공하지 않습니다.

## Reporting

보안 취약점, 비밀정보 노출 또는 사용자 데이터가 repository에 포함된 사실을 발견했다면 공개 issue에 원문을 붙이지 마세요.

가능하면 GitHub의 **Security → Report a vulnerability** 기능으로 비공개 신고하세요. 해당 기능을 사용할 수 없다면 민감한 세부정보 없이 최소한의 issue를 열어 maintainer가 비공개 채널을 마련하도록 요청하세요.

## Data rule

- 실제 사용자 세션·연구 응답·추론 결과를 commit하지 않습니다.
- API key, signing key, token, 인증서 및 `.env` 파일을 commit하지 않습니다.
- Actions workflow는 기본적으로 `contents: read` 권한만 사용합니다.
