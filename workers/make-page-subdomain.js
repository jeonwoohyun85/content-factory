// Content Factory - Minimal Version (Google Sheets Only)
// 거래처 페이지만 제공 (랜딩페이지, 블로그, Supabase 전부 제거)

const GOOGLE_SHEETS_CSV_URL = 'https://docs.google.com/spreadsheets/d/1KrzLFi8Wt9GTGT97gcMoXnbZ3OJ04NsP4lncJyIdyhU/export?format=csv&gid=0';

// ==================== 유틸리티 함수 ====================

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
  return text.toString().replace(/[&<>"']/g, m => map[m]);
}

// CSV 파싱 (큰따옴표로 감싸진 필드 처리)
function parseCSV(csvText) {
  const lines = csvText.trim().split('\n');

  // 헤더 파싱
  const headers = parseCSVLine(lines[0]);

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

// Google Sheets에서 거래처 정보 조회
async function getClientFromSheets(clientId, env) {
  try {
    const response = await fetchWithTimeout(GOOGLE_SHEETS_CSV_URL, {}, 10000);
    const csvText = await response.text();
    const clients = parseCSV(csvText);

    const client = clients.find(c => {
      // subdomain 정규화: "00001.make-page.com" → "00001"
      let normalizedSubdomain = c.subdomain;
      if (normalizedSubdomain.includes('.make-page.com')) {
        normalizedSubdomain = normalizedSubdomain.replace('.make-page.com', '').replace('/', '');
      }
      return normalizedSubdomain === clientId;
    });

    // Posts 조회 추가
    if (client) {
      client.posts = await getRecentPosts(clientId, env);
    }

    return client;
  } catch (error) {
    console.error('Google Sheets fetch error:', error);
    return null;
  }
}

// UTC 시간을 한국 시간으로 변환
function formatKoreanTime(isoString) {
  if (!isoString) return '';

  try {
    const date = new Date(isoString);
    // UTC+9 (한국 시간)
    const koreaTime = new Date(date.getTime() + (9 * 60 * 60 * 1000));

    const year = koreaTime.getUTCFullYear();
    const month = String(koreaTime.getUTCMonth() + 1).padStart(2, '0');
    const day = String(koreaTime.getUTCDate()).padStart(2, '0');
    const hours = String(koreaTime.getUTCHours()).padStart(2, '0');
    const minutes = String(koreaTime.getUTCMinutes()).padStart(2, '0');

    return `${year}-${month}-${day} ${hours}:${minutes}`;
  } catch (error) {
    return isoString;
  }
}

// Posts 시트에서 최근 포스팅 3개 조회
async function getRecentPosts(subdomain, env) {
  try {
    // Service Account로 Posts 시트 조회
    const serviceAccount = JSON.parse(env.GOOGLE_SERVICE_ACCOUNT_JSON);

    // JWT 생성
    const jwtHeader = btoa(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
    const now = Math.floor(Date.now() / 1000);
    const jwtClaimSet = {
      iss: serviceAccount.client_email,
      scope: 'https://www.googleapis.com/auth/spreadsheets.readonly',
      aud: 'https://oauth2.googleapis.com/token',
      exp: now + 3600,
      iat: now
    };

    const jwtClaimSetEncoded = btoa(JSON.stringify(jwtClaimSet));
    const signatureInput = `${jwtHeader}.${jwtClaimSetEncoded}`;

    // Sign JWT
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

    // Get access token
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`
    });

    const tokenData = await tokenResponse.json();
    const accessToken = tokenData.access_token;

    // Posts 시트 데이터 조회
    const response = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${env.SHEETS_ID}/values/Posts!A:H`,
      {
        headers: { Authorization: `Bearer ${accessToken}` }
      }
    );

    if (!response.ok) {
      return [];
    }

    const data = await response.json();
    const rows = data.values || [];

    if (rows.length < 2) {
      return [];
    }

    const headers = rows[0];
    const subdomainIndex = headers.indexOf('subdomain');
    const businessNameIndex = headers.indexOf('business_name');
    const languageIndex = headers.indexOf('language');
    const titleIndex = headers.indexOf('title');
    const bodyIndex = headers.indexOf('body');
    const createdAtIndex = headers.indexOf('created_at');
    const imagesIndex = headers.indexOf('images');

    // subdomain으로 필터링
    const posts = [];
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      if (row[subdomainIndex] === subdomain) {
        posts.push({
          subdomain: row[subdomainIndex],
          business_name: row[businessNameIndex],
          language: row[languageIndex],
          title: row[titleIndex],
          body: row[bodyIndex],
          created_at: row[createdAtIndex],
          images: row[imagesIndex] || ''
        });
      }
    }

    // created_at 기준 내림차순 정렬 (최신순)
    posts.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    // 최근 3개 반환
    return posts.slice(0, 3);
  } catch (error) {
    console.error('Posts fetch error:', error);
    return [];
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

async function updatePostsHeader(env) {
  const serviceAccount = JSON.parse(env.GOOGLE_SERVICE_ACCOUNT_JSON);
  const jwtHeader = btoa(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const now = Math.floor(Date.now() / 1000);
  const jwtClaimSet = {
    iss: serviceAccount.client_email,
    scope: 'https://www.googleapis.com/auth/spreadsheets',
    aud: 'https://oauth2.googleapis.com/token',
    exp: now + 3600,
    iat: now
  };

  const jwtClaimSetEncoded = btoa(JSON.stringify(jwtClaimSet));
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

  const tokenData = await tokenResponse.json();
  const accessToken = tokenData.access_token;

  // 1. 시트 컬럼 8개로 확장
  const expandResponse = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${env.SHEETS_ID}:batchUpdate`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        requests: [{
          updateSheetProperties: {
            properties: {
              sheetId: 1895987712,
              gridProperties: {
                columnCount: 8
              }
            },
            fields: 'gridProperties.columnCount'
          }
        }]
      })
    }
  );

  if (!expandResponse.ok) {
    const errorText = await expandResponse.text();
    throw new Error(`Failed to expand columns: ${errorText}`);
  }

  // 2. H1에 헤더 추가
  const headers = [['images']];

  const headerResponse = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${env.SHEETS_ID}/values/Posts!H1?valueInputOption=RAW`,
    {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ values: headers })
    }
  );

  if (!headerResponse.ok) {
    const errorText = await headerResponse.text();
    throw new Error(`Failed to update header: ${errorText}`);
  }

  return {
    success: true,
    message: 'Posts sheet expanded and header updated with images column'
  };
}

async function generatePosting(subdomain, env) {
  const response = await fetch('https://posting-generator.jeonwoohyun85.workers.dev/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ subdomain })
  });

  return await response.json();
}

