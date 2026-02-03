// 포스팅 자동화 헬퍼 함수

const { GoogleAuth } = require('google-auth-library');
const { fetchWithTimeout, parseCSV, normalizeClient, normalizeLanguage, formatKoreanTime, getColumnLetter, removeLanguageSuffixFromBusinessName } = require('./utils.js');
const { getGoogleAccessTokenForPosting } = require('./auth.js');
const { autoResizeBusinessNameColumns } = require('./sheets.js');
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

// 저장소 헤더 고정값 (백업용 - API 실패 시 사용, 10개)
const ARCHIVE_HEADERS_FALLBACK = [
  '도메인', '상호명', '제목', '생성일시', '언어', '업종', '폴더명', '본문', '이미지', 'URL'
];

// 포스팅당 최대 이미지 개수
const MAX_IMAGES_PER_POSTING = 10;

// Vertex AI Gemini API 헬퍼 함수
async function callVertexGemini(prompt, model = 'gemini-2.5-flash', maxTokens = 1024, temperature = 0.7) {
  const auth = new GoogleAuth({
    scopes: ['https://www.googleapis.com/auth/cloud-platform']
  });
  const client = await auth.getClient();
  const accessToken = await client.getAccessToken();

  const projectId = process.env.GCP_PROJECT || 'content-factory-1770105623';
  const location = 'us-central1';
  const endpoint = `https://${location}-aiplatform.googleapis.com/v1/projects/${projectId}/locations/${location}/publishers/google/models/${model}:generateContent`;

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
          parts: [{ text: prompt }]
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

      let normalized = (c.subdomain || '').replace('.make-page.com', '').replace('/', '');

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

총 ${imageCount}장의 이미지가 제공됩니다.



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



출력 형식 (JSON):

{

  "title": "제목",

  "body": "문단1\\n\\n문단2\\n\\n문단3\\n\\n..."

}



중요: 이미지 없이 텍스트만으로 매력적인 포스팅을 작성하며, '${client.description}'의 내용이 포스팅의 중심이 되어야 합니다.

`;



  try {

    const result = await callVertexGemini(prompt, 'gemini-2.5-pro', 4096);



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

    const archiveSheetName = env.ARCHIVE_SHEET_NAME || '저장소';



    const response = await fetchWithTimeout(

      `https://sheets.googleapis.com/v4/spreadsheets/${env.SHEETS_ID}/values/${encodeURIComponent(archiveSheetName)}!A:Z`,

      { headers: { Authorization: `Bearer ${accessToken}` } },

      10000

    );



    if (!response.ok) {

      console.warn('[WARNING] 저장소 시트 읽기 실패, 고정 헤더 사용');

      return { lastFolder: null, archiveHeaders: ARCHIVE_HEADERS_FALLBACK };

    }



    const data = await response.json();

    const rows = data.values || [];



    if (rows.length < 1) {

      console.warn('[WARNING] 저장소 시트 비어있음, 고정 헤더 사용');

      return { lastFolder: null, archiveHeaders: ARCHIVE_HEADERS_FALLBACK };

    }



    const headers = rows[0];

    const domainIndex = headers.indexOf('도메인');

    const folderNameIndex = headers.indexOf('폴더명');



    if (domainIndex === -1 || folderNameIndex === -1) {

      return { lastFolder: null, archiveHeaders: headers };

    }



    const normalizedSubdomain = subdomain.replace('.make-page.com', '').replace('/', '');

    const domain = `${normalizedSubdomain}.make-page.com`;



    // 해당 도메인의 마지막 행에서 폴더명 가져오기

    let lastFolder = null;

    for (let i = rows.length - 1; i >= 1; i--) {

      const row = rows[i];

      const rowDomain = row[domainIndex] || '';

      if (rowDomain === domain) {

        lastFolder = row[folderNameIndex] || null;

        break;

      }

    }



    return { lastFolder, archiveHeaders: headers };

  } catch (error) {

    console.error('[ERROR] 저장소 조회 중 에러:', error.message);

    console.warn('[WARNING] 고정 헤더 사용');

    return { lastFolder: null, archiveHeaders: ARCHIVE_HEADERS_FALLBACK };

  }

}

