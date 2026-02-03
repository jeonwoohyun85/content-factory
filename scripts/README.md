# Scripts - 자동화 헬퍼

## sheets-helper.js

Service Account 기반 Google Sheets 접근 헬퍼

### 설정

**1. Service Account 키 파일 확인**
```
위치: C:\Users\A1-M4\.config\gcloud\content-factory-sa-key.json
생성됨: 자동 생성 완료
```

**2. Sheets에 Service Account 공유**
```
1. Google Sheets 열기
2. 공유 버튼 클릭
3. 이메일 추가: 753166847054-compute@developer.gserviceaccount.com
4. 권한: 편집자
5. 완료
```

**3. 테스트**
```bash
cd C:\Users\A1-M4\content-factory
node scripts/sheets-helper.js
```

### 사용법

**Node.js에서:**
```javascript
const sheets = require('./scripts/sheets-helper');

// 활성 거래처 조회
const clients = await sheets.getActiveClients();

// 배포일지 추가
await sheets.appendRow('배포일지', [
  sheets.getKSTDateString(),
  sheets.getKSTTimeString(),
  'feature',
  '새 기능 추가',
  'cloud-build',
  '설명'
]);

// 셀 업데이트
await sheets.updateCell('관리자', 'B2', '활성');
```

**Claude가 사용:**
```bash
# Bash 도구로 직접 실행
node scripts/sheets-helper.js
```

### 함수 목록

**읽기:**
- `readSheet(sheetName, range)` - 시트 데이터 읽기
- `getActiveClients()` - 활성 거래처 조회

**쓰기:**
- `appendRow(sheetName, values)` - 행 추가
- `updateCell(sheetName, cell, value)` - 셀 수정
- `updateRange(sheetName, range, values)` - 범위 수정
- `clearSheet(sheetName, keepHeaders)` - 데이터 삭제

**유틸:**
- `getKSTNow()` - 현재 KST 시간
- `getKSTDateString()` - 날짜 (YYYY-MM-DD)
- `getKSTTimeString()` - 시간 (HH:mm:ss)

### 보안

- ✅ Service Account 키는 로컬만 (`.gitignore`)
- ✅ GitHub에 푸시 안 됨
- ✅ Cloud Run은 별도 Service Account 사용
