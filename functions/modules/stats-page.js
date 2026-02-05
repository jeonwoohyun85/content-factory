// 통계 페이지 HTML 생성 모듈

const { getKSTNow } = require('./analytics');

// 국가 이름 매핑
const countryNames = {
  'KR': '🇰🇷 대한민국',
  'US': '🇺🇸 미국',
  'JP': '🇯🇵 일본',
  'CN': '🇨🇳 중국',
  'TW': '🇹🇼 대만',
  'HK': '🇭🇰 홍콩',
  'SG': '🇸🇬 싱가포르',
  'TH': '🇹🇭 태국',
  'VN': '🇻🇳 베트남',
  'ID': '🇮🇩 인도네시아',
  'IN': '🇮🇳 인도',
  'BR': '🇧🇷 브라질',
  'RU': '🇷🇺 러시아',
  'DE': '🇩🇪 독일',
  'FR': '🇫🇷 프랑스',
  'GB': '🇬🇧 영국',
  'CA': '🇨🇦 캐나다',
  'AU': '🇦🇺 호주',
  'UNKNOWN': '🌐 알 수 없음'
};

// 유입 경로 아이콘
const referrerIcons = {
  'direct': '🔗 직접 방문',
  'google.com': '🔍 google.com',
  'naver.com': '🔍 naver.com',
  'daum.net': '🔍 daum.net',
  'yahoo.com': '🔍 yahoo.com',
  'bing.com': '🔍 bing.com',
  'youtube.com': '📺 youtube.com',
  'facebook.com': '👥 facebook.com',
  'instagram.com': '📷 instagram.com',
  'twitter.com': '🐦 twitter.com',
  'linkedin.com': '💼 linkedin.com',
  'pinterest.com': '📌 pinterest.com'
};

// 디바이스 아이콘
const deviceIcons = {
  'mobile': '📱 모바일',
  'desktop': '💻 데스크톱',
  'tablet': '📱 태블릿',
  'unknown': '❓ 알 수 없음'
};

// 데이터 리스트 렌더링 (상위 3개 + 접기/펼치기)
function renderDataList(items, prefix, renderItem) {
  if (!items || items.length === 0) {
    return '<li class="data-item"><div class="data-label">데이터 없음</div></li>';
  }

  const top3 = items.slice(0, 3);
  const rest = items.slice(3);

  let html = top3.map(item => `<li class="data-item">${renderItem(item)}</li>`).join('');

  if (rest.length > 0) {
    html += `
      </ul>
      <div class="collapsed-list" id="${prefix}-more">
        <ul class="data-list">
          ${rest.map(item => `<li class="data-item">${renderItem(item)}</li>`).join('')}
        </ul>
      </div>
      <button class="toggle-btn" onclick="toggleSection('${prefix}-more', this)">
        전체 보기 (${items.length}개) ▼
      </button>
      <ul class="data-list" style="display:none;">
    `;
  }

  return html;
}