function getNextFolderForPosting(folders, lastFolder) {

  if (folders.length === 0) {

    return null;

  }



  // 1. 날짜 기반 매칭 (오늘 날짜 YYYY-MM-DD)

  const now = new Date();

  const koreaTime = new Date(now.getTime() + (9 * 60 * 60 * 1000));

  const todayString = koreaTime.toISOString().split('T')[0];



  const todayFolder = folders.find(f => f.includes(todayString));

  if (todayFolder) {

    return todayFolder;

  }



  // 2. 순환 로직 (기존 방식)

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
async function removeDuplicatesFromLatestPosting(env, domain, latestSheetId, accessToken) {
  try {
    const latestSheetName = env.LATEST_POSTING_SHEET_NAME || '최신 포스팅';

    // 최신_포스팅 전체 읽기
    const response = await fetchWithTimeout(
      `https://sheets.googleapis.com/v4/spreadsheets/${env.SHEETS_ID}/values/${encodeURIComponent(latestSheetName)}!A:Z`,
      { headers: { Authorization: `Bearer ${accessToken}` } },
      10000
    );

    if (!response.ok) {
      console.error('중복 제거: 시트 읽기 실패');
      return;
    }

    const data = await response.json();
    const rows = data.values || [];

    if (rows.length < 2) return;

    const headers = rows[0];
    const domainIndex = headers.indexOf('도메인');
    const createdAtIndex = headers.indexOf('생성일시');

    if (domainIndex === -1 || createdAtIndex === -1) {
      console.error('중복 제거: 필수 컬럼 없음');
      return;
    }

    // 정규화된 도메인으로 매칭
    const normalizedDomain = domain.replace('.make-page.com', '');
    const matchingRows = [];

    for (let i = 1; i < rows.length; i++) {
      const rowDomain = (rows[i][domainIndex] || '').replace('.make-page.com', '');
      if (rowDomain === normalizedDomain) {
        matchingRows.push({
          index: i + 1,
          createdAt: rows[i][createdAtIndex] || ''
        });
      }
    }

    // 2개 이상이면 중복
    if (matchingRows.length <= 1) {
      console.log('중복 제거: 중복 없음');
      return;
    }

    console.log(`중복 제거: ${matchingRows.length}개 행 발견`);

    // 생성일시 기준 내림차순 정렬 (최신이 첫 번째)
    // 빈 값은 미래 날짜로 처리하여 최신으로 간주
    matchingRows.sort((a, b) => {
      const timeA = a.createdAt || '9999-12-31 23:59:59';
      const timeB = b.createdAt || '9999-12-31 23:59:59';
      if (timeA > timeB) return -1;
      if (timeA < timeB) return 1;
      return 0;
    });

    // 첫 번째(최신) 제외하고 나머지 삭제
    const toDelete = matchingRows.slice(1);

    // 내림차순 정렬 (뒤에서부터 삭제)
    toDelete.sort((a, b) => b.index - a.index);

    for (const row of toDelete) {
      const deleteResponse = await fetchWithTimeout(
        `https://sheets.googleapis.com/v4/spreadsheets/${env.SHEETS_ID}:batchUpdate`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            requests: [{
              deleteDimension: {
                range: {
                  sheetId: latestSheetId,
                  dimension: 'ROWS',
                  startIndex: row.index - 1,
                  endIndex: row.index
                }
              }
            }]
          })
        },
        10000
      );

      if (!deleteResponse.ok) {
        console.error(`중복 행 삭제 실패: ${deleteResponse.status}`);
      }
    }

    console.log(`중복 제거 완료: ${toDelete.length}개 행 삭제`);
  } catch (error) {
    console.error(`중복 제거 에러: ${error.message}`);
  }
}

