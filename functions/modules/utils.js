// 범용 유틸리티 함수

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
  
  // CSV 파싱 검증 (R8-1)
  if (inQuotes) {
    console.error('[CSV Parse Error] Unclosed quotes detected in line:', line.substring(0, 100));
  }

  return result;

}

function normalizeClient(client) {
  // 완전 동적: 모든 컬럼을 그대로 유지하되 별칭만 추가
  const normalized = { ...client };

  // 영문 별칭 추가 (기존 코드 호환성)
  if (client['도메인']) normalized.subdomain = client['도메인'];
  if (client['서브도메인']) normalized.subdomain = client['서브도메인'];
  if (client['상호명']) normalized.business_name = client['상호명'];
  if (client['주소']) normalized.address = client['주소'];
  if (client['언어']) normalized.language = client['언어'];
  if (client['연락처']) normalized.phone = client['연락처'];
  if (client['영업시간']) normalized.business_hours = client['영업시간'];
  if (client['거래처_정보']) normalized.description = client['거래처_정보'];
  if (client['업종']) normalized.industry = client['업종'];
  if (client['구독']) normalized.subscription = client['구독'];
  if (client['폴더명']) normalized.folder_name = client['폴더명'];
  if (client['우마미']) normalized.umami_id = client['우마미'];
  if (client['우마미_공유']) normalized.umami_share = client['우마미_공유'];
  if (client['바로가기']) normalized.links = client['바로가기'];

  return normalized;
}

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



  if (url.includes('smartstore.naver.com') || url.includes('brand.naver.com')) {

    return { icon: '🛒', text: texts.store, url };

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



  if (url === '/stats' || url.includes('umami')) {

    return { icon: '📊', text: texts.stats, url };

  }



  return { icon: '🔗', text: texts.link, url };

}

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

function extractUrlFromMarkdown(text) {

  if (!text) return text;

  const match = text.match(/\[.*?\]\((https?:\/\/[^\)]+)\)/);

  return match ? match[1] : text;

}

function getColumnLetter(index) {

  let letter = '';

  while (index >= 0) {

    letter = String.fromCharCode((index % 26) + 65) + letter;

    index = Math.floor(index / 26) - 1;

  }

  return letter;

}

// 폴더명 정규화 (R4-3)
function normalizeFolderName(name) {
  if (!name) return '';
  return name.trim().toLowerCase();
}

// 상호명에서 언어 표시 자동 제거
function removeLanguageSuffixFromBusinessName(businessName) {
  if (!businessName) return businessName;

  const suffixes = [' Japan', ' 日本', ' japan', ' Korea', ' 한국', ' China', ' 中国', ' English', ' Japanese', ' 일본어', ' Thailand'];
  for (const suffix of suffixes) {
    if (businessName.endsWith(suffix)) {
      return businessName.slice(0, -suffix.length).trim();
    }
  }
  return businessName;
}



// 서브도메인 정규화 (중복 코드 통합)
function normalizeSubdomain(subdomain) {
  if (!subdomain) return '';
  return subdomain.replace('.make-page.com', '').replace('/', '').trim();
}
module.exports = { fetchWithTimeout, escapeHtml, normalizeLanguage, parseCSV, parseCSVLine, normalizeClient, normalizeSubdomain, formatKoreanTime, getLinkInfo, convertToEmbedUrl, extractUrlFromMarkdown, getColumnLetter, normalizeFolderName, removeLanguageSuffixFromBusinessName };
