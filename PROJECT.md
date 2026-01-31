# Content Factory 프로젝트

## 📍 현재 상태 (한눈에)

**거래처**: 2개 활성 | **병렬**: 5개 | **최대**: 4604개/일

**최근 작업**: docs: 시스템 상태 자동 동기화 스크립트 추가

**다음 단계**: 에러 로깅 추가 (Slack 또는 Sheets)

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

### 🎯 주요 마일스톤

- **2026-01-27 00:22** ✨ Google Sheets 연동 (Supabase 폐기)
- **2026-01-27 01:53** ⚡ Worker 코드 대폭 간소화 (5540줄 → 526줄)
- **2026-01-29 11:48** ✨ Cron 자동 포스팅 활성화 (매일 09:00 KST)
- **2026-01-29 15:51** ⚡ Queue 병렬 5개 처리 + 재시도 3회 추가
- **2026-01-30 17:56** ✨ Umami 통계 자동 추가
- **2026-01-30 23:08** ✨ Umami Website 자동 생성 (크론)
- **2026-01-31 00:11** 🐛 기존 Umami 웹사이트 이름 자동 업데이트
- **2026-01-31 02:53** ♻️ Umami 자동화 제거, 수동 링크 방식으로 변경
- **2026-01-31 03:05** ♻️ 코드 정리 및 Umami 수동 방식 문서화
- **2026-01-31 07:15** ⚡ Queue 병렬 처리 최적화 (Promise.all)


---

### 💡 주요 아키텍처 결정

**DB 전환 (1/26-1/27)**
- Supabase → Google Sheets
- 이유: 간단한 CRUD, 실시간 협업, 코드 대폭 간소화
- 영향: Worker 5540줄 → 526줄 (90% 감소)
- 트레이드오프: Supabase 고급 기능 포기

**Queue 시스템 도입 (1/29)**
- 동기 처리 → 비동기 병렬 처리 (5개)
- 이유: Cron 2분 timeout 회피, 처리량 5배 증가
- 성능: 100개 거래처 25분 (이론상)
- 트레이드오프: 시스템 복잡도 증가, 에러 추적 어려움

**Gemini API 멀티 모델 (1/27)**
- 단일 모델 → 2.5 Flash (검색) + 3.0 Pro (작성)
- 이유: 비용 최적화 + 품질 향상
- 성능: 검색 빠름 (Flash), 작성 정교함 (Pro)
- RPM 제한: Flash 300, Pro 150

**Cron 스케줄러 (1/27-1/29)**
- 수동 → 자동 (매일 09:00 KST)
- 동시 실행 방지: 날짜별 KV 락 (TTL 48시간)
- 상태 관리: Sheets '크론', '상태' 컬럼 자동 업데이트
- 안정성: 중복 실행 방지, 실패 시 재시도 없음


---

### 🗑️ 폐기된 시도들

**Umami 통계 자동화 (1/30-1/31) ❌**
- 시도: Umami API로 Website 자동 생성, 크론으로 관리
- 경과: 1/30 추가 → 1/31 00:11 업데이트 → 1/31 02:53 폐기 (27시간)
- 문제: API 불안정, 중복 생성 에러, 권한 이슈 반복
- 결론: 수동 링크 방식 전환 (안정성 우선)
- 교훈: 외부 API 의존 최소화, 복잡도 증가 경계

**D1 Analytics (1/30) ❌**
- 시도: Cloudflare D1 기반 자체 통계 시스템
- 경과: 1/30 18:45 추가 → 1/30 20:34 Revert (2시간)
- 문제: 파일 분할로 Worker 구조 깨짐, 배포 실패
- 결론: Plausible Analytics 사용
- 교훈: 단일 파일 구조 유지 (Workers 제약)

**Supabase (1/26 이전) ❌**
- 시도: Supabase DB + Auth + Storage
- 경과: 1/26 신규 프로젝트 연동 → 1/27 00:22 폐기 (24시간)
- 문제: 과도한 복잡도 (5540줄), 단순 CRUD에 과한 스펙
- 결론: Google Sheets로 전환
- 교훈: 요구사항에 맞는 최소 기술 선택

**Posts 시트 (1/28) ❌**
- 시도: 별도 Posts 시트로 포스팅 관리
- 경과: 1/27 추가 → 1/28 폐기 (1일)
- 문제: 저장소/최신포스팅 2개 시트로 충분
- 결론: 3개 탭 구조 확정 (관리자/저장소/최신포스팅)
- 교훈: 중복 구조 제거, 단순화


---

### 🔧 기술 스택 진화

**데이터베이스**
```
Firebase (초기) → Supabase (1/26) → Google Sheets (1/27~현재)
```
- 최종: Google Sheets (CSV export, 실시간 협업)

**통계 시스템**
```
D1 Analytics (1/30) → Plausible (1/30) → Umami 자동화 (1/30) → Umami 수동 (1/31~현재)
```
- 최종: Umami Cloud (수동 링크 관리)

**AI 모델**
```
Gemini 1.5 Pro (초기) → 2.0 Flash (1/27) → 2.5 Flash + 3.0 Pro (1/27~현재)
```
- 최종: 2.5 Flash (검색) + 3.0 Pro (작성)

**비동기 처리**
```
동기 (초기) → ctx.waitUntil (1/29) → Queue (1/29~현재)
```
- 최종: Cloudflare Queue (병렬 5개, 재시도 1회)

**Worker 구조**
```
5540줄 (Supabase) → 526줄 (Sheets) → 2900+줄 (현재)
```
- 최종: 단일 파일, 기능 추가로 점진적 증가

---

### 📅 주간 요약

#### 1주차 (01/26-02/01)
**주요 흐름**: 시스템 구축 → 인프라 전환

