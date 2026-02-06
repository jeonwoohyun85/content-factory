const { Firestore } = require('@google-cloud/firestore');

async function main() {
    const db = new Firestore();

    console.log('🔍 Checking Firestore umami_websites collection...\n');

    const snapshot = await db.collection('umami_websites').get();

    console.log(`Total: ${snapshot.size} websites\n`);

    snapshot.forEach(doc => {
        console.log(`- ${doc.id}`);
    });

    // Expected
    const expected = ['00001.make-page.com', '00002.make-page.com', '00003.make-page.com', '00004.make-page.com'];
    console.log('\n✅ Expected:');
    expected.forEach(d => {
        const exists = snapshot.docs.some(doc => doc.id === d);
        console.log(`${exists ? '✅' : '❌'} ${d}`);
    });
}

main().catch(console.error);
