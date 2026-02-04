// Rate Limiting (Firestore 기반)

const RATE_LIMITS = {
  '/test-posting': { maxRequests: 5, windowMs: 60000 }, // 1분에 5회
  '/refresh': { maxRequests: 10, windowMs: 60000 }      // 1분에 10회
};

async function checkRateLimit(ip, endpoint, env) {
  const config = RATE_LIMITS[endpoint];
  if (!config) return { allowed: true };

  const key = `ratelimit:${endpoint}:${ip}`;
  const now = Date.now();

  try {
    const docRef = env.POSTING_KV.collection('rate-limits').doc(key);
    const doc = await docRef.get();

    if (!doc.exists) {
      // 첫 요청
      await docRef.set({
        count: 1,
        resetAt: now + config.windowMs,
        firstRequestAt: now
      });
      return { allowed: true, remaining: config.maxRequests - 1 };
    }

    const data = doc.data();

    // 윈도우 만료 확인
    if (now > data.resetAt) {
      // 새 윈도우 시작
      await docRef.set({
        count: 1,
        resetAt: now + config.windowMs,
        firstRequestAt: now
      });
      return { allowed: true, remaining: config.maxRequests - 1 };
    }

    // 현재 윈도우 내
    if (data.count >= config.maxRequests) {
      const retryAfter = Math.ceil((data.resetAt - now) / 1000);
      return {
        allowed: false,
        remaining: 0,
        retryAfter,
        resetAt: data.resetAt
      };
    }

    // 카운트 증가
    await docRef.update({
      count: data.count + 1
    });

    return {
      allowed: true,
      remaining: config.maxRequests - data.count - 1
    };

  } catch (error) {
    console.error('Rate limit check error:', error);
    // 에러 시 허용 (안전)
    return { allowed: true };
  }
}

function getRateLimitHeaders(result) {
  const headers = {};
  if (result.remaining !== undefined) {
    headers['X-RateLimit-Remaining'] = result.remaining.toString();
  }
  if (result.retryAfter !== undefined) {
    headers['Retry-After'] = result.retryAfter.toString();
  }
  return headers;
}

module.exports = { checkRateLimit, getRateLimitHeaders };
