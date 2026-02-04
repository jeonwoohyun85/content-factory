// URL 유틸리티

function getLinkInfo(url, texts) {
  if (!url) return null;

  url = url.trim();

  // 유효한 URL인지 확인 (http/https/tel:로 시작하는 것만 처리)
  if (!url.startsWith('http') && !url.startsWith('tel:')) {
    return null;
  }

  if (url.startsWith('tel:')) {
    return { icon: '📞', text: texts.phone, url };
  }

  if (url.includes('instagram.com')) {
    return { icon: '📷', text: texts.instagram, url };
  }

  if (url.includes('youtube.com') || url.includes('youtu.be')) {
    return { icon: '▶️', text: texts.youtube, url };
  }

  if (url.includes('facebook.com')) {
    return { icon: '👥', text: texts.facebook, url };
  }

  if (url.includes('pf.kakao.com') || url.includes('talk.kakao')) {
    return { icon: '💬', text: texts.kakao, url };
  }

  if (url.includes('map.naver.com') || url.includes('naver.me')) {
    return { icon: '📍', text: texts.location, url };
  }

  if (url.includes('maps.google.com') || url.includes('goo.gl/maps')) {
    return { icon: '📍', text: texts.location, url };
  }

  if (url.includes('map.kakao.com')) {
    return { icon: '📍', text: texts.location, url };
  }

  if (url.includes('smartstore.naver.com') || url.includes('brand.naver.com')) {
    return { icon: '🛒', text: texts.store, url };
  }

  if (url.includes('blog.naver.com')) {
    return { icon: '📝', text: texts.blog, url };
  }

  if (url.includes('tistory.com')) {
    return { icon: '📝', text: texts.blog, url };
  }

  if (url.includes('booking') || url.includes('reserve')) {
    return { icon: '📅', text: texts.booking, url };
  }

  if (url === '/stats' || url.includes('umami')) {
    return { icon: '📊', text: texts.stats, url };
  }

  return { icon: '🔗', text: texts.link, url };
}

function convertToEmbedUrl(url) {
  if (!url) return null;

  url = url.trim();

  // YouTube
  if (url.includes('youtube.com/watch?v=')) {
    const videoId = url.split('v=')[1].split('&')[0];
    return `https://www.youtube.com/embed/${videoId}`;
  }

  if (url.includes('youtu.be/')) {
    const videoId = url.split('youtu.be/')[1].split('?')[0];
    return `https://www.youtube.com/embed/${videoId}`;
  }

  // Google Drive
  if (url.includes('drive.google.com/file/d/')) {
    const fileId = url.split('/d/')[1].split('/')[0];
    return `https://drive.google.com/file/d/${fileId}/preview`;
  }

  // TikTok
  if (url.includes('tiktok.com')) {
    const match = url.match(/video\/(\d+)/);
    if (match) {
      return `https://www.tiktok.com/embed/v2/${match[1]}`;
    }
  }

  // Instagram
  if (url.includes('instagram.com')) {
    if (url.includes('/p/') || url.includes('/reel/')) {
      const cleanUrl = url.split('?')[0];
      return `${cleanUrl}embed/`;
    }
  }

  return url;
}

function extractUrlFromMarkdown(text) {
  if (!text) return text;
  const match = text.match(/\[.*?\]\((https?:\/\/[^\)]+)\)/);
  return match ? match[1] : text;
}

module.exports = { getLinkInfo, convertToEmbedUrl, extractUrlFromMarkdown };
