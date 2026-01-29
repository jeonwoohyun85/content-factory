const fs = require('fs');
const path = require('path');

async function syncSystemState() {
  console.log('🔄 시스템 상태 동기화 시작...\n');

  try {
    // 1. wrangler.toml 파싱
    console.log('📝 wrangler.toml 분석 중...');
    const wranglerConfig = parseWranglerToml();

    // 2. Google Sheets 구조 조회
    console.log('📊 Google Sheets 구조 조회 중...');
    const sheetsStructure = await fetchSheetsStructure();

    // 3. Worker 코드 분석
    console.log('⚙️  Worker 코드 분석 중...');
    const workerInfo = analyzeWorkerCode();

    // 4. features.json 로드
    console.log('🎯 기능 목록 로드 중...');
    const features = loadFeatures();

    // 5. PROJECT.md 생성
    console.log('📄 PROJECT.md 생성 중...\n');
    const projectMd = generateProjectMd({
      wranglerConfig,
      sheetsStructure,
      workerInfo,
      features
    });

    // 6. PROJECT.md 저장
    const baseDir = fs.existsSync(path.join(__dirname, 'workers'))
      ? __dirname
      : path.join(__dirname, 'content-factory');

    const projectPath = path.join(baseDir, 'PROJECT.md');
    fs.writeFileSync(projectPath, projectMd, 'utf-8');

    console.log('✅ PROJECT.md 업데이트 완료\n');
    console.log('='.repeat(60));
    console.log(projectMd);
    console.log('='.repeat(60));

  } catch (error) {
    console.error('❌ 동기화 실패:', error.message);
    process.exit(1);
  }
}

function parseWranglerToml() {
  // content-factory 디렉토리 찾기
  const baseDir = fs.existsSync(path.join(__dirname, 'workers'))
    ? __dirname
    : path.join(__dirname, 'content-factory');

  const tomlPath = path.join(baseDir, 'workers', 'wrangler.toml');
  const content = fs.readFileSync(tomlPath, 'utf-8');

  const config = {};

  // Cron 추출
  const cronMatch = content.match(/crons\s*=\s*\["(.+?)"\]/);
  config.cron = cronMatch ? cronMatch[1] : null;

  // Queue 설정 추출
  const batchSizeMatch = content.match(/max_batch_size\s*=\s*(\d+)/);
  config.maxBatchSize = batchSizeMatch ? parseInt(batchSizeMatch[1]) : null;

  const retriesMatch = content.match(/max_retries\s*=\s*(\d+)/);
  config.maxRetries = retriesMatch ? parseInt(retriesMatch[1]) : null;

  const timeoutMatch = content.match(/max_batch_timeout\s*=\s*(\d+)/);
  config.maxBatchTimeout = timeoutMatch ? parseInt(timeoutMatch[1]) : null;

  return config;
}

async function fetchSheetsStructure() {
  if (!process.env.GOOGLE_SERVICE_ACCOUNT_JSON) {
    console.warn('⚠️  GOOGLE_SERVICE_ACCOUNT_JSON 환경변수 없음 (Sheets 구조 스킵)');
    return {
      관리자: ['환경변수 없음 - 확인 불가'],
      최신포스팅: ['환경변수 없음 - 확인 불가']
    };
  }

  const serviceAccount = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON);
  const accessToken = await getAccessToken(serviceAccount);

  const SHEETS_ID = '1KrzLFi8Wt9GTGT97gcMoXnbZ3OJ04NsP4lncJyIdyhU';

  const sheets = {};

  // 관리자 시트
  try {
    const adminResponse = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${SHEETS_ID}/values/'관리자'!A1:Z1`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    const adminData = await adminResponse.json();
    sheets.관리자 = adminData.values?.[0] || [];
  } catch (error) {
    sheets.관리자 = [`조회 실패: ${error.message}`];
  }

  // 최신포스팅 시트
  try {
    const postingResponse = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${SHEETS_ID}/values/'최신포스팅'!A1:Z1`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    const postingData = await postingResponse.json();
    sheets.최신포스팅 = postingData.values?.[0] || [];
  } catch (error) {
    sheets.최신포스팅 = [`조회 실패: ${error.message}`];
  }

  return sheets;
}

