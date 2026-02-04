// Google Sheets 활성 거래처 목록 조회

const { fetchWithTimeout } = require('../utils/http-utils.js');
const { parseCSVLine } = require('../utils/csv-parser.js');
const { normalizeClient } = require('../utils/normalize.js');

async function getActiveClients(env) {
  try {
    const SHEET_URL = env.GOOGLE_SHEETS_CSV_URL || 'https://docs.google.com/spreadsheets/d/1KrzLFi8Wt9GTGT97gcMoXnbZ3OJ04NsP4lncJyIdyhU/export?format=csv&gid=0';
    const response = await fetchWithTimeout(SHEET_URL, {}, 10000);
    const csvText = await response.text();
    const lines = csvText.trim().split('\n');
    const headers = parseCSVLine(lines[0]).map(h => h.replace(/^\uFEFF/, '').trim());

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
    return normalizedClients.filter(c => c.subscription === '활성');
  } catch (error) {
    console.error('getActiveClients error:', error.message);
    return [];
  }
}

module.exports = { getActiveClients };
