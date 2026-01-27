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

    // Step 2: 웹 검색 (Gemini 2.5 Flash)
    logs.push('웹 검색 시작...');
    const trendsData = await searchWithGemini(client, env);
    logs.push(`웹 검색 완료: ${trendsData.substring(0, 100)}...`);

    // Step 3: 포스팅 생성 (Gemini 3.0 Pro)
    logs.push('포스팅 생성 시작...');
    const postData = await generatePostWithGemini(client, trendsData, env);
    logs.push(`포스팅 생성 완료: ${postData.title}`);

    // Step 4: Posts 시트에 저장
    logs.push('Posts 시트 저장 시작...');
    await saveToPostsSheet(client, postData, env);
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

다음 정보를 500자 이내로 작성:
1. ${client.language} 시장의 최신 트렌드
2. 검색 키워드 상위 5개
3. 소비자 관심사

출력 형식: 텍스트만 (JSON 불필요)
`;

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${GEMINI_API_KEY}`,
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
async function generatePostWithGemini(client, trendsData, env) {
  const prompt = `
[거래처 정보]
- 업체명: ${client.business_name}
- 언어: ${client.language}
- 소개: ${client.description}

[트렌드 정보]
${trendsData}

[작성 규칙]
1. 제목: 완전 자유 창작 (제한 없음)
2. 본문: 2000~2500자
3. 금지어: 최고, 1등, 유일, 검증된
4. 금지 창작: 경력, 학력, 자격증, 수상
5. description 내용을 자연스럽게 포함 (필수)

출력 형식 (JSON):
{
  "title": "제목",
  "body": "본문 (HTML 태그 없이 일반 텍스트)"
}
`;

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-thinking-exp-1219:generateContent?key=${GEMINI_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [{ text: prompt }]
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
                columnCount: 6
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
  const headers = [['subdomain', 'business_name', 'language', 'title', 'body', 'created_at']];

  await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${env.SHEETS_ID}/values/Posts!A1:F1?valueInputOption=RAW`,
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
    scope: 'https://www.googleapis.com/auth/spreadsheets',
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

// Posts 시트에 저장
async function saveToPostsSheet(client, postData, env) {
  const accessToken = await getGoogleAccessToken(env);

  // Append to Posts sheet
  const timestamp = new Date().toISOString();
  const values = [[
    client.subdomain,
    client.business_name,
    client.language,
    postData.title,
    postData.body,
    timestamp
  ]];

  await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${env.SHEETS_ID}/values/Posts!A:F:append?valueInputOption=RAW`,
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
