# Content Factory 프로젝트



## 🏗️ 완전 Google Cloud 아키텍처 (전환 목표)

### 중심: 모든 것이 Google Cloud

**핵심 원칙**: 95% Google Cloud + 5% GitHub (저장소만)

### 아키텍처 구성

**1. 코드 저장소 (GitHub - 최소 사용)**
- 역할: Git 저장소로만 사용 (코드 보관)
- Cloud Build 푸시 트리거 (감지 용도)
- GitHub 기능 5%만 사용 (저장소 + 버전 관리)
- 나머지 95%는 Google Cloud

**2. 빌드/배포 (Cloud Build)**
- GitHub 연동: 푸시 자동 감지
- Secret Manager 연동: API 키 자동 주입
- 배포 대상: Cloud Functions, Firebase Hosting

**3. 실행 환경**
- Cloud Functions: Worker 로직 (포스팅, API)
- Cloud Scheduler: 크론 (매일 00:01 KST)

**4. 데이터 저장**
- Google Sheets: 거래처 DB (기존 유지)
- Google Drive: 사진 저장 (기존 유지)
- Firestore: KV 대체 (락, 캐시, 상태)

**5. 보안/관리**
- Secret Manager: 모든 API 키 (Gemini, Telegram 등)
- IAM: 권한 관리
- Cloud Logging: 로그 중앙화

**6. 모니터링**
- Cloud Monitoring: 내부 감시 (Functions, Scheduler, Firestore)
- Error Reporting: 에러 자동 수집
- Telegram: 실시간 알림 (Cloud Function → Pub/Sub)

**7. 프론트엔드**
- Firebase Hosting: 랜딩페이지 (make-page.com)
- Cloud CDN: 글로벌 배포

### 배포 흐름

```
개발자 코드 푸시 (GitHub - 저장만)
        ↓
Cloud Build 자동 감지
        ↓
Secret Manager에서 API 키 가져옴
        ↓
Cloud Functions 배포 / Firebase Hosting 배포
        ↓
Cloud Monitoring 알림
```

### GitHub 최소 사용 (5%)

**GitHub 사용 범위:**
- ✅ Git 저장소 (코드 보관)
- ✅ 버전 관리 (commit, push, pull)
- ✅ Cloud Build 트리거 (푸시 감지)

**GitHub 폐기:**
- ❌ GitHub Actions → Cloud Build
- ❌ GitHub Secrets → Secret Manager
- ❌ GitHub Pages → Firebase Hosting
- ❌ Workflows, Issues, Projects 등

**비율:**
- GitHub: 5% (저장소만)
- Google Cloud: 95% (빌드, 배포, 실행, 모니터링)

**전환 이유:**
- Cloud Source Repositories 사용 불가 (계정 제한)
- GitHub를 "파일 업로드 장소"로만 활용
- 모든 로직/배포/관리는 Google Cloud

### 완전 Google Cloud 장점

1. **통합 생태계**: 모든 서비스가 Google Cloud 내부
2. **내부 통신**: 빠른 속도 (외부 API 호출 불필요)
3. **통합 모니터링**: Cloud Monitoring 한 곳에서 전체 감시
4. **통합 로그**: Cloud Logging 한 곳에서 확인
5. **IAM 통합**: 권한 관리 단순화
6. **비용 최적화**: 내부 통신 무료


## 🗺️ Google Cloud 전환 로드맵

### Phase 1: Cloud Functions 전환 ✅ 100%

**목표:** Cloudflare Workers → Cloud Functions 완전 이전

**완료:**
- ✅ functions/ 폴더 구조 생성
- ✅ Firestore 연동 (KV 대체)
- ✅ Secret Manager 연동 (GEMINI_API_KEY, TELEGRAM_BOT_TOKEN 등)
- ✅ Cloud Build 자동 배포 설정 (cloudbuild.yaml)
- ✅ Cloud Scheduler 크론 (매일 00:01 KST)
- ✅ 기본 엔드포인트 구현
  - /cron-trigger (전체 거래처 포스팅)
  - /test-posting (단일 테스트)
  - /refresh (캐시 삭제)
  - /{subdomain} (거래처 페이지)
- ✅ Cloudflare Workers 완전 폐기 (workers/ 폴더 삭제)
- ✅ deploy-workers.yml 워크플로우 제거
- ✅ Cloudflare 의존성 완전 제거

