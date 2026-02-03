
---

# 🗑️ 폐기 (Deprecate) 규칙

## "폐기" 명령 시 실행 항목

사용자가 "폐기"라고 말하면 **완전히 제거**:

1. **코드 삭제**: 관련 함수, endpoint, 로직 전체
2. **파일 삭제**: 독립 모듈 파일 제거
3. **Import 정리**: 사용하지 않는 import 제거
4. **설정 정리**: 환경 변수, 바인딩 제거 (필요 시)
5. **문서 업데이트**: 폐기 이력 기록

## 폐기 = 깨끗하게 = 흔적 없이

- ❌ 주석 처리 금지
- ❌ "deprecated" 표시 금지
- ✅ 완전 삭제
- ✅ 관련 로직 정리
- ✅ 커밋 메시지: `deprecate: <대상> 제거`


# Claude Code - 고속 모드

---

# ⚠️ 파일 작업 규칙

## 원본 = GitHub (단일 진실 공급원)
- Workers 코드 (`workers/*.js`)
- 설정 파일 (`wrangler.toml`)
- 프로젝트 문서 (`PROJECT.md`)
- 모든 프로덕션 파일

## 로컬 허용 범위

### 1. 읽기 전용 확인
- 시트 조회 스크립트
- 빠른 테스트 (`test-*.js`)
- 프리뷰 생성

### 2. 임시 작업물
- 1회성 데이터 처리
- 로컬 실험 코드
- GitHub 미추적 파일만

### 3. 금지
- Worker 직접 수정
- 설정 파일 로컬 편집
- 프로덕션 코드 로컬 저장

## 작업 방향성: 클라우드 우선, 필요시 로컬

**원칙: 가급적 클라우드 기반, 자동화/속도 향상 시 로컬 허용**
- **기본**: GitHub: 코드 저장소 (단일 진실 원천)
- **배포**: Cloud Build: 자동 배포 (GitHub 푸시 감지)
- **실행**: Cloud Functions: 서버리스 실행
- **데이터**: Firestore/Sheets: 클라우드 데이터
- **자동화**: 로컬 스크립트 허용 (Service Account 인증)

**로컬 사용 허용 조건:**
- ✅ 작업 속도 향상 (Sheets 조회, 빠른 테스트)
- ✅ 자동화 개선 (Claude 권한 집중)
- ✅ 스파게티 코드 방지 가능
- ✅ GitHub API 실패 시 로컬 git 폴백
- ❌ 클라우드로 가능한데 굳이 로컬 사용 금지

**워크플로우**
```
개발 → 로컬 테스트 (functions-framework)
수정 → 로컬 git (add/commit/push) 또는 GitHub API
배포 → Cloud Build 자동 (GitHub 푸시 감지)
실행 → Cloud Functions (클라우드에서만)
자동화 → scripts/*.js (로컬 Service Account)
```

**금지**
- ❌ 로컬 gcloud deploy (Cloud Build 사용)
- ❌ 프로덕션 직접 수정
- ❌ 스파게티 코드 발생 가능성 있는 로컬 작업

## 핵심 규칙
**"이 파일이 다시 쓰이는가?"**
- YES → GitHub (API 또는 로컬 git)
- NO → 로컬 OK

