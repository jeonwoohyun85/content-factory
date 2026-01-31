// KV 캐시 함수

export async function getCachedHTML(key, env) {
  try {
    return await env.POSTING_KV.get(`html_${key}`);
  } catch (error) {
    return null;
  }
}

export async function setCachedHTML(key, html, env) {
  try {
    await env.POSTING_KV.put(`html_${key}`, html, { expirationTtl: 86400 });
  } catch (error) {
    console.error('Cache error:', error);
  }
}

