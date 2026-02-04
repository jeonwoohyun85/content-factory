// 포스팅 생성 (Gemini Pro)

const { callVertexGemini } = require('../gemini-api.js');

async function generatePostWithClaudeForPosting(client, trendsData, images, env) {

  const hasImages = images.length > 0;

  const imageCount = images.length;



  const prompt = hasImages ? `

[거래처 정보]

- 업체명: ${client.business_name}

- 언어: ${client.language}

- **핵심 주제 및 소개 (필수 반영): ${client.description}**



[트렌드 정보]

${trendsData}



[제공된 이미지]

총 ${imageCount}장의 이미지를 첨부했습니다. 각 이미지를 자세히 확인하고 순서대로 설명하세요.



[작성 규칙]

0. **포스팅 전체(제목과 본문)를 반드시 ${client.language}로 작성** (최우선 필수)

1. 제목: **'${client.description}'의 핵심 내용을 반영**하여 매력적으로 작성 (완전 자유 창작)

2. 본문 전체 글자수: **공백 포함 2800~3200자** (필수)

3. 본문 구조: **반드시 ${imageCount}개의 문단으로 작성**

   - 1번째 이미지 → 1번째 문단

   - 2번째 이미지 → 2번째 문단

   - ...

   - ${imageCount}번째 이미지 → ${imageCount}번째 문단

4. 각 문단: 해당 순서의 이미지에서 보이는 내용을 간결하게 설명

   - 이미지 속 색상, 분위기, 사물, 사람, 액션 등을 묘사

   - **각 문단은 공백 포함 약 280~320자 내외로 작성**

   - **[트렌드 정보]는 문단당 1~2문장 정도만 간결하게 배경 설명으로 활용**

5. 문단 구분: 문단 사이에 빈 줄 2개 (\\n\\n)로 명확히 구분

6. 금지어: 최고, 1등, 유일, 검증된

7. 금지 창작: 경력, 학력, 자격증, 수상

8. **본문의 모든 내용은 '${client.description}'의 주제와 자연스럽게 연결되어야 함 (최우선 순위)**

9. **간결하고 핵심적인 표현 사용 - 장황한 설명 금지**

10. **상호명(${client.business_name})을 본문에 1~2회 자연스럽게 언급** (필수)



출력 형식 (JSON):

{

  "title": "제목",

  "body": "문단1\\n\\n문단2\\n\\n문단3\\n\\n..."

}



중요: body는 정확히 ${imageCount}개의 문단으로 구성되어야 하며, '${client.description}'의 내용이 포스팅의 중심이 되어야 합니다.

` : `

[거래처 정보]

- 업체명: ${client.business_name}

- 언어: ${client.language}

- **핵심 주제 및 소개 (필수 반영): ${client.description}**



[트렌드 정보]

${trendsData}



[제공된 이미지]

이미지가 제공되지 않았습니다. 텍스트만으로 작성해주세요.



[작성 규칙]

0. **포스팅 전체(제목과 본문)를 반드시 ${client.language}로 작성** (최우선 필수)

1. 제목: **'${client.description}'의 핵심 내용을 반영**하여 매력적으로 작성 (완전 자유 창작)

2. 본문 전체 글자수: **공백 포함 2800~3200자** (필수)

3. 본문 구조: **8~10개의 문단으로 작성** (이미지 없음)

   - 각 문단은 '${client.description}' 주제의 다양한 측면을 다룸

   - [트렌드 정보]를 활용하여 흥미롭게 작성

4. 각 문단:

   - **각 문단은 공백 포함 약 280~320자 내외로 작성**

   - **[트렌드 정보]를 적극 활용하여 풍부한 내용 구성**

5. 문단 구분: 문단 사이에 빈 줄 2개 (\\n\\n)로 명확히 구분

6. 금지어: 최고, 1등, 유일, 검증된

7. 금지 창작: 경력, 학력, 자격증, 수상

8. **본문의 모든 내용은 '${client.description}'의 주제와 자연스럽게 연결되어야 함 (최우선 순위)**

9. **간결하고 핵심적인 표현 사용 - 장황한 설명 금지**

10. **상호명(${client.business_name})을 본문에 1~2회 자연스럽게 언급** (필수)



출력 형식 (JSON):

{

  "title": "제목",

  "body": "문단1\\n\\n문단2\\n\\n문단3\\n\\n..."

}



중요: 이미지 없이 텍스트만으로 매력적인 포스팅을 작성하며, '${client.description}'의 내용이 포스팅의 중심이 되어야 합니다.

`;



  try {

    const result = await callVertexGemini(prompt, 'gemini-2.5-pro', 8192, 0.7, images);



    console.log("Gemini response:", result.substring(0, 500));
    // Remove markdown code blocks
    let cleanResult = result.replace(/```json\s*/g, '').replace(/```\s*/g, '');
    console.log("Clean result:", cleanResult.substring(0, 500));
    const jsonMatch = cleanResult.match(/\{[\s\S]*\}/);
    console.log("JSON match:", jsonMatch ? "Found" : "Not found");

    if (jsonMatch) {
      try {
        return JSON.parse(jsonMatch[0]);
      } catch (parseError) {
        console.error("JSON parse error:", parseError.message);
        console.error("Matched JSON:", jsonMatch[0].substring(0, 1000));
        throw new Error(`JSON parse failed: ${parseError.message}`);
      }
    }



    throw new Error('Failed to parse Gemini response');

  } catch (error) {

    console.error(`generatePostWithClaudeForPosting 에러: ${error.message}`);

    throw error;

  }

}

module.exports = { generatePostWithClaudeForPosting };
