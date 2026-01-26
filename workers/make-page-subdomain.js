// *.make-page.com 서브도메인 핸들러
// 각 거래처별 사이트 표시
// Google Sheets 기반 데이터 관리

const GOOGLE_SHEETS_CSV_URL = 'https://docs.google.com/spreadsheets/d/1KrzLFi8Wt9GTGT97gcMoXnbZ3OJ04NsP4lncJyIdyhU/export?format=csv&gid=0';

// 타임아웃 기능이 있는 fetch 헬퍼
async function fetchWithTimeout(url, options = {}, timeoutMs = 10000) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal
    });
    return response;
  } finally {
    clearTimeout(timeoutId);
  }
}

// HTML 이스케이프 (XSS 방지)
function escapeHtml(text) {
  if (!text) return '';
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// CSV 파싱 (간단한 구현)
function parseCSV(csvText) {
  const lines = csvText.trim().split('\n');
  if (lines.length < 2) return [];

  const headers = lines[0].split(',').map(h => h.trim());
  const data = [];

  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(',').map(v => v.trim());
    const row = {};
    headers.forEach((header, index) => {
      row[header] = values[index] || '';
    });
    data.push(row);
  }

  return data;
}

// Google Sheets에서 클라이언트 데이터 조회
async function getClientFromSheets(clientId) {
  try {
    const response = await fetchWithTimeout(GOOGLE_SHEETS_CSV_URL, {}, 10000);
    const csvText = await response.text();
    const clients = parseCSV(csvText);

    return clients.find(client => client.서브도메인 === clientId);
  } catch (error) {
    console.error('Google Sheets fetch error:', error);
    return null;
  }
}

// 구독 종료 페이지 생성
function generateSuspendedPage() {
  return `<!DOCTYPE html>
<html lang="ko">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>서비스 일시 중단</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            display: flex;
            justify-content: center;
            align-items: center;
            min-height: 100vh;
            padding: 20px;
        }
        .container {
            background: white;
            border-radius: 20px;
            box-shadow: 0 20px 60px rgba(0,0,0,0.3);
            padding: 60px 40px;
            text-align: center;
            max-width: 500px;
            width: 100%;
        }
        .icon {
            font-size: 80px;
            margin-bottom: 30px;
        }
        h1 {
            font-size: 28px;
            color: #333;
            margin-bottom: 20px;
            font-weight: 700;
        }
        p {
            font-size: 16px;
            color: #666;
            line-height: 1.6;
            margin-bottom: 15px;
        }
        .highlight {
            color: #667eea;
            font-weight: 600;
        }
        .footer {
            margin-top: 40px;
            padding-top: 30px;
            border-top: 1px solid #eee;
            font-size: 14px;
            color: #999;
        }
        @media (max-width: 600px) {
            .container {
                padding: 40px 30px;
            }
            h1 {
                font-size: 24px;
            }
            .icon {
                font-size: 60px;
            }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="icon">🔒</div>
        <h1>서비스가 일시 중단되었습니다</h1>
        <p>구독이 종료되어 현재 이 페이지를 이용하실 수 없습니다.</p>
        <p><span class="highlight">파트너에게 문의</span>하시면 재구독을 통해<br>즉시 서비스를 다시 이용하실 수 있습니다.</p>
        <div class="footer">
            본 페이지의 모든 데이터는 안전하게 보관되고 있으며,<br>
            재구독 시 즉시 복구됩니다.
        </div>
    </div>
</body>
</html>`;
}

// 동적 거래처 페이지 생성 (Supabase 데이터 기반)
function generateClientPage(client) {
  // Info 이미지는 제거됨 (새 구조)

  return `<!DOCTYPE html>
<html lang="ko">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
    <title>${escapeHtml(client.상호명)}</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: -apple-system, BlinkMacSystemFont, "Malgun Gothic", "맑은 고딕", "Segoe UI", Roboto, sans-serif;
            line-height: 1.6;
            color: #333;
            background: #fff;
        }

        /* Header */
        header {
            background: #fff;
            border-bottom: 1px solid #e9ecef;
            padding: 20px 16px;
            position: sticky;
            top: 0;
            z-index: 100;
            box-shadow: 0 1px 3px rgba(0,0,0,0.05);
        }

        .header-content {
            max-width: 1200px;
            margin: 0 auto;
        }

        .business-name {
            font-size: 24px;
            font-weight: 700;
            color: #1a1a1a;
            margin-bottom: 4px;
        }

        /* Section */
        section {
            max-width: 1200px;
            margin: 0 auto;
            padding: 60px 16px;
        }

        .section-title {
            font-size: 28px;
            font-weight: 700;
            color: #1a1a1a;
            margin-bottom: 12px;
            text-align: center;
        }

        /* Profile Section */
        .profile-section {
            background: linear-gradient(to bottom, #f5f3ff 0%, #faf9ff 100%);
            padding: 80px 16px;
            text-align: center;
            display: flex;
            align-items: center;
            justify-content: center;
            min-height: 500px;
        }

        .profile-content {
            max-width: 800px;
            margin: 0 auto;
            width: 100%;
        }

        .profile-title {
            font-size: 48px;
            font-weight: 800;
            color: #1a1a1a;
            margin-bottom: 36px;
            letter-spacing: -0.5px;
            text-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
        }

        .contact-info {
            display: flex;
            flex-direction: column;
            gap: 10px;
            max-width: 500px;
            margin: 0 auto 40px;
            background: #fff;
            padding: 20px;
            border-radius: 8px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.06);
        }

        .contact-item {
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 10px;
            font-size: 14px;
            color: #4a5568;
        }

        .contact-icon {
            font-size: 18px;
        }

        /* Quick Links */
        .quick-links {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 12px;
            max-width: 700px;
            margin: 0 auto;
        }

        .quick-link-item {
            background: #fff;
            border: 1px solid #e2e8f0;
            border-radius: 8px;
            padding: 20px 16px;
            text-align: center;
            cursor: pointer;
            transition: all 0.3s;
            text-decoration: none;
            color: inherit;
        }

        .quick-link-item:hover {
            border-color: #6366f1;
            transform: translateY(-2px);
            box-shadow: 0 4px 12px rgba(99, 102, 241, 0.15);
        }

        .quick-link-icon {
            font-size: 32px;
            margin-bottom: 8px;
        }

        .quick-link-text {
            font-size: 13px;
            font-weight: 600;
            color: #1a1a1a;
        }

        /* Gallery Section */
        .gallery-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
            gap: 20px;
        }

        .gallery-item {
            position: relative;
            overflow: hidden;
            border-radius: 8px;
            cursor: pointer;
            transition: transform 0.3s;
            aspect-ratio: 1;
        }

        .gallery-item:hover {
            transform: translateY(-4px);
        }

        .gallery-image {
            width: 100%;
            height: 100%;
            object-fit: cover;
            display: block;
        }

        /* Footer */
        footer {
            background: #2d3748;
            color: #fff;
            padding: 40px 16px;
            text-align: center;
        }

        .footer-content {
            max-width: 1200px;
            margin: 0 auto;
        }

        .footer-business-name {
            font-size: 20px;
            font-weight: 700;
            margin-bottom: 16px;
        }

        .footer-info {
            font-size: 14px;
            color: #cbd5e0;
            line-height: 1.8;
            margin-bottom: 24px;
        }

        .footer-copyright {
            font-size: 13px;
            color: #a0aec0;
            padding-top: 24px;
            border-top: 1px solid #4a5568;
        }

        @media (min-width: 768px) {
            .contact-info {
                flex-direction: row;
            }
        }
    </style>
</head>
<body>
    <!-- Header -->
    <header>
        <div class="header-content">
            <h1 class="business-name">${escapeHtml(client.상호명)}</h1>
        </div>
    </header>

    <!-- Profile Section -->
    <section class="profile-section">
        <div class="profile-content">
            <h2 class="profile-title">${escapeHtml(client.상호명)}</h2>
            <div class="contact-info">
                ${client.주소 ? `<div class="contact-item">
                    <span class="contact-icon">📍</span>
                    <span>${escapeHtml(client.주소)}</span>
                </div>` : ''}
                ${client.전화번호 ? `<div class="contact-item">
                    <span class="contact-icon">📞</span>
                    <span>${escapeHtml(client.전화번호)}</span>
                </div>` : ''}
            </div>

            <!-- Quick Links -->
            <div class="quick-links">
                ${client.전화번호 ? `<a href="tel:${escapeHtml(client.전화번호)}" class="quick-link-item">
                    <div class="quick-link-icon">📞</div>
                    <div class="quick-link-text">전화하기</div>
                </a>` : ''}
                <a href="https://map.naver.com" target="_blank" class="quick-link-item">
                    <div class="quick-link-icon">📍</div>
                    <div class="quick-link-text">위치보기</div>
                </a>
                <a href="#" class="quick-link-item">
                    <div class="quick-link-icon">📅</div>
                    <div class="quick-link-text">예약하기</div>
                </a>
                <a href="https://instagram.com" target="_blank" class="quick-link-item">
                    <div class="quick-link-icon">📷</div>
                    <div class="quick-link-text">인스타그램</div>
                </a>
                <a href="https://facebook.com" target="_blank" class="quick-link-item">
                    <div class="quick-link-icon">💬</div>
                    <div class="quick-link-text">카카오톡</div>
                </a>
                <a href="#" class="quick-link-item">
                    <div class="quick-link-icon">📧</div>
                    <div class="quick-link-text">문의하기</div>
                </a>
            </div>
        </div>
    </section>

    <!-- Footer -->
    <footer>
        <div class="footer-content">
            <div class="footer-business-name">${escapeHtml(client.상호명)}</div>
            <div class="footer-info">
                ${client.주소 ? `${escapeHtml(client.주소)}<br>` : ''}
                ${client.전화번호 ? `전화: ${escapeHtml(client.전화번호)}` : ''}
            </div>
            <div class="footer-copyright">
                © 2026 ${escapeHtml(client.상호명)}. All rights reserved. Powered by ContentFactory
            </div>
        </div>
    </footer>
</body>
</html>`;
}

// 00001 테스트 페이지 생성 (상상피아노)
function generate00001Page() {
  return `<!DOCTYPE html>
<html lang="ko">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
    <title>상상피아노 | 서울 강남 피아노 학원</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: -apple-system, BlinkMacSystemFont, "Malgun Gothic", "맑은 고딕", "Segoe UI", Roboto, sans-serif;
            line-height: 1.6;
            color: #333;
            background: #fff;
        }

        /* Header */
        header {
            background: #fff;
            border-bottom: 1px solid #e9ecef;
            padding: 20px 16px;
            position: sticky;
            top: 0;
            z-index: 100;
            box-shadow: 0 1px 3px rgba(0,0,0,0.05);
        }

        .header-content {
            max-width: 1200px;
            margin: 0 auto;
        }

        .business-name {
            font-size: 24px;
            font-weight: 700;
            color: #1a1a1a;
            margin-bottom: 4px;
        }

        .business-category {
            font-size: 14px;
            color: #666;
        }

        /* Section */
        section {
            max-width: 1200px;
            margin: 0 auto;
            padding: 60px 16px;
        }

        .section-title {
            font-size: 28px;
            font-weight: 700;
            color: #1a1a1a;
            margin-bottom: 12px;
            text-align: center;
        }

        .section-subtitle {
            font-size: 16px;
            color: #666;
            text-align: center;
            margin-bottom: 40px;
        }

        /* Profile Section */
        .profile-section {
            background: linear-gradient(to bottom, #f5f3ff 0%, #faf9ff 100%);
            padding: 80px 16px;
            text-align: center;
            display: flex;
            align-items: center;
            justify-content: center;
            min-height: 500px;
        }

        .profile-content {
            max-width: 800px;
            margin: 0 auto;
            width: 100%;
        }

        .profile-title {
            font-size: 48px;
            font-weight: 800;
            color: #1a1a1a;
            margin-bottom: 36px;
            letter-spacing: -0.5px;
            text-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
        }

        .contact-info {
            display: flex;
            flex-direction: column;
            gap: 10px;
            max-width: 500px;
            margin: 0 auto 40px;
            background: #fff;
            padding: 20px;
            border-radius: 8px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.06);
        }

        .contact-item {
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 10px;
            font-size: 14px;
            color: #4a5568;
        }

        .contact-icon {
            font-size: 18px;
        }

        /* Quick Links */
        .quick-links {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 12px;
            max-width: 700px;
            margin: 0 auto;
        }

        .quick-link-item {
            background: #fff;
            border: 1px solid #e2e8f0;
            border-radius: 8px;
            padding: 20px 16px;
            text-align: center;
            cursor: pointer;
            transition: all 0.3s;
            text-decoration: none;
            color: inherit;
        }

        .quick-link-item:hover {
            border-color: #6366f1;
            transform: translateY(-2px);
            box-shadow: 0 4px 12px rgba(99, 102, 241, 0.15);
        }

        .quick-link-icon {
            font-size: 32px;
            margin-bottom: 8px;
        }

        .quick-link-text {
            font-size: 13px;
            font-weight: 600;
            color: #1a1a1a;
        }

        /* Gallery Section */
        .gallery-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
            gap: 20px;
        }

        .gallery-item {
            position: relative;
            overflow: hidden;
            border-radius: 8px;
            cursor: pointer;
            transition: transform 0.3s;
            aspect-ratio: 1;
        }

        .gallery-item:hover {
            transform: translateY(-4px);
        }

        .gallery-image {
            width: 100%;
            height: 100%;
            object-fit: cover;
            display: block;
        }

        /* Blog Section */
        .blog-section {
            background: #f8f9fa;
        }

        .blog-grid {
            display: grid;
            grid-template-columns: 1fr;
            gap: 24px;
        }

        .blog-card {
            background: #fff;
            border-radius: 12px;
            overflow: hidden;
            box-shadow: 0 2px 8px rgba(0,0,0,0.08);
            transition: box-shadow 0.3s, transform 0.3s;
            cursor: pointer;
        }

        .blog-card:hover {
            box-shadow: 0 4px 16px rgba(0,0,0,0.12);
            transform: translateY(-4px);
        }

        .blog-image {
            width: 100%;
            height: 240px;
            object-fit: cover;
            display: block;
        }

        .blog-content {
            padding: 24px;
        }

        .blog-date {
            font-size: 13px;
            color: #999;
            margin-bottom: 8px;
        }

        .blog-title {
            font-size: 20px;
            font-weight: 600;
            color: #1a1a1a;
            margin-bottom: 12px;
            line-height: 1.4;
        }

        .blog-excerpt {
            font-size: 15px;
            color: #666;
            line-height: 1.6;
        }

        /* Footer */
        footer {
            background: #2d3748;
            color: #fff;
            padding: 40px 16px;
            text-align: center;
        }

        .footer-content {
            max-width: 1200px;
            margin: 0 auto;
        }

        .footer-business-name {
            font-size: 20px;
            font-weight: 700;
            margin-bottom: 16px;
        }

        .footer-info {
            font-size: 14px;
            color: #cbd5e0;
            line-height: 1.8;
            margin-bottom: 24px;
        }

        .footer-copyright {
            font-size: 13px;
            color: #a0aec0;
            padding-top: 24px;
            border-top: 1px solid #4a5568;
        }

        /* Desktop - 모바일과 동일한 레이아웃 유지 */
        @media (min-width: 768px) {
            .contact-info {
                flex-direction: row;
            }
        }
    </style>
</head>
<body>
    <!-- Header -->
    <header>
        <div class="header-content">
            <h1 class="business-name">상상피아노</h1>
        </div>
    </header>

    <!-- Profile Section -->
    <section class="profile-section">
        <div class="profile-content">
            <h2 class="profile-title">상상피아노</h2>
            <div class="contact-info">
                <div class="contact-item">
                    <span class="contact-icon">📍</span>
                    <span>서울 강남구 강남대로 123</span>
                </div>
                <div class="contact-item">
                    <span class="contact-icon">📞</span>
                    <span>02-1234-5678</span>
                </div>
                <div class="contact-item">
                    <span class="contact-icon">🕐</span>
                    <span>평일 10:00-22:00 · 주말 10:00-18:00</span>
                </div>
            </div>

            <!-- Quick Links -->
            <div class="quick-links">
                <a href="tel:02-1234-5678" class="quick-link-item">
                    <div class="quick-link-icon">📞</div>
                    <div class="quick-link-text">전화하기</div>
                </a>
                <a href="https://map.naver.com" target="_blank" class="quick-link-item">
                    <div class="quick-link-icon">📍</div>
                    <div class="quick-link-text">위치보기</div>
                </a>
                <a href="#" class="quick-link-item">
                    <div class="quick-link-icon">📅</div>
                    <div class="quick-link-text">예약하기</div>
                </a>
                <a href="https://instagram.com" target="_blank" class="quick-link-item">
                    <div class="quick-link-icon">📷</div>
                    <div class="quick-link-text">인스타그램</div>
                </a>
                <a href="https://facebook.com" target="_blank" class="quick-link-item">
                    <div class="quick-link-icon">💬</div>
                    <div class="quick-link-text">카카오톡</div>
                </a>
                <a href="#" class="quick-link-item">
                    <div class="quick-link-icon">📧</div>
                    <div class="quick-link-text">문의하기</div>
                </a>
            </div>
        </div>
    </section>

    <!-- Gallery Section -->
    <section>
        <h2 class="section-title">Info</h2>
        <div class="gallery-grid">
            <div class="gallery-item">
                <img src="https://images.unsplash.com/photo-1520523839897-bd0b52f945a0?w=600&h=600&fit=crop" alt="피아노 연주" class="gallery-image">
            </div>
            <div class="gallery-item">
                <img src="https://images.unsplash.com/photo-1511379938547-c1f69419868d?w=600&h=600&fit=crop" alt="피아노 건반" class="gallery-image">
            </div>
            <div class="gallery-item">
                <img src="https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=600&h=600&fit=crop" alt="레슨 장면" class="gallery-image">
            </div>
            <div class="gallery-item">
                <img src="https://images.unsplash.com/photo-1514320291840-2e0a9bf2a9ae?w=600&h=600&fit=crop" alt="피아노 스튜디오" class="gallery-image">
            </div>
            <div class="gallery-item">
                <img src="https://images.unsplash.com/photo-1552422535-c45813c61732?w=600&h=600&fit=crop" alt="피아노 연습" class="gallery-image">
            </div>
            <div class="gallery-item">
                <img src="https://images.unsplash.com/photo-1510915228340-29c85a43dcfe?w=600&h=600&fit=crop" alt="피아노 악보" class="gallery-image">
            </div>
        </div>
    </section>

    <!-- Blog Section -->
    <section class="blog-section">
        <h2 class="section-title">게시글</h2>
        <p class="section-subtitle">최신 소식과 유용한 정보</p>
        <div class="blog-grid">
            <article class="blog-card">
                <img src="https://images.unsplash.com/photo-1520523839897-bd0b52f945a0?w=800&h=600&fit=crop" alt="피아노 연주" class="blog-image">
                <div class="blog-content">
                    <div class="blog-date">2026.01.26</div>
                    <h3 class="blog-title">30대에 피아노를 시작해도 늦지 않은 이유</h3>
                    <p class="blog-excerpt">많은 분들이 30대에 피아노를 시작하기엔 늦었다고 생각하시지만, 오히려 이 시기가 피아노 학습에 최적의 시기입니다...</p>
                </div>
            </article>

            <article class="blog-card">
                <img src="https://images.unsplash.com/photo-1511379938547-c1f69419868d?w=800&h=600&fit=crop" alt="피아노 건반" class="blog-image">
                <div class="blog-content">
                    <div class="blog-date">2026.01.25</div>
                    <h3 class="blog-title">바쁜 직장인을 위한 효율적인 연습 방법 5가지</h3>
                    <p class="blog-excerpt">시간이 부족한 직장인이라도 하루 30분만 투자하면 충분히 실력을 향상시킬 수 있습니다...</p>
                </div>
            </article>

            <article class="blog-card">
                <img src="https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=800&h=600&fit=crop" alt="학생 레슨" class="blog-image">
                <div class="blog-content">
                    <div class="blog-date">2026.01.26</div>
                    <h3 class="blog-title">수강생 인터뷰: 6개월 만에 무대에 선 김민지 님</h3>
                    <p class="blog-excerpt">피아노를 한 번도 쳐본 적 없던 김민지 님이 우리 학원에서 6개월 만에 겨울 발표회 무대에 섰습니다...</p>
                </div>
            </article>

            <article class="blog-card">
                <img src="https://images.unsplash.com/photo-1514320291840-2e0a9bf2a9ae?w=800&h=600&fit=crop" alt="피아노 스튜디오" class="blog-image">
                <div class="blog-content">
                    <div class="blog-date">2026.01.23</div>
                    <h3 class="blog-title">우리 학원만의 특별한 교육 커리큘럼</h3>
                    <p class="blog-excerpt">전통적인 한국식 체계와 현대 신경과학 연구를 결합한 우리만의 독특한 교육 방식을 소개합니다...</p>
                </div>
            </article>

            <article class="blog-card">
                <img src="https://images.unsplash.com/photo-1552422535-c45813c61732?w=800&h=600&fit=crop" alt="피아노 연습" class="blog-image">
                <div class="blog-content">
                    <div class="blog-date">2026.01.22</div>
                    <h3 class="blog-title">초보자를 위한 올바른 자세와 손 모양</h3>
                    <p class="blog-excerpt">피아노 연주의 기초는 올바른 자세에서 시작됩니다. 처음부터 바른 습관을 들이는 것이 얼마나 중요한지 알려드립니다...</p>
                </div>
            </article>

            <article class="blog-card">
                <img src="https://images.unsplash.com/photo-1510915228340-29c85a43dcfe?w=800&h=600&fit=crop" alt="피아노 악보" class="blog-image">
                <div class="blog-content">
                    <div class="blog-date">2026.01.21</div>
                    <h3 class="blog-title">클래식 입문자를 위한 추천 곡 10선</h3>
                    <p class="blog-excerpt">피아노를 시작하신 분들이 도전하기 좋은 아름다운 클래식 곡들을 난이도별로 정리했습니다...</p>
                </div>
            </article>
        </div>
    </section>

    <!-- Footer -->
    <footer>
        <div class="footer-content">
            <div class="footer-business-name">상상피아노</div>
            <div class="footer-info">
                서울 강남구 강남대로 123<br>
                전화: 02-1234-5678<br>
                영업시간: 평일 10:00-22:00 · 주말 10:00-18:00
            </div>
            <div class="footer-copyright">
                © 2026 상상피아노. All rights reserved. Powered by ContentFactory
            </div>
        </div>
    </footer>
</body>
</html>`;
}