// 기존 CSV 파싱 코드 제거
async function getRecentPostsOLD_CSV(subdomain) {
  try {
    // Posts 시트 CSV 조회 (gid=1895987712)
    const POSTS_SHEET_GID = '1895987712';
    const postsUrl = `https://docs.google.com/spreadsheets/d/${SHEETS_ID}/export?format=csv&gid=${POSTS_SHEET_GID}`;

    const response = await fetch(postsUrl);
    if (!response.ok) {
      return [];
    }

    const csvText = await response.text();
    const rows = csvText.split('\n').map(row => {
      const cols = [];
      let current = '';
      let inQuotes = false;
      for (let i = 0; i < row.length; i++) {
        const char = row[i];
        if (char === '"') {
          inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
          cols.push(current.trim());
          current = '';
        } else {
          current += char;
        }
      }
      cols.push(current.trim());
      return cols;
    });

    if (rows.length < 2) {
      return [];
    }

    const headers = rows[0];
    const subdomainIndex = headers.indexOf('subdomain');
    const businessNameIndex = headers.indexOf('business_name');
    const languageIndex = headers.indexOf('language');
    const titleIndex = headers.indexOf('title');
    const bodyIndex = headers.indexOf('body');
    const createdAtIndex = headers.indexOf('created_at');
    const imagesIndex = headers.indexOf('images');

    // subdomain으로 필터링
    const posts = [];
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      if (row[subdomainIndex] === subdomain) {
        posts.push({
          subdomain: row[subdomainIndex],
          business_name: row[businessNameIndex],
          language: row[languageIndex],
          title: row[titleIndex],
          body: row[bodyIndex],
          created_at: row[createdAtIndex],
          images: row[imagesIndex] || ''
        });
      }
    }

    // created_at 기준 내림차순 정렬 (최신순)
    posts.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    // 최근 3개 반환
    return posts.slice(0, 3);
  } catch (error) {
    console.error('Posts fetch error:', error);
    return [];
  }
}

