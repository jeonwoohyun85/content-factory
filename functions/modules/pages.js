// HTML 페이지 생성

const { escapeHtml, normalizeLanguage, getLinkInfo, convertToEmbedUrl, extractUrlFromMarkdown, fetchWithTimeout, parseCSV, normalizeClient, formatKoreanTime } = require('./utils.js');
const { UMAMI_WEBSITE_ID, LANGUAGE_TEXTS } = require('./config.js');

// getLanguageTexts 함수 (config.js의 LANGUAGE_TEXTS 사용)
function getLanguageTexts(lang) {
  return LANGUAGE_TEXTS[lang] || LANGUAGE_TEXTS.ko;
}
const { getPostsFromArchive, getClientFromSheets, getSheetId } = require('./sheets.js');
const { getGoogleAccessTokenForPosting } = require('./auth.js');

async function generatePostPage(client, post, env) {

  const langCode = normalizeLanguage(client.language);

  const texts = await getLanguageTexts(langCode, env);



  // 이미지 URL 파싱

  const imageUrls = (post.images || '').split(',').map(url => url.trim()).filter(url => url);



  // 본문을 문단으로 분리

  const paragraphs = (post.body || '').split('\n\n').filter(p => p.trim());



  // 이미지와 문단을 인터리브

  let contentHtml = '';

  const maxLength = Math.max(imageUrls.length, paragraphs.length);



  for (let i = 0; i < maxLength; i++) {

    // 문단 먼저 추가 (텍스트가 위로)

    if (i < paragraphs.length) {

      contentHtml += `<p class="post-paragraph">${escapeHtml(paragraphs[i])}</p>`;

    }

    // 이미지 다음 추가 (문단 아래)

    if (i < imageUrls.length) {

      contentHtml += `<img src="${escapeHtml(imageUrls[i])}" alt="${texts.postImage}" class="post-image">`;

    }

  }



  return `<!DOCTYPE html>

<html lang="${langCode}">

<head>

    <meta charset="UTF-8">

    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">

    <title>${escapeHtml(post.title)} - ${escapeHtml(client.business_name)}</title>

    <meta name="description" content="${escapeHtml((post.body || '').substring(0, 160))}">

    <!-- Umami Cloud Analytics -->

    <script defer src="https://cloud.umami.is/script.js" data-website-id="${client.umami_id || UMAMI_WEBSITE_ID}"></script>

    <style>

        * {

            margin: 0;

            padding: 0;

            box-sizing: border-box;

        }



        body {

            font-family: -apple-system, BlinkMacSystemFont, "Malgun Gothic", "맑은 고딕", "Segoe UI", Roboto, sans-serif;

            line-height: 1.8;

            color: #333;

            background: #f9fafb;

        }



        .container {

            max-width: 800px;

            margin: 0 auto;

            padding: 20px;

        }



        .back-button {

            display: inline-block;

            margin-bottom: 24px;

            color: #667eea;

            text-decoration: none;

            font-size: 14px;

            font-weight: 500;

        }



        .back-button:hover {

            text-decoration: underline;

        }



        .post-header {

            background: #fff;

            padding: 40px;

            border-radius: 12px;

            margin-bottom: 24px;

            box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);

        }



        .post-title {

            font-size: 32px;

            font-weight: 700;

            color: #1a1a1a;

            margin-bottom: 16px;

            line-height: 1.4;

        }



        .post-meta {

            display: flex;

            gap: 16px;

            font-size: 14px;

            color: #a0aec0;

        }



        .post-content {

            background: #fff;

            padding: 40px;

            border-radius: 12px;

            box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);

        }



        .post-image {

            width: 100%;

            max-width: 800px;

            height: auto;

            border-radius: 8px;

            margin: 32px 0;

            display: block;

        }



        .post-paragraph {

            font-size: 17px;

            color: #333;

            line-height: 1.8;

            margin-bottom: 24px;

        }



        /* Footer */

        footer {

            background: #f7fafc;

            border-top: 1px solid #e2e8f0;

            padding: 60px 16px;

            margin-top: 60px;

        }



        .footer-content {

            max-width: 800px;

            margin: 0 auto;

            text-align: center;

        }



        .footer-title {

            font-size: 20px;

            font-weight: 700;

            color: #1a1a1a;

            margin-bottom: 24px;

        }



        .footer-info {

            display: flex;

            flex-direction: column;

            gap: 12px;

            align-items: center;

        }



        .footer-item {

            font-size: 14px;

            color: #4a5568;

            display: flex;

            align-items: center;

            gap: 8px;

        }



        @media (min-width: 768px) {

            .footer-info {

                flex-direction: row;

                justify-content: center;

                gap: 32px;

            }

        }



        @media (max-width: 768px) {

            .container {

                padding: 16px;

            }



            .post-header, .post-content {

                padding: 24px;

            }



            .post-title {

                font-size: 24px;

            }



            .post-body {

                font-size: 16px;

            }

        }

    </style>

</head>

<body>

    <div class="container">

        <a href="/" class="back-button">← ${escapeHtml(client.business_name)} ${texts.backToHome}</a>



        <div class="post-header">

            <h1 class="post-title">${escapeHtml(post.title)}</h1>

            <div class="post-meta">

                <span>${escapeHtml(client.business_name)}</span>

                <span>•</span>

                <time>${escapeHtml(formatKoreanTime(post.created_at))}</time>

            </div>

        </div>



        <div class="post-content">

            ${contentHtml}

        </div>

    </div>



    <!-- Footer -->

    <footer>

        <div class="footer-content">

            <h3 class="footer-title">${escapeHtml(client.business_name)}</h3>

            <div class="footer-info">

                ${client.address ? '<div class="footer-item"><span>📍</span><span>' + escapeHtml(client.address) + '</span></div>' : ''}

                ${client.phone ? '<div class="footer-item"><span>📞</span><span>' + escapeHtml(client.phone) + '</span></div>' : ''}

                ${client.business_hours ? '<div class="footer-item"><span>🕐</span><span>' + escapeHtml(client.business_hours) + '</span></div>' : ''}

            </div>

        </div>

    </footer>

</body>

</html>`;

}

