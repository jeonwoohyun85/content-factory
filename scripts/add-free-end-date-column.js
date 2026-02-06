// 무료 종료일 컬럼 추가 및 계산 스크립트
const { google } = require('googleapis');
const path = require('path');

const SPREADSHEET_ID = '1KrzLFi8Wt9GTGT97gcMoXnbZ3OJ04NsP4lncJyIdyhU';
const SHEET_NAME = '관리자';

async function addFreeEndDateColumn() {
  try {
    // Service Account 인증
    const auth = new google.auth.GoogleAuth({
      keyFile: path.join(process.env.USERPROFILE, '.config', 'gcloud', 'content-factory-sa-key.json'),
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });

    const sheets = google.sheets({ version: 'v4', auth });

    // 1. 헤더 행 읽기
    const headerResponse = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEET_NAME}!A1:Z1`,
    });

    const headers = headerResponse.data.values[0];
    console.log('현재 컬럼:', headers);

    // 2. "무료 종료일" 컬럼이 있는지 확인
    const freeEndDateIndex = headers.indexOf('무료 종료일');
    let targetCol;

    if (freeEndDateIndex !== -1) {
      console.log('무료 종료일 컬럼이 이미 존재합니다.');
      targetCol = String.fromCharCode(65 + freeEndDateIndex); // A=65
    } else {
      // 빈 컬럼 찾기 (가입일 바로 다음)
      const joinDateIndex = headers.indexOf('가입일');
      if (joinDateIndex === -1) {
        throw new Error('가입일 컬럼을 찾을 수 없습니다.');
      }

      // 가입일 다음 컬럼에 추가
      targetCol = String.fromCharCode(65 + joinDateIndex + 1);

      console.log(`무료 종료일 컬럼을 ${targetCol}열에 추가합니다...`);

      // 헤더 추가
      await sheets.spreadsheets.values.update({
        spreadsheetId: SPREADSHEET_ID,
        range: `${SHEET_NAME}!${targetCol}1`,
        valueInputOption: 'RAW',
        requestBody: {
          values: [['무료 종료일']],
        },
      });
    }

    // 3. 전체 데이터 읽기
    const dataResponse = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEET_NAME}!A2:Z100`,
    });

    const rows = dataResponse.data.values || [];
    console.log(`총 ${rows.length}개 행 처리 중...`);

    // 4. 각 행에 무료 종료일 계산 수식 추가
    const joinDateCol = String.fromCharCode(65 + headers.indexOf('가입일'));
    const updates = [];

    for (let i = 0; i < rows.length; i++) {
      const rowNum = i + 2;

      // 수식: 가입일이 있으면 익익월 1일 계산, 없으면 빈칸
      const formula = `=IF(${joinDateCol}${rowNum}="", "", DATE(YEAR(${joinDateCol}${rowNum}), MONTH(${joinDateCol}${rowNum})+2, 1))`;

      updates.push({
        range: `${SHEET_NAME}!${targetCol}${rowNum}`,
        values: [[formula]],
      });
    }

    // 배치 업데이트
    if (updates.length > 0) {
      await sheets.spreadsheets.values.batchUpdate({
        spreadsheetId: SPREADSHEET_ID,
        requestBody: {
          valueInputOption: 'USER_ENTERED',
          data: updates,
        },
      });
      console.log(`✅ ${updates.length}개 행에 무료 종료일 수식 추가 완료`);
    }

    console.log('\n📋 다음 단계:');
    console.log('1. 구글 시트에서 조건부 서식 설정');
    console.log(`2. ${targetCol}열(무료 종료일)에 조건부 서식 적용:`);
    console.log('   - 7일 전: 노란색');
    console.log('   - 3일 전: 빨간색');
    console.log('3. Apps Script 트리거 설정 (매일 실행)');

  } catch (error) {
    console.error('❌ 에러:', error.message);
    throw error;
  }
}

// 실행
addFreeEndDateColumn();
