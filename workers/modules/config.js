// 전역 설정 및 상수

// Umami Cloud Analytics
export const UMAMI_WEBSITE_ID = 'aea13630-0836-4fd6-91ae-d04b4180b6e7';

// 전역 번역 캐시 (Worker 재시작 전까지 유지)
export const TRANSLATION_CACHE = {};

// 주요 언어 하드코딩 번역 데이터
export const LANGUAGE_TEXTS = {

  ko: {

    info: 'Info',

    video: 'Video',

    posts: 'Posts',

    backToHome: '홈으로',

    phone: '전화하기',

    instagram: '인스타그램',

    youtube: '유튜브',

    facebook: '페이스북',

    kakao: '카카오톡',

    location: '위치보기',

    blog: '블로그',

    store: '스토어',

    booking: '예약하기',

    link: '링크',

    stats: '통계',

    postImage: '포스트 이미지',

    galleryImage: '갤러리 이미지'

  },

  en: {

    info: 'Gallery',

    video: 'Videos',

    posts: 'Posts',

    backToHome: 'Back to Home',

    phone: 'Call',

    instagram: 'Instagram',

    youtube: 'YouTube',

    facebook: 'Facebook',

    kakao: 'KakaoTalk',

    location: 'Location',

    blog: 'Blog',

    store: 'Store',

    booking: 'Book Now',

    link: 'Link',

    stats: 'Stats',

    postImage: 'Post Image',

    galleryImage: 'Gallery Image'

  },

  ja: {

    info: 'ギャラリー',

    video: '動画',

    posts: '投稿',

    backToHome: 'ホームに戻る',

    phone: '電話する',

    instagram: 'インスタグラム',

    youtube: 'ユーチューブ',

    facebook: 'フェイスブック',

    kakao: 'カカオトーク',

    location: '位置を見る',

    blog: 'ブログ',

    store: 'ストア',

    booking: '予約する',

    link: 'リンク',

    stats: '統計',

    postImage: '投稿画像',

    galleryImage: 'ギャラリー画像'

  },

  'zh-CN': {

    info: '画廊',

    video: '视频',

    posts: '帖子',

    backToHome: '返回主页',

    phone: '打电话',

    instagram: 'Instagram',

    youtube: 'YouTube',

    facebook: 'Facebook',

    kakao: 'KakaoTalk',

    location: '查看位置',

    blog: '博客',

    store: '商店',

    booking: '预订',

    link: '链接',

    stats: '统计',

    postImage: '帖子图片',

    galleryImage: '画廊图片'

  },

  'zh-TW': {

    info: '畫廊',

    video: '影片',

    posts: '貼文',

    backToHome: '返回主頁',

    phone: '打電話',

    instagram: 'Instagram',

    youtube: 'YouTube',

    facebook: 'Facebook',

    kakao: 'KakaoTalk',

    location: '查看位置',

    blog: '部落格',

    store: '商店',

    booking: '預訂',

    link: '連結',

    stats: '統計',

    postImage: '貼文圖片',

    galleryImage: '畫廊圖片'

  }

};
