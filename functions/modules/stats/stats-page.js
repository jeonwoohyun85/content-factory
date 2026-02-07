// 통계 페이지 HTML 생성 (간단 버전)
// Chart.js 없이 간단한 숫자와 표로 표시

const { escapeHtml } = require('../utils/html-utils.js');
const { getVisitStats, getLinkClickStats, getLinkTypeLabel } = require('./stats-reader.js');

async function generateStatsPage(subdomain, env, days = 30) {
  const visitStats = await getVisitStats(subdomain, env, days);
  const linkStats = await getLinkClickStats(subdomain, env, days);

  // 링크 타입별 클릭 수 테이블 생성
  const linkTableRows = linkStats.linkStats.map(stat => `
    <tr>
      <td>${escapeHtml(getLinkTypeLabel(stat.type))}</td>
      <td>${stat.clicks}</td>
    </tr>
  `).join('');

  // 날짜별 방문 통계 테이블 생성 (최근 10일만)
  const recentDailyData = visitStats.dailyData.slice(-10);
  const dailyTableRows = recentDailyData.map(day => `
    <tr>
      <td>${escapeHtml(day.date)}</td>
      <td>${day.pageViews}</td>
      <td>${day.visitors}</td>
    </tr>
  `).join('');

  return `<!DOCTYPE html>
<html lang="ko">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${escapeHtml(subdomain)} - 통계</title>
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
            background: #f7fafc;
            padding: 20px;
        }

        .container {
            max-width: 1200px;
            margin: 0 auto;
            background: #fff;
            border-radius: 12px;
            padding: 40px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
        }

        h1 {
            font-size: 32px;
            font-weight: 700;
            color: #1a1a1a;
            margin-bottom: 12px;
        }

        .subtitle {
            font-size: 16px;
            color: #718096;
            margin-bottom: 40px;
        }

        .stats-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
            gap: 20px;
            margin-bottom: 40px;
        }

        .stat-card {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: #fff;
            padding: 24px;
            border-radius: 8px;
            text-align: center;
        }

        .stat-card.green {
            background: linear-gradient(135deg, #11998e 0%, #38ef7d 100%);
        }

        .stat-card.orange {
            background: linear-gradient(135deg, #fc4a1a 0%, #f7b733 100%);
        }

        .stat-label {
            font-size: 14px;
            opacity: 0.9;
            margin-bottom: 8px;
        }

        .stat-value {
            font-size: 48px;
            font-weight: 700;
        }

        h2 {
            font-size: 24px;
            font-weight: 700;
            color: #1a1a1a;
            margin-bottom: 20px;
            margin-top: 40px;
        }

        table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 40px;
        }

        thead {
            background: #f7fafc;
        }

        th {
            padding: 12px 16px;
            text-align: left;
            font-size: 12px;
            font-weight: 600;
            color: #718096;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            border-bottom: 2px solid #e2e8f0;
        }

        td {
            padding: 16px;
            border-top: 1px solid #e2e8f0;
            color: #4a5568;
        }

        tbody tr:hover {
            background: #f7fafc;
        }

        .back-link {
            display: inline-block;
            margin-top: 40px;
            padding: 12px 24px;
            background: #667eea;
            color: #fff;
            text-decoration: none;
            border-radius: 8px;
            font-weight: 600;
            transition: all 0.3s;
        }

        .back-link:hover {
            background: #5568d3;
            transform: translateY(-2px);
        }

        .empty-message {
            text-align: center;
            padding: 40px 20px;
            color: #718096;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>📊 통계</h1>
        <div class="subtitle">${escapeHtml(subdomain)} - 최근 ${days}일</div>

        <div class="stats-grid">
            <div class="stat-card">
                <div class="stat-label">총 페이지뷰</div>
                <div class="stat-value">${visitStats.totalPageViews}</div>
            </div>
            <div class="stat-card green">
                <div class="stat-label">고유 방문자</div>
                <div class="stat-value">${visitStats.uniqueVisitors}</div>
            </div>
            <div class="stat-card orange">
                <div class="stat-label">총 링크 클릭</div>
                <div class="stat-value">${linkStats.totalClicks}</div>
            </div>
        </div>

        <h2>바로가기 링크 클릭</h2>
        ${linkStats.linkStats.length > 0 ? `
        <table>
            <thead>
                <tr>
                    <th>링크 종류</th>
                    <th>클릭 수</th>
                </tr>
            </thead>
            <tbody>
                ${linkTableRows}
            </tbody>
        </table>
        ` : '<div class="empty-message">아직 링크 클릭 데이터가 없습니다</div>'}

        <h2>최근 10일 방문 통계</h2>
        ${recentDailyData.length > 0 ? `
        <table>
            <thead>
                <tr>
                    <th>날짜</th>
                    <th>페이지뷰</th>
                    <th>방문자</th>
                </tr>
            </thead>
            <tbody>
                ${dailyTableRows}
            </tbody>
        </table>
        ` : '<div class="empty-message">아직 방문 데이터가 없습니다</div>'}

        <a href="/" class="back-link">← 홈으로 돌아가기</a>
    </div>
</body>
</html>`;
}

module.exports = { generateStatsPage };
