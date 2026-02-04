const { Firestore } = require('@google-cloud/firestore');

const firestore = new Firestore({
  projectId: 'content-factory-1770105623'
});

async function test() {
  try {
    console.log('Firestore 조회 시작...');
    const snapshot = await firestore.collection('posts_archive')
      .where('subdomain', '==', '00001')
      .get();

    console.log(`총 ${snapshot.docs.length}개 문서 발견`);

    snapshot.docs.forEach(doc => {
      const data = doc.data();
      console.log(`- ${doc.id}: ${data.title}`);
    });
  } catch (error) {
    console.error('에러:', error.message);
  }
}

test();
