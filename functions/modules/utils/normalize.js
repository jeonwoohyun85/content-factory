// 정규화 유틸리티

function normalizeLanguage(lang) {
  if (!lang) return 'ko';

  const lower = lang.toLowerCase();

  // 주요 언어 체크 (하드코딩된 번역 데이터)
  if (lower.includes('한국') || lower.includes('한글') || lower.includes('korean') || lower === 'ko') return 'ko';
  if (lower.includes('영어') || lower.includes('english') || lower === 'en') return 'en';
  if (lower.includes('일본') || lower.includes('japanese') || lower === 'ja') return 'ja';
  if (lower.includes('중국') || lower.includes('간체') || lower.includes('simplified') || lower.includes('chinese') || lower === 'zh' || lower === 'zh-cn') return 'zh-CN';
  if (lower.includes('번체') || lower.includes('traditional') || lower === 'zh-tw') return 'zh-TW';
  if (lower.includes('태국') || lower.includes('타이') || lower.includes('thai') || lower === 'th') return 'th';

  // 나머지는 입력값 그대로 반환 (API에서 처리)
  return lang;
}

function normalizeClient(client) {
  // 완전 동적: 모든 컬럼을 그대로 유지하되 별칭만 추가
  const normalized = { ...client };

  // 영문 별칭 추가 (기존 코드 호환성)
  if (client['도메인']) normalized.subdomain = client['도메인'];
  if (client['서브도메인']) normalized.subdomain = client['서브도메인'];
  if (client['상호명']) normalized.business_name = client['상호명'];
  if (client['주소']) normalized.address = client['주소'];
  if (client['언어']) normalized.language = client['언어'];
  if (client['연락처']) normalized.phone = client['연락처'];
  if (client['영업시간']) normalized.business_hours = client['영업시간'];
  if (client['거래처_정보']) normalized.description = client['거래처_정보'];
  if (client['업종']) normalized.industry = client['업종'];
  if (client['구독']) normalized.subscription = client['구독'];
  if (client['폴더명']) normalized.folder_name = client['폴더명'];
  if (client['우마미']) normalized.umami_id = client['우마미'];
  if (client['우마미_공유']) normalized.umami_share = client['우마미_공유'];
  if (client['바로가기']) normalized.links = client['바로가기'];

  return normalized;
}

function normalizeSubdomain(subdomain) {
  if (!subdomain) return '';
  return subdomain.replace('.make-page.com', '').replace('/', '').trim();
}

function normalizeFolderName(name) {
  if (!name) return '';
  return name.trim().toLowerCase();
}

function removeLanguageSuffixFromBusinessName(businessName) {
  if (!businessName) return businessName;

  const suffixes = [' Japan', ' 日本', ' japan', ' Korea', ' 한국', ' China', ' 中国', ' English', ' Japanese', ' 일본어', ' Thailand'];
  for (const suffix of suffixes) {
    if (businessName.endsWith(suffix)) {
      return businessName.slice(0, -suffix.length).trim();
    }
  }
  return businessName;
}

module.exports = {
  normalizeLanguage,
  normalizeClient,
  normalizeSubdomain,
  normalizeFolderName,
  removeLanguageSuffixFromBusinessName
};