async function generateClientPage(client, debugInfo, env) {

  const langCode = normalizeLanguage(client.language);

  const texts = await getLanguageTexts(langCode, env);



  // Links 파싱 (쉼표 구분) - 마크다운 형식 처리 후 언어 텍스트 전달

  const links = (client.links || '').split(',')
    .map(l => extractUrlFromMarkdown(l.trim()))
    .filter(l => l && !l.includes('cloud.umami.is'))  // Umami URL 제외
    .map(url => getLinkInfo(url, texts))
    .filter(l => l);
  
  // Umami 통계 버튼 (우마미_공유 컬럼 사용)
  if (client.umami_share) {
    // 전체 URL이면 그대로, Share ID만 있으면 URL 생성
    const shareUrl = client.umami_share.includes('http') 
      ? client.umami_share 
      : `https://cloud.umami.is/share/${client.umami_share}`;
    
    links.push({
      icon: '📊',
      text: texts.stats,
      url: shareUrl
    });
  }

  // Info 이미지 파싱 (쉼표 구분) + Google Drive URL 변환 (전체 이미지 포함, 제한 없음)

  const allInfoImages = (client.info || '').split(',')

    .map(i => i.trim())

    .filter(i => i)

    .map(url => {

      // Google Drive /view URL을 /thumbnail로 변환

      if (url.includes('drive.google.com/file/d/')) {

        const fileId = url.split('/d/')[1].split('/')[0];

        return `https://drive.google.com/thumbnail?id=${fileId}&sz=w400`;

      }

      return url;

    });



  // Video 파싱 (쉼표 구분)

  const videoUrls = (client.video || '').split(',').map(v => v.trim()).filter(v => v).map(convertToEmbedUrl).filter(v => v);



  // Posts 파싱 (최근 1개)

  const posts = (client.posts || []).slice(0, 1);



  // 전화번호 링크 추가

  if (client.phone && !links.some(l => l.url.includes(client.phone))) {

    links.unshift({ icon: '📞', text: texts.phone, url: `tel:${client.phone}` });

  }



  return `<!DOCTYPE html>

<html lang="${langCode}">

<head>

    <meta charset="UTF-8">

    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">

    <title>${escapeHtml(client.business_name)}</title>

    <!-- Umami Cloud Analytics -->

    <script defer src="https://cloud.umami.is/script.js" data-website-id="${client.umami_id || UMAMI_WEBSITE_ID}"></script>

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

            grid-template-columns: repeat(2, 1fr);

            gap: 12px;

            max-width: 700px;

            margin: 0 auto;

        }



        .quick-link-item {

            background: #fff;

            border: 1px solid #e2e8f0;

            border-radius: 8px;

            padding: 24px 16px;

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

            font-size: 36px;

            margin-bottom: 8px;

        }



        .quick-link-text {

            font-size: 14px;

            font-weight: 600;

            color: #1a1a1a;

        }



        /* Gallery Section */

        .gallery-grid {

            display: grid;

            grid-template-columns: repeat(2, 1fr);

            gap: 16px;

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



        /* Video Section */

        .video-grid {

            display: grid;

            grid-template-columns: repeat(1, 1fr);

            gap: 24px;

        }



        @media (min-width: 768px) {

            .quick-links {

                grid-template-columns: repeat(3, 1fr);

            }

            .gallery-grid {

                grid-template-columns: repeat(3, 1fr);

            }

            .video-grid {

                grid-template-columns: repeat(2, 1fr);

            }

        }



        @media (min-width: 1024px) {

            .gallery-grid {

                grid-template-columns: repeat(3, 1fr);

            }

        }



        .video-item {

            position: relative;

            width: 100%;

            padding-top: 56.25%; /* 16:9 비율 (모바일 최적화) */

            border-radius: 8px;

            overflow: hidden;

            background: #000;

        }



        .video-item iframe {

            position: absolute;

            top: 0;

            left: 0;

            width: 100%;

            height: 100%;

            border: 0;

        }



        /* Posts Section */

        .posts-grid {

            display: grid;

            grid-template-columns: repeat(1, 1fr);

            gap: 24px;

        }



        .post-card {

            background: #fff;

            border: 1px solid #e2e8f0;

            border-radius: 8px;

            padding: 24px;

            transition: transform 0.3s, box-shadow 0.3s;

            position: relative;

        }



        .post-card:hover {

            transform: translateY(-4px);

            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);

        }



        .post-delete-btn {

            position: absolute;

            top: 12px;

            right: 12px;

            width: 32px;

            height: 32px;

            background: #ef4444;

            color: #fff;

            border: none;

            border-radius: 50%;

            font-size: 18px;

            font-weight: 700;

            cursor: pointer;

            display: flex;

            align-items: center;

            justify-content: center;

            transition: all 0.3s;

            opacity: 0.8;

        }



        .post-delete-btn:hover {

            opacity: 1;

            transform: scale(1.1);

        }



        .post-title {

            font-size: 20px;

            font-weight: 700;

            color: #1a1a1a;

            margin-bottom: 12px;

            line-height: 1.4;

            padding-right: 40px;

        }



        .post-body {

            font-size: 15px;

            color: #4a5568;

            line-height: 1.6;

            margin-bottom: 16px;

        }



        .post-date {

            font-size: 13px;

            color: #a0aec0;

        }



        @media (min-width: 768px) {

            .contact-info {

                flex-direction: row;

            }

        }



        /* Footer */

        footer {

            background: #f7fafc;

            border-top: 1px solid #e2e8f0;

            padding: 60px 16px;

        }



        .footer-content {

            max-width: 1200px;

            margin: 0 auto;

            text-align: center;

        }



        .footer-title {

            font-size: 20px;

            font-weight: 700;

            color: #1a1a1a;

            margin-bottom: 24px;

        }



        .footer-info {

            display: flex;

            flex-direction: column;

            gap: 12px;

            align-items: center;

        }



        .footer-item {

            font-size: 14px;

            color: #4a5568;

            display: flex;

            align-items: center;

            gap: 8px;

        }



        @media (min-width: 768px) {

            .footer-info {

                flex-direction: row;

                justify-content: center;

                gap: 32px;

            }

        }



        /* Lightbox */

        .lightbox {

            display: none;

            position: fixed;

            z-index: 9999;

            top: 0;

            left: 0;

            width: 100%;

            height: 100%

;

            background: rgba(0, 0, 0, 0.9);

            align-items: center;

            justify-content: center;

        }



        .lightbox.active {

            display: flex;

        }



        .lightbox-content {

            position: relative;

            max-width: 90%;

            max-height: 90%;

        }



        .lightbox-image {

            width: 100%;

            height: 100%;

            object-fit: contain;

            max-height: 90vh;

        }



        .lightbox-close {

            position: absolute;

            top: 20px;

            right: 20px;

            color: #fff;

            font-size: 40px;

            font-weight: 300;

            cursor: pointer;

            z-index: 10000;

            width: 50px;

            height: 50px;

            display: flex;

            align-items: center;

            justify-content: center;

            background: rgba(0, 0, 0, 0.5);

            border-radius: 50%;

            transition: background 0.3s;

        }



        .lightbox-close:hover {

            background: rgba(0, 0, 0, 0.8);

        }



        .lightbox-nav {

            position: absolute;

            top: 50%;

            transform: translateY(-50%);

            color: #fff;

            font-size: 60px;

            font-weight: 300;

            cursor: pointer;

            padding: 20px;

            background: rgba(0, 0, 0, 0.5);

            border-radius: 4px;

            user-select: none;

            transition: background 0.3s;

        }



        .lightbox-nav:hover {

            background: rgba(0, 0, 0, 0.8);

        }



        .lightbox-prev {

            left: 20px;

        }



        .lightbox-next {

            right: 20px;

        }



        /* Password Modal */

        .password-modal {

            display: none;

            position: fixed;

            z-index: 10000;

            top: 0;

            left: 0;

            width: 100%;

            height: 100%;

            background: rgba(0, 0, 0, 0.5);

            align-items: center;

            justify-content: center;

        }



        .password-modal.active {

            display: flex;

        }



        .password-modal-content {

            background: #fff;

            padding: 32px;

            border-radius: 12px;

            max-width: 400px;

            width: 90%;

            text-align: center;

        }



        .password-modal-title {

            font-size: 20px;

            font-weight: 700;

            margin-bottom: 16px;

        }



        .password-input {

            width: 100%;

            padding: 12px;

            border: 1px solid #e2e8f0;

            border-radius: 8px;

            font-size: 16px;

            margin-bottom: 16px;

        }



        .password-buttons {

            display: flex;

            gap: 12px;

        }



        .password-btn {

            flex: 1;

            padding: 12px;

            border: none;

            border-radius: 8px;

            font-size: 16px;

            font-weight: 600;

            cursor: pointer;

            transition: all 0.3s;

        }



        .password-btn-confirm {

            background: #ef4444;

            color: #fff;

        }



        .password-btn-confirm:hover {

            background: #dc2626;

        }



        .password-btn-cancel {

            background: #e2e8f0;

            color: #333;

        }



        .password-btn-cancel:hover {

            background: #cbd5e1;

        }

    </style>

</head>

<body>

    <!-- Header -->

    <header>

        <div class="header-content">

            <h1 class="business-name">${escapeHtml(client.business_name)}</h1>

        </div>

    </header>



    <!-- Profile Section -->

    <section class="profile-section">

        <div class="profile-content">

            <h2 class="profile-title">${escapeHtml(client.business_name)}</h2>

            <div class="contact-info">

                ${client.address ? '<div class="contact-item"><span class="contact-icon">📍</span><span>' + escapeHtml(client.address) + '</span></div>' : ''}

                ${client.phone ? '<div class="contact-item"><span class="contact-icon">📞</span><span>' + escapeHtml(client.phone) + '</span></div>' : ''}

                ${client.business_hours ? '<div class="contact-item"><span class="contact-icon">🕐</span><span>' + escapeHtml(client.business_hours) + '</span></div>' : ''}

            </div>



            <!-- Quick Links -->

            ${links.length > 0 ? '<div class="quick-links">' + links.map(link => '<a href="' + escapeHtml(link.url) + '" class="quick-link-item"' + (link.url.startsWith('http') ? ' target="_blank"' : '') + '><div class="quick-link-icon">' + link.icon + '</div><div class="quick-link-text">' + escapeHtml(link.text) + '</div></a>').join('') + '</div>' : ''}

        </div>

    </section>



    <!-- Info Section (클라이언트 사이드 랜덤 렌더링) -->

    ${allInfoImages.length > 0 ? '<section><h2 class="section-title">' + texts.info + '</h2><div id="gallery-grid" class="gallery-grid"></div></section>' : ''}



    <!-- Video Section -->

    ${videoUrls.length > 0 ? '<section><h2 class="section-title">' + texts.video + '</h2><div class="video-grid">' + videoUrls.map(url => '<div class="video-item"><iframe src="' + escapeHtml(url) + '" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe></div>').join('') + '</div></section>' : ''}



    <!-- Posts Section -->

    ${posts.length > 0 ? '<section><h2 class="section-title">' + texts.posts + '</h2><div class="posts-grid">' + posts.map(post => '<article class="post-card"><a href="/post?id=' + encodeURIComponent(post.created_at) + '" style="text-decoration: none; color: inherit;"><h3 class="post-title">' + escapeHtml(post.title) + '</h3><p class="post-body">' + escapeHtml((post.body || '').substring(0, 200)) + '...</p><time class="post-date">' + escapeHtml(formatKoreanTime(post.created_at)) + '</time></a></article>').join('') + '</div></section>' : ''}



    <!-- Footer -->

    <footer>

        <div class="footer-content">

            <h3 class="footer-title">${escapeHtml(client.business_name)}</h3>

            <div class="footer-info">

                ${client.address ? '<div class="footer-item"><span>📍</span><span>' + escapeHtml(client.address) + '</span></div>' : ''}

                ${client.phone ? '<div class="footer-item"><span>📞</span><span>' + escapeHtml(client.phone) + '</span></div>' : ''}

                ${client.business_hours ? '<div class="footer-item"><span>🕐</span><span>' + escapeHtml(client.business_hours) + '</span></div>' : ''}

            </div>

        </div>

    </footer>



    <!-- Lightbox -->

    <div id="lightbox" class="lightbox" onclick="closeLightbox()">

        <span class="lightbox-close" onclick="closeLightbox()">×</span>

        <span class="lightbox-nav lightbox-prev" onclick="event.stopPropagation(); prevImage()">&#10094;</span>

        <div class="lightbox-content" onclick="event.stopPropagation()">

            <img id="lightbox-image" class="lightbox-image" src="" alt="${texts.info}">

        </div>

        <span class="lightbox-nav lightbox-next" onclick="event.stopPropagation(); nextImage()">&#10095;</span>

    </div>



    <script>

        // 전체 이미지 배열

        const allInfoImages = ${JSON.stringify(allInfoImages)};

        let displayedImages = [];

        let currentImageIndex = 0;



        // 페이지 로드 시 랜덤 6개 선택 및 렌더링

        function renderGallery() {

            const galleryGrid = document.getElementById('gallery-grid');

            if (!galleryGrid || allInfoImages.length === 0) return;



            // 랜덤으로 섞고 최대 6개 선택

            displayedImages = allInfoImages.length > 6 

                ? [...allInfoImages].sort(() => Math.random() - 0.5).slice(0, 6)

                : [...allInfoImages];



            // 갤러리 렌더링

            galleryGrid.innerHTML = displayedImages.map((img, index) => 

                \`<div class="gallery-item" onclick="openLightbox(\${index})">

                    <img src="\${img}" alt="${texts.galleryImage}" class="gallery-image">

                </div>\`

            ).join('');

        }



        function openLightbox(index) {

            currentImageIndex = index;

            document.getElementById('lightbox-image').src = displayedImages[index];

            document.getElementById('lightbox').classList.add('active');

            document.body.style.overflow = 'hidden';

        }



        function closeLightbox() {

            document.getElementById('lightbox').classList.remove('active');

            document.body.style.overflow = 'auto';

        }



        function nextImage() {

            currentImageIndex = (currentImageIndex + 1) % displayedImages.length;

            document.getElementById('lightbox-image').src = displayedImages[currentImageIndex];

        }



        function prevImage() {

            currentImageIndex = (currentImageIndex - 1 + displayedImages.length) % displayedImages.length;

            document.getElementById('lightbox-image').src = displayedImages[currentImageIndex];

        }



        // ESC 키로 닫기

        document.addEventListener('keydown', function(e) {

            if (e.key === 'Escape') {

                closeLightbox();

            }

            if (e.key === 'ArrowRight') nextImage();

            if (e.key === 'ArrowLeft') prevImage();

        });



        // 페이지 로드 시 갤러리 렌더링

        if (document.readyState === 'loading') {

            document.addEventListener('DOMContentLoaded', renderGallery);

        } else {

            renderGallery();

        }

    </script>

    <!-- DEBUG CLIENT: ${JSON.stringify(client)} -->

    <!-- DEBUG HEADERS: ${JSON.stringify(debugInfo)} -->

</body>

</html>`;

}

