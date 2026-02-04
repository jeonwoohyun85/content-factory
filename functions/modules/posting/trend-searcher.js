// 웹 검색 (Gemini Flash)

const { callVertexGemini } = require('../gemini-api.js');

async function searchWithClaudeForPosting(client, env) {

  const prompt = `

[업종] ${client.industry || client.business_name}

[언어] ${client.language}



다음 정보를 1000자 이내로 작성:

1. ${client.language} 시장의 최신 트렌드 (구체적 예시 포함)

2. 검색 키워드 상위 10개 (인기 검색어 포함)

3. 소비자 관심사 (최근 변화 트렌드)

4. 계절/시즌 관련 키워드 (현재 시기 기준)

5. 주목받는 콘텐츠 주제 (3~5개)



출력 형식: 텍스트만 (JSON 불필요)

`;



  try {

    const result = await callVertexGemini(prompt, 'gemini-2.5-flash', 1024, 0.7, [], env.GEMINI_API_KEY);

    return result;

  } catch (error) {

    console.error(`searchWithClaudeForPosting 에러: ${error.message}`);

    throw error;

  }

}

module.exports = { searchWithClaudeForPosting };
