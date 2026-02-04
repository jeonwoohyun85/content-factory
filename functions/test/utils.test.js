// 핵심 유틸리티 함수 테스트

const assert = require('assert');
const { parseCSV } = require('../modules/utils/csv-parser.js');
const { escapeHtml } = require('../modules/utils/html-utils.js');
const { normalizeLanguage, normalizeSubdomain, normalizeClient } = require('../modules/utils/normalize.js');
const { getLinkInfo, convertToEmbedUrl } = require('../modules/utils/url-utils.js');
const { formatKoreanTime } = require('../modules/utils/time-utils.js');

// CSV 파싱 테스트
function testParseCSV() {
  const csvText = `name,age,city
John,30,Seoul
Jane,25,"New York"`;

  const result = parseCSV(csvText);

  assert.strictEqual(result.length, 2);
  assert.strictEqual(result[0].name, 'John');
  assert.strictEqual(result[0].age, '30');
  assert.strictEqual(result[1].city, 'New York');

  console.log('✓ parseCSV test passed');
}

// HTML 이스케이프 테스트
function testEscapeHtml() {
  const input = '<script>alert("XSS")</script>';
  const expected = '&lt;script&gt;alert(&quot;XSS&quot;)&lt;/script&gt;';

  assert.strictEqual(escapeHtml(input), expected);
  assert.strictEqual(escapeHtml(''), '');
  assert.strictEqual(escapeHtml(null), '');

  console.log('✓ escapeHtml test passed');
}

// 언어 정규화 테스트
function testNormalizeLanguage() {
  assert.strictEqual(normalizeLanguage('한국어'), 'ko');
  assert.strictEqual(normalizeLanguage('English'), 'en');
  assert.strictEqual(normalizeLanguage('일본어'), 'ja');
  assert.strictEqual(normalizeLanguage('중국어'), 'zh-CN');
  assert.strictEqual(normalizeLanguage(''), 'ko');
  assert.strictEqual(normalizeLanguage(null), 'ko');

  console.log('✓ normalizeLanguage test passed');
}

// 서브도메인 정규화 테스트
function testNormalizeSubdomain() {
  assert.strictEqual(normalizeSubdomain('00001.make-page.com'), '00001');
  assert.strictEqual(normalizeSubdomain('00001.make-page.com/'), '00001');
  assert.strictEqual(normalizeSubdomain('00001'), '00001');
  assert.strictEqual(normalizeSubdomain(''), '');

  console.log('✓ normalizeSubdomain test passed');
}

// 거래처 정규화 테스트
function testNormalizeClient() {
  const input = {
    '도메인': '00001.make-page.com',
    '상호명': '테스트 상호',
    '언어': '한국어'
  };

  const result = normalizeClient(input);

  assert.strictEqual(result.subdomain, '00001.make-page.com');
  assert.strictEqual(result.business_name, '테스트 상호');
  assert.strictEqual(result.language, '한국어');

  console.log('✓ normalizeClient test passed');
}

// 링크 정보 추출 테스트
function testGetLinkInfo() {
  const texts = {
    instagram: 'Instagram',
    youtube: 'YouTube',
    phone: 'Phone'
  };

  const instagramResult = getLinkInfo('https://instagram.com/test', texts);
  assert.strictEqual(instagramResult.icon, '📷');
  assert.strictEqual(instagramResult.text, 'Instagram');

  const youtubeResult = getLinkInfo('https://youtube.com/watch?v=123', texts);
  assert.strictEqual(youtubeResult.icon, '▶️');

  const phoneResult = getLinkInfo('tel:010-1234-5678', texts);
  assert.strictEqual(phoneResult.icon, '📞');

  const invalidResult = getLinkInfo('invalid-url', texts);
  assert.strictEqual(invalidResult, null);

  console.log('✓ getLinkInfo test passed');
}

// 임베드 URL 변환 테스트
function testConvertToEmbedUrl() {
  const youtubeUrl = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ';
  const embedUrl = convertToEmbedUrl(youtubeUrl);
  assert.strictEqual(embedUrl, 'https://www.youtube.com/embed/dQw4w9WgXcQ');

  const youtuShortUrl = 'https://youtu.be/dQw4w9WgXcQ';
  const shortEmbedUrl = convertToEmbedUrl(youtuShortUrl);
  assert.strictEqual(shortEmbedUrl, 'https://www.youtube.com/embed/dQw4w9WgXcQ');

  const driveUrl = 'https://drive.google.com/file/d/123ABC/view';
  const driveEmbedUrl = convertToEmbedUrl(driveUrl);
  assert.strictEqual(driveEmbedUrl, 'https://drive.google.com/file/d/123ABC/preview');

  console.log('✓ convertToEmbedUrl test passed');
}

// 한국 시간 포맷 테스트
function testFormatKoreanTime() {
  const input = '2024-01-15 14:30:00';
  const result = formatKoreanTime(input);
  assert.strictEqual(result, '2024-01-15 14:30');

  assert.strictEqual(formatKoreanTime(''), '');
  assert.strictEqual(formatKoreanTime(null), '');

  console.log('✓ formatKoreanTime test passed');
}

// 전체 테스트 실행
function runAllTests() {
  console.log('\n=== Running Utils Tests ===\n');

  try {
    testParseCSV();
    testEscapeHtml();
    testNormalizeLanguage();
    testNormalizeSubdomain();
    testNormalizeClient();
    testGetLinkInfo();
    testConvertToEmbedUrl();
    testFormatKoreanTime();

    console.log('\n✓ All tests passed!\n');
    process.exit(0);
  } catch (error) {
    console.error('\n✗ Test failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// 직접 실행 시 테스트 실행
if (require.main === module) {
  runAllTests();
}

module.exports = { runAllTests };
