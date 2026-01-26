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

**현재 상태**: 노코드 아키텍처 재설계 중

**활성 인프라**:
- n8n (자동화 워크플로우)
- Gemini API (콘텐츠 생성)
- Google Drive (파일 저장)
- Cloudflare (CDN, 보안)

**폐기된 시스템** (2026-01-26):
- **Cloudways** → 폐기 확정
- **WordPress 멀티사이트** → 폐기 확정
- **SSH 서버 접속** → 폐기 확정
- Supabase → WordPress DB로 대체 시도했으나 폐기
- Firebase → WordPress로 대체 시도했으나 폐기
- Cloudflare Workers → n8n으로 대체
- caps, content-factory 레포 → 아카이빙

---

## API 토큰 및 인증 정보

### GitHub
- **Token**: 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
- **Owner**: jeonwoohyun85
- **레포**: content-factory (private)

### Cloudflare
- **API Token**: KHPDzFTdegG62bDd2oGEs8Aq2UzIByQxc1tukxsU
- **Global API Key**: e5cc4242edf306683f88ca9b968ec94185d07
- **Email**: jmh850929@gmail.com
- **Zone ID**: 6336f0fab5cb7b480e1f7b44698aef60
- **Account ID**: 73506724e3c7dd97bc939983761a90cf

### n8n
- **Email**: contact@contentfactory.onmicrosoft.com
- **URL**: https://app.n8n.cloud/

---

## 다음 작업

- [ ] 새로운 인프라 구조 결정
- [ ] n8n 워크플로우 구축
- [ ] 거래처 자동 생성 플로우
- [ ] 자동 포스팅 플로우
- [ ] Gemini API 연동

---

## 참고

- **서비스명**: 콘텐츠팩토리 (Content Factory)
- **코드명**: CAPS (Content Automation Platform System)
- **철학**: 최소한의 코드, 최대한의 자동화
- **레포 상태**: Private (비공개)
