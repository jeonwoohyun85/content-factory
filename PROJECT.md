# Content Factory 프로젝트

## 📍 현재 상태 (한눈에)

**거래처**: 2개 활성 | **병렬**: 5개 | **최대**: 4604개/일

**최근 작업**: docs: 시스템 상태 자동 동기화 스크립트 추가

**다음 단계**: Google Cloud 생태계로 전환 (Cloudflare → Google Cloud 완전 이전)

---

## 시스템 구조 (한눈에 보기)

```

┌─────────┐     ┌─────────┐     ┌──────────┐

│  Cron   │────▶│  Queue  │────▶│  Worker  │

│ (09:00) │     │ (병렬5) │     │          │

└─────────┘     └─────────┘     └────┬─────┘

                                     │

                    ┌────────────────┼────────────────┐

                    ▼                ▼                ▼

              ┌─────────┐      ┌──────────┐    ┌─────────┐

              │ Gemini  │      │  Sheets  │    │  Drive  │

              │   API   │      │   (DB)   │    │ (Image) │

              └─────────┘      └──────────┘    └─────────┘

```

### 데이터 흐름

1. Cron 트리거 (매일 09:00 KST)

2. Sheets '관리자' 조회 (구독='활성')

3. Queue에 거래처 등록 (병렬 5개)

4. Gemini API 호출 (검색 + 글 작성)

5. Drive에서 최신 이미지 조회

6. Sheets '최신포스팅' 저장

7. '크론', '상태' 컬럼 업데이트


---

## 🔄 Google Cloud 전환 계획

### 1단계: 환경 준비
1. Google Cloud 프로젝트 생성
2. API 활성화 (Functions, Firestore, Scheduler, Logging, Monitoring)
3. Secret Manager에 API 키 등록 (Gemini, Telegram)
4. IAM 권한 설정

### 2단계: 데이터 저장소
5. Firestore 생성 (KV 대체)
6. 락/캐시 스키마 설계

### 3단계: 코드 작성
7. Cloud Functions 작성 (Worker 로직 이전)
8. GAS 작성 (Sheets 연동 + 보조)
9. 로컬/테스트 환경에서 검증

### 4단계: 모니터링 구축
10. Cloud Logging 설정
11. Cloud Monitoring 알림 (Telegram 연동)
12. Error Reporting 활성화
13. UptimeRobot 설정

### 5단계: 크론 전환
14. Cloud Scheduler 생성
15. 수동 테스트 실행
16. 자동 크론 활성화
17. cron-job.org 비활성화

### 6단계: 배포 자동화
18. Cloud Build 설정 (GitHub 연동)

### 7단계: 프론트 이전 (선택)
19. Firebase Hosting (랜딩)
20. DNS 전환

---

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

---

## 시스템 현황 (자동 생성)

**마지막 업데이트**: 2026-01-31 03:06:44 KST

### Cloudflare Workers 설정

- **Worker**: make-page-subdomain (2941줄)

- **Cron**: `0 0 * * *` (매일 09:00 KST)

- **Queue 병렬**: 5개 동시 처리

- **재시도**: 1회

- **Timeout**: 30초

- **TTL**: 86340초 (23.98시간)

### Google Sheets 구조

#### 📋 관리자 시트

```

도메인, 상호명, 폴더명, 성함, 주소, 언어, 연락처, 영업시간, 거래처_정보, 바로가기, info, video, 업종, 크론, 상태, 구독 (16개 컬럼)

```

- **통계ID 컬럼 제거됨**: Umami 공유 URL은 바로가기 컬럼에 수동 등록

#### 📝 최신포스팅 시트

```

```

### 환경변수 (Worker에서 사용 중)

- `ARCHIVE_SHEET_NAME`

- `DELETE_PASSWORD`

- `DRIVE_FOLDER_ID`

- `GEMINI_API_KEY`

- `GOOGLE_SERVICE_ACCOUNT_JSON`

- `GOOGLE_SHEETS_CSV_URL`

- `LATEST_POSTING_SHEET_NAME`

- `POSTING_KV`

- `POSTING_QUEUE`

- `SHEETS_ID`

### Gemini API

- **Tier**: 1 (Paid)

- **gemini-2.5-flash**: 300 RPM

- **gemini-3-pro-preview**: 150 RPM

---

## 성능 예상 (병렬 5개 기준)

