# Content Factory 프로젝트

## 배포 이력

### 2026-01-26
**22:31** ⚡ [improvement] 모바일/PC 동일한 레이아웃으로 통일
**22:30** ✨ [feature] 00001 서브도메인 UI 업데이트
**22:21** 🐛 [bugfix] GitHub Actions CLOUDFLARE_API_TOKEN 추가
**22:19** ✨ [feature] Cloudflare Workers 추가 (00001 서브도메인)

### 2026-01-27
**21:35** ♻️ [refactor] 포스트 삭제 UI 변경
**21:42** ♻️ [feature] 포스팅 유지 정책 변경 (Retention Policy)
- **1 Client = 1 Post** 정책 적용 시도 (추후 폐기됨)

**23:30** ✨ [feature] 자동 포스팅 시스템 완성 (Scheduled Trigger)
- Cloudflare Workers Cron Trigger 추가 (10분 주기)
- Gemini 1.5-pro 모델 프롬프트 강화: `description` 컬럼 핵심 반영
- 날짜 기반 Drive 폴더 우선순위 로직 추가
- (Retention Policy는 사용자 요청에 따라 폐기 상태 유지)

---

## 프로젝트 상태

**현재 상태**: 자동화 시스템 구축 완료 및 안정화

**활성 인프라**:
- Google Sheets (거래처 데이터베이스) ✅ Service Account 자동화
- Google Drive (사진 저장소) ✅ Info 폴더 및 포스팅 폴더 자동 감지
- Cloudflare Workers ✅ 최종 확정
  - make-page-subdomain (600+줄) - 거래처 페이지 및 자동 포스팅 (Cron)
  - drive-to-sheets (380줄) - Drive → Sheets 자동화
  - umami-proxy (79줄) - 사용 예정

... (이후 생략) ...

## 다음 작업

- [x] Cloudflare Workers 배포 자동화 (GitHub Actions)
- [x] 00001 서브도메인 템플릿 배포
- [x] Drive → Sheets 자동화 완료
- [x] 자동 포스팅 시스템 구축
- [ ] 사이트 통계 모니터링 (Umami 연동)
- [ ] 멀티 도메인 확장성 검토