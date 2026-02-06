const { google } = require('googleapis');

// Service Account 인증
async function getAuthClient() {
  const auth = new google.auth.GoogleAuth({
    keyFile: 'C:\\Users\\A1-M4\\.config\\gcloud\\content-factory-sa-key.json',
    scopes: ['https://www.googleapis.com/auth/spreadsheets']
  });
  return await auth.getClient();
}

// KST 시간
function getKSTNow() {
  return new Date(Date.now() + (9 * 60 * 60 * 1000));
}

function getKSTDateString() {
  const kst = getKSTNow();
  return kst.toISOString().split('T')[0]; // YYYY-MM-DD
}

// CSV 파싱
function parseCSV(csvText) {
  const lines = csvText.trim().split('\n');
  const headers = lines[0].split(',').map(h => h.replace(/^"|"$/g, '').trim());

  return lines.slice(1).map(line => {
    const values = line.split(',').map(v => v.replace(/^"|"$/g, '').trim());
    const row = {};
    headers.forEach((header, index) => {
      row[header] = values[index] || '';
    });
    return row;
  });
}

// 관리자 시트 읽기
async function getClientsFromSheet() {
  const url = 'https://docs.google.com/spreadsheets/d/1KrzLFi8Wt9GTGT97gcMoXnbZ3OJ04NsP4lncJyIdyhU/gviz/tq?tqx=out:csv&sheet=관리자';
  const response = await fetch(url);
  const csvText = await response.text();
  return parseCSV(csvText);
}

// 파트너별 집계
function aggregateByPartner(clients) {
  const partnerMap = new Map();

  clients.forEach(client => {
    const partnerName = client['파트너 성함'] || '';
    const subscription = client['구독'] || '';

    // 파트너명이 없거나 구독이 활성이 아니면 스킵
    if (!partnerName) return;

    if (!partnerMap.has(partnerName)) {
      partnerMap.set(partnerName, {
        name: partnerName,
        email: client['파트너 이메일'] || '',
        phone: client['파트너 연락처'] || '',
        activeCount: 0,
        totalCount: 0
      });
    }

    const partner = partnerMap.get(partnerName);
    partner.totalCount++;

    if (subscription === '활성') {
      partner.activeCount++;
    }
  });

  return Array.from(partnerMap.values());
}

// 파트너 정산 시트 생성/업데이트
async function updatePartnerSettlementSheet(partners) {
  const authClient = await getAuthClient();
  const sheets = google.sheets({ version: 'v4', auth: authClient });
  const spreadsheetId = '1KrzLFi8Wt9GTGT97gcMoXnbZ3OJ04NsP4lncJyIdyhU';
  const sheetName = '파트너정산';

  // 시트 존재 확인
  try {
    const sheetMetadata = await sheets.spreadsheets.get({ spreadsheetId });
    const sheetExists = sheetMetadata.data.sheets.some(
      sheet => sheet.properties.title === sheetName
    );

    // 시트가 없으면 생성
    if (!sheetExists) {
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
    }
  } catch (error) {
    console.error('시트 확인 오류:', error.message);
    throw error;
  }

  // 헤더 작성
  const headers = [
    '파트너 성함',
    '파트너 이메일',
    '파트너 연락처',
    '활성 거래처 수',
    '총 거래처 수',
    '월 정산 금액',
    '입금일',
    '입금 금액',
    '차액',
    '상태',
    '다음 정산일',
    '비고'
  ];

  // 데이터 작성
  const rows = partners.map(p => [
    p.name,
    p.email,
    p.phone,
    p.activeCount,
    p.totalCount,
    p.activeCount * 55000, // 월 정산 금액
    '', // 입금일
    '', // 입금 금액
    '', // 차액
    p.activeCount > 0 ? '❌ 미입금' : '-', // 상태
    '', // 다음 정산일
    '' // 비고
  ]);

  const values = [headers, ...rows];

  // 시트 클리어 후 작성
  await sheets.spreadsheets.values.clear({
    spreadsheetId,
    range: `${sheetName}!A1:Z1000`
  });

  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `${sheetName}!A1`,
    valueInputOption: 'RAW',
    resource: { values }
  });

  console.log(`✅ "${sheetName}" 시트 업데이트 완료`);
  console.log(`   - 파트너 수: ${partners.length}명`);
  console.log(`   - 총 활성 거래처: ${partners.reduce((sum, p) => sum + p.activeCount, 0)}개`);
}

// 메인 실행
async function main() {
  try {
    console.log('파트너 정산 시트 생성 시작...\n');

    // 1. 관리자 시트 읽기
    console.log('1. 관리자 시트 읽기 중...');
    const clients = await getClientsFromSheet();
    console.log(`   ✅ 거래처 ${clients.length}개 읽기 완료\n`);

    // 2. 파트너별 집계
    console.log('2. 파트너별 집계 중...');
    const partners = aggregateByPartner(clients);
    console.log(`   ✅ 파트너 ${partners.length}명 집계 완료\n`);

    // 3. 파트너 정산 시트 생성/업데이트
    console.log('3. 파트너 정산 시트 업데이트 중...');
    await updatePartnerSettlementSheet(partners);

    console.log('\n✅ 완료');

  } catch (error) {
    console.error('❌ 오류:', error.message);
    console.error(error.stack);
  }
}

main();
