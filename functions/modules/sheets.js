// Google Sheets CRUD

const { fetchWithTimeout, parseCSV, parseCSVLine, normalizeClient, normalizeLanguage, getColumnLetter, removeLanguageSuffixFromBusinessName, normalizeSubdomain } = require('./utils.js');
const { getGoogleAccessTokenForPosting } = require('./auth.js');
const { translateWithCache } = require('./translation-cache.js');

async function updateUmamiToSheet(subdomain, websiteId, shareId, env) {
  try {
    const accessToken = await getGoogleAccessTokenForPosting(env);
    
    // 관리자 시트 읽기
    const sheetResponse = await fetchWithTimeout(
      `https://sheets.googleapis.com/v4/spreadsheets/${env.SHEETS_ID}/values/'관리자'!A:Z`,
      { headers: { Authorization: `Bearer ${accessToken}` } },
      10000
    );

    if (!sheetResponse.ok) {
      console.error('시트 읽기 실패');
      return false;
    }

    const sheetData = await sheetResponse.json();
    const rows = sheetData.values || [];
    
    if (rows.length < 2) return false;

    const headers = rows[0];
    const domainIndex = headers.indexOf('도메인');
    const umamiIndex = headers.indexOf('우마미');
    const umamiShareIndex = headers.indexOf('우마미_공유');

    if (domainIndex === -1 || umamiIndex === -1 || umamiShareIndex === -1) {
      console.error('필수 컬럼 없음');
      return false;
    }

    // 해당 거래처 행 찾기
    let targetRowIndex = -1;
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      const rowDomain = normalizeSubdomain(row[domainIndex] || '');
      if (rowDomain === subdomain) {
        targetRowIndex = i + 1;
        break;
      }
    }

    if (targetRowIndex === -1) {
      console.error('거래처 행을 찾을 수 없음');
      return false;
    }

    // 일괄 업데이트
    const umamiCol = getColumnLetter(umamiIndex);
    const shareCol = getColumnLetter(umamiShareIndex);

    const updateData = [
      {
        range: `관리자!${umamiCol}${targetRowIndex}`,
        values: [[websiteId]]
      },
      {
        range: `관리자!${shareCol}${targetRowIndex}`,
        values: [[shareId]]
      }
    ];

    const batchUpdateResponse = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${env.SHEETS_ID}/values:batchUpdate`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          valueInputOption: 'RAW',
          data: updateData
        })
      }
    );

    if (batchUpdateResponse.ok) {
      console.log('Umami 정보 시트 업데이트 성공');
      return true;
    } else {
      console.error('시트 업데이트 실패:', batchUpdateResponse.status);
      return false;
    }
  } catch (error) {
    console.error('시트 업데이트 중 에러:', error);
    return false;
  }
}

async function getClientFromSheets(clientId, env) {

  try {

    const SHEET_URL = env.GOOGLE_SHEETS_CSV_URL || 'https://docs.google.com/spreadsheets/d/1KrzLFi8Wt9GTGT97gcMoXnbZ3OJ04NsP4lncJyIdyhU/export?format=csv&gid=0';

    const response = await fetchWithTimeout(SHEET_URL, {}, 10000);

    const csvText = await response.text();

    

    // 수동 파싱 및 디버그 정보 수집

    const lines = csvText.trim().split('\n');

    const headers = parseCSVLine(lines[0]).map(h => h.replace(/^\uFEFF/, '').trim());

    const debugInfo = { headers, rawLine: lines[0] };



    const clients = [];

    for (let i = 1; i < lines.length; i++) {

      const values = parseCSVLine(lines[i]);

      const client = {};

      headers.forEach((header, index) => {

        client[header] = values[index] || '';

      });

      clients.push(client);

    }



    const normalizedClients = clients.map(normalizeClient);



    const client = normalizedClients.find(c => {

      // subdomain 정규화: "00001.make-page.com" → "00001"

      let normalizedSubdomain = c.subdomain || '';

      if (normalizedSubdomain.includes('.make-page.com')) {

        normalizedSubdomain = normalizeSubdomain(normalizedSubdomain);

      }

      return normalizedSubdomain === clientId;

    });



    // Posts 조회 추가 (최신 포스팅 + 저장소)

    if (client) {

      const postsResult = await getPostsFromArchive(clientId, env);

      client.posts = postsResult.posts;

      if (postsResult.error) {

        debugInfo.postsError = postsResult.error;

      }

    }

    // 상호명에서 언어 표시 자동 제거
    if (client && client.business_name) {
      client.business_name = removeLanguageSuffixFromBusinessName(client.business_name);
    }

    // Sheets 데이터 번역 (언어가 한국어가 아닐 때)
    if (client && client.language) {
      const langCode = normalizeLanguage(client.language);
      if (langCode !== 'ko') {
        // 번역할 필드 수집
        const fieldsToTranslate = [];
        if (client.business_name) fieldsToTranslate.push({ key: 'business_name', value: client.business_name });
        if (client.address) fieldsToTranslate.push({ key: 'address', value: client.address });
        if (client.business_hours) fieldsToTranslate.push({ key: 'business_hours', value: client.business_hours });
        if (client.contact) fieldsToTranslate.push({ key: 'contact', value: client.contact });
        if (client.description) fieldsToTranslate.push({ key: 'description', value: client.description });

        if (fieldsToTranslate.length > 0) {
          try {
            const subdomain = normalizeSubdomain(client.subdomain);
            const translations = await translateWithCache(fieldsToTranslate, langCode, subdomain, env);

            if (translations.business_name) client.business_name = translations.business_name;
            if (translations.address) client.address = translations.address;
            if (translations.business_hours) client.business_hours = translations.business_hours;
            if (translations.contact) client.contact = translations.contact;
            if (translations.description) client.description = translations.description;
          } catch (error) {
            console.error('Translation error:', error);
            // 번역 실패 시 원본 유지
          }
        }
      }
    }




    return { client, debugInfo };

  } catch (error) {

    console.error('Google Sheets fetch error:', error);

    return { client: null, debugInfo: { error: error.message } };

  }

}

async function getPostsFromArchive(subdomain, env) {

  try {

    // Step 1: 토큰 발급

    let accessToken;

    try {

      accessToken = await getGoogleAccessTokenForPosting(env);

    } catch (tokenError) {

      return { posts: [], error: `Token error: ${tokenError.message}` };

    }



    const latestSheetName = env.LATEST_POSTING_SHEET_NAME || '최신 포스팅';
    const archiveSheetName = env.ARCHIVE_SHEET_NAME || '저장소';

    const allPosts = [];



    // Step 2: 최신_포스팅 시트 읽기

    const latestResponse = await fetch(

      `https://sheets.googleapis.com/v4/spreadsheets/${env.SHEETS_ID}/values/${encodeURIComponent(latestSheetName)}!A:Z`,

      { headers: { Authorization: `Bearer ${accessToken}` } }

    );



    if (latestResponse.ok) {

      const latestData = await latestResponse.json();

      const latestRows = latestData.values || [];



      if (latestRows.length >= 2) {

        const headers = latestRows[0];

        const domainIndex = headers.indexOf('도메인');

        const businessNameIndex = headers.indexOf('상호명');

        const titleIndex = headers.indexOf('제목');

        const createdAtIndex = headers.indexOf('생성일시');

        const languageIndex = headers.indexOf('언어');

        const industryIndex = headers.indexOf('업종');

        const bodyIndex = headers.indexOf('본문');

        const imagesIndex = headers.indexOf('이미지');



        if (domainIndex !== -1) {

          for (let i = 1; i < latestRows.length; i++) {

            const row = latestRows[i];

            const domain = row[domainIndex] || '';

            const normalizedDomain = normalizeSubdomain(domain);

            const normalizedSubdomain = normalizeSubdomain(domain);



            if (normalizedDomain === normalizedSubdomain) {

              allPosts.push({

                subdomain: domain,

                business_name: businessNameIndex !== -1 ? (row[businessNameIndex] || '') : '',

                title: titleIndex !== -1 ? (row[titleIndex] || '') : '',

                created_at: createdAtIndex !== -1 ? (row[createdAtIndex] || '') : '',

                language: languageIndex !== -1 ? (row[languageIndex] || '') : '',

                industry: industryIndex !== -1 ? (row[industryIndex] || '') : '',

                body: bodyIndex !== -1 ? (row[bodyIndex] || '') : '',

                images: imagesIndex !== -1 ? (row[imagesIndex] || '') : ''

              });

            }

          }

        }

      }

    }



    // Step 3: 저장소 시트 읽기

    const archiveResponse = await fetch(

      `https://sheets.googleapis.com/v4/spreadsheets/${env.SHEETS_ID}/values/${encodeURIComponent(archiveSheetName)}!A:Z`,

      { headers: { Authorization: `Bearer ${accessToken}` } }

    );



    if (archiveResponse.ok) {

      const archiveData = await archiveResponse.json();

      const archiveRows = archiveData.values || [];



      if (archiveRows.length >= 2) {

        const headers = archiveRows[0];

        const domainIndex = headers.indexOf('도메인');

        const businessNameIndex = headers.indexOf('상호명');

        const titleIndex = headers.indexOf('제목');

        const createdAtIndex = headers.indexOf('생성일시');

        const languageIndex = headers.indexOf('언어');

        const industryIndex = headers.indexOf('업종');

        const bodyIndex = headers.indexOf('본문');

        const imagesIndex = headers.indexOf('이미지');



        if (domainIndex !== -1) {

          for (let i = 1; i < archiveRows.length; i++) {

            const row = archiveRows[i];

            const domain = row[domainIndex] || '';

            const normalizedDomain = normalizeSubdomain(domain);

            const normalizedSubdomain = normalizeSubdomain(domain);



            if (normalizedDomain === normalizedSubdomain) {

              const createdAt = createdAtIndex !== -1 ? (row[createdAtIndex] || '') : '';

              const language = languageIndex !== -1 ? (row[languageIndex] || '') : '';

              const industry = industryIndex !== -1 ? (row[industryIndex] || '') : '';

              const body = bodyIndex !== -1 ? (row[bodyIndex] || '') : '';

              const images = imagesIndex !== -1 ? (row[imagesIndex] || '') : '';



              // 중복 방지: 동일 created_at이 최신_포스팅에 없을 때만 추가

              const existsInLatest = allPosts.some(p => p.created_at === createdAt);

              if (!existsInLatest && createdAt) {

                allPosts.push({

                  subdomain: domain,

                  business_name: businessNameIndex !== -1 ? (row[businessNameIndex] || '') : '',

                  title: titleIndex !== -1 ? (row[titleIndex] || '') : '',

                  created_at: createdAt,

                  language: language,

                  industry: industry,

                  body: body,

                  images: images

                });

              }

            }

          }

        }

      }

    }



    // created_at 기준 내림차순 정렬 (최신순)

    allPosts.sort((a, b) => {

      const dateA = new Date(a.created_at);

      const dateB = new Date(b.created_at);

      return dateB - dateA;

    });



    return { posts: allPosts, error: null };

  } catch (error) {

    console.error('Error fetching posts from sheets:', error);

    return { posts: [], error: `${error.message} (${error.stack?.substring(0, 100) || 'no stack'})` };

  }

}

