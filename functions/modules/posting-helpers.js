// 포스팅 자동화 헬퍼 함수

const { GoogleAuth } = require('google-auth-library');
const { fetchWithTimeout, parseCSV, normalizeClient, normalizeLanguage, removeLanguageSuffixFromBusinessName, normalizeSubdomain } = require('./utils.js');
const { getGoogleAccessTokenForPosting } = require('./auth.js');
const { translateWithCache } = require('./translation-cache.js');

// 관리자 시트 헤더 고정값 (A~Q열, 17개)
const ADMIN_HEADERS_FALLBACK = [
  '도메인', '구독', '성함', '상호명', '주소', '연락처', '영업시간', '언어',
  '거래처_정보', '업종', '폴더명', '우마미', '우마미_공유', '바로가기',
  'info', 'video', '크론'
];

// 최신_포스팅 헤더 고정값 (10개)
const LATEST_POSTING_HEADERS_FALLBACK = [
  '도메인', '상호명', '제목', '생성일시', '언어', '업종', '폴더명', '본문', '이미지', 'URL', '크론'
];


// 포스팅당 최대 이미지 개수
const MAX_IMAGES_PER_POSTING = 10;

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

async function getClientFromSheetsForPosting(subdomain, env) {

  const SHEET_URL = env.GOOGLE_SHEETS_CSV_URL || 'https://docs.google.com/spreadsheets/d/1KrzLFi8Wt9GTGT97gcMoXnbZ3OJ04NsP4lncJyIdyhU/export?format=csv&gid=0';



  try {

    const response = await fetchWithTimeout(SHEET_URL, {}, 10000);



    if (!response.ok) {

      throw new Error(`Sheets CSV fetch failed: ${response.status}`);

    }



    const csvText = await response.text();

    const clients = parseCSV(csvText).map(normalizeClient);



    const client = clients.find(c => {

      let normalized = normalizeSubdomain(c.subdomain);

      return normalized === subdomain && c.subscription === '활성';

    }) || null;

    // 상호명 원본 보존 (시트 저장용)
    if (client && client.business_name) {
      client.business_name_original = client.business_name;
      client.business_name = removeLanguageSuffixFromBusinessName(client.business_name);
    }

    // Sheets 데이터 번역 (언어가 한국어가 아닐 때)
    if (client && client.language) {
      const langCode = normalizeLanguage(client.language);
      if (langCode !== 'ko') {
        const fieldsToTranslate = [];
        if (client.business_name) fieldsToTranslate.push({ key: 'business_name', value: client.business_name });
        if (client.address) fieldsToTranslate.push({ key: 'address', value: client.address });
        if (client.business_hours) fieldsToTranslate.push({ key: 'business_hours', value: client.business_hours });
        if (client.contact) fieldsToTranslate.push({ key: 'contact', value: client.contact });
        if (client.description) fieldsToTranslate.push({ key: 'description', value: client.description });

        if (fieldsToTranslate.length > 0) {
          try {
            const translations = await translateWithCache(fieldsToTranslate, langCode, subdomain, env);

            if (translations.business_name) client.business_name = translations.business_name;
            if (translations.address) client.address = translations.address;
            if (translations.business_hours) client.business_hours = translations.business_hours;
            if (translations.contact) client.contact = translations.contact;
            if (translations.description) client.description = translations.description;
          } catch (error) {
            console.error('Translation error in getClientFromSheetsForPosting:', error);
          }
        }
      }
    }

    return client;

  } catch (error) {

    console.error(`getClientFromSheetsForPosting 에러: ${error.message}`);

    throw error;

  }

}

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

