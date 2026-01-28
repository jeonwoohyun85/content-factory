// Content Factory - Minimal Version (Google Sheets Only)
// 거래처 페이지만 제공 (랜딩페이지, 블로그, Supabase 전부 제거)

// ==================== 유틸리티 함수 ====================

// 전역 번역 캐시 (Worker 재시작 전까지 유지)
const TRANSLATION_CACHE = {};

// Timeout이 있는 fetch
async function fetchWithTimeout(url, options = {}, timeoutMs = 10000) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal
    });
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
}

// HTML 이스케이프 (XSS 방지)
function escapeHtml(text) {
  if (!text) return '';
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };
  return text.toString().replace(/[&<>'"']/g, m => map[m]);
}

// 언어 코드 정규화 (주요 언어만 매핑, 나머지는 입력값 그대로)
function normalizeLanguage(lang) {
  if (!lang) return 'ko';
  const lower = lang.toLowerCase();
  
  // 주요 5개 언어만 체크 (하드코딩된 번역 데이터)
  if (lower.includes('한국') || lower.includes('한글') || lower.includes('korean') || lower === 'ko') return 'ko';
  if (lower.includes('영어') || lower.includes('english') || lower === 'en') return 'en';
  if (lower.includes('일본') || lower.includes('japanese') || lower === 'ja') return 'ja';
  if (lower.includes('중국') || lower.includes('간체') || lower.includes('simplified') || lower.includes('chinese') || lower === 'zh' || lower === 'zh-cn') return 'zh-CN';
  if (lower.includes('번체') || lower.includes('traditional') || lower === 'zh-tw') return 'zh-TW';
  
  // 나머지는 입력값 그대로 반환 (API에서 처리)
  return lang;
}

// 주요 언어 하드코딩 번역 데이터
const LANGUAGE_TEXTS = {
  ko: {
    info: 'Info',
    video: 'Video',
    posts: 'Posts',
    backToHome: '홈으로',
    phone: '전화하기',
    instagram: '인스타그램',
    youtube: '유튜브',
    facebook: '페이스북',
    kakao: '카카오톡',
    location: '위치보기',
    blog: '블로그',
    booking: '예약하기',
    link: '링크'
  },
  en: {
    info: 'Gallery',
    video: 'Videos',
    posts: 'Posts',
    backToHome: 'Back to Home',
    phone: 'Call',
    instagram: 'Instagram',
    youtube: 'YouTube',
    facebook: 'Facebook',
    kakao: 'KakaoTalk',
    location: 'Location',
    blog: 'Blog',
    booking: 'Book Now',
    link: 'Link'
  },
  ja: {
    info: 'ギャラリー',
    video: '動画',
    posts: '投稿',
    backToHome: 'ホームに戻る',
    phone: '電話する',
    instagram: 'インスタグラム',
    youtube: 'ユーチューブ',
    facebook: 'フェイスブック',
    kakao: 'カカオトーク',
    location: '位置を見る',
    blog: 'ブログ',
    booking: '予約する',
    link: 'リンク'
  },
  'zh-CN': {
    info: '画廊',
    video: '视频',
    posts: '帖子',
    backToHome: '返回主页',
    phone: '打电话',
    instagram: 'Instagram',
    youtube: 'YouTube',
    facebook: 'Facebook',
    kakao: 'KakaoTalk',
    location: '查看位置',
    blog: '博客',
    booking: '预订',
    link: '链接'
  },
  'zh-TW': {
    info: '畫廊',
    video: '影片',
    posts: '貼文',
    backToHome: '返回主頁',
    phone: '打電話',
    instagram: 'Instagram',
    youtube: 'YouTube',
    facebook: 'Facebook',
    kakao: 'KakaoTalk',
    location: '查看位置',
    blog: '部落格',
    booking: '預訂',
    link: '連結'
  }
};

// Gemini로 언어 번역 (2.5 Flash)
async function translateWithGemini(language, env) {
  const prompt = `Translate the following UI text items to ${language}. Return ONLY a valid JSON object with these exact keys, no markdown formatting, no code blocks:

{
  "info": "Gallery/Photos section title",
  "video": "Videos section title",
  "posts": "Blog posts section title",
  "backToHome": "Back to home link text",
  "phone": "Call/Phone button",
  "instagram": "Instagram link",
  "youtube": "YouTube link",
  "facebook": "Facebook link",
  "kakao": "KakaoTalk link",
  "location": "Location/Map link",
  "blog": "Blog link",
  "booking": "Booking/Reservation button",
  "link": "Generic link text"
}

IMPORTANT: Return ONLY the JSON object, no other text.`;

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${env.GEMINI_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{"parts": [{"text": prompt}]}],
        generationConfig: {
          temperature: 0.3,
          maxOutputTokens: 500
        }
      })
    }
  );

  const data = await response.json();
  const text = data.candidates[0].content.parts[0].text;
  
  // JSON 추출
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    return JSON.parse(jsonMatch[0]);
  }
  
  // 실패 시 영어 반환
  return LANGUAGE_TEXTS.en;
}

// 언어별 텍스트 가져오기 (캐시 → 하드코딩 → API)
async function getLanguageTexts(langCode, env) {
  // 1. 캐시 확인
  if (TRANSLATION_CACHE[langCode]) {
    return TRANSLATION_CACHE[langCode];
  }
  
  // 2. 하드코딩된 언어
  if (LANGUAGE_TEXTS[langCode]) {
    return LANGUAGE_TEXTS[langCode];
  }
  
  // 3. API 호출 (첫 요청만)
  try {
    const texts = await translateWithGemini(langCode, env);
    TRANSLATION_CACHE[langCode] = texts;
    return texts;
  } catch (error) {
    console.error(`Translation error for ${langCode}:`, error);
    // 실패 시 영어 반환
    return LANGUAGE_TEXTS.en;
  }
}

// CSV 파싱 (큰따옴표로 감싸진 필드 처리)
function parseCSV(csvText) {
  const lines = csvText.trim().split('\n');

  // 헤더 파싱 (BOM 제거 및 공백 제거)
  const headers = parseCSVLine(lines[0]).map(h => h.replace(/^\uFEFF/, '').trim());

  const clients = [];
  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    const client = {};
    headers.forEach((header, index) => {
      client[header] = values[index] || '';
    });
    clients.push(client);
  }
  return clients;
}

// CSV 한 줄 파싱 (큰따옴표 처리)
function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }

  result.push(current.trim());
  return result;
}

// 한글 컬럼명을 영어 키로 정규화
function normalizeClient(client) {
  const mapping = {
    '도메인': 'subdomain',
    '서브도메인': 'subdomain',
    '상호명': 'business_name',
    '업체': 'partner_name',
    '주소': 'address',
    '언어': 'language',
    '연락처': 'phone',
    '전화번호': 'phone',
    '영업시간': 'business_hours',
    '키워드_업체': 'description',
    '거래처_정보': 'description',
    '소개': 'description',
    '비고기타': 'links',
    '바로가기': 'links',
    'info': 'info',
    'video': 'video',
    '업종': 'industry',
    '상태': 'status',
    '폴더명': 'folder_name'
  };

  const normalized = {};

  // 기존 키 복사
  Object.keys(client).forEach(key => {
    const mappedKey = mapping[key] || key;
    normalized[mappedKey] = client[key];
  });

  return normalized;
}

