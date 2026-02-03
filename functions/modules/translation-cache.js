// 번역 Firestore 캐싱 (Gemini 2.5 Flash)

async function translateWithCache(fields, targetLanguage, subdomain, env) {
  const cacheKey = `translation:${subdomain}:${targetLanguage}`;

  try {
    // 1. Firestore에서 캐시 확인
    const docRef = env.POSTING_KV.collection('translation-cache').doc(cacheKey);
    const doc = await docRef.get();

    if (doc.exists) {
      console.log(`[Translation Cache] HIT: ${cacheKey}`);
      return doc.data().translations;
    }

    console.log(`[Translation Cache] MISS: ${cacheKey}`);

    // 2. 캐시 없음 - Gemini 2.5 Flash API 호출
    const fieldsJson = fields.map(f => `  "${f.key}": ${JSON.stringify(f.value)}`).join(',\n');
    const prompt = `Translate the following text to ${targetLanguage}. Return ONLY a valid JSON object with the exact same keys, no markdown:\n\n{\n${fieldsJson}\n}\n\nIMPORTANT: Return ONLY the JSON object.`;

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${env.GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json'
        },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: prompt
            }]
          }],
          generationConfig: {
            maxOutputTokens: 1024,
            temperature: 0.3
          }
        })
      }
    );

    if (!response.ok) {
      throw new Error(`Gemini API failed: ${response.status}`);
    }

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

    if (!text) {
      throw new Error('No text in Gemini response');
    }

    const jsonMatch = text.match(/\{[\s\S]*\}/);

    if (!jsonMatch) {
      throw new Error('No JSON in Gemini response');
    }

    const translations = JSON.parse(jsonMatch[0]);

    // 3. Firestore에 저장
    await docRef.set({
      translations,
      createdAt: Date.now(),
      subdomain,
      targetLanguage
    });
    console.log(`[Translation Cache] SAVED: ${cacheKey}`);

    return translations;

  } catch (error) {
    console.error(`[Translation Cache] ERROR: ${error.message}`);
    return {};
  }
}

module.exports = { translateWithCache };
