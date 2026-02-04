// 포스팅 저장 (Sheets + Firestore)

const { fetchWithTimeout } = require('../utils/http-utils.js');
const { normalizeSubdomain } = require('../utils/normalize.js');

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

  // 4. Firestore 아카이브 (기존 데이터가 있으면 저장)
  if (existingRowIndex !== -1) {
    const existingRow = rows[existingRowIndex - 1];
    const existingData = {};
    headers.forEach((header, index) => {
      existingData[header] = existingRow[index] || '';
    });

    console.log(`[ARCHIVE] existingRowIndex: ${existingRowIndex}, 도메인: ${existingData['도메인']}, 생성일시: ${existingData['생성일시']}`);

    // Firestore에 아카이브 (기존 데이터만)
    if (existingData['도메인'] && existingData['생성일시']) {
      try {
        const archiveId = `${normalizedSubdomain}_${existingData['생성일시'].replace(/[:\s]/g, '-')}`;
        console.log(`[ARCHIVE] 아카이브 시작: ${archiveId}`);
        // TTL: 1년 후 자동 삭제
        const expireAt = new Date(new Date(timestamp).getTime() + (365 * 24 * 60 * 60 * 1000));

        await env.POSTING_KV.collection('posts_archive').doc(archiveId).set({
          subdomain: normalizedSubdomain,
          domain: existingData['도메인'],
          business_name: existingData['상호명'],
          title: existingData['제목'],
          url: existingData['URL'],
          created_at: existingData['생성일시'],
          language: existingData['언어'],
          industry: existingData['업종'],
          folder_name: existingData['폴더명'],
          body: existingData['본문'],
          images: existingData['이미지'],
          cron_date: existingData['크론'],
          archived_at: timestamp,
          expire_at: expireAt  // Firestore TTL 필드
        });
        console.log(`[ARCHIVE] 아카이브 완료: ${archiveId}`);
      } catch (archiveError) {
        console.error('[ARCHIVE] 아카이브 실패:', archiveError.message);
        // 아카이브 실패해도 계속 진행
      }
    } else {
      console.log(`[ARCHIVE] 조건 불만족 - 도메인: ${!!existingData['도메인']}, 생성일시: ${!!existingData['생성일시']}`);
    }
  } else {
    console.log('[ARCHIVE] 신규 포스팅 (아카이브 없음)');
  }

  // 5. UPDATE 또는 APPEND
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

module.exports = { saveToLatestPostingSheet };