// Google Sheets에서 거래처 정보 조회
async function getClientFromSheets(clientId, env) {
  try {
    const SHEET_URL = env.GOOGLE_SHEETS_CSV_URL || 'https://docs.google.com/spreadsheets/d/1KrzLFi8Wt9GTGT97gcMoXnbZ3OJ04NsP4lncJyIdyhU/export?format=csv&gid=0';
    const response = await fetchWithTimeout(SHEET_URL, {}, 10000);
    const csvText = await response.text();
    
    // 수동 파싱 및 디버그 정보 수집
    const lines = csvText.trim().split('\n');
    const headers = parseCSVLine(lines[0]).map(h => h.replace(/^\uFEFF/, '').trim());
    const debugInfo = { headers, rawLine: lines[0] };

    const clients = [];
    for (let i = 1; i < lines.length; i++) {
      const values = parseCSVLine(lines[i]);
      const client = {};
      headers.forEach((header, index) => {
        client[header] = values[index] || '';
      });
      clients.push(client);
    }

    const normalizedClients = clients.map(normalizeClient);

    const client = normalizedClients.find(c => {
      // subdomain 정규화: "00001.make-page.com" → "00001"
      let normalizedSubdomain = c.subdomain || '';
      if (normalizedSubdomain.includes('.make-page.com')) {
        normalizedSubdomain = normalizedSubdomain.replace('.make-page.com', '').replace('/', '');
      }
      return normalizedSubdomain === clientId;
    });

    // Posts 조회 추가 (최신 포스팅 시트에서 읽기)
    if (client) {
      const postsResult = await getPostsFromArchive(clientId, env);
      client.posts = postsResult.posts;
      if (postsResult.error) {
        debugInfo.postsError = postsResult.error;
      }
    }

    return { client, debugInfo };
  } catch (error) {
    console.error('Google Sheets fetch error:', error);
    return { client: null, debugInfo: { error: error.message } };
  }
}

// UTC 시간을 한국 시간으로 변환
function formatKoreanTime(isoString) {
  if (!isoString) return '';

  try {
    // 시트에 이미 KST 시간이 저장되어 있으므로 그대로 파싱
    const match = isoString.match(/^(\d{4})-(\d{2})-(\d{2})\s+(\d{2}):(\d{2})/);
    if (match) {
      const [_, year, month, day, hours, minutes] = match;
      return `${year}-${month}-${day} ${hours}:${minutes}`;
    }

    // 폴백: ISO 형식이 아닌 경우
    return isoString;
  } catch (error) {
    return isoString;
  }
}

// 최신 포스팅 시트에서 포스트 데이터 읽기 (홈페이지 표시용)
async function getPostsFromArchive(subdomain, env) {
  try {
    // Step 1: 토큰 발급
    let accessToken;
    try {
      accessToken = await getGoogleAccessTokenForPosting(env);
    } catch (tokenError) {
      return { posts: [], error: `Token error: ${tokenError.message}` };
    }

    const latestSheetName = env.LATEST_POSTING_SHEET_NAME || '최신 포스팅';

    // Step 2: 시트 읽기
    const response = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${env.SHEETS_ID}/values/${encodeURIComponent(latestSheetName)}!A:Z`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );

    if (!response.ok) {
      return { posts: [], error: `Sheets API error: ${response.status}` };
    }

    const data = await response.json();
    const rows = data.values || [];

    if (rows.length < 2) {
      return { posts: [], error: 'No data rows in sheet' };
    }

    const headers = rows[0];
    const domainIndex = headers.indexOf('도메인');
    const businessNameIndex = headers.indexOf('상호명');
    const titleIndex = headers.indexOf('제목');
    const createdAtIndex = headers.indexOf('생성일시');
    const languageIndex = headers.indexOf('언어');
    const industryIndex = headers.indexOf('업종');
    const bodyIndex = headers.indexOf('본문');
    const imagesIndex = headers.indexOf('이미지');

    if (domainIndex === -1) {
      console.error('최신 포스팅 시트에 "도메인" 컬럼이 없습니다');
      return { posts: [], error: 'No domain column' };
    }

    const posts = [];

    // 첫 번째 행은 헤더이므로 1부터 시작
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      const domain = row[domainIndex] || '';

      // 도메인 매칭 (00001.make-page.com 또는 00001)
      const normalizedDomain = domain.replace('.make-page.com', '').replace('/', '');
      const normalizedSubdomain = subdomain.replace('.make-page.com', '').replace('/', '');

      if (normalizedDomain === normalizedSubdomain) {
        posts.push({
          subdomain: domain,
          business_name: businessNameIndex !== -1 ? (row[businessNameIndex] || '') : '',
          title: titleIndex !== -1 ? (row[titleIndex] || '') : '',
          created_at: createdAtIndex !== -1 ? (row[createdAtIndex] || '') : '',
          language: languageIndex !== -1 ? (row[languageIndex] || '') : '',
          industry: industryIndex !== -1 ? (row[industryIndex] || '') : '',
          body: bodyIndex !== -1 ? (row[bodyIndex] || '') : '',
          images: imagesIndex !== -1 ? (row[imagesIndex] || '') : ''
        });
      }
    }

    // created_at 기준 내림차순 정렬 (최신순)
    posts.sort((a, b) => {
      const dateA = new Date(a.created_at);
      const dateB = new Date(b.created_at);
      return dateB - dateA;
    });

    return { posts, error: null };
  } catch (error) {
    console.error('Error fetching posts from latest sheet:', error);
    return { posts: [], error: `${error.message} (${error.stack?.substring(0, 100) || 'no stack'})` };
  }
}

function pemToArrayBuffer(pem) {
  const b64 = pem
    .replace(/-----BEGIN PRIVATE KEY-----/, '')
    .replace(/-----END PRIVATE KEY-----/, '')
    .replace(/\s/g, '');

  const binaryString = atob(b64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
}



// 링크 타입 자동 감지 (언어별 텍스트)
function getLinkInfo(url, texts) {
  if (!url) return null;

  url = url.trim();
  
  // 유효한 URL인지 확인 (http/https/tel:로 시작하는 것만 처리)
  if (!url.startsWith('http') && !url.startsWith('tel:')) {
    return null;
  }

  if (url.startsWith('tel:')) {
    return { icon: '📞', text: texts.phone, url };
  }

  if (url.includes('instagram.com')) {
    return { icon: '📷', text: texts.instagram, url };
  }

  if (url.includes('youtube.com') || url.includes('youtu.be')) {
    return { icon: '▶️', text: texts.youtube, url };
  }

  if (url.includes('facebook.com')) {
    return { icon: '👥', text: texts.facebook, url };
  }

  if (url.includes('pf.kakao.com') || url.includes('talk.kakao')) {
    return { icon: '💬', text: texts.kakao, url };
  }

  if (url.includes('map.naver.com') || url.includes('naver.me')) {
    return { icon: '📍', text: texts.location, url };
  }

  if (url.includes('maps.google.com') || url.includes('goo.gl/maps')) {
    return { icon: '📍', text: texts.location, url };
  }

  if (url.includes('map.kakao.com')) {
    return { icon: '📍', text: texts.location, url };
  }

  if (url.includes('blog.naver.com')) {
    return { icon: '📝', text: texts.blog, url };
  }

  if (url.includes('tistory.com')) {
    return { icon: '📝', text: texts.blog, url };
  }

  if (url.includes('booking') || url.includes('reserve')) {
    return { icon: '📅', text: texts.booking, url };
  }

  return { icon: '🔗', text: texts.link, url };
}

// 영상 URL을 임베드 형식으로 변환
function convertToEmbedUrl(url) {
  if (!url) return null;

  url = url.trim();

  // YouTube
  if (url.includes('youtube.com/watch?v=')) {
    const videoId = url.split('v=')[1].split('&')[0];
    return `https://www.youtube.com/embed/${videoId}`;
  }
  if (url.includes('youtu.be/')) {
    const videoId = url.split('youtu.be/')[1].split('?')[0];
    return `https://www.youtube.com/embed/${videoId}`;
  }

  // Google Drive
  if (url.includes('drive.google.com/file/d/')) {
    const fileId = url.split('/d/')[1].split('/')[0];
    return `https://drive.google.com/file/d/${fileId}/preview`;
  }

  // TikTok
  if (url.includes('tiktok.com')) {
    // TikTok embed format varies, try to extract video ID
    const match = url.match(/video\/(\d+)/);
    if (match) {
      return `https://www.tiktok.com/embed/v2/${match[1]}`;
    }
  }

  // Instagram
  if (url.includes('instagram.com')) {
    // Instagram embed: /p/ or /reel/
    if (url.includes('/p/') || url.includes('/reel/')) {
      const cleanUrl = url.split('?')[0];
      return `${cleanUrl}embed/`;
    }
  }

  // Already embed format or unknown
  return url;
}

