// 웹 검색 (Gemini Flash)

const { callVertexGemini } = require('../gemini-api.js');

async function searchWithClaudeForPosting(client, env) {

  const prompt = `

[업종] ${client.industry || client.business_name}

[언어] ${client.language}



다음 정보를 500자 이내로 작성:

1. ${client.language} 시장의 최신 트렌드

2. 검색 키워드 상위 5개

3. 소비자 관심사



출력 형식: 텍스트만 (JSON 불필요)

`;



  try {

    const result = await callVertexGemini(prompt, 'gemini-2.5-flash', 1024);

    return result;

  } catch (error) {

    console.error(`searchWithClaudeForPosting 에러: ${error.message}`);

    throw error;

  }

}

module.exports = { searchWithClaudeForPosting };
