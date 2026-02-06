// Google Apps Script 코드
// Google Sheets → 확장 프로그램 → Apps Script에 붙여넣기

// ============================================
// 1. 파트너정산 동기화
// ============================================
function 파트너정산_동기화() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const 관리자시트 = ss.getSheetByName('관리자');
  const 파트너정산시트 = ss.getSheetByName('파트너정산');

  if (!관리자시트) {
    SpreadsheetApp.getUi().alert('관리자 시트를 찾을 수 없습니다.');
    return;
  }

  // 파트너정산 시트가 없으면 생성
  if (!파트너정산시트) {
    ss.insertSheet('파트너정산');
  }

  // 관리자 시트 데이터 읽기
  const data = 관리자시트.getDataRange().getValues();
  const headers = data[0];

  // 컬럼 인덱스 찾기
  const 파트너성함_idx = headers.indexOf('파트너 성함');
  const 파트너이메일_idx = headers.indexOf('파트너 이메일');
  const 파트너연락처_idx = headers.indexOf('파트너 연락처');
  const 구독_idx = headers.indexOf('구독');

  if (파트너성함_idx === -1) {
    SpreadsheetApp.getUi().alert('관리자 시트에 "파트너 성함" 컬럼이 없습니다.');
    return;
  }

  // 파트너별 집계
  const partnerMap = new Map();

  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const 파트너성함 = row[파트너성함_idx];
    const 구독 = row[구독_idx];

    if (!파트너성함) continue;

    if (!partnerMap.has(파트너성함)) {
      partnerMap.set(파트너성함, {
        name: 파트너성함,
        email: row[파트너이메일_idx] || '',
        phone: row[파트너연락처_idx] || '',
        activeCount: 0,
        totalCount: 0
      });
    }

    const partner = partnerMap.get(파트너성함);
    partner.totalCount++;

    if (구독 === '활성') {
      partner.activeCount++;
    }
  }

  // 파트너정산 시트 업데이트
  const 파트너정산 = ss.getSheetByName('파트너정산');
  파트너정산.clear();

  // 헤더
  const 헤더 = [
    '파트너 성함', '파트너 이메일', '파트너 연락처',
    '활성 거래처 수', '총 거래처 수', '월 정산 금액',
    '입금일', '입금 금액', '차액', '상태', '다음 정산일', '비고'
  ];

  파트너정산.appendRow(헤더);

  // 데이터
  const partners = Array.from(partnerMap.values());
  partners.forEach(p => {
    파트너정산.appendRow([
      p.name,
      p.email,
      p.phone,
      p.activeCount,
      p.totalCount,
      p.activeCount * 55000,
      '', '', '',
      p.activeCount > 0 ? '❌ 미입금' : '-',
      '', ''
    ]);
  });

  Logger.log(`파트너 ${partners.length}명 동기화 완료`);
}

