// Umami 셀프 호스팅 자동 관리 모듈

const { Firestore } = require('@google-cloud/firestore');

const UMAMI_BASE_URL = 'https://umami-analytics-753166847054.asia-northeast3.run.app';
const UMAMI_USERNAME = 'admin';
const UMAMI_PASSWORD = 'umami';
const CACHE_TTL = 365 * 24 * 60 * 60; // 1년 (웹사이트는 영구적)

let firestore;

function getFirestore() {
    if (!firestore) {
        firestore = new Firestore();
    }
    return firestore;
}

// Umami API 로그인
async function getUmamiToken() {
    const response = await fetch(`${UMAMI_BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            username: UMAMI_USERNAME,
            password: UMAMI_PASSWORD
        })
    });

    if (!response.ok) {
        throw new Error(`Umami login failed: ${response.status}`);
    }

    const data = await response.json();
    return data.token;
}

// Umami 웹사이트 생성
async function createUmamiWebsite(token, domain, name) {
    const response = await fetch(`${UMAMI_BASE_URL}/api/websites`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ domain, name })
    });

    if (!response.ok) {
        throw new Error(`Umami website creation failed: ${response.status}`);
    }

    return await response.json();
}

// Share URL 활성화 (시도)
async function enableShareUrl(token, websiteId) {
    try {
        const response = await fetch(`${UMAMI_BASE_URL}/api/websites/${websiteId}/share`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: '{}'
        });

        if (response.ok) {
            const data = await response.json();
            return data.shareId || null;
        }
    } catch (error) {
        console.warn(`Failed to enable share URL for ${websiteId}:`, error.message);
    }
    return null;
}

// Firestore 캐시에서 조회
async function getCachedUmamiWebsite(domain) {
    const db = getFirestore();
    const docRef = db.collection('umami_websites').doc(domain);
    const doc = await docRef.get();

    if (!doc.exists) {
        return null;
    }

    const data = doc.data();
    const now = Date.now();

    // TTL 체크 (1년)
    if (data.cachedAt && (now - data.cachedAt) < CACHE_TTL * 1000) {
        return data;
    }

    return null;
}

// Firestore 캐시에 저장
async function cacheUmamiWebsite(domain, websiteId, shareId) {
    const db = getFirestore();
    const docRef = db.collection('umami_websites').doc(domain);

    await docRef.set({
        domain,
        websiteId,
        shareId: shareId || null,
        shareUrl: shareId ? `${UMAMI_BASE_URL}/share/${shareId}` : null,
        cachedAt: Date.now(),
        createdAt: Date.now()
    });
}

// 메인 함수: Umami 웹사이트 자동 생성 또는 조회
async function getOrCreateUmamiWebsite(domain, businessName) {
    try {
        // 1. Firestore 캐시 확인
        const cached = await getCachedUmamiWebsite(domain);
        if (cached) {
            console.log(`[Umami] Cache hit for ${domain}`);
            return {
                websiteId: cached.websiteId,
                shareId: cached.shareId,
                shareUrl: cached.shareUrl
            };
        }

        console.log(`[Umami] Cache miss for ${domain}, creating new website...`);

        // 2. Umami API 로그인
        const token = await getUmamiToken();

        // 3. 웹사이트 생성
        const website = await createUmamiWebsite(token, domain, businessName);
        const websiteId = website.id;

        console.log(`[Umami] Created website ${websiteId} for ${domain}`);

        // 4. Share URL 활성화 시도
        const shareId = await enableShareUrl(token, websiteId);

        // 5. Firestore 캐시 저장
        await cacheUmamiWebsite(domain, websiteId, shareId);

        return {
            websiteId,
            shareId,
            shareUrl: shareId ? `${UMAMI_BASE_URL}/share/${shareId}` : null
        };
    } catch (error) {
        console.error(`[Umami] Failed to get/create website for ${domain}:`, error);
        // 실패 시 기본값 반환 (추적 스크립트는 작동하지 않지만 페이지는 표시)
        return {
            websiteId: null,
            shareId: null,
            shareUrl: null
        };
    }
}

// Umami 스크립트 URL
function getUmamiScriptUrl() {
    return `${UMAMI_BASE_URL}/script.js`;
}

module.exports = {
    getOrCreateUmamiWebsite,
    getUmamiScriptUrl
};