// 번역 자동 생성 함수
async function fetchTranslationsFromDB(language) {
  try {
    const response = await fetch(
      `${SUPABASE_URL}/rest/v1/translations?language=eq.${encodeURIComponent(language)}&select=translations`,
      {
        headers: {
          'apikey': SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
        }
      }
    );
    const data = await response.json();
    if (data && data.length > 0) {
      return data[0].translations;
    }
  } catch (error) {
    console.error('DB 조회 에러:', error);
  }
  return null;
}

// ============================================
// 이미지 프록시 (CORS 우회)
// ============================================

async function handleImageProxy(request) {
  const url = new URL(request.url);
  const imageUrl = url.searchParams.get('url');

  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  // OPTIONS 요청 처리
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (!imageUrl) {
    return new Response(JSON.stringify({ error: 'Missing url parameter' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }

  // Supabase Storage URL만 허용 (보안)
  if (!imageUrl.startsWith('https://tvymimryuwtgsfakuffl.supabase.co/storage/')) {
    return new Response(JSON.stringify({ error: 'Invalid URL domain' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }

  try {
    // Supabase에서 이미지 가져오기 (10초 타임아웃)
    const imageResponse = await fetchWithTimeout(imageUrl, {
      headers: { 'User-Agent': 'CAPS-Image-Proxy/1.0' }
    }, 10000);

    if (!imageResponse.ok) {
      return new Response(JSON.stringify({ error: `Failed to fetch: ${imageResponse.status}` }), {
        status: imageResponse.status,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    // 이미지를 클라이언트에 전달 (1년 캐싱)
    return new Response(imageResponse.body, {
      status: 200,
      headers: {
        'Content-Type': imageResponse.headers.get('Content-Type') || 'image/jpeg',
        'Cache-Control': 'public, max-age=31536000, immutable',
        ...corsHeaders
      }
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }
}


async function translateWithClaude(language, apiKey) {
  if (!apiKey) {
    console.error('ANTHROPIC_API_KEY가 설정되지 않음');
    return null;
  }

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1024,
        messages: [{
          role: 'user',
          content: `Translate these UI labels to ${language}. Return ONLY a JSON object, no other text:

{
  "cover": "대표",
  "photos": "사진",
  "info": "안내",
  "posts": "Blog",
  "links": "Links",
  "callNow": "Call Now",
  "location": "Location",
  "hours": "Hours",
  "phone": "Phone",
  "back": "Back"
}`
        }]
      })
    });

    const result = await response.json();
    if (result.content && result.content[0] && result.content[0].text) {
      const text = result.content[0].text.trim();
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
    }
  } catch (error) {
    console.error('Claude API 에러:', error);
  }
  return null;
}

async function saveTranslationsToDB(language, translations, serviceRoleKey) {
  if (!serviceRoleKey) {
    console.error('SUPABASE_SERVICE_ROLE_KEY가 설정되지 않음');
    return;
  }

  try {
    await fetch(
      `${SUPABASE_URL}/rest/v1/translations`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': serviceRoleKey,
          'Authorization': `Bearer ${serviceRoleKey}`,
          'Prefer': 'resolution=merge-duplicates'
        },
        body: JSON.stringify({
          language: language,
          translations: translations
        })
      }
    );
  } catch (error) {
    console.error('DB 저장 에러:', error);
  }
}

async function translateClientInfo(businessName, address, businessHours, language, apiKey) {
  if (!apiKey || !language) {
    return null;
  }

  // 한국어는 번역하지 않음
  if (language === '한국어' || language === 'Korean' || language === 'ko') {
    return null;
  }

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 2048,
        messages: [{
          role: 'user',
          content: `Translate ALL text to ${language}.

Business Name: ${businessName || ''}
Address: ${address || ''}
Business Hours: ${businessHours || ''}

Return ONLY JSON:
{"businessName": "...", "address": "...", "businessHours": "..."}

RULES:
1. Translate EVERY word to ${language} (Korean, English, ALL words)
2. Use ONLY ${language} script - no Korean, no English, no Chinese
3. Examples:
   - "Japan" in Japanese → "日本" (NOT "Japan")
   - "Thailand" in Thai → "ประเทศไทย" (NOT "Thailand")
   - "공방" in Thai → "โรงฝึกหัด" (NOT "工房" Chinese!)
4. The entire output must be readable by a native ${language} speaker`
        }]
      })
    });

    const result = await response.json();
    if (result.content && result.content[0] && result.content[0].text) {
      const text = result.content[0].text.trim();
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
    }
  } catch (error) {
    console.error('Client info translation error:', error);
  }
  return null;
}

async function saveClientTranslations(clientId, translations, serviceRoleKey) {
  if (!serviceRoleKey || !translations) {
    return;
  }

  try {
    await fetch(
      `${SUPABASE_URL}/rest/v1/clients?id=eq.${clientId}`,
      {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'apikey': serviceRoleKey,
          'Authorization': `Bearer ${serviceRoleKey}`
        },
        body: JSON.stringify({
          business_name_translated: translations.businessName,
          address_translated: translations.address,
          business_hours_translated: translations.businessHours
        })
      }
    );
  } catch (error) {
    console.error('Client translations save error:', error);
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const hostname = url.hostname;
    const pathname = url.pathname;

    // www → apex 도메인 리다이렉트 (301 Permanent)
    if (hostname === 'www.make-page.com') {
      const redirectUrl = `https://make-page.com${pathname}${url.search}`;
      return Response.redirect(redirectUrl, 301);
    }

    // 이미지 프록시 처리 (CORS 우회)
    if (pathname === '/proxy/image') {
      return handleImageProxy(request);
    }

    // 서브도메인 추출
    const subdomain = hostname.split('.')[0];

    // make-page.com (메인 도메인) 처리 (staging 포함)
    if (hostname === 'make-page.com' || hostname === 'staging.make-page.com') {
      if (pathname === '/terms') {
        return new Response(generateTermsPage(), {
          headers: { 'Content-Type': 'text/html; charset=utf-8' }
        });
      }
      if (pathname === '/privacy') {
        return new Response(generatePrivacyPage(), {
          headers: { 'Content-Type': 'text/html; charset=utf-8' }
        });
      }
      // sitemap.xml
      if (pathname === '/sitemap.xml') {
        return handleSitemap();
      }
      // robots.txt
      if (pathname === '/robots.txt') {
        return new Response(generateRobotsTxt(), {
          headers: { 'Content-Type': 'text/plain; charset=utf-8' }
        });
      }
      // IndexNow API 키 파일
      if (pathname === '/kmlsc7f9b1pm7n7x7gq1zdihmzxtkqzr.txt') {
        return new Response('kmlsc7f9b1pm7n7x7gq1zdihmzxtkqzr', {
          headers: { 'Content-Type': 'text/plain; charset=utf-8' }
        });
      }
      // 데모 페이지 프록시
      if (pathname === '/demo' || pathname.startsWith('/api/demo/')) {
        return fetch(`${env.API_BASE_URL}${pathname}`);
      }
      // 대시보드 + 사진 업로드 포탈 (페이지 + API)
      if (pathname === '/dashboard' ||
          pathname.startsWith('/photos/') ||
          pathname.startsWith('/payment') ||
          pathname.startsWith('/api/auth/') ||
          pathname.startsWith('/api/web/') ||
          pathname.startsWith('/api/admin/') ||
          pathname.startsWith('/api/sandbox/') ||
          pathname.startsWith('/api/payment/') ||
          pathname.startsWith('/api/verify-upload-token') ||
          pathname.startsWith('/api/generate-upload-token') ||
          pathname.startsWith('/api/partner/')) {
        const apiUrl = `${env.API_BASE_URL}${pathname}${url.search}`;
        const proxyRequest = new Request(apiUrl, {
          method: request.method,
          headers: request.headers,
          body: request.method !== 'GET' && request.method !== 'HEAD' ? request.body : undefined
        });
        return fetch(proxyRequest);
      }
      // 랜딩페이지
      return new Response(await generateLandingPage(), {
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
          'Cache-Control': 'public, max-age=300'
        }
      });
    }

    // 서브도메인이 5자리 숫자가 아니면 404
    if (!/^\d{5}$/.test(subdomain)) {
      return new Response('Not Found', { status: 404 });
    }

    // /blog/{id} 경로 처리 (UUID 형식)
    const blogMatch = pathname.match(/^\/blog\/([a-f0-9-]+)$/);
    if (blogMatch) {
      const contentId = blogMatch[1];
      return handleBlogPage(subdomain, contentId);
    }

    try {
      // Google Sheets에서 거래처 정보 조회
      const client = await getClientFromSheets(subdomain);

      if (!client) {
        return new Response('Not Found', { status: 404 });
      }

      // 비활성 거래처는 표시 안함
      if (client.활성 !== 'active') {
        return new Response('This page is inactive', { status: 403 });
      }

      // 간단한 구조로 변경 (구독 해지 로직 제거)
      if (false) {
        const now = new Date();
        const endDate = new Date();

        if (endDate < now) {
          // 구독 종료 → 사이트 차단
          return new Response(generateSuspendedPage(), {
            headers: { 'Content-Type': 'text/html; charset=utf-8' },
            status: 403
          });
        }
      }

      // links 파싱 (JSONB 문자열 → 배열)
      if (client.links && typeof client.links === 'string') {
        try {
          client.links = JSON.parse(client.links);
        } catch (e) {
          client.links = [];
        }
      }
      if (!Array.isArray(client.links)) {
        client.links = [];
      }

      // 번역 처리 (한국어가 아닌 경우)
      let displayBusinessName = client.business_name;
      let displayAddress = client.주소;
      let displayBusinessHours = client.business_hours;

      if (client.language && client.language !== '한국어') {
        // 이미 번역된 것이 있으면 사용
        if (client.business_name_translated) {
          displayBusinessName = client.business_name_translated;
        }
        if (client.주소_translated) {
          displayAddress = client.주소_translated;
        }
        if (client.business_hours_translated) {
          displayBusinessHours = client.business_hours_translated;
        }

        // 번역이 없으면 생성 (동기로 처리)
        if (!client.business_name_translated || !client.주소_translated || !client.business_hours_translated) {
          if (env.ANTHROPIC_API_KEY && env.SUPABASE_SERVICE_ROLE_KEY) {
            const translations = await translateClientInfo(
              client.business_name,
              client.주소,
              client.business_hours,
              client.language,
              env.ANTHROPIC_API_KEY
            );

            if (translations) {
              // 번역 결과를 바로 사용
              if (!client.business_name_translated && translations.businessName) {
                displayBusinessName = translations.businessName;
              }
              if (!client.주소_translated && translations.address) {
                displayAddress = translations.address;
              }
              if (!client.business_hours_translated && translations.businessHours) {
                displayBusinessHours = translations.businessHours;
              }

              // DB에 저장 (비동기로 처리)
              saveClientTranslations(client.id, translations, env.SUPABASE_SERVICE_ROLE_KEY);
            }
          }
        }
      }

      // 1단계: 대표 폴더 ID 조회
      const coverFolderResponse = await fetch(
        `${SUPABASE_URL}/rest/v1/folders?client_id=eq.${client.id}&name=eq.${encodeURIComponent('대표')}&is_default=eq.true&select=id`,
        {
          headers: {
            'apikey': SUPABASE_ANON_KEY,
            'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
          }
        }
      );

      const coverFolders = await coverFolderResponse.json();
      const coverFolderId = coverFolders && coverFolders.length > 0 ? coverFolders[0].id : null;

      // Cover 폴더 사진 조회 (히어로 이미지용, 랜덤)
      let coverPhoto = null;
      if (coverFolderId) {
        const coverPhotosResponse = await fetch(
          `${SUPABASE_URL}/rest/v1/client_photos?client_id=eq.${client.id}&folder_id=eq.${coverFolderId}&select=id,file_path,file_name&limit=50`,
          {
            headers: {
              'apikey': SUPABASE_ANON_KEY,
              'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
            }
          }
        );
        let coverPhotos = await coverPhotosResponse.json();

        if (Array.isArray(coverPhotos) && coverPhotos.length > 0) {
          // 랜덤 셔플 후 1장 선택
          const randomPhotos = coverPhotos.sort(() => Math.random() - 0.5);
          coverPhoto = randomPhotos[0];
        }
      }

      // 2단계: 사진 폴더 ID 조회
      const photosFolderResponse = await fetch(
        `${SUPABASE_URL}/rest/v1/folders?client_id=eq.${client.id}&name=eq.${encodeURIComponent('사진')}&is_default=eq.true&select=id`,
        {
          headers: {
            'apikey': SUPABASE_ANON_KEY,
            'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
          }
        }
      );

      const photosFolders = await photosFolderResponse.json();
      const photosFolderId = photosFolders && photosFolders.length > 0 ? photosFolders[0].id : null;

      // 3단계: 사진 폴더 사진 조회 (랜덤)
      let photos = [];
      if (photosFolderId) {
        const photosResponse = await fetch(
          `${SUPABASE_URL}/rest/v1/client_photos?client_id=eq.${client.id}&folder_id=eq.${photosFolderId}&select=id,file_path,file_name&limit=50`,
          {
            headers: {
              'apikey': SUPABASE_ANON_KEY,
              'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
            }
          }
        );
        let allPhotos = await photosResponse.json();

        // 배열이 아니면 빈 배열로
        if (!Array.isArray(allPhotos)) {
          allPhotos = [];
        }

        // 랜덤 셔플 후 6장만 선택
        photos = allPhotos
          .sort(() => Math.random() - 0.5)
          .slice(0, 6);
      }

      // 4단계: 안내 폴더 ID 조회
      const infoFolderResponse = await fetch(
        `${SUPABASE_URL}/rest/v1/folders?client_id=eq.${client.id}&name=eq.${encodeURIComponent('안내')}&is_default=eq.true&select=id`,
        {
          headers: {
            'apikey': SUPABASE_ANON_KEY,
            'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
          }
        }
      );

      const infoFolders = await infoFolderResponse.json();
      const infoFolderId = infoFolders && infoFolders.length > 0 ? infoFolders[0].id : null;

      // 5단계: 안내 폴더 사진 조회 (랜덤)
      let infoPhotos = [];
      if (infoFolderId) {
        const infoPhotosResponse = await fetch(
          `${SUPABASE_URL}/rest/v1/client_photos?client_id=eq.${client.id}&folder_id=eq.${infoFolderId}&select=id,file_path,file_name&limit=50`,
          {
            headers: {
              'apikey': SUPABASE_ANON_KEY,
              'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
            }
          }
        );
        let allInfoPhotos = await infoPhotosResponse.json();

        // 배열이 아니면 빈 배열로
        if (!Array.isArray(allInfoPhotos)) {
          allInfoPhotos = [];
        }

        // 랜덤 셔플 후 3장만 선택
        infoPhotos = allInfoPhotos
          .sort(() => Math.random() - 0.5)
          .slice(0, 3);
      }

      // 포스트 조회
      const contentsResponse = await fetch(
        `${SUPABASE_URL}/rest/v1/contents?client_id=eq.${client.id}&select=id,title,description,created_at,photo_id&order=created_at.desc&limit=10`,
        {
          headers: {
            'apikey': SUPABASE_ANON_KEY,
            'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
          }
        }
      );

      let contents = await contentsResponse.json();
      if (!Array.isArray(contents)) {
        contents = [];
      }

      // 번역된 텍스트를 client 객체에 반영
      const displayClient = {
        ...client,
        business_name: displayBusinessName,
        address: displayAddress,
        business_hours: displayBusinessHours
      };

      // 신규 Supabase 구조: 간단하게 클라이언트 페이지 생성
      const html = generateClientPage(client);

      return new Response(html, {
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
          'Cache-Control': 'public, max-age=300'
        }
      });

    } catch (error) {
      console.error('Error:', error);
      return new Response('Internal Server Error: ' + error.message, { status: 500 });
    }
  }

  // Cloudflare Cron 복원 (2026-01-20)
  // EasyCron 폐기 → Cloudflare Cron + Queue 시스템으로 복귀
  ,async scheduled(event, env, ctx) {
    // CAPS 엔진 자동 실행 (10분마다, 현재 시간에 맞는 거래처들에게 실시간 포스팅 생성)
    try {
      const kstDate = new Date(new Date().getTime() + (9 * 60 * 60 * 1000));
      console.log('CAPS 엔진 자동 실행 시작 (KST):', kstDate.toISOString());

      const kstHour = kstDate.getUTCHours();
      const kstMinute = kstDate.getUTCMinutes();

      // 10분마다: 현재 시간에 매칭되는 거래처들에게 실시간 포스팅 생성 (재시도 3회)
      let response;
      let result;
      let lastError;

      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          console.log(`API 호출 시도 ${attempt}/3`);

          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 300000); // 5분 타임아웃 (웹 검색 + 포스팅 작성 여유)

          try {
            response = await fetch(`${env.API_BASE_URL}/api/generate-all`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json'
              },
              signal: controller.signal
            });
          } finally {
            clearTimeout(timeoutId);
          }

          if (response.ok) {
            result = await response.json();
            console.log('포스팅 생성 결과:', JSON.stringify(result));
            break; // 성공하면 루프 탈출
          } else {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
          }
        } catch (err) {
          lastError = err;
          console.error(`API 호출 실패 (시도 ${attempt}/3):`, err.message);

          if (attempt < 3) {
            const backoffMs = 5000 * attempt; // 지수 백오프: 5초, 10초
            console.log(`${backoffMs/1000}초 후 재시도...`);
            await new Promise(resolve => setTimeout(resolve, backoffMs));
          }
        }
      }

      // 3번 재시도 후에도 실패
      if (!result) {
        console.error(`❌ Cron 최종 실패 (3회 재시도): ${kstHour}:${kstMinute} KST - ${lastError?.message}`);

        // ntfy.sh 긴급 알림
        await sendNtfyAlert(
          '🚨 Cron 최종 실패',
          `시간: ${kstHour}:${kstMinute} KST\n에러: ${lastError?.message}\n재시도: 3회 모두 실패`,
          5, // urgent (무음모드도 울림)
          ['rotating_light', 'skull']
        );

        // Supabase logs 테이블에 기록
        try {
          await fetchWithTimeout(
            `${SUPABASE_URL}/rest/v1/logs`,
            {
              method: 'POST',
              headers: {
                'apikey': SUPABASE_ANON_KEY,
                'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
                'Content-Type': 'application/json',
                'Prefer': 'return=minimal'
              },
              body: JSON.stringify({
                type: 'error',
                message: `Cron 최종 실패 (3회 재시도) - ${kstHour}:${kstMinute} KST`,
                error_type: 'cron',
                metadata: {
                  error: lastError?.message,
                  time: `${kstHour}:${kstMinute}`,
                  attempts: 3
                }
              })
            },
            5000
          );
        } catch (logErr) {
          console.error('로그 기록 실패:', logErr);
        }
        return; // 실패 시 조기 종료
      }

      if (result.success) {
        console.log(`성공: ${result.success_count}개, 실패: ${result.error_count}개`);

        // 실패한 거래처가 있으면 Queue에 전송
        if (result.error_count > 0 && result.results && env.POSTING_QUEUE) {
          const failedClients = result.results.filter(r => r.status === 'error');
          console.log(`Queue에 ${failedClients.length}개 실패 거래처 전송 중...`);

          for (const failed of failedClients) {
            try {
              await env.POSTING_QUEUE.send({
                client_id: failed.client_id,
                subdomain: failed.subdomain,
                scheduled_time: new Date().toISOString(),
                attempt: 1,
                error: failed.error
              });
              console.log(`Queue 전송 성공: ${failed.subdomain || failed.client_id}`);
            } catch (queueError) {
              console.error(`Queue 전송 실패: ${failed.subdomain}`, queueError);
            }
          }
        }
      }

      // 매 시간 정각 에러 집계 알림 (00분대)
      if (kstMinute >= 0 && kstMinute < 10) {
        console.log('에러 집계 알림 시작 (KST):', kstDate.toISOString());

        try {
          const reportResponse = await fetch(`${env.API_BASE_URL}/api/admin/hourly-report`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            }
          });

          const reportResult = await reportResponse.json();
          console.log('에러 집계 알림 결과:', JSON.stringify(reportResult));
        } catch (reportError) {
          console.error('에러 집계 알림 에러:', reportError);
        }
      }

      if (kstHour === 23 && kstMinute >= 50 && kstMinute < 60) {
        console.log('포스팅 누락 체크 시작 (KST):', kstDate.toISOString());

        try {
          const checkResponse = await fetch(`${env.API_BASE_URL}/api/check-missing-posts`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            }
          });

          const checkResult = await checkResponse.json();
          console.log('포스팅 누락 체크 결과:', JSON.stringify(checkResult));

          if (checkResult.success) {
            console.log(`체크: ${checkResult.checked_count}개, 누락: ${checkResult.missing_count}개`);
          }
        } catch (checkError) {
          console.error('포스팅 누락 체크 에러:', checkError);
        }
      }

      // 매일 09:00 KST 토큰 만료 체크
      if (kstHour === 9 && kstMinute >= 0 && kstMinute < 10) {
        console.log('토큰 만료 체크 시작 (KST):', kstDate.toISOString());

        try {
          // token_manager 테이블에서 모든 토큰 조회
          const tokenResponse = await fetch(
            `${SUPABASE_URL}/rest/v1/token_manager?select=*`,
            {
              headers: {
                'apikey': SUPABASE_ANON_KEY,
                'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
                'Content-Type': 'application/json'
              }
            }
          );

          if (!tokenResponse.ok) {
            throw new Error(`Failed to fetch tokens: ${tokenResponse.status}`);
          }

          const tokens = await tokenResponse.json();
          const now = new Date();
          const warnings = [];

          for (const token of tokens) {
            // expires_at이 NULL이면 영구 토큰 → 스킵
            if (!token.expires_at) {
              continue;
            }

            const expiresAt = new Date(token.expires_at);
            const daysLeft = Math.floor((expiresAt - now) / (1000 * 60 * 60 * 24));

            // 만료됨
            if (daysLeft < 0) {
              warnings.push({
                level: 'critical',
                service: token.service_name,
                name: token.token_name,
                daysLeft: daysLeft,
                message: `❌ 만료됨: ${token.service_name} - ${token.token_name} (${Math.abs(daysLeft)}일 전 만료)`
              });
            }
            // 30일 이내 만료
            else if (daysLeft <= 30) {
              warnings.push({
                level: 'warning',
                service: token.service_name,
                name: token.token_name,
                daysLeft: daysLeft,
                message: `⚠️ 만료 임박: ${token.service_name} - ${token.token_name} (${daysLeft}일 남음)`
              });
            }
            // 90일 이내 만료 (사전 알림)
            else if (daysLeft <= 90) {
              warnings.push({
                level: 'info',
                service: token.service_name,
                name: token.token_name,
                daysLeft: daysLeft,
                message: `ℹ️ 갱신 권장: ${token.service_name} - ${token.token_name} (${daysLeft}일 남음)`
              });
            }
          }

          // 경고가 있으면 로그 기록
          if (warnings.length > 0) {
            console.log(`토큰 경고 (${warnings.length}개):`, warnings.map(w => w.message).join(', '));

            // logs 테이블에 기록
            const criticalWarnings = warnings.filter(w => w.level === 'critical');
            const warningLevel = warnings.filter(w => w.level === 'warning');

            if (criticalWarnings.length > 0 || warningLevel.length > 0) {
              const logMessage = [
                `토큰 만료 알림:`,
                criticalWarnings.length > 0 ? `만료됨 ${criticalWarnings.length}개` : null,
                warningLevel.length > 0 ? `임박 ${warningLevel.length}개` : null
              ].filter(Boolean).join(', ');

              await fetch(
                `${SUPABASE_URL}/rest/v1/logs`,
                {
                  method: 'POST',
                  headers: {
                    'apikey': SUPABASE_ANON_KEY,
                    'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
                    'Content-Type': 'application/json',
                    'Prefer': 'return=minimal'
                  },
                  body: JSON.stringify({
                    level: criticalWarnings.length > 0 ? 'error' : 'warning',
                    message: logMessage,
                    metadata: { warnings: warnings }
                  })
                }
              );
            }

            console.log('토큰 체크 완료:', {
              checked: tokens.length,
              warnings: warnings.length
            });
          } else {
            console.log('모든 토큰 정상 (체크:', tokens.length, '개)');
          }
        } catch (tokenError) {
          console.error('토큰 만료 체크 에러:', tokenError);

          // 에러 로그 기록
          await fetch(
            `${SUPABASE_URL}/rest/v1/logs`,
            {
              method: 'POST',
              headers: {
                'apikey': SUPABASE_ANON_KEY,
                'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
                'Content-Type': 'application/json',
                'Prefer': 'return=minimal'
              },
              body: JSON.stringify({
                level: 'error',
                message: `토큰 모니터 에러: ${tokenError.message}`
              })
            }
          );
        }
      }

    } catch (error) {
      console.error('CAPS 엔진 자동 실행 에러:', error);
    }
  }
};