async function saveToLatestPostingSheet(client, postData, normalizedSubdomain, folderName, accessToken, env, archiveHeaders) {

  const now = new Date();

  const koreaTime = new Date(now.getTime() + (9 * 60 * 60 * 1000));

  const timestamp = koreaTime.toISOString().replace('T', ' ').substring(0, 19);

  const domain = `${normalizedSubdomain}.make-page.com`;



  const archiveSheetName = env.ARCHIVE_SHEET_NAME || '저장소';

  const latestSheetName = env.LATEST_POSTING_SHEET_NAME || '최신 포스팅';



  // 데이터 객체 (컬럼명: 값)
  // 포스트 ID: 타임스탬프를 36진수로 변환 (날짜 숨김)
  const postId = new Date(timestamp).getTime().toString(36);

  // 크론 날짜: MM-DD 형식 추출 (timestamp: "2026-02-01 09:05:23" → "02-01")
  const cronDate = timestamp.substring(5, 10); // "02-01"

  const postDataMap = {

    '도메인': domain,

    '상호명': String(client.business_name_original || client.business_name || '').replace(new RegExp('[\r\n]+', 'g'), ' ').trim(),

    '제목': String(postData.title || '').replace(new RegExp('[\r\n]+', 'g'), ' ').trim(),

    'URL': `${domain}/post?id=${postId}`,

    '생성일시': timestamp,

    '언어': client.language || 'ko',

    '업종': client.industry || '',

    '폴더명': folderName || '',

    '본문': String(postData.body || '').replace(new RegExp('[\r\n]+', 'g'), ' ').trim(),

    '이미지': postData.images || '',

    '크론': cronDate

  };



  // 1. 최신 포스팅 탭 먼저 처리 (트랜잭션 방식 - 실패 시 저장소 저장 안함)

  const getResponse = await fetchWithTimeout(

    `https://sheets.googleapis.com/v4/spreadsheets/${env.SHEETS_ID}/values/${encodeURIComponent(latestSheetName)}!A:Z`,

    { headers: { Authorization: `Bearer ${accessToken}` } },

    10000

  );



  if (!getResponse.ok) {

    throw new Error(`최신 포스팅 시트 읽기 실패: ${getResponse.status}`);

  }



  const getData = await getResponse.json();

  const rows = getData.values || [];



  if (rows.length < 1) {

    throw new Error('최신 포스팅 시트에 헤더가 없습니다');

  }



  const latestHeaders = rows[0];

  const domainIndex = latestHeaders.indexOf('도메인');

  const createdAtIndex = latestHeaders.indexOf('생성일시');



  if (domainIndex === -1 || createdAtIndex === -1) {

    throw new Error('최신 포스팅 시트에 필수 컬럼(도메인, 생성일시)이 없습니다');

  }



  // 2. 시트 메타데이터 한 번만 조회 (API 중복 호출 방지)

  const spreadsheetResponse = await fetchWithTimeout(

    `https://sheets.googleapis.com/v4/spreadsheets/${env.SHEETS_ID}?fields=sheets(properties(title,
  sheetId),
  data.columnMetadata.pixelSize)`,

    { headers: { Authorization: `Bearer ${accessToken}` } },

    10000

  );



  if (!spreadsheetResponse.ok) {

    throw new Error(`시트 메타데이터 조회 실패: ${spreadsheetResponse.status}`);

  }



  const spreadsheetData = await spreadsheetResponse.json();

  const latestSheet = spreadsheetData.sheets.find(s => s.properties.title === latestSheetName);

  const archiveSheet = spreadsheetData.sheets.find(s => s.properties.title === archiveSheetName);

  const adminSheet = spreadsheetData.sheets.find(s => s.properties.title === '관리자');



  const latestSheetId = latestSheet ? latestSheet.properties.sheetId : 0;

  const archiveSheetId = archiveSheet ? archiveSheet.properties.sheetId : 0;



  console.log(`SheetID - 최신포스팅: ${latestSheetId}, 저장소: ${archiveSheetId}`);

  // 3. 해당 도메인의 행들 찾기

  const domainRows = [];

  for (let i = 1; i < rows.length; i++) {

    // 도메인 정규화 비교

        const normalizedStoredDomain = rows[i][domainIndex]?.replace('.make-page.com', '') || '';

        const normalizedSearchDomain = domain.replace('.make-page.com', '');



        if (normalizedStoredDomain === normalizedSearchDomain) {

      domainRows.push({ index: i + 1, createdAt: rows[i][createdAtIndex] || '' });

    }

  }



  // 4. 기존 행 모두 삭제

  if (domainRows.length > 0) {

    // 내림차순 정렬 (뒤에서부터 삭제하여 인덱스 오류 방지)

    domainRows.sort((a, b) => b.index - a.index);



    for (const row of domainRows) {

      const oldestRowIndex = row.index;



      const deleteResponse = await fetchWithTimeout(

        `https://sheets.googleapis.com/v4/spreadsheets/${env.SHEETS_ID}:batchUpdate`,

        {

          method: 'POST',

          headers: {

            'Authorization': `Bearer ${accessToken}`,

            'Content-Type': 'application/json'

          },

          body: JSON.stringify({

            requests: [{

              deleteDimension: {

                range: {

                  sheetId: latestSheetId,

                  dimension: 'ROWS',

                  startIndex: oldestRowIndex - 1,

                  endIndex: oldestRowIndex

                }

              }

            }]

          })

        },

        10000

      );

      if (!deleteResponse.ok) {

        throw new Error(`최신 포스팅 행 삭제 실패: ${deleteResponse.status}`);

      }

    }

  }



  // 5. 최신 포스팅 탭에 append (헤더 순서대로)

  const latestRowData = latestHeaders.map(header => postDataMap[header] || '');



  const latestAppendResponse = await fetchWithTimeout(

    `https://sheets.googleapis.com/v4/spreadsheets/${env.SHEETS_ID}/values/${encodeURIComponent(latestSheetName)}!A:Z:append?valueInputOption=RAW`,

    {

      method: 'POST',

      headers: {

        'Authorization': `Bearer ${accessToken}`,

        'Content-Type': 'application/json'

      },

      body: JSON.stringify({ values: [latestRowData] })

    },

    10000

  );



  if (!latestAppendResponse.ok) {

    const errorText = await latestAppendResponse.text();

    throw new Error(`최신 포스팅 시트 append 실패: ${latestAppendResponse.status} - ${errorText}`);

  }

  // 중복 제거 (동시성 문제 해결)
  await removeDuplicatesFromLatestPosting(env, domain, latestSheetId, accessToken);

  // 최신 포스팅 시트에 새로 추가된 행의 높이와 텍스트 줄바꿈 설정

  try {

    const latestAppendResult = await latestAppendResponse.json();

    const latestUpdatedRange = latestAppendResult.updates?.updatedRange;



    if (latestUpdatedRange) {

      const latestRowMatch = latestUpdatedRange.match(/:(\d+)$/);

      const latestNewRowIndex = latestRowMatch ? parseInt(latestRowMatch[1]) - 1 : null;



      if (latestNewRowIndex !== null) {

        const latestCreatedAtColIndex = latestHeaders.indexOf('생성일시');



        const latestFormatRequests = [{

          repeatCell: {

            range: {

              sheetId: latestSheetId,

              startRowIndex: latestNewRowIndex,

              endRowIndex: latestNewRowIndex + 1

            },

            cell: {

              userEnteredFormat: {

                wrapStrategy: 'WRAP'

              }

            },

            fields: 'userEnteredFormat.wrapStrategy'

          }

        }];



        // 생성일시 컬럼에 datetime 형식 적용

        if (latestCreatedAtColIndex !== -1) {

          latestFormatRequests.push({

            repeatCell: {

              range: {

                sheetId: latestSheetId,

                startRowIndex: latestNewRowIndex,

                endRowIndex: latestNewRowIndex + 1,

                startColumnIndex: latestCreatedAtColIndex,

                endColumnIndex: latestCreatedAtColIndex + 1

              },

              cell: {

                userEnteredFormat: {

                  numberFormat: {

                    type: 'DATE_TIME',

                    pattern: 'yyyy-mm-dd hh:mm:ss'

                  }

                }

              },

              fields: 'userEnteredFormat.numberFormat'

            }

          });

        }

        // 행 높이 21로 고정
        latestFormatRequests.push({
          updateDimensionProperties: {
            range: {
              sheetId: latestSheetId,
              dimension: 'ROWS',
              startIndex: latestNewRowIndex,
              endIndex: latestNewRowIndex + 1
            },
            properties: {
              pixelSize: 21
            },
            fields: 'pixelSize'
          }
        });

        const latestFormatResponse = await fetchWithTimeout(

          `https://sheets.googleapis.com/v4/spreadsheets/${env.SHEETS_ID}:batchUpdate`,

          {

            method: 'POST',

            headers: {

              'Authorization': `Bearer ${accessToken}`,

              'Content-Type': 'application/json'

            },

            body: JSON.stringify({ requests: latestFormatRequests })

          },

          10000

        );



        if (!latestFormatResponse.ok) {

          console.error(`최신 포스팅 행 서식 설정 실패: ${latestFormatResponse.status}`);

        } else {

          console.log(`최신 포스팅 행 ${latestNewRowIndex + 1} 서식 설정 완료 (높이 21px, 줄바꿈 CLIP)`);

        }

      }

    }

  } catch (error) {

    console.error(`최신 포스팅 행 서식 설정 중 에러: ${error.message}`);

  }



  // 6. 최신 포스팅 저장 성공 → 이제 저장소에 저장 (실패해도 무시)

  try {



  // 헤더 순서대로 rowData 생성

  const archiveRowData = archiveHeaders.map(header => postDataMap[header] || '');

  console.log('[INFO] 저장소 저장:', { sheet: archiveSheetName, headersCount: archiveHeaders.length, dataLength: archiveRowData.length });



  // 저장소 탭에 append

  const archiveAppendResponse = await fetchWithTimeout(

    `https://sheets.googleapis.com/v4/spreadsheets/${env.SHEETS_ID}/values/${encodeURIComponent(archiveSheetName)}!A:Z:append?valueInputOption=USER_ENTERED`,

    {

      method: 'POST',

      headers: {

        'Authorization': `Bearer ${accessToken}`,

        'Content-Type': 'application/json'

      },

      body: JSON.stringify({ values: [archiveRowData] })

    },

    10000

  );



  if (!archiveAppendResponse.ok) {

    const errorText = await archiveAppendResponse.text();

    console.error(`저장소 시트 append 실패: ${archiveAppendResponse.status} - ${errorText}`);

    // 최신 포스팅은 이미 저장됨, 저장소 저장 실패는 치명적이지 않음

  } else {

    console.log('[SUCCESS] 저장소 저장 완료');

    // 저장소 시트에 새로 추가된 행의 높이와 텍스트 줄바꿈 설정

    try {

      const appendResult = await archiveAppendResponse.json();

      const updatedRange = appendResult.updates?.updatedRange;



      if (updatedRange) {

        // 범위에서 행 번호 추출 (예: "저장소!A20:I20" → 20)

        const rowMatch = updatedRange.match(/:(\d+)$/);

        const newRowIndex = rowMatch ? parseInt(rowMatch[1]) - 1 : null;



        if (newRowIndex !== null) {

          // 행 높이 21px + 텍스트 줄바꿈 WRAP + 생성일시 datetime 형식

          const createdAtColIndex = archiveHeaders.indexOf('생성일시');



          const formatRequests = [{

            updateDimensionProperties: {

              range: {

                sheetId: archiveSheetId,

                dimension: 'ROWS',

                startIndex: newRowIndex,

                endIndex: newRowIndex + 1

              },

              properties: {

                pixelSize: 21

              },

              fields: 'pixelSize'

            }

          }, {

            repeatCell: {

              range: {

                sheetId: archiveSheetId,

                startRowIndex: newRowIndex,

                endRowIndex: newRowIndex + 1

              },

              cell: {

                userEnteredFormat: {

                  wrapStrategy: 'WRAP'

                }

              },

              fields: 'userEnteredFormat.wrapStrategy'

            }

          }];



          // 생성일시 컬럼에 datetime 형식 적용

          if (createdAtColIndex !== -1) {

            formatRequests.push({

              repeatCell: {

                range: {

                  sheetId: archiveSheetId,

                  startRowIndex: newRowIndex,

                  endRowIndex: newRowIndex + 1,

                  startColumnIndex: createdAtColIndex,

                  endColumnIndex: createdAtColIndex + 1

                },

                cell: {

                  userEnteredFormat: {

                    numberFormat: {

                      type: 'DATE_TIME',

                      pattern: 'yyyy-mm-dd hh:mm:ss'

                    }

                  }

                },

                fields: 'userEnteredFormat.numberFormat'

              }

            });

          }



          const formatResponse = await fetchWithTimeout(

            `https://sheets.googleapis.com/v4/spreadsheets/${env.SHEETS_ID}:batchUpdate`,

            {

              method: 'POST',

              headers: {

                'Authorization': `Bearer ${accessToken}`,

                'Content-Type': 'application/json'

              },

              body: JSON.stringify({ requests: formatRequests })

            },

            10000

          );



          if (!formatResponse.ok) {

            console.error(`저장소 행 서식 설정 실패: ${formatResponse.status}`);

          } else {

            console.log(`저장소 행 ${newRowIndex + 1} 서식 설정 완료 (높이 21px, 줄바꿈 WRAP)`);

          }

        }

      }

    } catch (error) {

      console.error(`저장소 행 서식 설정 중 에러: ${error.message}`);

    }

  }



  // 7. 관리자 시트의 열 너비를 저장소 시트에 복사

  try {

    if (!adminSheet || !adminSheet.data || !adminSheet.data[0] || !adminSheet.data[0].columnMetadata) {

      console.error('관리자 시트 열 너비 정보를 찾을 수 없음');

      return;

    }



    const columnWidths = adminSheet.data[0].columnMetadata.slice(0, 9).map(col => col.pixelSize || 100);

    console.log(`관리자 시트 열 너비 (복사할 값): ${JSON.stringify(columnWidths)}`);



    // 저장소 시트에 열 너비 적용

    const updateRequests = columnWidths.map((width, i) => ({

      updateDimensionProperties: {

        range: {

          sheetId: archiveSheetId,

          dimension: 'COLUMNS',

          startIndex: i,

          endIndex: i + 1

        },

        properties: {

          pixelSize: width

        },

        fields: 'pixelSize'

      }

    }));



    const updateResponse = await fetch(

      `https://sheets.googleapis.com/v4/spreadsheets/${env.SHEETS_ID}:batchUpdate`,

      {

        method: 'POST',

        headers: {

          'Authorization': `Bearer ${accessToken}`,

          'Content-Type': 'application/json'

        },

        body: JSON.stringify({ requests: updateRequests })

      }

    );



    if (!updateResponse.ok) {

      const errorText = await updateResponse.text();

      console.error(`저장소 시트 열 너비 업데이트 실패: ${updateResponse.status} - ${errorText}`);

    } else {

      console.log('저장소 시트 열 너비 업데이트 성공 (관리자 시트 기준)');

    }

  } catch (error) {

    console.error(`열 너비 복사 중 에러: ${error.message}`);

  }

  } catch (archiveError) {

    // 저장소 저장 실패해도 무시 (최신 포스팅은 이미 저장됨)

    console.error('[ERROR] 저장소 저장 실패:', archiveError.message);

    console.log('[INFO] 최신 포스팅 저장은 성공, 저장소만 실패 (무시하고 계속)');

  }

  // 상호명 컬럼 너비 자동 조정
  try {
    await autoResizeBusinessNameColumns(env);
  } catch (resizeError) {
    console.error('[ERROR] 컬럼 너비 조정 실패:', resizeError.message);
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
  removeDuplicatesFromLatestPosting,
  saveToLatestPostingSheet
};
