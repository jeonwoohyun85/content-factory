// Firestore 캐시 함수 (KV 대체)

async function getCachedHTML(key, env) {
  try {
    const docRef = env.POSTING_KV.collection('cache').doc(`html_${key}`);
    const doc = await docRef.get();

    if (!doc.exists) return null;

    const data = doc.data();

    // TTL 체크 (60초 = 1분)
    if (data.expiresAt && Date.now() > data.expiresAt) {
      // 만료됨, 삭제
      await docRef.delete();
      return null;
    }

    return data.html;
  } catch (error) {
    console.error('Cache get error:', error);
    return null;
  }
}

async function setCachedHTML(key, html, env) {
  try {
    const docRef = env.POSTING_KV.collection('cache').doc(`html_${key}`);
    const expiresAt = Date.now() + (60 * 1000); // 1분 후

    await docRef.set({
      html,
      expiresAt,
      updatedAt: Date.now()
    });
  } catch (error) {
    console.error('Cache set error:', error);
  }
}

async function deleteCachedHTML(key, env) {
  try {
    const docRef = env.POSTING_KV.collection('cache').doc(`html_${key}`);
    await docRef.delete();
  } catch (error) {
    console.error('Cache delete error:', error);
  }
}

module.exports = {
  getCachedHTML,
  setCachedHTML,
  deleteCachedHTML
};