function analyzeWorkerCode() {
  const baseDir = fs.existsSync(path.join(__dirname, 'workers'))
    ? __dirname
    : path.join(__dirname, 'content-factory');

  const workerPath = path.join(baseDir, 'workers', 'make-page-subdomain.js');

  if (!fs.existsSync(workerPath)) {
    console.warn('⚠️  Worker 파일 없음 (분석 스킵)');
    return {
      envVars: [],
      ttl: null,
      lines: 0
    };
  }

  const content = fs.readFileSync(workerPath, 'utf-8');

  // 환경변수 추출
  const envVars = new Set();
  const envRegex = /env\.([A-Z_]+)/g;
  let match;
  while ((match = envRegex.exec(content)) !== null) {
    envVars.add(match[1]);
  }

  // TTL 추출
  const ttlMatch = content.match(/expirationTtl:\s*(\d+)/);
  const ttl = ttlMatch ? parseInt(ttlMatch[1]) : null;

  // 코드 라인 수
  const lines = content.split('\n').length;

  return {
    envVars: Array.from(envVars).sort(),
    ttl,
    lines
  };
}

function loadFeatures() {
  const baseDir = fs.existsSync(path.join(__dirname, 'workers'))
    ? __dirname
    : path.join(__dirname, 'content-factory');

  const featuresPath = path.join(baseDir, 'features.json');

  if (!fs.existsSync(featuresPath)) {
    console.warn('⚠️  features.json 없음 (기능 목록 스킵)');
    return { features: [], architecture: {} };
  }

  try {
    const content = fs.readFileSync(featuresPath, 'utf-8');
    return JSON.parse(content);
  } catch (error) {
    console.error(`⚠️  features.json 파싱 실패: ${error.message}`);
    return { features: [], architecture: {} };
  }
}

function generateProjectMd({ wranglerConfig, sheetsStructure, workerInfo, features }) {
  const now = new Date();
  const kstTime = new Date(now.getTime() + (9 * 60 * 60 * 1000));
  const timestamp = kstTime.toISOString().replace('T', ' ').substring(0, 19);

  const ttlHours = workerInfo.ttl ? (workerInfo.ttl / 3600).toFixed(2) : '?';
  const maxClients = wranglerConfig.maxBatchSize
    ? Math.floor(86340 / (75 / wranglerConfig.maxBatchSize) * 0.8)
    : '?';
  const time1000 = wranglerConfig.maxBatchSize
    ? (1000 / wranglerConfig.maxBatchSize * 75 / 3600).toFixed(1)
    : '?';

  // Git 최근 커밋 조회 (진행 중인 작업)
  let recentWork = '확인 중...';
  try {
    const { execSync } = require('child_process');
    const baseDir = fs.existsSync(path.join(__dirname, 'workers'))
      ? __dirname
      : path.join(__dirname, 'content-factory');
    const commits = execSync('git log --oneline -3', { cwd: baseDir, encoding: 'utf-8' })
      .split('\n')
      .filter(Boolean);
    recentWork = commits.length > 0 ? commits[0].substring(8) : '없음';
  } catch (error) {
    recentWork = 'Git 정보 없음';
  }

  return `# Content Factory 프로젝트

## 📍 현재 상태 (한눈에)

**거래처**: 2개 활성 | **병렬**: ${wranglerConfig.maxBatchSize}개 | **최대**: ${maxClients}개/일

**최근 작업**: ${recentWork}

**다음 단계**: ${features.features?.[0]?.status === 'active' ? '에러 로깅 추가 (Slack 또는 Sheets)' : '확인 필요'}

---

## 시스템 구조 (한눈에 보기)

${features.architecture?.diagram ? `\`\`\`\n${features.architecture.diagram}\n\`\`\`` : ''}

${features.architecture?.data_flow ? `### 데이터 흐름\n\n${features.architecture.data_flow}` : ''}

---

## 주요 기능

${features.features?.map(f => `### ${f.name} ${f.status === 'active' ? '✅' : '🚧'}

**워크플로우**: ${f.workflow}

${f.description ? `**설명**: ${f.description}\n` : ''}
**핵심 함수**: ${f.functions?.join(', ') || '없음'}

**사용 컴포넌트**: ${f.components?.join(', ') || '없음'}
`).join('\n') || '- 기능 정보 없음'}