// ==================== 페이지 생성 ====================

// 포스트 상세 페이지 생성
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
    // 이미지 추가
    if (i < imageUrls.length) {
      contentHtml += `<img src="${escapeHtml(imageUrls[i])}" alt="Post Image" class="post-image">`;
    }
    // 문단 추가
    if (i < paragraphs.length) {
      contentHtml += `<p class="post-paragraph">${escapeHtml(paragraphs[i])}</p>`;
    }
  }

  return `<!DOCTYPE html>
<html lang="${langCode}">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
    <title>${escapeHtml(post.title)} - ${escapeHtml(client.business_name)}</title>
    <meta name="description" content="${escapeHtml((post.body || '').substring(0, 160))}">
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
</body>
</html>`;
}

// 거래처 페이지 생성
// 마크다운 링크에서 URL 추출 [텍스트](URL) -> URL
function extractUrlFromMarkdown(text) {
  if (!text) return text;
  const match = text.match(/\[.*?\]\((https?:\/\/[^\)]+)\)/);
  return match ? match[1] : text;
}

async function generateClientPage(client, debugInfo, env) {
  const langCode = normalizeLanguage(client.language);
  const texts = await getLanguageTexts(langCode, env);

  // Links 파싱 (쉼표 구분) - 마크다운 형식 처리 후 언어 텍스트 전달
  const links = (client.links || '').split(',').map(l => extractUrlFromMarkdown(l.trim())).filter(l => l).map(url => getLinkInfo(url, texts)).filter(l => l);

  // Info 이미지 파싱 (쉼표 구분) + Google Drive URL 변환
  let infoImages = (client.info || '').split(',')
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

  // 랜덤으로 섞고 최대 6개만 선택
  if (infoImages.length > 6) {
    infoImages = infoImages.sort(() => Math.random() - 0.5).slice(0, 6);
  }

  // Video 파싱 (쉼표 구분)
  const videoUrls = (client.video || '').split(',').map(v => v.trim()).filter(v => v).map(convertToEmbedUrl).filter(v => v);

  // Posts 파싱 (최근 2개)
  const posts = (client.posts || []).slice(0, 2);

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
            grid-template-columns: repeat(3, 1fr);
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
            .video-grid {
                grid-template-columns: repeat(2, 1fr);
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
            grid-template-columns: repeat(2, 1fr); /* PC: 2열 */
            gap: 24px;
        }

        @media (max-width: 768px) {
            .posts-grid {
                grid-template-columns: repeat(1, 1fr); /* 모바일: 1열 */
            }
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

    <!-- Info Section -->
    ${infoImages.length > 0 ? '<section><h2 class="section-title">' + texts.info + '</h2><div class="gallery-grid">' + infoImages.map((img, index) => '<div class="gallery-item" onclick="openLightbox(' + index + ')"><img src="' + escapeHtml(img) + '" alt="Info" class="gallery-image"></div>').join('') + '</div></section>' : ''}

    <!-- Video Section -->
    ${videoUrls.length > 0 ? '<section><h2 class="section-title">' + texts.video + '</h2><div class="video-grid">' + videoUrls.map(url => '<div class="video-item"><iframe src="' + escapeHtml(url) + '" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe></div>').join('') + '</div></section>' : ''}

    <!-- Posts Section -->
    ${posts.length > 0 ? '<section><h2 class="section-title">' + texts.posts + '</h2><div class="posts-grid">' + posts.map(post => '<article class="post-card"><a href="/post?id=' + encodeURIComponent(post.created_at) + '" style="text-decoration: none; color: inherit;"><h3 class="post-title">' + escapeHtml(post.title) + '</h3><p class="post-body">' + escapeHtml((post.body || '').substring(0, 200)) + '...</p><time class="post-date">' + escapeHtml(formatKoreanTime(post.created_at)) + '</time></a></article>').join('') + '</div></section>' : ''}

    <!-- Lightbox -->
    <div id="lightbox" class="lightbox" onclick="closeLightbox()">
        <span class="lightbox-close" onclick="closeLightbox()">×</span>
        <span class="lightbox-nav lightbox-prev" onclick="event.stopPropagation(); prevImage()">&#10094;</span>
        <div class="lightbox-content" onclick="event.stopPropagation()">
            <img id="lightbox-image" class="lightbox-image" src="" alt="Info">
        </div>
        <span class="lightbox-nav lightbox-next" onclick="event.stopPropagation(); nextImage()">&#10095;</span>
    </div>



    <script>
        const infoImages = ${JSON.stringify(infoImages)};
        let currentImageIndex = 0;

        function openLightbox(index) {
            currentImageIndex = index;
            document.getElementById('lightbox-image').src = infoImages[index];
            document.getElementById('lightbox').classList.add('active');
            document.body.style.overflow = 'hidden';
        }

        function closeLightbox() {
            document.getElementById('lightbox').classList.remove('active');
            document.body.style.overflow = 'auto';
        }

        function nextImage() {
            currentImageIndex = (currentImageIndex + 1) % infoImages.length;
            document.getElementById('lightbox-image').src = infoImages[currentImageIndex];
        }

        function prevImage() {
            currentImageIndex = (currentImageIndex - 1 + infoImages.length) % infoImages.length;
            document.getElementById('lightbox-image').src = infoImages[currentImageIndex];
        }

        // ESC 키로 닫기
        document.addEventListener('keydown', function(e) {
            if (e.key === 'Escape') {
                closeLightbox();
            }
            if (e.key === 'ArrowRight') nextImage();
            if (e.key === 'ArrowLeft') prevImage();
        });
    </script>
    <!-- DEBUG CLIENT: ${JSON.stringify(client)} -->
    <!-- DEBUG HEADERS: ${JSON.stringify(debugInfo)} -->
</body>
</html>`;
}

// robots.txt 생성
function generateRobotsTxt() {
  return `User-agent: *
Allow: /

Sitemap: https://make-page.com/sitemap.xml`;
}

// ==================== Sitemap ====================

async function handleSitemap(env) {
  try {
    // Google Sheets에서 활성 거래처 조회
    const SHEET_URL = env.GOOGLE_SHEETS_CSV_URL || 'https://docs.google.com/spreadsheets/d/1KrzLFi8Wt9GTGT97gcMoXnbZ3OJ04NsP4lncJyIdyhU/export?format=csv&gid=0';
    const response = await fetchWithTimeout(SHEET_URL, {}, 10000);
    const csvText = await response.text();
    const clients = parseCSV(csvText).map(normalizeClient);

    const activeClients = clients.filter(client => client.status === '구독');

    let urls = [];

    // KST 날짜 계산
    const getKstDate = () => {
      const utcDate = new Date();
      const kstDate = new Date(utcDate.getTime() + (9 * 60 * 60 * 1000));
      return kstDate.toISOString().split('T')[0];
    };

    // 거래처 메인 페이지만 포함
    activeClients.forEach(client => {
      urls.push({
        loc: `https://${client.subdomain}.make-page.com/`,
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

// ==================== 포스트 삭제 ====================

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

// ==================== 라우팅 ====================

export default {
  async scheduled(event, env, ctx) {
    // KST 시간 계산
    const nowUtc = new Date();
    const nowKst = new Date(nowUtc.getTime() + (9 * 60 * 60 * 1000));
    console.log('Scheduled trigger started at (KST)', nowKst.toISOString().replace('T', ' ').substring(0, 19));

    try {
      // 1. 모든 활성 거래처 조회
      const SHEET_URL = env.GOOGLE_SHEETS_CSV_URL || 'https://docs.google.com/spreadsheets/d/1KrzLFi8Wt9GTGT97gcMoXnbZ3OJ04NsP4lncJyIdyhU/export?format=csv&gid=0';
      const response = await fetch(SHEET_URL);
      const csvText = await response.text();
      const clients = parseCSV(csvText).map(normalizeClient).filter(c => c.status === '구독');

      console.log(`Found ${clients.length} active clients`);

      // 2. 포스팅 생성
      for (const client of clients) {
        try {
          // 오늘 이미 포스팅했는지 확인 (KST 기준)
          const posts = getRecentPostsFromClient(client);
          const lastPostDate = posts.length > 0 ? new Date(posts[0].created_at) : null;
          const todayKst = nowKst;

          const isToday = lastPostDate &&
                          lastPostDate.getFullYear() === todayKst.getUTCFullYear() &&
                          lastPostDate.getMonth() === todayKst.getUTCMonth() &&
                          lastPostDate.getDate() === todayKst.getUTCDate();

          if (!isToday) {
            console.log(`Generating post for ${client.subdomain}...`);
            const normalizedSubdomain = client.subdomain.replace('.make-page.com', '').replace('/', '');
            await generatePostingForClient(normalizedSubdomain, env);
          } else {
            console.log(`Skipping ${client.subdomain}: already posted today`);
          }
        } catch (err) {
          console.error(`Error processing ${client.subdomain}:`, err);
        }
      }
    } catch (error) {
      console.error('Scheduled handler error:', error);
    }
  },

  async queue(batch, env) {
    console.log(`Queue consumer processing ${batch.messages.length} messages`);

    for (const message of batch.messages) {
      try {
        const { subdomain } = message.body;
        console.log(`Processing queue message for subdomain: ${subdomain}`);

        const result = await generatePostingForClient(subdomain, env);

        console.log(`Queue result:`, JSON.stringify(result, null, 2));

        if (result.success) {
          console.log(`Queue: Successfully generated posting for ${subdomain}`);
          message.ack();
        } else {
          console.error(`Queue: Failed to generate posting for ${subdomain}:`, result.error);
          console.error(`Queue: Logs:`, result.logs);
          message.retry();
        }
      } catch (error) {
        console.error(`Queue: Error processing message:`, error);
        console.error(`Queue: Error stack:`, error.stack);
        message.retry();
      }
    }
  },

  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const hostname = url.hostname;
    const pathname = url.pathname;

    // www 리다이렉트
    if (hostname === 'www.make-page.com') {
      const redirectUrl = `https://make-page.com${pathname}${url.search}`;
      return Response.redirect(redirectUrl, 301);
    }

    // 서브도메인 추출
    const subdomain = hostname.split('.')[0];

    // make-page.com (메인 도메인) 처리
    if (hostname === 'make-page.com' || hostname === 'staging.make-page.com') {
      if (pathname === '/sitemap.xml') {
        return handleSitemap(env);
      }
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
      // Test posting generation (직접 실행, Queue 우회)
      if (pathname === '/test-posting' && request.method === 'POST') {
        try {
          const { subdomain } = await request.json();
          const result = await generatePostingForClient(subdomain, env);

          return new Response(JSON.stringify(result, null, 2), {
            headers: { 'Content-Type': 'application/json' }
          });
        } catch (error) {
          return new Response(JSON.stringify({
            error: error.message,
            stack: error.stack
          }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
          });
        }
      }

      // Test sheet reading (시트 데이터 확인)
      if (pathname === '/test-sheet' && request.method === 'GET') {
        try {
          const accessToken = await getGoogleAccessTokenForPosting(env);
          const archiveSheetName = env.ARCHIVE_SHEET_NAME || '저장소';
          const latestSheetName = env.LATEST_POSTING_SHEET_NAME || '최신 포스팅';

          const latestResponse = await fetch(
            `https://sheets.googleapis.com/v4/spreadsheets/${env.SHEETS_ID}/values/${encodeURIComponent(latestSheetName)}!A:Z`,
            { headers: { Authorization: `Bearer ${accessToken}` } }
          );
          const latestData = await latestResponse.json();

          const archiveResponse = await fetch(
            `https://sheets.googleapis.com/v4/spreadsheets/${env.SHEETS_ID}/values/${encodeURIComponent(archiveSheetName)}!A:Z`,
            { headers: { Authorization: `Bearer ${accessToken}` } }
          );
          const archiveData = await archiveResponse.json();

          return new Response(JSON.stringify({
            latest: {
              sheetName: latestSheetName,
              rowCount: (latestData.values || []).length,
              headers: (latestData.values || [])[0] || [],
              firstDataRow: (latestData.values || [])[1] || [],
              allRows: latestData.values || []
            },
            archive: {
              sheetName: archiveSheetName,
              rowCount: (archiveData.values || []).length,
              headers: (archiveData.values || [])[0] || [],
              firstDataRow: (archiveData.values || [])[1] || [],
              allRows: archiveData.values || []
            }
          }, null, 2), {
            headers: { 'Content-Type': 'application/json' }
          });
        } catch (error) {
          return new Response(JSON.stringify({
            error: error.message,
            stack: error.stack
          }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
          });
        }
      }

      // Generate posting (Queue 전송)
      if (pathname === '/generate-posting' && request.method === 'POST') {
        try {
          const { subdomain } = await request.json();

          // Queue에 메시지 전송
          await env.POSTING_QUEUE.send({ subdomain });

          // 즉시 202 응답
          return new Response(JSON.stringify({
            success: true,
            message: "포스팅 생성이 Queue에 추가되었습니다. 완료까지 2-3분 소요됩니다.",
            subdomain: subdomain
          }), {
            status: 202,
            headers: { 'Content-Type': 'application/json' }
          });
        } catch (error) {
          return new Response(JSON.stringify({
            error: error.message,
            stack: error.stack
          }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
          });
        }
      }
      // 메인 도메인은 404 (랜딩페이지 없음)
      return new Response('Not Found', { status: 404 });
    }

    // 서브도메인이 5자리 숫자가 아니면 404
    if (!/^\d{5}$/.test(subdomain)) {
      return new Response('Not Found', { status: 404 });
    }

    try {
      // Delete post 엔드포인트
      if (pathname === '/delete-post' && request.method === 'POST') {
        const { subdomain: reqSubdomain, created_at, password } = await request.json();
        const result = await deletePost(reqSubdomain, created_at, password, env);
        return new Response(JSON.stringify(result), {
          status: result.success ? 200 : 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      // Google Sheets에서 거래처 정보 조회
      const { client, debugInfo } = await getClientFromSheets(subdomain, env);

      if (!client) {
        return new Response('Not Found', { status: 404 });
      }

      // 비활성 거래처는 표시 안함 (일시적으로 해제)
      /*
      if (client.status !== '구독') {
        return new Response('This page is inactive', { status: 403 });
      }
      */

      // 포스트 상세 페이지
      if (pathname === '/post' && client.posts && client.posts.length > 0) {
        // Query parameter에서 post ID 추출
        const postId = url.searchParams.get('id');

        // created_at으로 포스트 찾기
        const post = postId
          ? client.posts.find(p => p.created_at === postId)
          : client.posts[0];

        if (!post) {
          return new Response('Post not found', { status: 404 });
        }

        return new Response(await generatePostPage(client, post, env), {
          headers: {
            'Content-Type': 'text/html; charset=utf-8',
            'Cache-Control': 'public, max-age=300'
          }
        });
      }

      // 거래처 페이지 생성
      return new Response(await generateClientPage(client, debugInfo, env), {
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
          'Cache-Control': 'public, max-age=300'
        }
      });

    } catch (error) {
      console.error('Error:', error);
      return new Response('Internal Server Error', { status: 500 });
    }
  }
};

// ==================== 포스팅 생성 함수들 (posting-generator.js 통합) ====================

async function generatePostingForClient(subdomain, env) {
  const logs = [];

  try {
    // Step 1: 거래처 정보 조회
    logs.push('거래처 정보 조회 중...');
    const client = await getClientFromSheetsForPosting(subdomain, env);
    if (!client) {
      return { success: false, error: 'Client not found', logs };
    }
    logs.push(`거래처: ${client.business_name}`);

    // Step 1.5: Google Drive 폴더 순환 선택
    logs.push('Google Drive 폴더 조회 중...');
    const accessToken = await getGoogleAccessTokenForPosting(env);
    const normalizedSubdomain = client.subdomain.replace('.make-page.com', '').replace('/', '');

    // 폴더명 컬럼 사용 (없으면 subdomain 기반 검색으로 폴백)
    const folderName = client.folder_name || null;
    if (folderName) {
      logs.push(`Drive 폴더 검색: 폴더명="${folderName}"`);
    } else {
      logs.push(`Drive 폴더 검색: subdomain=${normalizedSubdomain} (폴더명 컬럼 없음)`);
    }

    const folders = await getClientFoldersForPosting(folderName, normalizedSubdomain, accessToken, env, logs);

    if (folders.length === 0) {
      return { success: false, error: 'No folders found (Info/Video excluded)', logs };
    }

    logs.push(`폴더 ${folders.length}개 발견`);

    const lastUsedFolder = await getLastUsedFolderForPosting(subdomain, env);
    const nextFolder = getNextFolderForPosting(folders, lastUsedFolder);
    logs.push(`선택된 폴더: ${nextFolder}`);

    // Step 1.7: 선택된 폴더에서 모든 이미지 가져오기
    logs.push('폴더 내 이미지 조회 중...');
    const images = await getFolderImagesForPosting(normalizedSubdomain, nextFolder, accessToken, env, logs);
    logs.push(`이미지 ${images.length}개 발견`);

    if (images.length === 0) {
      return { success: false, error: 'No images found in folder', logs };
    }

    // Step 2: 웹 검색 (Gemini 2.5 Flash)
    logs.push('웹 검색 시작...');
    const trendsData = await searchWithGeminiForPosting(client, env);
    logs.push(`웹 검색 완료: ${trendsData.substring(0, 100)}...`);

    // Step 3: 포스팅 생성 (Gemini 3.0 Pro)
    logs.push('포스팅 생성 시작...');
    const postData = await generatePostWithGeminiForPosting(client, trendsData, images, env);
    logs.push(`포스팅 생성 완료: ${postData.title}`);

    // Step 3.5: 이미지 URL 추가
    const imageUrls = images.map(img => `https://drive.google.com/thumbnail?id=${img.id}&sz=w800`).join(',');
    postData.images = imageUrls;

    // Step 4: 저장소 + 최신 포스팅 시트 저장
    logs.push('저장소/최신포스팅 시트 저장 시작...');
    await saveToLatestPostingSheet(client, postData, normalizedSubdomain, nextFolder, env);
    logs.push('저장소/최신포스팅 시트 저장 완료');

    return {
      success: true,
      post: postData,
      logs
    };

  } catch (error) {
    logs.push(`에러: ${error.message}`);
    return {
      success: false,
      error: error.message,
      logs
    };
  }
}

async function getClientFromSheetsForPosting(subdomain, env) {
  const SHEET_URL = env.GOOGLE_SHEETS_CSV_URL || 'https://docs.google.com/spreadsheets/d/1KrzLFi8Wt9GTGT97gcMoXnbZ3OJ04NsP4lncJyIdyhU/export?format=csv&gid=0';
  const response = await fetch(SHEET_URL);
  const csvText = await response.text();
  const clients = parseCSV(csvText).map(normalizeClient);
  
  return clients.find(c => {
    let normalized = (c.subdomain || '').replace('.make-page.com', '').replace('/', '');
    return normalized === subdomain && c.status === '구독';
  }) || null;
}


async function searchWithGeminiForPosting(client, env) {
  const prompt = `
[업종] ${client.industry || client.business_name}
[언어] ${client.language}

다음 정보를 500자 이내로 작성:
1. ${client.language} 시장의 최신 트렌드
2. 검색 키워드 상위 5개
3. 소비자 관심사

출력 형식: 텍스트만 (JSON 불필요)
`;

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=${env.GEMINI_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{"parts": [{"text": prompt}]}],
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 600
        }
      })
    }
  );

  const data = await response.json();

  // 에러 처리
  if (data.error) {
    throw new Error(`Gemini API error: ${data.error.message}`);
  }

  if (!data.candidates || !data.candidates[0] || !data.candidates[0].content) {
    throw new Error(`Unexpected Gemini API response structure: ${JSON.stringify(data)}`);
  }

  return data.candidates[0].content.parts[0].text;
}

async function generatePostWithGeminiForPosting(client, trendsData, images, env) {
  const prompt = `
[거래처 정보]
- 업체명: ${client.business_name}
- 언어: ${client.language}
- **핵심 주제 및 소개 (필수 반영): ${client.description}**

[트렌드 정보]
${trendsData}

[제공된 이미지]
총 ${images.length}장의 이미지가 제공됩니다.

[작성 규칙]
1. 제목: **'${client.description}'의 핵심 내용을 반영**하여 매력적으로 작성 (완전 자유 창작)
2. 본문 전체 글자수: **공백 포함 2800~3200자** (필수)
3. 본문 구조: **반드시 ${images.length}개의 문단으로 작성**
   - 1번째 이미지 → 1번째 문단
   - 2번째 이미지 → 2번째 문단
   - ...
   - ${images.length}번째 이미지 → ${images.length}번째 문단
4. 각 문단: 해당 순서의 이미지에서 보이는 내용을 간결하게 설명
   - 이미지 속 색상, 분위기, 사물, 사람, 액션 등을 묘사
   - **각 문단은 공백 포함 약 280~320자 내외로 작성**
   - **[트렌드 정보]는 문단당 1~2문장 정도만 간결하게 배경 설명으로 활용**
5. 문단 구분: 문단 사이에 빈 줄 2개 (\\n\\n)로 명확히 구분
6. 금지어: 최고, 1등, 유일, 검증된
7. 금지 창작: 경력, 학력, 자격증, 수상
8. **본문의 모든 내용은 '${client.description}'의 주제와 자연스럽게 연결되어야 함 (최우선 순위)**
9. **간결하고 핵심적인 표현 사용 - 장황한 설명 금지**

출력 형식 (JSON):
{
  "title": "제목",
  "body": "문단1\\n\\n문단2\\n\\n문단3\\n\\n..."
}

중요: body는 정확히 ${images.length}개의 문단으로 구성되어야 하며, '${client.description}'의 내용이 포스팅의 중심이 되어야 합니다.
`;

  const parts = [{ text: prompt }];

  for (const image of images) {
    parts.push({
      inline_data: {
        mime_type: image.mimeType,
        data: image.data
      }
    });
  }

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-pro-preview:generateContent?key=${env.GEMINI_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{"parts": parts}],
        generationConfig: {
          temperature: 0.8,
          maxOutputTokens: 8000
        }
      })
    }
  );

  // HTTP 응답 상태 확인
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Gemini API HTTP ${response.status}: ${errorText.substring(0, 200)}`);
  }

  const data = await response.json();

  // 에러 처리
  if (data.error) {
    throw new Error(`Gemini API error: ${data.error.message}`);
  }

  if (!data.candidates || !data.candidates[0] || !data.candidates[0].content) {
    throw new Error(`Unexpected Gemini API response structure: ${JSON.stringify(data)}`);
  }

  const text = data.candidates[0].content.parts[0].text;

  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    return JSON.parse(jsonMatch[0]);
  }

  throw new Error('Failed to parse Gemini response');
}

async function getGoogleAccessTokenForPosting(env) {
  const serviceAccount = JSON.parse(env.GOOGLE_SERVICE_ACCOUNT_JSON);

  // Base64URL 인코딩 (UTF-8 안전)
  function base64urlEncode(str) {
    const base64 = btoa(unescape(encodeURIComponent(str)));
    return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
  }

  const jwtHeader = base64urlEncode(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const now = Math.floor(Date.now() / 1000);
  const jwtClaimSet = {
    iss: serviceAccount.client_email,
    scope: 'https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/drive.readonly',
    aud: 'https://oauth2.googleapis.com/token',
    exp: now + 3600,
    iat: now
  };

  const jwtClaimSetEncoded = base64urlEncode(JSON.stringify(jwtClaimSet));
  const signatureInput = `${jwtHeader}.${jwtClaimSetEncoded}`;

  const privateKey = await crypto.subtle.importKey(
    'pkcs8',
    pemToArrayBuffer(serviceAccount.private_key),
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signature = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    privateKey,
    new TextEncoder().encode(signatureInput)
  );

  const jwtSignature = btoa(String.fromCharCode(...new Uint8Array(signature)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');

  const jwt = `${signatureInput}.${jwtSignature}`;

  const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`
  });

  if (!tokenResponse.ok) {
    const errorText = await tokenResponse.text();
    throw new Error(`OAuth token error (${tokenResponse.status}): ${errorText}`);
  }

  const responseText = await tokenResponse.text();
  if (!responseText) {
    throw new Error('Empty OAuth token response');
  }

  const tokenData = JSON.parse(responseText);
  return tokenData.access_token;
}

