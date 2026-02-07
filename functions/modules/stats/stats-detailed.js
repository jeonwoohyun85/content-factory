// 상세 통계 페이지 (Chart.js 사용)
// 시트의 거래처 바로가기와 Firestore 클릭 통계 연동

const { escapeHtml } = require('../utils/html-utils.js');
const { getVisitStats, getLinkClickStats, getLinkTypeLabel } = require('./stats-reader.js');

// 시트에서 거래처 데이터 조회
async function getClientLinks(subdomain) {
  try {
    const csvUrl = `https://docs.google.com/spreadsheets/d/1KrzLFi8Wt9GTGT97gcMoXnbZ3OJ04NsP4lncJyIdyhU/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent('관리자')}`;

    const response = await fetch(csvUrl);
    const csv = await response.text();

    const lines = csv.split('\n').filter(line => line.trim());
    if (lines.length < 2) return [];

    const headers = lines[0].split(',').map(h => h.replace(/^"|"$/g, '').trim());
    const linksIndex = headers.indexOf('거래처 바로가기');
    const nameIndex = headers.indexOf('거래처 상호명');
    const domainIndex = headers.indexOf('도메인');

    if (linksIndex === -1) return [];

    // 해당 거래처 찾기
    for (let i = 1; i < lines.length; i++) {
      const cells = lines[i].split(',').map(c => c.replace(/^"|"$/g, '').trim());
      const domain = cells[domainIndex] || '';

      if (domain.startsWith(subdomain)) {
        const linksStr = cells[linksIndex] || '';
        const clientName = cells[nameIndex] || subdomain;

        const links = linksStr
          .split(',')
          .map(url => url.trim())
          .filter(url => url && url.startsWith('http'));

        return { clientName, links };
      }
    }

    return { clientName: subdomain, links: [] };
  } catch (error) {
    console.error('Failed to fetch client links:', error);
    return { clientName: subdomain, links: [] };
  }
}

// URL에서 링크 타입 감지
function detectLinkType(url) {
  if (url.includes('blog.naver.com')) return 'naver_blog';
  if (url.includes('instagram.com')) return 'instagram';
  if (url.includes('facebook.com')) return 'facebook';
  if (url.includes('youtube.com') || url.includes('youtu.be')) return 'youtube';
  if (url.includes('map.naver.com') || url.includes('place.map')) return 'naver_place';
  if (url.includes('smartstore.naver.com')) return 'smartstore';
  if (url.includes('umami.is')) return 'umami';
  return 'other';
}

// 링크 타입별 아이콘
function getLinkIcon(type) {
  const icons = {
    naver_blog: '📝',
    instagram: '📷',
    facebook: '👥',
    youtube: '▶️',
    naver_place: '📍',
    smartstore: '🛒',
    umami: '📊',
    other: '🔗'
  };
  return icons[type] || '🔗';
}

