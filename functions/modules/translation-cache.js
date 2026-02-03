// 번역 Firestore 캐싱 (Vertex AI Gemini 2.5 Flash)

const { GoogleAuth } = require('google-auth-library');

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

    // 2. 캐시 없음 - Vertex AI Gemini 2.5 Flash API 호출
    const fieldsJson = fields.map(f => `  "${f.key}": ${JSON.stringify(f.value)}`).join(',\n');
    const prompt = `Translate the following text to ${targetLanguage}. Return ONLY a valid JSON object with the exact same keys, no markdown:\n\n{\n${fieldsJson}\n}\n\nIMPORTANT: Return ONLY the JSON object.`;

    // OAuth2 토큰 자동 발급
    const auth = new GoogleAuth({
      scopes: ['https://www.googleapis.com/auth/cloud-platform']
    });
    const client = await auth.getClient();
    const accessToken = await client.getAccessToken();

    const projectId = process.env.GCP_PROJECT || 'content-factory-1770105623';
    const location = 'us-central1';
    const endpoint = `https://${location}-aiplatform.googleapis.com/v1/projects/${projectId}/locations/${location}/publishers/google/models/gemini-2.5-flash:generateContent`;

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken.token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        contents: [{
          role: 'user',
          parts: [{ text: prompt }]
        }],
        generationConfig: {
          maxOutputTokens: 1024,
          temperature: 0.3
        }
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Vertex AI Gemini failed: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

    if (!text) {
      throw new Error('No text in Vertex AI response');
    }

    const jsonMatch = text.match(/\{[\s\S]*\}/);

    if (!jsonMatch) {
      throw new Error('No JSON in Vertex AI response');
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