async function getFolderImagesForPosting(subdomain, folderName, accessToken, env, logs) {

  const DRIVE_FOLDER_ID = env.DRIVE_FOLDER_ID || '1JiVmIkliR9YrPIUPOn61G8Oh7h9HTMEt';



  const businessFolderQuery = `mimeType = 'application/vnd.google-apps.folder' and name contains '${subdomain}' and '${DRIVE_FOLDER_ID}' in parents and trashed = false`;



  const businessFolderResponse = await fetch(

    `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(businessFolderQuery)}&fields=files(id,
  name)`,

    { headers: { Authorization: `Bearer ${accessToken}` } }

  );



  const businessFolderData = await businessFolderResponse.json();

  if (!businessFolderData.files || businessFolderData.files.length === 0) {

    logs.push('이미지 조회: 거래처 폴더 없음');

    return [];

  }



  const businessFolderId = businessFolderData.files[0].id;

  logs.push(`이미지 조회: 거래처 폴더 ID ${businessFolderId}`);



  const targetFolderQuery = `mimeType = 'application/vnd.google-apps.folder' and name = '${folderName}' and '${businessFolderId}' in parents and trashed = false`;



  const targetFolderResponse = await fetch(

    `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(targetFolderQuery)}&fields=files(id,
  name)`,

    { headers: { Authorization: `Bearer ${accessToken}` } }

  );



  const targetFolderData = await targetFolderResponse.json();

  logs.push(`타겟 폴더 검색 결과: ${JSON.stringify(targetFolderData)}`);



  if (!targetFolderData.files || targetFolderData.files.length === 0) {

    logs.push('이미지 조회: 타겟 폴더 없음');

    return [];

  }



  const targetFolderId = targetFolderData.files[0].id;

  logs.push(`이미지 조회: 타겟 폴더 ID ${targetFolderId}`);



  const filesQuery = `'${targetFolderId}' in parents and trashed = false`;



  const filesResponse = await fetch(

    `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(filesQuery)}&fields=files(id,
  name,
  mimeType)&pageSize=100`,

    { headers: { Authorization: `Bearer ${accessToken}` } }

  );



  const filesData = await filesResponse.json();

  logs.push(`파일 검색 결과: ${JSON.stringify(filesData)}`);



  let imageFiles = (filesData.files || []).filter(f => f.mimeType && f.mimeType.startsWith('image/'));

  logs.push(`이미지 파일 ${imageFiles.length}개 필터링됨`);



  // 최대 이미지 개수 초과 시 랜덤 선택

  if (imageFiles.length > MAX_IMAGES_PER_POSTING) {

    imageFiles = imageFiles.sort(() => Math.random() - 0.5).slice(0, MAX_IMAGES_PER_POSTING);

    logs.push(`${MAX_IMAGES_PER_POSTING}개 초과: 랜덤 ${imageFiles.length}개 선택`);

  }



  // 병렬 다운로드 (속도 향상)

  const downloadPromises = imageFiles.map(async (file) => {

    try {

      logs.push(`썸네일 다운로드: ${file.name}`);



      // Google Drive 썸네일 API 사용 (w400 크기)

      const thumbnailUrl = `https://lh3.googleusercontent.com/d/${file.id}=w400`;

      const imageResponse = await fetch(thumbnailUrl);



      if (!imageResponse.ok) {

        logs.push(`썸네일 다운로드 실패: ${file.name} - ${imageResponse.status}`);

        return null;

      }



      const arrayBuffer = await imageResponse.arrayBuffer();

      const bytes = new Uint8Array(arrayBuffer);



      let binary = '';

      const chunkSize = 8192;

      for (let i = 0; i < bytes.length; i += chunkSize) {

        const chunk = bytes.subarray(i, Math.min(i + chunkSize, bytes.length));

        binary += String.fromCharCode.apply(null, chunk);

      }

      const base64 = btoa(binary);



      logs.push(`썸네일 다운로드 완료: ${file.name}`);

      return {

        id: file.id,

        name: file.name,

        mimeType: file.mimeType,

        data: base64

      };

    } catch (error) {

      logs.push(`썸네일 다운로드 에러: ${file.name} - ${error.message}`);

      return null;

    }

  });



  const results = await Promise.all(downloadPromises);

  const images = results.filter(img => img !== null);



  logs.push(`총 ${images.length}개 이미지 다운로드 완료`);

  return images;

}

