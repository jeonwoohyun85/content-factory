// Firestore umami_websites 컬렉션 확인 스크립트
const { Firestore } = require('@google-cloud/firestore');

async function checkUmamiWebsites() {
    try {
        const db = new Firestore();

        console.log('🔍 Firestore umami_websites 컬렉션 조회 중...\n');

        const snapshot = await db.collection('umami_websites').get();

        console.log(`✅ 총 ${snapshot.size}개의 Umami 웹사이트 발견\n`);

        if (snapshot.empty) {
            console.log('⚠️  등록된 Umami 웹사이트가 없습니다.');
            return;
        }

        const websites = [];
        snapshot.forEach(doc => {
            const data = doc.data();
            websites.push({
                domain: doc.id,
                websiteId: data.websiteId,
                shareId: data.shareId,
                shareUrl: data.shareUrl,
                createdAt: data.createdAt ? new Date(data.createdAt).toLocaleString('ko-KR') : 'N/A'
            });
        });

        // 도메인 순으로 정렬
        websites.sort((a, b) => a.domain.localeCompare(b.domain));

        console.log('📋 Umami 웹사이트 목록:\n');
        websites.forEach((site, index) => {
            console.log(`${index + 1}. ${site.domain}`);
            console.log(`   Website ID: ${site.websiteId}`);
            console.log(`   Share URL: ${site.shareUrl || '(미설정)'}`);
            console.log(`   생성일: ${site.createdAt}\n`);
        });

        // 예상 거래처 목록
        const expectedDomains = [
            '00001.make-page.com',
            '00002.make-page.com',
            '00003.make-page.com',
            '00004.make-page.com'
        ];

        console.log('🔎 검증 결과:\n');
        expectedDomains.forEach(domain => {
            const found = websites.find(w => w.domain === domain);
            if (found) {
                console.log(`✅ ${domain} - 등록됨`);
            } else {
                console.log(`❌ ${domain} - 미등록`);
            }
        });

    } catch (error) {
        console.error('❌ 에러:', error.message);
        process.exit(1);
    }
}

checkUmamiWebsites();