**완료일:** 2026-02-04

---

### Phase 2: 도메인 및 라우팅 통합 ✅ 100%

**목표:** Cloudflare → Google Cloud 완전 이전 (Cloud Run + Global Load Balancing + Certificate Manager)

**완료:**

**1. Cloud Run 배포**
- ✅ 서비스명: content-factory
- ✅ 리전: asia-northeast3
- ✅ URL: https://content-factory-wdbgrmxlaa-du.a.run.app
- ✅ 상태: 정상 작동 (STATUS: True)

**2. 랜딩페이지 통합**
- ✅ functions/landing/ 폴더 생성
  - index.html (27KB)
  - privacy.html
  - terms.html
- ✅ functions/index.js에 정적 파일 서빙 로직 추가
  - fs.readFileSync로 HTML 제공
  - make-page.com, /privacy, /terms 라우팅

**3. Global Load Balancing 완전 구축**
- ✅ Serverless NEG: content-factory-neg
  - Cloud Run 서비스 연결: content-factory
  - 리전: asia-northeast3
- ✅ Backend Service: content-factory-backend
  - NEG 연결 완료
- ✅ URL Map: content-factory-urlmap
  - Default backend: content-factory-backend
- ✅ Target HTTPS Proxy: content-factory-https-proxy
  - Certificate Map 연결: make-page-cert-map
- ✅ Global IP: 34.120.160.174 (content-factory-ip)
- ✅ Forwarding Rule: content-factory-https-rule
  - IP: 34.120.160.174
  - Port: 443

**4. Certificate Manager 와일드카드 SSL (완료)**
- ✅ 인증서: make-page-wildcard-cert
  - 상태: ACTIVE
  - 도메인: make-page.com, *.make-page.com
- ✅ DNS Authorization: make-page-dns-auth
  - _acme-challenge.make-page.com CNAME 추가
  - 검증 완료
- ✅ Certificate Map: make-page-cert-map
  - Entry: make-page-entry (make-page.com)
  - Entry: wildcard-entry (*.make-page.com)
  - Target HTTPS Proxy 연결 완료
  - GCLB IP: 34.120.160.174:443

**5. DNS 설정 완료**
- ✅ Cloudflare DNS A 레코드 (proxied: false)
  - make-page.com → 34.120.160.174
  - *.make-page.com → 34.120.160.174
  - www.make-page.com → 34.120.160.174
- ✅ DNS 전파 완료 (8.8.8.8 확인)
- ✅ DNS 검증 레코드
  - _acme-challenge.make-page.com CNAME

**아키텍처 (검증 완료):**
```
Cloudflare (도메인 등록 + DNS만, 프록시 OFF)
    ↓ A 레코드
Google Cloud Load Balancer (34.120.160.174:443)
    ↓ Certificate Manager (ACTIVE)
    ↓ Backend Service
    ↓ Serverless NEG
    ↓ Cloud Run (content-factory)
    ↓ functions/index.js
    ↓ 랜딩페이지 (landing/) + 서브도메인 동적 생성
```

**완료일:** 2026-02-04

---

**Phase 3 작업 진행 중**

---

### Phase 3: Google 생태계 완성 ✅ 100%

**목표:** 100% Google Cloud 생태계

**완료:**
- ✅ Service Account 기반 로컬 자동화
  - Service Account: 753166847054-compute@developer.gserviceaccount.com
  - 키 파일: C:\Users\A1-M4\.config\gcloud\content-factory-sa-key.json
  - Sheets Helper: scripts/sheets-helper.js
  - 활성 거래처 조회, 행 추가, 셀 업데이트, 시트 클리어 등
  - KST 시간 유틸리티 (getKSTNow, getKSTDateString, getKSTTimeString)
  - 배포일지 시트 생성 및 테스트 완료

- ✅ Cloud Build 자동 배포
  - Trigger 이름: deploy-cloud-functions
  - GitHub 연동: jeonwoohyun85/content-factory (main 브랜치)
  - 빌드 파일: cloudbuild.yaml
  - 리전: asia-east1
  - 첫 배포 성공: 2026-02-04 (2분 41초 소요)

- ✅ Cloudflare Pages 정리
  - make-page-landing 프로젝트 제거됨 (이미 없음)

**작업 목록:**

