# Google Cloud Functions

Content Factory 서비스의 Google Cloud Functions 코드입니다.

## 배포
- GitHub 푸시 시 Cloud Build 자동 실행
- cloudbuild.yaml 기반 배포
- asia-northeast3 리전

## 구조
- index.js: 메인 진입점
- modules/: 기능별 모듈 (10개)
- package.json: 의존성 관리
