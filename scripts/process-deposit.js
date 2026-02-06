const { google } = require('googleapis');

// Service Account 인증
async function getAuthClient() {
  const auth = new google.auth.GoogleAuth({
    keyFile: 'C:\\Users\\A1-M4\\.config\\gcloud\\content-factory-sa-key.json',
    scopes: ['https://www.googleapis.com/auth/spreadsheets']
  });
  return await auth.getClient();
}

const SPREADSHEET_ID = '1KrzLFi8Wt9GTGT97gcMoXnbZ3OJ04NsP4lncJyIdyhU';

// KST 시간
function getKSTDateString() {
  const kst = new Date(Date.now() + (9 * 60 * 60 * 1000));
  return kst.toISOString().split('T')[0]; // YYYY-MM-DD
}

// 입금확인 시트 읽기
async function getDepositData(sheets) {
  const sheetName = '입금확인';

  try {
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${sheetName}!A:Z`
    });

    const rows = response.data.values || [];
    if (rows.length === 0) {
      console.log('⚠️  입금확인 시트가 비어있습니다.');
      return [];
    }

    // 헤더 스킵하고 데이터 파싱
    const deposits = [];
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      if (!row || row.length === 0) continue;

      // 여러 형식 지원
      let date = '';
      let name = '';
      let amount = 0;

      // 형식 1: 날짜, 입금자, 금액
      if (row.length >= 3) {
        date = row[0] || '';
        name = row[1] || '';
        amount = parseAmount(row[2]);
      }
      // 형식 2: 토스뱅크 거래내역 (날짜, 계좌명, 금액, 입금자)
      else if (row.length >= 4) {
        date = row[0] || '';
        // row[1]은 "전우현" (계좌명)
        // row[2]는 "+165,000원"
        // row[3]은 "(홍길동)" 또는 "홍길동"
        amount = parseAmount(row[2]);
        name = row[3].replace(/[()]/g, '').trim();
      }

      if (name && amount > 0) {
        deposits.push({ date, name, amount });
      }
    }

    return deposits;

  } catch (error) {
    if (error.message.includes('Unable to parse range')) {
      console.log('⚠️  입금확인 시트가 없습니다. 먼저 시트를 생성하세요.');
      return [];
    }
    throw error;
  }
}

// 금액 파싱 (쉼표, 원화 기호 제거)
function parseAmount(str) {
  if (!str) return 0;
  const cleaned = str.toString().replace(/[,원+\s]/g, '');
  const num = parseInt(cleaned);
  return isNaN(num) ? 0 : num;
}

// 파트너 정산 시트 읽기
async function getPartnerSettlement(sheets) {
  const sheetName = '파트너정산';

  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${sheetName}!A:L`
  });

  const rows = response.data.values || [];
  if (rows.length <= 1) {
    console.log('⚠️  파트너 정산 시트가 비어있습니다.');
    return [];
  }

  const headers = rows[0];
  const partners = [];

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    partners.push({
      rowIndex: i + 1, // Sheets는 1-based index
      name: row[0] || '',
      email: row[1] || '',
      phone: row[2] || '',
      activeCount: parseInt(row[3]) || 0,
      totalCount: parseInt(row[4]) || 0,
      expectedAmount: parseInt(row[5]) || 0,
      depositDate: row[6] || '',
      depositAmount: parseInt(row[7]) || 0,
      difference: parseInt(row[8]) || 0,
      status: row[9] || '',
      nextDate: row[10] || '',
      note: row[11] || ''
    });
  }

  return partners;
}

