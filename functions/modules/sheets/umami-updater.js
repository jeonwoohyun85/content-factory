// Google Sheets Umami 정보 업데이트

const { fetchWithTimeout, getColumnLetter } = require('../utils/http-utils.js');
const { normalizeSubdomain } = require('../utils/normalize.js');
const { getGoogleAccessTokenForPosting } = require('../auth.js');

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

async function getSheetId(sheetsId, sheetName, accessToken) {

  const response = await fetch(

    `https://sheets.googleapis.com/v4/spreadsheets/${sheetsId}?fields=sheets(properties(sheetId,title))`,

    { headers: { Authorization: `Bearer ${accessToken}` } }

  );

  const data = await response.json();

  const sheet = data.sheets.find(s => s.properties.title === sheetName);

  return sheet ? sheet.properties.sheetId : 0;

}

module.exports = { updateUmamiToSheet, getSheetId };