async function getSheetId(sheetsId, sheetName, accessToken) {

  const response = await fetch(

    `https://sheets.googleapis.com/v4/spreadsheets/${sheetsId}?fields=sheets(properties(sheetId,title))`,

    { headers: { Authorization: `Bearer ${accessToken}` } }

  );

  const data = await response.json();

  const sheet = data.sheets.find(s => s.properties.title === sheetName);

  return sheet ? sheet.properties.sheetId : 0;

}

async function autoResizeBusinessNameColumns(env) {
  try {
    const accessToken = await getGoogleAccessTokenForPosting(env);

    const response = await fetchWithTimeout(
      `https://sheets.googleapis.com/v4/spreadsheets/${env.SHEETS_ID}?fields=sheets(properties(title,sheetId))`,
      { headers: { Authorization: `Bearer ${accessToken}` } },
      10000
    );

    if (!response.ok) {
      console.error('시트 메타데이터 조회 실패');
      return false;
    }

    const data = await response.json();
    const sheets = data.sheets;

    const adminSheet = sheets.find(s => s.properties.title === '관리자');
    const latestSheet = sheets.find(s => s.properties.title === '최신_포스팅' || s.properties.title === '최신 포스팅');
    const archiveSheet = sheets.find(s => s.properties.title === '저장소');

    const requests = [];

    if (adminSheet) {
      requests.push({
        autoResizeDimensions: {
          dimensions: {
            sheetId: adminSheet.properties.sheetId,
            dimension: 'COLUMNS',
            startIndex: 3,
            endIndex: 4
          }
        }
      });
    }

    if (latestSheet) {
      requests.push({
        autoResizeDimensions: {
          dimensions: {
            sheetId: latestSheet.properties.sheetId,
            dimension: 'COLUMNS',
            startIndex: 1,
            endIndex: 2
          }
        }
      });
    }

    if (archiveSheet) {
      requests.push({
        autoResizeDimensions: {
          dimensions: {
            sheetId: archiveSheet.properties.sheetId,
            dimension: 'COLUMNS',
            startIndex: 1,
            endIndex: 2
          }
        }
      });
    }

    if (requests.length === 0) {
      console.log('조정할 컬럼 없음');
      return true;
    }

    const updateResponse = await fetchWithTimeout(
      `https://sheets.googleapis.com/v4/spreadsheets/${env.SHEETS_ID}:batchUpdate`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ requests })
      },
      10000
    );

    if (updateResponse.ok) {
      console.log('상호명 컬럼 너비 자동 조정 성공');
      return true;
    } else {
      console.error('컬럼 너비 조정 실패:', updateResponse.status);
      return false;
    }
  } catch (error) {
    console.error('컬럼 너비 조정 중 에러:', error);
    return false;
  }
}
module.exports = { getClientFromSheets, getPostsFromArchive };
