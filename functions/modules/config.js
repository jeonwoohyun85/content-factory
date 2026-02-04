// 전역 설정 및 상수

// Umami Cloud Analytics
const UMAMI_WEBSITE_ID = 'aea13630-0836-4fd6-91ae-d04b4180b6e7';

// LRU 캐시 (최대 50개 항목)
const CACHE_MAX_SIZE = 50;
const cacheOrder = []; // 사용 순서 추적 (최신이 마지막)
const cacheData = {}; // 실제 캐시 데이터

// LRU 캐시 관리 함수
function getFromCache(key) {
  if (cacheData[key]) {
    // 사용한 항목을 맨 뒤로 이동 (최신 사용)
    const index = cacheOrder.indexOf(key);
    if (index > -1) {
      cacheOrder.splice(index, 1);
    }
    cacheOrder.push(key);
    return cacheData[key];
  }
  return null;
}

function addToCache(key, value) {
  // 이미 존재하면 갱신
  if (cacheData[key]) {
    const index = cacheOrder.indexOf(key);
    if (index > -1) {
      cacheOrder.splice(index, 1);
    }
    cacheOrder.push(key);
    cacheData[key] = value;
    return;
  }

  // 캐시가 꽉 찼으면 가장 오래된 항목 제거
  if (cacheOrder.length >= CACHE_MAX_SIZE) {
    const oldestKey = cacheOrder.shift();
    delete cacheData[oldestKey];
  }

  // 새 항목 추가
  cacheOrder.push(key);
  cacheData[key] = value;
}

// 하위 호환성을 위한 전역 캐시 객체 (사용 금지 - 레거시)
const TRANSLATION_CACHE = new Proxy({}, {
  get(target, prop) {
    return getFromCache(prop);
  },
  set(target, prop, value) {
    addToCache(prop, value);
    return true;
  }
});

// 주요 언어 하드코딩 번역 데이터
const LANGUAGE_TEXTS = {

  ko: {

    home: '홈',

    posts: '포스팅',

    location: '위치',

    hours: '영업시간',

    contact: '연락처',

    gallery: '갤러리',

    back: '뒤로가기',

    readMore: '자세히 보기',

    info: 'Info',

    video: 'Video',

    backToHome: '홈으로',

    phone: '전화하기',

    instagram: '인스타그램',

    youtube: '유튜브',

    facebook: '페이스북',

    kakao: '카카오톡',

    blog: '블로그',

    store: '스토어',

    booking: '예약하기',

    link: '링크',

    stats: '통계',

    postImage: '포스트 이미지',

    galleryImage: '갤러리 이미지'

  },

  en: {

    home: 'Home',

    posts: 'Posts',

    location: 'Location',

    hours: 'Hours',

    contact: 'Contact',

    gallery: 'Gallery',

    back: 'Back',

    readMore: 'Read More',

    info: 'Gallery',

    video: 'Videos',

    backToHome: 'Back to Home',

    phone: 'Call',

    instagram: 'Instagram',

    youtube: 'YouTube',

    facebook: 'Facebook',

    kakao: 'KakaoTalk',

    blog: 'Blog',

    store: 'Store',

    booking: 'Book Now',

    link: 'Link',

    stats: 'Stats',

    postImage: 'Post Image',

    galleryImage: 'Gallery Image'

  },

  ja: {

    home: 'ホーム',

    posts: '投稿',

    location: '場所',

    hours: '営業時間',

    contact: '連絡先',

    gallery: 'ギャラリー',

    back: '戻る',

    readMore: '続きを読む',

    info: 'ギャラリー',

    video: '動画',

    backToHome: 'ホームに戻る',

    phone: '電話する',

    instagram: 'インスタグラム',

    youtube: 'ユーチューブ',

    facebook: 'フェイスブック',

    kakao: 'カカオトーク',

    blog: 'ブログ',

    store: 'ストア',

    booking: '予約する',

    link: 'リンク',

    stats: '統計',

    postImage: '投稿画像',

    galleryImage: 'ギャラリー画像'

  },

  'zh-CN': {

    home: '首页',

    posts: '帖子',

    location: '位置',

    hours: '营业时间',

    contact: '联系方式',

    gallery: '画廊',

    back: '返回',

    readMore: '阅读更多',

    info: '画廊',

    video: '视频',

    backToHome: '返回主页',

    phone: '打电话',

    instagram: 'Instagram',

    youtube: 'YouTube',

    facebook: 'Facebook',

    kakao: 'KakaoTalk',

    blog: '博客',

    store: '商店',

    booking: '预订',

    link: '链接',

    stats: '统计',

    postImage: '帖子图片',

    galleryImage: '画廊图片'

  },

  'zh-TW': {

    home: '首頁',

    posts: '貼文',

    location: '位置',

    hours: '營業時間',

    contact: '聯絡方式',

    gallery: '畫廊',

    back: '返回',

    readMore: '閱讀更多',

    info: '畫廊',

    video: '影片',

    backToHome: '返回主頁',

    phone: '打電話',

    instagram: 'Instagram',

    youtube: 'YouTube',

    facebook: 'Facebook',

    kakao: 'KakaoTalk',

    blog: '部落格',

    store: '商店',

    booking: '預訂',

    link: '連結',

    stats: '統計',

    postImage: '貼文圖片',

    galleryImage: '畫廊圖片'

  },

  th: {

    home: 'หน้าแรก',

    posts: 'โพสต์',

    location: 'ที่ตั้ง',

    hours: 'เวลาทำการ',

    contact: 'ติดต่อ',

    gallery: 'แกลเลอรี',

    back: 'กลับ',

    readMore: 'อ่านเพิ่มเติม',

    info: 'แกลเลอรี',

    video: 'วิดีโอ',

    backToHome: 'กลับหน้าแรก',

    phone: 'โทร',

    instagram: 'Instagram',

    youtube: 'YouTube',

    facebook: 'Facebook',

    kakao: 'KakaoTalk',

    blog: 'บล็อก',

    store: 'ร้านค้า',

    booking: 'จองเลย',

    link: 'ลิงก์',

    stats: 'สถิติ',

    postImage: 'รูปโพสต์',

    galleryImage: 'รูปแกลเลอรี'

  }
};

module.exports = {
  TRANSLATION_CACHE,
  LANGUAGE_TEXTS,
  getFromCache,
  addToCache
};