- **월 01/26**: Supabase 신규 프로젝트 연동 및 동적 페이지 생성, 갤러리 섹션 Info로 변경 및 부제목 삭제 (7건)
- **화 01/27**: add /generate-post endpoint and update Gemini mode, 포스트 삭제 기능 추가 (비밀번호: 55000) (89건)
- **수 01/28**: 폴더명 컬럼 추가 (정확한 Drive 폴더 검색), Posts 폐기, 저장소+최신포스팅 3개 탭 구조로 확정 (52건)
- **목 01/29**: /test-cron 엔드포인트 추가, 구독/상태 컬럼 분리 및 자동 상태 업데이트 (55건)
- **금 01/30**: 통계 첫 방문 시 자동 생성 (상호명), Umami Website 자동 생성 (크론) (13건)
- **토 01/31**: 포스팅 URL 자동 생성 및 저장 기능 추가, 포스팅 URL 자동 저장 (14건)


---

---

### 📋 상세 타임라인

### 2026-01-31 - 데이터 정합성 개선
**16:32** 🐛 [bugfix] 최신 포스팅 및 저장소 시트 데이터 정합성 개선
  - - 최신 포스팅: 도메인별 기존 행 전체 삭제 (누적 방지)
  - - 저장소/최신: 생성일시 datetime 형식 적용 (시간 표시)
**16:13** 🐛 [fix] 최신포스팅 도메인 비교 정규화
**13:54** 🐛 [fix] Queue 핸들러 복구 및 WRAP 적용
**13:25** 🐛 [bugfix] Cron 중복 실행 방지 (날짜별 락 키)
**07:15** ⚡ [improvement] Queue 병렬 처리 최적화 (Promise.all)
**04:36** 🔍 [debug] 저장소 저장 디버그 로그 추가
**04:19** ✨ [feat] 포스팅 URL 자동 생성 및 저장 기능 추가
**04:10** 🐛 [fix] 저장소 시트 헤더 조회 조건 수정 (데이터 없어도 헤더 반환)
**03:53** 🔧 [chore] Worker 재배포 트리거
**03:29** ✨ [feature] 포스팅 URL 자동 저장
  - - 최신 포스팅/저장소 시트에 URL 컬럼 추가
  - - 포스팅 생성 시 {domain}/post?id={timestamp} 형식으로 자동 저장
  - - URL 인코딩 적용
**03:25** 🐛 [fix] 빈 try 블록 제거 (문법 에러 수정)
**03:05** ♻️ [refactor] 코드 정리 및 Umami 수동 방식 문서화
  - 코드 정리:
  - - UMAMI_API_KEY 상수 삭제 (사용 안 함)
  - - 중복 스크립트 제거 (718줄)
  - - 빈 줄 정리
  - PROJECT.md 업데이트:
**02:53** ♻️ [refactor] Umami 자동화 제거, 수동 링크 방식으로 변경
  - 자동화 로직 전체 제거:
  - - 자동 통계 버튼 제거
  - - /stats 자동 생성 제거
  - - createUmamiWebsite 함수 제거
  - - 크론 Umami 생성 제거
**00:11** 🐛 [fix] 기존 Umami 웹사이트 이름 자동 업데이트
  - 생성 실패 시 기존 웹사이트 찾아서 이름 업데이트
  - - 중복 생성 에러 해결
  - - 모든 거래처 상호명으로 표시
  - - Umami Cloud 수동 삭제 불필요

### 2026-01-30 - 통계 기능 실험
**23:46** 🐛 [fix] 기본값 shareId도 재생성
  - 통계ID가 기본값(1cf65ebd4541c5fb)이면 재생성
  - - 00001, 00003도 상호명으로 변경됨
  - - 모든 거래처 상호명 표시
**23:41** 🐛 [fix] 통계ID 없으면 무조건 재생성
  - 통계ID 컬럼 없을 때 KV 무시하고 항상 새로 생성
  - - 기존 KV 자동 덮어쓰기
  - - 모든 거래처가 상호명으로 표시됨
  - - 컬럼 삭제 시 전체 리셋 효과
**23:36** ✨ [feature] 통계 첫 방문 시 자동 생성 (상호명)
  - /stats 첫 클릭 시 Umami 웹사이트 즉시 생성
  - - 도메인 생성 즉시 통계 작동 (크론 대기 불필요)
  - - 웹사이트 이름: 거래처 상호명 (business_name)
  - - KV 저장 + Google Sheets 자동 입력 시도
  - - 실패 시 기본값으로 폴백
**23:08** ✨ [feature] Umami Website 자동 생성 (크론)
  - - 크론: 통계ID 없는 거래처 감지 → Umami API 호출 → Website 생성
  - - 공유 링크 생성 후 KV에 임시 저장 (umami_share_{subdomain})
  - - /stats: Sheets 통계ID → KV → 기본값 순으로 확인
  - - D1 Analytics 정리 코드 제거
  - - 로그에 수동 작업 안내 출력 (Sheets에 shareId 입력)
**23:05** ⚡ [improvement] Google Sheets '통계ID' 컬럼 연동
  - - /stats 리다이렉트 시 Sheets의 '통계ID' 컬럼 사용
  - - 기본값: 00001 공유 ID (1cf65ebd4541c5fb)
**21:22** ✨ [feature] Plausible 추적 스크립트 추가
  - 게시글/거래처 페이지 head에 Plausible Analytics 스크립트 추가
  - - 프라이버시 친화적 분석 도구
  - - D1 기반 커스텀 분석 시스템 대체 준비
