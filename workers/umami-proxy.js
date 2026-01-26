/**
 * Umami Analytics Proxy Worker
 * caps-umami.fly.dev를 안정적으로 프록시
 * - Cloudflare 글로벌 네트워크를 통한 안정적 접근
 * - 자동 캐싱 및 CORS 처리
 */

export default {
  async fetch(request) {
    const url = new URL(request.url);

    // CORS preflight 처리
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Umami-Cache',
          'Access-Control-Max-Age': '86400',
        }
      });
    }

    // Umami 서버로 프록시
    const umamiUrl = `https://caps-umami.fly.dev${url.pathname}${url.search}`;

    // 요청 헤더 복사
    const headers = new Headers(request.headers);
    headers.delete('Host');
    headers.delete('CF-Connecting-IP');
    headers.delete('CF-Ray');

    try {
      const response = await fetch(umamiUrl, {
        method: request.method,
        headers: headers,
        body: request.method !== 'GET' && request.method !== 'HEAD' ? await request.arrayBuffer() : undefined,
        cf: {
          cacheTtl: url.pathname === '/script.js' ? 86400 : 300, // script.js는 24시간, 나머지는 5분 캐싱
          cacheEverything: true,
        }
      });

      // 응답 헤더 복사 및 CORS 추가
      const responseHeaders = new Headers(response.headers);
      responseHeaders.set('Access-Control-Allow-Origin', '*');
      responseHeaders.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      responseHeaders.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Umami-Cache');

      // 캐싱 헤더 개선
      if (url.pathname === '/script.js') {
        responseHeaders.set('Cache-Control', 'public, max-age=86400, stale-while-revalidate=604800');
      }

      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: responseHeaders,
      });
    } catch (error) {
      console.error('Umami proxy error:', error);

      // 에러 발생 시 더 자세한 정보 제공
      return new Response(JSON.stringify({
        error: 'Umami service temporarily unavailable',
        message: error.message,
        timestamp: new Date().toISOString()
      }), {
        status: 502,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Cache-Control': 'no-cache',
        }
      });
    }
  },
};
