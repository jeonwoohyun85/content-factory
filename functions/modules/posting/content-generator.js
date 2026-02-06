// 포스팅 생성 (Gemini Pro)

const { callVertexGemini } = require('../gemini-api.js');

async function generatePostWithClaudeForPosting(client, trendsData, images, env) {

  // KST 현재 날짜
  const kstNow = new Date(Date.now() + (9 * 60 * 60 * 1000));
  const year = kstNow.getFullYear();
  const month = kstNow.getMonth() + 1;
  const monthNames = ['1월', '2월', '3월', '4월', '5월', '6월', '7월', '8월', '9월', '10월', '11월', '12월'];
  const monthName = monthNames[month - 1];
  const currentDate = `${year}년 ${monthName}`;

  // 이미지 개수에 맞춰 문단 개수 결정 (최소 5개, 최대 10개)
  const paragraphCount = Math.max(5, Math.min(10, images.length));
  const totalChars = 3500;
  const charsPerParagraph = Math.floor(totalChars / paragraphCount);

  // 단일 프롬프트 (이미지 개수 기반 동적 문단 생성)
  const prompt = `

[거래처 정보]

- 업체명: ${client.business_name}

- 언어: ${client.language}

- **핵심 주제 및 소개 (필수 반영): ${client.description}**



[현재 날짜]

- 오늘: ${currentDate}
- 날짜/년도/계절 언급 시 위 날짜 기준으로 작성
- '현재', '지금', '최근', '올해' 표현은 실제 날짜 기준



[트렌드 정보]

${trendsData}



[작성 규칙]

0. **포스팅 전체(제목과 본문)를 반드시 ${client.language}로 작성** (최우선 필수)

1. 제목: **[트렌드 정보] 키워드 기반**으로 창의적이고 매력적으로 작성
   - [거래처 정보]를 제목에 절대 반영하지 마세요
   - 오직 [트렌드 정보] 키워드만 활용
   - 다양한 톤 사용 (질문형, 숫자형, 서술형, 감탄형 등)
   - 매번 완전히 새롭고 다른 스타일로 작성

2. 본문 전체 글자수: **공백 포함 3400~3600자** (필수)

3. 본문 구조: **정확히 ${paragraphCount}개의 문단으로 작성** (필수)
   - [트렌드 정보]와 [거래처 정보]를 자연스럽게 조합
   - 거래처의 업종과 특징을 고려한 자유로운 창작
   - 스토리텔링 중심 (고객 경험, 감성적 묘사, 실용적 정보)

4. 각 문단:
   - **각 문단은 공백 포함 약 ${charsPerParagraph}자 내외로 자유롭게 작성**
   - **[트렌드 정보]를 적극 활용하여 풍부한 내용 구성** (중심)
   - **[거래처 정보]의 description은 자연스럽게 흐름에 녹여냄** (강제 반영 금지)
   - 각 문단이 독립적이되 전체적으로 하나의 이야기처럼 연결
   - 독자가 공감하고 몰입할 수 있는 스토리 구성

5. 문단 구분: 문단 사이에 빈 줄 2개 (\\n\\n)로 명확히 구분

6. 금지어: 최고, 1등, 유일, 검증된

7. 금지 창작: 경력, 학력, 자격증, 수상

8. **간결하고 핵심적인 표현 사용 - 장황한 설명 금지**

9. **상호명(${client.business_name})을 본문에 1~2회 자연스럽게 언급** (필수)

10. **날짜/시간 기준**: [현재 날짜] 기준으로 작성



출력 형식 (JSON):

{

  "title": "제목",

  "body": "문단1\\n\\n문단2\\n\\n문단3\\n\\n..."

}



중요: 이미지 제약 없이 자유롭게 창작하며, [트렌드 정보]와 [거래처 정보]를 자연스럽게 조합하여 매력적인 포스팅을 작성하세요.

`;



  try {

    const startTime = Date.now();
    // 이미지 파라미터 제거 (빈 배열)
    const result = await callVertexGemini(prompt, 'gemini-2.5-pro', 8192, 0.7, [], env.GEMINI_API_KEY);
    const duration = Date.now() - startTime;

    // Structured logging for Cloud Monitoring
    console.log(JSON.stringify({
      severity: 'INFO',
      message: 'Gemini API call completed',
      component: 'content-generator',
      model: 'gemini-2.5-pro',
      duration_ms: duration,
      content_type: 'free_creation'
    }));

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