async function handleBlogPage(subdomain, contentId, env = {}) {
  try {
    // 거래처 정보 조회 (10초 타임아웃)
    const clientResponse = await fetchWithTimeout(
      `${SUPABASE_URL}/rest/v1/clients?subdomain=eq.${subdomain}&select=id,business_name,language,address,phone,status,links,business_name_translated,address_translated,business_hours_translated,subscription_status,subscription_end_date`,
      {
        headers: {
          'apikey': SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
        }
      },
      10000
    );

    const clients = await clientResponse.json();

    if (!clients || clients.length === 0) {
      return new Response('Not Found', { status: 404 });
    }

    const client = clients[0];

    if (client.활성 !== 'active') {
      return new Response('This page is inactive', { status: 403 });
    }

    // 구독 해지 확인 (subscription_status = 'cancelled' AND subscription_end_date < 현재날짜)
    if (client.subscription_status === 'cancelled' && client.subscription_end_date) {
      const now = new Date();
      const endDate = new Date(client.subscription_end_date);

      if (endDate < now) {
        // 구독 종료 → 사이트 차단
        return new Response(generateSuspendedPage(), {
          headers: { 'Content-Type': 'text/html; charset=utf-8' },
          status: 403
        });
      }
    }

    // links 파싱 (JSONB 문자열 → 배열)
    if (client.links && typeof client.links === 'string') {
      try {
        client.links = JSON.parse(client.links);
      } catch (e) {
        client.links = [];
      }
    }
    if (!Array.isArray(client.links)) {
      client.links = [];
    }

    // 번역 처리
    let displayBusinessName = client.business_name;
    let displayAddress = client.주소;

    if (client.language && client.language !== '한국어') {
      // 이미 번역된 것이 있으면 사용
      if (client.business_name_translated) {
        displayBusinessName = client.business_name_translated;
      }
      if (client.주소_translated) {
        displayAddress = client.주소_translated;
      }

      // 번역이 없으면 생성 (동기로 처리)
      if (!client.business_name_translated || !client.주소_translated) {
        if (env.ANTHROPIC_API_KEY && env.SUPABASE_SERVICE_ROLE_KEY) {
          const translations = await translateClientInfo(
            client.business_name,
            client.주소,
            client.business_hours || '',
            client.language,
            env.ANTHROPIC_API_KEY
          );

          if (translations) {
            // 번역 결과를 바로 사용
            if (!client.business_name_translated && translations.businessName) {
              displayBusinessName = translations.businessName;
            }
            if (!client.주소_translated && translations.address) {
              displayAddress = translations.address;
            }

            // DB에 저장 (비동기로 처리)
            saveClientTranslations(client.id, translations, env.SUPABASE_SERVICE_ROLE_KEY);
          }
        }
      }
    }

    // 번역된 텍스트를 client 객체에 반영
    const displayClient = {
      ...client,
      business_name: displayBusinessName,
      address: displayAddress
    };

    // 콘텐츠 조회 (10초 타임아웃)
    const contentResponse = await fetchWithTimeout(
      `${SUPABASE_URL}/rest/v1/contents?id=eq.${contentId}&client_id=eq.${client.id}&select=id,title,description,created_at,photo_ids`,
      {
        headers: {
          'apikey': SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
        }
      },
      10000
    );

    const contents = await contentResponse.json();

    if (!contents || contents.length === 0) {
      return new Response('Not Found', { status: 404 });
    }

    const content = contents[0];

    // photo_ids로 사진 조회 (10초 타임아웃)
    let photos = [];
    if (content.photo_ids && content.photo_ids.length > 0) {
      const photoIds = content.photo_ids.join(',');
      const photosResponse = await fetchWithTimeout(
        `${SUPABASE_URL}/rest/v1/client_photos?id=in.(${photoIds})&select=id,file_path,file_name`,
        {
          headers: {
            'apikey': SUPABASE_ANON_KEY,
            'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
          }
        }
      );
      photos = await photosResponse.json();
      if (!Array.isArray(photos)) {
        photos = [];
      }
    }

    const html = generateBlogPage(displayClient, content, photos, subdomain);

    return new Response(html, {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'public, max-age=300'
      }
    });

  } catch (error) {
    console.error('Error:', error);
    return new Response('Internal Server Error: ' + error.message, { status: 500 });
  }
}

