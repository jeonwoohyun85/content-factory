// Firestore Umami 캐시 확인 스크립트

const { Firestore } = require('@google-cloud/firestore');

async function main() {
    const db = new Firestore();
    const domains = ['00001.make-page.com', '00002.make-page.com', '00003.make-page.com', '00004.make-page.com', '00005.make-page.com'];

    console.log('\n=== Firestore Umami 캐시 확인 ===\n');

    for (const domain of domains) {
        const docRef = db.collection('umami_websites').doc(domain);
        const doc = await docRef.get();

        if (doc.exists) {
            const data = doc.data();
            console.log(`${domain}:`);
            console.log(`  websiteId: ${data.websiteId}`);
            console.log(`  shareId: ${data.shareId}`);
            console.log(`  cachedAt: ${new Date(data.cachedAt).toISOString()}`);
        } else {
            console.log(`${domain}: ❌ 캐시 없음`);
        }
        console.log('');
    }
}

main().catch(console.error);