**Service Account 설정:**
- ✅ Service Account 키 생성
- ✅ scripts/sheets-helper.js 작성
- ✅ .gitignore 보안 설정
- ✅ Sheets 공유 (Service Account에 편집자 권한)
- ✅ 테스트 및 검증

**자동 배포:**
- ✅ Cloud Build Trigger 설정
  - ✅ GitHub 푸시 → 자동 배포
  - ✅ 테스트 배포 성공

**모니터링 시스템:**
- ✅ Telegram 알림 (Cloud Function)
  - Pub/Sub Topic: monitoring-alerts
  - Cloud Function: alert-to-telegram (Gen2, Node.js 20)
  - 리전: asia-northeast3
  - 트리거: Pub/Sub (monitoring-alerts)
  - 환경변수: Secret Manager 연동 (TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID)
- ✅ Pub/Sub Notification Channel
  - Channel ID: 18141842621408590641
  - Topic: projects/content-factory-1770105623/topics/monitoring-alerts
- ✅ Alert Policy (ERROR 로그 → Telegram 알림)
  - Policy ID: 5630959630329801439
  - 조건: Cloud Functions ERROR 로그 발생 시
  - 알림: Pub/Sub → Cloud Function → Telegram
- ✅ Cloud Logging → BigQuery 내보내기
  - Dataset: logs (asia-northeast3)
  - Sink 1: error-logs-bigquery (severity>=ERROR)
  - Sink 2: scheduler-logs-bigquery (크론 감시)
  - IAM 권한 부여 완료
- ✅ Cloud Monitoring Uptime Check
  - 이름: make-page-uptime
  - URL: https://make-page.com/
  - 간격: 1분
  - Timeout: 10초
  - 리전: asia-pacific
- ✅ Cloud Trace (성능 모니터링)
  - 함수 실행 시간 추적
  - API 응답 시간 분석
  - 병목 지점 파악
- ✅ Cloud Billing Budget (비용 알림)
  - 월간 예산: $50 USD
  - 알림 임계값: 90%
  - 이메일 알림 활성화
- ⏸️ Cloud Monitoring 대시보드 (웹 콘솔 권장)
  - 링크: https://console.cloud.google.com/monitoring/dashboards?project=content-factory-1770105623
  - 시각화: 실행 횟수, 에러 추이, 응답 시간, 크론 성공률

**Cloudflare 정리:**
- ✅ Cloudflare Pages 제거
- ✅ 불필요한 DNS 레코드 정리
  - 삭제: analytics.make-page.com (umami-proxy 폐기)
  - 삭제: partner.make-page.com (테스트용)
  - 삭제: staging.make-page.com (테스트용)
  - 유지: make-page.com, *.make-page.com, www (A 레코드)
  - 유지: _acme-challenge (SSL 인증)
  - 유지: send.make-page.com (이메일)

**최적화:**
- ✅ BigQuery 로그 분석 (ERROR 이상 자동 저장)

**완료 기준:**
- GitHub 사용: 5% (코드 저장소만)
- Google Cloud 사용: 95% (모든 로직/배포/모니터링)

---

### Phase 4: 문서 및 정리 ⏳ 0%

**목표:** 문서와 코드 완전 동기화

**작업 목록:**
- ❌ PROJECT.md 전면 개편 (Google Cloud 기준)
- ❌ 로컬 CLAUDE.md ↔ 글로벌 CLAUDE.md 동기화
- ❌ 시스템 현황 섹션 자동 업데이트 (Google Cloud 기준)
- ❌ 배포 히스토리 정리 (2026-02-03 이후)
- ✅ functions/worker-main.js 레거시 파일 삭제

---

**현재 우선순위:** Phase 3 완료 (Google 생태계 완성)



## 포스팅 생성 규칙

### 콘텐츠 작성

- **본문 전체**: 2800~3200자 (공백 포함)

- **각 문단**: 280~320자

- **문단 개수**: 이미지 개수와 동일 (없으면 8~10개)

- **문단 구분**: 빈 줄 2개 (`\n\n`)

### 금지 사항

- **금지어**: 최고, 1등, 유일, 검증된

- **금지 창작**: 경력, 학력, 자격증, 수상

- **업체명**: 그대로 사용 금지

### 작성 원칙

- **핵심**: `description` 컬럼 중심

- **표현**: 간결, 핵심만

- **이미지 묘사**: 각 문단은 해당 이미지 설명

