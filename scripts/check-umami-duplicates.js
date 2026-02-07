// Umami 중복 웹사이트 확인 및 정리 스크립트

const UMAMI_BASE_URL = 'https://umami-analytics-753166847054.asia-northeast3.run.app';

async function main() {
    // 1. Secret Manager에서 credentials 가져오기
    const { execSync } = require('child_process');
    const username = execSync('gcloud secrets versions access latest --secret="UMAMI_USERNAME"').toString().trim();
    const password = execSync('gcloud secrets versions access latest --secret="UMAMI_PASSWORD"').toString().trim();

    // 2. 로그인
    const loginRes = await fetch(`${UMAMI_BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
    });
    const { token } = await loginRes.json();

    // 3. 모든 웹사이트 조회
    const websitesRes = await fetch(`${UMAMI_BASE_URL}/api/websites`, {
        headers: { 'Authorization': `Bearer ${token}` }
    });
    const { data: websites } = await websitesRes.json();

    // 4. 거래처별 그룹화
    const domains = ['00001.make-page.com', '00002.make-page.com', '00003.make-page.com', '00004.make-page.com', '00005.make-page.com'];
    const grouped = {};

    websites.forEach(w => {
        if (domains.includes(w.domain)) {
            if (!grouped[w.domain]) grouped[w.domain] = [];
            grouped[w.domain].push(w);
        }
    });

    // 5. 중복 확인 및 출력
    console.log('\n=== Umami 웹사이트 중복 확인 ===\n');

    for (const domain of domains) {
        const sites = grouped[domain] || [];
        console.log(`${domain}: ${sites.length}개`);

        if (sites.length > 1) {
            // 최신순 정렬
            sites.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

            console.log('  ⚠️  중복 발견!');
            sites.forEach((s, idx) => {
                const isLatest = idx === 0 ? '← 최신 (유지)' : '  (삭제 대상)';
                console.log(`    - ID: ${s.id}, shareId: ${s.shareId || 'None'}, created: ${s.createdAt} ${isLatest}`);
            });

            // 6. 중복 삭제 (최신 것만 남기고)
            const toKeep = sites[0];
            const toDelete = sites.slice(1);

            console.log(`\n  삭제 진행 (${toDelete.length}개)...`);
            for (const site of toDelete) {
                try {
                    await fetch(`${UMAMI_BASE_URL}/api/websites/${site.id}`, {
                        method: 'DELETE',
                        headers: { 'Authorization': `Bearer ${token}` }
                    });
                    console.log(`    ✅ 삭제: ${site.id} (shareId: ${site.shareId})`);
                } catch (error) {
                    console.log(`    ❌ 실패: ${site.id} - ${error.message}`);
                }
            }

            console.log(`  ✅ ${domain} 정리 완료 (유지: ${toKeep.id}, shareId: ${toKeep.shareId})\n`);
        } else if (sites.length === 1) {
            console.log(`  ✅ 정상 (shareId: ${sites[0].shareId})\n`);
        } else {
            console.log(`  ⚠️  웹사이트 없음\n`);
        }
    }

    console.log('=== 완료 ===\n');
}

main().catch(console.error);