async function getFolderImagesForPosting(subdomain, folderName, accessToken, env, logs) {
  const DRIVE_FOLDER_ID = env.DRIVE_FOLDER_ID || '1JiVmIkliR9YrPIUPOn61G8Oh7h9HTMEt';

  const businessFolderQuery = `mimeType = 'application/vnd.google-apps.folder' and name contains '${subdomain}' and '${DRIVE_FOLDER_ID}' in parents and trashed = false`;

  const businessFolderResponse = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(businessFolderQuery)}&fields=files(id,name)`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );

  const businessFolderData = await businessFolderResponse.json();
  if (!businessFolderData.files || businessFolderData.files.length === 0) {
    logs.push('이미지 조회: 거래처 폴더 없음');
    return [];
  }

  const businessFolderId = businessFolderData.files[0].id;
  logs.push(`이미지 조회: 거래처 폴더 ID ${businessFolderId}`);

  const targetFolderQuery = `mimeType = 'application/vnd.google-apps.folder' and name = '${folderName}' and '${businessFolderId}' in parents and trashed = false`;

  const targetFolderResponse = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(targetFolderQuery)}&fields=files(id,name)`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );

  const targetFolderData = await targetFolderResponse.json();
  logs.push(`타겟 폴더 검색 결과: ${JSON.stringify(targetFolderData)}`);

  if (!targetFolderData.files || targetFolderData.files.length === 0) {
    logs.push('이미지 조회: 타겟 폴더 없음');
    return [];
  }

  const targetFolderId = targetFolderData.files[0].id;
  logs.push(`이미지 조회: 타겟 폴더 ID ${targetFolderId}`);

  const filesQuery = `'${targetFolderId}' in parents and trashed = false`;

  const filesResponse = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(filesQuery)}&fields=files(id,name,mimeType)&pageSize=100`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );

  const filesData = await filesResponse.json();
  logs.push(`파일 검색 결과: ${JSON.stringify(filesData)}`);

  let imageFiles = (filesData.files || []).filter(f => f.mimeType && f.mimeType.startsWith('image/'));
  logs.push(`이미지 파일 ${imageFiles.length}개 필터링됨`);

  // 10개 초과시 랜덤 10개 선택
  if (imageFiles.length > 10) {
    imageFiles = imageFiles.sort(() => Math.random() - 0.5).slice(0, 10);
    logs.push(`10개 초과: 랜덤 ${imageFiles.length}개 선택`);
  }

  // 병렬 다운로드 (속도 향상)
  const downloadPromises = imageFiles.map(async (file) => {
    try {
      logs.push(`썸네일 다운로드: ${file.name}`);

      // Google Drive 썸네일 API 사용 (w400 크기)
      const thumbnailUrl = `https://lh3.googleusercontent.com/d/${file.id}=w400`;
      const imageResponse = await fetch(thumbnailUrl);

      if (!imageResponse.ok) {
        logs.push(`썸네일 다운로드 실패: ${file.name} - ${imageResponse.status}`);
        return null;
      }

      const arrayBuffer = await imageResponse.arrayBuffer();
      const bytes = new Uint8Array(arrayBuffer);

      let binary = '';
      const chunkSize = 8192;
      for (let i = 0; i < bytes.length; i += chunkSize) {
        const chunk = bytes.subarray(i, Math.min(i + chunkSize, bytes.length));
        binary += String.fromCharCode.apply(null, chunk);
      }
      const base64 = btoa(binary);

      logs.push(`썸네일 다운로드 완료: ${file.name}`);
      return {
        id: file.id,
        name: file.name,
        mimeType: file.mimeType,
        data: base64
      };
    } catch (error) {
      logs.push(`썸네일 다운로드 에러: ${file.name} - ${error.message}`);
      return null;
    }
  });

  const results = await Promise.all(downloadPromises);
  const images = results.filter(img => img !== null);

  logs.push(`총 ${images.length}개 이미지 다운로드 완료`);
  return images;
}

