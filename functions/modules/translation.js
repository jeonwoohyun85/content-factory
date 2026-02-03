// Claude API 번역

import { TRANSLATION_CACHE, LANGUAGE_TEXTS } from './config.js';

async function translateWithClaude(language, env) {

  const prompt = `Translate the following UI text items to ${language}. Return ONLY a valid JSON object with these exact keys, no markdown formatting, no code blocks:



{

  "info": "Gallery/Photos section title",

  "video": "Videos section title",

  "posts": "Blog posts section title",

  "backToHome": "Back to home link text",

  "phone": "Call/Phone button",

  "instagram": "Instagram link",

  "youtube": "YouTube link",

  "facebook": "Facebook link",

  "kakao": "KakaoTalk link",

  "location": "Location/Map link",

  "blog": "Blog link",
  "store": "Store/Shop link",

  "booking": "Booking/Reservation button",

  "link": "Generic link text",

  "stats": "Statistics/Analytics link",

  "postImage": "Post/Blog image alt text",

  "galleryImage": "Gallery/Info image alt text"

}



IMPORTANT: Return ONLY the JSON object, no other text.`;



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



  const data = await response.json();

  const text = data.content[0].text;



  // JSON 추출

  const jsonMatch = text.match(/\{[\s\S]*\}/);

  if (jsonMatch) {

    return JSON.parse(jsonMatch[0]);

  }



  // 실패 시 영어 반환

  return LANGUAGE_TEXTS.en;

}

async function getLanguageTexts(langCode, env) {
  // 1. 캐시 확인
  if (TRANSLATION_CACHE[langCode]) {
    return TRANSLATION_CACHE[langCode];
  }

  // 2. 하드코딩된 언어
  if (LANGUAGE_TEXTS[langCode]) {
    return LANGUAGE_TEXTS[langCode];
  }

  // 3. API 호출 (첫 요청만)
  try {
    const texts = await translateWithClaude(langCode, env);
    // 영어 기본값과 병합 (누락된 키 자동 채움)
    const mergedTexts = { ...LANGUAGE_TEXTS.en, ...texts };
    TRANSLATION_CACHE[langCode] = mergedTexts;
    return mergedTexts;
  } catch (error) {
    console.error(`Translation error for ${langCode}:`, error);
    // 실패 시 영어 반환
    return LANGUAGE_TEXTS.en;
  }
}
module.exports = { translateWithClaude,getLanguageTexts };
