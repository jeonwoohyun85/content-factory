// Firestore 통계 조회 모듈
// 방문자 수, 페이지뷰, 바로가기 링크 클릭 수 조회

async function getVisitStats(subdomain, env, days = 30) {
  const now = Date.now();
  const startTime = now - (days * 24 * 60 * 60 * 1000);

  try {
    const snapshot = await env.POSTING_KV.collection('visits')
      .where('subdomain', '==', subdomain)
      .where('timestamp', '>=', startTime)
      .get();

    const visits = snapshot.docs.map(doc => doc.data());

    // 총 방문 수 (페이지뷰)
    const totalPageViews = visits.length;

    // 고유 방문자 수 (User-Agent + Referrer 조합으로 추정)
    const uniqueVisitors = new Set(visits.map(v => `${v.userAgent}:${v.referrer}`)).size;

    // 날짜별 방문 수
    const dailyStats = {};
    visits.forEach(visit => {
      const date = new Date(visit.timestamp).toISOString().split('T')[0];
      if (!dailyStats[date]) {
        dailyStats[date] = { pageViews: 0, visitors: new Set() };
      }
      dailyStats[date].pageViews++;
      dailyStats[date].visitors.add(`${visit.userAgent}:${visit.referrer}`);
    });

    const dailyData = Object.keys(dailyStats).map(date => ({
      date,
      pageViews: dailyStats[date].pageViews,
      visitors: dailyStats[date].visitors.size
    })).sort((a, b) => a.date.localeCompare(b.date));

    return {
      totalPageViews,
      uniqueVisitors,
      dailyData
    };
  } catch (error) {
    console.error('Visit stats error:', error);
    return {
      totalPageViews: 0,
      uniqueVisitors: 0,
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