- **100개 거래처**: 25분

- **1000개 거래처**: 4.2시간

- **최대 안전 처리량**: 4604개/일

---

## 배포 이력

### 📋 주간 히스토리 (1/26~1/31)

#### 2026-01-26 (일)
Google Sheets 컬럼명을 한글로 변경하고 동적 연동 시스템을 구현했다. Worker 코드를 대폭 간소화하여 5540줄에서 526줄로 축소했으며, GitHub Actions에 코드 품질 자동 검증 기능을 추가했다. 코드 품질 규칙을 변경하여 500줄 제한을 제거하고 단일 책임 원칙을 적용했다. Google Drive에서 Sheets로 자동화하는 Worker를 추가하고 subdomain 추출 로직을 구현했다. Drive 폴더 상호명 매칭을 지원하고 시간 제한을 제거하여 재귀 검색을 추가했다. 모바일 최적화 이미지 URL 생성 기능을 구현하고 디버깅 로그를 추가했다. 재귀 검색 로직을 수정하고 OAuth 토큰 및 Drive API 응답 로그를 강화했다. 재귀 검색 제거 후 직접 검색으로 변경하여 타임아웃 문제를 해결했다. 시트 이름을 Sheet1과 시트1로 수정하는 과정에서 여러 차례 조정했으며, Cron 주기를 5분에서 1분으로 변경하여 테스트했다. CSV 파서를 개선하여 큰따옴표로 감싸진 필드를 처리하도록 했으며, 중복 URL 방지 로직을 추가했다. Info 섹션을 최대 6개 랜덤 표시로 변경하고 3열 그리드를 적용했다. Cron을 임시 비활성화하여 테스트 환경을 구성했으며, subdomain 컬럼이 '00001' 또는 '00001.make-page.com' 둘 다 지원하도록 개선했다. 폐기된 Workers와 wrangler 설정 파일을 삭제하고 CLAUDE.md, PROJECT.md를 업데이트했다. Worker가 헤더 이름으로 컬럼을 찾도록 수정하고 debug logging을 추가했다. 모바일/PC 동일한 레이아웃으로 통일하여 Info 사진 3열을 고정했다.

