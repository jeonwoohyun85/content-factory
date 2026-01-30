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

## 주요 기능

### 자동 포스팅 시스템
- 매일 09:00 KST Cron 트리거
- Google Sheets "관리자" 탭에서 구독='활성' 거래처 조회
- Gemini API로 업종별 검색 + 블로그 포스팅 생성
- Google Drive 폴더에서 최신 사진 자동 선택
- 포스팅 완료 시 "크론" 컬럼 자동 업데이트 (다음 날 09:00)
- 성공/실패 "상태" 컬럼 기록

### 거래처 페이지
- `*.make-page.com` 서브도메인 자동 라우팅
- Google Sheets 데이터 기반 동적 페이지 생성
- 모바일 최적화 UI
- 바로가기 링크 (Instagram, Blog, YouTube, Naver Map, SmartStore 등)

---

## 배포 이력

### 2026-01-29
**15:30** ⚡ [improvement] Queue 병렬 5개 처리 + 재시도 1회 추가
**15:26** ⚡ [improvement] TTL 23시간 59분으로 변경 (크론 타이밍 충돌 방지)

### 2026-01-27
**23:30** ✨ [feature] 자동 포스팅 시스템 완성 (Scheduled Trigger)

---

## 다음 작업

- [ ] 에러 로깅 강화 (Slack 알림 또는 에러 시트)
- [ ] 거래처 1000개 이상 확장 대비 (분산 포스팅)
- [ ] Umami 통계 연동


