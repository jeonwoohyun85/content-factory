// Umami 셀프 호스팅 자동 관리 모듈

const { Firestore } = require('@google-cloud/firestore');

const UMAMI_BASE_URL = 'https://umami-analytics-753166847054.asia-northeast3.run.app';
const CACHE_TTL = 365 * 24 * 60 * 60; // 1년 (웹사이트는 영구적)

let firestore;

function getFirestore() {
    if (!firestore) {
        firestore = new Firestore();
    }
    return firestore;
}

// Umami API 로그인
async function getUmamiToken(env) {
    if (!env.UMAMI_USERNAME || !env.UMAMI_PASSWORD) {
        throw new Error('Umami credentials not configured');
    }

    const response = await fetch(`${UMAMI_BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            username: env.UMAMI_USERNAME,
            password: env.UMAMI_PASSWORD
        })
    });

    if (!response.ok) {
        throw new Error(`Umami login failed: ${response.status}`);
    }

    const data = await response.json();
    return data.token;
}

// Umami 기존 웹사이트 조회 (도메인 기준)
async function findExistingWebsite(token, domain) {
    try {
        const response = await fetch(`${UMAMI_BASE_URL}/api/websites`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            console.warn(`Failed to fetch websites: ${response.status}`);
            return null;
        }

        const data = await response.json();
        const websites = data.data || [];

        // 동일 도메인 웹사이트 찾기 (가장 최근 것)
        const matches = websites.filter(w => w.domain === domain);
        if (matches.length > 0) {
            // 최신순 정렬 (createdAt 기준)
            matches.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
            return matches[0];
        }

        return null;
    } catch (error) {
        console.warn(`Failed to find existing website for ${domain}:`, error.message);
        return null;
    }
}

// Umami 웹사이트 생성
async function createUmamiWebsite(token, domain, name) {
    // 도메인을 name에 포함 (http 제외)
    const displayName = `${name} (${domain})`;

    const response = await fetch(`${UMAMI_BASE_URL}/api/websites`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ domain, name: displayName })
    });

    if (!response.ok) {
        throw new Error(`Umami website creation failed: ${response.status}`);
    }

    return await response.json();
}

// Share URL 활성화 (랜덤 shareId 생성)
async function enableShareUrl(token, websiteId) {
    try {
        // 랜덤 shareId 생성 (8자 영숫자, crypto 기반)
        const crypto = require('crypto');
        const shareId = crypto.randomBytes(4).toString('hex').substring(0, 8);

        const response = await fetch(`${UMAMI_BASE_URL}/api/websites/${websiteId}`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ shareId })
        });

        if (!response.ok) {
            console.warn(`Failed to enable share URL for ${websiteId}: ${response.status}`);
            return null;
        }

        const data = await response.json();
        return data.shareId || shareId;
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
async function getOrCreateUmamiWebsite(domain, businessName, env) {
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

        console.log(`[Umami] Cache miss for ${domain}, checking existing websites...`);

        // 2. Umami API 로그인
        const token = await getUmamiToken(env);

        // 3. 기존 웹사이트 조회 (재사용)
        let website = await findExistingWebsite(token, domain);
        let websiteId;

        if (website) {
            websiteId = website.id;
            console.log(`[Umami] Reusing existing website ${websiteId} for ${domain}`);
        } else {
            // 4. 없으면 새로 생성
            website = await createUmamiWebsite(token, domain, businessName);
            websiteId = website.id;
            console.log(`[Umami] Created new website ${websiteId} for ${domain}`);
        }

        // 5. Share URL 확인 또는 활성화
        let shareId = website.shareId || null;

        // shareId 없으면 생성 시도
        if (!shareId) {
            shareId = await enableShareUrl(token, websiteId);
        }

        // 6. Firestore 캐시 저장
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

// Umami 캐시 삭제
async function deleteCachedUmamiWebsite(domain) {
    const db = getFirestore();
    const docRef = db.collection('umami_websites').doc(domain);
    await docRef.delete();
    console.log(`[Umami] Cache deleted for ${domain}`);
}

// Umami 스크립트 URL
function getUmamiScriptUrl() {
    return `${UMAMI_BASE_URL}/script.js`;
}

module.exports = {
    getOrCreateUmamiWebsite,
    getUmamiScriptUrl,
    deleteCachedUmamiWebsite
};
