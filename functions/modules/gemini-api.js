// Gemini API 호출 모듈 (generativelanguage.googleapis.com)

const { fetchWithTimeout } = require('./utils/http-utils.js');

// Gemini API 헬퍼 함수 (Multimodal 지원 + Google Search grounding)
async function callVertexGemini(prompt, model = 'gemini-2.5-flash', maxTokens = 1024, temperature = 0.7, images = [], apiKey, useWebSearch = false) {
    // API Key 확인
    if (!apiKey) {
        throw new Error('Gemini API Key required');
    }

    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

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

    const requestBody = {
        contents: [{
            role: 'user',
            parts: parts
        }],
        generationConfig: {
            maxOutputTokens: maxTokens,
            temperature: temperature
        }
    };

    // Google Search grounding 활성화
    if (useWebSearch) {
        requestBody.tools = [{
            googleSearch: {}
        }];
    }

    const response = await fetchWithTimeout(
        endpoint,
        {
            method: 'POST',
            headers: {
                'x-goog-api-key': apiKey,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(requestBody)
        },
        120000
    );

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Gemini API failed: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
}

module.exports = { callVertexGemini };
