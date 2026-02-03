/**
 * Content Factory - Google Apps Script
 * Google Sheets 및 Drive 접근 헬퍼 함수
 */

// ===== 설정 =====
const SPREADSHEET_ID = '1KrzLFi8Wt9GTGT97gcMoXnbZ3OJ04NsP4lncJyIdyhU';
const SHEET_NAMES = {
  ADMIN: '관리자',
  LATEST: '최신포스팅',
  ARCHIVE: '저장소',
  DEPLOY_LOG: '배포일지'
};

// ===== Sheets 헬퍼 함수 =====

/**
 * 특정 시트의 모든 데이터 가져오기
 */
function getSheetData(sheetName) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName(sheetName);

  if (!sheet) {
    throw new Error(`Sheet not found: ${sheetName}`);
  }

  const data = sheet.getDataRange().getValues();
  return data;
}

/**
 * 관리자 시트에서 활성 거래처 가져오기
 */
function getActiveClients() {
  const data = getSheetData(SHEET_NAMES.ADMIN);
  const headers = data[0];
  const rows = data.slice(1);

  const domainIdx = headers.indexOf('도메인');
  const subscriptionIdx = headers.indexOf('구독');

  const activeClients = rows.filter(row => {
    return row[subscriptionIdx] === '활성';
  }).map(row => {
    const client = {};
    headers.forEach((header, idx) => {
      client[header] = row[idx];
    });
    return client;
  });

  return activeClients;
}

/**
 * 특정 시트에 데이터 추가
 */
function appendToSheet(sheetName, values) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName(sheetName);

  if (!sheet) {
    throw new Error(`Sheet not found: ${sheetName}`);
  }

  sheet.appendRow(values);
  return { success: true, row: sheet.getLastRow() };
}

/**
 * 특정 시트의 데이터 업데이트
 */
function updateSheetData(sheetName, rowIndex, colIndex, value) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName(sheetName);

  if (!sheet) {
    throw new Error(`Sheet not found: ${sheetName}`);
  }

  sheet.getRange(rowIndex, colIndex).setValue(value);
  return { success: true };
}

/**
 * 특정 시트의 전체 데이터 삭제 (헤더 제외)
 */
function clearSheetData(sheetName, keepHeaders = true) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName(sheetName);

  if (!sheet) {
    throw new Error(`Sheet not found: ${sheetName}`);
  }

  const lastRow = sheet.getLastRow();
  if (lastRow > 1 && keepHeaders) {
    sheet.deleteRows(2, lastRow - 1);
  } else if (!keepHeaders) {
    sheet.clear();
  }

  return { success: true };
}

// ===== Drive 헬퍼 함수 =====

/**
 * 폴더 ID로 파일 목록 가져오기
 */
function getFilesInFolder(folderId) {
  const folder = DriveApp.getFolderById(folderId);
  const files = folder.getFiles();

  const fileList = [];
  while (files.hasNext()) {
    const file = files.next();
    fileList.push({
      id: file.getId(),
      name: file.getName(),
      url: file.getUrl(),
      mimeType: file.getMimeType(),
      size: file.getSize(),
      lastUpdated: file.getLastUpdated()
    });
  }

  return fileList;
}

/**
 * 폴더 이름으로 폴더 찾기
 */
function findFolderByName(folderName, parentFolderId = null) {
  let folders;

  if (parentFolderId) {
    const parentFolder = DriveApp.getFolderById(parentFolderId);
    folders = parentFolder.getFoldersByName(folderName);
  } else {
    folders = DriveApp.getFoldersByName(folderName);
  }

  if (folders.hasNext()) {
    const folder = folders.next();
    return {
      id: folder.getId(),
      name: folder.getName(),
      url: folder.getUrl()
    };
  }

  return null;
}

// ===== 유틸리티 함수 =====

/**
 * 현재 KST 시간 가져오기
 */
function getKSTNow() {
  const now = new Date();
  const kst = new Date(now.getTime() + (9 * 60 * 60 * 1000));
  return kst;
}

/**
 * KST 날짜 문자열 (YYYY-MM-DD)
 */
function getKSTDateString() {
  const kst = getKSTNow();
  return Utilities.formatDate(kst, 'GMT', 'yyyy-MM-dd');
}

/**
 * KST 시간 문자열 (HH:mm:ss)
 */
function getKSTTimeString() {
  const kst = getKSTNow();
  return Utilities.formatDate(kst, 'GMT', 'HH:mm:ss');
}

// ===== 테스트 함수 =====

/**
 * 활성 거래처 목록 로그 출력 (테스트용)
 */
function testGetActiveClients() {
  const clients = getActiveClients();
  Logger.log(`활성 거래처 수: ${clients.length}`);
  clients.forEach(client => {
    Logger.log(`- ${client['도메인']}: ${client['상호명']}`);
  });
}

/**
 * 배포일지에 테스트 로그 추가 (테스트용)
 */
function testAppendDeployLog() {
  const result = appendToSheet(SHEET_NAMES.DEPLOY_LOG, [
    getKSTDateString(),
    getKSTTimeString(),
    'test',
    'GAS 테스트',
    'manual',
    'Google Apps Script 연동 테스트'
  ]);
  Logger.log(result);
}