#### 2026-01-27 (월)
Info 섹션에 라이트박스 기능을 구현하여 이미지 확대/이전/다음/ESC 닫기를 지원했다. description 텍스트를 제거하고 AI 참고용으로만 사용하도록 변경했으며, description 컬럼 사용 방침을 문서화했다. Video 섹션을 구현하여 YouTube/Drive/TikTok/Instagram을 지원하고 모바일 최적화 16:9 비율을 적용했다. Video 섹션을 풀 너비로 변경하여 양옆 공백을 제거했으며, Info/Video 섹션 모두 풀 너비로 변경했다. info_images 컬럼명을 info로 변경하고 섹션 max-width 1200px를 복구하여 모바일 최적화를 적용했다. Video 섹션을 모바일/PC 동일하게 2열로 변경한 후 다시 모바일 1열, PC 2열로 복구했다. 하단 푸터를 제거하여 중복 정보를 삭제했다. 포스팅 자동 생성 시스템을 추가하고 Gemini API와 Posts 섹션을 구현했다. Gemini API 키를 코드에 직접 작성하여 private repo에서 관리하도록 했다. Posts 시트 자동 생성 기능을 추가하고 Posts 시트 조회 기능을 구현했다. Gemini API 응답 검증을 추가하고 모델을 여러 차례 변경했다(gemini-1.5-pro → gemini-2.0-flash-exp → gemini-2.5-flash + 3.0-pro). Google Drive 폴더 순환 로직을 구현하여 Info/Video를 제외하고 모든 이미지를 Gemini에 전달하도록 했다. Drive 폴더명을 subdomain + business_name으로 수정하고 Info/Video 필터링에서 대소문자 구분을 제거했다. 폴더 검색 로그를 추가하고 Service Account에 Drive API 권한을 추가했다. 이미지 조회 전체 과정 로그를 추가하고 확장자 제한을 제거했다. Base64 인코딩 스택 오버플로우를 수정하여 청크 단위 처리를 적용했다. Posts를 1개만 표시하고 행 높이 21px 조정 기능을 추가했으며, 한국 시간(KST)을 적용했다. Posts를 CSV에서 Service Account API로 변경하고 make-page-subdomain worker에 Google Sheets 환경변수를 추가했다. getRecentPosts에 env 파라미터를 전달하도록 수정했다. 포스트 상세 페이지를 추가하고 /post 경로를 구현했다. 포스트에 이미지를 추가하여 Google Drive thumbnail을 표시하도록 했다. Posts 시트 헤더 업데이트 엔드포인트를 추가하고 Posts 헤더 업데이트 및 포스팅 생성 엔드포인트를 구현했다. Posts 시트 컬럼을 확장한 후 헤더를 업데이트했다. 포스트 이미지와 본문을 인터리브 방식으로 변경하고 이미지 개수만큼 문단을 생성하도록 프롬프트를 수정했다. 포스팅 본문 3000~3500자 제한을 다시 추가했다. Posts 섹션을 3개 그리드 레이아웃으로 변경했다. 포스트 라우팅 버그를 수정하여 개별 포스트 페이지를 연결했다. Sheet1 이름을 ContentFactory로 변경하는 엔드포인트를 추가하고 Sheet1 이름 변경 프록시 엔드포인트를 구현했다. Sheet1 이름 변경 함수를 직접 구현하여 코드 품질 체크 오탐을 수정했다. 폐기 코드를 정리하여 일회성 함수 및 백업 파일을 제거했다. posting-generator 로직을 make-page-subdomain에 통합하고 posting-generator Worker를 폐기했다. posting-generator.js와 wrangler-posting-generator.toml을 삭제했다. 포스트 삭제 기능을 추가하고 비밀번호(55000)를 설정했다. 포스트 삭제 버튼을 상세 페이지로 이동했으며, 단일 포스트 보관 정책을 구현했다. 포스트 삭제 버튼을 다시 목록으로 이동하고 1 client 1 post retention policy를 구현했다. Retention Policy를 제거하여 모든 포스팅을 보관하도록 변경한 후 다시 Retention Policy를 추가했다. 포스팅 생성을 최적화하여 이미지 10개 제한, 썸네일 사용, Sheets API 전환을 적용했다. 날짜 비교 로직을 개선하여 deletePost에서 400 에러를 방지했다. /generate-post 엔드포인트를 추가하고 Gemini 모델을 1.5-pro로 업데이트했다. GitHub Actions 워크플로우 이름을 한글로 완전히 현지화했으며, Complete automated posting system with Scheduled handler를 추가했다. 깃허브 액션 목록 한글화 적용 확인을 위한 업데이트를 진행했다.

