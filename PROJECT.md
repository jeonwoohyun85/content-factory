# Content Factory 프로젝트

## 배포 이력

### 2026-01-26
- ✅ `preview-blog.html` 추가 - 거래처 페이지 HTML 프리뷰
  - 원페이지 랜딩 스타일
  - 프로필, 갤러리, 게시글 섹션
  - 바로가기 링크 (2x3 그리드)
  - 모바일 반응형 디자인

---

## 프로젝트 상태

**현재 상태**: WordPress 기반 노코드 아키텍처 전환 중

**인프라**:
- Cloudways 서버 (WordPress 멀티사이트)
- n8n (자동화 워크플로우)
- Gemini API (콘텐츠 생성)
- Google Drive (파일 저장)
- Cloudflare (CDN, 보안)

**폐기된 시스템**:
- Supabase → WordPress DB로 대체
- Firebase → WordPress로 대체
- Cloudflare Workers → n8n으로 대체
- caps, content-factory 레포 → 아카이빙

---

## 다음 작업

- [ ] WordPress 멀티사이트 설정 완료
- [ ] n8n 워크플로우 구축
- [ ] 거래처 자동 생성 플로우
- [ ] 자동 포스팅 플로우
- [ ] Gemini API 연동

---

## 참고

- **서비스명**: 콘텐츠팩토리 (Content Factory)
- **코드명**: CAPS (Content Automation Platform System)
- **철학**: 최소한의 코드, 최대한의 자동화
