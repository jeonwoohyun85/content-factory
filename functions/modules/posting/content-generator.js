// 포스팅 생성 (Gemini Pro)

const { callVertexGemini } = require('../gemini-api.js');

async function generatePostWithClaudeForPosting(client, trendsData, images, env) {

  const hasImages = images.length > 0;

  const imageCount = images.length;

  // KST 현재 날짜
  const kstNow = new Date(Date.now() + (9 * 60 * 60 * 1000));
  const year = kstNow.getFullYear();
  const month = kstNow.getMonth() + 1;
  const monthNames = ['1월', '2월', '3월', '4월', '5월', '6월', '7월', '8월', '9월', '10월', '11월', '12월'];
  const monthName = monthNames[month - 1];
  const currentDate = `${year}년 ${monthName}`;

  const prompt = hasImages ? `

[거래처 정보]

- 업체명: ${client.business_name}

- 언어: ${client.language}

- **핵심 주제 및 소개 (필수 반영): ${client.description}**



[현재 날짜]

- 오늘: ${currentDate}
- 날짜/년도/계절 언급 시 위 날짜 기준으로 작성
- 이미지 속 날짜는 묘사만, '현재', '지금', '최근', '올해' 표현은 실제 날짜 기준



[트렌드 정보]

${trendsData}



[제공된 이미지]

총 ${imageCount}장의 이미지를 첨부했습니다. 각 이미지를 자세히 확인하고 순서대로 설명하세요.



[작성 규칙]

0. **포스팅 전체(제목과 본문)를 반드시 ${client.language}로 작성** (최우선 필수)

1. 제목: **이미지 내용 기반**으로 창의적이고 매력적으로 작성
   - [거래처 정보]를 제목에 절대 반영하지 마세요
   - 오직 이미지 내용과 [트렌드 정보] 키워드만 활용
   - 다양한 톤 사용 (질문형, 숫자형, 서술형, 감탄형 등)
   - 매번 완전히 새롭고 다른 스타일로 작성

2. 본문 전체 글자수: **공백 포함 2800~3200자** (필수)

3. 본문 구조: **반드시 ${imageCount}개의 문단으로 작성**

   - 1번째 이미지 → 1번째 문단

   - 2번째 이미지 → 2번째 문단

   - ...

   - ${imageCount}번째 이미지 → ${imageCount}번째 문단

4. 각 문단: **이미지 묘사가 중심**, [트렌드 정보]와 [거래처 정보]는 자연스럽게만 녹여냄

   - 이미지 속 색상, 분위기, 사물, 사람, 액션, 디테일 등을 구체적으로 묘사

   - **각 문단은 공백 포함 약 280~320자 내외로 작성**

   - **[트렌드 정보]는 배경 설명으로 자연스럽게 활용** (문단당 1~2문장)

   - **[거래처 정보]의 description은 자연스럽게 흐름에 녹여냄** (강제 반영 금지)

5. 문단 구분: 문단 사이에 빈 줄 2개 (\\n\\n)로 명확히 구분

6. 금지어: 최고, 1등, 유일, 검증된

7. 금지 창작: 경력, 학력, 자격증, 수상

8. **간결하고 핵심적인 표현 사용 - 장황한 설명 금지**

9. **상호명(${client.business_name})을 본문에 1~2회 자연스럽게 언급** (필수)

10. **날짜/시간 기준**: [현재 날짜] 기준으로 작성 (이미지 속 날짜 무시)



출력 형식 (JSON):

{

  "title": "제목",

  "body": "문단1\\n\\n문단2\\n\\n문단3\\n\\n..."

}



중요: body는 정확히 ${imageCount}개의 문단으로 구성되어야 하며, 이미지 내용이 포스팅의 중심입니다. description과 trendsData는 자연스럽게 배경으로 활용하세요.

` : `

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



[제공된 이미지]

이미지가 제공되지 않았습니다. 텍스트만으로 작성해주세요.



[작성 규칙]

0. **포스팅 전체(제목과 본문)를 반드시 ${client.language}로 작성** (최우선 필수)

1. 제목: **[트렌드 정보] 키워드 기반**으로 창의적이고 매력적으로 작성
   - [거래처 정보]를 제목에 절대 반영하지 마세요
   - 오직 [트렌드 정보] 키워드만 활용
   - 다양한 톤 사용 (질문형, 숫자형, 서술형, 감탄형 등)
   - 매번 완전히 새롭고 다른 스타일로 작성

2. 본문 전체 글자수: **공백 포함 2800~3200자** (필수)

3. 본문 구조: **8~10개의 문단으로 작성** (이미지 없음)

   - [트렌드 정보]를 중심으로 다양한 측면 다룸

   - [거래처 정보]는 자연스럽게 배경으로만 활용

4. 각 문단:

   - **각 문단은 공백 포함 약 280~320자 내외로 작성**

   - **[트렌드 정보]를 적극 활용하여 풍부한 내용 구성** (중심)

   - **[거래처 정보]의 description은 자연스럽게 흐름에 녹여냄** (강제 반영 금지)

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



중요: 이미지 없이 텍스트만으로 매력적인 포스팅을 작성하며, [트렌드 정보]가 포스팅의 중심입니다. description은 자연스럽게 배경으로 활용하세요.

`;



  try {

    const startTime = Date.now();
    const result = await callVertexGemini(prompt, 'gemini-2.5-pro', 8192, 0.7, images, env.GEMINI_API_KEY);
    const duration = Date.now() - startTime;

    // Structured logging for Cloud Monitoring
    console.log(JSON.stringify({
      severity: 'INFO',
      message: 'Gemini API call completed',
      component: 'content-generator',
      model: 'gemini-2.5-pro',
      duration_ms: duration,
      has_images: hasImages,
      image_count: imageCount
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