#### 2026-01-28 (화)
모든 시간을 한국 서울 시간(KST)으로 통일했다. 포스트 목록 그리드 레이아웃을 최적화하여 PC 2열, 모바일 1열을 적용했다. 포스트 삭제 버튼을 제거하고 목록 노출 개수를 3개에서 2개로 변경했다. 포스트 삭제 로직을 변경하여 날짜를 무시하고 해당 업체의 최신 글을 강제 삭제하도록 했다. 포스트 삭제 로직을 강화하여 정확한 일치 대신 시간 차이가 가장 적은 포스트를 검색하고(1분 이내), 날짜 비교 로직을 개선하여 숫자 추출 비교 방식을 적용했다. 포스트 삭제 시 날짜 비교 오차를 허용하고(1분) 문자열 타입 강제 변환을 적용했다. Gemini 1.5 Pro를 3 Pro Preview 모델로 변경했다. 코드 품질을 개선하여 중복 코드를 제거하고 2670 chars를 감소시켰다. Drive 폴더 검색을 개선하여 contains 연산자를 사용했으며, Drive 검색 시 subdomain을 정규화하여(00001.make-page.com → 00001) 처리했다. Posts 시트 저장 시 subdomain을 정규화하고 saveToPostsSheetForPosting에 normalizedSubdomain 변수 정의를 추가했다. Posts 시트에 subdomain을 클릭 가능한 도메인 형태로 저장하고 Retention Policy를 개선했다. Retention Policy 로직을 수정하여(>= 2 → >= 1) 완전히 수정했으며(모두 삭제 후 추가), 최신 2개를 유지하도록 원복했다. Posts 시트 컬럼 복구 함수를 추가하여 G1에 folder_name 헤더를 추가했다. 이미지 다운로드를 병렬화하여 속도를 3-5배 향상시켰다. Posts 시트를 Content Factory 시트로 통합하여 중복을 제거했다. industry 컬럼 기반 웹 검색을 적용했다. Posts 시트 헤더 확인용 임시 엔드포인트를 추가했다. Posts 시트 기반 포스팅 저장으로 변경하고 역순 검색을 적용했다. Dual-save 구조로 변경하여 Content Factory + Posts에 저장하도록 했다. 시트 이름을 ContentFactory로 수정했다(Content Factory → ContentFactory). 한글 컬럼명 지원을 추가하고 상태값을 '구독/미구독'으로 변경했다. 거래처_정보 매핑을 추가하고 Info 폴더 대소문자 구분 없이 검색하도록 했다. 환경변수 관리를 적용하고 wrangler.toml을 생성하여 보안을 강화했다. Worker 설정을 분리하고 package.json을 추가했다. '바로가기' 컬럼 매핑을 추가하고 시트 GID를 수정했다. 구독 체크를 해제하고 CSV 헤더 파싱을 개선하여 BOM/공백을 제거했다. wrangler.toml 시트 GID 환경변수를 수정하고 관리자 탭(gid=0) CSV URL로 수정했다. Info 섹션에 구글 드라이브 URL 썸네일 변환을 추가하고 유효하지 않은 바로가기 링크를 필터링했다. 언어별 거래처 페이지 다국어 지원을 추가하고 무제한 언어 지원을 추가했다(API + 캐싱). 최신 포스팅 시트 자동 저장을 추가하고 최신포스팅 동적 관리를 구현했다(거래처당 2개만 유지). 저장소+최신포스팅 동적 관리 구조를 확정하고 Posts를 폐기했다. 폴더명 컬럼을 추가하여 정확한 Drive 폴더 검색을 지원했다. 시트 조회 엔드포인트(/check-sheets)를 임시로 추가하고 시트 조회 JSON 파싱 에러를 수정했다. 관리자 탭 post 컬럼을 제거하고 저장소 탭 기반으로 전환했다. drive-to-sheets를 폐기하고 wrangler.toml gid를 수정했으며, GitHub Actions에서 drive-to-sheets 배포 단계를 제거했다. 폴더 순환 로직을 수정하여 저장소 탭 기반으로 변경했다. 모든 시트 컬럼을 동적 매핑으로 전환하여 순서를 무관하게 처리했다. 포스팅 글자수를 조정하여 실제 3500자를 목표로 했다. Gemini API 에러 처리를 추가하고 GEMINI_API_KEY 검증을 구현했다. GitHub Actions에 GEMINI_API_KEY secret을 추가하고 Worker를 재배포했다.

