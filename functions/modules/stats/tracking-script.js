// 페이지 방문 추적 스크립트 템플릿
// 클라이언트 사이드에서 Firestore에 직접 기록

function generateTrackingScript(subdomain) {
  return `
    <script>
      (function() {
        const subdomain = '${subdomain}';
        const apiUrl = '/api/track-visit';
        const loadTime = Date.now();

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

        // 체류 시간 기록
        function trackDuration() {
          const duration = Date.now() - loadTime;

          // 1초 미만은 무시
          if (duration < 1000) return;

          const data = {
            subdomain: subdomain,
            timestamp: Date.now(),
            duration: duration,
            path: window.location.pathname
          };

          // sendBeacon 사용 (페이지 떠날 때도 전송 보장)
          if (navigator.sendBeacon) {
            navigator.sendBeacon(apiUrl, JSON.stringify(data));
          } else {
            fetch(apiUrl, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(data),
              keepalive: true
            }).catch(err => console.log('[Tracking] Duration tracking failed'));
          }
        }

        // 페이지 로드 시 방문 기록
        if (document.readyState === 'loading') {
          document.addEventListener('DOMContentLoaded', trackVisit);
        } else {
          trackVisit();
        }

        // 페이지 떠날 때 체류 시간 기록
        window.addEventListener('beforeunload', trackDuration);

        // 페이지 숨김 시에도 기록 (모바일 대응)
        document.addEventListener('visibilitychange', function() {
          if (document.visibilityState === 'hidden') {
            trackDuration();
          }
        });
      })();
    </script>
  `;
}

module.exports = { generateTrackingScript };