function generateBlogPage(client, content, photos, subdomain) {
  const lang = client.language || '한국어';
  const businessName = client.business_name || '';
  const address = client.주소 || '';
  const phone = client.전화번호 || '';
  const businessHours = client.business_hours || '';

  // XSS 방지용 이스케이프된 버전
  const businessNameEsc = escapeHtml(businessName);
  const addressEsc = escapeHtml(address);
  const phoneEsc = escapeHtml(phone);
  const businessHoursEsc = escapeHtml(businessHours);
  const contentTitleEsc = escapeHtml(content.title || '');
  const contentTextEsc = escapeHtml(content.text || '');

  // UI 라벨 가져오기 (LANGUAGE_TEXTS와 동기화)
  const LABELS = {
    '한국어': {
      back: '← 돌아가기',
      phoneLabel: '전화',
      businessInfo: '업체 정보',
      businessName: '업체명',
      addressLabel: '주소',
      hoursLabel: '영업시간',
      parkingLabel: '주차',
      adminPassword: '관리자 비밀번호를 입력하세요',
      passwordPlaceholder: '비밀번호',
      cancel: '취소',
      delete: '삭제',
      enterPassword: '비밀번호를 입력하세요.',
      deleted: '삭제되었습니다.',
      deleteFailed: '삭제 실패: ',
      unknownError: '알 수 없는 오류',
      invalidPassword: '비밀번호가 틀렸습니다.'
    },
    'English': {
      back: '← Back',
      phoneLabel: 'Phone',
      businessInfo: 'Business Information',
      businessName: 'Business Name',
      addressLabel: 'Address',
      hoursLabel: 'Hours',
      parkingLabel: 'Parking',
      adminPassword: 'Enter administrator password',
      passwordPlaceholder: 'Password',
      cancel: 'Cancel',
      delete: 'Delete',
      enterPassword: 'Please enter password.',
      deleted: 'Deleted.',
      deleteFailed: 'Delete failed: ',
      unknownError: 'Unknown error',
      invalidPassword: 'Incorrect password.'
    },
    '日本語': {
      back: '← 戻る',
      phoneLabel: '電話',
      businessInfo: '店舗情報',
      businessName: '店舗名',
      addressLabel: '住所',
      hoursLabel: '営業時間',
      parkingLabel: '駐車場',
      adminPassword: '管理者パスワードを入力してください',
      passwordPlaceholder: 'パスワード',
      cancel: 'キャンセル',
      delete: '削除',
      enterPassword: 'パスワードを入力してください。',
      deleted: '削除されました。',
      deleteFailed: '削除に失敗しました: ',
      unknownError: '不明なエラー',
      invalidPassword: 'パスワードが間違っています。'
    },
    '일본어': {
      back: '← 戻る',
      phoneLabel: '電話',
      businessInfo: '店舗情報',
      businessName: '店舗名',
      addressLabel: '住所',
      hoursLabel: '営業時間',
      parkingLabel: '駐車場',
      adminPassword: '管理者パスワードを入力してください',
      passwordPlaceholder: 'パスワード',
      cancel: 'キャンセル',
      delete: '削除',
      enterPassword: 'パスワードを入力してください。',
      deleted: '削除されました。',
      deleteFailed: '削除に失敗しました: ',
      unknownError: '不明なエラー',
      invalidPassword: 'パスワードが間違っています。'
    },
    '中文': {
      back: '← 返回',
      phoneLabel: '电话',
      businessInfo: '企业信息',
      businessName: '企业名称',
      addressLabel: '地址',
      hoursLabel: '营业时间',
      parkingLabel: '停车',
      adminPassword: '请输入管理员密码',
      passwordPlaceholder: '密码',
      cancel: '取消',
      delete: '删除',
      enterPassword: '请输入密码。',
      deleted: '已删除。',
      deleteFailed: '删除失败: ',
      unknownError: '未知错误',
      invalidPassword: '密码错误。'
    },
    '繁體中文': {
      back: '← 返回',
      phoneLabel: '電話',
      businessInfo: '企業資訊',
      businessName: '企業名稱',
      addressLabel: '地址',
      hoursLabel: '營業時間',
      parkingLabel: '停車',
      adminPassword: '請輸入管理員密碼',
      passwordPlaceholder: '密碼',
      cancel: '取消',
      delete: '刪除',
      enterPassword: '請輸入密碼。',
      deleted: '已刪除。',
      deleteFailed: '刪除失敗: ',
      unknownError: '未知錯誤',
      invalidPassword: '密碼錯誤。'
    },
    'ไทย': {
      back: '← กลับ',
      phoneLabel: 'โทรศัพท์',
      businessInfo: 'ข้อมูลธุรกิจ',
      businessName: 'ชื่อธุรกิจ',
      addressLabel: 'ที่อยู่',
      hoursLabel: 'เวลาทำการ',
      parkingLabel: 'ที่จอดรถ',
      adminPassword: 'กรุณากรอกรหัสผ่านผู้ดูแลระบบ',
      passwordPlaceholder: 'รหัสผ่าน',
      cancel: 'ยกเลิก',
      delete: 'ลบ',
      enterPassword: 'กรุณากรอกรหัสผ่าน',
      deleted: 'ลบแล้ว',
      deleteFailed: 'ลบไม่สำเร็จ: ',
      unknownError: 'ข้อผิดพลาดที่ไม่ทราบสาเหตุ',
      invalidPassword: 'รหัสผ่านไม่ถูกต้อง'
    },
    'Tiếng Việt': {
      back: '← Quay lại',
      phoneLabel: 'Điện thoại',
      businessInfo: 'Thông tin doanh nghiệp',
      businessName: 'Tên doanh nghiệp',
      addressLabel: 'Địa chỉ',
      hoursLabel: 'Giờ làm việc',
      parkingLabel: 'Bãi đỗ xe',
      adminPassword: 'Vui lòng nhập mật khẩu quản trị viên',
      passwordPlaceholder: 'Mật khẩu',
      cancel: 'Hủy',
      delete: 'Xóa',
      enterPassword: 'Vui lòng nhập mật khẩu.',
      deleted: 'Đã xóa.',
      deleteFailed: 'Xóa thất bại: ',
      unknownError: 'Lỗi không xác định',
      invalidPassword: 'Mật khẩu không đúng.'
    },
    'Deutsch': {
      back: '← Zurück',
      phoneLabel: 'Telefon',
      businessInfo: 'Geschäftsinformationen',
      businessName: 'Firmenname',
      addressLabel: 'Adresse',
      hoursLabel: 'Öffnungszeiten',
      parkingLabel: 'Parkplatz',
      adminPassword: 'Bitte Administrator-Passwort eingeben',
      passwordPlaceholder: 'Passwort',
      cancel: 'Abbrechen',
      delete: 'Löschen',
      enterPassword: 'Bitte Passwort eingeben.',
      deleted: 'Gelöscht.',
      deleteFailed: 'Löschen fehlgeschlagen: ',
      unknownError: 'Unbekannter Fehler',
      invalidPassword: 'Falsches Passwort.'
    },
    'Français': {
      back: '← Retour',
      phoneLabel: 'Téléphone',
      businessInfo: 'Informations sur l\'entreprise',
      businessName: 'Nom de l\'entreprise',
      addressLabel: 'Adresse',
      hoursLabel: 'Heures d\'ouverture',
      parkingLabel: 'Parking',
      adminPassword: 'Veuillez entrer le mot de passe administrateur',
      passwordPlaceholder: 'Mot de passe',
      cancel: 'Annuler',
      delete: 'Supprimer',
      enterPassword: 'Veuillez entrer le mot de passe.',
      deleted: 'Supprimé.',
      deleteFailed: 'Échec de la suppression: ',
      unknownError: 'Erreur inconnue',
      invalidPassword: 'Mot de passe incorrect.'
    },
    'Español': {
      back: '← Volver',
      phoneLabel: 'Teléfono',
      businessInfo: 'Información de la empresa',
      businessName: 'Nombre de la empresa',
      addressLabel: 'Dirección',
      hoursLabel: 'Horario',
      parkingLabel: 'Estacionamiento',
      adminPassword: 'Por favor ingrese la contraseña del administrador',
      passwordPlaceholder: 'Contraseña',
      cancel: 'Cancelar',
      delete: 'Eliminar',
      enterPassword: 'Por favor ingrese la contraseña.',
      deleted: 'Eliminado.',
      deleteFailed: 'Error al eliminar: ',
      unknownError: 'Error desconocido',
      invalidPassword: 'Contraseña incorrecta.'
    },
    'العربية': {
      back: '← العودة',
      phoneLabel: 'الهاتف',
      businessInfo: 'معلومات الشركة',
      businessName: 'اسم الشركة',
      addressLabel: 'العنوان',
      hoursLabel: 'ساعات العمل',
      parkingLabel: 'موقف السيارات',
      adminPassword: 'الرجاء إدخال كلمة مرور المسؤول',
      passwordPlaceholder: 'كلمة المرور',
      cancel: 'إلغاء',
      delete: 'حذف',
      enterPassword: 'الرجاء إدخال كلمة المرور.',
      deleted: 'تم الحذف.',
      deleteFailed: 'فشل الحذف: ',
      unknownError: 'خطأ غير معروف',
      invalidPassword: 'كلمة المرور غير صحيحة.'
    },
    'Русский': {
      back: '← Назад',
      phoneLabel: 'Телефон',
      businessInfo: 'Информация о компании',
      businessName: 'Название компании',
      addressLabel: 'Адрес',
      hoursLabel: 'Часы работы',
      parkingLabel: 'Парковка',
      adminPassword: 'Пожалуйста, введите пароль администратора',
      passwordPlaceholder: 'Пароль',
      cancel: 'Отмена',
      delete: 'Удалить',
      enterPassword: 'Пожалуйста, введите пароль.',
      deleted: 'Удалено.',
      deleteFailed: 'Ошибка удаления: ',
      unknownError: 'Неизвестная ошибка',
      invalidPassword: 'Неверный пароль.'
    },
    'Bahasa Indonesia': {
      back: '← Kembali',
      phoneLabel: 'Telepon',
      businessInfo: 'Informasi Bisnis',
      businessName: 'Nama Bisnis',
      addressLabel: 'Alamat',
      hoursLabel: 'Jam Operasional',
      parkingLabel: 'Parkir',
      adminPassword: 'Silakan masukkan kata sandi administrator',
      passwordPlaceholder: 'Kata sandi',
      cancel: 'Batal',
      delete: 'Hapus',
      enterPassword: 'Silakan masukkan kata sandi.',
      deleted: 'Dihapus.',
      deleteFailed: 'Gagal menghapus: ',
      unknownError: 'Kesalahan tidak diketahui',
      invalidPassword: 'Kata sandi salah.'
    },
    'Bahasa Melayu': {
      back: '← Kembali',
      phoneLabel: 'Telefon',
      businessInfo: 'Maklumat Perniagaan',
      businessName: 'Nama Perniagaan',
      addressLabel: 'Alamat',
      hoursLabel: 'Waktu Operasi',
      parkingLabel: 'Tempat Letak Kereta',
      adminPassword: 'Sila masukkan kata laluan pentadbir',
      passwordPlaceholder: 'Kata laluan',
      cancel: 'Batal',
      delete: 'Padam',
      enterPassword: 'Sila masukkan kata laluan.',
      deleted: 'Dipadam.',
      deleteFailed: 'Gagal memadam: ',
      unknownError: 'Ralat tidak diketahui',
      invalidPassword: 'Kata laluan salah.'
    }
  };
  
  // 언어 정규화 함수
  function normalizeBlogLanguage(lang) {
    const normalized = lang ? lang.toLowerCase().trim() : '';
    if (normalized.includes('한국') || normalized.includes('korean') || normalized === 'ko') return '한국어';
    if (normalized.includes('english') || normalized === 'en') return 'English';
    if (normalized.includes('일본') || normalized.includes('japanese') || normalized === 'ja' || normalized.includes('日本語')) return '日本語';
    if (normalized.includes('중국') || normalized.includes('chinese') || normalized === 'zh' || normalized.includes('中文')) return '中文';
    if (normalized.includes('번체') || normalized.includes('繁體')) return '繁體中文';
    if (normalized.includes('태국') || normalized.includes('thai') || normalized === 'th' || normalized.includes('ไทย')) return 'ไทย';
    if (normalized.includes('베트남') || normalized.includes('vietnamese') || normalized === 'vi' || normalized.includes('tiếng')) return 'Tiếng Việt';
    if (normalized.includes('독일') || normalized.includes('german') || normalized === 'de' || normalized.includes('deutsch')) return 'Deutsch';
    if (normalized.includes('프랑스') || normalized.includes('french') || normalized === 'fr' || normalized.includes('français')) return 'Français';
    if (normalized.includes('스페인') || normalized.includes('spanish') || normalized === 'es' || normalized.includes('español')) return 'Español';
    if (normalized.includes('아랍') || normalized.includes('arabic') || normalized === 'ar' || normalized.includes('العربية')) return 'العربية';
    if (normalized.includes('러시아') || normalized.includes('russian') || normalized === 'ru' || normalized.includes('русский')) return 'Русский';
    if (normalized.includes('인도네시아') || normalized.includes('indonesian') || normalized === 'id' || normalized.includes('bahasa indonesia')) return 'Bahasa Indonesia';
    if (normalized.includes('말레이') || normalized.includes('malay') || normalized === 'ms' || normalized.includes('bahasa melayu')) return 'Bahasa Melayu';
    return '한국어'; // 기본값
  }
  
  const normalizedLang = normalizeBlogLanguage(lang);
  const labels = LABELS[normalizedLang] || LABELS['한국어'];

  // 날짜 포맷팅 (UTC → KST 변환)
  const utcDate = new Date(content.created_at);
  const kstDate = new Date(utcDate.getTime() + (9 * 60 * 60 * 1000)); // UTC+9
  let contentDate;
  const normalizedLangForDate = normalizeBlogLanguage(lang);

  if (normalizedLangForDate === '한국어') {
    const year = kstDate.getUTCFullYear();
    const month = kstDate.getUTCMonth() + 1;
    const day = kstDate.getUTCDate();
    const hours = kstDate.getUTCHours();
    const minutes = kstDate.getUTCMinutes().toString().padStart(2, '0');
    const period = hours < 12 ? '오전' : '오후';
    const displayHours = hours % 12 || 12;
    contentDate = `${year}년 ${month}월 ${day}일 ${period} ${displayHours.toString().padStart(2, '0')}:${minutes}`;
  } else if (normalizedLangForDate === '日本語' || normalizedLangForDate === '일본어') {
    const year = kstDate.getUTCFullYear();
    const month = kstDate.getUTCMonth() + 1;
    const day = kstDate.getUTCDate();
    const hours = kstDate.getUTCHours().toString().padStart(2, '0');
    const minutes = kstDate.getUTCMinutes().toString().padStart(2, '0');
    contentDate = `${year}年${month}月${day}日 ${hours}:${minutes}`;
  } else if (normalizedLangForDate === 'ไทย') {
    // 태국어 날짜 포맷
    const months = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];
    const year = kstDate.getUTCFullYear() + 543; // 불기 연도
    const month = months[kstDate.getUTCMonth()];
    const day = kstDate.getUTCDate();
    const hours = kstDate.getUTCHours();
    const minutes = kstDate.getUTCMinutes().toString().padStart(2, '0');
    contentDate = `${day} ${month} ${year} ${hours}:${minutes} น.`;
  } else if (normalizedLangForDate === '中文' || normalizedLangForDate === '繁體中文') {
    // 중국어 날짜 포맷
    const year = kstDate.getUTCFullYear();
    const month = kstDate.getUTCMonth() + 1;
    const day = kstDate.getUTCDate();
    const hours = kstDate.getUTCHours();
    const minutes = kstDate.getUTCMinutes().toString().padStart(2, '0');
    const period = hours < 12 ? '上午' : '下午';
    const displayHours = hours % 12 || 12;
    contentDate = `${year}年${month}月${day}日 ${period} ${displayHours}:${minutes}`;
  } else {
    // English 및 기타 언어 (영어 형식)
    const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    const year = kstDate.getUTCFullYear();
    const month = months[kstDate.getUTCMonth()];
    const day = kstDate.getUTCDate();
    const hours = kstDate.getUTCHours();
    const minutes = kstDate.getUTCMinutes().toString().padStart(2, '0');
    const period = hours < 12 ? 'AM' : 'PM';
    const displayHours = hours % 12 || 12;
    contentDate = `${month} ${day}, ${year} ${displayHours}:${minutes} ${period}`;
  }

  return `<!DOCTYPE html>
<html lang="${lang === 'English' ? 'en' : lang === '日本語' ? 'ja' : 'ko'}">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="description" content="${contentTextEsc ? contentTextEsc.substring(0, 150) : contentTitleEsc}">
    <meta name="author" content="${businessNameEsc}">

    <!-- Open Graph / Facebook -->
    <meta property="og:type" content="article">
    <meta property="og:url" content="https://${subdomain}.make-page.com/blog/${content.id}">
    <meta property="og:title" content="${contentTitleEsc}">
    <meta property="og:description" content="${contentTextEsc ? contentTextEsc.substring(0, 150) : contentTitleEsc}">
    ${content.photo_url ? `<meta property="og:image" content="${content.photo_url}">` : ''}
    <meta property="og:locale" content="${lang === '한국어' ? 'ko_KR' : lang === 'English' ? 'en_US' : lang === '日本語' || lang === '일본어' ? 'ja_JP' : 'ko_KR'}">

    <!-- Twitter -->
    <meta property="twitter:card" content="summary_large_image">
    <meta property="twitter:url" content="https://${subdomain}.make-page.com/blog/${content.id}">
    <meta property="twitter:title" content="${contentTitleEsc}">
    <meta property="twitter:description" content="${contentTextEsc ? contentTextEsc.substring(0, 150) : contentTitleEsc}">
    ${content.photo_url ? `<meta property="twitter:image" content="${content.photo_url}">` : ''}

    <link rel="canonical" href="https://${subdomain}.make-page.com/blog/${content.id}">
    <title>${contentTitleEsc} - ${businessNameEsc}</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            background: #f5f5f5;
        }

        .container {
            max-width: 800px;
            margin: 0 auto;
            padding: 20px;
            background: #ffffff;
            min-height: 100vh;
        }

        .header-nav {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 20px;
        }

        .back-link {
            display: inline-block;
            color: #666;
            text-decoration: none;
            font-size: 0.95em;
        }

        .back-link:hover {
            color: #333;
        }

        .delete-btn {
            background: #dc3545;
            color: white;
            border: none;
            border-radius: 6px;
            padding: 8px 16px;
            font-size: 0.9em;
            cursor: pointer;
            transition: background 0.2s;
        }

        .delete-btn:hover {
            background: #c82333;
        }

        .modal {
            display: none;
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.5);
            z-index: 2000;
            align-items: center;
            justify-content: center;
        }

        .modal-content {
            background: white;
            padding: 24px;
            border-radius: 12px;
            max-width: 400px;
            width: 90%;
        }

        .modal-title {
            font-size: 1.2em;
            font-weight: 600;
            margin-bottom: 16px;
        }

        .modal-buttons {
            display: flex;
            gap: 12px;
            margin-top: 20px;
        }

        .modal-btn {
            flex: 1;
            padding: 10px;
            border: none;
            border-radius: 6px;
            font-size: 1em;
            cursor: pointer;
            transition: background 0.2s;
        }

        .modal-btn-cancel {
            background: #e0e0e0;
            color: #333;
        }

        .modal-btn-cancel:hover {
            background: #d0d0d0;
        }

        .modal-btn-delete {
            background: #dc3545;
            color: white;
        }

        .modal-btn-delete:hover {
            background: #c82333;
        }

        h1 {
            font-size: 1.8em;
            margin-bottom: 10px;
            color: #222;
        }

        .date {
            color: #999;
            font-size: 0.9em;
            margin-bottom: 20px;
        }

        .photos {
            margin-bottom: 30px;
        }

        .photo {
            width: 100%;
            height: auto;
            border-radius: 8px;
            margin-bottom: 12px;
            cursor: pointer;
            transition: opacity 0.2s;
        }

        .photo:hover {
            opacity: 0.9;
        }

        .section-block {
            margin-bottom: 40px;
        }

        .section-subtitle {
            font-size: 1.3em;
            font-weight: 600;
            margin: 20px 0 12px 0;
            color: #222;
        }

        .section-content {
            font-size: 1.05em;
            line-height: 1.8;
            color: #444;
            margin-bottom: 20px;
        }

        .business-info-block {
            background: #f8f9fa;
            border-radius: 12px;
            padding: 24px;
            margin-top: 40px;
            margin-bottom: 40px;
        }

        .business-info-block h3 {
            font-size: 1.2em;
            font-weight: 600;
            margin-bottom: 16px;
            color: #333;
        }

        .business-info-block p {
            font-size: 1em;
            line-height: 1.7;
            margin-bottom: 10px;
            color: #555;
        }

        .business-info-block .tagline {
            font-style: italic;
            color: #666;
            margin-top: 16px;
            padding-top: 16px;
            border-top: 1px solid #e0e0e0;
        }

        .content {
            font-size: 1.05em;
            line-height: 1.8;
            white-space: pre-wrap;
            margin-bottom: 40px;
        }

        .lightbox {
            display: none;
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.9);
            z-index: 1000;
            align-items: center;
            justify-content: center;
        }

        .lightbox-img {
            max-width: 90%;
            max-height: 90%;
            object-fit: contain;
        }

        .lightbox-close {
            position: absolute;
            top: 20px;
            right: 20px;
            background: none;
            border: none;
            color: #fff;
            font-size: 40px;
            cursor: pointer;
            width: 50px;
            height: 50px;
            display: flex;
            align-items: center;
            justify-content: center;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header-nav">
            <a href="/" class="back-link">${labels.back}</a>
            <button id="delete-btn" class="delete-btn">✕</button>
        </div>

        <h1>${contentTitleEsc}</h1>
        <div class="date">${contentDate}</div>

        ${(() => {
          try {
            // JSON 파싱 시도 (인터리브 구조)
            let cleanDesc = content.description.trim();

            // 코드블록 제거 (```json, ``` 등) - 전역으로 모든 코드블록 제거
            if (cleanDesc.includes('```')) {
              // 먼저 ```json\n 패턴 제거
              cleanDesc = cleanDesc.replace(/```json\s*/g, '');
              // 그 다음 남은 ``` 제거
              cleanDesc = cleanDesc.replace(/```\s*/g, '');
              // 남은 "json" 텍스트도 제거 (줄바꿈 뒤 또는 독립적으로 있는 경우)
              cleanDesc = cleanDesc.replace(/^json\s*/gm, '');
              cleanDesc = cleanDesc.trim();
            }

            let contentData = JSON.parse(cleanDesc);
            let sections = contentData.sections || [];
            let businessInfo = contentData.business_info || {};

            // 이중 래핑 감지 및 해제
            if (sections.length === 1 && sections[0].content) {
              const firstContent = sections[0].content.trim();
              if (firstContent.startsWith('{')) {
                try {
                  const innerData = JSON.parse(firstContent);
                  if (innerData.title && innerData.sections && Array.isArray(innerData.sections)) {
                    // 내부 JSON으로 교체 - 성공
                    sections = innerData.sections;
                    businessInfo = innerData.business_info || businessInfo;
                  }
                } catch (e) {
                  // JSON 파싱 실패 - subtitle만 유지
                  sections[0].content = '';
                }
              }
            }

            // 사진 ID로 매핑
            const photoMap = {};
            photos.forEach(photo => {
              photoMap[photo.id] = photo;
            });

            return `
              ${sections.map(section => {
                const photo = photoMap[section.photo_id];
                let photoUrl = '';
                if (photo && photo.file_path) {
                  // Cloudinary 이미지
                  // 모바일 최적화: width=800 (업로드 시와 동일)
                  photoUrl = `https://res.cloudinary.com/dl0s29oyv/image/upload/w_800,c_limit,q_auto:good,f_jpg/${photo.file_path}`;
                }

                return `
                  <div class="section-block">
                    ${photoUrl ? `
                      <img src="${photoUrl}"
                           alt="${escapeHtml(photo.file_name)}"
                           class="photo"
                           onclick="openLightbox('${photoUrl}')"
                           loading="lazy">
                    ` : ''}
                    <h2 class="section-subtitle">${escapeHtml(section.subtitle || '')}</h2>
                    <p class="section-content">${escapeHtml(section.content || '')}</p>
                  </div>
                `;
              }).join('')}

              ${businessNameEsc || addressEsc || phoneEsc || businessHoursEsc ? `
                <div class="business-info-block">
                  <h3>${labels.businessInfo}</h3>
                  ${businessNameEsc ? `<p><strong>${labels.businessName}:</strong> ${businessNameEsc}</p>` : ''}
                  ${addressEsc ? `<p><strong>${labels.addressLabel}:</strong> ${addressEsc}</p>` : ''}
                  ${phoneEsc ? `<p><strong>${labels.phoneLabel}:</strong> ${phoneEsc}</p>` : ''}
                  ${businessHoursEsc ? `<p><strong>${labels.hoursLabel}:</strong> ${businessHoursEsc}</p>` : ''}
                </div>
              ` : ''}
            `;
          } catch (e) {
            // JSON 파싱 실패 시 기존 방식으로 폴백
            return `
              ${photos.length > 0 ? `
                <div class="photos">
                  ${photos.map(photo => {
                    let photoUrl = '';
                    if (photo.file_path) {
                      // Cloudinary 이미지
                      // 모바일 최적화: width=800 (업로드 시와 동일)
                  photoUrl = `https://res.cloudinary.com/dl0s29oyv/image/upload/w_800,c_limit,q_auto:good,f_jpg/${photo.file_path}`;
                    }
                    return `
                      <img src="${photoUrl}"
                           alt="${photo.file_name}"
                           class="photo"
                           onclick="openLightbox('${photoUrl}')"
                           loading="lazy">
                    `;
                  }).join('')}
                </div>
              ` : ''}
              <div class="content">${content.description}</div>
            `;
          }
        })()}
    </div>

    <!-- Lightbox -->
    <div id="lightbox" class="lightbox" onclick="closeLightbox()">
        <button class="lightbox-close" onclick="closeLightbox()">×</button>
        <img id="lightbox-img" class="lightbox-img" src="" alt="">
    </div>

    <!-- Delete Modal -->
    <div id="delete-modal" class="modal">
        <div class="modal-content">
            <div class="modal-title">${labels.adminPassword}</div>
            <input type="password" id="admin-password" placeholder="${labels.passwordPlaceholder}" style="width: 100%; padding: 12px; margin: 16px 0; border: 1px solid #ddd; border-radius: 6px; font-size: 14px; box-sizing: border-box;">
            <div class="modal-buttons">
                <button class="modal-btn modal-btn-cancel" onclick="closeDeleteModal()">${labels.cancel}</button>
                <button class="modal-btn modal-btn-delete" onclick="confirmDelete()">${labels.delete}</button>
            </div>
        </div>
    </div>

    <script>
        const contentId = '${content.id}';
        const subdomain = '${subdomain}';
        const labels = ${JSON.stringify(labels)};

        function openLightbox(url) {
            document.getElementById('lightbox').style.display = 'flex';
            document.getElementById('lightbox-img').src = url;
            document.body.style.overflow = 'hidden';
        }

        function closeLightbox() {
            document.getElementById('lightbox').style.display = 'none';
            document.body.style.overflow = 'auto';
        }

        document.getElementById('delete-btn').addEventListener('click', function() {
            document.getElementById('delete-modal').style.display = 'flex';
            document.getElementById('admin-password').value = '';
            document.getElementById('admin-password').focus();
        });

        function closeDeleteModal() {
            document.getElementById('delete-modal').style.display = 'none';
            document.getElementById('admin-password').value = '';
        }

        async function confirmDelete() {
            const password = document.getElementById('admin-password').value;

            if (!password) {
                alert(labels.enterPassword);
                return;
            }

            try {
                const response = await fetch(\`\${window.location.protocol}//\${window.location.hostname.includes('staging') ? 'caps-staging.fly.dev' : 'caps-chatbot.fly.dev'}/api/admin/contents/\${contentId}?password=\${encodeURIComponent(password)}\`, {
                    method: 'DELETE'
                });

                if (response.ok) {
                    alert(labels.deleted);
                    window.location.href = '/';
                } else {
                    const error = await response.json();
                    if (error.error === 'Invalid password') {
                        alert(labels.invalidPassword);
                    } else {
                        alert(labels.deleteFailed + (error.error || labels.unknownError));
                    }
                }
            } catch (error) {
                alert(labels.deleteFailed + error.message);
            }
        }

        // Enter 키로 삭제 실행
        document.getElementById('admin-password').addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                confirmDelete();
            }
        });
    </script>
</body>
</html>`;
}

async function generateSitePage(client, photos, infoPhotos, contents, coverPhoto = null, subdomain = '', env = {}) {
  const lang = client.language || '한국어';
  const langCode = lang === '한국어' ? 'ko' : lang === 'English' ? 'en' : lang === '日本語' ? 'ja' : 'ko';
  const businessName = client.business_name || '';
  const description = client.description || `${businessName}에 오신 것을 환영합니다.`;
  const address = client.주소 || '';
  const businessHours = client.business_hours || '';
  const phone = client.전화번호 || '';

  // XSS 방지용 이스케이프된 버전 (HTML 컨텍스트용)
  const businessNameEsc = escapeHtml(businessName);
  const descriptionEsc = escapeHtml(description);
  const addressEsc = escapeHtml(address);
  const businessHoursEsc = escapeHtml(businessHours);
  const phoneEsc = escapeHtml(phone);

  // 날짜 포맷팅 함수 (UTC → KST 변환)
  function formatDate(dateString, language) {
    const utcDate = new Date(dateString);
    const kstDate = new Date(utcDate.getTime() + (9 * 60 * 60 * 1000)); // UTC+9

    if (language === '한국어') {
      const year = kstDate.getUTCFullYear();
      const month = kstDate.getUTCMonth() + 1;
      const day = kstDate.getUTCDate();
      const hours = kstDate.getUTCHours();
      const minutes = kstDate.getUTCMinutes().toString().padStart(2, '0');
      const period = hours < 12 ? '오전' : '오후';
      const displayHours = hours % 12 || 12;
      return `${year}년 ${month}월 ${day}일 ${period} ${displayHours.toString().padStart(2, '0')}:${minutes}`;
    } else if (language === '日本語' || language === '일본어') {
      const year = kstDate.getUTCFullYear();
      const month = kstDate.getUTCMonth() + 1;
      const day = kstDate.getUTCDate();
      const hours = kstDate.getUTCHours().toString().padStart(2, '0');
      const minutes = kstDate.getUTCMinutes().toString().padStart(2, '0');
      return `${year}年${month}月${day}日 ${hours}:${minutes}`;
    } else {
      // English
      const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
      const year = kstDate.getUTCFullYear();
      const month = months[kstDate.getUTCMonth()];
      const day = kstDate.getUTCDate();
      const hours = kstDate.getUTCHours();
      const minutes = kstDate.getUTCMinutes().toString().padStart(2, '0');
      const period = hours < 12 ? 'AM' : 'PM';
      const displayHours = hours % 12 || 12;
      return `${month} ${day}, ${year} ${displayHours}:${minutes} ${period}`;
    }
  }

  // 다국어 텍스트 매핑
  const LANGUAGE_TEXTS = {
    '한국어': {
      cover: '대표',
      photos: '사진',
      info: '안내',
      posts: '블로그',
      links: '바로가기',
      callNow: '전화 문의',
      location: '위치',
      hours: '영업시간',
      phone: '전화',
      back: '← 돌아가기',
      phoneLabel: '전화'
    },
    'English': {
      cover: 'Cover',
      photos: 'Photos',
      info: 'Info',
      posts: 'Blog',
      links: 'Links',
      callNow: 'Call Now',
      location: 'Location',
      hours: 'Hours',
      phone: 'Phone',
      back: '← Back',
      phoneLabel: 'Phone'
    },
    '日本語': {
      cover: 'カバー',
      photos: '写真',
      info: 'インフォ',
      posts: 'ブログ',
      links: 'リンク',
      callNow: '電話する',
      location: '場所',
      hours: '営業時間',
      phone: '電話',
      back: '← 戻る',
      phoneLabel: '電話'
    },
    '中文': {
      cover: '封面',
      photos: '照片',
      info: '信息',
      posts: '博客',
      links: '链接',
      callNow: '立即致电',
      location: '位置',
      hours: '营业时间',
      phone: '电话'
    },
    '繁體中文': {
      cover: '封面',
      photos: '照片',
      info: '資訊',
      posts: '部落格',
      links: '連結',
      callNow: '立即致電',
      location: '位置',
      hours: '營業時間',
      phone: '電話'
    },
    'ไทย': {
      cover: 'หน้าปก',
      photos: 'รูปภาพ',
      info: 'ข้อมูล',
      posts: 'บล็อก',
      links: 'ลิงก์',
      callNow: 'โทรเลย',
      location: 'ที่ตั้ง',
      hours: 'เวลาทำการ',
      phone: 'โทรศัพท์'
    },
    'Tiếng Việt': {
      cover: 'Bìa',
      photos: 'Hình ảnh',
      info: 'Thông tin',
      posts: 'Blog',
      links: 'Liên kết',
      callNow: 'Gọi ngay',
      location: 'Vị trí',
      hours: 'Giờ làm việc',
      phone: 'Điện thoại'
    },
    'Deutsch': {
      cover: 'Titelbild',
      photos: 'Fotos',
      info: 'Info',
      posts: 'Blog',
      links: 'Links',
      callNow: 'Jetzt anrufen',
      location: 'Standort',
      hours: 'Öffnungszeiten',
      phone: 'Telefon'
    },
    'Français': {
      cover: 'Couverture',
      photos: 'Photos',
      info: 'Info',
      posts: 'Blog',
      links: 'Liens',
      callNow: 'Appeler',
      location: 'Emplacement',
      hours: 'Horaires',
      phone: 'Téléphone'
    },
    'Español': {
      cover: 'Portada',
      photos: 'Fotos',
      info: 'Info',
      posts: 'Blog',
      links: 'Enlaces',
      callNow: 'Llamar ahora',
      location: 'Ubicación',
      hours: 'Horario',
      phone: 'Teléfono'
    },
    'العربية': {
      cover: 'الغلاف',
      photos: 'الصور',
      info: 'معلومات',
      posts: 'المدونة',
      links: 'الروابط',
      callNow: 'اتصل الآن',
      location: 'الموقع',
      hours: 'ساعات العمل',
      phone: 'الهاتف'
    },
    'Русский': {
      cover: 'Обложка',
      photos: 'Фото',
      info: 'Инфо',
      posts: 'Блог',
      links: 'Ссылки',
      callNow: 'Позвонить',
      location: 'Местоположение',
      hours: 'Часы работы',
      phone: 'Телефон'
    },
    'Português': {
      cover: 'Capa',
      photos: 'Fotos',
      info: 'Info',
      posts: 'Blog',
      links: 'Links',
      callNow: 'Ligar agora',
      location: 'Localização',
      hours: 'Horário',
      phone: 'Telefone'
    },
    'Italiano': {
      cover: 'Copertina',
      photos: 'Foto',
      info: 'Info',
      posts: 'Blog',
      links: 'Collegamenti',
      callNow: 'Chiama ora',
      location: 'Posizione',
      hours: 'Orari',
      phone: 'Telefono'
    },
    'Nederlands': {
      cover: 'Cover',
      photos: 'Foto\'s',
      info: 'Info',
      posts: 'Blog',
      links: 'Links',
      callNow: 'Nu bellen',
      location: 'Locatie',
      hours: 'Openingstijden',
      phone: 'Telefoon'
    },
    'Bahasa Indonesia': {
      cover: 'Sampul',
      photos: 'Foto',
      info: 'Info',
      posts: 'Blog',
      links: 'Tautan',
      callNow: 'Hubungi Sekarang',
      location: 'Lokasi',
      hours: 'Jam Operasional',
      phone: 'Telepon'
    },
    'Bahasa Melayu': {
      cover: 'Muka Depan',
      photos: 'Foto',
      info: 'Info',
      posts: 'Blog',
      links: 'Pautan',
      callNow: 'Hubungi Sekarang',
      location: 'Lokasi',
      hours: 'Waktu Operasi',
      phone: 'Telefon'
    },
    'Filipino': {
      cover: 'Takip',
      photos: 'Larawan',
      info: 'Impormasyon',
      posts: 'Blog',
      links: 'Mga Link',
      callNow: 'Tumawag Ngayon',
      location: 'Lokasyon',
      hours: 'Oras ng Operasyon',
      phone: 'Telepono'
    },
    'Türkçe': {
      cover: 'Kapak',
      photos: 'Fotoğraflar',
      info: 'Bilgi',
      posts: 'Blog',
      links: 'Bağlantılar',
      callNow: 'Hemen Ara',
      location: 'Konum',
      hours: 'Çalışma Saatleri',
      phone: 'Telefon'
    },
    'Polski': {
      cover: 'Okładka',
      photos: 'Zdjęcia',
      info: 'Info',
      posts: 'Blog',
      links: 'Linki',
      callNow: 'Zadzwoń Teraz',
      location: 'Lokalizacja',
      hours: 'Godziny Otwarcia',
      phone: 'Telefon'
    },
    'हिन्दी': {
      cover: 'कवर',
      photos: 'तस्वीरें',
      info: 'जानकारी',
      posts: 'ब्लॉग',
      links: 'लिंक',
      callNow: 'अभी कॉल करें',
      location: 'स्थान',
      hours: 'समय',
      phone: 'फोन'
    }
  };

  // 언어 정규화 (다양한 표기 지원)
  function normalizeLanguage(lang) {
    const normalized = lang.toLowerCase().trim();

    // 한국어
    if (normalized.includes('한국') || normalized.includes('korean') || normalized === 'ko') {
      return '한국어';
    }
    // 영어
    if (normalized.includes('english') || normalized === 'en') {
      return 'English';
    }
    // 일본어
    if (normalized.includes('日本') || normalized.includes('japanese') || normalized === 'ja') {
      return '日本語';
    }
    // 중국어 간체
    if (normalized.includes('中文') || normalized.includes('chinese') || normalized === 'zh' ||
        normalized.includes('简体') || normalized.includes('simplified')) {
      return '中文';
    }
    // 중국어 번체
    if (normalized.includes('繁體') || normalized.includes('繁体') || normalized.includes('traditional') ||
        normalized === 'zh-tw' || normalized === 'zh-hk') {
      return '繁體中文';
    }
    // 태국어
    if (normalized.includes('ไทย') || normalized.includes('thai') || normalized === 'th' || normalized === '태국어') {
      return 'ไทย';
    }
    // 베트남어
    if (normalized.includes('việt') || normalized.includes('viet') || normalized.includes('vietnamese') || normalized === 'vi') {
      return 'Tiếng Việt';
    }
    // 독일어
    if (normalized.includes('deutsch') || normalized.includes('german') || normalized === 'de') {
      return 'Deutsch';
    }
    // 프랑스어
    if (normalized.includes('français') || normalized.includes('french') || normalized === 'fr') {
      return 'Français';
    }
    // 스페인어
    if (normalized.includes('español') || normalized.includes('spanish') || normalized === 'es') {
      return 'Español';
    }
    // 아랍어
    if (normalized.includes('العربية') || normalized.includes('arabic') || normalized === 'ar') {
      return 'العربية';
    }
    // 러시아어
    if (normalized.includes('Русский') || normalized.includes('russian') || normalized === 'ru') {
      return 'Русский';
    }
    // 포르투갈어
    if (normalized.includes('português') || normalized.includes('portugues') || normalized.includes('portuguese') || normalized === 'pt') {
      return 'Português';
    }
    // 이탈리아어
    if (normalized.includes('italiano') || normalized.includes('italian') || normalized === 'it') {
      return 'Italiano';
    }
    // 네덜란드어
    if (normalized.includes('nederlands') || normalized.includes('dutch') || normalized === 'nl') {
      return 'Nederlands';
    }
    // 인도네시아어
    if (normalized.includes('indonesia') || normalized === 'id') {
      return 'Bahasa Indonesia';
    }
    // 말레이어
    if (normalized.includes('melayu') || normalized.includes('malay') || normalized === 'ms') {
      return 'Bahasa Melayu';
    }
    // 필리핀어
    if (normalized.includes('filipino') || normalized.includes('tagalog') || normalized === 'fil' || normalized === 'tl') {
      return 'Filipino';
    }
    // 터키어
    if (normalized.includes('türkçe') || normalized.includes('turkce') || normalized.includes('turkish') || normalized === 'tr') {
      return 'Türkçe';
    }
    // 폴란드어
    if (normalized.includes('polski') || normalized.includes('polish') || normalized === 'pl') {
      return 'Polski';
    }
    // 힌디어
    if (normalized.includes('हिन्दी') || normalized.includes('hindi') || normalized === 'hi') {
      return 'हिन्दी';
    }

    return lang;
  }

  // 번역 가져오기 (하드코딩 → DB → Claude API)
  const normalizedLang = normalizeLanguage(lang);
  let t = LANGUAGE_TEXTS[normalizedLang];

  if (!t) {
    // DB에서 조회
    t = await fetchTranslationsFromDB(normalizedLang);

    if (!t && env.ANTHROPIC_API_KEY) {
      // Claude API로 번역 생성
      t = await translateWithClaude(lang, env.ANTHROPIC_API_KEY);
      if (t && env.SUPABASE_SERVICE_ROLE_KEY) {
        // DB에 저장
        await saveTranslationsToDB(normalizedLang, t, env.SUPABASE_SERVICE_ROLE_KEY);
      }
    }
  }

  // fallback to English
  if (!t) {
    t = LANGUAGE_TEXTS['English'];
  }

  // 사진 URL 생성 (Cloudinary 또는 Supabase Storage)
  const photoUrls = photos.map(p => {
    if (p.file_path) {
      // Cloudinary 이미지
      // 모바일 최적화: width=800 (업로드 시와 동일)
      return `https://res.cloudinary.com/dl0s29oyv/image/upload/w_800,c_limit,q_auto:good,f_jpg/${p.file_path}`;
    }
    return '';
  });

  const infoPhotoUrls = infoPhotos.map(p => {
    if (p.file_path) {
      // Cloudinary 이미지
      // 모바일 최적화: width=800 (업로드 시와 동일)
      return `https://res.cloudinary.com/dl0s29oyv/image/upload/w_800,c_limit,q_auto:good,f_jpg/${p.file_path}`;
    }
    return '';
  });

  // Hero 이미지 (Cover 폴더 우선, 없으면 Photos 첫 번째 사진)
  const heroImage = coverPhoto && coverPhoto.file_path
    // 모바일 최적화: width=800 (업로드 시와 동일)
    ? `https://res.cloudinary.com/dl0s29oyv/image/upload/w_800,c_limit,q_auto:good,f_jpg/${coverPhoto.file_path}`
    : (photoUrls[0] || '');

  // Umami tracking
  const umamiScript = client.umami_website_id
    ? `<script async src="https://analytics.make-page.com/script.js" data-website-id="${client.umami_website_id}"></script>`
    : '';

  return `<!DOCTYPE html>
<html lang="${langCode}">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="description" content="${descriptionEsc || `${businessNameEsc} - ${addressEsc || ''}`}">
    <meta name="keywords" content="${businessNameEsc}, ${addressEsc || ''}, ${lang === '한국어' ? '비즈니스' : lang === '日本語' ? 'ビジネス' : 'business'}">
    <meta name="author" content="${businessNameEsc}">

    <!-- Open Graph / Facebook -->
    <meta property="og:type" content="website">
    <meta property="og:url" content="https://${subdomain}.make-page.com/">
    <meta property="og:title" content="${businessNameEsc}">
    <meta property="og:description" content="${descriptionEsc || `${businessNameEsc} - ${addressEsc || ''}`}">
    ${heroImage ? `<meta property="og:image" content="${heroImage}">` : ''}
    <meta property="og:locale" content="${langCode === 'ko' ? 'ko_KR' : langCode === 'en' ? 'en_US' : langCode === 'ja' ? 'ja_JP' : 'ko_KR'}">

    <!-- Twitter -->
    <meta property="twitter:card" content="summary_large_image">
    <meta property="twitter:url" content="https://${subdomain}.make-page.com/">
    <meta property="twitter:title" content="${businessNameEsc}">
    <meta property="twitter:description" content="${descriptionEsc || `${businessNameEsc} - ${addressEsc || ''}`}">
    ${heroImage ? `<meta property="twitter:image" content="${heroImage}">` : ''}

    <link rel="canonical" href="https://${subdomain}.make-page.com/">
    <title>${businessNameEsc}${addressEsc ? ` | ${addressEsc}` : ''}</title>
    ${umamiScript}
    <link rel="preconnect" href="https://cdn.jsdelivr.net">
    <link href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard.min.css" rel="stylesheet">
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: 'Pretendard', -apple-system, BlinkMacSystemFont, sans-serif;
            background: #ffffff;
            color: #1a1a1a;
            line-height: 1.6;
            max-width: 430px;
            margin: 0 auto;
        }

        /* Business Name Section */
        .business-name-section {
            padding: 40px 20px 20px;
            text-align: center;
        }

        .business-name {
            font-size: 2em;
            font-weight: 700;
            color: #1a1a1a;
        }

        /* Cover Section */
        .cover-section {
            padding: 32px 20px 0;
        }

        /* Hero */
        .hero {
            position: relative;
            height: 300px;
            overflow: hidden;
        }

        .hero-image {
            width: 100%;
            height: 100%;
            object-fit: cover;
            cursor: pointer;
        }

        .hero-overlay {
            position: absolute;
            bottom: 0;
            left: 0;
            right: 0;
            background: linear-gradient(transparent, rgba(0,0,0,0.7));
            padding: 30px 20px 20px;
            color: #ffffff;
        }

        .hero-title {
            font-size: 1.8em;
            font-weight: 700;
        }

        /* Info Section */
        .info-section {
            padding: 24px 20px;
            background: #f8f8f8;
        }

        .info-item {
            display: flex;
            align-items: start;
            margin-bottom: 16px;
        }

        .info-item:last-child {
            margin-bottom: 0;
        }

        .info-icon {
            margin-right: 12px;
            min-width: 24px;
            width: 24px;
            height: 24px;
            flex-shrink: 0;
        }

        .info-icon svg {
            width: 100%;
            height: 100%;
            display: block;
        }

        .info-content {
            flex: 1;
        }

        .info-label {
            font-size: 0.85em;
            color: #666;
            margin-bottom: 4px;
        }

        .info-value {
            font-size: 0.95em;
            color: #1a1a1a;
        }

        /* CTA Button */
        .cta-section {
            padding: 20px;
        }

        .cta-button {
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 8px;
            width: 100%;
            background: #1a1a1a;
            color: #ffffff;
            text-align: center;
            padding: 16px;
            border-radius: 8px;
            text-decoration: none;
            font-weight: 600;
            font-size: 1.05em;
            transition: background 0.2s;
        }

        .cta-button svg {
            width: 20px;
            height: 20px;
            flex-shrink: 0;
        }

        .cta-button:active {
            background: #333;
        }

        .cta-button-secondary {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            gap: 8px;
            background: #ffffff;
            color: #1a1a1a;
            border: 2px solid #1a1a1a;
            text-align: center;
            padding: 14px 24px;
            border-radius: 8px;
            text-decoration: none;
            font-weight: 600;
            font-size: 1.05em;
            transition: all 0.2s;
        }

        .cta-button-secondary:active {
            background: #f5f5f5;
        }

        /* Gallery */
        .gallery-section {
            padding: 32px 20px;
        }

        .section-title {
            font-size: 1.4em;
            font-weight: 700;
            margin-bottom: 20px;
        }

        .gallery-grid {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 8px;
        }

        .gallery-item {
            aspect-ratio: 1;
            overflow: hidden;
            border-radius: 4px;
            cursor: pointer;
            transition: opacity 0.2s;
        }

        .gallery-item:active {
            opacity: 0.8;
        }

        .gallery-image {
            width: 100%;
            height: 100%;
            object-fit: cover;
        }

        /* Info Grid */
        .info-grid {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 8px;
        }

        .info-item-photo {
            aspect-ratio: 1;
            overflow: hidden;
            border-radius: 4px;
            cursor: pointer;
            transition: opacity 0.2s;
        }

        .info-item-photo:active {
            opacity: 0.8;
        }

        .info-image {
            width: 100%;
            height: 100%;
            object-fit: cover;
        }

        /* Lightbox */
        .lightbox {
            display: none;
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.9);
            z-index: 1000;
            align-items: center;
            justify-content: center;
        }

        .lightbox-img {
            max-width: 90%;
            max-height: 90%;
            object-fit: contain;
        }

        .lightbox-close {
            position: absolute;
            top: 20px;
            right: 20px;
            background: none;
            border: none;
            color: #fff;
            font-size: 40px;
            cursor: pointer;
            width: 50px;
            height: 50px;
            display: flex;
            align-items: center;
            justify-content: center;
        }

        /* Posts */
        .posts-section {
            padding: 32px 20px;
            background: #f8f8f8;
        }

        .post-card {
            background: #ffffff;
            border-radius: 8px;
            overflow: hidden;
            margin-bottom: 16px;
            cursor: pointer;
            transition: transform 0.2s;
        }

        .post-card:active {
            transform: scale(0.98);
        }

        .post-image {
            width: 100%;
            aspect-ratio: 16/9;
            object-fit: cover;
        }

        .post-content {
            padding: 16px;
        }

        .post-date {
            font-size: 0.85em;
            color: #999;
            margin-bottom: 6px;
        }

        .post-title {
            font-size: 1.05em;
            font-weight: 600;
            color: #1a1a1a;
        }

        /* Footer */
        footer {
            padding: 32px 20px;
            background: #1a1a1a;
            color: #ffffff;
            text-align: center;
        }

        .footer-name {
            font-size: 1.2em;
            font-weight: 700;
            margin-bottom: 12px;
        }

        .footer-info {
            font-size: 0.9em;
            color: #999;
            line-height: 1.8;
        }

        .empty-state {
            text-align: center;
            padding: 40px 20px;
            color: #999;
        }

        /* Blog Section */
        .blog-section {
            padding: 32px 20px;
            background: #ffffff;
        }

        .blog-grid {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 12px;
        }

        .blog-card {
            display: block;
            background: #ffffff;
            border-radius: 8px;
            overflow: hidden;
            text-decoration: none;
            color: inherit;
            transition: transform 0.2s;
        }

        .blog-card:hover {
            transform: translateY(-2px);
        }

        .blog-card:active {
            transform: scale(0.98);
        }

        .blog-image {
            width: 100%;
            aspect-ratio: 1;
            object-fit: cover;
        }

        .blog-card-content {
            padding: 12px;
        }

        .blog-date {
            font-size: 0.85em;
            color: #999;
            margin-bottom: 8px;
        }

        .blog-title {
            font-size: 0.95em;
            font-weight: 600;
            color: #1a1a1a;
            margin-bottom: 6px;
            overflow: hidden;
            text-overflow: ellipsis;
            display: -webkit-box;
            -webkit-line-clamp: 2;
            -webkit-box-orient: vertical;
        }

    </style>
</head>
<body>
    <!-- Business Name -->
    <section class="business-name-section">
        <h1 class="business-name">${businessNameEsc}</h1>
    </section>

    <!-- Cover Section -->
    <section class="cover-section">
        <h2 class="section-title">${t.cover}</h2>
    </section>

    <!-- Hero -->
    ${heroImage ? `
    <section class="hero" style="margin-top: 0;">
        <img src="${heroImage}" alt="${businessNameEsc}" class="hero-image" loading="lazy" onclick="openLightbox('${heroImage}')">
    </section>
    ` : `
    <section class="hero" style="background: #f0f0f0; display: flex; align-items: center; justify-content: center; margin-top: 0;">
        <div style="text-align: center; color: #999;">
            <div style="font-size: 3em; margin-bottom: 16px;">📷</div>
            <div style="font-size: 1.1em;">No cover image</div>
        </div>
    </section>
    `}

    <!-- Info -->
    ${(address || businessHours || phone) ? `
    <section class="info-section">
        ${address ? `
        <div class="info-item">
            <div class="info-icon">
                <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" fill="#EA4335"/>
                </svg>
            </div>
            <div class="info-content">
                <div class="info-label">${t.location}</div>
                <div class="info-value">${address}</div>
            </div>
        </div>
        ` : ''}
        ${businessHours ? `
        <div class="info-item">
            <div class="info-icon">
                <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <circle cx="12" cy="12" r="10" stroke="#34A853" stroke-width="2" fill="none"/>
                    <path d="M12 6v6l4 2" stroke="#34A853" stroke-width="2" stroke-linecap="round"/>
                </svg>
            </div>
            <div class="info-content">
                <div class="info-label">${t.hours}</div>
                <div class="info-value">${businessHours}</div>
            </div>
        </div>
        ` : ''}
        ${phone ? `
        <div class="info-item">
            <div class="info-icon">
                <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z" fill="#4285F4"/>
                </svg>
            </div>
            <div class="info-content">
                <div class="info-label">${t.phone}</div>
                <div class="info-value">${phone}</div>
            </div>
        </div>
        ` : ''}
    </section>
    ` : ''}

    <!-- CTA -->
    ${phone ? `
    <section class="cta-section">
        <a href="tel:${phone}" class="cta-button">
            <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z" fill="white"/>
            </svg>
            ${t.callNow}
        </a>
    </section>
    ` : ''}

    <!-- Blog -->
    ${contents.length > 0 ? `
    <section class="blog-section">
        <h2 class="section-title">${t.posts}</h2>
        <div class="blog-grid">
        ${contents.slice(0, 6).map(post => {
          const postPhoto = photos.find(p => p.id === post.photo_id);
          let postImageUrl = '';
          if (postPhoto && postPhoto.file_path) {
            // Cloudinary 이미지
            // 모바일 최적화: width=800 (업로드 시와 동일)
            postImageUrl = `https://res.cloudinary.com/dl0s29oyv/image/upload/w_800,c_limit,q_auto:good,f_jpg/${postPhoto.file_path}`;
          }
          const postDate = formatDate(post.created_at, lang);

          return `
          <a href="/blog/${post.id}" class="blog-card">
              ${postImageUrl ? `<img src="${postImageUrl}" alt="${post.title}" class="blog-image" loading="lazy">` : ''}
              <div class="blog-card-content">
                  <div class="blog-title">${post.title}</div>
                  <div class="blog-date">${postDate}</div>
              </div>
          </a>
          `;
        }).join('')}
        </div>
    </section>
    ` : ''}

    <!-- Photos -->
    ${photoUrls.length > 0 ? `
    <section class="gallery-section">
        <h2 class="section-title">${t.photos}</h2>
        <div class="gallery-grid">
            ${photoUrls.map(url => `
            <div class="gallery-item" onclick="openLightbox('${url}')">
                <img src="${url}" alt="${businessNameEsc}" class="gallery-image" loading="lazy">
            </div>
            `).join('')}
        </div>
    </section>
    ` : ''}

    <!-- Info Photos -->
    ${infoPhotoUrls.length > 0 ? `
    <section class="gallery-section">
        <h2 class="section-title">${t.info}</h2>
        <div class="info-grid">
            ${infoPhotoUrls.map(url => `
            <div class="info-item-photo" onclick="openLightbox('${url}')">
                <img src="${url}" alt="${businessNameEsc}" class="info-image" loading="lazy">
            </div>
            `).join('')}
        </div>
    </section>
    ` : ''}

    <!-- Links -->
    ${client.links && client.links.length > 0 && client.links.length <= 12 ? `
    <section class="gallery-section">
        <h2 class="section-title">${t.links}</h2>
        <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; justify-items: center; max-width: 600px; margin: 0 auto;">
            ${client.links.map(link => {
                // Clean markdown formatting from URL: [text](url) -> url
                const cleanUrl = link.url.replace(/^\[(.*?)\]\((.*?)\)$/, '$2');
                return `
            <a href="${cleanUrl}" target="_blank" rel="noopener noreferrer"
               style="display: inline-block; padding: 8px 16px; background: #ddd; color: #444; border: 1px solid #bbb;
                      text-decoration: none; border-radius: 20px; font-size: 14px; text-align: center;
                      transition: all 0.2s; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 100%;"
               onmouseover="this.style.background='#444'; this.style.color='#fff'"
               onmouseout="this.style.background='#ddd'; this.style.color='#444'">
                ${link.label || link.name || 'Link'}
            </a>
            `;
            }).join('')}
        </div>
    </section>
    ` : ''}


    <!-- Lightbox -->
    <div id="lightbox" class="lightbox" onclick="closeLightbox()">
        <button class="lightbox-close" onclick="closeLightbox()">×</button>
        <img id="lightbox-img" class="lightbox-img" src="" alt="">
    </div>

    <!-- Footer -->
    <footer>
        <div class="footer-name">${businessNameEsc}</div>
        <div class="footer-info">
            ${addressEsc ? `${addressEsc}<br>` : ''}
            ${phoneEsc ? `${t.phone}: ${phoneEsc}<br>` : ''}
            ${businessHoursEsc ? `${t.hours}: ${businessHoursEsc}` : ''}
        </div>
    </footer>

    <script>
        function openLightbox(url) {
            document.getElementById('lightbox').style.display = 'flex';
            document.getElementById('lightbox-img').src = url;
            document.body.style.overflow = 'hidden';
        }

        function closeLightbox() {
            document.getElementById('lightbox').style.display = 'none';
            document.body.style.overflow = 'auto';
        }

    </script>

    <!-- Structured Data -->
    <script type="application/ld+json">
    {
        "@context": "https://schema.org",
        "@type": "LocalBusiness",
        "name": "${businessName}",
        ${description ? `"description": "${description.replace(/"/g, '\\"')}",` : ''}
        ${address ? `"address": {
            "@type": "PostalAddress",
            "streetAddress": "${address.replace(/"/g, '\\"')}"
        },` : ''}
        ${phone ? `"telephone": "${phone}",` : ''}
        ${businessHours ? `"openingHours": "${businessHours.replace(/"/g, '\\"')}",` : ''}
        ${heroImage ? `"image": "${heroImage}",` : ''}
        "url": "https://${subdomain}.make-page.com/"
    }
    </script>
