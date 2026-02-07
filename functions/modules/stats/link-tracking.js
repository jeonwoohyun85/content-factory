// 바로가기 링크 클릭 추적 스크립트
// URL에서 자동으로 타입 감지

function generateLinkTrackingScript(subdomain) {
  return `
    <script>
      (function() {
        const subdomain = '${subdomain}';
        const apiUrl = '/api/track-link';

        // URL에서 링크 타입 자동 감지
        function detectLinkType(url) {
          if (url.includes('blog.naver.com')) return 'naver_blog';
          if (url.includes('instagram.com')) return 'instagram';
          if (url.includes('facebook.com')) return 'facebook';
          if (url.includes('youtube.com') || url.includes('youtu.be')) return 'youtube';
          if (url.includes('map.naver.com') || url.includes('place.map')) return 'naver_place';
          if (url.includes('smartstore.naver.com')) return 'smartstore';
          if (url.includes('kakaotalk') || url.includes('kakao.com')) return 'kakaotalk';
          if (url.includes('tel:')) return 'phone';
          if (url.includes('mailto:')) return 'email';
          if (url.includes('/stats')) return 'stats';
          if (url.includes('umami.is')) return 'umami';
          return 'other';
        }

        // 링크 클릭 추적
        function trackLinkClick(url) {
          const linkType = detectLinkType(url);

          const data = {
            subdomain: subdomain,
            link_type: linkType,
            link_url: url,
            timestamp: Date.now()
          };

          fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
          }).catch(err => console.log('[Tracking] Link tracking failed'));
        }

        // 모든 바로가기 링크에 클릭 이벤트 추가
        function attachLinkTracking() {
          const quickLinks = document.querySelectorAll('.quick-link-item');
          quickLinks.forEach(link => {
            link.addEventListener('click', function(e) {
              const url = this.getAttribute('href');
              if (url) {
                trackLinkClick(url);
              }
            });
          });
        }

        // 페이지 로드 시 이벤트 연결
        if (document.readyState === 'loading') {
          document.addEventListener('DOMContentLoaded', attachLinkTracking);
        } else {
          attachLinkTracking();
        }
      })();
    </script>
  `;
}

module.exports = { generateLinkTrackingScript };
