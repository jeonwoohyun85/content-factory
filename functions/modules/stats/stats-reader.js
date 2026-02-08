// Firestore 통계 조회 모듈
// 방문자 수, 페이지뷰, 바로가기 링크 클릭 수 조회

async function getVisitStats(subdomain, env, days = 30) {
  try {
    // 전체 누적 통계
    const allSnapshot = await env.POSTING_KV.collection('visits')
      .where('subdomain', '==', subdomain)
      .get();

    const allVisits = allSnapshot.docs.map(doc => doc.data());

    // KST 기준 오늘 시작 시간 (00:00)
    const kstNow = new Date(Date.now() + (9 * 60 * 60 * 1000));
    const todayStart = new Date(kstNow.getFullYear(), kstNow.getMonth(), kstNow.getDate());
    const todayStartTimestamp = todayStart.getTime() - (9 * 60 * 60 * 1000);

    // 오늘 방문 필터링
    const todayVisits = allVisits.filter(v => v.timestamp >= todayStartTimestamp);

    // 전체 방문자 (고유 IP)
    const uniqueVisitors = new Set(allVisits.map(v => v.ip).filter(ip => ip && ip !== 'unknown')).size;

    // 전체 방문 횟수
    const totalPageViews = allVisits.length;

    // 일간 방문 횟수 (오늘)
    const dailyPageViews = todayVisits.length;

    // 체류 시간 누적 합계 (밀리초 → 분)
    const totalDuration = allVisits
      .filter(v => v.duration)
      .reduce((sum, v) => sum + v.duration, 0);
    const totalDurationMinutes = Math.round(totalDuration / 60000);

    // 날짜별 방문 수 (최근 30일, 차트용)
    const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
    const recentVisits = allVisits.filter(v => v.timestamp >= thirtyDaysAgo);

    const dailyStats = {};
    recentVisits.forEach(visit => {
      const kstDate = new Date(visit.timestamp + (9 * 60 * 60 * 1000));
      const date = kstDate.toISOString().split('T')[0];
      if (!dailyStats[date]) {
        dailyStats[date] = { pageViews: 0, visitors: new Set() };
      }
      dailyStats[date].pageViews++;
      if (visit.ip && visit.ip !== 'unknown') {
        dailyStats[date].visitors.add(visit.ip);
      }
    });

    const dailyData = Object.keys(dailyStats).map(date => ({
      date,
      pageViews: dailyStats[date].pageViews,
      visitors: dailyStats[date].visitors.size
    })).sort((a, b) => a.date.localeCompare(b.date));

    // OS별 통계
    const osStats = {};
    allVisits.forEach(visit => {
      const os = parseOS(visit.userAgent);
      osStats[os] = (osStats[os] || 0) + 1;
    });

    // 브라우저별 통계
    const browserStats = {};
    allVisits.forEach(visit => {
      const browser = parseBrowser(visit.userAgent);
      browserStats[browser] = (browserStats[browser] || 0) + 1;
    });

    // 기기별 통계
    const deviceStats = {};
    allVisits.forEach(visit => {
      const device = parseDevice(visit.userAgent);
      deviceStats[device] = (deviceStats[device] || 0) + 1;
    });

    return {
      uniqueVisitors,
      totalPageViews,
      dailyPageViews,
      totalDurationMinutes,
      dailyData,
      osStats,
      browserStats,
      deviceStats
    };
  } catch (error) {
    console.error('Visit stats error:', error);
    return {
      uniqueVisitors: 0,
      totalPageViews: 0,
      dailyPageViews: 0,
      totalDurationMinutes: 0,
      dailyData: []
    };
  }
}

async function getLinkClickStats(subdomain, env, days = 30) {
  const now = Date.now();
  const startTime = now - (days * 24 * 60 * 60 * 1000);

  try {
    const snapshot = await env.POSTING_KV.collection('link_clicks')
      .where('subdomain', '==', subdomain)
      .where('timestamp', '>=', startTime)
      .get();

    const clicks = snapshot.docs.map(doc => doc.data());

    // 링크 타입별 클릭 수
    const clicksByType = {};
    clicks.forEach(click => {
      const type = click.link_type || 'other';
      if (!clicksByType[type]) {
        clicksByType[type] = 0;
      }
      clicksByType[type]++;
    });

    // 배열로 변환하고 정렬
    const linkStats = Object.keys(clicksByType).map(type => ({
      type,
      clicks: clicksByType[type]
    })).sort((a, b) => b.clicks - a.clicks);

    return {
      totalClicks: clicks.length,
      linkStats
    };
  } catch (error) {
    console.error('Link click stats error:', error);
    return {
      totalClicks: 0,
      linkStats: []
    };
  }
}

// User-Agent 파싱 함수들
function parseOS(userAgent) {
  if (!userAgent) return 'other';
  const ua = userAgent.toLowerCase();

  if (ua.includes('android')) return 'Android';
  if (ua.includes('iphone') || ua.includes('ipad') || ua.includes('ipod')) return 'iOS';
  if (ua.includes('windows')) return 'Windows';
  if (ua.includes('macintosh') || ua.includes('mac os')) return 'macOS';
  if (ua.includes('linux') && !ua.includes('android')) return 'Linux';

  return 'other';
}

function parseBrowser(userAgent) {
  if (!userAgent) return 'other';
  const ua = userAgent.toLowerCase();

  // 순서 중요: Edge를 Chrome보다 먼저 체크
  if (ua.includes('samsungbrowser')) return 'Samsung Internet';
  if (ua.includes('edg/') || ua.includes('edge/')) return 'Edge';
  if (ua.includes('firefox')) return 'Firefox';
  if (ua.includes('chrome') && !ua.includes('edg')) return 'Chrome';
  if (ua.includes('safari') && !ua.includes('chrome')) return 'Safari';

  return 'other';
}

function parseDevice(userAgent) {
  if (!userAgent) return 'other';
  const ua = userAgent.toLowerCase();

  if (ua.includes('ipad') || ua.includes('tablet') || (ua.includes('android') && !ua.includes('mobile'))) {
    return 'tablet';
  }
  if (ua.includes('mobile') || ua.includes('iphone') || ua.includes('ipod')) {
    return 'mobile';
  }
  if (ua.includes('smarttv') || ua.includes('tizen') || ua.includes('webos') ||
      ua.includes('playstation') || ua.includes('xbox') || ua.includes('nintendo')) {
    return 'other';
  }

  return 'pc';
}

// 링크 타입 한글 이름 매핑
function getLinkTypeLabel(type) {
  const labels = {
    naver_blog: '네이버 블로그',
    instagram: '인스타그램',
    facebook: '페이스북',
    youtube: '유튜브',
    kakaotalk: '카카오톡',
    phone: '전화',
    email: '이메일',
    stats: '통계',
    naver_place: '네이버 플레이스',
    smartstore: '스마트스토어',
    umami: 'Umami 통계',
    other: '기타'
  };
  return labels[type] || type;
}

module.exports = {
  getVisitStats,
  getLinkClickStats,
  getLinkTypeLabel
};
