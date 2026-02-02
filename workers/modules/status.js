// 크론 헬스체크 페이지

export async function generateStatusPage(env) {
  try {
    // KV에서 하트비트 및 상태 정보 읽기
    const heartbeat = await env.POSTING_KV.get('cron_heartbeat');
    const lastSuccess = await env.POSTING_KV.get('cron_last_success');
    const lastError = await env.POSTING_KV.get('cron_last_error');

    const now = Date.now();
    const heartbeatTime = heartbeat ? parseInt(heartbeat) : 0;
    const successTime = lastSuccess ? parseInt(lastSuccess) : 0;

    // 25시간 = 90000000 밀리초
    const THRESHOLD = 25 * 60 * 60 * 1000;
    const isHealthy = (now - heartbeatTime) < THRESHOLD;

    // 상태 메시지
    const statusColor = isHealthy ? '#4CAF50' : '#f44336';
    const statusIcon = isHealthy ? '🟢' : '🔴';
    const statusText = isHealthy ? '정상 작동' : '크론 실행 안됨';

    // 시간 포맷 함수
    const formatTime = (timestamp) => {
      if (!timestamp) return '기록 없음';
      const date = new Date(timestamp);
      return date.toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' }) + ' KST';
    };

    // 경과 시간 계산
    const getElapsedTime = (timestamp) => {
      if (!timestamp) return '-';
      const elapsed = now - timestamp;
      const hours = Math.floor(elapsed / (1000 * 60 * 60));
      const minutes = Math.floor((elapsed % (1000 * 60 * 60)) / (1000 * 60));
      return `${hours}시간 ${minutes}분 전`;
    };

    const html = `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>크론 시스템 상태 - Content Factory</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      min-height: 100vh;
      display: flex;
      justify-content: center;
      align-items: center;
      padding: 20px;
    }
    .container {
      background: white;
      border-radius: 20px;
      box-shadow: 0 20px 60px rgba(0,0,0,0.3);
      padding: 50px;
      max-width: 600px;
      width: 100%;
      text-align: center;
    }
    .status-icon {
      font-size: 120px;
      margin-bottom: 20px;
      animation: pulse 2s ease-in-out infinite;
    }
    @keyframes pulse {
      0%, 100% { transform: scale(1); }
      50% { transform: scale(1.05); }
    }
    h1 {
      font-size: 36px;
      color: #333;
      margin-bottom: 10px;
    }
    .status-text {
      font-size: 24px;
      font-weight: bold;
      color: ${statusColor};
      margin-bottom: 40px;
    }
    .info-box {
      background: #f8f9fa;
      border-radius: 12px;
      padding: 20px;
      margin-bottom: 15px;
      text-align: left;
    }
    .info-label {
      font-size: 14px;
      color: #666;
      margin-bottom: 5px;
    }
    .info-value {
      font-size: 16px;
      color: #333;
      font-weight: 500;
    }
    .info-elapsed {
      font-size: 12px;
      color: #999;
      margin-top: 3px;
    }
    .footer {
      margin-top: 30px;
      padding-top: 20px;
      border-top: 1px solid #eee;
      color: #999;
      font-size: 14px;
    }
    ${!isHealthy ? `
    .alert {
      background: #ffebee;
      border-left: 4px solid #f44336;
      padding: 15px;
      margin-bottom: 20px;
      border-radius: 8px;
      text-align: left;
    }
    .alert-title {
      color: #c62828;
      font-weight: bold;
      margin-bottom: 5px;
    }
    .alert-text {
      color: #d32f2f;
      font-size: 14px;
    }
    ` : ''}
  </style>
</head>
<body>
  <div class="container">
    <div class="status-icon">${statusIcon}</div>
    <h1>크론 시스템</h1>
    <div class="status-text">${statusText}</div>

    ${!isHealthy ? `
    <div class="alert">
      <div class="alert-title">⚠️ 경고</div>
      <div class="alert-text">25시간 이상 크론이 실행되지 않았습니다. 시스템을 확인하세요.</div>
    </div>
    ` : ''}

    <div class="info-box">
      <div class="info-label">마지막 크론 실행</div>
      <div class="info-value">${formatTime(heartbeatTime)}</div>
      <div class="info-elapsed">${getElapsedTime(heartbeatTime)}</div>
    </div>

    <div class="info-box">
      <div class="info-label">마지막 성공 시간</div>
      <div class="info-value">${formatTime(successTime)}</div>
      <div class="info-elapsed">${getElapsedTime(successTime)}</div>
    </div>

    ${lastError ? `
    <div class="info-box" style="border-left: 3px solid #ff9800;">
      <div class="info-label">마지막 에러</div>
      <div class="info-value" style="color: #f57c00; font-size: 14px; word-break: break-all;">${JSON.parse(lastError).error}</div>
      <div class="info-elapsed">${formatTime(JSON.parse(lastError).time)}</div>
    </div>
    ` : ''}

    <div class="footer">
      페이지 업데이트: ${new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })} KST
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
