// 포스팅 상세 페이지 HTML 생성

const { escapeHtml, normalizeLanguage, formatKoreanTime } = require('../utils.js');
const { UMAMI_WEBSITE_ID, LANGUAGE_TEXTS } = require('../config.js');

function getLanguageTexts(lang) {
    return LANGUAGE_TEXTS[lang] || LANGUAGE_TEXTS.ko;
}

async function generatePostPage(client, post, env) {

    const langCode = normalizeLanguage(client.language);

    const texts = getLanguageTexts(langCode);



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

module.exports = { generatePostPage };
