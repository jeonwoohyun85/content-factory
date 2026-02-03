# Google Cloud Functions

Content Factory 서비스의 Google Cloud Functions 코드입니다.

## 배포
- GitHub 푸시 시 Cloud Build 자동 트리거
- cloudbuild.yaml 기반 배포
- asia-northeast3 리전

## 구조
- index.js: 메인 진입점
- modules/: 기능별 모듈 (10개)
- package.json: 의존성 관리

## 자동 배포
Cloud Build 트리거가 functions/ 디렉토리 변경을 감지하여 자동 배포합니다.