async function getClientFoldersForPosting(folderName, subdomain, accessToken, env, logs) {
  const DRIVE_FOLDER_ID = env.DRIVE_FOLDER_ID || '1JiVmIkliR9YrPIUPOn61G8Oh7h9HTMEt';

  // 폴더명이 있으면 정확한 매칭, 없으면 subdomain 포함 검색 (폴백)
  const businessFolderQuery = folderName
    ? `mimeType = 'application/vnd.google-apps.folder' and name = '${folderName}' and '${DRIVE_FOLDER_ID}' in parents and trashed = false`
    : `mimeType = 'application/vnd.google-apps.folder' and name contains '${subdomain}' and '${DRIVE_FOLDER_ID}' in parents and trashed = false`;

  const businessFolderResponse = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(businessFolderQuery)}&fields=files(id,name)`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );

  const businessFolderData = await businessFolderResponse.json();
  logs.push(`거래처 폴더 검색 결과: ${JSON.stringify(businessFolderData)}`);

  if (!businessFolderData.files || businessFolderData.files.length === 0) {
    logs.push('거래처 폴더를 찾을 수 없음');
    return [];
  }

  const businessFolderId = businessFolderData.files[0].id;
  logs.push(`거래처 폴더 ID: ${businessFolderId}`);

  const subFoldersQuery = `mimeType = 'application/vnd.google-apps.folder' and '${businessFolderId}' in parents and trashed = false`;

  const subFoldersResponse = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(subFoldersQuery)}&fields=files(id,name)&orderBy=name`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );

  const subFoldersData = await subFoldersResponse.json();
  logs.push(`하위 폴더 조회 결과: ${JSON.stringify(subFoldersData)}`);

  const folders = (subFoldersData.files || [])
    .map(f => f.name)
    .filter(name => {
      const lowerName = name.toLowerCase();
      return lowerName !== 'info' && lowerName !== 'video';
    })
    .sort();

  logs.push(`필터링된 폴더: ${JSON.stringify(folders)}`);

  return folders;
}