---

## 시스템 현황 (자동 생성)

**마지막 업데이트**: ${timestamp} KST

### Cloudflare Workers 설정

- **Worker**: make-page-subdomain (${workerInfo.lines}줄)
- **Cron**: \`${wranglerConfig.cron || '없음'}\` (매일 09:00 KST)
- **Queue 병렬**: ${wranglerConfig.maxBatchSize || '?'}개 동시 처리
- **재시도**: ${wranglerConfig.maxRetries ?? '?'}회
- **Timeout**: ${wranglerConfig.maxBatchTimeout || '?'}초
- **TTL**: ${workerInfo.ttl || '?'}초 (${ttlHours}시간)

### Google Sheets 구조

#### 📋 관리자 시트
\`\`\`
${sheetsStructure.관리자.join(', ')}
\`\`\`

#### 📝 최신포스팅 시트
\`\`\`
${sheetsStructure.최신포스팅.join(', ')}
\`\`\`

### 환경변수 (Worker에서 사용 중)

${workerInfo.envVars.length > 0 ? workerInfo.envVars.map(v => `- \`${v}\``).join('\n') : '- 없음'}

### Gemini API

- **Tier**: 1 (Paid)
- **gemini-2.5-flash**: 300 RPM
- **gemini-3-pro-preview**: 150 RPM

---

## 성능 예상 (병렬 ${wranglerConfig.maxBatchSize}개 기준)

- **100개 거래처**: ${wranglerConfig.maxBatchSize ? (100 / wranglerConfig.maxBatchSize * 75 / 60).toFixed(0) : '?'}분
- **1000개 거래처**: ${time1000}시간
- **최대 안전 처리량**: ${maxClients}개/일

---

## 주요 기능

### 자동 포스팅 시스템
- 매일 09:00 KST Cron 트리거
- Google Sheets "관리자" 탭에서 구독='활성' 거래처 조회
- Gemini API로 업종별 검색 + 블로그 포스팅 생성
- Google Drive 폴더에서 최신 사진 자동 선택
- 포스팅 완료 시 "크론" 컬럼 자동 업데이트 (다음 날 09:00)
- 성공/실패 "상태" 컬럼 기록

### 거래처 페이지
- \`*.make-page.com\` 서브도메인 자동 라우팅
- Google Sheets 데이터 기반 동적 페이지 생성
- 모바일 최적화 UI
- 바로가기 링크 (Instagram, Blog, YouTube, Naver Map, SmartStore 등)

---

## 배포 이력

### 2026-01-29
**15:30** ⚡ [improvement] Queue 병렬 ${wranglerConfig.maxBatchSize}개 처리 + 재시도 ${wranglerConfig.maxRetries}회 추가
**15:26** ⚡ [improvement] TTL 23시간 59분으로 변경 (크론 타이밍 충돌 방지)

### 2026-01-27
**23:30** ✨ [feature] 자동 포스팅 시스템 완성 (Scheduled Trigger)

---

## 다음 작업

- [ ] 에러 로깅 강화 (Slack 알림 또는 에러 시트)
- [ ] 거래처 1000개 이상 확장 대비 (분산 포스팅)
- [ ] Umami 통계 연동
`;
}

async function getAccessToken(serviceAccount) {
  const crypto = require('crypto');
  const now = Math.floor(Date.now() / 1000);
  const jwtHeader = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url');
  const jwtClaimSet = {
    iss: serviceAccount.client_email,
    scope: 'https://www.googleapis.com/auth/spreadsheets',
    aud: 'https://oauth2.googleapis.com/token',
    exp: now + 3600,
    iat: now
  };
  const jwtClaimSetEncoded = Buffer.from(JSON.stringify(jwtClaimSet)).toString('base64url');
  const signatureInput = `${jwtHeader}.${jwtClaimSetEncoded}`;
  const sign = crypto.createSign('RSA-SHA256');
  sign.update(signatureInput);
  const signature = sign.sign(serviceAccount.private_key, 'base64url');
  const jwt = `${signatureInput}.${signature}`;

  const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`
  });
  const tokenData = await tokenResponse.json();
  return tokenData.access_token;
}

syncSystemState().catch(console.error);