// 입금 매칭 및 업데이트
async function processDeposits(sheets, deposits, partners) {
  const updates = [];
  const results = {
    matched: [],
    unmatched: [],
    mismatch: []
  };

  for (const deposit of deposits) {
    // 파트너 찾기 (이름 매칭)
    const partner = partners.find(p =>
      p.name === deposit.name ||
      p.name.includes(deposit.name) ||
      deposit.name.includes(p.name)
    );

    if (!partner) {
      results.unmatched.push(deposit);
      console.log(`⚠️  매칭 실패: ${deposit.name} (${deposit.amount.toLocaleString()}원)`);
      continue;
    }

    // 금액 비교
    const difference = deposit.amount - partner.expectedAmount;
    let status = '';

    if (difference === 0) {
      status = '✅ 입금완료';
      results.matched.push({ ...deposit, partner: partner.name });
    } else if (difference > 0) {
      status = '⚠️ 초과입금';
      results.mismatch.push({ ...deposit, partner: partner.name, difference });
    } else {
      status = '⚠️ 부족입금';
      results.mismatch.push({ ...deposit, partner: partner.name, difference });
    }

    // 업데이트 데이터 준비
    const depositDate = deposit.date || getKSTDateString();
    const nextDate = calculateNextMonth(depositDate);

    updates.push({
      range: `파트너정산!G${partner.rowIndex}:K${partner.rowIndex}`,
      values: [[
        depositDate,           // 입금일
        deposit.amount,        // 입금 금액
        difference,            // 차액
        status,                // 상태
        nextDate              // 다음 정산일
      ]]
    });

    console.log(`✅ ${partner.name}: ${deposit.amount.toLocaleString()}원 (예상: ${partner.expectedAmount.toLocaleString()}원, 차액: ${difference.toLocaleString()}원)`);
  }

  // 일괄 업데이트
  if (updates.length > 0) {
    await sheets.spreadsheets.values.batchUpdate({
      spreadsheetId: SPREADSHEET_ID,
      resource: {
        valueInputOption: 'RAW',
        data: updates
      }
    });
  }

  return results;
}

// 다음 달 같은 날짜 계산
function calculateNextMonth(dateStr) {
  if (!dateStr) return '';

  const date = new Date(dateStr);
  date.setMonth(date.getMonth() + 1);
  return date.toISOString().split('T')[0];
}

// 결과 출력
function printResults(results) {
  console.log('\n📊 입금 처리 결과:\n');

  if (results.matched.length > 0) {
    console.log('✅ 입금 완료:');
    results.matched.forEach(r => {
      console.log(`   - ${r.partner}: ${r.amount.toLocaleString()}원 (${r.date})`);
    });
    console.log('');
  }

  if (results.mismatch.length > 0) {
    console.log('⚠️  금액 불일치:');
    results.mismatch.forEach(r => {
      const diff = r.difference > 0 ? `+${r.difference.toLocaleString()}` : r.difference.toLocaleString();
      console.log(`   - ${r.partner}: ${r.amount.toLocaleString()}원 (차액: ${diff}원)`);
    });
    console.log('');
  }

  if (results.unmatched.length > 0) {
    console.log('❌ 매칭 실패 (파트너 목록에 없음):');
    results.unmatched.forEach(r => {
      console.log(`   - ${r.name}: ${r.amount.toLocaleString()}원`);
    });
    console.log('');
  }

  console.log(`총 처리: ${results.matched.length + results.mismatch.length + results.unmatched.length}건`);
  console.log(`성공: ${results.matched.length}건, 불일치: ${results.mismatch.length}건, 실패: ${results.unmatched.length}건`);
}

// 메인 실행
async function main() {
  try {
    console.log('입금 확인 처리 시작...\n');

    const authClient = await getAuthClient();
    const sheets = google.sheets({ version: 'v4', auth: authClient });

    // 1. 입금확인 시트 읽기
    console.log('1. 입금확인 시트 읽기 중...');
    const deposits = await getDepositData(sheets);

    if (deposits.length === 0) {
      console.log('⚠️  처리할 입금 내역이 없습니다.');
      return;
    }
    console.log(`   ✅ ${deposits.length}건 읽기 완료\n`);

    // 2. 파트너 정산 시트 읽기
    console.log('2. 파트너 정산 시트 읽기 중...');
    const partners = await getPartnerSettlement(sheets);
    console.log(`   ✅ ${partners.length}명 읽기 완료\n`);

    // 3. 입금 매칭 및 업데이트
    console.log('3. 입금 매칭 및 업데이트 중...\n');
    const results = await processDeposits(sheets, deposits, partners);

    // 4. 결과 출력
    printResults(results);

    console.log('\n✅ 완료');

  } catch (error) {
    console.error('❌ 오류:', error.message);
    console.error(error.stack);
  }
}

main();
