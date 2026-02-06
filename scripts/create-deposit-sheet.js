const { google } = require('googleapis');

async function getAuthClient() {
  const auth = new google.auth.GoogleAuth({
    keyFile: 'C:\\Users\\A1-M4\\.config\\gcloud\\content-factory-sa-key.json',
    scopes: ['https://www.googleapis.com/auth/spreadsheets']
  });
  return await auth.getClient();
}

async function createDepositSheet() {
  const authClient = await getAuthClient();
  const sheets = google.sheets({ version: 'v4', auth: authClient });
  const spreadsheetId = '1KrzLFi8Wt9GTGT97gcMoXnbZ3OJ04NsP4lncJyIdyhU';
  const sheetName = '입금확인';

  try {
    // 시트 존재 확인
    const sheetMetadata = await sheets.spreadsheets.get({ spreadsheetId });
    const sheetExists = sheetMetadata.data.sheets.some(
      sheet => sheet.properties.title === sheetName
    );

    if (sheetExists) {
      console.log(`"${sheetName}" 시트가 이미 존재합니다.`);
      return;
    }

    // 시트 생성
    console.log(`"${sheetName}" 시트 생성 중...`);
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      resource: {
        requests: [{
          addSheet: {
            properties: { title: sheetName }
          }
        }]
      }
    });

    // 헤더 작성
    const headers = [
      '날짜',
      '입금자',
      '금액',
      '비고'
    ];

    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `${sheetName}!A1:D1`,
      valueInputOption: 'RAW',
      resource: { values: [headers] }
    });

    console.log(`✅ "${sheetName}" 시트 생성 완료`);
    console.log('\n사용 방법:');
    console.log('1. 토스뱅크 앱에서 거래내역 복사');
    console.log('2. 입금확인 시트에 붙여넣기 (A2 셀부터)');
    console.log('3. node scripts/process-deposit.js 실행');

  } catch (error) {
    console.error('❌ 오류:', error.message);
  }
}

createDepositSheet();
