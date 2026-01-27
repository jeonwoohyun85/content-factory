// Content Factory - 포스팅 자동 생성 Worker
// 단일 책임: Gemini API를 사용한 블로그 포스팅 자동 생성

const GOOGLE_SHEETS_CSV_URL = 'https://docs.google.com/spreadsheets/d/1KrzLFi8Wt9GTGT97gcMoXnbZ3OJ04NsP4lncJyIdyhU/export?format=csv&gid=0';
const GEMINI_API_KEY = 'AIzaSyCGaxsMXJ5UvUrU9wQCOH2ou7m9TP2pB88';

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // Create Posts sheet
    if (url.pathname === '/create-posts-sheet' && request.method === 'GET') {
      try {
        const result = await createPostsSheet(env);
        return new Response(JSON.stringify(result), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      } catch (error) {
        return new Response(JSON.stringify({
          error: error.message,
          stack: error.stack
        }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    }

    // Fix Posts sheet row height
    if (url.pathname === '/fix-posts-row-height' && request.method === 'GET') {
      try {
        const result = await fixPostsRowHeight(env);
        return new Response(JSON.stringify(result), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      } catch (error) {
        return new Response(JSON.stringify({
          error: error.message,
          stack: error.stack
        }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    }

    // Manual trigger for testing
    if (request.method === 'POST') {
      try {
        const { subdomain } = await request.json();
        const result = await generatePostingForClient(subdomain, env);
        return new Response(JSON.stringify(result), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      } catch (error) {
        return new Response(JSON.stringify({
          error: error.message,
          stack: error.stack
        }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    }
    return new Response('Posting Generator Worker', { status: 200 });
  }
};

async function generatePostingForClient(subdomain, env) {
  const logs = [];

  try {
    // Step 1: 거래처 정보 조회
    logs.push('거래처 정보 조회 중...');
    const client = await getClientFromSheets(subdomain);
    if (!client) {
      return { success: false, error: 'Client not found', logs };
    }
    logs.push(`거래처: ${client.business_name}`);

    // Step 1.5: Google Drive 폴더 순환 선택
    logs.push('Google Drive 폴더 조회 중...');
    const accessToken = await getGoogleAccessToken(env);
    const driveBusinessName = `${client.subdomain} ${client.business_name}`;
    logs.push(`Drive 폴더명: ${driveBusinessName}`);
    const folders = await getClientFolders(driveBusinessName, accessToken, env, logs);

    if (folders.length === 0) {
      return { success: false, error: 'No folders found (Info/Video excluded)', logs };
    }

    logs.push(`폴더 ${folders.length}개 발견`);

    const lastUsedFolder = await getLastUsedFolder(subdomain, env);
    const nextFolder = getNextFolder(folders, lastUsedFolder);
    logs.push(`선택된 폴더: ${nextFolder}`);

    // Step 1.7: 선택된 폴더에서 모든 이미지 가져오기
    logs.push('폴더 내 이미지 조회 중...');
    const images = await getFolderImages(driveBusinessName, nextFolder, accessToken, env, logs);
    logs.push(`이미지 ${images.length}개 발견`);

    if (images.length === 0) {
      return { success: false, error: 'No images found in folder', logs };
    }

    // Step 2: 웹 검색 (Gemini 2.5 Flash)
    logs.push('웹 검색 시작...');
    const trendsData = await searchWithGemini(client, env);
    logs.push(`웹 검색 완료: ${trendsData.substring(0, 100)}...`);

    // Step 3: 포스팅 생성 (Gemini 3.0 Pro)
    logs.push('포스팅 생성 시작...');
    const postData = await generatePostWithGemini(client, trendsData, images, env);
    logs.push(`포스팅 생성 완료: ${postData.title}`);

    // Step 4: Posts 시트에 저장
    logs.push('Posts 시트 저장 시작...');
    await saveToPostsSheet(client, postData, nextFolder, images, env);
    logs.push('Posts 시트 저장 완료');

    return {
      success: true,
      post: postData,
      logs
    };

  } catch (error) {
    logs.push(`에러: ${error.message}`);
    return {
      success: false,
      error: error.message,
      logs
    };
  }
}

// Google Sheets에서 거래처 정보 조회
async function getClientFromSheets(subdomain) {
  const response = await fetch(GOOGLE_SHEETS_CSV_URL);
  const csvText = await response.text();
  const rows = csvText.split('\n').map(row => {
    const cols = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < row.length; i++) {
      const char = row[i];
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        cols.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    cols.push(current.trim());
    return cols;
  });

  const headers = rows[0];
  const subdomainIndex = headers.indexOf('subdomain');
  const businessNameIndex = headers.indexOf('business_name');
  const languageIndex = headers.indexOf('language');
  const descriptionIndex = headers.indexOf('description');
  const statusIndex = headers.indexOf('status');

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    let rowSubdomain = row[subdomainIndex] || '';

    // Normalize subdomain
    if (rowSubdomain.includes('.make-page.com')) {
      rowSubdomain = rowSubdomain.replace('.make-page.com', '').replace('/', '');
    }

    if (rowSubdomain === subdomain && row[statusIndex] === 'active') {
      return {
        subdomain: rowSubdomain,
        business_name: row[businessNameIndex],
        language: row[languageIndex] || '한국어',
        description: row[descriptionIndex] || ''
      };
    }
  }

  return null;
}

// Gemini 2.5 Flash로 웹 검색
async function searchWithGemini(client, env) {
  const prompt = `
[업종] ${client.business_name}
[언어] ${client.language}

다음 정보를 1000자 이내로 작성:
1. ${client.language} 시장의 최신 트렌드
2. 검색 키워드 상위 5개
3. 소비자 관심사

출력 형식: 텍스트만 (JSON 불필요)
`;

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [{ text: prompt }]
        }],
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 1000
        }
      })
    }
  );

  const data = await response.json();
  return data.candidates[0].content.parts[0].text;
}

// Gemini 3.0 Pro로 포스팅 생성
async function generatePostWithGemini(client, trendsData, images, env) {
  const prompt = `
[거래처 정보]
- 업체명: ${client.business_name}
- 언어: ${client.language}
- 소개: ${client.description}

[트렌드 정보]
${trendsData}

[제공된 이미지]
업로드된 ${images.length}장의 이미지를 참고하여 작성하세요.
이미지에서 보이는 내용(메뉴, 인테리어, 분위기 등)을 자연스럽게 본문에 녹여내세요.

[작성 규칙]
1. 제목: 완전 자유 창작 (제한 없음)
2. 본문: 3000~3500자
3. 금지어: 최고, 1등, 유일, 검증된
4. 금지 창작: 경력, 학력, 자격증, 수상
5. description 내용을 자연스럽게 포함 (필수)
6. 이미지 내용을 구체적으로 언급 (색상, 분위기, 특징 등)

출력 형식 (JSON):
{
  "title": "제목",
  "body": "본문 (HTML 태그 없이 일반 텍스트)"
}
`;

  // parts 배열 구성: 텍스트 프롬프트 + 이미지들
  const parts = [{ text: prompt }];

  for (const image of images) {
    parts.push({
      inline_data: {
        mime_type: image.mimeType,
        data: image.data
      }
    });
  }

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-pro-preview:generateContent?key=${GEMINI_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: parts
        }],
        generationConfig: {
          temperature: 0.8,
          maxOutputTokens: 8000
        }
      })
    }
  );

  const data = await response.json();

  // 응답 검증
  if (!data.candidates || data.candidates.length === 0) {
    throw new Error(`Gemini API error: ${JSON.stringify(data)}`);
  }

  const text = data.candidates[0].content.parts[0].text;

  // JSON 파싱
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    return JSON.parse(jsonMatch[0]);
  }

  throw new Error('Failed to parse Gemini response');
}