</body>
</html>`;
}

async function generateLandingPage() {
  // Supabase에서 최신 포스팅 6개 조회 (활성 거래처 중 최신 6개)
  let blogPosts = [];
  let sampleClients = [];
  try {
    // 활성 거래처 최신 6개 조회
    const clientsResponse = await fetch(
      `${SUPABASE_URL}/rest/v1/clients?status=eq.active&select=id,business_name,subdomain,language&order=created_at.desc&limit=6`,
      {
        headers: {
          'apikey': SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
        }
      }
    );
    const clients = await clientsResponse.json();
    sampleClients = clients;

    // 각 거래처의 최신 포스팅 1개씩 조회
    for (const client of clients) {
      const contentsResponse = await fetch(
        `${SUPABASE_URL}/rest/v1/contents?client_id=eq.${client.id}&select=id,title,created_at&order=created_at.desc&limit=1`,
        {
          headers: {
            'apikey': SUPABASE_ANON_KEY,
            'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
          }
        }
      );
      const contents = await contentsResponse.json();
      if (contents && contents.length > 0) {
        blogPosts.push({
          id: contents[0].id,
          title: contents[0].title,
          created_at: contents[0].created_at,
          business_name: client.business_name,
          subdomain: client.subdomain
        });
      }
    }
  } catch (error) {
    console.error('블로그 포스팅 조회 실패:', error);
  }

  // 날짜 포맷팅 함수
  const formatDate = (dateStr) => {
    const utcDate = new Date(dateStr);
    const kstDate = new Date(utcDate.getTime() + (9 * 60 * 60 * 1000)); // UTC+9
    return `${kstDate.getUTCFullYear()}.${String(kstDate.getUTCMonth() + 1).padStart(2, '0')}.${String(kstDate.getUTCDate()).padStart(2, '0')}`;
  };

  return `<!DOCTYPE html>
