// HTML 유틸리티

function escapeHtml(text) {
  if (!text) return '';

  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };

  return text.toString().replace(/[&<>'"']/g, m => map[m]);
}

module.exports = { escapeHtml };