// Posts 시트 행 높이 조정
async function fixPostsRowHeight(env) {
  const accessToken = await getGoogleAccessToken(env);

  // Posts 시트의 모든 행 높이를 21px로 설정
  const updateResponse = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${env.SHEETS_ID}:batchUpdate`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        requests: [{
          updateDimensionProperties: {
            range: {
              sheetId: 1895987712, // Posts 시트 ID
              dimension: 'ROWS',
              startIndex: 0,
              endIndex: 1000
            },
            properties: {
              pixelSize: 21
            },
            fields: 'pixelSize'
          }
        }]
      })
    }
  );

  const updateData = await updateResponse.json();

  if (!updateResponse.ok) {
    throw new Error(`Failed to update row height: ${JSON.stringify(updateData)}`);
  }

  return {
    success: true,
    message: 'Row height updated to 21px'
  };
}

// Posts 시트 생성
async function createPostsSheet(env) {
  const accessToken = await getGoogleAccessToken(env);

  // 1. 새 시트 생성
  const createSheetResponse = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${env.SHEETS_ID}:batchUpdate`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        requests: [{
          addSheet: {
            properties: {
              title: 'Posts',
              gridProperties: {
                rowCount: 1000,
                columnCount: 8
              }
            }
          }
        }]
      })
    }
  );

  const createData = await createSheetResponse.json();

  if (!createSheetResponse.ok) {
    throw new Error(`Failed to create sheet: ${JSON.stringify(createData)}`);
  }

  // 2. 헤더 추가
  const headers = [['subdomain', 'business_name', 'language', 'title', 'body', 'created_at', 'folder_name', 'images']];

  await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${env.SHEETS_ID}/values/Posts!A1:H1?valueInputOption=RAW`,
    {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ values: headers })
    }
  );

  return {
    success: true,
    message: 'Posts sheet created successfully',
    sheetId: createData.replies[0].addSheet.properties.sheetId
  };
}

// Google Access Token 가져오기
async function getGoogleAccessToken(env) {
  const serviceAccount = JSON.parse(env.GOOGLE_SERVICE_ACCOUNT_JSON);

  const jwtHeader = btoa(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const now = Math.floor(Date.now() / 1000);
  const jwtClaimSet = {
    iss: serviceAccount.client_email,
    scope: 'https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/drive.readonly',
    aud: 'https://oauth2.googleapis.com/token',
    exp: now + 3600,
    iat: now
  };

  const jwtClaimSetEncoded = btoa(JSON.stringify(jwtClaimSet));
  const signatureInput = `${jwtHeader}.${jwtClaimSetEncoded}`;

  const privateKey = await crypto.subtle.importKey(
    'pkcs8',
    pemToArrayBuffer(serviceAccount.private_key),
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signature = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    privateKey,
    new TextEncoder().encode(signatureInput)
  );

  const jwtSignature = btoa(String.fromCharCode(...new Uint8Array(signature)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');

  const jwt = `${signatureInput}.${jwtSignature}`;

  const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`
  });

  const tokenData = await tokenResponse.json();
  return tokenData.access_token;
}

