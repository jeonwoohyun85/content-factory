// Analytics 추적 모듈
// Firestore 기반 방문 통계 수집

const { Firestore, FieldValue } = require('@google-cloud/firestore');
const firestore = new Firestore({
  projectId: process.env.GCP_PROJECT || 'content-factory-1770105623'
});

// KST 시간 헬퍼
function getKSTNow() {
  const now = new Date();
  const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
  const kst = new Date(utc + (9 * 60 * 60 * 1000));
  return kst;
}

function getKSTDateString(date = null) {
  const kst = date || getKSTNow();
  const year = kst.getFullYear();
  const month = String(kst.getMonth() + 1).padStart(2, '0');
  const day = String(kst.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getKSTMonthString(date = null) {
  const kst = date || getKSTNow();
  const year = kst.getFullYear();
  const month = String(kst.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

// IP 주소 추출
function getClientIP(req) {
  return req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
         req.headers['x-real-ip'] ||
         req.connection?.remoteAddress ||
         'unknown';
}

// 국가 코드 추출 (IP 범위 기반)
function getCountryCode(req) {
  // Cloudflare 헤더 우선
  if (req.headers['cf-ipcountry']) {
    return req.headers['cf-ipcountry'];
  }

  const ip = getClientIP(req);

  // 로컬/내부 IP
  if (ip === 'unknown' || ip.startsWith('127.') || ip.startsWith('192.168.') || ip.startsWith('10.') || ip.startsWith('172.')) {
    return 'UNKNOWN';
  }

  // IP 첫 옥텟으로 간단 판별
  const first = parseInt(ip.split('.')[0]);

  // 한국 주요 ISP (KT, SK, LG)
  if ([1, 14, 27, 39, 49, 58, 59, 60, 61, 101, 103, 106, 110, 112, 113, 114, 115, 116, 117, 118, 119, 121, 122, 123, 124, 125, 168, 175, 180, 182, 183, 203, 210, 211, 218, 220, 221, 222].includes(first)) {
    return 'KR';
  }

  // 미국
  if ([3, 4, 6, 7, 8, 9, 11, 12, 13, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 28, 29, 30, 32, 33, 34, 35, 38, 40, 44, 45, 47, 48, 50, 52, 53, 54, 55, 56, 63, 64, 65, 66, 67, 68, 69, 70, 71, 72, 73, 74, 75, 76, 96, 97, 98, 99, 100, 104, 107, 108, 128, 129, 130, 131, 132, 134, 135, 136, 137, 138, 139, 140, 142, 143, 144, 146, 147, 148, 149, 150, 151, 152, 153, 155, 156, 157, 158, 159, 160, 161, 162, 163, 164, 165, 166, 167, 169, 170, 172, 173, 174, 184, 192, 198, 199, 204, 205, 206, 207, 208, 209, 216].includes(first)) {
    return 'US';
  }

  // 일본
  if ([126, 133, 153, 202, 210, 218, 219, 220, 221].includes(first)) {
    return 'JP';
  }

  // 중국
  if ([36, 42, 58, 59, 60, 61, 101, 103, 106, 110, 111, 112, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 124, 125, 175, 180, 182, 183, 202, 203, 210, 211, 218, 219, 220, 221, 222].includes(first)) {
    return 'CN';
  }

  return 'UNKNOWN';
}

// 디바이스 타입 추출
function getDeviceType(userAgent) {
  if (!userAgent) return 'unknown';
  const ua = userAgent.toLowerCase();

  if (/(tablet|ipad|playbook|silk)|(android(?!.*mobi))/i.test(ua)) {
    return 'tablet';
  }
  if (/mobile|iphone|ipod|android|blackberry|opera mini|windows phone/i.test(ua)) {
    return 'mobile';
  }
  return 'desktop';
}

// 브라우저 추출
function getBrowser(userAgent) {
  if (!userAgent) return 'unknown';
  const ua = userAgent.toLowerCase();

  if (ua.includes('samsungbrowser')) return 'Samsung Internet';
  if (ua.includes('edg/')) return 'Edge';
  if (ua.includes('chrome')) return 'Chrome';
  if (ua.includes('safari') && !ua.includes('chrome')) return 'Safari';
  if (ua.includes('firefox')) return 'Firefox';
  if (ua.includes('opera') || ua.includes('opr/')) return 'Opera';

  return 'other';
}

// Referer 파싱
function getReferrer(req) {
  const referer = req.headers['referer'] || req.headers['referrer'];
  if (!referer) return 'direct';

  try {
    const url = new URL(referer);
    return url.hostname.replace('www.', '');
  } catch (e) {
    return 'direct';
  }
}

// 방문 추적
async function trackVisit(subdomain, req) {
  const db = firestore;
  const ip = getClientIP(req);
  const today = getKSTDateString();
  const month = getKSTMonthString();
  const country = getCountryCode(req);
  const userAgent = req.headers['user-agent'] || '';
  const device = getDeviceType(userAgent);
  const browser = getBrowser(userAgent);
  const referrer = getReferrer(req);

  const analyticsRef = db.collection('analytics').doc(subdomain);

  try {
    // 1. 페이지뷰 (무조건 카운트)
    await analyticsRef.set({
      pageviews: FieldValue.increment(1),
      lastUpdate: FieldValue.serverTimestamp()
    }, { merge: true });

    // 2. 순 방문자 체크 (IP + 날짜 기준)
    const visitorKey = `${subdomain}_${today}_${ip}`;
    const visitorRef = db.collection('visitors').doc(visitorKey);
    const visitorDoc = await visitorRef.get();

    if (!visitorDoc.exists) {
      // 오늘 처음 방문
      await visitorRef.set({
        subdomain,
        ip,
        date: today,
        timestamp: FieldValue.serverTimestamp()
      });

      // 순 방문자 카운트
      await analyticsRef.update({
        uniqueVisitors: FieldValue.increment(1)
      });
    }

    // 3. 월별 방문
    await analyticsRef.set({
      monthly: {
        [month]: FieldValue.increment(1)
      }
    }, { merge: true });

    // 4. 국가별
    await analyticsRef.set({
      countries: {
        [country]: FieldValue.increment(1)
      }
    }, { merge: true });

    // 5. 디바이스별
    await analyticsRef.set({
      devices: {
        [device]: FieldValue.increment(1)
      }
    }, { merge: true });

    // 6. 브라우저별
    await analyticsRef.set({
      browsers: {
        [browser]: FieldValue.increment(1)
      }
    }, { merge: true });

    // 7. 유입 경로별
    await analyticsRef.set({
      referrers: {
        [referrer]: FieldValue.increment(1)
      }
    }, { merge: true });

  } catch (error) {
    console.error('Analytics tracking error:', error);
    // 에러 발생해도 페이지는 정상 표시
  }
}

// 통계 데이터 조회
async function getStats(subdomain) {
  const db = firestore;
  const analyticsRef = db.collection('analytics').doc(subdomain);

  try {
    const doc = await analyticsRef.get();

    if (!doc.exists) {
      return {
        pageviews: 0,
        uniqueVisitors: 0,
        monthly: {},
        countries: {},
        devices: {},
        browsers: {},
        referrers: {}
      };
    }

    return doc.data();
  } catch (error) {
    console.error('Get stats error:', error);
    return null;
  }
}

// 오늘 방문자 조회
async function getTodayVisitors(subdomain) {
  const db = firestore;
  const today = getKSTDateString();

  try {
    const snapshot = await db.collection('visitors')
      .where('subdomain', '==', subdomain)
      .where('date', '==', today)
      .count()
      .get();

    return snapshot.data().count;
  } catch (error) {
    console.error('Get today visitors error:', error);
    return 0;
  }
}

module.exports = {
  trackVisit,
  getStats,
  getTodayVisitors,
  getKSTNow,
  getKSTDateString,
  getClientIP,
  getCountryCode
};