**"자동화에 도움이 되는가?"**
- YES → 로컬 허용 (scripts/*.js)
- NO → 클라우드 우선

**"GitHub API가 실패하는가?"**
- YES → 로컬 git 사용
- NO → GitHub API 우선

---

# ⏰ 시간 기준 (절대 규칙)

**모든 시간은 한국 서울(KST, UTC+9) 기준**
- 크론 실행 시간: KST
- 로그 타임스탬프: KST
- 시트 저장 시간: KST
- 락 키 날짜: KST
- 사용자 표시 시간: KST

**UTC 사용 금지**
- GitHub Actions cron은 UTC로 설정하되 주석에 KST 명시
- 코드 내부 시간 계산은 모두 KST (UTC+9 변환)
- 절대 UTC 그대로 사용 금지

**예시:**
```javascript
// ✅ 올바른 방법
const kstNow = new Date(Date.now() + (9 * 60 * 60 * 1000));
const dateStr = kstNow.toISOString().split('T')[0]; // YYYY-MM-DD

// ❌ 잘못된 방법
const utcNow = new Date();
const dateStr = utcNow.toISOString().split('T')[0]; // UTC 사용
```

---

# 커뮤니케이션 규칙

## 코드 표시 금지
- 설명 시 코드 블록 사용 금지
- 한글 설명만
- 예외: 사용자가 "코드 보여줘" 명시 시만

## 간결한 응답
- 핵심만 전달
- 불필요한 설명 제거
- 구조화된 목록

---

# 응답 원칙

- 설명 0%, 실행 100%
- 확인 요청 금지 (중요한 삭제/배포 제외)
- 병렬 처리 최대화
- **작업 종료 시 반드시 "완료" 명시**

## 🚨 중단 명령 (최우선)
**사용자가 다음 키워드를 말하면 모든 도구 사용 즉시 중단:**
- "멈춰", "멈춰봐", "중단", "그만", "하지마", "하지말아", "스톱"
- 진행 중인 작업 즉시 취소
- 응답만 보내고 대기
- **어떤 도구도 실행 금지**

## 금지 사항
- "이제 ~하겠습니다" 불필요
- "먼저 ~를 확인하고" 불필요
- 단계별 설명 불필요
- Task 남용 금지 (복잡한 작업만)

---

# ⚡ 고속 처리 규칙

## 병렬 실행 필수
- **독립적 작업은 무조건 병렬**
- 여러 파일 읽기 → 한 메시지에 다중 Read
- 여러 Worker 확인 → 한 메시지에 다중 GitHub API
- 검색 + 읽기 → 동시 실행

## Task Agent 사용 금지 (예외만 허용)
### 금지 (직접 실행)
- 파일 찾기 → Glob 직접
- 코드 검색 → Grep 직접
- 파일 읽기 → Read 직접
- 단순 확인 작업

### 허용 (Task 사용 OK)
- 복잡한 다단계 분석
- 여러 위치 탐색 필요
- 10개 이상 파일 처리

## 순차 처리 최소화
```
❌ 읽기 → 분석 → 수정 → 확인 (4단계)
✅ 읽기 + 수정 동시 → 확인 (2단계)
```

## GitHub 직접 작업 (필수)

**Workers 코드 수정**
1. GitHub API로 파일 읽기
2. GitHub API로 파일 수정
3. GitHub Actions 자동 배포

**랜딩페이지 수정**
1. GitHub API로 landing/index.html 수정
2. GitHub Actions 자동 트리거
3. Cloudflare Pages 자동 배포

**절대 금지**
- 로컬 파일 수정 후 git push
- 로컬 wrangler deploy
- 로컬 동기화 (git pull) 후 배포

## 중간 보고 생략
- 진행 상황 설명 안 함
- 결과만 보고
- "완료" + 핵심 정보만

---

# 코드 품질 규칙

## 단일 책임 원칙
- 한 파일 = 한 기능만
- 파일 크기 제한 없음 (단일 기능이면 OK)
- 함수당 최대 50줄 권장

## 금지
- ❌ 거대 함수 (100줄 이상)
- ❌ 중복 코드 (3곳 이상)
- ❌ 여러 기능 한 파일에 합치기

---

# UI/UX 디자인 원칙

- **모바일 우선**: 모든 UI는 모바일 기준
- **터치 친화적**: 버튼 최소 44x44px
- **반응형 디자인**: 미디어 쿼리 적용
- **가독성**: 본문 16px, 제목 18px 이상

---

# 프로젝트 정보

## 기본 정보
- **서비스**: 콘텐츠팩토리 (Content Factory)
- **코드명**: CAPS
- **GitHub**: jeonwoohyun85/content-factory (private)
- **랜딩**: https://make-page.com

## 세션 시작 시
1. 필요 시 PROJECT.md 확인 (GitHub)
2. 배포 이력 확인 (gh run list)

## 현재 인프라 (2026-02-02)
- Google Sheets (거래처 DB)
- Google Drive (사진 저장)
- Cloudflare Workers (2개):
  - make-page-subdomain (2600+줄)
  - umami-proxy (79줄)
- Cloudflare Pages:
  - make-page-landing (랜딩페이지)
  - GitHub Actions 자동 배포
- Claude API (Haiku 4.5 검색, Sonnet 4.5 작성)
- Telegram Bot (헬스체크, 품질리포트 알림)
- Cloudflare Cron (매일 00:01 KST)
- Cloudflare Queue (posting-queue)
- Cloudflare KV (POSTING_KV)

## Cloudflare API

**인증 정보** (환경 변수):
- CLOUDFLARE_EMAIL: Contact@contentfactory.onmicrosoft.com
- CLOUDFLARE_GLOBAL_KEY: e5cc4242edf306683f88ca9b968ec94185d07

**사용 방법**:
```bash
curl -H "X-Auth-Email: $CLOUDFLARE_EMAIL" -H "X-Auth-Key: $CLOUDFLARE_GLOBAL_KEY" ...
```

## Google Sheets 접근 방법

**Spreadsheet ID**: `1KrzLFi8Wt9GTGT97gcMoXnbZ3OJ04NsP4lncJyIdyhU`

**탭 목록**:
- 관리자 (거래처 정보)
- 최신포스팅 (최근 포스팅 3개)
- 저장소 (전체 포스팅 이력)
- 배포일지 (배포 성공 이력)

**CSV 조회 URL**:
```
https://docs.google.com/spreadsheets/d/1KrzLFi8Wt9GTGT97gcMoXnbZ3OJ04NsP4lncJyIdyhU/gviz/tq?tqx=out:csv&sheet=탭이름
```

**중요**:
- `gid=` 번호 사용 금지
- **반드시 `&sheet=탭이름` 사용**
- 예: `&sheet=배포일지`
- URL 인코딩 필요: `&sheet=%EB%B0%B0%ED%8F%AC%EC%9D%BC%EC%A7%80`

**조회 방법**:
- ❌ WebFetch 사용 금지 (15분 캐시 문제)
- ✅ Bash curl 직접 사용
- 항상 최신 데이터 보장

**배포일지 컬럼**:
- 날짜, 시간, 카테고리, 제목, 워크플로우, 설명

## 폐기된 서비스 (사용 금지)
- Firebase, Supabase, Cloudinary
- WordPress, Cloudways, SSH
- Fly.io, Gemini API, OpenAI, Perplexity
- Sentry, ntfy, Batch API

---

# 자동 Git 관리

## content-factory 레포
- Workers 코드 (workers/*.js)
- 설정 파일 (wrangler.toml)
- PROJECT.md (배포 이력)

## 커밋 메시지 형식
```
<category>: <title>
```

**카테고리**: feature, bugfix, deprecate, improvement, security, performance, deployment, infra, docs

---

# 작업 디렉토리

- **로컬**: C:\Users\A1-M4\content-factory
  - 용도: 읽기 전용 (확인/테스트)
  - 금지: 파일 수정, git 작업, wrangler 배포

- **원본**: GitHub (jeonwoohyun85/content-factory)
  - 모든 수정: GitHub API 직접
  - 배포: GitHub Actions 자동
  - 로컬 동기화 금지 (스파게티 방지)

---

# PROJECT.md 주간 히스토리 작성 규칙

## 작성 시점
- 주가 끝날 때 (매주 토요일 또는 일요일)
- 사용자가 명시적으로 요청할 때

## 작성 양식 (매우 상세하게)

### 예시 (1월 31일 기준)
```
#### 2026-01-31 (토)
Cron 중복 실행 방지를 위해 날짜별 락 키를 적용하고 KV 락 TTL을 48시간으로 설정했다. Google Sheets 텍스트 줄바꿈을 WRAP으로 강제 적용하여 가독성을 개선했다. 최신포스팅 시트 도메인 비교 정규화를 추가하고 전체 삭제 후 append 방식으로 변경했으며, 저장소 시트에 KST 시간 표시를 적용했다. 최신 포스팅과 저장소 시트 간 데이터 정합성을 개선하여 중복 저장 및 누락 문제를 해결했다. PROJECT.md 구조를 대폭 개편하여 배포 이력 전체 230개를 날짜별로 분류하고 주간 요약 섹션을 추가했다. 자동 업데이트 워크플로우를 추가하여 배포 이력과 시스템 현황을 자동으로 관리하도록 했으며, 아키텍처 결정 및 폐기 이력 섹션을 추가했다. 이후 주간 요약을 월별 요약으로 변경하고 기술 스택 진화 섹션을 제거했다. 배포일지 일괄 업로드 워크플로우를 추가했으나 곧바로 폐기했다. Umami 통계 연동을 개선하여 '우마미'와 '우마미공유' 컬럼을 추가하고 동적 Website ID 매핑을 구현했다. 다국어 번역 기능을 대폭 강화하여 모든 UI 텍스트에 postImage와 galleryImage 다국어 지원을 추가하고, 상호명에서 언어 표시를 자동 제거하는 기능을 구현했다. Gemini 2.5 Flash API를 활용한 동적 번역 시스템을 구축하여 business_name, address, business_hours를 자동 번역하도록 했다. 번역 과정에서 템플릿 리터럴 줄바꿈 오류와 변수명 충돌 문제를 수정했으며, getClientFromSheetsForPosting 함수에도 번역 로직을 추가했다. 번역 API 토큰 부족 문제를 발견하여 maxOutputTokens를 500에서 8000으로 증가시켰다. 캐싱 기능 추가를 시도했으나 코드 복잡도로 인해 실패하여 번역 정상 작동 버전으로 롤백했다.
```

## 작성 원칙

### 1. 완전성 (절대 규칙)
- **모든 성공한 배포를 빠짐없이 포함**
- GitHub Actions에서 `conclusion: success`인 배포만 추출
- 실패한 배포는 제외
- 중복 배포는 한 번만 기록

### 2. 상세함
- 각 배포의 주요 내용을 구체적으로 서술
- 기술적 세부사항 포함 (예: "maxOutputTokens 500→8000")
- 문제 발생 및 해결 과정 명시
- 시도했으나 실패한 작업도 기록 (예: "캐싱 시도 실패 후 롤백")

### 3. 서술 형식
- 과거형 사용 ("추가했다", "구현했다", "수정했다")
- 문장 연결어 활용 ("이후", "곧바로", "과정에서")
- 시간 순서대로 나열
- 한 문단에 여러 관련 작업 그룹화

### 4. 데이터 수집 방법
```bash
# 해당 날짜의 성공한 배포만 추출 (한국 시간 기준)
gh run list --limit 100 --json conclusion,displayTitle,createdAt \
  --jq '.[] | select(.conclusion == "success") | select(.createdAt | startswith("2026-01-31"))'
```

### 5. 작성 단계
1. 해당 날짜 성공 배포 전체 조회
2. 시간 순서대로 정렬
3. 유사 작업끼리 그룹화 (예: Umami 관련, 번역 관련)
4. 각 그룹을 자연스러운 문장으로 연결
5. 기술적 세부사항 포함
6. 최종 결과 명시

### 6. 금지사항
- ❌ 요약하거나 생략 금지
- ❌ "여러 개선" 같은 애매한 표현 금지
- ❌ 실패한 배포 포함 금지
- ❌ 숫자나 구체적 정보 누락 금지

### 7. 길이 제한 없음
- 하루에 50개 배포가 있어도 전부 상세히 작성
- 문단이 길어도 괜찮음
- 완전성이 간결함보다 우선


---

# 📦 모듈화 원칙

## 기본 베이스: 모든 작업은 모듈화

**모듈화 = 기능별 분리 = 재사용 가능 = 유지보수 쉬움**

### 필수 사항
- 독립된 기능은 별도 파일/모듈로 분리
- 한 파일 = 한 책임
- 공통 로직은 유틸리티 모듈로 추출

### 예시
```
❌ 나쁜 예: 모든 로직을 main.js에 작성
✅ 좋은 예:
  - main.js (라우팅만)
  - modules/posting.js (포스팅 로직)
  - modules/sheets.js (Sheets 연동)
  - modules/gemini.js (AI 호출)
  - utils/lock.js (락 관리)
  - utils/cache.js (캐시 관리)
```

### 적용 범위
- Worker 코드
- Cloud Functions
- GAS (Google Apps Script)
- 모든 백엔드 로직