// 선택된 폴더에서 모든 이미지 파일 가져오기
async function getFolderImages(businessName, folderName, accessToken, env, logs) {
  const DRIVE_FOLDER_ID = env.DRIVE_FOLDER_ID || '1JiVmIkliR9YrPIUPOn61G8Oh7h9HTMEt';

  // 1. 거래처 폴더 찾기
  const businessFolderQuery = `mimeType = 'application/vnd.google-apps.folder' and name = '${businessName}' and '${DRIVE_FOLDER_ID}' in parents and trashed = false`;

  const businessFolderResponse = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(businessFolderQuery)}&fields=files(id,name)`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );

  const businessFolderData = await businessFolderResponse.json();
  if (!businessFolderData.files || businessFolderData.files.length === 0) {
    logs.push('이미지 조회: 거래처 폴더 없음');
    return [];
  }

  const businessFolderId = businessFolderData.files[0].id;
  logs.push(`이미지 조회: 거래처 폴더 ID ${businessFolderId}`);

  // 2. 타겟 폴더 찾기
  const targetFolderQuery = `mimeType = 'application/vnd.google-apps.folder' and name = '${folderName}' and '${businessFolderId}' in parents and trashed = false`;

  const targetFolderResponse = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(targetFolderQuery)}&fields=files(id,name)`,
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

  // 3. 폴더 내 모든 파일 조회 (확장자 제한 없음)
  const filesQuery = `'${targetFolderId}' in parents and trashed = false`;

  const filesResponse = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(filesQuery)}&fields=files(id,name,mimeType)&pageSize=100`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );

  const filesData = await filesResponse.json();
  logs.push(`파일 검색 결과: ${JSON.stringify(filesData)}`);

  const imageFiles = (filesData.files || []).filter(f => f.mimeType && f.mimeType.startsWith('image/'));
  logs.push(`이미지 파일 ${imageFiles.length}개 필터링됨`);

  // 4. 각 이미지 다운로드 및 Base64 인코딩
  const images = [];
  for (const file of imageFiles) {
    try {
      logs.push(`다운로드 시작: ${file.name}`);
      const imageResponse = await fetch(
        `https://www.googleapis.com/drive/v3/files/${file.id}?alt=media`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );

      if (!imageResponse.ok) {
        logs.push(`다운로드 실패: ${file.name} - ${imageResponse.status}`);
        continue;
      }

      const arrayBuffer = await imageResponse.arrayBuffer();
      const bytes = new Uint8Array(arrayBuffer);

      // 청크 단위로 Base64 인코딩 (스택 오버플로우 방지)
      let binary = '';
      const chunkSize = 8192;
      for (let i = 0; i < bytes.length; i += chunkSize) {
        const chunk = bytes.subarray(i, Math.min(i + chunkSize, bytes.length));
        binary += String.fromCharCode.apply(null, chunk);
      }
      const base64 = btoa(binary);

      images.push({
        id: file.id,
        name: file.name,
        mimeType: file.mimeType,
        data: base64
      });
      logs.push(`다운로드 완료: ${file.name}`);
    } catch (error) {
      logs.push(`다운로드 에러: ${file.name} - ${error.message}`);
    }
  }

  logs.push(`총 ${images.length}개 이미지 다운로드 완료`);
  return images;
}

