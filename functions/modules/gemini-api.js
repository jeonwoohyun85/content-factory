// Vertex AI Gemini API 호출 모듈

const { GoogleAuth } = require('google-auth-library');
const { fetchWithTimeout } = require('./utils.js');

// Vertex AI Gemini API 헬퍼 함수 (Multimodal 지원)
async function callVertexGemini(prompt, model = 'gemini-2.5-flash', maxTokens = 1024, temperature = 0.7, images = []) {
    const auth = new GoogleAuth({
        scopes: ['https://www.googleapis.com/auth/cloud-platform']
    });
    const client = await auth.getClient();
    const accessToken = await client.getAccessToken();

    const projectId = process.env.GCP_PROJECT || 'content-factory-1770105623';
    const location = 'us-central1';
    const endpoint = `https://${location}-aiplatform.googleapis.com/v1/projects/${projectId}/locations/${location}/publishers/google/models/${model}:generateContent`;

    // parts 배열 구성: 텍스트 + 이미지들
    const parts = [{ text: prompt }];

    // 이미지가 있으면 추가
    if (images && images.length > 0) {
        for (const image of images) {
            parts.push({
                inline_data: {
                    mime_type: image.mimeType || 'image/jpeg',
                    data: image.data
                }
            });
        }
    }

    const response = await fetchWithTimeout(
        endpoint,
        {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${accessToken.token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                contents: [{
                    role: 'user',
                    parts: parts
                }],
                generationConfig: {
                    maxOutputTokens: maxTokens,
                    temperature: temperature
                }
            })
        },
        120000
    );

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Vertex AI Gemini failed: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
}

module.exports = { callVertexGemini };
