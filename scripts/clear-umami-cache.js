// Umami 캐시 삭제 스크립트
const { Firestore } = require('@google-cloud/firestore');

const firestore = new Firestore({
    projectId: 'content-factory-1770105623'
});

async function clearUmamiCache() {
    const domains = [
        '00001.make-page.com',
        '00002.make-page.com',
        '00003.make-page.com',
        '00004.make-page.com'
    ];

    for (const domain of domains) {
        try {
            await firestore.collection('umami_websites').doc(domain).delete();
            console.log(`✅ Deleted: ${domain}`);
        } catch (error) {
            console.error(`❌ Failed to delete ${domain}:`, error.message);
        }
    }

    console.log('\n완료. 다음 페이지 로드 시 Sheets 원본 상호명으로 재생성됩니다.');
}

clearUmamiCache().catch(console.error);
