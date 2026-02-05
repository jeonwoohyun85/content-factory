// 거래처 메인 페이지 HTML 생성

const { escapeHtml } = require('../utils/html-utils.js');
const { normalizeLanguage } = require('../utils/normalize.js');
const { getLinkInfo, convertToEmbedUrl, extractUrlFromMarkdown } = require('../utils/url-utils.js');
const { formatKoreanTime } = require('../utils/time-utils.js');
const { LANGUAGE_TEXTS } = require('../config.js');
const { getOrCreateUmamiWebsite, getUmamiScriptUrl } = require('../umami-manager.js');

function getLanguageTexts(lang) {
    return LANGUAGE_TEXTS[lang] || LANGUAGE_TEXTS.ko;
}

async function generateClientPage(client, debugInfo, env) {

    const langCode = normalizeLanguage(client.language);

    const texts = await getLanguageTexts(langCode, env);

    // Umami 웹사이트 자동 생성 또는 조회
    const umami = await getOrCreateUmamiWebsite(client.domain, client.business_name);

    // Links 파싱 (쉼표 구분) - 마크다운 형식 처리 후 언어 텍스트 전달

    const links = (client.links || '').split(',')
        .map(l => extractUrlFromMarkdown(l.trim()))
        .filter(l => l && !l.includes('cloud.umami.is'))  // Umami URL 제외
        .map(url => getLinkInfo(url, texts))
        .filter(l => l);

    // Umami 통계 버튼 (자동 생성된 Share URL 사용)
    if (umami.shareUrl) {
        links.push({
            icon: '📊',
            text: texts.stats,
            url: umami.shareUrl
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



    // Video 파싱 (쉼표 구분, 최대 2개)

    const videoUrls = (client.video || '').split(',').map(v => v.trim()).filter(v => v).map(convertToEmbedUrl).filter(v => v).slice(0, 2);



    // Posts 파싱 (최근 1개)

    const posts = (client.posts || []).slice(0, 1);

    // Previous Posts (Firestore에서 조회, 10개)
    let previousPosts = [];
    try {
        const subdomain = client.subdomain.replace('.make-page.com', '').replace('/', '');
        const snapshot = await env.POSTING_KV.collection('posts_archive')
            .where('subdomain', '==', subdomain)
            .get();

        // 클라이언트 사이드 정렬 및 제한
        previousPosts = snapshot.docs
            .map(doc => doc.data())
            .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
            .slice(0, 10);

        console.log(`Previous posts 조회 성공: ${previousPosts.length}개`);
    } catch (error) {
        console.error('Previous posts 조회 실패:', error.message);
    }



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

    <!-- Umami Self-Hosted Analytics -->
    ${umami.websiteId ? `<script defer src="${getUmamiScriptUrl()}" data-website-id="${umami.websiteId}"></script>` : '<!-- Umami tracking disabled -->'}

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



        /* Previous Posts Accordion */

        .accordion {

            margin-top: 30px;

            border-top: 2px solid #e2e8f0;

            padding-top: 20px;

        }



        .accordion-header {

            display: flex;

            align-items: center;

            justify-content: space-between;

            cursor: pointer;

            padding: 16px 20px;

            background: #f7fafc;

            border-radius: 8px;

            transition: all 0.2s;

            user-select: none;

        }



        .accordion-header:hover {

            background: #edf2f7;

        }



        .accordion-title {

            font-size: 16px;

            font-weight: 600;

            color: #2d3748;

            display: flex;

            align-items: center;

            gap: 8px;

        }



        .accordion-icon {

            font-size: 14px;

            color: #718096;

            transition: transform 0.3s;

        }



        .accordion-icon.open {

            transform: rotate(90deg);

        }



        .accordion-content {

            max-height: 0;

            overflow: hidden;

            transition: max-height 0.3s ease-out;

        }



        .accordion-content.open {

            max-height: 3000px;

            transition: max-height 0.5s ease-in;

        }



        .accordion-body {

            padding-top: 20px;

        }



        .previous-posts-table {

            width: 100%;

            border-collapse: collapse;

            background: #fff;

        }



        .previous-posts-table thead {

            background: #f7fafc;

        }



        .previous-posts-table th {

            padding: 12px 16px;

            text-align: left;

            font-size: 12px;

            font-weight: 600;

            color: #718096;

            text-transform: uppercase;

            letter-spacing: 0.5px;

            border-bottom: 2px solid #e2e8f0;

        }



        .previous-posts-table td {

            padding: 16px;

            border-top: 1px solid #e2e8f0;

            color: #4a5568;

        }



        .previous-posts-table tbody tr {

            cursor: pointer;

            transition: background 0.2s;

        }



        .previous-posts-table tbody tr:hover {

            background: #f7fafc;

        }



        .previous-post-title {

            color: #2d3748;

            font-weight: 500;

            max-width: 400px;

            overflow: hidden;

            text-overflow: ellipsis;

            white-space: nowrap;

        }



        .previous-post-date {

            color: #a0aec0;

            font-size: 14px;

            white-space: nowrap;

        }



        .pagination {

            display: flex;

            justify-content: center;

            align-items: center;

            gap: 8px;

            margin-top: 32px;

            padding: 20px 0;

            border-top: 1px solid #e2e8f0;

        }



        .pagination-btn {

            min-width: 40px;

            height: 40px;

            padding: 0 12px;

            border: 1px solid #e2e8f0;

            background: #fff;

            color: #4a5568;

            font-size: 14px;

            font-weight: 500;

            border-radius: 8px;

            cursor: pointer;

            transition: all 0.2s;

            display: flex;

            align-items: center;

            justify-content: center;

        }



        .pagination-btn:hover {

            border-color: #667eea;

            color: #667eea;

            background: #f7fafc;

        }



        .pagination-btn.active {

            background: #667eea;

            color: #fff;

            border-color: #667eea;

        }



        .pagination-btn:disabled {

            opacity: 0.4;

            cursor: not-allowed;

        }



        .pagination-btn:disabled:hover {

            border-color: #e2e8f0;

            color: #4a5568;

            background: #fff;

        }



        .pagination-ellipsis {

            padding: 0 8px;

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

    <section><h2 class="section-title">Posts</h2>${posts.length > 0 ? '<div class="posts-grid">' + posts.map(post => {
        const postUrl = post.url ? '/' + post.url.split('/').slice(1).join('/') : '/post?id=' + new Date(post.created_at).getTime().toString(36);
        return '<article class="post-card"><a href="' + postUrl + '" style="text-decoration: none; color: inherit;"><h3 class="post-title">' + escapeHtml(post.title) + '</h3><p class="post-body">' + escapeHtml((post.body || '').substring(0, 200)) + '...</p><time class="post-date">' + escapeHtml(formatKoreanTime(post.created_at)) + '</time></a></article>';
    }).join('') + '</div>' : ''}<div class="accordion"><div class="accordion-header" onclick="toggleAccordion()"><div class="accordion-title"><span class="accordion-icon" id="accordion-icon">▶</span><span>Previous Posts</span></div></div><div class="accordion-content" id="accordion-content"><div class="accordion-body">${previousPosts.length > 0 ?
        '<table class="previous-posts-table"><thead><tr><th>Title</th><th>Date</th></tr></thead><tbody id="previous-posts-list">' + previousPosts.map(p => {
            // URL에서 도메인 부분 제거하고 경로만 추출
            let pUrl = p.url || '';
            if (pUrl.includes('/post?id=')) {
                pUrl = pUrl.substring(pUrl.indexOf('/post?id='));
            }
            return '<tr onclick="window.location.href=\'' + pUrl + '\'"><td class="previous-post-title">' + escapeHtml(p.title) + '</td><td class="previous-post-date">' + escapeHtml(formatKoreanTime(p.created_at)) + '</td></tr>';
        }).join('') + '</tbody></table><div class="pagination" id="pagination"></div>'
        : '<div style="text-align:center;padding:40px 20px;color:#718096;">아직 포스팅이 없습니다</div>'
        }</div></div></div></section>



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



        // Previous Posts Accordion

        let currentOffset = 10;

        const subdomain = '${client.subdomain.replace('.make-page.com', '').replace('/', '')}';



        function toggleAccordion() {

            const content = document.getElementById('accordion-content');

            const icon = document.getElementById('accordion-icon');



            if (content.classList.contains('open')) {

                content.classList.remove('open');

                icon.classList.remove('open');

            } else {

                content.classList.add('open');

                icon.classList.add('open');

            }

        }



        let currentPage = 1;

        let totalPosts = 0;

        const postsPerPage = 10;



        // 초기 총 개수 가져오기

        async function fetchTotalPosts() {

            try {

                const response = await fetch(\`/api/posts?subdomain=\${subdomain}&offset=0&limit=1\`);

                const data = await response.json();

                if (data.total !== undefined) {

                    totalPosts = data.total;

                    updatePagination();

                }

            } catch (error) {

                console.error('Fetch total posts error:', error);

            }

        }



        async function changePage(page) {

            if (page < 1) return;

            const totalPages = Math.ceil(totalPosts / postsPerPage);

            if (page > totalPages) return;



            currentPage = page;

            const offset = (page - 1) * postsPerPage;



            // API에서 해당 페이지 데이터 가져오기

            try {

                const response = await fetch(\`/api/posts?subdomain=\${subdomain}&offset=\${offset}&limit=\${postsPerPage}\`);

                const data = await response.json();



                if (data.success) {

                    if (data.total !== undefined) {

                        totalPosts = data.total;

                    }



                    const list = document.getElementById('previous-posts-list');

                    list.innerHTML = '';



                    if (data.posts && data.posts.length > 0) {

                        data.posts.forEach(post => {

                            const row = document.createElement('tr');

                            row.onclick = () => window.location.href = post.url;

                            row.innerHTML = \`

                                <td class="previous-post-title">\${escapeHtml(post.title)}</td>

                                <td class="previous-post-date">\${escapeHtml(post.created_at)}</td>

                            \`;

                            list.appendChild(row);

                        });

                    }



                    updatePagination();

                    window.scrollTo({ top: document.getElementById('accordion-content').offsetTop - 100, behavior: 'smooth' });

                }

            } catch (error) {

                console.error('Page change error:', error);

            }

        }



        function updatePagination() {

            const pagination = document.getElementById('pagination');

            const totalPages = Math.ceil(totalPosts / postsPerPage);

            let html = '';



            // 이전 버튼

            html += \`<button class="pagination-btn" onclick="changePage(\${currentPage - 1})" \${currentPage === 1 ? 'disabled' : ''}>◀</button>\`;



            // 페이지 번호들

            const maxVisible = 5;

            let startPage = Math.max(1, currentPage - 2);

            let endPage = Math.min(totalPages, startPage + maxVisible - 1);



            if (endPage - startPage < maxVisible - 1) {

                startPage = Math.max(1, endPage - maxVisible + 1);

            }



            if (startPage > 1) {

                html += \`<button class="pagination-btn" onclick="changePage(1)">1</button>\`;

                if (startPage > 2) {

                    html += \`<span class="pagination-ellipsis">...</span>\`;

                }

            }



            for (let i = startPage; i <= endPage; i++) {

                html += \`<button class="pagination-btn \${i === currentPage ? 'active' : ''}" onclick="changePage(\${i})">\${i}</button>\`;

            }



            if (endPage < totalPages) {

                if (endPage < totalPages - 1) {

                    html += \`<span class="pagination-ellipsis">...</span>\`;

                }

                html += \`<button class="pagination-btn" onclick="changePage(\${totalPages})">\${totalPages}</button>\`;

            }



            // 다음 버튼

            html += \`<button class="pagination-btn" onclick="changePage(\${currentPage + 1})" \${currentPage === totalPages ? 'disabled' : ''}>▶</button>\`;



            pagination.innerHTML = html;

        }



        // 초기 페이지네이션 렌더링

        fetchTotalPosts();



        function escapeHtml(text) {

            const div = document.createElement('div');

            div.textContent = text;

            return div.innerHTML;

        }

    </script>

    <!-- DEBUG CLIENT: ${JSON.stringify(client)} -->

    <!-- DEBUG HEADERS: ${JSON.stringify(debugInfo)} -->

</body>

</html>`;

}

module.exports = { generateClientPage };
