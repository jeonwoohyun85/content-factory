# Google Apps Script 설치 가이드

## 1. Google Sheets에서 Apps Script 열기

1. Google Sheets 열기: https://docs.google.com/spreadsheets/d/1KrzLFi8Wt9GTGT97gcMoXnbZ3OJ04NsP4lncJyIdyhU
2. 상단 메뉴: **확장 프로그램** → **Apps Script**

## 2. 코드 복사

1. `Code.gs` 파일 내용 전체 복사
2. Apps Script 편집기에 붙여넣기 (기본 코드 덮어쓰기)
3. 저장 (Ctrl+S)

## 3. 권한 승인

1. 테스트 함수 실행: `testGetActiveClients`
2. "권한 검토" 클릭
3. 계정 선택
4. "고급" → "이동" 클릭
5. "허용" 클릭

## 4. 사용 가능한 함수

### Sheets 함수
- `getSheetData(sheetName)` - 시트 전체 데이터 가져오기
- `getActiveClients()` - 활성 거래처 목록
- `appendToSheet(sheetName, values)` - 행 추가
- `updateSheetData(sheetName, row, col, value)` - 셀 수정
- `clearSheetData(sheetName)` - 데이터 삭제

### Drive 함수
- `getFilesInFolder(folderId)` - 폴더 내 파일 목록
- `findFolderByName(folderName)` - 폴더 검색

### 유틸리티
- `getKSTNow()` - 현재 KST 시간
- `getKSTDateString()` - KST 날짜 (YYYY-MM-DD)
- `getKSTTimeString()` - KST 시간 (HH:mm:ss)

## 5. 테스트

Apps Script 편집기에서:
```javascript
testGetActiveClients();  // 활성 거래처 로그 출력
testAppendDeployLog();   // 배포일지에 테스트 로그 추가
```

실행 → 로그 확인 (Ctrl+Enter)
