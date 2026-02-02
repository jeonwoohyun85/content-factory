// 시스템 상태 페이지

import { fetchWithTimeout } from './utils.js';
import { getGoogleAccessTokenForPosting } from './auth.js';

export async function generateStatusPage(env) {
  try {
    const accessToken = await getGoogleAccessTokenForPosting(env);

    // 관리자 시트 읽기
    const adminResponse = await fetchWithTimeout(
      `https://sheets.googleapis.com/v4/spreadsheets/${env.SHEETS_ID}/values/${encodeURIComponent("'관리자'!A:Q")}`,
      { headers: { Authorization: `Bearer ${accessToken}` } },
      10000
    );

    if (!adminResponse.ok) {
      const errorText = await adminResponse.text();
      throw new Error(`관리자 시트 읽기 실패: ${adminResponse.status} ${adminResponse.statusText} - ${errorText}`);
    }

    const adminText = await adminResponse.text();
    if (!adminText || adminText.trim() === '') {
      throw new Error('관리자 시트 응답이 비어있음');
    }

    const adminData = JSON.parse(adminText);
    const adminRows = adminData.values || [];

    // 최신 포스팅 시트 읽기
    const latestResponse = await fetchWithTimeout(
      `https://sheets.googleapis.com/v4/spreadsheets/${env.SHEETS_ID}/values/${encodeURIComponent("'최신 포스팅'!A:K")}`,
      { headers: { Authorization: `Bearer ${accessToken}` } },
      10000
    );

    if (!latestResponse.ok) {
      const errorText = await latestResponse.text();
      throw new Error(`최신 포스팅 시트 읽기 실패: ${latestResponse.status} ${latestResponse.statusText} - ${errorText}`);
    }

    const latestText = await latestResponse.text();
    if (!latestText || latestText.trim() === '') {
      throw new Error('최신 포스팅 시트 응답이 비어있음');
    }

    const latestData = JSON.parse(latestText);
    const latestRows = latestData.values || [];

    // 활성 도메인 수집
    const activeDomains = [];
    if (adminRows.length > 1) {
      for (let i = 1; i < adminRows.length; i++) {
        const row = adminRows[i];
        if (row[1] === '활성') {
          activeDomains.push({
            domain: row[0],
            name: row[3],
            language: row[7],
            industry: row[9]
          });
        }
      }
    }

    // 최근 포스팅 수집
    const recentPosts = [];
    if (latestRows.length > 1) {
      for (let i = 1; i < Math.min(latestRows.length, 11); i++) {
        const row = latestRows[i];
        recentPosts.push({
          domain: row[0],
          name: row[1],
          title: row[2],
          createdAt: row[3]
        });
      }
    }

    const html = `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>크론 상태 - Content Factory</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      background: #f5f5f5;
      padding: 20px;
    }
    .container {
      max-width: 1200px;
      margin: 0 auto;
      background: white;
      border-radius: 12px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
      padding: 30px;
    }
    h1 {
      font-size: 28px;
      margin-bottom: 10px;
      color: #333;
    }
    .subtitle {
      color: #666;
      margin-bottom: 30px;
    }
    .section {
      margin-bottom: 40px;
    }
    h2 {
      font-size: 20px;
      margin-bottom: 15px;
      color: #444;
      border-bottom: 2px solid #4CAF50;
      padding-bottom: 8px;
    }
    .stats {
      display: flex;
      gap: 20px;
      margin-bottom: 20px;
    }
    .stat-card {
      flex: 1;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 20px;
      border-radius: 8px;
      text-align: center;
    }
    .stat-number {
      font-size: 36px;
      font-weight: bold;
      margin-bottom: 5px;
    }
    .stat-label {
      font-size: 14px;
      opacity: 0.9;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 15px;
    }
    th, td {
      padding: 12px;
      text-align: left;
      border-bottom: 1px solid #eee;
    }
    th {
      background: #f8f9fa;
      font-weight: 600;
      color: #555;
    }
    tr:hover {
      background: #f8f9fa;
    }
    .domain-link {
      color: #667eea;
      text-decoration: none;
      font-weight: 500;
    }
    .domain-link:hover {
      text-decoration: underline;
    }
    .badge {
      display: inline-block;
      padding: 4px 8px;
      border-radius: 4px;
      font-size: 12px;
      font-weight: 500;
    }
    .badge-active {
      background: #d4edda;
      color: #155724;
    }
    .timestamp {
      color: #999;
      font-size: 14px;
    }
    .footer {
      margin-top: 30px;
      padding-top: 20px;
      border-top: 1px solid #eee;
      text-align: center;
      color: #999;
      font-size: 14px;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>📊 크론 시스템 상태</h1>
    <p class="subtitle">Content Factory 자동 포스팅 모니터링</p>

    <div class="stats">
      <div class="stat-card">
        <div class="stat-number">${activeDomains.length}</div>
        <div class="stat-label">활성 도메인</div>
      </div>
      <div class="stat-card" style="background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);">
        <div class="stat-number">${recentPosts.length}</div>
        <div class="stat-label">최근 포스팅</div>
      </div>
    </div>

    <div class="section">
      <h2>🎯 크론 등록 도메인</h2>
      <table>
        <thead>
          <tr>
            <th>도메인</th>
            <th>상호명</th>
            <th>언어</th>
            <th>업종</th>
            <th>상태</th>
          </tr>
        </thead>
        <tbody>
          ${activeDomains.map(d => `
            <tr>
              <td><a href="https://${d.domain}" target="_blank" class="domain-link">${d.domain}</a></td>
              <td>${d.name}</td>
              <td>${d.language}</td>
              <td>${d.industry}</td>
              <td><span class="badge badge-active">활성</span></td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>

    <div class="section">
      <h2>📝 최근 포스팅</h2>
      <table>
        <thead>
          <tr>
            <th>도메인</th>
            <th>상호명</th>
            <th>제목</th>
            <th>생성일시</th>
          </tr>
        </thead>
        <tbody>
          ${recentPosts.map(p => `
            <tr>
              <td><a href="https://${p.domain}" target="_blank" class="domain-link">${p.domain}</a></td>
              <td>${p.name}</td>
              <td>${p.title}</td>
              <td class="timestamp">${p.createdAt}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>

    <div class="footer">
      마지막 업데이트: ${new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })} KST
    </div>
  </div>
</body>
</html>`;

    return new Response(html, {
      headers: { 'Content-Type': 'text/html; charset=utf-8' }
    });

  } catch (error) {
    console.error('[ERROR] Status page generation failed:', error);
    return new Response(`<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>오류 - Content Factory</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      background: #f5f5f5;
      padding: 40px 20px;
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 100vh;
    }
    .error-box {
      background: white;
      border-radius: 12px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
      padding: 30px;
      max-width: 600px;
    }
    h1 {
      color: #d32f2f;
      margin-bottom: 15px;
    }
    .error-message {
      background: #ffebee;
      color: #c62828;
      padding: 15px;
      border-radius: 8px;
      font-family: monospace;
      word-break: break-all;
    }
  </style>
</head>
<body>
  <div class="error-box">
    <h1>⚠️ 상태 페이지 로딩 실패</h1>
    <div class="error-message">${error.message}</div>
  </div>
</body>
</html>`, {
      status: 500,
      headers: { 'Content-Type': 'text/html; charset=utf-8' }
    });
  }
}