#### 2026-01-29 (수)
Workers Unbound 모드를 활성화하여 CPU 제한을 30초로 확장했다. 웹검색을 3.0 Flash로 변경하고 이미지 w400 최적화를 적용했다. Gemini 3 Flash 모델명을 수정했다(gemini-3-flash-preview). ctx.waitUntil() 백그라운드 처리를 적용하여 timeout을 회피했으며, Queue 백그라운드 처리로 전환했다(ctx.waitUntil 대체). Google Sheets API append 경로를 수정했다(:append → /append → :append). 언어 인식 및 마크다운 링크 파싱 버그를 수정했다. 홈페이지 포스트 표시 버그를 수정하여 최신 포스팅 시트에서 읽도록 했다. 포스트 에러 로깅을 추가하여 디버깅을 개선했으며, JWT base64url 인코딩을 수정하여 포스트 표시 문제를 해결했다. OAuth token 응답 에러 처리를 강화했다. Secret 재설정을 위한 재배포를 진행했다. 자세한 에러 로깅을 추가하고 시트 이름 URL 인코딩을 추가했다. 모든 시간을 한국 서울 시간(KST)으로 통일했다. 포스트 본문과 이미지 저장 및 표시 기능을 추가했다. Queue consumer 에러 로깅을 강화하고 테스트 엔드포인트(/test-posting)를 추가했다. test-sheet 엔드포인트를 추가하여 시트 데이터 디버깅을 개선했으며, 저장소 시트도 확인하도록 확장했다. 시트 append 에러 체크를 추가하고 Sheets API append URL 형식을 수정했다(/append → :append). 웹 검색 트렌드 정보를 본문에 반영하도록 프롬프트를 추가했다. 본문 길이를 조정하여(공백 포함 2800~3200자) KST 시간 중복 변환을 제거하고 셀 간격을 자동 정렬하도록 했다. 폴더 순환 로직을 수정하여 시트 URL 인코딩을 적용했다. 관리자 시트 열 너비를 저장소/최신 포스팅 시트에 복사 적용했으며, 저장소 시트 열 간격을 최신 포스팅 시트와 동일하게 맞췄다. 저장소 시트 열 너비 복사 로그 및 에러 처리를 강화했다. 저장소 시트 열 간격을 관리자 시트 기준으로 복사하도록 수정했다. Queue 무한 루프를 방지하고 API 중복 호출을 제거했다. 포스팅 생성 주요 버그를 수정하고 Cron 자동 포스팅을 안정화했다. 이미지를 선택사항으로 적용했다. post1/post2 로직을 완전히 삭제하고 Worker 빈 파일을 복구했다. Cron 자동 포스팅을 활성화하여 매일 09:00 KST에 실행하도록 했다. 크론 예정 시간 자동 업데이트를 추가하고 스마트스토어 링크 아이콘을 추가했다. 구독/상태 컬럼을 분리하고 자동 상태 업데이트를 구현했다. 상태 컬럼 업데이트 스코프 오류를 수정했다. TTL을 23시간 59분으로 변경하여 크론 타이밍 충돌을 방지했다. Queue 병렬 처리를 5개로 확장하고 재시도를 3회로 증가시켰으며, 다시 재시도를 3회에서 1회로 조정했다. 시스템 상태 자동 동기화 스크립트를 추가하고 Git Hook + 간단 요약 자동화를 구현했다. Gemini API timeout을 120초로 증가시켰다. 저장소/최신포스팅 시트 행 높이를 고정했다. /test-cron 엔드포인트를 추가했다. 저장소 시트 중복 읽기를 제거하여 성능을 향상시켰다. 포스팅 언어 설정 누락을 수정했다.

#### 2026-01-30 (목)
크론 트리거 배포 환경을 명시하고 wrangler.toml 환경 구조를 명시화했다. wrangler.toml 구조를 단순화하여 크론 배포를 수정했으며, 워크플로우 환경 지정을 제거했다. 포스트 표시를 2개에서 1개로 변경했다. umami credentials 파일을 gitignore에 추가했다. Umami 통계 자동 추가 기능을 구현했다. D1 기반 통계 기능을 추가하고 D1 데이터베이스 설정 워크플로우를 구현했다. D1 analytics 데이터베이스 바인딩을 추가하고 D1 스키마 생성을 추가했다. KV namespace ID를 수정하고 queue consumer 중복을 제거했다. wrangler.toml 경로를 수정하고 Worker 이름을 make-page-subdomain으로 수정했다. SPA 방식 통계 구현을 시도했으나 되돌렸다(refactor: SPA 방식 통계 구현 (파일 분할) → Revert). SPA UI 파일을 추가하고 Worker 파일 손상을 수정했다. 템플릿 리터럴 변수 치환을 수정하고 API 호출과 정적 리소스를 방문 통계에서 제외했다. Plausible 추적 스크립트를 추가했다. Umami Cloud로 전환하고 D1/Plausible을 제거했다. Google Sheets '통계ID' 컬럼 연동을 추가했다. Umami Website 자동 생성 기능을 크론에 추가하고 통계ID 자동 입력 기능을 구현했다. 통계 첫 방문 시 자동 생성 기능을 추가했으며(상호명), 통계ID가 없으면 무조건 재생성하도록 했다. 기본값 shareId도 재생성하도록 수정했다.