async function generateDetailedStatsPage(subdomain, env, days = 30) {
  // 시트에서 거래처 링크 조회
  const { clientName, links } = await getClientLinks(subdomain);

  // Firestore에서 통계 조회
  const visitStats = await getVisitStats(subdomain, env, days);
  const linkClickStats = await getLinkClickStats(subdomain, env, days);

  // 링크별 클릭 수 매핑
  const clicksMap = {};
  linkClickStats.linkStats.forEach(stat => {
    clicksMap[stat.type] = stat.clicks;
  });

  // 시트 링크와 클릭 통계 병합
  const linkData = links.map(url => {
    const type = detectLinkType(url);
    const label = getLinkTypeLabel(type);
    const icon = getLinkIcon(type);
    const clicks = clicksMap[type] || 0;

    return { url, type, label, icon, clicks };
  }).filter(link => link.type !== 'umami'); // Umami 링크 제외

  // 링크 HTML 생성
  const linkListHtml = linkData.length > 0
    ? linkData.map(link => `
      <div class="list-item">
        <span class="list-label">
          <span class="link-icon">${link.icon}</span>
          ${escapeHtml(link.label)}
        </span>
        <span class="list-value">${link.clicks}회</span>
      </div>
    `).join('')
    : `<div class="empty-message">바로가기 링크가 없습니다</div>`;

  // 날짜별 방문자 데이터 (최근 7일)
  const recentDays = visitStats.dailyData.slice(-7);
  const dailyLabels = recentDays.map(d => {
    const date = new Date(d.date);
    return `${date.getMonth() + 1}/${date.getDate()}`;
  });
  const dailyVisitors = recentDays.map(d => d.visitors);

  // 전일 대비 증감률 계산
  const yesterdayVisitors = recentDays.length >= 2 ? recentDays[recentDays.length - 2].visitors : 0;
  const todayVisitors = recentDays.length >= 1 ? recentDays[recentDays.length - 1].visitors : 0;
  const visitorChange = yesterdayVisitors > 0
    ? (((todayVisitors - yesterdayVisitors) / yesterdayVisitors) * 100).toFixed(1)
    : 0;
  const visitorChangeClass = visitorChange >= 0 ? 'up' : 'down';
  const visitorChangeSymbol = visitorChange >= 0 ? '▲' : '▼';

  return `<!DOCTYPE html>
<html lang="ko">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>방문 통계 - ${escapeHtml(clientName)}</title>
    <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js"></script>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Malgun Gothic', '맑은 고딕', sans-serif;
            background: #f5f5f5;
            padding: 20px;
        }
        .container {
            max-width: 1200px;
            margin: 0 auto;
        }
        .header {
            background: white;
            border-radius: 12px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
            padding: 30px;
            margin-bottom: 20px;
        }
        h1 {
            font-size: 28px;
            color: #333;
            margin-bottom: 8px;
        }
        .subtitle {
            color: #666;
            font-size: 14px;
        }
        .stats-grid {
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 16px;
            margin-bottom: 20px;
        }
        .stat-card {
            background: white;
            border-radius: 12px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
            padding: 24px;
            text-align: center;
        }
        .stat-icon {
            font-size: 32px;
            margin-bottom: 12px;
        }
        .stat-label {
            font-size: 13px;
            color: #666;
            margin-bottom: 8px;
        }
        .stat-value {
            font-size: 32px;
            font-weight: bold;
            color: #333;
        }
        .stat-change {
            font-size: 12px;
            margin-top: 8px;
        }
        .stat-change.up {
            color: #10b981;
        }
        .stat-change.down {
            color: #ef4444;
        }
        .chart-section {
            display: grid;
            grid-template-columns: 2fr 1fr;
            gap: 20px;
            margin-bottom: 20px;
        }
        .chart-card {
            background: white;
            border-radius: 12px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
            padding: 30px;
        }
        .chart-title {
            font-size: 18px;
            font-weight: 600;
            color: #333;
            margin-bottom: 20px;
        }
        .bottom-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 20px;
            margin-bottom: 20px;
        }
        .list-item {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 12px 0;
            border-bottom: 1px solid #f0f0f0;
        }
        .list-item:last-child {
            border-bottom: none;
        }
        .list-label {
            font-size: 14px;
            color: #555;
            display: flex;
            align-items: center;
            gap: 8px;
        }
        .list-value {
            font-size: 16px;
            font-weight: 600;
            color: #333;
        }
        .link-icon {
            font-size: 18px;
        }
        .empty-message {
            text-align: center;
            padding: 40px 20px;
            color: #999;
        }
        .back-link {
            display: inline-block;
            padding: 12px 24px;
            background: #667eea;
            color: white;
            text-decoration: none;
            border-radius: 8px;
            font-weight: 600;
            transition: all 0.3s;
        }
        .back-link:hover {
            background: #5568d3;
            transform: translateY(-2px);
        }
        @media (max-width: 1024px) {
            .stats-grid {
                grid-template-columns: repeat(2, 1fr);
            }
            .chart-section {
                grid-template-columns: 1fr;
            }
            .bottom-grid {
                grid-template-columns: 1fr;
            }
        }
        @media (max-width: 480px) {
            .stats-grid {
                grid-template-columns: 1fr;
            }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>📊 ${escapeHtml(clientName)} - 방문 통계</h1>
            <p class="subtitle">거래처 ${escapeHtml(subdomain)} | 최근 ${days}일</p>
        </div>

        <div class="stats-grid">
            <div class="stat-card">
                <div class="stat-icon">👥</div>
                <div class="stat-label">총 방문자</div>
                <div class="stat-value">${visitStats.uniqueVisitors.toLocaleString()}</div>
                <div class="stat-change ${visitorChangeClass}">${visitorChangeSymbol} ${Math.abs(visitorChange)}%</div>
            </div>
            <div class="stat-card">
                <div class="stat-icon">📄</div>
                <div class="stat-label">페이지뷰</div>
                <div class="stat-value">${visitStats.totalPageViews.toLocaleString()}</div>
            </div>
            <div class="stat-card">
                <div class="stat-icon">🔗</div>
                <div class="stat-label">링크 클릭</div>
                <div class="stat-value">${linkClickStats.totalClicks.toLocaleString()}</div>
            </div>
            <div class="stat-card">
                <div class="stat-icon">📱</div>
                <div class="stat-label">평균 일 방문</div>
                <div class="stat-value">${(visitStats.uniqueVisitors / days).toFixed(0)}</div>
            </div>
        </div>

        <div class="chart-section">
            <div class="chart-card">
                <div class="chart-title">📈 일별 방문자 추이</div>
                <canvas id="lineChart"></canvas>
            </div>
            <div class="chart-card">
                <div class="chart-title">🍩 기기별 비율</div>
                <canvas id="doughnutChart"></canvas>
            </div>
        </div>

        <div class="bottom-grid">
            <div class="chart-card">
                <div class="chart-title">🔗 바로가기 링크 클릭</div>
                ${linkListHtml}
            </div>
            <div class="chart-card">
                <div class="chart-title">📊 통계 요약</div>
                <div class="list-item">
                    <span class="list-label">총 방문자</span>
                    <span class="list-value">${visitStats.uniqueVisitors.toLocaleString()}</span>
                </div>
                <div class="list-item">
                    <span class="list-label">총 페이지뷰</span>
                    <span class="list-value">${visitStats.totalPageViews.toLocaleString()}</span>
                </div>
                <div class="list-item">
                    <span class="list-label">총 링크 클릭</span>
                    <span class="list-value">${linkClickStats.totalClicks.toLocaleString()}</span>
                </div>
                <div class="list-item">
                    <span class="list-label">집계 기간</span>
                    <span class="list-value">${days}일</span>
                </div>
            </div>
        </div>

        <a href="/" class="back-link">← 홈으로 돌아가기</a>
    </div>

    <script>
        // 일별 방문자 추이 차트
        const lineCtx = document.getElementById('lineChart').getContext('2d');
        new Chart(lineCtx, {
            type: 'line',
            data: {
                labels: ${JSON.stringify(dailyLabels)},
                datasets: [{
                    label: '방문자',
                    data: ${JSON.stringify(dailyVisitors)},
                    borderColor: '#667eea',
                    backgroundColor: 'rgba(102, 126, 234, 0.1)',
                    tension: 0.4,
                    fill: true
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                plugins: {
                    legend: { display: false }
                },
                scales: {
                    y: { beginAtZero: true }
                }
            }
        });

        // 기기별 비율 차트 (더미 데이터 - 추후 실제 데이터로 교체)
        const doughnutCtx = document.getElementById('doughnutChart').getContext('2d');
        new Chart(doughnutCtx, {
            type: 'doughnut',
            data: {
                labels: ['모바일', 'PC', '태블릿'],
                datasets: [{
                    data: [68, 25, 7],
                    backgroundColor: ['#667eea', '#764ba2', '#f093fb']
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                plugins: {
                    legend: { position: 'bottom' }
                }
            }
        });
    </script>
</body>
</html>`;
}

module.exports = { generateDetailedStatsPage };
