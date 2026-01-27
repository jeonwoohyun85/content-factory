// Content Factory - Minimal Version (Google Sheets Only)
// 거래처 페이지만 제공 (랜딩페이지, 블로그, Supabase 전부 제거)

const GOOGLE_SHEETS_CSV_URL = 'https://docs.google.com/spreadsheets/d/1KrzLFi8Wt9GTGT97gcMoXnbZ3OJ04NsP4lncJyIdyhU/export?format=csv&gid=0';
const GEMINI_API_KEY = 'AIzaSyCGaxsMXJ5UvUrU9wQCOH2ou7m9TP2pB88';
const DELETE_PASSWORD = '55000';

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


async function generatePosting(subdomain, env) {
  return await generatePostingForClient(subdomain, env);
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

// (거래처 페이지 생성 및 포스트 상세 페이지 생성 함수는 기존 코드 유지 - 생략)
// ... [이 부분은 너무 길어서 생략, 기존 코드 그대로 유지] ...

async function saveToPostsSheetForPosting(client, postData, folderName, images, env) {
  const accessToken = await getGoogleAccessTokenForPosting(env);

  // 새 포스트 추가
  const imageUrls = images.map(img => `https://drive.google.com/thumbnail?id=${img.id}&sz=w800`).join(',');

  const now = new Date();
  const koreaTime = new Date(now.getTime() + (9 * 60 * 60 * 1000));
  const timestamp = koreaTime.toISOString().replace('T', ' ').substring(0, 19);
  const values = [[
    client.subdomain,
    client.business_name,
    client.language,
    postData.title,
    postData.body,
    timestamp,
    folderName,
    imageUrls
  ]];

  await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${env.SHEETS_ID}/values/Posts!A:H:append?valueInputOption=RAW`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ values })
    }
  );
}
