// 시간 유틸리티

function formatKoreanTime(isoString) {
  if (!isoString) return '';

  try {
    // 시트에 이미 KST 시간이 저장되어 있으므로 그대로 파싱
    const match = isoString.match(/^(\d{4})-(\d{2})-(\d{2})\s+(\d{2}):(\d{2})/);

    if (match) {
      const [_, year, month, day, hours, minutes] = match;
      return `${year}-${month}-${day} ${hours}:${minutes}`;
    }

    // 폴백: ISO 형식이 아닌 경우
    return isoString;

  } catch (error) {
    return isoString;
  }
}

module.exports = { formatKoreanTime };