**20:47** 🐛 [bugfix] API 호출과 정적 리소스를 방문 통계에서 제외
  - /stats/api/* API 호출이 방문으로 카운트되던 문제 수정
  - favicon, 이미지 등 정적 리소스 요청 제외
  - 이제 실제 페이지 방문만 카운트됨
**20:44** 🐛 [bugfix] 템플릿 리터럴 변수 치환 수정
  - ${siteTitle} ->  변경으로 사이트 제목 표시 수정
**20:42** 🐛 [bugfix] Worker 파일 손상 수정
  - curl progress 메시지가 파일에 포함되어 배포 실패
  - 정상 커밋(10a4d51)에서 파일 복구 후 SPA 수정 재적용
**20:34** 🔹 [Revert "refactor] SPA 방식 통계 구현 (파일 분할)"
  - This reverts commit 17b6e5511af9426ce262114383ebf12f9ec8f4b0.
**18:45** ✨ [feature] D1 기반 통계 기능 추가
  - - SHA-256 해싱 및 방문자 추적 (recordVisit)
  - - 통계 조회 핸들러 (handleStats)
  - - 8가지 통계 차트 (전체/오늘/주간/월간, 국가/도시/유입/페이지별, 시간대별, 실시간)
  - - /stats 경로 처리 및 자동 버튼 추가
  - - 90일 이상 오래된 데이터 자동 정리 (scheduled)
**17:56** ✨ [feature] Umami 통계 자동 추가
  - - Umami 추적 스크립트 삽입
  - - 통계 바로가기 자동 생성
  - - 도메인별 자동 추적
**17:32** ⚡ [improvement] 포스트 표시 2개→1개로 변경
  - - UI: 포스트 섹션 1열 그리드로 변경
  - - Sheets: 최신 포스팅 1개만 유지
  - - 위 섹션과 크기/간격 통일

### 2026-01-29 - 성능 최적화 및 안정화
**21:40** 🐛 [bugfix] 포스팅 언어 설정 누락 수정
  - - 포스팅 생성 프롬프트에 언어 지시 추가
  - - 관리자 시트 언어 컬럼 값 그대로 반영
  - - 동적 언어 지원 (한국어, 일본어, English, 태국어 등)
**21:28** 🚀 [performance] 저장소 시트 중복 읽기 제거
  - - getLastUsedFolderForPosting 함수 반환값 변경 (헤더 포함)
  - - saveToLatestPostingSheet 함수에서 저장소 헤더 재조회 제거
  - - API 호출 1회 절감 (포스팅 1개당)
**20:53** 🔍 [debug] 디버그 엔드포인트 추가 (v3)
**20:52** 🔍 [debug] 웹 검색 Gemini API 응답 로깅 추가
**20:51** 🔍 [debug] Gemini API 응답 로깅 추가
**20:45** ⚡ [improvement] 포스팅 생성 시 언어 명시적 지시 추가
  - - Gemini API 프롬프트에 언어 지시 강화
  - - 제목과 본문 전체를 해당 언어로 작성하도록 명확히 지시
  - - 00003(일본어) 등 다국어 거래처 포스팅 정상화
**19:36** 🧹 [cleanup] 디버깅 로그 제거
  - 행 높이 설정 정상 작동 확인
**19:33** 🐛 [fix] 행 높이 설정 정규식 개선
  - - 다양한 updatedRange 형식 지원
  - - /:(\d+)$/ → /(\d+)(?::\w\d+)?$/
  - - "A2:I2", "시트!A2:I2" 모두 매칭
**19:28** 🔍 [debug] 행 높이 설정 디버깅 로그 추가
  - - updatedRange 값 확인
  - - rowMatch 결과 확인
  - - 원인 파악용 임시 로그
**19:08** ✨ [feature] /test-cron 엔드포인트 추가
  - - Cron 수동 테스트용 엔드포인트
  - - 활성 거래처 조회 → Queue 등록
  - - 실제 Cron과 동일한 로직
  - - Lock 없이 테스트 가능
**18:59** ⚡ [improvement] 저장소/최신포스팅 시트 행 높이 고정
  - - 새 포스팅 추가 시 행 높이 21px 강제 지정
  - - 텍스트 줄바꿈 CLIP 설정 (자르기)
  - - 본문/이미지 길이와 무관하게 시트 정리
**18:38** ⚡ [improvement] Gemini API timeout 120초로 증가
  - Flash 30초 → 120초
  - Pro 60초 → 120초
**15:52** ⚡ [improvement] Queue 재시도 3회 → 1회로 조정
**15:51** ⚡ [improvement] Queue 병렬 5개 처리 + 재시도 3회 추가
  - - max_batch_size: 1 → 5 (동시 5개 처리)
  - - max_retries: 3 (실패 시 자동 재시도)
  - - 처리량: 4000개 거래처까지 안전
  - - 1000개 기준 4.2시간 처리
**15:26** ⚡ [improvement] TTL 23시간 59분으로 변경 (크론 타이밍 충돌 방지)
**12:25** 🐛 [bugfix] 상태 컬럼 업데이트 스코프 오류 수정
  - - adminHeaders/targetRowIndex 스코프 문제 해결
  - - 상태 업데이트를 크론 업데이트와 같은 try-catch 블록으로 이동
  - - 포스팅 성공 시 상태 = "성공" 정상 작동
**12:22** ✨ [feature] 구독/상태 컬럼 분리 및 자동 상태 업데이트
  - - normalizeClient: 구독/상태 매핑 추가
  - - 필터링: subscription === '활성'
  - - 포스팅 성공 시 상태 = "성공" 자동 기록
  - - 관리자 시트 동적 감지
**12:07** ✨ [feature] 스마트스토어 링크 아이콘 추가
  - - smartstore.naver.com, brand.naver.com 감지
  - - 아이콘: 🛒 스토어
  - - 언어별 텍스트: 한/영/일/중(간체)/중(번체)
**11:56** ✨ [feature] 크론 예정 시간 자동 업데이트
  - - 포스팅 완료 후 관리자 시트 "크론" 컬럼 자동 업데이트
  - - 다음 예정 시간: 내일 09:00 (KST)
  - - 형식: "YYYY-MM-DD HH:mm"
  - - getColumnLetter() 헬퍼 함수 추가
**11:48** ✨ [feature] Cron 자동 포스팅 활성화 (매일 09:00 KST)
  - - crons = ["0 0 * * *"] 활성화
  - - UTC 00:00 = 한국시간 09:00
  - - 매일 자동 포스팅 생성
**11:46** 🐛 [bugfix] Worker 빈 파일 복구
  - - 배포 실패 원인: 빈 파일(0 bytes) 푸시
  - - 이전 정상 버전(d32fc0a)으로 복원
  - - post1/post2 로직 제거는 다음 커밋에서 진행
**08:52** ✨ [feature] Cron 자동 포스팅 안정화 및 이미지 선택사항 적용
  - - 이미지 없어도 텍스트 포스팅 생성 가능
  - - Gemini 프롬프트: 이미지 유무에 따라 분기
  - - Cron 동시 실행 방지 (KV 플래그)
  - - 배치 처리 (10개씩 Queue 전송)
  - - 중복 체크 삭제 (매일 무조건 실행)
**08:43** 🐛 [bugfix] 포스팅 생성 주요 버그 수정
  - - API 중복 호출 제거 (accessToken 재사용)
  - - fetchWithTimeout 적용 (타임아웃 설정)
  - - 에러 핸들링 추가 (try-catch, HTTP status 체크)
  - - 트랜잭션 방식 저장 (최신 포스팅 성공 → 저장소 저장)
  - - Race Condition 완화 (데이터 손실 방지)
**08:32** ⚡ [improvement] Queue 무한 루프 방지 및 API 중복 호출 제거
  - - Queue 실패 시 재시도 제거 (무한 루프 방지)
  - - 시트 메타데이터 조회 4번 → 1번 (API 호출 75% 감소)
**08:17** 🐛 [bugfix] 저장소 시트 열 간격을 관리자 시트 기준으로 복사하도록 수정
**08:05** 🔍 [debug] 저장소 시트 열 너비 복사 로그 및 에러 처리 강화
**07:58** ⚡ [improvement] 저장소 시트 열 간격을 최신 포스팅 시트와 동일하게 맞춤
**07:51** ⚡ [improvement] 관리자 시트 열 너비를 저장소/최신 포스팅 시트에 복사 적용
**07:43** 🐛 [bugfix] 폴더 순환 로직 수정 (시트 URL 인코딩)
**07:39** ⚡ [improvement] 본문 길이 조정(공백 포함 2800~3200자), KST 시간 중복 변환 제거, 셀 간격 자동 정렬
**07:20** ⚡ [improvement] 웹 검색 트렌드 정보 본문 반영 프롬프트 추가
**07:13** 🐛 [bugfix] Sheets API append URL 형식 수정 (/append → :append)
**07:11** 🐛 [bugfix] 시트 append 에러 체크 추가
**07:09** ⚡ [improvement] test-sheet 엔드포인트에 저장소 시트도 확인
**07:08** 🐛 [bugfix] test-sheet 엔드포인트 추가 (시트 데이터 디버깅용)
**07:01** 🔍 [debug] 테스트 엔드포인트 추가 (/test-posting)
  - - Queue 우회하고 직접 generatePostingForClient 실행
  - - 전체 결과와 logs 반환
  - - 에러 디버깅용
**06:55** 🔍 [debug] Queue consumer 에러 로깅 강화
  - - 결과 전체 JSON 출력
  - - 실패 시 logs 배열 출력
  - - 에러 스택 트레이스 출력
**06:35** 🐛 [bugfix] 포스트 본문과 이미지 저장 및 표시 기능 추가
  - - Google Sheets에 "본문", "이미지" 컬럼 추가됨
  - - saveToLatestPostingSheet: 본문과 이미지 URL 저장
  - - getPostsFromArchive: 본문과 이미지 데이터 읽기
  - - 이미지 URL: Google Drive thumbnail (w800)
**06:32** ⚡ [improvement] 모든 시간을 한국 서울 시간(KST)으로 통일
  - - Scheduled handler의 로그 시간 KST 변경
  - - 오늘 포스팅 체크 시 KST 기준 적용
  - - 기존에 이미 KST 사용 중인 부분들:
  - • formatKoreanTime() - 화면 표시
  - • saveToLatestPostingSheet() - 시트 저장
**06:27** 🐛 [bugfix] 시트 이름 URL 인코딩 추가
  - - 한글 시트 이름 인코딩 (Sheets API 400 에러 수정)
**06:26** 🔍 [debug] 자세한 에러 로깅 추가
  - - 토큰 발급 에러 별도 처리
  - - Sheets API 응답 상태 확인
  - - 에러 스택 트레이스 추가
**01:36** 🔍 [debug] OAuth token 응답 에러 처리 강화
  - - tokenResponse 상태 확인 추가
  - - 빈 응답 체크 추가
  - - 자세한 에러 메시지 반환
**01:34** 🐛 [bugfix] JWT base64url 인코딩 수정 (포스트 표시 문제)
  - - btoa()를 base64urlEncode()로 변경 (UTF-8 안전)
  - - "Unexpected end of JSON input" 에러 수정
**01:32** 🔍 [debug] 포스트 에러 로깅 추가 (디버깅용)
  - - getPostsFromArchive 함수가 에러 정보 반환하도록 수정
  - - debugInfo에 postsError 추가
  - - 홈페이지 포스트 표시 문제 원인 파악용
**01:27** 🐛 [bugfix] 홈페이지 포스트 표시 버그 수정 (최신 포스팅 시트에서 읽기)
**01:13** 🐛 [bugfix] 언어 인식 및 마크다운 링크 파싱 버그 수정
  - - 언어 매칭에 '한국' 키워드 추가 (한국어 인식 오류 해결)
  - - 마크다운 링크 [텍스트](URL) 형식 파싱 추가 (중첩 URL 오류 해결)
**00:57** 🐛 [bugfix] Google Sheets API append 경로 수정 (:append -> /append)
**00:43** ⚡ [improvement] Queue 백그라운드 처리 (ctx.waitUntil 대체)
**00:37** ⚡ [improvement] ctx.waitUntil() 백그라운드 처리 (timeout 회피)
**00:30** 🐛 [bugfix] Gemini 3 Flash 모델명 수정 (gemini-3-flash-preview)
**00:24** ⚡ [improvement] 웹검색 3.0 Flash + 이미지 w400 최적화
**00:18** 🔹 [revert] 이미지 10개로 복구
**00:18** 🏗️ [infra] Workers Unbound 모드 활성화 (CPU 30초)
**00:04** 🐛 [bugfix] 이미지 5개로 제한 (Gemini timeout 방지)
**00:00** 🐛 [bugfix] Gemini API HTTP 응답 상태 확인 추가

### 2026-01-28 - 기능 확장 및 실험
**23:56** 📦 [deployment] Worker 재배포 트리거
**23:53** 🔹 [Merge branch 'main' of https] //github.com/jeonwoohyun85/content-factory
**23:44** ⚡ [improvement] 포스팅 글자수 조정 (실제 3500자 목표)
  - - 웹검색: 1000자 → 500자 (maxOutputTokens: 600)
  - - 포스팅: 3000~3500자 → 2800~3200자
  - - AI가 20~30% 더 길게 작성하는 경향 반영
  - - 최종 출력: 약 3200~3800자 범위 (평균 3500자)
**23:04** ♻️ [refactor] 모든 시트 컬럼 동적 매핑으로 전환 (순서 무관)
  - - getPostsFromArchive: headers.indexOf로 동적 컬럼 매핑
  - - getLastUsedFolderForPosting: headers.indexOf로 동적 컬럼 매핑
  - - deletePost: 저장소/최신 포스팅 탭 모두 동적 인덱스 사용
  - - saveToLatestPostingSheet: 헤더 읽기 후 순서 맞춰 데이터 배열 생성
  - 이제 Google Sheets에서 컬럼 순서를 자유롭게 변경해도 코드가 정상 작동합니다.
**22:50** 🐛 [fix] 폴더 순환 로직 수정 (저장소 탭 기반)
**21:55** ♻️ [refactor] 관리자 탭 post 컬럼 제거, 저장소 탭 기반으로 전환
**21:46** 🐛 [fix] 시트 조회 JSON 파싱 에러 수정
**21:44** 🔹 [temp] 시트 조회 엔드포인트 추가 (/check-sheets)
**21:39** ✨ [feature] 폴더명 컬럼 추가 (정확한 Drive 폴더 검색)
**21:31** ✨ [feature] Posts 폐기, 저장소+최신포스팅 3개 탭 구조로 확정
**21:22** ✨ [feature] 저장소+최신포스팅 동적 관리 (거래처당 2개만 유지)
**21:15** ✨ [feature] 최신 포스팅 시트 자동 저장 추가
**21:00** ✨ [feature] 무제한 언어 지원 추가 (API + 캐싱)
  - - 주요 5개 언어 하드코딩 (한/영/일/중간/중번)
  - - 나머지 언어는 Gemini 2.5 Flash API 호출
  - - Worker 메모리 캐싱으로 비용 최소화
  - - 시트 언어 컬럼 값 그대로 사용 (무제한 지원)
**20:39** ✨ [feature] 언어별 거래처 페이지 다국어 지원 추가
  - - 언어 컬럼 값에 따라 페이지 레이아웃 다국어 표시
  - - 한글, 영어, 일본어, 중국어 지원
  - - Info/Video/Posts 섹션 제목 다국어화
  - - 바로가기 링크 텍스트 다국어화
  - - 기본값: 한글
**20:26** 🐛 [bugfix] 유효하지 않은 바로가기 링크 필터링
  - http/https/tel: 로 시작하는 유효한 URL만 표시
**20:06** 🐛 [bugfix] Info 섹션 구글 드라이브 URL 썸네일 변환 추가
**19:51** 🐛 [bugfix] 관리자 탭(gid=0) CSV URL로 수정
  - - 기존: gid=1895987712 (최신 포스팅 탭 - 주소/연락처/영업시간 없음)
  - - 변경: gid=0 (관리자 탭 - 모든 거래처 정보 포함)
  - - 변경 위치: getClientFromSheets, handleSitemap, getClientFromSheetsForPosting
**19:29** 🔹 [other] wrangler.toml 시트 GID 환경변수 수정
**18:43** 🔹 [other] CSV 헤더 파싱 개선 (BOM/공백 제거)
**18:35** 🔹 [other] 시트 GID 수정 및 구독 체크 해제
**17:33** 🔹 [other] '바로가기' 컬럼 매핑 추가
**17:25** 🔹 [other] 환경변수 관리 적용 및 wrangler.toml 생성 (보안 강화)
**17:10** ✨ [feature] Info 폴더 대소문자 구분 없이 검색
**16:22** ✨ [feature] 상태값 '구독/미구독'으로 변경, 거래처_정보 매핑 추가
**16:12** ✨ [feature] 한글 컬럼명 지원 추가
**10:05** 🐛 [bugfix] 시트 이름 수정 (Content Factory → ContentFactory)
**05:38** ⚡ [improvement] Dual-save 구조로 변경 (Content Factory + Posts)
**05:20** ⚡ [improvement] Posts 시트 역순 검색 적용
**05:19** ⚡ [improvement] Posts 시트 기반 포스팅 저장으로 변경
**04:52** 🔍 [debug] Posts 시트 헤더 확인용 임시 엔드포인트 추가
**04:03** ⚡ [improvement] industry 컬럼 기반 웹 검색 적용
**03:36** ⚡ [improvement] Posts 시트를 Content Factory 시트로 통합 (중복 제거)
**03:26** 🚀 [performance] 이미지 다운로드 병렬화 (속도 3-5배 향상)
**03:21** 🐛 [bugfix] Posts 시트 컬럼 복구 함수 추가 (G1에 folder_name 헤더 추가)
**03:09** 🐛 [bugfix] Retention Policy 원복 (최신 2개 유지)
**03:05** 🐛 [bugfix] Retention Policy 로직 완전 수정 (모두 삭제 후 추가)
**03:04** 🐛 [bugfix] Retention Policy 로직 수정 (>= 2 -> >= 1)
**02:57** ⚡ [improvement] Posts 시트 subdomain을 클릭 가능한 도메인 형태로 저장 + Retention Policy 개선
**02:46** 🐛 [bugfix] saveToPostsSheetForPosting에 normalizedSubdomain 변수 정의 추가
**02:32** 🐛 [bugfix] Posts 시트 저장 시 subdomain 정규화 (00001.make-page.com → 00001)
**02:26** 🐛 [bugfix] Drive 검색 시 subdomain 정규화 (00001.make-page.com → 00001)
**02:23** ⚡ [improvement] Drive 폴더 검색 개선 (contains 연산자 사용)
  - - subdomain 포함 여부로 검색하여 폴더명 유연성 향상
  - - "00001 상상피아노", "00001.make-page.com 상상피아노" 등 모두 검색 가능
**02:18** ⚡ [improvement] 코드 품질 개선 (중복 코드 제거, 2670 chars 감소)
  - - 중복된 deleteRowIndex 체크 제거
  - - CSV 파싱 로직을 parseCSV() 함수 재사용으로 통합
  - - JWT 생성 로직을 getGoogleAccessTokenForPosting() 재사용으로 통합
  - - 불필요한 generatePosting() 래퍼 함수 제거
**02:07** ⚡ [improvement] Gemini 1.5 Pro → 3 Pro Preview 모델 변경
**00:47** 🔹 [other] 🔧 [설정] 테스트를 위해 Cron Trigger 일시 비활성화
**00:45** 🔹 [♻️ [정책] 포스팅 유지 정책 변경] 최신 2개만 유지하고 오래된 포스트 자동 삭제
**00:37** 🔹 [💄 [디자인] 포스트 목록 그리드 레이아웃 최적화] PC 2열, 모바일 1열 적용
**00:31** 🔹 [other] ⚡ [개선] 포스트 삭제 버튼 제거 및 목록 노출 개수 변경 (3개 -> 2개)
**00:22** 🔹 [🔥 [긴급] 포스트 삭제 로직 변경] 날짜 무시하고 해당 업체의 최신 글 강제 삭제
**00:12** 🔹 [🐛 [버그] 포스트 삭제 로직 강화] 정확한 일치 대신 시간 차이가 가장 적은 포스트 검색 (1분 이내)
**00:09** 🔹 [other] 🐛 [버그] 포스트 삭제 날짜 비교 로직 개선 (숫자 추출 비교 방식 적용)
**00:05** 🔹 [other] 🐛 [버그] 포스트 삭제 시 날짜 비교 오차 허용(1분) 및 문자열 타입 강제 변환 적용

### 2026-01-27 - 시스템 기반 구축
**23:45** 🔹 [other] ✨ [feature] Complete automated posting system with Scheduled handler
**23:02** ✨ [feat] add /generate-post endpoint and update Gemini model to 1.5-pro
**23:01** 🐛 [fix] improve date comparison logic in deletePost to prevent 400 errors
**22:49** ⚡ [improvement] 포스팅 생성 최적화 (이미지 10개 제한, 썸네일 사용, Sheets API 전환)
**22:22** ⚡ [improvement] Retention Policy 제거 - 모든 포스트 보관
**21:49** ♻️ [refactor] implemented 1 client 1 post retention policy and updated deletion UI
**21:37** 🔹 [Feat] Implement single post retention policy
**21:32** 🔹 [Refactor] Move post delete button to detail page
**18:52** ✨ [feature] 포스트 삭제 기능 추가 (비밀번호: 55000)
**18:41** 🗑️ [deprecate] wrangler-posting-generator.toml 삭제 (Worker 폐기)
**18:41** 🗑️ [deprecate] posting-generator.js 삭제 (make-page-subdomain에 통합됨)
**18:30** ⚡ [improvement] posting-generator 로직을 make-page-subdomain에 통합
  - - HTTP 호출 오버헤드 제거
  - - 단일 worker로 통합하여 배포/관리 단순화
  - - GEMINI_API_KEY 추가
  - - 모든 포스팅 생성 함수를 make-page-subdomain.js로 이동
**18:24** ⚡ [improvement] 폐기 코드 정리 (일회성 함수 및 백업 파일 제거)
  - - make-page-subdomain.js.backup 삭제
  - - getRecentPostsOLD_CSV 함수 제거
  - - 일회성 엔드포인트 제거 (create-posts-sheet, update-posts-header, fix-posts-row-height, rename-sheet1)
  - - 일회성 함수 제거 (createPostsSheet, updatePostsHeader, fixPostsRowHeight, renameSheet1)
**18:20** 🐛 [bugfix] Sheet1 이름 변경 함수를 직접 구현
**18:17** ✨ [feature] Sheet1 이름 변경 프록시 엔드포인트 추가
**18:12** ✨ [feature] Sheet1 이름을 ContentFactory로 변경하는 엔드포인트 추가
**18:06** 🐛 [bugfix] 포스트 라우팅 버그 수정 (개별 포스트 페이지 연결)
**17:59** ✨ [feature] Posts 섹션 3개 그리드 레이아웃으로 변경
**17:17** 🐛 [bugfix] 포스팅 본문 3000~3500자 제한 다시 추가
**17:12** ✨ [feature] 이미지 개수만큼 문단 생성하도록 프롬프트 수정
**17:07** ✨ [feature] 포스트 이미지와 본문 인터리브 방식으로 변경
**16:49** 🐛 [bugfix] Posts 시트 컬럼 확장 후 헤더 업데이트
**16:47** ✨ [feature] Posts 헤더 업데이트 및 포스팅 생성 엔드포인트 추가
**16:44** ✨ [feature] Posts 시트 헤더 업데이트 엔드포인트 추가
**16:40** ✨ [feature] 포스트에 이미지 추가 (Google Drive thumbnail)
**16:34** ✨ [feature] 포스트 상세 페이지 추가 (/post 경로)
**16:21** 🐛 [bugfix] getRecentPosts에 env 파라미터 전달
**16:18** 🐛 [bugfix] make-page-subdomain worker에 Google Sheets 환경변수 추가
**16:15** 🐛 [bugfix] Posts 조회를 CSV에서 Service Account API로 변경
**16:09** ✨ [feature] Posts 최신 1개만 표시 + 한국 시간(KST) 적용
**16:03** ✨ [feature] Posts 1개만 표시 + 행 높이 21px 조정 기능 추가
**15:55** 🐛 [bugfix] Base64 인코딩 스택 오버플로우 수정 (청크 단위 처리)
**15:53** 🔍 [debug] 이미지 조회 전체 과정 로그 추가 + 확장자 제한 제거
**15:49** 🐛 [bugfix] Service Account에 Drive API 권한 추가
**15:46** 🔍 [debug] logs 배열에 Drive API 응답 추가
**15:43** 🔍 [debug] 폴더 검색 로그 추가
**15:41** 🐛 [bugfix] Info/Video 필터링 대소문자 구분 제거
**15:36** 🐛 [bugfix] Drive 폴더명 수정 (subdomain + business_name)
**15:32** ✨ [feature] 폴더 내 모든 이미지를 Gemini에 전달 + 웹검색 1000자 + 포스팅 3000~3500자
**15:24** ✨ [feature] Google Drive 폴더 순환 로직 구현 (Info/Video 제외)
**15:17** ✨ [feature] Gemini 2.5 Flash + 3.0 Pro 적용
**15:09** 🐛 [bugfix] Gemini 모델 변경 (gemini-2.0-flash-exp)
**15:06** 🐛 [bugfix] Gemini 모델 변경 (gemini-1.5-pro)
**15:04** 🐛 [bugfix] Gemini API 응답 검증 추가
**15:01** ✨ [feature] Posts 시트 조회 기능 구현
**14:56** ✨ [feature] Posts 시트 자동 생성 기능 추가
**11:48** 🐛 [fix] Gemini API 키 코드에 직접 작성 (private repo)
**11:43** ✨ [feature] 포스팅 자동 생성 시스템 추가 (Gemini API, Posts 섹션)
**11:27** ⚡ [improvement] 하단 푸터 제거 (중복 정보 삭제)
**10:45** ⚡ [improvement] Video 섹션 모바일 최적화 복구 (모바일 1열, PC 2열)
**10:42** ⚡ [improvement] Video 섹션 모바일/PC 동일하게 2열로 변경
**10:37** ⚡ [improvement] 섹션 max-width 1200px 복구 (모바일 최적화)
**10:33** ⚡ [improvement] info_images 컬럼명을 info로 변경
**10:31** ⚡ [improvement] Info/Video 섹션 모두 풀 너비로 변경
**10:21** ⚡ [improvement] Video 섹션 풀 너비로 변경 (양옆 공백 제거)
**10:15** ✨ [feature] Video 섹션 구현 (YouTube/Drive/TikTok/Instagram 지원, 모바일 최적화 16:9)
**09:57** ⚡ [improvement] description 텍스트 제거 (AI 참고용으로만 사용)
**09:53** ✨ [feature] Info 섹션 라이트박스 구현 (이미지 확대/이전/다음/ESC 닫기)
**09:31** ⚡ [improvement] 모바일/PC 동일한 레이아웃으로 통일 - Info 사진 3열 고정
**09:24** ⚡ [improvement] Remove debug logging, keep dynamic column detection
**09:21** ⚡ [improvement] Add debug logging for header detection
**09:16** 🐛 [bugfix] Worker가 헤더 이름으로 컬럼 찾도록 수정
  - - 하드코딩된 인덱스 8 제거
  - - 동적으로 info_images 컬럼 위치 탐색
  - - 컬럼 순서 변경해도 작동하도록 개선
**04:28** 🧹 [cleanup] 폐기된 wrangler 설정 파일 삭제
**04:26** 🧹 [cleanup] 폐기된 Workers 삭제 + CLAUDE.md, PROJECT.md 업데이트
  - - 삭제: daily-monitor, failed-postings-retry, token-monitor, caps-image-proxy, posting-queue-consumer
  - - 유지: make-page-subdomain, drive-to-sheets, umami-proxy
  - - 인프라 최종 확정: Google Sheets + Google Drive + Cloudflare Workers
**04:21** ⚡ [improvement] subdomain 컬럼 '00001' 또는 '00001.make-page.com' 둘 다 지원
**04:14** ⚡ [improvement] Cron 임시 비활성화 (테스트 중)
**04:14** ⚡ [improvement] Info 섹션 최대 6개 랜덤 표시 (3열 그리드)
**04:09** 🐛 [bugfix] 중복 URL 방지 로직 추가
**04:05** 🐛 [bugfix] CSV 파서 개선 - 큰따옴표로 감싸진 필드 처리
**03:54** ⚡ [improvement] Cron 주기 5분 → 1분으로 변경 (테스트용)
**03:46** 🐛 [bugfix] 시트 이름 Sheet1로 복원
**03:44** 🐛 [bugfix] 시트 이름 Sheet1 → 시트1로 수정
**03:42** 🔍 [debug] 상세 로그 추가 - Sheets 업데이트 실패 원인 파악
**03:35** 🐛 [bugfix] 재귀 검색 제거 및 직접 검색으로 타임아웃 해결
**03:26** 🔍 [debug] 응답에 상세 로그 포함
**03:24** 🔍 [debug] OAuth 토큰 및 Drive API 응답 로그 추가
**03:19** 🔍 [debug] business folders 검색 로그 추가
**03:17** 🔍 [debug] Worker 응답에 상세 정보 추가
**03:09** 🐛 [bugfix] 재귀 검색 로직 수정
  - - 전체 Drive 검색 금지
  - - 각 business 폴더 아래만 재귀적으로 검색
  - - /콘텐츠팩토리/상상피아노/Info/ 하위 모든 이미지 검색
**03:07** 🔍 [debug] 디버깅 로그 추가
**03:05** ✨ [feature] 모바일 최적화 이미지 URL 생성
  - - Google Drive 썸네일 API 사용 (sz=w800)
  - - 800px 너비로 자동 리사이징
  - - 모든 이미지 포맷 지원 (jpg, png, webp, gif)
  - - 무료, 즉시 적용
**03:00** ⚡ [improvement] 시간 제한 제거 + 재귀 검색 지원
  - - 10분 제한 제거: 모든 사진 검색
  - - 재귀 검색: 하위 폴더 이미지 모두 검색
  - - /콘텐츠팩토리/상상피아노/info/ 하위 모든 사진 감지
**02:56** ✨ [feature] Drive to Sheets 상호명 매칭 지원
  - - 폴더명에서 business_name 추출
  - - Google Sheets에서 business_name 또는 subdomain으로 매칭
  - - /콘텐츠팩토리/상상피아노/INFO/photo.jpg -> '상상피아노'로 매칭
**02:54** 🐛 [bugfix] Drive to Sheets subdomain 추출 로직 수정
  - - 재귀적으로 하위 폴더 파일 검색
  - - 전체 경로 구축 후 subdomain 추출
  - - /콘텐츠팩토리/00001/INFO/photo.jpg -> 00001
**02:50** 🐛 [bugfix] 코드 품질 체크 오탐 수정 + 백업 파일 삭제
  - - 백업 파일 삭제: make-page-subdomain-backup.js, make-page-subdomain-old-5540lines.js
  - - 폐기 파일 삭제: config-snapshot.js
  - - 코드 품질 체크 개선: 함수명 기반으로 정교하게 체크
**01:53** ⚡ [improvement] Worker 코드 대폭 간소화 (5540줄 → 526줄)
  - - Supabase 관련 전부 제거 (블로그, 번역, 사진)
  - - 랜딩페이지, 약관, 개인정보처리방침 제거
  - - Google Sheets 거래처 페이지만 유지
  - - Cloudinary, 이미지 프록시 제거
  - - 91% 코드 감소 (194KB → 16KB)
**01:19** 🐛 [bugfix] 템플릿 리터럴 중첩 구문 에러 수정
  - - generateClientPage 함수의 백틱 중첩 문제 해결
  - - 조건부 표현식 내 템플릿 리터럴을 문자열 연결 방식으로 변경
  - - Quick Links, Info Section, Contact Info, Footer 백틱 제거
  - - 배포 시 "Expected : but found ;" 에러 수정
**00:36** ✨ [feature] Google Sheets 컬럼명 한글화
  - - 컬럼 구조 변경:
  - - A: 서브도메인 (client_id)
  - - B: 상호명 (client_name)
  - - C: 주소 (address)
  - - D: 전화번호 (phone)
**00:22** ✨ [feature] Google Sheets 연동 (Supabase 폐기)
  - - SUPABASE_URL, SUPABASE_ANON_KEY 제거
  - - GOOGLE_SHEETS_CSV_URL 추가
  - - parseCSV() 함수 추가 (CSV 파싱)
  - - getClientFromSheets() 함수 추가 (거래처 조회)
  - - Supabase 조회 로직 → Google Sheets 조회로 변경

### 2026-01-26 - 시스템 기반 구축
**23:31** ✨ [feature] Supabase 신규 프로젝트 연동 및 동적 페이지 생성
  - - Supabase ContentFactory 프로젝트 생성 (rhgfhfmerewwodctuoyh)
  - - clients 테이블 생성 (client_id, client_name, address, phone, business_hours, info_image_1~6, status)
  - - 상상피아노 데이터 삽입 (00001)
  - - Worker 코드 Supabase URL/Key 변경
  - - generateClientPage(client) 함수 추가 (동적 HTML 생성)
**22:48** ⚡ [improvement] 거래처명 텍스트 디자인 개선
  - - 폰트 크기: 32px → 48px
  - - 폰트 굵기: 700 → 800
  - - 글자 간격: -0.5px (타이트하게)
  - - 텍스트 그림자 추가 (입체감)
**22:46** ⚡ [improvement] 헤더에서 '피아노 학원 · 서울 강남' 텍스트 삭제
**22:44** ⚡ [improvement] 피아노 이모지 삭제 및 상상피아노 텍스트 수직 중앙 정렬
  - - 이모지 아이콘 제거
  - - 보라색 배경 영역 수직 중앙 정렬 강화
  - - padding 및 min-height 조정
**22:38** ✨ [feat] 갤러리 섹션 Info로 변경 및 부제목 삭제
**22:33** ⚡ [improvement] 모바일/PC 동일한 레이아웃으로 통일
  - - 미디어 쿼리 제거 (contact-info row 제외)
  - - 모든 기기에서 3열 2행 바로가기 버튼 유지
  - - 갤러리/블로그 그리드 동일한 레이아웃
**22:30** ✨ [feat] 00001 서브도메인 UI 업데이트
  - - 상단 설명 텍스트 2줄 삭제
  - - 바로가기 버튼 3열 2행으로 변경
  - - 보라색 배경 영역 수직 중앙 정렬 추가

---

---

## 다음 작업

- [ ] 에러 로깅 강화 (Slack 알림 또는 에러 시트)
- [ ] 거래처 1000개 이상 확장 대비 (분산 포스팅)
- [ ] Umami 통계 연동