#### 2026-01-31 (토)
Cron 중복 실행 방지를 위해 날짜별 락 키를 적용하고 KV 락 TTL을 48시간으로 설정했다. Google Sheets 텍스트 줄바꿈을 WRAP으로 강제 적용하여 가독성을 개선했다. 최신포스팅 시트 도메인 비교 정규화를 추가하고 전체 삭제 후 append 방식으로 변경했으며, 저장소 시트에 KST 시간 표시를 적용했다. 최신 포스팅과 저장소 시트 간 데이터 정합성을 개선하여 중복 저장 및 누락 문제를 해결했다. PROJECT.md 구조를 대폭 개편하여 배포 이력 전체 230개를 날짜별로 분류하고 주간 요약 섹션을 추가했다. 자동 업데이트 워크플로우를 추가하여 배포 이력과 시스템 현황을 자동으로 관리하도록 했으며, 아키텍처 결정 및 폐기 이력 섹션을 추가했다. 이후 주간 요약을 월별 요약으로 변경하고 기술 스택 진화 섹션을 제거했다. 배포일지 일괄 업로드 워크플로우를 추가했으나 곧바로 폐기했다. Umami 통계 연동을 개선하여 '우마미'와 '우마미공유' 컬럼을 추가하고 동적 Website ID 매핑을 구현했다. 다국어 번역 기능을 대폭 강화하여 모든 UI 텍스트에 postImage와 galleryImage 다국어 지원을 추가하고, 상호명에서 언어 표시를 자동 제거하는 기능을 구현했다. Gemini 2.5 Flash API를 활용한 동적 번역 시스템을 구축하여 business_name, address, business_hours를 자동 번역하도록 했다. 번역 과정에서 템플릿 리터럴 줄바꿈 오류와 변수명 충돌 문제를 수정했으며, getClientFromSheetsForPosting 함수에도 번역 로직을 추가했다. 번역 API 토큰 부족 문제를 발견하여 maxOutputTokens를 500에서 8000으로 증가시켰다. 캐싱 기능 추가를 시도했으나 코드 복잡도로 인해 실패하여 번역 정상 작동 버전으로 롤백했다.

#### 2026-02-01 (일)
posting-helpers.js에서 normalizeLanguage import 누락과 deleteResponse 스코프 에러를 수정했다. 최신_포스팅 시트 이름 변경을 적용하고 크론 안정성을 강화하여 무조건 성공하도록 했다. 시트 헤더를 하드코딩으로 추가하여 관리자, 최신_포스팅, 저장소 탭의 일관성을 보장했다. 최신_포스팅 헤더 순서에서 URL 위치를 수정하고 저장소 시트 생성일시 형식을 USER_ENTERED로 변경했다. Info 섹션에서 PC 사진을 4개에서 3개로 변경했다가 다시 조정하면서 사진 개수 제한을 6개에서 9개로 늘렸다가 3x2 그리드 유지를 위해 6개로 복원했다. Info 사진 랜덤 로테이션을 클라이언트 사이드에서 복구했다. 푸터를 추가하여 상호명, 주소, 연락처, 영업시간을 표시하도록 했으며 포스팅 페이지에도 동일하게 적용했다. 저장소 시트에서도 포스트를 조회할 수 있도록 개선하여 오래된 포스팅에 접근 가능하게 했다. 저장소 시트 URL 복구 엔드포인트를 추가하고 이미지 컬럼에 포스트 URL을 복구하는 기능을 구현했다. 저장소 데이터 밀림 현상을 보정하여 생성일시를 실제 위치에서 읽도록 수정했으며 잘못된 URL을 덮어쓰는 복구 조건을 개선했다. 저장소 시트 데이터 밀림 현상을 URL 헤더 위치 기준으로 완전히 수정했다. 포스트 URL에서 날짜를 숨기고 저장소 이미지 컬럼에 자동 등록되도록 했다. 저장소 시트 행 높이를 21px로 고정했다. 이미지 컬럼에 이미지 URL이 저장되도록 수정했다. 최신_포스팅에서 중복 도메인이 제거되도록 동시성 문제를 해결했다. 관리자 시트 크론 컬럼 업데이트를 조기 로드 방식으로 수정하여 API 실패를 방지했다. ARCHIVE_HEADERS_FALLBACK 순서를 실제 시트 구조와 일치하도록 수정했다. 캐시 삭제 함수를 추가하고 포스팅 저장 후 자동으로 캐시를 무효화하여 최신 포스팅이 즉시 반영되도록 했다. 저장소 시트 읽기 로직을 헤더 인덱스 직접 참조 방식으로 수정했다. 배치 크기를 5개에서 1개로 감소시켜 타임아웃을 방지했다. Cloudflare Cron과 Queue를 비활성화하고 GitHub Actions로 대체했다. Daily Posting Cron을 GitHub Actions에서 실행했다. 최신_포스팅 탭 행 높이를 21로 고정했다. 임시 빈 queue 핸들러를 추가한 후 Queue 핸들러를 최종 제거했다. ntfy 상세 에러 알림을 추가하고 조기 반환 에러에도 ntfy 알림이 전송되도록 수정했다. GitHub Actions Cron 타임아웃을 200초로 증가시키고 실패 시 ntfy 알림을 추가했다. 코드를 정리하여 중복을 제거하고 상수화했다. 크론 컬럼을 관리자 시트에서 최신_포스팅으로 이동했다. 조건문 테스트 워크플로우를 추가한 후 삭제했다. ntfy 메시지를 한 줄로 수정하여 YAML 파싱 오류를 해결했다. 랜딩페이지를 tech-startup 스타일로 여러 차례 롤백 시도했으며 원페이지 간소화를 시도했다가 다시 tech-startup으로 재롤백했다. CLAUDE.md를 추가하여 완전 클라우드 기반 작업 원칙을 명시했다. 랜딩페이지 자동 배포 워크플로우를 추가하여 landing/ 폴더 변경 시 Cloudflare Pages에 자동 배포되도록 했다. tech-startup 스타일 랜딩페이지를 적용했다. Stats 섹션(보라색 배경 통계)과 CTA 섹션("지금 바로 시작하세요")을 제거했다.