// ============================================
// 2. 입금 확인 처리
// ============================================
function 입금확인_처리() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const 입금확인시트 = ss.getSheetByName('입금확인');
  const 파트너정산시트 = ss.getSheetByName('파트너정산');

  if (!입금확인시트) {
    SpreadsheetApp.getUi().alert('입금확인 시트를 찾을 수 없습니다.');
    return;
  }

  if (!파트너정산시트) {
    SpreadsheetApp.getUi().alert('파트너정산 시트를 찾을 수 없습니다. 먼저 동기화를 실행하세요.');
    return;
  }

  // 입금확인 시트 읽기
  const 입금data = 입금확인시트.getDataRange().getValues();
  if (입금data.length <= 1) {
    SpreadsheetApp.getUi().alert('입금확인 시트가 비어있습니다.');
    return;
  }

  const deposits = [];
  for (let i = 1; i < 입금data.length; i++) {
    const row = 입금data[i];
    if (!row[0] && !row[1] && !row[2]) continue; // 빈 행 스킵

    const date = row[0] ? Utilities.formatDate(new Date(row[0]), 'GMT+9', 'yyyy-MM-dd') : '';
    const name = String(row[1] || '').trim();
    const amount = parseAmount(row[2]);

    if (name && amount > 0) {
      deposits.push({ date, name, amount });
    }
  }

  if (deposits.length === 0) {
    SpreadsheetApp.getUi().alert('처리할 입금 내역이 없습니다.');
    return;
  }

  // 파트너정산 시트 읽기
  const 정산data = 파트너정산시트.getDataRange().getValues();
  const 정산headers = 정산data[0];

  // 컬럼 인덱스
  const 파트너성함_idx = 정산headers.indexOf('파트너 성함');
  const 월정산금액_idx = 정산headers.indexOf('월 정산 금액');
  const 입금일_idx = 정산headers.indexOf('입금일');
  const 입금금액_idx = 정산headers.indexOf('입금 금액');
  const 차액_idx = 정산headers.indexOf('차액');
  const 상태_idx = 정산headers.indexOf('상태');
  const 다음정산일_idx = 정산headers.indexOf('다음 정산일');

  let 성공 = 0;
  let 실패 = 0;
  let 불일치 = 0;
  const 결과메시지 = [];

  // 입금 매칭
  deposits.forEach(deposit => {
    let matched = false;

    for (let i = 1; i < 정산data.length; i++) {
      const 파트너성함 = 정산data[i][파트너성함_idx];

      // 이름 매칭 (정확히 일치 또는 포함)
      if (파트너성함 === deposit.name ||
          파트너성함.includes(deposit.name) ||
          deposit.name.includes(파트너성함)) {

        const 월정산금액 = 정산data[i][월정산금액_idx];
        const 차액 = deposit.amount - 월정산금액;
        let 상태 = '';

        if (차액 === 0) {
          상태 = '✅ 입금완료';
          성공++;
        } else if (차액 > 0) {
          상태 = '⚠️ 초과입금';
          불일치++;
        } else {
          상태 = '⚠️ 부족입금';
          불일치++;
        }

        // 다음 정산일 계산
        const 다음정산일 = calculateNextMonth(deposit.date);

        // 업데이트
        파트너정산시트.getRange(i + 1, 입금일_idx + 1).setValue(deposit.date);
        파트너정산시트.getRange(i + 1, 입금금액_idx + 1).setValue(deposit.amount);
        파트너정산시트.getRange(i + 1, 차액_idx + 1).setValue(차액);
        파트너정산시트.getRange(i + 1, 상태_idx + 1).setValue(상태);
        파트너정산시트.getRange(i + 1, 다음정산일_idx + 1).setValue(다음정산일);

        결과메시지.push(`${상태} ${파트너성함}: ${deposit.amount.toLocaleString()}원 (예상: ${월정산금액.toLocaleString()}원)`);
        matched = true;
        break;
      }
    }

    if (!matched) {
      실패++;
      결과메시지.push(`❌ 매칭 실패: ${deposit.name} (${deposit.amount.toLocaleString()}원)`);
    }
  });

  // 결과 알림
  const 알림 = `
입금 처리 완료!

✅ 성공: ${성공}건
⚠️ 불일치: ${불일치}건
❌ 실패: ${실패}건

${결과메시지.join('\n')}
`;

  SpreadsheetApp.getUi().alert(알림);
}

// ============================================
// 3. 올인원 처리 (자동 실행용)
// ============================================
function 올인원_처리() {
  파트너정산_동기화();
  Utilities.sleep(1000); // 1초 대기
  입금확인_처리();
}

// ============================================
// 유틸리티 함수
// ============================================
function parseAmount(value) {
  if (!value) return 0;
  const str = String(value).replace(/[,원+\s]/g, '');
  const num = parseInt(str);
  return isNaN(num) ? 0 : num;
}

function calculateNextMonth(dateStr) {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  date.setMonth(date.getMonth() + 1);
  return Utilities.formatDate(date, 'GMT+9', 'yyyy-MM-dd');
}

// ============================================
// 메뉴 추가
// ============================================
function onOpen() {
  const ui = SpreadsheetApp.getUi();
  ui.createMenu('💰 입금 관리')
    .addItem('📊 파트너정산 동기화', '파트너정산_동기화')
    .addItem('✅ 입금확인 처리', '입금확인_처리')
    .addSeparator()
    .addItem('⚡ 올인원 처리', '올인원_처리')
    .addToUi();
}