async function getClientFoldersForPosting(folderName, subdomain, accessToken, env, logs) {

  const DRIVE_FOLDER_ID = env.DRIVE_FOLDER_ID || '1JiVmIkliR9YrPIUPOn61G8Oh7h9HTMEt';



  // 폴더명이 있으면 정확한 매칭, 없으면 subdomain 포함 검색 (폴백)

  const businessFolderQuery = folderName

    ? `mimeType = 'application/vnd.google-apps.folder' and name = '${folderName}' and '${DRIVE_FOLDER_ID}' in parents and trashed = false`

    : `mimeType = 'application/vnd.google-apps.folder' and name contains '${subdomain}' and '${DRIVE_FOLDER_ID}' in parents and trashed = false`;



  const businessFolderResponse = await fetch(

    `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(businessFolderQuery)}&fields=files(id,
  name)`,

    { headers: { Authorization: `Bearer ${accessToken}` } }

  );



  const businessFolderData = await businessFolderResponse.json();

  logs.push(`거래처 폴더 검색 결과: ${JSON.stringify(businessFolderData)}`);



  if (!businessFolderData.files || businessFolderData.files.length === 0) {

    logs.push('거래처 폴더를 찾을 수 없음');

    return [];

  }



  const businessFolderId = businessFolderData.files[0].id;

  logs.push(`거래처 폴더 ID: ${businessFolderId}`);



  const subFoldersQuery = `mimeType = 'application/vnd.google-apps.folder' and '${businessFolderId}' in parents and trashed = false`;



  const subFoldersResponse = await fetch(

    `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(subFoldersQuery)}&fields=files(id,
  name)&orderBy=name`,

    { headers: { Authorization: `Bearer ${accessToken}` } }

  );



  const subFoldersData = await subFoldersResponse.json();

  logs.push(`하위 폴더 조회 결과: ${JSON.stringify(subFoldersData)}`);



  const folders = (subFoldersData.files || [])

    .map(f => f.name)

    .filter(name => {

      const lowerName = name.toLowerCase();

      return lowerName !== 'info' && lowerName !== 'video';

    })

    .sort();



  logs.push(`필터링된 폴더: ${JSON.stringify(folders)}`);



  return folders;

}

async function getLastUsedFolderForPosting(subdomain, accessToken, env) {

  try {
    const latestSheetName = env.LATEST_POSTING_SHEET_NAME || '최신_포스팅';
    const sheetsUrl = `https://sheets.googleapis.com/v4/spreadsheets/${env.SHEETS_ID}/values/${encodeURIComponent("'" + latestSheetName + "'!A:Z")}`;

    const response = await fetchWithTimeout(
      sheetsUrl,
      { headers: { Authorization: `Bearer ${accessToken}` } },
      10000
    );

    if (!response.ok) return { lastFolder: null };

    const data = await response.json();
    const rows = data.values || [];

    if (rows.length < 2) return { lastFolder: null };

    const headers = rows[0];
    const domainIndex = headers.indexOf('도메인');
    const folderIndex = headers.indexOf('폴더명');

    if (domainIndex === -1 || folderIndex === -1) return { lastFolder: null };

    // 해당 거래처 찾기
    const targetDomain = `${subdomain}.make-page.com`;
    for (let i = 1; i < rows.length; i++) {
      const rowDomain = normalizeSubdomain(rows[i][domainIndex] || '');
      if (rowDomain === subdomain) {
        return { lastFolder: rows[i][folderIndex] || null };
      }
    }

    return { lastFolder: null };
  } catch (error) {
    console.error('getLastUsedFolderForPosting error:', error);
    return { lastFolder: null };
  }

}

function getNextFolderForPosting(folders, lastFolder) {

  if (folders.length === 0) {

    return null;

  }



  // 순환 로직

  if (!lastFolder) {

    return folders[0];

  }



  const currentIndex = folders.indexOf(lastFolder);

  if (currentIndex === -1) {

    return folders[0];

  }



  const nextIndex = (currentIndex + 1) % folders.length;

  return folders[nextIndex];

}