// 통계 페이지 HTML 생성
function generateStatsHTML(clientName, stats, todayVisitors) {
  const kstNow = getKSTNow();
  const updateTime = kstNow.toLocaleString('ko-KR', { timeZone: 'Asia/Seoul', hour12: false });

  // 데이터 준비
  const pageviews = stats.pageviews || 0;
  const uniqueVisitors = stats.uniqueVisitors || 0;
  const avgTime = 94; // 예시값
  const bounceRate = 28; // 예시값

  // 월별 데이터 (1-12월)
  const monthly = stats.monthly || {};
  const monthNames = ['1월', '2월', '3월', '4월', '5월', '6월', '7월', '8월', '9월', '10월', '11월', '12월'];

  // 국가별 정렬
  const countries = Object.entries(stats.countries || {}).sort((a, b) => b[1] - a[1]);
  const countriesMax = countries[0]?.[1] || 1;

  // 유입 경로 정렬
  const referrers = Object.entries(stats.referrers || {}).sort((a, b) => b[1] - a[1]);
  const referrersMax = referrers[0]?.[1] || 1;

  // 디바이스 정렬
  const devices = Object.entries(stats.devices || {}).sort((a, b) => b[1] - a[1]);
  const devicesTotal = devices.reduce((sum, [_, count]) => sum + count, 0) || 1;

  // 브라우저 정렬
  const browsers = Object.entries(stats.browsers || {}).sort((a, b) => b[1] - a[1]);
  const browsersTotal = browsers.reduce((sum, [_, count]) => sum + count, 0) || 1;

  return `<!DOCTYPE html>
<html lang="ko">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${clientName} - 방문 통계</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: -apple-system, BlinkMacSystemFont, "Malgun Gothic", sans-serif; line-height: 1.6; color: #333; background: #f7fafc; padding: 20px; }
        .container { max-width: 1400px; margin: 0 auto; }
        .header { background: #fff; border-radius: 12px; padding: 32px; margin-bottom: 24px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
        .site-title { font-size: 32px; font-weight: 800; color: #1a1a1a; margin-bottom: 8px; }
        .date-range { font-size: 14px; color: #718096; }
        .update-time { font-size: 12px; color: #a0aec0; margin-top: 4px; }
        .main-stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 16px; margin-bottom: 24px; }
        .stat-card { background: #fff; border-radius: 12px; padding: 24px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); transition: transform 0.2s; }
        .stat-card:hover { transform: translateY(-2px); box-shadow: 0 4px 12px rgba(0,0,0,0.1); }
        .stat-label { font-size: 13px; color: #718096; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 8px; }
        .stat-value { font-size: 36px; font-weight: 800; color: #2d3748; margin-bottom: 8px; }
        .section { background: #fff; border-radius: 12px; padding: 24px; margin-bottom: 24px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
        .section-title { font-size: 18px; font-weight: 700; color: #1a1a1a; margin-bottom: 20px; display: flex; align-items: center; gap: 8px; }
        .monthly-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 20px; }
        .quarter-section { background: #f7fafc; border-radius: 8px; padding: 16px; }
        .quarter-title { font-size: 14px; font-weight: 700; color: #4a5568; margin-bottom: 12px; text-align: center; }
        .month-list { list-style: none; }
        .month-item { background: #fff; border-radius: 6px; padding: 12px 16px; margin-bottom: 8px; display: flex; justify-content: space-between; align-items: center; transition: all 0.3s; }
        .month-item:hover { background: #edf2f7; transform: translateX(4px); }
        .month-item:last-child { margin-bottom: 0; }
        .month-name { font-size: 14px; font-weight: 600; color: #2d3748; }
        .month-count { font-size: 16px; font-weight: 700; color: #667eea; }
        .data-list { list-style: none; }
        .data-item { display: flex; justify-content: space-between; align-items: center; padding: 12px 0; border-bottom: 1px solid #edf2f7; }
        .data-item:last-child { border-bottom: none; }
        .data-label { font-size: 14px; color: #4a5568; display: flex; align-items: center; gap: 8px; }
        .data-value { font-size: 16px; font-weight: 600; color: #2d3748; }
        .data-bar { height: 6px; background: #e2e8f0; border-radius: 3px; margin-top: 6px; overflow: hidden; }
        .data-bar-fill { height: 100%; background: linear-gradient(to right, #667eea, #764ba2); border-radius: 3px; transition: width 0.5s ease-out; }
        .toggle-btn { background: #edf2f7; border: none; padding: 8px 16px; border-radius: 6px; cursor: pointer; font-size: 13px; font-weight: 600; color: #4a5568; margin-top: 12px; transition: all 0.3s; }
        .toggle-btn:hover { background: #e2e8f0; }
        .collapsed-list { max-height: 0; overflow: hidden; transition: max-height 0.3s ease-out; }
        .collapsed-list.show { max-height: 1000px; }
        @media (max-width: 768px) { .monthly-grid { grid-template-columns: 1fr; } }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1 class="site-title">📊 ${clientName} 방문 통계</h1>
            <div class="date-range">전체 기간 통계 (KST 기준)</div>
            <div class="update-time">마지막 업데이트: ${updateTime}</div>
        </div>

        <div class="main-stats">
            <div class="stat-card">
                <div class="stat-label">총 페이지뷰</div>
                <div class="stat-value">${pageviews.toLocaleString()}</div>
            </div>
            <div class="stat-card">
                <div class="stat-label">순 방문자</div>
                <div class="stat-value">${uniqueVisitors.toLocaleString()}</div>
            </div>
            <div class="stat-card">
                <div class="stat-label">오늘 방문자</div>
                <div class="stat-value">${todayVisitors}</div>
            </div>
        </div>

        <div class="section">
            <h2 class="section-title">📅 월별 방문</h2>
            <div class="monthly-grid">
                <div class="quarter-section">
                    <div class="quarter-title">1월 - 4월</div>
                    <ul class="month-list">
                        ${[0, 1, 2, 3].map(i => {
                          const monthKey = new Date().getFullYear() + '-' + String(i + 1).padStart(2, '0');
                          const count = monthly[monthKey] || 0;
                          return `<li class="month-item"><span class="month-name">${monthNames[i]}</span><span class="month-count">${count.toLocaleString()}</span></li>`;
                        }).join('')}
                    </ul>
                </div>
                <div class="quarter-section">
                    <div class="quarter-title">5월 - 8월</div>
                    <ul class="month-list">
                        ${[4, 5, 6, 7].map(i => {
                          const monthKey = new Date().getFullYear() + '-' + String(i + 1).padStart(2, '0');
                          const count = monthly[monthKey] || 0;
                          return `<li class="month-item"><span class="month-name">${monthNames[i]}</span><span class="month-count">${count.toLocaleString()}</span></li>`;
                        }).join('')}
                    </ul>
                </div>
                <div class="quarter-section">
                    <div class="quarter-title">9월 - 12월</div>
                    <ul class="month-list">
                        ${[8, 9, 10, 11].map(i => {
                          const monthKey = new Date().getFullYear() + '-' + String(i + 1).padStart(2, '0');
                          const count = monthly[monthKey] || 0;
                          return `<li class="month-item"><span class="month-name">${monthNames[i]}</span><span class="month-count">${count.toLocaleString()}</span></li>`;
                        }).join('')}
                    </ul>
                </div>
            </div>
        </div>

        <div class="section">
            <h2 class="section-title">🌍 국가별 방문</h2>
            <ul class="data-list">
                ${renderDataList(countries, 'countries', ([code, count]) => {
                  const name = countryNames[code] || code;
                  const percent = Math.round((count / countriesMax) * 100);
                  return `
                    <div style="flex: 1;">
                        <div class="data-label">${name}</div>
                        <div class="data-bar"><div class="data-bar-fill" style="width: ${percent}%;"></div></div>
                    </div>
                    <div class="data-value">${count.toLocaleString()}</div>
                  `;
                })}
            </ul>
        </div>

        <div class="section">
            <h2 class="section-title">🔗 유입 경로</h2>
            <ul class="data-list">
                ${renderDataList(referrers, 'referrers', ([ref, count]) => {
                  const name = referrerIcons[ref] || ref;
                  const percent = Math.round((count / referrersMax) * 100);
                  return `
                    <div style="flex: 1;">
                        <div class="data-label">${name}</div>
                        <div class="data-bar"><div class="data-bar-fill" style="width: ${percent}%;"></div></div>
                    </div>
                    <div class="data-value">${count.toLocaleString()}</div>
                  `;
                })}
            </ul>
        </div>

        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 24px;">
            <div class="section">
                <h2 class="section-title">📱 디바이스</h2>
                <ul class="data-list">
                    ${devices.map(([device, count]) => {
                      const name = deviceIcons[device] || device;
                      const percent = Math.round((count / devicesTotal) * 100);
                      return `<li class="data-item"><div class="data-label">${name}</div><div class="data-value">${count.toLocaleString()} (${percent}%)</div></li>`;
                    }).join('')}
                </ul>
            </div>

            <div class="section">
                <h2 class="section-title">🌐 브라우저</h2>
                <ul class="data-list">
                    ${renderDataList(browsers, 'browsers', ([browser, count]) => {
                      const percent = Math.round((count / browsersTotal) * 100);
                      return `<div class="data-label">${browser}</div><div class="data-value">${count.toLocaleString()} (${percent}%)</div>`;
                    })}
                </ul>
            </div>
        </div>
    </div>

    <script>
        function toggleSection(id, btn) {
            const section = document.getElementById(id);
            if (section.classList.contains('show')) {
                section.classList.remove('show');
                btn.textContent = btn.textContent.replace('접기 ▲', '전체 보기') + ' ▼';
            } else {
                section.classList.add('show');
                btn.textContent = '접기 ▲';
            }
        }
    </script>
</body>
</html>`;
}

module.exports = { generateStatsHTML };
