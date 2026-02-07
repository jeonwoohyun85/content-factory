// 페이지 방문 추적 스크립트 템플릿
// 클라이언트 사이드에서 Firestore에 직접 기록

function generateTrackingScript(subdomain) {
  return `
    <script>
      (function() {
        const subdomain = '${subdomain}';
        const apiUrl = '/api/track-visit';

        // 페이지 방문 기록
        function trackVisit() {
          const data = {
            subdomain: subdomain,
            timestamp: Date.now(),
            userAgent: navigator.userAgent,
            referrer: document.referrer || 'direct',
            path: window.location.pathname
          };

          fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
          }).catch(err => console.log('[Tracking] Visit tracking failed'));
        }

        // 페이지 로드 시 방문 기록
        if (document.readyState === 'loading') {
          document.addEventListener('DOMContentLoaded', trackVisit);
        } else {
          trackVisit();
        }
      })();
    </script>
  `;
}

module.exports = { generateTrackingScript };