// 링크 타입 자동 감지
function getLinkInfo(url) {
  if (!url) return null;

  url = url.trim();

  if (url.startsWith('tel:')) {
    return { icon: '📞', text: '전화하기', url };
  }

  if (url.includes('instagram.com')) {
    return { icon: '📷', text: '인스타그램', url };
  }

  if (url.includes('youtube.com') || url.includes('youtu.be')) {
    return { icon: '▶️', text: '유튜브', url };
  }

  if (url.includes('facebook.com')) {
    return { icon: '👥', text: '페이스북', url };
  }

  if (url.includes('pf.kakao.com') || url.includes('talk.kakao')) {
    return { icon: '💬', text: '카카오톡', url };
  }

  if (url.includes('map.naver.com') || url.includes('naver.me')) {
    return { icon: '📍', text: '위치보기', url };
  }

  if (url.includes('maps.google.com') || url.includes('goo.gl/maps')) {
    return { icon: '📍', text: '위치보기', url };
  }

  if (url.includes('map.kakao.com')) {
    return { icon: '📍', text: '위치보기', url };
  }

  if (url.includes('blog.naver.com')) {
    return { icon: '📝', text: '블로그', url };
  }

  if (url.includes('tistory.com')) {
    return { icon: '📝', text: '블로그', url };
  }

  if (url.includes('booking') || url.includes('reserve')) {
    return { icon: '📅', text: '예약하기', url };
  }

  return { icon: '🔗', text: '링크', url };
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
function generatePostPage(client, post) {
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
<html lang="ko">
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
        <a href="/" class="back-button">← ${escapeHtml(client.business_name)} 홈으로</a>

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
function generateClientPage(client) {
  // Links 파싱 (쉼표 구분)
  const links = (client.links || '').split(',').map(l => l.trim()).filter(l => l).map(getLinkInfo).filter(l => l);

  // Info 이미지 파싱 (쉼표 구분)
  let infoImages = (client.info || '').split(',').map(i => i.trim()).filter(i => i);

  // 랜덤으로 섞고 최대 6개만 선택
  if (infoImages.length > 6) {
    infoImages = infoImages.sort(() => Math.random() - 0.5).slice(0, 6);
  }

  // Video 파싱 (쉼표 구분)
  const videoUrls = (client.video || '').split(',').map(v => v.trim()).filter(v => v).map(convertToEmbedUrl).filter(v => v);

  // Posts 파싱 (최근 3개)
  const posts = (client.posts || []).slice(0, 3);

  // 전화번호 링크 추가
  if (client.phone && !links.some(l => l.url.includes(client.phone))) {
    links.unshift({ icon: '📞', text: '전화하기', url: `tel:${client.phone}` });
  }

  return `<!DOCTYPE html>
<html lang="ko">
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
            grid-template-columns: repeat(3, 1fr);
            gap: 24px;
        }

        @media (max-width: 768px) {
            .posts-grid {
                grid-template-columns: repeat(1, 1fr);
            }
        }

        .post-card {
            background: #fff;
            border: 1px solid #e2e8f0;
            border-radius: 8px;
            padding: 24px;
            transition: transform 0.3s, box-shadow 0.3s;
        }

        .post-card:hover {
            transform: translateY(-4px);
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
        }

        .post-title {
            font-size: 20px;
            font-weight: 700;
            color: #1a1a1a;
            margin-bottom: 12px;
            line-height: 1.4;
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
            height: 100%;
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
    ${infoImages.length > 0 ? '<section><h2 class="section-title">Info</h2><div class="gallery-grid">' + infoImages.map((img, index) => '<div class="gallery-item" onclick="openLightbox(' + index + ')"><img src="' + escapeHtml(img) + '" alt="Info" class="gallery-image"></div>').join('') + '</div></section>' : ''}

    <!-- Video Section -->
    ${videoUrls.length > 0 ? '<section><h2 class="section-title">Video</h2><div class="video-grid">' + videoUrls.map(url => '<div class="video-item"><iframe src="' + escapeHtml(url) + '" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe></div>').join('') + '</div></section>' : ''}

    <!-- Posts Section -->
    ${posts.length > 0 ? '<section><h2 class="section-title">Posts</h2><div class="posts-grid">' + posts.map(post => '<a href="/post?id=' + encodeURIComponent(post.created_at) + '" style="text-decoration: none; color: inherit;"><article class="post-card"><h3 class="post-title">' + escapeHtml(post.title) + '</h3><p class="post-body">' + escapeHtml((post.body || '').substring(0, 200)) + '...</p><time class="post-date">' + escapeHtml(formatKoreanTime(post.created_at)) + '</time></article></a>').join('') + '</div></section>' : ''}

    <!-- Lightbox -->
    <div id="lightbox" class="lightbox" onclick="closeLightbox()">
        <span class="lightbox-close" onclick="closeLightbox()">&times;</span>
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
            if (e.key === 'Escape') closeLightbox();
            if (e.key === 'ArrowRight') nextImage();
            if (e.key === 'ArrowLeft') prevImage();
        });
    </script>
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

async function handleSitemap() {
  try {
    // Google Sheets에서 활성 거래처 조회
    const response = await fetchWithTimeout(GOOGLE_SHEETS_CSV_URL, {}, 10000);
    const csvText = await response.text();
    const clients = parseCSV(csvText);

    const activeClients = clients.filter(client => client.status === 'active');

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

// ==================== 라우팅 ====================

export default {
  async fetch(request, env) {
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
        return handleSitemap();
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
      // Update Posts header
      if (pathname === '/update-posts-header') {
        try {
          const result = await updatePostsHeader(env);
          return new Response(JSON.stringify(result), {
            status: 200,
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
      // Generate posting
      if (pathname === '/generate-posting' && request.method === 'POST') {
        try {
          const { subdomain } = await request.json();
          const result = await generatePosting(subdomain, env);
          return new Response(JSON.stringify(result), {
            status: 200,
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
      // Google Sheets에서 거래처 정보 조회
      const client = await getClientFromSheets(subdomain, env);

      if (!client) {
        return new Response('Not Found', { status: 404 });
      }

      // 비활성 거래처는 표시 안함
      if (client.status !== 'active') {
        return new Response('This page is inactive', { status: 403 });
      }

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

        return new Response(generatePostPage(client, post), {
          headers: {
            'Content-Type': 'text/html; charset=utf-8',
            'Cache-Control': 'public, max-age=300'
          }
        });
      }

      // 거래처 페이지 생성
      return new Response(generateClientPage(client), {
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
