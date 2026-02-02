// 번역 KV 캐싱

export async function translateWithCache(fields, targetLanguage, subdomain, env) {
  // KV 캐시 키 생성
  const cacheKey = `translation:${subdomain}:${targetLanguage}`;

  try {
    // 1. KV에서 캐시 확인
    const cached = await env.POSTING_KV.get(cacheKey, 'json');

    if (cached) {
      console.log(`[Translation Cache] HIT: ${cacheKey}`);
      return cached;
    }

    console.log(`[Translation Cache] MISS: ${cacheKey}`);

    // 2. 캐시 없음 - Claude API 호출
    const fieldsJson = fields.map(f => `  "${f.key}": ${JSON.stringify(f.value)}`).join(',\n');
    const prompt = `Translate the following text to ${targetLanguage}. Return ONLY a valid JSON object with the exact same keys, no markdown:\n\n{\n${fieldsJson}\n}\n\nIMPORTANT: Return ONLY the JSON object.`;

    const response = await fetch(
      'https://api.anthropic.com/v1/messages',
      {
        method: 'POST',
        headers: {
          'x-api-key': env.ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json'
        },
        body: JSON.stringify({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 1024,
          messages: [{
            role: 'user',
            content: [{ type: 'text', text: prompt }]
          }]
        })
      }
    );

    if (!response.ok) {
      throw new Error(`Claude API failed: ${response.status}`);
    }

    const data = await response.json();
    const text = data.content?.[0]?.text || '';
    const jsonMatch = text.match(/\{[\s\S]*\}/);

    if (!jsonMatch) {
      throw new Error('No JSON in Claude response');
    }

    const translations = JSON.parse(jsonMatch[0]);

    // 3. KV에 저장 (TTL 없음 - 영구 저장)
    await env.POSTING_KV.put(cacheKey, JSON.stringify(translations));
    console.log(`[Translation Cache] SAVED: ${cacheKey}`);

    return translations;

  } catch (error) {
    console.error(`[Translation Cache] ERROR: ${error.message}`);
    // 에러 시 빈 객체 반환 (원본 유지)
    return {};
  }
}