<html lang="ko">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
    <meta name="description" content="사진만 등록하면 13개 언어로 자동 포스팅. 구글 SEO에 최적화된 독립 도메인 제공. 외국인 타겟 마케팅 솔루션.">
    <meta name="naver-site-verification" content="47986cadbad0bf5479067f55f85a6978f9fb6aa7" />
    <title>콘텐츠팩토리 - 사진 등록 · 도메인 생성 · 자동 포스팅</title>

    <!-- DNS Prefetch -->
    <link rel="dns-prefetch" href="//analytics.make-page.com">
    <link rel="dns-prefetch" href="//tvymimryuwtgsfakuffl.supabase.co">

    <!-- Open Graph / Facebook -->
    <meta property="og:type" content="website">
    <meta property="og:url" content="https://make-page.com/">
    <meta property="og:title" content="콘텐츠팩토리 - 사진 등록 · 도메인 생성 · 자동 포스팅">
    <meta property="og:description" content="사진만 등록하면 13개 언어로 자동 포스팅. 구글 SEO에 최적화된 독립 도메인 제공. 외국인 타겟 마케팅 솔루션.">
    <meta property="og:locale" content="ko_KR">

    <!-- Twitter -->
    <meta property="twitter:card" content="summary_large_image">
    <meta property="twitter:url" content="https://make-page.com/">
    <meta property="twitter:title" content="콘텐츠팩토리 - 사진 등록 · 도메인 생성 · 자동 포스팅">
    <meta property="twitter:description" content="사진만 등록하면 13개 언어로 자동 포스팅. 구글 SEO에 최적화된 독립 도메인 제공. 외국인 타겟 마케팅 솔루션.">

    <link rel="canonical" href="https://make-page.com/">
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            background: #FFFFFF;
            min-height: 100vh;
            display: flex;
            flex-direction: column;
        }

        .container {
            width: 100%;
            margin: 0;
            padding: 40px 40px;
            flex: 1;
        }

        /* 데스크톱 3열 */
        .desktop-layout {
            display: flex;
            justify-content: space-between;
            align-items: start;
            gap: 40px;
        }

        .desktop-layout > * {
            flex: 0 0 auto;
        }

        .desktop-layout .center-cta {
            flex: 0 0 auto;
        }

        /* 가운데 CTA */
        .center-cta {
            text-align: center;
            padding: 20px 30px;
        }

        h1 {
            font-size: 2.2em;
            margin-bottom: 15px;
            color: #667eea;
            font-weight: 700;
        }

        .tagline {
            font-size: 1.2em;
            color: #666;
            margin-bottom: 40px;
        }

        .cta-button {
            display: inline-block;
            width: 320px;
            padding: 20px 50px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            text-align: center;
            text-decoration: none;
            border-radius: 50px;
            font-size: 1.3em;
            font-weight: 600;
            transition: transform 0.3s, box-shadow 0.3s;
            box-shadow: 0 4px 20px rgba(102, 126, 234, 0.4);
        }

        .cta-button:hover {
            transform: translateY(-3px);
            box-shadow: 0 6px 30px rgba(102, 126, 234, 0.6);
        }

        /* 좌측/우측 박스 */
        .info-box {
            background: #f8f9fa;
            padding: 30px;
            border-radius: 15px;
            border: 1px solid #e1e4e8;
            width: 560px;
            flex-shrink: 0;
            max-height: 80vh;
            overflow-y: auto;
        }

        .info-box h2 {
            font-size: 1.4em;
            margin-bottom: 20px;
            color: #667eea;
            font-weight: 600;
        }

        .info-box h3 {
            font-size: 1.1em;
            margin-top: 20px;
            margin-bottom: 10px;
            color: #667eea;
            font-weight: 600;
        }

        .info-box p {
            margin-bottom: 12px;
            line-height: 1.7;
            font-size: 0.95em;
        }

        .info-box ul {
            list-style: none;
            margin-bottom: 15px;
        }

        .info-box li {
            padding: 8px 0;
            font-size: 0.95em;
        }

        .info-box li::before {
            content: "• ";
            color: #667eea;
            font-weight: bold;
            margin-right: 8px;
        }

        .price-highlight {
            background: #fff3cd;
            padding: 15px;
            border-radius: 8px;
            margin-top: 15px;
            font-weight: 600;
            color: #856404;
        }

        /* 데스크톱 아코디언 (좌측 박스) */
        .desktop-accordion-box {
            padding: 0;
            overflow: visible;
            max-height: none;
        }

        .desktop-accordion-header {
            padding: 30px;
            cursor: pointer;
            user-select: none;
            display: flex;
            justify-content: space-between;
            align-items: center;
            transition: background 0.3s;
        }

        .desktop-accordion-header:hover {
            background: #e9ecef;
        }

        .desktop-accordion-header h2 {
            margin-bottom: 5px;
        }

        .accordion-hint {
            font-size: 0.85em;
            color: #999;
            margin: 0;
        }

        .desktop-accordion-header .icon {
            font-size: 1.2em;
            color: #667eea;
            transition: transform 0.3s;
        }

        .desktop-accordion-content {
            max-height: 0;
            overflow: hidden;
            transition: max-height 0.4s ease;
        }

        .desktop-accordion-content.active {
            max-height: 70vh;
            overflow-y: auto;
        }

        .desktop-accordion-content.active ~ .desktop-accordion-header .accordion-hint {
            display: none;
        }

        .desktop-accordion-inner {
            padding: 0 30px 30px 30px;
        }

        /* 모바일 아코디언 */
        .mobile-accordion {
            display: none;
            margin-top: 30px;
        }

        .accordion-item {
            background: #f8f9fa;
            border: 1px solid #e1e4e8;
            border-radius: 15px;
            margin-bottom: 15px;
            padding: 0;
            overflow: visible;
        }

        .accordion-header {
            padding: 30px;
            cursor: pointer;
            font-weight: 600;
            color: #667eea;
            display: flex;
            justify-content: space-between;
            align-items: center;
            transition: background 0.3s;
            user-select: none;
        }

        .accordion-header-text {
            flex: 1;
        }

        .accordion-header-text h2 {
            font-size: 1.4em;
            margin-bottom: 5px;
            color: #667eea;
            font-weight: 600;
        }

        .accordion-header .accordion-hint {
            font-size: 0.85em;
            color: #999;
            margin: 0;
        }

        .accordion-header .icon {
            font-size: 1.2em;
            color: #667eea;
        }

        .accordion-header:hover {
            background: #e9ecef;
        }

        .accordion-content {
            max-height: 0;
            overflow: hidden;
            transition: max-height 0.4s ease;
        }

        .accordion-content.active {
            max-height: 3000px;
        }

        .accordion-inner {
            padding: 0 30px 30px 30px;
        }

        .accordion-inner h3 {
            font-size: 1.1em;
            margin-top: 20px;
            margin-bottom: 10px;
            color: #667eea;
            font-weight: 600;
        }

        .accordion-inner h3:first-child {
            margin-top: 0;
        }

        .accordion-inner p {
            margin-bottom: 12px;
            line-height: 1.7;
            font-size: 0.95em;
        }

        /* 가운데 아코디언 */
        .center-accordion {
            margin-top: 30px;
            max-width: 600px;
            margin-left: auto;
            margin-right: auto;
            background: #f8f9fa;
            border-radius: 15px;
            border: 1px solid #e1e4e8;
            padding: 0;
            overflow: visible;
        }

        .center-accordion-header {
            padding: 30px;
            cursor: pointer;
            font-weight: 600;
            color: #667eea;
            display: flex;
            justify-content: space-between;
            align-items: center;
            transition: background 0.3s;
            user-select: none;
        }

        .center-accordion-header:hover {
            background: #e9ecef;
        }

        .center-accordion-header h2 {
            font-size: 1.4em;
            margin-bottom: 5px;
            color: #667eea;
            font-weight: 600;
        }

        .center-accordion-header .accordion-hint {
            font-size: 0.85em;
            color: #999;
            margin: 0;
        }

        .center-accordion-header .icon {
            font-size: 1.2em;
            color: #667eea;
            transition: transform 0.3s;
        }

        .center-accordion-content {
            max-height: 0;
            overflow: hidden;
            transition: max-height 0.4s ease;
        }

        .center-accordion-content.active {
            max-height: 800px;
        }

        .center-accordion-content.active ~ .center-accordion-header .accordion-hint {
            display: none;
        }

        .center-accordion-inner {
            padding: 0 30px 30px 30px;
        }

        .center-accordion-inner h3 {
            font-size: 1.1em;
            margin-top: 20px;
            margin-bottom: 10px;
            color: #667eea;
            font-weight: 600;
        }

        .center-accordion-inner h3:first-child {
            margin-top: 0;
        }

        .center-accordion-inner p {
            margin-bottom: 12px;
            line-height: 1.7;
            font-size: 0.95em;
        }

        /* Footer */
        footer {
            background: #000;
            color: #fff;
            padding: 30px 20px;
            text-align: center;
            font-size: 14px;
            line-height: 1.8;
            margin-top: 60px;
        }

        footer a {
            color: #fff;
            text-decoration: none;
            margin: 0 5px;
        }

        footer a:hover {
            text-decoration: underline;
        }

        /* 모바일 */
        @media (max-width: 768px) {
            .container {
                padding: 20px 16px;
            }

            .desktop-layout {
                display: block;
            }

            .info-box {
                display: none;
            }

            .center-accordion {
                display: none;
            }

            .mobile-accordion {
                display: block;
                width: 100%;
                margin-top: 12px;
            }

            .center-cta {
                padding: 20px 0;
            }

            h1 {
                font-size: 1.8em;
                margin-bottom: 12px;
            }

            .tagline {
                font-size: 1.05em;
                margin-bottom: 30px;
            }

            .cta-button {
                width: 100%;
                max-width: 320px;
                font-size: 1.1em;
                padding: 16px 36px;
                min-height: 52px;
                display: inline-flex;
                align-items: center;
                justify-content: center;
                text-align: center;
            }

            /* 모바일: 모든 아코디언 동일 스타일 */
            .accordion-item {
                width: 100%;
                margin-top: 12px;
                margin-bottom: 0;
            }

            .center-accordion-header,
            .accordion-header {
                padding: 20px 16px;
                min-height: 64px;
            }

            .center-accordion-header h2,
            .accordion-header-text h2 {
                font-size: 1.05em;
                font-weight: 600;
                margin-bottom: 4px;
            }

            .center-accordion-header .accordion-hint,
            .accordion-header .accordion-hint {
                font-size: 0.8em;
            }

            .center-accordion-header .icon,
            .accordion-header .icon {
                font-size: 1em;
            }

            .center-accordion-inner,
            .accordion-inner {
                padding: 0 16px 18px 16px;
            }

            .center-accordion-inner h3,
            .accordion-inner h3 {
                font-size: 1em;
                margin-top: 16px;
            }

            .center-accordion-inner p,
            .accordion-inner p {
                font-size: 1em;
                line-height: 1.6;
            }

            /* 모바일: center-cta 안의 최신 포스팅 숨김 (중복 방지) */
            .center-cta .landing-blog-section {
                display: none;
            }

            /* 모바일: 블로그 그리드 1열 */
            .mobile-accordion .landing-blog-section {
                margin-top: 0;
            }

            .landing-blog-title {
                font-size: 1.2em;
                margin-bottom: 16px;
            }

            .landing-blog-grid {
                grid-template-columns: 1fr;
                gap: 12px;
            }

            .landing-blog-card {
                padding: 20px 16px;
                min-height: 80px;
            }

            .landing-blog-card-title {
                font-size: 1em;
            }

            .landing-blog-card-meta {
                font-size: 0.85em;
                flex-direction: column;
                gap: 4px;
                align-items: flex-start;
            }

            .landing-blog-business,
            .landing-blog-date {
                width: 100%;
                word-break: keep-all;
            }

            footer {
                padding: 16px;
                margin-top: 20px;
                font-size: 12px;
                line-height: 1.5;
            }

            footer div {
                margin-bottom: 2px;
            }

            footer div:last-child {
                margin-bottom: 0;
            }
        }

        @media (max-width: 480px) {
            h1 {
                font-size: 1.6em;
            }

            .tagline {
                font-size: 1em;
            }

            .cta-button {
                font-size: 1.05em;
                padding: 15px 32px;
            }
        }

        /* 사이트 링크 칩 */
        .site-link-item {
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 12px 0;
            border-bottom: 1px solid #e9ecef;
        }

        .site-link-item:last-child {
            border-bottom: none;
        }

        .site-link-name {
            flex: 1;
            font-size: 1em;
            color: #333;
        }

        .site-link-button {
            display: inline-flex;
            align-items: center;
            gap: 6px;
            padding: 12px 20px;
            min-height: 44px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            text-decoration: none;
            border-radius: 22px;
            font-size: 0.9em;
            font-weight: 500;
            transition: all 0.2s;
        }

        .site-link-button:hover {
            transform: translateY(-2px);
            box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
        }

        .site-link-button:active {
            transform: translateY(0);
        }

        /* 랜딩 블로그 섹션 */
        .landing-blog-section {
            margin-top: 40px;
            max-width: 900px;
            margin-left: auto;
            margin-right: auto;
        }

        .landing-blog-title {
            font-size: 1.4em;
            margin-bottom: 20px;
            color: #667eea;
            font-weight: 600;
            text-align: center;
        }

        .landing-blog-grid {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 16px;
        }

        .landing-blog-card {
            display: block;
            background: #f8f9fa;
            border: 1px solid #e1e4e8;
            border-radius: 12px;
            padding: 20px;
            text-decoration: none;
            color: inherit;
            transition: all 0.2s;
        }

        .landing-blog-card:hover {
            transform: translateY(-3px);
            box-shadow: 0 4px 12px rgba(102, 126, 234, 0.15);
        }

        .landing-blog-card:active {
            transform: scale(0.98);
        }

        .landing-blog-card-title {
            font-size: 0.95em;
            color: #333;
            margin-bottom: 12px;
            font-weight: 500;
            line-height: 1.4;
            display: -webkit-box;
            -webkit-line-clamp: 2;
            -webkit-box-orient: vertical;
            overflow: hidden;
        }

        .landing-blog-card-meta {
            display: flex;
            justify-content: space-between;
            font-size: 0.8em;
            color: #666;
        }

        .landing-blog-business {
            font-weight: 500;
        }

        .landing-blog-date {
            color: #999;
        }

        @media (max-width: 768px) {
            .site-link-item {
                padding: 10px 0;
            }

            .site-link-name {
                font-size: 0.95em;
            }

            .site-link-button {
                padding: 6px 12px;
                font-size: 0.8em;
            }
        }
    </style>
    <script async src="https://analytics.make-page.com/script.js" data-website-id="7dd5100f-1aa0-4c4c-9e73-5c085284dcd8"></script>
