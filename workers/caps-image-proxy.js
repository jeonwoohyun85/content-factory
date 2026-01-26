/**
 * CAPS Image Proxy Worker
 *
 * 목적: Supabase Storage 이미지 CORS 우회 (외부 도메인 접근 허용)
 * 경로: /proxy/image?url={supabase_url}
 */

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // CORS 헤더 설정
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };

    // OPTIONS 요청 처리 (CORS preflight)
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: corsHeaders
      });
    }

    // /proxy/image 경로만 처리
    if (url.pathname === '/proxy/image') {
      const imageUrl = url.searchParams.get('url');

      if (!imageUrl) {
        return new Response(JSON.stringify({ error: 'Missing url parameter' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }

      // Supabase Storage URL만 허용 (보안)
      if (!imageUrl.startsWith('https://tvymimryuwtgsfakuffl.supabase.co/storage/')) {
        return new Response(JSON.stringify({ error: 'Invalid URL domain' }), {
          status: 403,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }

      try {
        // Supabase에서 이미지 가져오기
        const imageResponse = await fetch(imageUrl, {
          headers: {
            'User-Agent': 'CAPS-Image-Proxy/1.0'
          }
        });

        if (!imageResponse.ok) {
          return new Response(JSON.stringify({ error: `Failed to fetch image: ${imageResponse.status}` }), {
            status: imageResponse.status,
            headers: { 'Content-Type': 'application/json', ...corsHeaders }
          });
        }

        // 이미지를 클라이언트에 전달 (캐싱 포함)
        const headers = {
          'Content-Type': imageResponse.headers.get('Content-Type') || 'image/jpeg',
          'Cache-Control': 'public, max-age=31536000, immutable', // 1년 캐싱
          ...corsHeaders
        };

        return new Response(imageResponse.body, {
          status: 200,
          headers
        });

      } catch (error) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: 500,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }
    }

    // 기본 응답
    return new Response(JSON.stringify({
      service: 'CAPS Image Proxy',
      usage: '/proxy/image?url={supabase_storage_url}'
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }
};
