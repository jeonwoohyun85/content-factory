// 거래처 정보 조회 (Sheets)

const { fetchWithTimeout, parseCSV, normalizeClient, normalizeLanguage, removeLanguageSuffixFromBusinessName, normalizeSubdomain } = require('../utils.js');
const { translateWithCache } = require('../translation-cache.js');

async function getClientFromSheetsForPosting(subdomain, env) {

  const SHEET_URL = env.GOOGLE_SHEETS_CSV_URL || 'https://docs.google.com/spreadsheets/d/1KrzLFi8Wt9GTGT97gcMoXnbZ3OJ04NsP4lncJyIdyhU/export?format=csv&gid=0';



  try {

    const response = await fetchWithTimeout(SHEET_URL, {}, 10000);



    if (!response.ok) {

      throw new Error(`Sheets CSV fetch failed: ${response.status}`);

    }



    const csvText = await response.text();

    const clients = parseCSV(csvText).map(normalizeClient);



    const client = clients.find(c => {

      let normalized = normalizeSubdomain(c.subdomain);

      return normalized === subdomain && c.subscription === '활성';

    }) || null;

    // 상호명 원본 보존 (시트 저장용)
    if (client && client.business_name) {
      client.business_name_original = client.business_name;
      client.business_name = removeLanguageSuffixFromBusinessName(client.business_name);
    }

    // Sheets 데이터 번역 (언어가 한국어가 아닐 때)
    if (client && client.language) {
      const langCode = normalizeLanguage(client.language);
      if (langCode !== 'ko') {
        const fieldsToTranslate = [];
        if (client.business_name) fieldsToTranslate.push({ key: 'business_name', value: client.business_name });
        if (client.address) fieldsToTranslate.push({ key: 'address', value: client.address });
        if (client.business_hours) fieldsToTranslate.push({ key: 'business_hours', value: client.business_hours });
        if (client.contact) fieldsToTranslate.push({ key: 'contact', value: client.contact });
        if (client.description) fieldsToTranslate.push({ key: 'description', value: client.description });

        if (fieldsToTranslate.length > 0) {
          try {
            const translations = await translateWithCache(fieldsToTranslate, langCode, subdomain, env);

            if (translations.business_name) client.business_name = translations.business_name;
            if (translations.address) client.address = translations.address;
            if (translations.business_hours) client.business_hours = translations.business_hours;
            if (translations.contact) client.contact = translations.contact;
            if (translations.description) client.description = translations.description;
          } catch (error) {
            console.error('Translation error in getClientFromSheetsForPosting:', error);
          }
        }
      }
    }

    return client;

  } catch (error) {

    console.error(`getClientFromSheetsForPosting 에러: ${error.message}`);

    throw error;

  }

}

module.exports = { getClientFromSheetsForPosting };
