// Firestore Umami 캐시 업데이트 스크립트
const { Firestore } = require('@google-cloud/firestore');

const firestore = new Firestore();
const UMAMI_BASE_URL = 'https://umami-analytics-753166847054.asia-northeast3.run.app';

async function updateUmamiCache() {
    const updates = [
        { domain: '00001.make-page.com', websiteId: 'cc8edfce-967f-4201-aede-a8a9e8b90d4d', shareId: 'share00001' },
        { domain: '00003.make-page.com', websiteId: '2ce15739-db44-48ea-b7a8-12d6771dbded', shareId: 'share00003' },
        { domain: '00004.make-page.com', websiteId: '11bbf52a-2be7-4f1f-a959-f28b8d534f7d', shareId: 'share00004' }
    ];

    for (const update of updates) {
        const docRef = firestore.collection('umami_websites').doc(update.domain);
        await docRef.set({
            domain: update.domain,
            websiteId: update.websiteId,
            shareId: update.shareId,
            shareUrl: `${UMAMI_BASE_URL}/share/${update.shareId}`,
            cachedAt: Date.now(),
            createdAt: Date.now()
        });
        console.log(`✅ ${update.domain} - shareUrl: ${UMAMI_BASE_URL}/share/${update.shareId}`);
    }

    console.log('\n완료! 모든 캐시 업데이트됨');
}

updateUmamiCache().catch(console.error);