---

## 런칭 전 필수 작업 (보류)

1. **에러 로깅**: Slack 또는 Sheets

2. **정확도 검증**: 1개월 모니터링

3. **비용 최적화**: RPM/토큰 관리

4. **관리자 페이지**: 비밀번호 통합 관리

---

## 아키텍처 결정

### 1. Firebase → Supabase → Google Sheets

- **폐기 이유**: Firebase 유료 플랜 불필요, Supabase 무료 플랜 제약

- **선택 이유**: Google Sheets 무료, 무제한 읽기, CSV 직접 접근 가능

- **적용일**: 2026-01-26

### 2. 모든 포스팅 보관 (Retention Policy 제거)

- **기존**: 1개만 유지 → 최신 2개 유지

- **변경**: 모든 포스팅 영구 보관

- **이유**: 데이터 축적 필요, 삭제 로직 버그 빈번

- **적용일**: 2026-01-27

### 3. 저장소 + 최신포스팅 3개 탭 구조

- **기존**: Posts 단일 시트

- **변경**: 관리자, 저장소, 최신포스팅 분리

- **이유**: 전체 보관 + 빠른 조회 동시 지원

- **적용일**: 2026-01-28

### 4. Workers Unbound 모드

- **기존**: Standard (CPU 10ms)

- **변경**: Unbound (CPU 30초)

- **이유**: Gemini API 응답 대기 시간 필요

- **적용일**: 2026-01-29

### 5. Umami Cloud 전환

- **시도**: D1 기반 자체 구현, Plausible

- **최종**: Umami Cloud (SaaS)

- **이유**: 운영 부담 제거, 무료 플랜 충분

- **적용일**: 2026-01-30

### 6. 다국어 번역 시스템 (Gemini API)

- **기존**: 하드코딩 언어만 지원 (ko, en, ja, zh-CN, zh-TW)

- **변경**: Gemini 2.5 Flash API 동적 번역

- **이유**: Google Sheets '언어' 컬럼에 임의 언어 입력 시 자동 번역

- **적용일**: 2026-01-31

- **핵심**: business_name, address, business_hours 필드 번역, maxOutputTokens 8000

---

## 폐기 이력

### Workers

- `posting-generator.js`: make-page-subdomain에 통합 (2026-01-27)

- `drive-to-sheets.js`: 불필요 (2026-01-28)

### 시트

- `Posts`: 저장소+최신포스팅 구조로 대체 (2026-01-28)

### 워크플로우

- `.github/workflows/update-project-md.yml`: 수동 관리로 회귀 (2026-01-31)

### 기능

- **Retention Policy**: 모든 포스팅 보관으로 변경 (2026-01-27)

- **통계ID 컬럼**: 바로가기 컬럼에 수동 등록으로 변경 (2026-01-31)

- **D1 Analytics**: Umami Cloud로 전환 (2026-01-30)

- **Plausible**: Umami Cloud로 전환 (2026-01-30)

- **캐싱 기능**: 코드 복잡도로 인해 실패, 롤백 (2026-01-31)

---

## 라이선스

MIT
