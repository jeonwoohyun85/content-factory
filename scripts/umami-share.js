// Umami 공유 링크 자동화
// 공유 링크 생성/재생성 및 Sheets 업데이트

const https = require('https');
const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');

const UMAMI_API_KEY = 'api_u9GeatGUgI6Uw2VU7vKheTPdwK7h5kLH';
const UMAMI_BASE_URL = 'https://api.umami.is/v1';
const SPREADSHEET_ID = '1KrzLFi8Wt9GTGT97gcMoXnbZ3OJ04NsP4lncJyIdyhU';
const SHEET_NAME = '관리자';

// Service Account 인증
async function getAuth() {
  const keyPath = path.join(process.env.USERPROFILE || process.env.HOME, '.config', 'gcloud', 'content-factory-sa-key.json');
  const auth = new google.auth.GoogleAuth({
    keyFile: keyPath,
    scopes: ['https://www.googleapis.com/auth/spreadsheets']
  });
  return auth;
}

// Umami API 호출
async function umamiAPI(endpoint, method = 'GET', data = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(endpoint, UMAMI_BASE_URL);
    const options = {
      method,
      headers: {
        'x-umami-api-key': UMAMI_API_KEY,
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      }
    };

    const req = https.request(url, options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(JSON.parse(body));
        } else {
          reject(new Error(`API Error ${res.statusCode}: ${body}`));
        }
      });
    });

    req.on('error', reject);
    if (data) req.write(JSON.stringify(data));
    req.end();
  });
}

// 웹사이트 목록 조회
async function getWebsites() {
  const result = await umamiAPI('/websites');
  return result.data;
}

// 공유 링크 생성 (재생성 포함)
async function createShare(websiteId) {
  try {
    // 기존 공유 삭제 (있으면)
    try {
      await umamiAPI(`/websites/${websiteId}/share`, 'DELETE');
      console.log(`  기존 공유 삭제: ${websiteId}`);
    } catch (e) {
      // 없으면 무시
    }

    // 새 공유 생성
    const result = await umamiAPI(`/websites/${websiteId}/share`, 'POST');
    console.log(`  새 공유 생성: ${result.shareId}`);
    return result.shareId;
  } catch (error) {
    console.error(`  공유 생성 실패: ${error.message}`);
    throw error;
  }
}

// Sheets 업데이트
async function updateSheet(updates) {
  const auth = await getAuth();
  const sheets = google.sheets({ version: 'v4', auth });

  // 현재 데이터 읽기
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${SHEET_NAME}!A1:Z100`
  });

  const rows = response.data.values;
  const headers = rows[0];
  const umamiCol = headers.indexOf('우마미') + 1; // A=1
  const shareCol = headers.indexOf('우마미_공유') + 1;

  // 업데이트할 행 찾기
  for (const update of updates) {
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      if (row[umamiCol - 1] === update.websiteId) {
        const shareUrl = `https://cloud.umami.is/share/${update.shareId}`;

        // 셀 업데이트
        await sheets.spreadsheets.values.update({
          spreadsheetId: SPREADSHEET_ID,
          range: `${SHEET_NAME}!${String.fromCharCode(64 + shareCol)}${i + 1}`,
          valueInputOption: 'RAW',
          resource: {
            values: [[shareUrl]]
          }
        });

        console.log(`✅ 업데이트: ${row[3]} → ${shareUrl}`); // 상호명
      }
    }
  }
}

// 메인 실행
async function main() {
  try {
    console.log('🚀 Umami 공유 링크 자동화 시작\n');

    // 1. 웹사이트 목록 조회
    console.log('📋 웹사이트 목록 조회 중...');
    const websites = await getWebsites();
    console.log(`  발견: ${websites.length}개\n`);

    // 2. 거래처만 필터링 (서브도메인)
    const clients = websites.filter(w => w.domain.includes('.make-page.com') && w.domain !== 'make-page.com');
    console.log(`🏢 거래처: ${clients.length}개\n`);

    // 3. 공유 링크 재생성
    const updates = [];
    for (const client of clients) {
      console.log(`처리 중: ${client.name} (${client.domain})`);
      const shareId = await createShare(client.id);
      updates.push({
        websiteId: client.id,
        shareId,
        name: client.name,
        domain: client.domain
      });
      console.log();
    }

    // 4. Sheets 업데이트
    console.log('📊 Google Sheets 업데이트 중...');
    await updateSheet(updates);

    console.log('\n✅ 완료!');
    console.log(`\n생성된 공유 링크:`);
    updates.forEach(u => {
      console.log(`- ${u.name}: https://cloud.umami.is/share/${u.shareId}`);
    });

  } catch (error) {
    console.error('❌ 에러:', error.message);
    process.exit(1);
  }
}

// CLI 실행
if (require.main === module) {
  main();
}

module.exports = { main };