</head>
<body>
    <div class="container">
        <div class="desktop-layout">
            <!-- 좌측: 왜 콘텐츠팩토리인가 -->
            <div class="info-box desktop-accordion-box">
                <div class="desktop-accordion-header" onclick="toggleDesktopAccordion(this)">
                    <div>
                        <h2>왜 콘텐츠팩토리인가?</h2>
                        <p class="accordion-hint">터치하여 자세히 보기</p>
                    </div>
                    <span class="icon">▼</span>
                </div>
                <div class="desktop-accordion-content">
                    <div class="desktop-accordion-inner">
                        <h3>세 개의 채널, 하나의 구독</h3>

                        <h4>구글 해외 - 블루오션</h4>
                        <p>매년 1,600만 명의 외국인이 한국을 방문합니다. 2026년에는 2,000만 명 돌파가 전망됩니다.</p>
                        <p>이들은 여행 전 어디서 정보를 검색할까요? 구글입니다. 미국, 일본, 유럽, 동남아시아 모두 구글을 씁니다.</p>
                        <p>"ソウル ピアノ教室"(서울 피아노 학원)을 일본어로 검색해보세요. "ร้านเสริมสวยโซล"(서울 미용실)을 태국어로 검색해보세요. 경쟁자가 거의 없습니다. 아직 아무도 안 하고 있으니까요.</p>

                        <h4>구글 국내 - 숨은 25%</h4>
                        <p>네이버가 압도적이지만, 구글도 25~30%를 차지합니다. 특히 젊은층, IT업계, 해외 경험이 많은 사람들은 구글을 선호합니다.</p>
                        <p>네이버에서 경쟁하는 수천 개 블로그가 구글에는 없습니다. 같은 콘텐츠가 구글에서는 더 쉽게 상위 노출됩니다.</p>

                        <h4>네이버 - 꾸준함의 힘</h4>
                        <p>솔직히 말씀드리면, 네이버 1페이지는 쉽지 않습니다. 네이버 블로그, 카페, 포스트가 상위를 차지하는 구조니까요.</p>
                        <p>하지만 꾸준히 쌓이면 2~3페이지 노출은 가능합니다. 1년이면 365개 포스팅. 없는 것과 있는 것은 다릅니다.</p>

                        <h3>검색 한 번, 고객 확보</h3>
                        <p>외국인 관광객은 한국 도착 전에 검색합니다. 비행기 안에서, 호텔에서, 출발 전 집에서.</p>
                        <p>한국 와서 발품 파는 시대는 지났습니다. 검색 한 번으로 방문할 가게가 정해집니다.</p>
                        <p>그 순간 당신의 가게가 검색된다면, 이미 방문 예정 고객이 확보된 것입니다.</p>

                        <h3>전 세계 모든 언어 자동 생성</h3>
                        <p>"외국어 콘텐츠? 번역은 AI로 하면 되지..."</p>
                        <p>맞습니다. 번역은 누구나 할 수 있습니다.</p>
                        <p><strong>하지만 매일 글 쓰고, 사이트 관리하고, SEO 신경 쓸 시간 있으신가요?</strong></p>
                        <p>콘텐츠팩토리는 영어, 일본어, 중국어, 태국어, 베트남어, 아랍어, 러시아어 등 전 세계 모든 언어로 콘텐츠를 자동 생성합니다.</p>
                        <p>일본인이 "서울 피아노 학원"을 검색하면, 당신의 가게가 나타납니다.</p>
                        <p>태국인이 "홍대 네일샵"을 검색하면, 당신의 가게가 나타납니다.</p>

                        <h3>매일 1회, 자동 포스팅</h3>
                        <p>사진만 올려두면:</p>
                        <ul>
                            <li>AI가 글을 씁니다</li>
                            <li>웹사이트에 자동 배포합니다</li>
                            <li>매일 새 콘텐츠가 올라갑니다</li>
                            <li>구글 SEO에 최적화됩니다</li>
                        </ul>
                        <p>한 달이면 30개. 1년이면 365개.</p>
                        <p><strong>꾸준함이 SEO의 핵심입니다.</strong> 사장님은 사진만 올리세요. 나머지는 콘텐츠팩토리가 합니다.</p>

                        <h3>네이버 대행, 부담되셨나요?</h3>
                        <p>네이버 블로그 대행, 월 30~50만원입니다. 글 10~20개 정도요.</p>
                        <p>직접 쓰자니 시간이 없고, 맡기자니 비용이 부담되고.</p>
                        <p>콘텐츠팩토리는 월 10만원에 매일 포스팅합니다. 한 달 30개, 1년 365개.</p>
                        <p>네이버 2~3페이지 노출 + 구글 상위 노출. 둘 다 가져가세요.</p>

                        <h3>내 가게 전용 도메인</h3>
                        <p>네이버 블로그는 네이버 것입니다. 계정 정지되면 사라지고, 알고리즘 바뀌면 노출이 줄어듭니다.</p>
                        <p>콘텐츠팩토리는 다릅니다. 가게마다 전용 도메인이 생기고, 포스팅이 쌓일수록 검색에 강해집니다. 1년 뒤 365개의 글이 24시간 일하는 영업사원이 됩니다.</p>

                        <h3>마법이 아닙니다</h3>
                        <p>구독한다고 무조건 성공하지 않습니다. 콘텐츠팩토리는 성공 확률을 높이는 도구입니다.</p>
                        <p>구글에 매일 전단지를 뿌리는 것과 같습니다. 전단지 한 장은 약하지만, 365장이 쌓이면 다릅니다.</p>
                        <p>빠른 성공을 원한다면 네이버 파워블로거나 인스타그램 인플루언서가 더 효과적입니다. 비용은 높지만 빠릅니다.</p>
                        <p>콘텐츠팩토리는 느리지만 꾸준합니다. 그리고 쌓입니다.</p>

                        <h3>시작하기</h3>
                        <p><strong>월 100,000원</strong> (VAT 포함)</p>
                        <ul>
                            <li>10일 무료 체험</li>
                            <li>결제 후에도 전액 환불 가능</li>
                            <li>계약 기간 없음</li>
                        </ul>
                    </div>
                </div>
            </div>

            <!-- 가운데: 핵심 CTA -->
            <div class="center-cta">
                <h1>콘텐츠팩토리</h1>
                <p class="tagline">📸 사진 등록 · 🌐 도메인 생성 · ✍️ 자동 포스팅</p>
                <div style="display: flex; flex-direction: column; gap: 12px; align-items: center;">
                    <a href="https://make-page.com/dashboard" class="cta-button">
                        로그인 / 회원가입
                    </a>
                    <a href="https://make-page.com/dashboard?sandbox=true" class="cta-button">
                        미리보기
                    </a>
                </div>

                <!-- 운영 중인 홈페이지 아코디언 -->
                <div class="center-accordion">
                    <div class="center-accordion-header" onclick="toggleCenterAccordion(this)">
                        <div>
                            <h2>운영 중인 홈페이지</h2>
                            <p class="accordion-hint">터치하여 자세히 보기</p>
                        </div>
                        <span class="icon">▼</span>
                    </div>
                    <div class="center-accordion-content">
                        <div class="center-accordion-inner">
                            ${sampleClients.map(client => {
                                const langFlag = {
                                    '한국어': '🇰🇷', 'Korean': '🇰🇷',
                                    '일본어': '🇯🇵', 'Japanese': '🇯🇵', '日本語': '🇯🇵',
                                    '영어': '🇬🇧', 'English': '🇬🇧',
                                    '중국어': '🇨🇳', 'Chinese': '🇨🇳', '中文': '🇨🇳',
                                    '태국어': '🇹🇭', 'Thai': '🇹🇭', 'ไทย': '🇹🇭',
                                    '베트남어': '🇻🇳', 'Vietnamese': '🇻🇳',
                                    '인도네시아어': '🇮🇩', 'Indonesian': '🇮🇩',
                                    '말레이어': '🇲🇾', 'Malay': '🇲🇾',
                                    '독일어': '🇩🇪', 'German': '🇩🇪',
                                    '프랑스어': '🇫🇷', 'French': '🇫🇷',
                                    '스페인어': '🇪🇸', 'Spanish': '🇪🇸'
                                }[client.language] || '🌐';
                                return `
                            <div class="site-link-item">
                                <span class="site-link-name">${langFlag} ${client.business_name}</span>
                                <a href="https://${client.subdomain}.make-page.com" class="site-link-button" target="_blank">홈페이지</a>
                            </div>`;
                            }).join('')}
                        </div>
                    </div>
                </div>

                <!-- 최신 포스팅 -->
                ${blogPosts.length > 0 ? `
                <div class="landing-blog-section">
                    <h2 class="landing-blog-title">최신 포스팅</h2>
                    <div class="landing-blog-grid">
                        ${blogPosts.map(post => `
                        <a href="https://${post.subdomain}.make-page.com/blog/${post.id}" target="_blank" class="landing-blog-card">
                            <div class="landing-blog-card-title">${post.title}</div>
                            <div class="landing-blog-card-meta">
                                <span class="landing-blog-business">${post.business_name}</span>
                                <span class="landing-blog-date">${formatDate(post.created_at)}</span>
                            </div>
                        </a>
                        `).join('')}
                    </div>
                </div>
                ` : ''}
            </div>

            <!-- 우측: 파트너 정책 -->
            <div class="info-box desktop-accordion-box">
                <div class="desktop-accordion-header" onclick="toggleDesktopAccordion(this)">
                    <div>
                        <h2>파트너 정책</h2>
                        <p class="accordion-hint">터치하여 자세히 보기</p>
                    </div>
                    <span class="icon">▼</span>
                </div>
                <div class="desktop-accordion-content">
                    <div class="desktop-accordion-inner">
                        <h3>파트너는 독립 사업자입니다</h3>
                        <p>콘텐츠팩토리 파트너는 소속 영업 사원이 아닙니다. 파트너는 <strong>자신만의 브랜드로 독립적인 사업을 운영</strong>합니다. 콘텐츠팩토리 이름을 내세울 필요 없습니다. 파트너의 브랜드로 마케팅하고, 파트너의 방식으로 영업하세요. 영업 방식과 고객 관리는 전적으로 파트너의 몫입니다. 간섭 없이, 파트너만의 방식으로 사업을 운영할 수 있습니다.</p>

                        <h3>파트너가 개척한 거래처는 파트너의 것입니다</h3>
                        <p>콘텐츠팩토리는 파트너의 영업 활동에 관여하지 않습니다. 파트너가 직접 발굴하고 계약한 거래처는 파트너가 관리합니다. 가격 협상, 계약 조건, 고객 응대 방식 모두 파트너의 재량입니다. 콘텐츠팩토리는 시스템을 제공할 뿐, 파트너와 고객 사이에 개입하지 않습니다.</p>

                        <h3>가격과 수익</h3>
                        <p>콘텐츠팩토리에서 파트너에게 제공하는 단가는 <strong>거래처 1곳당 월 100,000원(VAT 포함)</strong>입니다. 고객에게 얼마에 판매할지는 전적으로 파트너의 결정입니다. 차액은 모두 파트너의 수익이 됩니다.</p>

                        <table style="width: 100%; border-collapse: collapse; margin: 15px 0; font-size: 14px;">
                            <thead>
                                <tr style="background: #f8f9fa; border-bottom: 2px solid #dee2e6;">
                                    <th style="padding: 12px; text-align: left; border: 1px solid #dee2e6;">거래처 수</th>
                                    <th style="padding: 12px; text-align: right; border: 1px solid #dee2e6;">판매가</th>
                                    <th style="padding: 12px; text-align: right; border: 1px solid #dee2e6;">원가</th>
                                    <th style="padding: 12px; text-align: right; border: 1px solid #dee2e6; font-weight: bold;">수익</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr style="border-bottom: 1px solid #dee2e6;">
                                    <td style="padding: 12px; border: 1px solid #dee2e6;">50개</td>
                                    <td style="padding: 12px; text-align: right; border: 1px solid #dee2e6;">1,250만원</td>
                                    <td style="padding: 12px; text-align: right; border: 1px solid #dee2e6;">600만원</td>
                                    <td style="padding: 12px; text-align: right; border: 1px solid #dee2e6; font-weight: bold; color: #28a745;">월 650만원</td>
                                </tr>
                                <tr style="border-bottom: 1px solid #dee2e6;">
                                    <td style="padding: 12px; border: 1px solid #dee2e6;">100개</td>
                                    <td style="padding: 12px; text-align: right; border: 1px solid #dee2e6;">2,500만원</td>
                                    <td style="padding: 12px; text-align: right; border: 1px solid #dee2e6;">1,200만원</td>
                                    <td style="padding: 12px; text-align: right; border: 1px solid #dee2e6; font-weight: bold; color: #28a745;">월 1,300만원</td>
                                </tr>
                            </tbody>
                        </table>
                        <p style="font-size: 13px; color: #6c757d; margin-top: 10px;">※ 판매가 25만원 기준 예시입니다. 파트너는 자유롭게 가격을 설정할 수 있습니다.</p>

                        <h3>1거래처 = 1언어</h3>
                        <p>거래처 1곳당 1개 언어가 적용됩니다. 영어 사이트와 일본어 사이트를 동시에 운영하고 싶다면 거래처 2곳으로 등록하면 됩니다. 고객이 원하는 만큼 언어를 추가할 수 있고, 그만큼 파트너 수익도 늘어납니다.</p>

                        <h3>템플릿 기반 시스템입니다</h3>
                        <p>거래처별 개별 디자인 커스텀이나 특별 요청은 지원하지 않습니다. <strong>검증된 템플릿으로 빠르고 일관된 품질</strong>을 제공합니다. 모든 거래처가 동일한 시스템 안에서 운영되기 때문에 낮은 단가가 가능합니다.</p>

                        <h3>신뢰를 기반으로 합니다</h3>
                        <p>콘텐츠팩토리와 파트너는 상호 신뢰를 바탕으로 협력합니다.</p>
                        <p>정산이 반복적으로 지연되거나 미납이 발생할 경우, 파트너 자격이 해지될 수 있습니다. 한 번 해지된 파트너는 재가입이 제한됩니다.</p>
                        <p>건강한 파트너십을 위해 정산 일정을 지켜주시기 바랍니다.</p>
                    </div>
                </div>
            </div>
        </div>

        <!-- 모바일 아코디언 -->
        <div class="mobile-accordion">
            <!-- 왜 콘텐츠팩토리인가 -->
            <div class="accordion-item">
                <div class="accordion-header" onclick="toggleAccordion(this)">
                    <div class="accordion-header-text">
                        <h2>왜 콘텐츠팩토리인가?</h2>
                        <p class="accordion-hint">터치하여 자세히 보기</p>
                    </div>
                    <span class="icon">▼</span>
                </div>
                <div class="accordion-content">
                    <div class="accordion-inner">
                        <h3>세 개의 채널, 하나의 구독</h3>

                        <h4>구글 해외 - 블루오션</h4>
                        <p>매년 1,600만 명의 외국인이 한국을 방문합니다. 2026년에는 2,000만 명 돌파가 전망됩니다.</p>
                        <p>이들은 여행 전 어디서 정보를 검색할까요? 구글입니다. 미국, 일본, 유럽, 동남아시아 모두 구글을 씁니다.</p>
                        <p>"ソウル ピアノ教室"(서울 피아노 학원)을 일본어로 검색해보세요. "ร้านเสริมสวยโซล"(서울 미용실)을 태국어로 검색해보세요. 경쟁자가 거의 없습니다. 아직 아무도 안 하고 있으니까요.</p>

                        <h4>구글 국내 - 숨은 25%</h4>
                        <p>네이버가 압도적이지만, 구글도 25~30%를 차지합니다. 특히 젊은층, IT업계, 해외 경험이 많은 사람들은 구글을 선호합니다.</p>
                        <p>네이버에서 경쟁하는 수천 개 블로그가 구글에는 없습니다. 같은 콘텐츠가 구글에서는 더 쉽게 상위 노출됩니다.</p>

                        <h4>네이버 - 꾸준함의 힘</h4>
                        <p>솔직히 말씀드리면, 네이버 1페이지는 쉽지 않습니다. 네이버 블로그, 카페, 포스트가 상위를 차지하는 구조니까요.</p>
                        <p>하지만 꾸준히 쌓이면 2~3페이지 노출은 가능합니다. 1년이면 365개 포스팅. 없는 것과 있는 것은 다릅니다.</p>

                        <h3>검색 한 번, 고객 확보</h3>
                        <p>외국인 관광객은 한국 도착 전에 검색합니다. 비행기 안에서, 호텔에서, 출발 전 집에서.</p>
                        <p>한국 와서 발품 파는 시대는 지났습니다. 검색 한 번으로 방문할 가게가 정해집니다.</p>
                        <p>그 순간 당신의 가게가 검색된다면, 이미 방문 예정 고객이 확보된 것입니다.</p>

                        <h3>전 세계 모든 언어 자동 생성</h3>
                        <p>"외국어 콘텐츠? 번역은 AI로 하면 되지..."</p>
                        <p>맞습니다. 번역은 누구나 할 수 있습니다.</p>
                        <p><strong>하지만 매일 글 쓰고, 사이트 관리하고, SEO 신경 쓸 시간 있으신가요?</strong></p>
                        <p>콘텐츠팩토리는 영어, 일본어, 중국어, 태국어, 베트남어, 아랍어, 러시아어 등 전 세계 모든 언어로 콘텐츠를 자동 생성합니다.</p>
                        <p>일본인이 "서울 피아노 학원"을 검색하면, 당신의 가게가 나타납니다.</p>
                        <p>태국인이 "홍대 네일샵"을 검색하면, 당신의 가게가 나타납니다.</p>

                        <h3>매일 1회, 자동 포스팅</h3>
                        <p>사진만 올려두면:</p>
                        <ul>
                            <li>AI가 글을 씁니다</li>
                            <li>웹사이트에 자동 배포합니다</li>
                            <li>매일 새 콘텐츠가 올라갑니다</li>
                            <li>구글 SEO에 최적화됩니다</li>
                        </ul>
                        <p>한 달이면 30개. 1년이면 365개.</p>
                        <p><strong>꾸준함이 SEO의 핵심입니다.</strong> 사장님은 사진만 올리세요. 나머지는 콘텐츠팩토리가 합니다.</p>

                        <h3>네이버 대행, 부담되셨나요?</h3>
                        <p>네이버 블로그 대행, 월 30~50만원입니다. 글 10~20개 정도요.</p>
                        <p>직접 쓰자니 시간이 없고, 맡기자니 비용이 부담되고.</p>
                        <p>콘텐츠팩토리는 월 10만원에 매일 포스팅합니다. 한 달 30개, 1년 365개.</p>
                        <p>네이버 2~3페이지 노출 + 구글 상위 노출. 둘 다 가져가세요.</p>

                        <h3>내 가게 전용 도메인</h3>
                        <p>네이버 블로그는 네이버 것입니다. 계정 정지되면 사라지고, 알고리즘 바뀌면 노출이 줄어듭니다.</p>
                        <p>콘텐츠팩토리는 다릅니다. 가게마다 전용 도메인이 생기고, 포스팅이 쌓일수록 검색에 강해집니다. 1년 뒤 365개의 글이 24시간 일하는 영업사원이 됩니다.</p>

                        <h3>마법이 아닙니다</h3>
                        <p>구독한다고 무조건 성공하지 않습니다. 콘텐츠팩토리는 성공 확률을 높이는 도구입니다.</p>
                        <p>구글에 매일 전단지를 뿌리는 것과 같습니다. 전단지 한 장은 약하지만, 365장이 쌓이면 다릅니다.</p>
                        <p>빠른 성공을 원한다면 네이버 파워블로거나 인스타그램 인플루언서가 더 효과적입니다. 비용은 높지만 빠릅니다.</p>
                        <p>콘텐츠팩토리는 느리지만 꾸준합니다. 그리고 쌓입니다.</p>

                        <h3>시작하기</h3>
                        <p><strong>월 100,000원</strong> (VAT 포함)</p>
                        <ul>
                            <li>10일 무료 체험</li>
                            <li>결제 후에도 전액 환불 가능</li>
                            <li>계약 기간 없음</li>
                        </ul>
                    </div>
                </div>
            </div>

            <!-- 운영 중인 홈페이지 -->
            <div class="accordion-item">
                <div class="accordion-header" onclick="toggleAccordion(this)">
                    <div class="accordion-header-text">
                        <h2>운영 중인 홈페이지</h2>
                        <p class="accordion-hint">터치하여 자세히 보기</p>
                    </div>
                    <span class="icon">▼</span>
                </div>
                <div class="accordion-content">
                    <div class="accordion-inner">
                        ${sampleClients.map(client => {
                            const langFlag = {
                                '한국어': '🇰🇷', 'Korean': '🇰🇷',
                                '일본어': '🇯🇵', 'Japanese': '🇯🇵', '日本語': '🇯🇵',
                                '영어': '🇬🇧', 'English': '🇬🇧',
                                '중국어': '🇨🇳', 'Chinese': '🇨🇳', '中文': '🇨🇳',
                                '태국어': '🇹🇭', 'Thai': '🇹🇭', 'ไทย': '🇹🇭',
                                '베트남어': '🇻🇳', 'Vietnamese': '🇻🇳',
                                '인도네시아어': '🇮🇩', 'Indonesian': '🇮🇩',
                                '말레이어': '🇲🇾', 'Malay': '🇲🇾',
                                '독일어': '🇩🇪', 'German': '🇩🇪',
                                '프랑스어': '🇫🇷', 'French': '🇫🇷',
                                '스페인어': '🇪🇸', 'Spanish': '🇪🇸'
                            }[client.language] || '🌐';
                            return `
                        <div class="site-link-item">
                            <span class="site-link-name">${langFlag} ${client.business_name}</span>
                            <a href="https://${client.subdomain}.make-page.com" class="site-link-button" target="_blank">홈페이지</a>
                        </div>`;
                        }).join('')}
                    </div>
                </div>
            </div>

            <!-- 파트너 정책 -->
            <div class="accordion-item">
                <div class="accordion-header" onclick="toggleAccordion(this)">
                    <div class="accordion-header-text">
                        <h2>파트너 정책</h2>
                        <p class="accordion-hint">터치하여 자세히 보기</p>
                    </div>
                    <span class="icon">▼</span>
                </div>
                <div class="accordion-content">
                    <div class="accordion-inner">
                        <h3>파트너는 독립 사업자입니다</h3>
                        <p>콘텐츠팩토리 파트너는 소속 영업 사원이 아닙니다. 파트너는 <strong>자신만의 브랜드로 독립적인 사업을 운영</strong>합니다. 콘텐츠팩토리 이름을 내세울 필요 없습니다. 파트너의 브랜드로 마케팅하고, 파트너의 방식으로 영업하세요. 영업 방식과 고객 관리는 전적으로 파트너의 몫입니다. 간섭 없이, 파트너만의 방식으로 사업을 운영할 수 있습니다.</p>

                        <h3>파트너가 개척한 거래처는 파트너의 것입니다</h3>
                        <p>콘텐츠팩토리는 파트너의 영업 활동에 관여하지 않습니다. 파트너가 직접 발굴하고 계약한 거래처는 파트너가 관리합니다. 가격 협상, 계약 조건, 고객 응대 방식 모두 파트너의 재량입니다. 콘텐츠팩토리는 시스템을 제공할 뿐, 파트너와 고객 사이에 개입하지 않습니다.</p>

                        <h3>가격과 수익</h3>
                        <p>콘텐츠팩토리에서 파트너에게 제공하는 단가는 <strong>거래처 1곳당 월 100,000원(VAT 포함)</strong>입니다. 고객에게 얼마에 판매할지는 전적으로 파트너의 결정입니다. 차액은 모두 파트너의 수익이 됩니다.</p>

                        <table style="width: 100%; border-collapse: collapse; margin: 15px 0; font-size: 13px;">
                            <thead>
                                <tr style="background: #f8f9fa; border-bottom: 2px solid #dee2e6;">
                                    <th style="padding: 10px 8px; text-align: left; border: 1px solid #dee2e6;">거래처 수</th>
                                    <th style="padding: 10px 8px; text-align: right; border: 1px solid #dee2e6;">판매가</th>
                                    <th style="padding: 10px 8px; text-align: right; border: 1px solid #dee2e6;">원가</th>
                                    <th style="padding: 10px 8px; text-align: right; border: 1px solid #dee2e6; font-weight: bold;">수익</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr style="border-bottom: 1px solid #dee2e6;">
                                    <td style="padding: 10px 8px; border: 1px solid #dee2e6;">50개</td>
                                    <td style="padding: 10px 8px; text-align: right; border: 1px solid #dee2e6;">1,250만원</td>
                                    <td style="padding: 10px 8px; text-align: right; border: 1px solid #dee2e6;">600만원</td>
                                    <td style="padding: 10px 8px; text-align: right; border: 1px solid #dee2e6; font-weight: bold; color: #28a745;">월 650만원</td>
                                </tr>
                                <tr style="border-bottom: 1px solid #dee2e6;">
                                    <td style="padding: 10px 8px; border: 1px solid #dee2e6;">100개</td>
                                    <td style="padding: 10px 8px; text-align: right; border: 1px solid #dee2e6;">2,500만원</td>
                                    <td style="padding: 10px 8px; text-align: right; border: 1px solid #dee2e6;">1,200만원</td>
                                    <td style="padding: 10px 8px; text-align: right; border: 1px solid #dee2e6; font-weight: bold; color: #28a745;">월 1,300만원</td>
                                </tr>
                            </tbody>
                        </table>
                        <p style="font-size: 12px; color: #6c757d; margin-top: 10px;">※ 판매가 25만원 기준 예시입니다. 파트너는 자유롭게 가격을 설정할 수 있습니다.</p>

                        <h3>1거래처 = 1언어</h3>
                        <p>거래처 1곳당 1개 언어가 적용됩니다. 영어 사이트와 일본어 사이트를 동시에 운영하고 싶다면 거래처 2곳으로 등록하면 됩니다. 고객이 원하는 만큼 언어를 추가할 수 있고, 그만큼 파트너 수익도 늘어납니다.</p>

                        <h3>템플릿 기반 시스템입니다</h3>
                        <p>거래처별 개별 디자인 커스텀이나 특별 요청은 지원하지 않습니다. <strong>검증된 템플릿으로 빠르고 일관된 품질</strong>을 제공합니다. 모든 거래처가 동일한 시스템 안에서 운영되기 때문에 낮은 단가가 가능합니다.</p>

                        <h3>신뢰를 기반으로 합니다</h3>
                        <p>콘텐츠팩토리와 파트너는 상호 신뢰를 바탕으로 협력합니다.</p>
                        <p>정산이 반복적으로 지연되거나 미납이 발생할 경우, 파트너 자격이 해지될 수 있습니다. 한 번 해지된 파트너는 재가입이 제한됩니다.</p>
                        <p>건강한 파트너십을 위해 정산 일정을 지켜주시기 바랍니다.</p>
                    </div>
                </div>
            </div>

            <!-- 최신 포스팅 -->
            ${blogPosts.length > 0 ? `
            <div class="landing-blog-section" style="margin-top: 30px;">
                <h2 class="landing-blog-title">최신 포스팅</h2>
                <div class="landing-blog-grid">
                    ${blogPosts.map(post => `
                    <a href="https://${post.subdomain}.make-page.com/blog/${post.id}" target="_blank" class="landing-blog-card">
                        <div class="landing-blog-card-title">${post.title}</div>
                        <div class="landing-blog-card-meta">
                            <span class="landing-blog-business">${post.business_name}</span>
                            <span class="landing-blog-date">${formatDate(post.created_at)}</span>
                        </div>
                    </a>
                    `).join('')}
                </div>
            </div>
            ` : ''}
        </div>
    </div>

    <footer>
        <div>콘텐츠팩토리 대표: 전우현</div>
        <div>사업자등록번호: 118-37-01460</div>
        <div>통신판매업신고: 제 2025-수원권선-1788호</div>
        <div>contact@ContentFactory.onmicrosoft.com</div>
        <div style="margin-top: 10px;">
            <a href="/terms">이용약관</a> · <a href="/privacy">개인정보처리방침</a>
        </div>
    </footer>

    <script>
        function toggleDesktopAccordion(header) {
            const content = header.nextElementSibling;
            const icon = header.querySelector('.icon');
            content.classList.toggle('active');
            icon.style.transform = content.classList.contains('active') ? 'rotate(180deg)' : 'rotate(0deg)';
        }

        function toggleCenterAccordion(header) {
            const content = header.nextElementSibling;
            const icon = header.querySelector('.icon');
            content.classList.toggle('active');
            icon.style.transform = content.classList.contains('active') ? 'rotate(180deg)' : 'rotate(0deg)';
        }

        function toggleAccordion(header) {
            const content = header.nextElementSibling;
            const icon = header.querySelector('.icon');
            content.classList.toggle('active');
            icon.style.transform = content.classList.contains('active') ? 'rotate(180deg)' : 'rotate(0deg)';
        }
    </script>
