/**
 * Google Sheets Helper - Service Account 기반
 * Claude가 Sheets를 자유롭게 읽고 쓸 수 있도록 함
 */

const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');

// Service Account 키 파일 경로
const KEY_FILE = process.env.GOOGLE_APPLICATION_CREDENTIALS ||
                 path.join(process.env.USERPROFILE, '.config', 'gcloud', 'content-factory-sa-key.json');

const SPREADSHEET_ID = '1KrzLFi8Wt9GTGT97gcMoXnbZ3OJ04NsP4lncJyIdyhU';

// 인증 및 Sheets API 클라이언트 생성
async function getAuthClient() {
  const auth = new google.auth.GoogleAuth({
    keyFile: KEY_FILE,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  return auth.getClient();
}

async function getSheetsClient() {
  const authClient = await getAuthClient();
  return google.sheets({ version: 'v4', auth: authClient });
}

// ===== 읽기 함수 =====

/**
 * 특정 시트의 전체 데이터 읽기
 */
async function readSheet(sheetName, range = 'A:Z') {
  const sheets = await getSheetsClient();
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${sheetName}!${range}`,
  });
  return response.data.values || [];
}

/**
 * 관리자 시트에서 활성 거래처 가져오기
 */
async function getActiveClients() {
  const data = await readSheet('관리자');
  const headers = data[0];
  const rows = data.slice(1);

  const domainIdx = headers.indexOf('도메인');
  const subscriptionIdx = headers.indexOf('구독');

  return rows
    .filter(row => row[subscriptionIdx] === '활성')
    .map(row => {
      const client = {};
      headers.forEach((header, idx) => {
        client[header] = row[idx] || '';
      });
      return client;
    });
}

// ===== 쓰기 함수 =====

/**
 * 특정 시트에 행 추가
 */
async function appendRow(sheetName, values) {
  const sheets = await getSheetsClient();
  const response = await sheets.spreadsheets.values.append({
    spreadsheetId: SPREADSHEET_ID,
    range: `${sheetName}!A:A`,
    valueInputOption: 'USER_ENTERED',
    requestBody: {
      values: [values],
    },
  });
  return response.data;
}

/**
 * 특정 셀 업데이트
 */
async function updateCell(sheetName, cell, value) {
  const sheets = await getSheetsClient();
  const response = await sheets.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range: `${sheetName}!${cell}`,
    valueInputOption: 'USER_ENTERED',
    requestBody: {
      values: [[value]],
    },
  });
  return response.data;
}

/**
 * 범위 업데이트
 */
async function updateRange(sheetName, range, values) {
  const sheets = await getSheetsClient();
  const response = await sheets.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range: `${sheetName}!${range}`,
    valueInputOption: 'USER_ENTERED',
    requestBody: {
      values: values,
    },
  });
  return response.data;
}

/**
 * 시트 데이터 전체 삭제 (헤더 제외)
 */
async function clearSheet(sheetName, keepHeaders = true) {
  const sheets = await getSheetsClient();
  const range = keepHeaders ? `${sheetName}!A2:Z` : `${sheetName}!A:Z`;
  const response = await sheets.spreadsheets.values.clear({
    spreadsheetId: SPREADSHEET_ID,
    range: range,
  });
  return response.data;
}

// ===== 유틸리티 =====

/**
 * KST 현재 시간
 */
function getKSTNow() {
  const now = new Date();
  return new Date(now.getTime() + (9 * 60 * 60 * 1000));
}

/**
 * KST 날짜 문자열 (YYYY-MM-DD)
 */
function getKSTDateString() {
  const kst = getKSTNow();
  return kst.toISOString().split('T')[0];
}

/**
 * KST 시간 문자열 (HH:mm:ss)
 */
function getKSTTimeString() {
  const kst = getKSTNow();
  return kst.toISOString().split('T')[1].split('.')[0];
}

// ===== Export =====

module.exports = {
  readSheet,
  getActiveClients,
  appendRow,
  updateCell,
  updateRange,
  clearSheet,
  getKSTNow,
  getKSTDateString,
  getKSTTimeString,
};

// ===== CLI 테스트 =====

if (require.main === module) {
  (async () => {
    try {
      console.log('📊 Sheets Helper 테스트\n');

      console.log('1. 활성 거래처 조회...');
      const clients = await getActiveClients();
      console.log(`   활성 거래처: ${clients.length}개`);
      clients.forEach(c => console.log(`   - ${c['도메인']}: ${c['상호명']}`));

      console.log('\n2. 배포일지 테스트 로그 추가...');
      await appendRow('배포일지', [
        getKSTDateString(),
        getKSTTimeString(),
        'test',
        'Sheets Helper 테스트',
        'manual',
        'Service Account 연동 테스트'
      ]);
      console.log('   ✅ 추가 완료');

      console.log('\n✅ 모든 테스트 통과');
    } catch (error) {
      console.error('❌ 에러:', error.message);
      if (error.message.includes('ENOENT')) {
        console.error('\n💡 Service Account 키 파일을 찾을 수 없습니다.');
        console.error(`   경로: ${KEY_FILE}`);
      }
    }
  })();
}