// Google Drive에서 거래처 폴더의 하위 폴더 목록 조회 (Info, Video 제외)
async function getClientFolders(businessName, accessToken, env, logs) {
  const DRIVE_FOLDER_ID = env.DRIVE_FOLDER_ID || '1JiVmIkliR9YrPIUPOn61G8Oh7h9HTMEt';

  // 1. 거래처 폴더 찾기
  const businessFolderQuery = `mimeType = 'application/vnd.google-apps.folder' and name = '${businessName}' and '${DRIVE_FOLDER_ID}' in parents and trashed = false`;

  const businessFolderResponse = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(businessFolderQuery)}&fields=files(id,name)`,
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

  // 2. 하위 폴더 목록 조회
  const subFoldersQuery = `mimeType = 'application/vnd.google-apps.folder' and '${businessFolderId}' in parents and trashed = false`;

  const subFoldersResponse = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(subFoldersQuery)}&fields=files(id,name)&orderBy=name`,
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

// Posts 시트에서 마지막 사용 폴더 조회
async function getLastUsedFolder(subdomain, env) {
  try {
    const POSTS_SHEET_GID = '1895987712';
    const postsUrl = `https://docs.google.com/spreadsheets/d/${env.SHEETS_ID}/export?format=csv&gid=${POSTS_SHEET_GID}`;

    const response = await fetch(postsUrl);
    if (!response.ok) {
      return null;
    }

    const csvText = await response.text();
    const rows = csvText.split('\n').map(row => {
      const cols = [];
      let current = '';
      let inQuotes = false;
      for (let i = 0; i < row.length; i++) {
        const char = row[i];
        if (char === '"') {
          inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
          cols.push(current.trim());
          current = '';
        } else {
          current += char;
        }
      }
      cols.push(current.trim());
      return cols;
    });

    if (rows.length < 2) {
      return null;
    }

    const headers = rows[0];
    const subdomainIndex = headers.indexOf('subdomain');
    const folderNameIndex = headers.indexOf('folder_name');

    // subdomain으로 필터링하여 마지막 행 찾기
    let lastFolder = null;
    for (let i = rows.length - 1; i >= 1; i--) {
      const row = rows[i];
      if (row[subdomainIndex] === subdomain) {
        lastFolder = row[folderNameIndex] || null;
        break;
      }
    }

    return lastFolder;
  } catch (error) {
    return null;
  }
}

// 다음 폴더 선택 (순환)
function getNextFolder(folders, lastFolder) {
  if (folders.length === 0) {
    return null;
  }

  if (!lastFolder) {
    return folders[0]; // 첫 폴더
  }

  const currentIndex = folders.indexOf(lastFolder);
  if (currentIndex === -1) {
    return folders[0]; // 폴더 목록이 변경되었으면 첫 폴더
  }

  const nextIndex = (currentIndex + 1) % folders.length;
  return folders[nextIndex];
}

// Posts 시트에 저장
async function saveToPostsSheet(client, postData, folderName, images, env) {
  const accessToken = await getGoogleAccessToken(env);

  // 이미지 URL 생성 (Google Drive thumbnail)
  const imageUrls = images.map(img => `https://drive.google.com/thumbnail?id=${img.id}&sz=w800`).join(',');

  // Append to Posts sheet
  // 한국 시간 (UTC+9)
  const now = new Date();
  const koreaTime = new Date(now.getTime() + (9 * 60 * 60 * 1000));
  const timestamp = koreaTime.toISOString().replace('T', ' ').substring(0, 19);
  const values = [[
    client.subdomain,
    client.business_name,
    client.language,
    postData.title,
    postData.body,
    timestamp,
    folderName,
    imageUrls
  ]];

  await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${env.SHEETS_ID}/values/Posts!A:H:append?valueInputOption=RAW`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ values })
    }
  );
}

function pemToArrayBuffer(pem) {
  const b64 = pem
    .replace(/-----BEGIN PRIVATE KEY-----/, '')
    .replace(/-----END PRIVATE KEY-----/, '')
    .replace(/\s/g, '');

  const binaryString = atob(b64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
}