</body>
</html>
`;
}

function generateTermsPage() {
  return `<!DOCTYPE html>
<html lang="ko">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>이용약관 - 콘텐츠팩토리</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            padding: 40px 20px;
            max-width: 800px;
            margin: 0 auto;
            background: #fff;
            color: #333;
            line-height: 1.8;
        }
        h1 {
            font-size: 2em;
            margin-bottom: 40px;
            text-align: center;
            color: #000;
        }
        .content {
            margin-bottom: 60px;
        }
        h2 {
            font-size: 1.2em;
            margin-top: 30px;
            margin-bottom: 12px;
            color: #000;
            font-weight: 600;
        }
        p, ul, ol {
            margin-bottom: 16px;
            color: #333;
        }
        ul, ol {
            margin-left: 24px;
        }
        li {
            margin-bottom: 8px;
        }
        .section {
            margin-bottom: 24px;
        }
        .back-btn {
            display: inline-block;
            margin-top: 30px;
            padding: 12px 24px;
            background: #667eea;
            color: #fff;
            text-decoration: none;
            border-radius: 6px;
            font-weight: 600;
            transition: background 0.2s;
        }
        .back-btn:hover {
            background: #764ba2;
        }
        .footer {
            margin-top: 40px;
            padding-top: 20px;
            border-top: 1px solid #eee;
            color: #666;
            font-size: 0.9em;
        }
    </style>
</head>
<body>
    <h1>콘텐츠팩토리 이용약관</h1>
    <div class="content">
        <div class="section">
            <h2>제1조 (목적)</h2>
            <p>본 약관은 콘텐츠팩토리(이하 "회사")가 제공하는 다국어 블로그 자동 생성 서비스(이하 "서비스")의 이용 조건 및 절차에 관한 사항을 규정함을 목적으로 합니다.</p>
        </div>

        <div class="section">
            <h2>제2조 (서비스 내용)</h2>
            <ol>
                <li>회사는 파트너가 등록한 거래처의 사진을 기반으로 다국어 블로그 콘텐츠를 자동 생성합니다.</li>
                <li>생성된 콘텐츠는 거래처 전용 도메인(서브도메인)에 자동 배포됩니다.</li>
                <li>서비스는 템플릿 기반으로 운영되며, 거래처별 개별 디자인 커스텀은 지원하지 않습니다.</li>
            </ol>
        </div>

        <div class="section">
            <h2>제3조 (이용 자격)</h2>
            <p>서비스는 사업자 및 개인 모두 이용 가능합니다. 웹 대시보드를 통해 파트너로 가입할 수 있습니다.</p>
        </div>

        <div class="section">
            <h2>제4조 (이용 요금)</h2>
            <ol>
                <li>거래처 1곳당 월 100,000원(VAT 포함)입니다.</li>
                <li>가입일로부터 10일간 무료로 서비스를 이용할 수 있습니다.</li>
                <li>무료 체험 종료 후, 매월 1일~10일 사이에 결제합니다.</li>
                <li>구독 해지된 거래처는 종료일 이후 요금에 반영되지 않습니다.</li>
            </ol>
        </div>

        <div class="section">
            <h2>제5조 (구독 해지 및 재구독)</h2>
            <ol>
                <li>파트너는 언제든지 구독을 해지할 수 있습니다.</li>
                <li>구독 해지 시, 다음 결제일까지 서비스가 유지됩니다.</li>
                <li>구독 해지 후에도 재구독을 통해 즉시 서비스를 재개할 수 있습니다.</li>
                <li>거래처 데이터는 구독 해지 후에도 보관되며, 재구독 시 즉시 복구됩니다.</li>
            </ol>
        </div>

        <div class="section">
            <h2>제6조 (환불 정책)</h2>
            <ol>
                <li>결제 후 서비스가 맞지 않는 경우, 환불 신청 시 전액 환불합니다.</li>
                <li>환불 신청은 회사 이메일(contact@ContentFactory.onmicrosoft.com)로 접수합니다.</li>
            </ol>
        </div>

        <div class="section">
            <h2>제7조 (미결제 시 처리)</h2>
            <ol>
                <li>미결제 시 등록된 연락처로 안내합니다.</li>
                <li>정산 문제가 해결되지 않을 경우 서비스 이용이 영구 중단되며, 재가입이 불가합니다.</li>
            </ol>
        </div>

        <div class="section">
            <h2>제8조 (1거래처 1언어)</h2>
            <p>거래처 1곳당 1개 언어가 적용됩니다. 다국어 운영 시 언어별로 거래처를 추가 등록해야 합니다.</p>
        </div>

        <div class="section">
            <h2>제9조 (콘텐츠 소유권)</h2>
            <p>서비스를 통해 생성된 콘텐츠의 소유권은 해당 거래처를 등록한 파트너에게 있습니다.</p>
        </div>

        <div class="section">
            <h2>제10조 (면책 조항)</h2>
            <ol>
                <li>AI가 생성한 콘텐츠의 정확성을 100% 보장하지 않습니다.</li>
                <li>검색 엔진 상위 노출을 보장하지 않습니다.</li>
                <li>서비스 이용으로 인한 간접적 손해에 대해 책임지지 않습니다.</li>
            </ol>
        </div>

        <div class="section">
            <h2>제11조 (서비스 변경 및 종료)</h2>
            <p>회사는 서비스 내용을 변경하거나 종료할 수 있으며, 이 경우 사전에 공지합니다.</p>
        </div>

        <div class="section">
            <h2>제12조 (분쟁 해결)</h2>
            <p>본 약관과 관련된 분쟁은 수원지방법원을 관할 법원으로 합니다.</p>
        </div>

        <div class="footer">
            <p><strong>부칙</strong></p>
            <p>본 약관은 2025년 1월 1일부터 시행합니다.</p>
        </div>
    </div>
    <a href="/" class="back-btn">← 홈으로</a>
</body>
</html>`;
}

function generatePrivacyPage() {
  return `<!DOCTYPE html>
<html lang="ko">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>개인정보처리방침 - 콘텐츠팩토리</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            padding: 40px 20px;
            max-width: 800px;
            margin: 0 auto;
            background: #fff;
            color: #333;
            line-height: 1.8;
        }
        h1 {
            font-size: 2em;
            margin-bottom: 40px;
            text-align: center;
            color: #000;
        }
        .content {
            margin-bottom: 60px;
        }
        h2 {
            font-size: 1.3em;
            margin-top: 30px;
            margin-bottom: 16px;
            color: #000;
            font-weight: 600;
        }
        h3 {
            font-size: 1.1em;
            margin-top: 20px;
            margin-bottom: 12px;
            color: #333;
            font-weight: 600;
        }
        p, ul {
            margin-bottom: 16px;
            color: #333;
        }
        ul {
            margin-left: 24px;
        }
        li {
            margin-bottom: 8px;
        }
        .section {
            margin-bottom: 32px;
        }
        .back-btn {
            display: inline-block;
            margin-top: 30px;
            padding: 12px 24px;
            background: #667eea;
            color: #fff;
            text-decoration: none;
            border-radius: 6px;
            font-weight: 600;
            transition: background 0.2s;
        }
        .back-btn:hover {
            background: #764ba2;
        }
        .footer {
            margin-top: 40px;
            padding-top: 20px;
            border-top: 1px solid #eee;
            color: #666;
            font-size: 0.9em;
        }
        strong {
            color: #000;
        }
    </style>
</head>
<body>
    <h1>콘텐츠팩토리 개인정보처리방침</h1>
    <div class="content">
        <div class="section">
            <h2>1. 수집하는 정보</h2>
            <p>콘텐츠팩토리는 최소한의 정보만 수집합니다.</p>

            <h3>[필수 수집]</h3>
            <ul>
                <li><strong>로그인 아이디:</strong> 파트너 식별을 위한 계정 ID입니다.</li>
                <li><strong>비밀번호:</strong> 암호화(해시)하여 저장되며, 원본은 저장되지 않습니다.</li>
            </ul>

            <h3>[선택 수집 - 파트너가 직접 입력]</h3>
            <ul>
                <li>파트너 상호명</li>
                <li>거래처 정보: 상호명, 주소, 전화번호, 영업시간 등</li>
            </ul>

            <p>선택 수집 항목은 파트너가 서비스 이용을 위해 자발적으로 입력하는 정보이며, 파트너 본인의 개인정보가 아닌 사업장 정보입니다.</p>
        </div>

        <div class="section">
            <h2>2. 수집하지 않는 정보</h2>
            <p>콘텐츠팩토리는 다음 정보를 수집하지 않습니다.</p>
            <ul>
                <li>이메일 주소 (선택 사항)</li>
                <li>휴대폰 번호</li>
                <li>주민등록번호</li>
                <li>신용카드 정보 (회사는 결제 정보를 저장하지 않습니다)</li>
            </ul>
        </div>

        <div class="section">
            <h2>3. 정보 이용 목적</h2>
            <ul>
                <li>서비스 제공 및 파트너 식별</li>
                <li>거래처 웹사이트 자동 생성 및 콘텐츠 관리</li>
                <li>파트너 계정 관리 및 서비스 제공</li>
                <li>고객 지원 및 문의 처리</li>
            </ul>
        </div>

        <div class="section">
            <h2>4. 정보 보관 및 삭제</h2>
            <ul>
                <li>파트너 탈퇴 요청 시 계정 정보를 삭제합니다.</li>
                <li>거래처 데이터는 미구독 전환 시에도 보관됩니다 (SEO 자산 보호).</li>
                <li>법령에 따라 보관이 필요한 경우 해당 기간 동안 보관합니다.</li>
            </ul>
        </div>

        <div class="section">
            <h2>5. 제3자 제공</h2>
            <p>서비스 운영을 위해 다음 외부 서비스를 이용합니다.</p>
            <ul>
                <li><strong>Supabase:</strong> 데이터베이스 및 인증 서비스</li>
                <li><strong>Cloudflare:</strong> 웹사이트 호스팅 및 CDN</li>
                <li><strong>Fly.io:</strong> 웹 애플리케이션 서버 호스팅</li>
                <li><strong>Anthropic Claude API:</strong> AI 기반 콘텐츠 생성</li>
            </ul>
        </div>

        <div class="section">
            <h2>6. 정보 보안</h2>
            <ul>
                <li>비밀번호는 암호화(해시)하여 저장됩니다.</li>
                <li>HTTPS를 통한 암호화 통신을 사용합니다.</li>
                <li>접근 권한 관리를 통해 정보를 보호합니다.</li>
            </ul>
        </div>

        <div class="section">
            <h2>7. 이용자 권리</h2>
            <p>파트너는 자신의 정보에 대해 다음 권리를 행사할 수 있습니다.</p>
            <ul>
                <li>개인정보 열람 및 확인</li>
                <li>개인정보 수정 및 변경</li>
                <li>계정 삭제 및 탈퇴</li>
                <li>거래처 정보 관리 (추가, 수정, 미구독 전환)</li>
            </ul>
        </div>

        <div class="section">
            <h2>8. 연락처</h2>
            <p>개인정보 관련 문의: <strong>contact@ContentFactory.onmicrosoft.com</strong></p>
        </div>

        <div class="footer">
            <p><strong>부칙</strong></p>
            <p>본 방침은 2025년 1월 1일부터 시행합니다.</p>
        </div>
    </div>
    <a href="/" class="back-btn">← 홈으로</a>
</body>
</html>`;
}

// sitemap.xml 생성
async function handleSitemap() {
  try {
    // 모든 활성 거래처 조회
    const clientsResponse = await fetch(
      `${SUPABASE_URL}/rest/v1/clients?status=eq.active&select=subdomain`,
      {
        headers: {
          'apikey': SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
        }
      }
    );
    const clients = await clientsResponse.json();

    // 모든 콘텐츠 조회
    const contentsResponse = await fetch(
      `${SUPABASE_URL}/rest/v1/contents?select=id,client_id,created_at&order=created_at.desc&limit=1000`,
      {
        headers: {
          'apikey': SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
        }
      }
    );
    const contents = await contentsResponse.json();

    // 거래처 ID -> subdomain 매핑
    const clientMap = {};
    clients.forEach(client => {
      clientMap[client.subdomain] = true;
    });

    // 콘텐츠에서 거래처 정보 매핑
    const clientIdToSubdomain = {};
    const clientsWithIdResponse = await fetch(
      `${SUPABASE_URL}/rest/v1/clients?status=eq.active&select=id,subdomain`,
      {
        headers: {
          'apikey': SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
        }
      }
    );
    const clientsWithId = await clientsWithIdResponse.json();
    clientsWithId.forEach(client => {
      clientIdToSubdomain[client.id] = client.subdomain;
    });

    let urls = [];

    // KST 날짜 계산
    const getKstDate = () => {
      const utcDate = new Date();
      const kstDate = new Date(utcDate.getTime() + (9 * 60 * 60 * 1000));
      return kstDate.toISOString().split('T')[0];
    };

    // 메인 랜딩 페이지
    urls.push({
      loc: 'https://make-page.com/',
      lastmod: getKstDate(),
      changefreq: 'weekly',
      priority: '1.0'
    });

    // 거래처 메인 페이지
    clients.forEach(client => {
      urls.push({
        loc: `https://${client.subdomain}.make-page.com/`,
        lastmod: getKstDate(),
        changefreq: 'daily',
        priority: '0.9'
      });
    });

    // 블로그 개별 페이지
    contents.forEach(content => {
      const subdomain = clientIdToSubdomain[content.client_id];
      if (subdomain) {
        const lastmod = content.created_at ? content.created_at.split('T')[0] : getKstDate();
        urls.push({
          loc: `https://${subdomain}.make-page.com/blog/${content.id}`,
          lastmod: lastmod,
          changefreq: 'weekly',
          priority: '0.8'
        });
      }
    });

    // XML 생성
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map(url => `  <url>
    <loc>${url.loc}</loc>
    <lastmod>${url.lastmod}</lastmod>
    <changefreq>${url.changefreq}</changefreq>
    <priority>${url.priority}</priority>
  </url>`).join('\n')}
</urlset>`;

    return new Response(xml, {
      headers: {
        'Content-Type': 'application/xml; charset=utf-8',
        'Cache-Control': 'public, max-age=3600'
      }
    });

  } catch (error) {
    console.error('Sitemap generation error:', error);
    return new Response('Error generating sitemap', { status: 500 });
  }
}

// robots.txt 생성
function generateRobotsTxt() {
  return `User-agent: *
Allow: /

Sitemap: https://make-page.com/sitemap.xml`;
}