// 최신_포스팅 시트에서 중복 도메인 제거 (동시성 문제 해결)
async function saveToLatestPostingSheet(client, postData, normalizedSubdomain, folderName, accessToken, env) {
  const now = new Date();
  const koreaTime = new Date(now.getTime() + (9 * 60 * 60 * 1000));
  const timestamp = koreaTime.toISOString().replace('T', ' ').substring(0, 19);
  const domain = `${normalizedSubdomain}.make-page.com`;
  const latestSheetName = env.LATEST_POSTING_SHEET_NAME || '최신_포스팅';

  // 포스트 데이터 준비
  const postId = new Date(timestamp).getTime().toString(36);
  const cronDate = timestamp.substring(5, 10);

  const postDataMap = {
    '도메인': domain,
    '상호명': String(client.business_name_original || client.business_name || '').replace(/[\r\n]+/g, ' ').trim(),
    '제목': String(postData.title || '').replace(/[\r\n]+/g, ' ').trim(),
    'URL': `${domain}/post?id=${postId}`,
    '생성일시': timestamp,
    '언어': client.language || 'ko',
    '업종': client.industry || '',
    '폴더명': folderName || '',
    '본문': String(postData.body || '').trim(),
    '이미지': postData.images || '',
    '크론': cronDate
  };

  // 1. 시트 읽기
  const sheetsUrl = `https://sheets.googleapis.com/v4/spreadsheets/${env.SHEETS_ID}/values/${encodeURIComponent("'" + latestSheetName + "'!A:Z")}`;
  const getResponse = await fetchWithTimeout(
    sheetsUrl,
    { headers: { Authorization: `Bearer ${accessToken}` } },
    10000
  );

  if (!getResponse.ok) {
    const errorText = await getResponse.text();
    throw new Error(`최신_포스팅 시트 읽기 실패: ${getResponse.status} - ${errorText}`);
  }

  const getData = await getResponse.json();
  const rows = getData.values || [];

  if (rows.length < 1) {
    throw new Error('최신_포스팅 시트에 헤더가 없습니다');
  }

  const headers = rows[0];
  const domainIndex = headers.indexOf('도메인');

  if (domainIndex === -1) {
    throw new Error('최신_포스팅 시트에 도메인 컬럼이 없습니다');
  }

  // 2. 기존 행 찾기
  let existingRowIndex = -1;
  for (let i = 1; i < rows.length; i++) {
    const rowDomain = normalizeSubdomain(rows[i][domainIndex] || '');
    const searchDomain = normalizeSubdomain(domain);
    if (rowDomain === searchDomain) {
      existingRowIndex = i + 1; // A1 notation (1-based)
      break;
    }
  }

  // 3. 데이터 행 준비
  const rowData = headers.map(header => postDataMap[header] || '');

  // 4. UPDATE 또는 APPEND
  let response;
  if (existingRowIndex !== -1) {
    // 기존 행 UPDATE
    const updateUrl = `https://sheets.googleapis.com/v4/spreadsheets/${env.SHEETS_ID}/values/${encodeURIComponent("'" + latestSheetName + "'!A" + existingRowIndex)}?valueInputOption=RAW`;
    response = await fetchWithTimeout(
      updateUrl,
      {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ values: [rowData] })
      },
      10000
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`최신_포스팅 시트 UPDATE 실패: ${response.status} - ${errorText}`);
    }
    console.log(`최신_포스팅 시트 UPDATE 완료 (행 ${existingRowIndex})`);
  } else {
    // 신규 행 APPEND
    const appendUrl = `https://sheets.googleapis.com/v4/spreadsheets/${env.SHEETS_ID}/values/${encodeURIComponent("'" + latestSheetName + "'!A:Z")}:append?valueInputOption=RAW`;
    response = await fetchWithTimeout(
      appendUrl,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ values: [rowData] })
      },
      10000
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`최신_포스팅 시트 APPEND 실패: ${response.status} - ${errorText}`);
    }
    console.log('최신_포스팅 시트 APPEND 완료');
  }
}




module.exports = {
  getClientFromSheetsForPosting,
  searchWithClaudeForPosting,
  generatePostWithClaudeForPosting,
  getFolderImagesForPosting,
  getClientFoldersForPosting,
  getLastUsedFolderForPosting,
  getNextFolderForPosting,
  saveToLatestPostingSheet
};
