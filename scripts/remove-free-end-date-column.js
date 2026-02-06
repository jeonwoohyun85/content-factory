// 무료 종료일 컬럼 제거 스크립트
const { google } = require('googleapis');
const path = require('path');

const SPREADSHEET_ID = '1KrzLFi8Wt9GTGT97gcMoXnbZ3OJ04NsP4lncJyIdyhU';
const SHEET_NAME = '관리자';

async function removeFreeEndDateColumn() {
  try {
    const auth = new google.auth.GoogleAuth({
      keyFile: path.join(process.env.USERPROFILE, '.config', 'gcloud', 'content-factory-sa-key.json'),
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });

    const sheets = google.sheets({ version: 'v4', auth });

    // C열(무료 종료일) 내용 삭제
    await sheets.spreadsheets.values.clear({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEET_NAME}!C:C`,
    });

    console.log('✅ 무료 종료일 컬럼 삭제 완료');

  } catch (error) {
    console.error('❌ 에러:', error.message);
  }
}

removeFreeEndDateColumn();
