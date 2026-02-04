// CSV 파싱

function parseCSV(csvText) {
  const lines = csvText.trim().split('\n');

  // 헤더 파싱 (BOM 제거 및 공백 제거)
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

  return clients;
}

function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }

  result.push(current.trim());

  // CSV 파싱 검증
  if (inQuotes) {
    console.error('[CSV Parse Error] Unclosed quotes detected in line:', line.substring(0, 100));
  }

  return result;
}

module.exports = { parseCSV, parseCSVLine };
