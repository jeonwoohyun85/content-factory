# Content Factory 프로젝트

## 배포 이력

### 2026-01-26

**22:31** ⚡ [improvement] 모바일/PC 동일한 레이아웃으로 통일
- 미디어 쿼리 제거 (모든 기기에서 동일한 레이아웃)
- 3열 2행 바로가기 버튼 고정

**22:30** ✨ [feature] 00001 서브도메인 UI 업데이트
- 상단 설명 텍스트 2줄 삭제
- 바로가기 버튼 3열 2행으로 변경
- 보라색 배경 영역 수직 중앙 정렬

**22:21** 🐛 [bugfix] GitHub Actions CLOUDFLARE_API_TOKEN 환경변수 추가
- wrangler 인증 실패 문제 해결

**22:19** ✨ [feature] Cloudflare Workers 추가 (00001 서브도메인)
- workers 폴더 GitHub에 추가
- GitHub Actions 자동 배포 설정
- 00001.make-page.com 상상피아노 템플릿 배포 성공

**이전** ✅ `preview-blog.html` 추가 - 거래처 페이지 HTML 프리뷰
  - 원페이지 랜딩 스타일
  - 프로필, 갤러리, 게시글 섹션
  - 바로가기 링크 (2x3 그리드)
  - 모바일 반응형 디자인

---

## 프로젝트 상태

**현재 상태**: 노코드 아키텍처 재설계 중

**활성 인프라**:
- Google Sheets (거래처 데이터베이스) ✅ Service Account 자동화
- Cloudflare Workers (서브도메인 핸들링)
- Cloudflare (CDN, 보안, DNS)
- GitHub (content-factory-new 레포)
- GitHub Actions (자동 배포)

**폐기된 시스템** (2026-01-27):
- **Supabase** → 폐기 (Google Sheets로 대체, 관리 복잡도 문제)
  - ContentFactory 프로젝트 (rhgfhfmerewwodctuoyh) - 유지 (데이터 백업용)
  - CAPS-Portal (tvymimryuwtgsfakuffl) - INACTIVE 상태
- **NocoDB** → 폐기 (무료 플랜 외부 DB 연결 불가, $12/월 필요)
- **Airtable** → 시도 안 함 ($20/월 비용)
- **Cloudways** → 폐기 확정
- **WordPress 멀티사이트** → 폐기 확정 (복잡도 증가로 취소)
- **SSH 서버 접속** → 폐기 확정
- **Notion** → 폐기 (통합 연결 실패)
- Firebase → 폐기
- caps 레포 → 아카이빙

---

## API 토큰 및 인증 정보

### GitHub
- **Token**: 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
- **Owner**: jeonwoohyun85
- **레포**: content-factory (private)

### Cloudflare
- **Workers API Token**: -cXH1QRIJyeEL1w9nYr-PZtEGtYGrJ9C7jVH6CV1 (현재 사용 중)
- **DNS API Token**: KHPDzFTdegG62bDd2oGEs8Aq2UzIByQxc1tukxsU
- **Global API Key**: e5cc4242edf306683f88ca9b968ec94185d07 (불완전)
- **Email**: jmh850929@gmail.com
- **Zone ID**: 6336f0fab5cb7b480e1f7b44698aef60
- **Account ID**: 73506724e3c7dd97bc939983761a90cf

### Google Sheets (거래처 데이터베이스)
- **Spreadsheet ID**: 1KrzLFi8Wt9GTGT97gcMoXnbZ3OJ04NsP4lncJyIdyhU
- **URL**: https://docs.google.com/spreadsheets/d/1KrzLFi8Wt9GTGT97gcMoXnbZ3OJ04NsP4lncJyIdyhU/edit
- **CSV Export URL**: https://docs.google.com/spreadsheets/d/1KrzLFi8Wt9GTGT97gcMoXnbZ3OJ04NsP4lncJyIdyhU/export?format=csv&gid=0
- **Service Account**: caps-83bc7@appspot.gserviceaccount.com
- **JSON Key**: C:\Users\A1-M4\service-account.json

### n8n
- **Email**: contact@contentfactory.onmicrosoft.com
- **URL**: https://app.n8n.cloud/

---

## 다음 작업

- [x] Cloudflare Workers 배포 자동화 (GitHub Actions)
- [x] 00001 서브도메인 템플릿 배포
- [ ] 동적 거래처 데이터 연동 (Supabase → Worker)
- [ ] 거래처별 콘텐츠 자동 생성
- [ ] 자동 포스팅 시스템 구축

---

## 참고

- **서비스명**: 콘텐츠팩토리 (Content Factory)
- **코드명**: CAPS (Content Automation Platform System)
- **철학**: 최소한의 코드, 최대한의 자동화
- **레포 상태**: Private (비공개)