function generateRobotsTxt() {

  return `User-agent: *

Allow: /



Sitemap: https://make-page.com/sitemap.xml`;

}

async function handleSitemap(env) {

  try {

    // Google Sheets에서 활성 거래처 조회

    const SHEET_URL = env.GOOGLE_SHEETS_CSV_URL || 'https://docs.google.com/spreadsheets/d/1KrzLFi8Wt9GTGT97gcMoXnbZ3OJ04NsP4lncJyIdyhU/export?format=csv&gid=0';

    const response = await fetchWithTimeout(SHEET_URL, {}, 10000);

    const csvText = await response.text();

    const clients = parseCSV(csvText).map(normalizeClient);



    const activeClients = clients.filter(client => client.subscription === '활성');



    let urls = [];



    // KST 날짜 계산

    const getKstDate = () => {

      const utcDate = new Date();

      const kstDate = new Date(utcDate.getTime() + (9 * 60 * 60 * 1000));

      return kstDate.toISOString().split('T')[0];

    };



    // 거래처 메인 페이지만 포함

    activeClients.forEach(client => {
      // subdomain 정규화 (.make-page.com 제거)
      const normalizedSubdomain = client.subdomain.replace('.make-page.com', '').replace('/', '');

      urls.push({

        loc: `https://${normalizedSubdomain}.make-page.com/`,

        lastmod: getKstDate(),

        changefreq: 'daily',

        priority: '0.9'

      });

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

async function deletePost(subdomain, createdAt, password, env) {

  // 비밀번호 확인

  if (password !== env.DELETE_PASSWORD) {

    return { success: false, error: '비밀번호가 올바르지 않습니다' };

  }



  try {

    const accessToken = await getGoogleAccessTokenForPosting(env);

    const archiveSheetName = env.ARCHIVE_SHEET_NAME || '저장소';

    const latestSheetName = env.LATEST_POSTING_SHEET_NAME || '최신 포스팅';



    // 도메인 정규화

    const normalizedSubdomain = subdomain.replace('.make-page.com', '').replace('/', '');

    const domain = `${normalizedSubdomain}.make-page.com`;



    // 1. 저장소 탭에서 삭제

    const archiveResponse = await fetch(

      `https://sheets.googleapis.com/v4/spreadsheets/${env.SHEETS_ID}/values/'${archiveSheetName}'!A:Z`,

      { headers: { Authorization: `Bearer ${accessToken}` } }

    );

    const archiveData = await archiveResponse.json();

    const archiveRows = archiveData.values || [];



    if (archiveRows.length < 2) {

      return { success: false, error: '삭제할 포스트를 찾을 수 없습니다' };

    }



    const archiveHeaders = archiveRows[0];

    const archiveDomainIndex = archiveHeaders.indexOf('도메인');

    const archiveCreatedAtIndex = archiveHeaders.indexOf('생성일시');



    if (archiveDomainIndex === -1 || archiveCreatedAtIndex === -1) {

      return { success: false, error: '저장소 시트 구조 오류' };

    }



    let foundInArchive = false;

    for (let i = 1; i < archiveRows.length; i++) {

      const row = archiveRows[i];

      if (row[archiveDomainIndex] === domain && row[archiveCreatedAtIndex] === createdAt) {

        // 행 삭제

        const archiveSheetId = await getSheetId(env.SHEETS_ID, archiveSheetName, accessToken);

        await fetch(

          `https://sheets.googleapis.com/v4/spreadsheets/${env.SHEETS_ID}:batchUpdate`,

          {

            method: 'POST',

            headers: {

              'Authorization': `Bearer ${accessToken}`,

              'Content-Type': 'application/json'

            },

            body: JSON.stringify({

              requests: [{

                deleteDimension: {

                  range: {

                    sheetId: archiveSheetId,

                    dimension: 'ROWS',

                    startIndex: i,

                    endIndex: i + 1

                  }

                }

              }]

            })

          }

        );

        foundInArchive = true;

        break;

      }

    }



    // 2. 최신 포스팅 탭에서도 삭제

    const latestResponse = await fetch(

      `https://sheets.googleapis.com/v4/spreadsheets/${env.SHEETS_ID}/values/'${latestSheetName}'!A:Z`,

      { headers: { Authorization: `Bearer ${accessToken}` } }

    );

    const latestData = await latestResponse.json();

    const latestRows = latestData.values || [];



    if (latestRows.length >= 2) {

      const latestHeaders = latestRows[0];

      const latestDomainIndex = latestHeaders.indexOf('도메인');

      const latestCreatedAtIndex = latestHeaders.indexOf('생성일시');



      if (latestDomainIndex !== -1 && latestCreatedAtIndex !== -1) {

        for (let i = 1; i < latestRows.length; i++) {

          const row = latestRows[i];

          if (row[latestDomainIndex] === domain && row[latestCreatedAtIndex] === createdAt) {

            const latestSheetId = await getSheetId(env.SHEETS_ID, latestSheetName, accessToken);

        await fetch(

          `https://sheets.googleapis.com/v4/spreadsheets/${env.SHEETS_ID}:batchUpdate`,

          {

            method: 'POST',

            headers: {

              'Authorization': `Bearer ${accessToken}`,

              'Content-Type': 'application/json'

            },

            body: JSON.stringify({

              requests: [{

                deleteDimension: {

                  range: {

                    sheetId: latestSheetId,

                    dimension: 'ROWS',

                    startIndex: i,

                    endIndex: i + 1

                  }

                }

              }]

            })

          }

        );

        break;

      }

    }

      }

    }



    if (!foundInArchive) {

      return { success: false, error: '삭제할 포스트를 찾을 수 없습니다' };

    }



    return { success: true };



  } catch (error) {

    console.error('Delete post error:', error);

    return { success: false, error: error.message };

  }

}

module.exports = { generateClientPage, generatePostPage, deletePost };