async function getLastUsedFolderForPosting(subdomain, env) {
  try {
    const accessToken = await getGoogleAccessTokenForPosting(env);
    const archiveSheetName = env.ARCHIVE_SHEET_NAME || '저장소';

    const response = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${env.SHEETS_ID}/values/${encodeURIComponent(archiveSheetName)}!A:Z`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    const rows = data.values || [];

    if (rows.length < 2) {
      return null;
    }

    const headers = rows[0];
    const domainIndex = headers.indexOf('도메인');
    const folderNameIndex = headers.indexOf('폴더명');

    if (domainIndex === -1 || folderNameIndex === -1) {
      return null;
    }

    const normalizedSubdomain = subdomain.replace('.make-page.com', '').replace('/', '');
    const domain = `${normalizedSubdomain}.make-page.com`;

    // 해당 도메인의 마지막 행에서 폴더명 가져오기
    let lastFolder = null;
    for (let i = rows.length - 1; i >= 1; i--) {
      const row = rows[i];
      const rowDomain = row[domainIndex] || '';
      if (rowDomain === domain) {
        lastFolder = row[folderNameIndex] || null;
        break;
      }
    }

    return lastFolder;
  } catch (error) {
    return null;
  }
}

function getNextFolderForPosting(folders, lastFolder) {
  if (folders.length === 0) {
    return null;
  }

  // 1. 날짜 기반 매칭 (오늘 날짜 YYYY-MM-DD)
  const now = new Date();
  const koreaTime = new Date(now.getTime() + (9 * 60 * 60 * 1000));
  const todayString = koreaTime.toISOString().split('T')[0];

  const todayFolder = folders.find(f => f.includes(todayString));
  if (todayFolder) {
    return todayFolder;
  }

  // 2. 순환 로직 (기존 방식)
  if (!lastFolder) {
    return folders[0];
  }

  const currentIndex = folders.indexOf(lastFolder);
  if (currentIndex === -1) {
    return folders[0];
  }

  const nextIndex = (currentIndex + 1) % folders.length;
  return folders[nextIndex];
}

async function saveToLatestPostingSheet(client, postData, normalizedSubdomain, folderName, env) {
  const accessToken = await getGoogleAccessTokenForPosting(env);
  const now = new Date();
  const koreaTime = new Date(now.getTime() + (9 * 60 * 60 * 1000));
  const timestamp = koreaTime.toISOString().replace('T', ' ').substring(0, 19);
  const domain = `${normalizedSubdomain}.make-page.com`;

  const archiveSheetName = env.ARCHIVE_SHEET_NAME || '저장소';
  const latestSheetName = env.LATEST_POSTING_SHEET_NAME || '최신 포스팅';

  // 데이터 객체 (컬럼명: 값)
  const postDataMap = {
    '도메인': domain,
    '상호명': client.business_name,
    '제목': postData.title,
    '생성일시': timestamp,
    '언어': client.language || 'ko',
    '업종': client.industry || '',
    '폴더명': folderName || '',
    '본문': postData.body || '',
    '이미지': postData.images || ''
  };

  // 1. 저장소 탭 헤더 읽기
  const archiveHeaderResponse = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${env.SHEETS_ID}/values/${encodeURIComponent(archiveSheetName)}!1:1`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  const archiveHeaderData = await archiveHeaderResponse.json();
  const archiveHeaders = (archiveHeaderData.values && archiveHeaderData.values[0]) || [];

  // 헤더 순서대로 rowData 생성
  const archiveRowData = archiveHeaders.map(header => postDataMap[header] || '');

  // 저장소 탭에 append
  const archiveAppendResponse = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${env.SHEETS_ID}/values/${encodeURIComponent(archiveSheetName)}!A:Z:append?valueInputOption=RAW`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ values: [archiveRowData] })
    }
  );

  if (!archiveAppendResponse.ok) {
    const errorText = await archiveAppendResponse.text();
    throw new Error(`저장소 시트 append 실패: ${archiveAppendResponse.status} - ${errorText}`);
  }

  // 2. 최신 포스팅 탭 읽기 (헤더 포함)
  const getResponse = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${env.SHEETS_ID}/values/${encodeURIComponent(latestSheetName)}!A:Z`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  const getData = await getResponse.json();
  const rows = getData.values || [];

  if (rows.length < 1) {
    return; // 헤더 없으면 종료
  }

  const latestHeaders = rows[0];
  const domainIndex = latestHeaders.indexOf('도메인');
  const createdAtIndex = latestHeaders.indexOf('생성일시');

  if (domainIndex === -1 || createdAtIndex === -1) {
    throw new Error('최신 포스팅 시트에 필수 컬럼(도메인, 생성일시)이 없습니다');
  }

  // 3. 해당 도메인의 행들 찾기
  const domainRows = [];
  for (let i = 1; i < rows.length; i++) {
    if (rows[i][domainIndex] === domain) {
      domainRows.push({ index: i + 1, createdAt: rows[i][createdAtIndex] || '' });
    }
  }

  // 4. 2개 이상이면 가장 오래된 행 삭제
  if (domainRows.length >= 2) {
    domainRows.sort((a, b) => (a.createdAt || '').localeCompare(b.createdAt || ''));
    const oldestRowIndex = domainRows[0].index;

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
                sheetId: await getSheetId(env.SHEETS_ID, latestSheetName, accessToken),
                dimension: 'ROWS',
                startIndex: oldestRowIndex - 1,
                endIndex: oldestRowIndex
              }
            }
          }]
        })
      }
    );
  }

  // 5. 최신 포스팅 탭에 append (헤더 순서대로)
  const latestRowData = latestHeaders.map(header => postDataMap[header] || '');

  const latestAppendResponse = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${env.SHEETS_ID}/values/${encodeURIComponent(latestSheetName)}!A:Z:append?valueInputOption=RAW`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ values: [latestRowData] })
    }
  );

  if (!latestAppendResponse.ok) {
    const errorText = await latestAppendResponse.text();
    throw new Error(`최신 포스팅 시트 append 실패: ${latestAppendResponse.status} - ${errorText}`);
  }

  // 6. 관리자 시트의 열 너비를 가져와서 저장소/최신 포스팅 시트에 적용
  const archiveSheetId = await getSheetId(env.SHEETS_ID, archiveSheetName, accessToken);
  const latestSheetId = await getSheetId(env.SHEETS_ID, latestSheetName, accessToken);

  // 관리자 시트(첫 번째 시트) 정보 가져오기
  const spreadsheetResponse = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${env.SHEETS_ID}?fields=sheets(properties,data.columnMetadata.pixelSize)`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  const spreadsheetData = await spreadsheetResponse.json();

  // 첫 번째 시트(관리자 시트)의 열 너비 가져오기
  const mainSheet = spreadsheetData.sheets[0];
  const columnWidths = mainSheet.data && mainSheet.data[0] && mainSheet.data[0].columnMetadata
    ? mainSheet.data[0].columnMetadata.map(col => col.pixelSize || 100)
    : [];

  // 열 너비 적용 요청 생성 (처음 9개 열만)
  const updateRequests = [];
  for (let i = 0; i < Math.min(9, columnWidths.length); i++) {
    updateRequests.push(
      {
        updateDimensionProperties: {
          range: {
            sheetId: archiveSheetId,
            dimension: 'COLUMNS',
            startIndex: i,
            endIndex: i + 1
          },
          properties: {
            pixelSize: columnWidths[i]
          },
          fields: 'pixelSize'
        }
      },
      {
        updateDimensionProperties: {
          range: {
            sheetId: latestSheetId,
            dimension: 'COLUMNS',
            startIndex: i,
            endIndex: i + 1
          },
          properties: {
            pixelSize: columnWidths[i]
          },
          fields: 'pixelSize'
        }
      }
    );
  }

  if (updateRequests.length > 0) {
    await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${env.SHEETS_ID}:batchUpdate`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ requests: updateRequests })
      }
    );
  }
}

async function getSheetId(sheetsId, sheetName, accessToken) {
  const response = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${sheetsId}?fields=sheets(properties(sheetId,title))`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  const data = await response.json();
  const sheet = data.sheets.find(s => s.properties.title === sheetName);
  return sheet ? sheet.properties.sheetId : 0;
}