- **트렌드**: 문단당 1~2문장만

### 언어 처리

- **하드코딩**: ko, en, ja, zh-CN, zh-TW

- **기타**: Gemini API 실시간 번역

- **캐싱**: Worker 메모리 (재시작 시 초기화)

### AI 모델 설정

**Gemini 2.5 Flash (웹 검색)**:

- Temperature: 0.7

- Max Tokens: 600

- Timeout: 120초

- 출력: 500자 이내

**Gemini 3.0 Pro (포스팅)**:

- Temperature: 0.8

- Max Tokens: 8000

- Timeout: 120초

- 출력: JSON (title, body)

---

## 구글 드라이브 규칙

### 폴더 검색

1. 우선순위: 시트 `폴더명` 컬럼 정확 매칭

2. 폴백: `subdomain` 포함 검색

3. **제외**: Info, Video 폴더

### 폴더 순환

1. 오늘 날짜 폴더 (YYYY-MM-DD)

2. 알파벳순 정렬 후 순환

3. 마지막 사용: 저장소 시트 조회

### 이미지 처리

- **최대**: 10개 (초과 시 랜덤)

- **썸네일**: w400 (다운로드)

- **표시**: w800 (최종 URL)

- **포맷**: Base64 (Gemini 전송)

- **병렬**: Promise.all

- **저장**: 쉼표 구분 URL 문자열

---

## 자동 포스팅 스케줄

### KV 락

- **이름**: `cron_posting_lock`

- **TTL**: 23시간 59분 (86340초)

- **용도**: 동시 실행 방지

### 배치 처리

- **크기**: 10개씩

- **대기**: 배치 간 1초

- **필터**: `subscription = '활성'`

---

## 데이터 저장

### 저장소 시트 (전체 보관)

- **모든 포스팅 영구 보관**

- **행 높이**: 21px

- **줄바꿈**: CLIP

- **열 너비**: 관리자 시트 복사

### 최신 포스팅 시트

- **거래처당 1개만**

- **기존 행 삭제** 후 append

- **트랜잭션**: 최신포스팅 성공 → 저장소 저장

### 저장 데이터

```

도메인, 상호명, 제목, URL, 생성일시, 언어, 업종, 폴더명, 본문, 이미지

```

---

## 예외 처리

- **이미지 없음**: 텍스트만 8~10문단 생성

- **폴더 없음**: "No folders found" 에러, 중단

- **최신포스팅 실패**: 전체 중단

- **저장소 실패**: 로그만, 계속 진행

- **관리자 업데이트 실패**: 로그만

---

## 주요 기능

### 자동 포스팅 ✅

**워크플로우**: Cron(09:00) → Queue(병렬5) → Gemini API → Sheets 업데이트

**설명**: 매일 09:00 자동으로 거래처별 블로그 포스팅 생성

**핵심 함수**: scheduled(), queue()

**사용 컴포넌트**: Cron Trigger, Queue, Gemini 2.5 Flash, Gemini 3.0 Pro, Google Sheets, Google Drive

### 거래처 페이지 ✅

**워크플로우**: Request → Sheets 조회 → 동적 페이지 생성

**설명**: *.make-page.com 서브도메인으로 거래처 정보 페이지 제공

**핵심 함수**: fetch()

**사용 컴포넌트**: Cloudflare Workers, Google Sheets, Google Drive

### 포스팅 관리 ✅

**워크플로우**: API 요청 → Sheets 조회/삭제

**설명**: 포스팅 목록 조회 및 삭제 (비밀번호 인증)

**핵심 함수**: fetch()

**사용 컴포넌트**: API Endpoint, Google Sheets

### 통계 (Umami) ✅

**워크플로우**: 페이지 방문 → Umami 추적 스크립트 → Umami Cloud → 공유 URL

**설명**: 거래처별 방문 통계 제공 (로그인 없이 공개)

**구현 방식**:

- **추적**: 각 페이지에 Umami 스크립트 자동 설치

- **수집**: 방문 데이터 자동 수집 (URL, 시간, 국가 등)

- **조회**: Google Sheets 바로가기에 공유 URL 수동 등록

- **표시**: URL에 'umami' 포함 시 📊 통계 버튼으로 표시

**핵심 함수**: generateClientPage(), getLinkInfo()

**사용 컴포넌트**: Umami Cloud Analytics, Google Sheets





