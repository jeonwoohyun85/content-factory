// Google Sheets 거래처 조회

const { fetchWithTimeout } = require('../utils/http-utils.js');
const { parseCSVLine } = require('../utils/csv-parser.js');
const { normalizeClient, normalizeLanguage, normalizeSubdomain, removeLanguageSuffixFromBusinessName } = require('../utils/normalize.js');
const { getGoogleAccessTokenForPosting } = require('../auth.js');
const { translateWithCache } = require('../translation-cache.js');
const { getPostsFromArchive } = require('./posts-reader.js');

async function getClientFromSheets(clientId, env) {

  try {
    // Firestore 캐시 확인 (1시간 TTL)
    const cacheKey = `client_${clientId}`;
    try {
      const cacheDoc = await env.POSTING_KV.collection('clients_cache').doc(cacheKey).get();

      if (cacheDoc.exists) {
        const cached = cacheDoc.data();
        const cacheAge = Date.now() - cached.cached_at;
        const CACHE_TTL = 10 * 60 * 1000; // 10분 (캐시 문제 방지)

        if (cacheAge < CACHE_TTL) {
          console.log('[CACHE HIT] Client from Firestore:', clientId);
          return { client: cached.client, debugInfo: { source: 'cache' } };
        }
      }
    } catch (cacheError) {
      console.error('[CACHE ERROR]', cacheError.message);
      // 캐시 실패해도 계속 진행
    }

    console.log('[CACHE MISS] Fetching from Sheets:', clientId);

    const SHEET_URL = env.GOOGLE_SHEETS_CSV_URL || 'https://docs.google.com/spreadsheets/d/1KrzLFi8Wt9GTGT97gcMoXnbZ3OJ04NsP4lncJyIdyhU/export?format=csv&gid=0';

    const response = await fetchWithTimeout(SHEET_URL, {}, 10000);

    const csvText = await response.text();



    // 수동 파싱 및 디버그 정보 수집

    const lines = csvText.trim().split('\n');

    const headers = parseCSVLine(lines[0]).map(h => h.replace(/^\uFEFF/, '').trim());

    const debugInfo = { headers, rawLine: lines[0] };



    const clients = [];

    for (let i = 1; i < lines.length; i++) {

      const values = parseCSVLine(lines[i]);

      const client = {};

      headers.forEach((header, index) => {

        client[header] = values[index] || '';

      });

      clients.push(client);

    }



    const normalizedClients = clients.map(normalizeClient);



    console.log('[SHEETS] Looking for clientId:', clientId);
    console.log('[SHEETS] Total clients:', normalizedClients.length);
    console.log('[SHEETS] Client subdomains:', normalizedClients.map(c => c.subdomain).slice(0, 5));

    const client = normalizedClients.find(c => {

      // subdomain 정규화: "00001.make-page.com" → "00001"

      let normalizedSubdomain = c.subdomain || '';

      if (normalizedSubdomain.includes('.make-page.com')) {

        normalizedSubdomain = normalizeSubdomain(normalizedSubdomain);

      }

      return normalizedSubdomain === clientId;

    });

    console.log('[SHEETS] Client found:', !!client);
    if (client) {
      console.log('[SHEETS] Client keys:', Object.keys(client).slice(0, 10));
      console.log('[SHEETS] Business name:', client.business_name, client['상호명']);
    }



    // Posts 조회 추가 (최신 포스팅)

    if (client) {

      const postsResult = await getPostsFromArchive(clientId, env);

      client.posts = postsResult.posts;

      if (postsResult.error) {

        debugInfo.postsError = postsResult.error;

      }

    }

    // Umami용 원본 이름 저장 (언어 표시 제거 전, 번역 전)
    if (client && client.business_name) {
      client.business_name_original = client.business_name;
    }

    // 상호명에서 언어 표시 자동 제거
    if (client && client.business_name) {
      client.business_name = removeLanguageSuffixFromBusinessName(client.business_name);
    }

    // Sheets 데이터 번역 (언어가 한국어가 아닐 때)
    if (client && client.language) {
      const langCode = normalizeLanguage(client.language);
      if (langCode !== 'ko') {
        // 번역할 필드 수집
        const fieldsToTranslate = [];
        if (client.business_name) fieldsToTranslate.push({ key: 'business_name', value: client.business_name });
        if (client.address) fieldsToTranslate.push({ key: 'address', value: client.address });
        if (client.business_hours) fieldsToTranslate.push({ key: 'business_hours', value: client.business_hours });
        if (client.contact) fieldsToTranslate.push({ key: 'contact', value: client.contact });
        if (client.description) fieldsToTranslate.push({ key: 'description', value: client.description });

        if (fieldsToTranslate.length > 0) {
          try {
            const subdomain = normalizeSubdomain(client.subdomain);
            const translations = await translateWithCache(fieldsToTranslate, langCode, subdomain, env);

            if (translations.business_name) client.business_name = translations.business_name;
            if (translations.address) client.address = translations.address;
            if (translations.business_hours) client.business_hours = translations.business_hours;
            if (translations.contact) client.contact = translations.contact;
            if (translations.description) client.description = translations.description;
          } catch (error) {
            console.error('Translation error:', error);
            // 번역 실패 시 원본 유지
          }
        }
      }
    }

    // Firestore 캐시 저장
    if (client) {
      try {
        await env.POSTING_KV.collection('clients_cache').doc(cacheKey).set({
          client,
          cached_at: Date.now()
        });
        console.log('[CACHE SAVE] Client cached:', clientId);
      } catch (cacheError) {
        console.error('[CACHE SAVE ERROR]', cacheError.message);
        // 캐시 저장 실패해도 계속 진행
      }
    }

    return { client, debugInfo };

  } catch (error) {

    console.error('Google Sheets fetch error:', error);

    return { client: null, debugInfo: { error: error.message } };

  }

}

module.exports = { getClientFromSheets };
