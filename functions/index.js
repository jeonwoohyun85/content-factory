const functions = require('@google-cloud/functions-framework');
const { Firestore } = require('@google-cloud/firestore');
const { SecretManagerServiceClient } = require('@google-cloud/secret-manager');
const fs = require('fs');
const path = require('path');

const firestore = new Firestore({
  projectId: process.env.GCP_PROJECT || 'content-factory-1770105623'
});
const secretClient = new SecretManagerServiceClient();
let secretsCache = {};

async function loadSecrets() {
  if (Object.keys(secretsCache).length > 0) return secretsCache;
  const secretNames = ['GEMINI_API_KEY', 'TELEGRAM_BOT_TOKEN', 'TELEGRAM_CHAT_ID'];
  const projectId = process.env.GCP_PROJECT || 'content-factory-1770105623';
  for (const name of secretNames) {
    try {
      const [version] = await secretClient.accessSecretVersion({
        name: 'projects/' + projectId + '/secrets/' + name + '/versions/latest'
      });
      secretsCache[name] = version.payload.data.toString('utf8');
    } catch (error) {
      console.error('Secret ' + name + ' error:', error.message);
    }
  }
  return secretsCache;
}

async function createEnv() {
  await loadSecrets();
  return {
    POSTING_KV: firestore,
    GEMINI_API_KEY: secretsCache.GEMINI_API_KEY,
    SHEETS_ID: '1KrzLFi8Wt9GTGT97gcMoXnbZ3OJ04NsP4lncJyIdyhU'
  };
}

functions.http('main', async (req, res) => {
  try {
    const env = await createEnv();
    const cache = require('./modules/cache.js');
    const sheets = require('./modules/sheets.js');
    const pages = require('./modules/pages.js');
    const posting = require('./modules/posting.js');

    const host = req.headers.host || 'make-page.com';
    const pathname = req.path;

    // pathname에서 subdomain 추출 (/00001 형식) 또는 host에서 추출
    let subdomain = host.split('.')[0];
    if (pathname.match(/^\/\d{5}/)) {
      subdomain = pathname.substring(1).split('/')[0];
    }


    // Cron 및 테스트 엔드포인트 (subdomain 무관)
    if (pathname === '/cron-trigger') {
      const activeClients = await sheets.getActiveClients(env);
      const results = [];
      for (const client of activeClients) {
        const sub = client.subdomain.replace('.make-page.com', '');
        const result = await posting.generatePostingForClient(sub, env);
        results.push({ subdomain: sub, success: result.success });
      }
      return res.json({ success: true, results, total: activeClients.length });
    }

    if (pathname === '/test-posting') {
      const sub = req.body?.subdomain || req.query.subdomain;
      const result = await posting.generatePostingForClient(sub, env);
      return res.json(result);
    }

    if (pathname === '/refresh') {
      await cache.deleteCachedHTML(req.query.subdomain, env);
      return res.json({ success: true });
    }

    // Previous Posts AJAX API
    if (pathname === '/api/posts') {
      const sub = req.query.subdomain;
      const offset = parseInt(req.query.offset) || 0;
      const limit = parseInt(req.query.limit) || 10;

      if (!sub) return res.status(400).json({ error: 'Subdomain required' });

      try {
        const snapshot = await firestore.collection('posts_archive')
          .where('subdomain', '==', sub)
          .orderBy('created_at', 'desc')
          .offset(offset)
          .limit(limit)
          .get();

        const posts = snapshot.docs.map(doc => {
          const data = doc.data();
          return {
            title: data.title,
            url: data.url,
            created_at: data.created_at
          };
        });

        return res.json({ success: true, posts });
      } catch (error) {
        console.error('API posts error:', error);
        return res.status(500).json({ error: error.message });
      }
    }

    // 포스트 상세 페이지
    if (pathname === '/post') {
      const postId = req.query.id;
      if (!postId) return res.status(400).send('Post ID required');

      const { client } = await sheets.getClientFromSheets(subdomain, env);
      if (!client) return res.status(404).send('Client not found');

      // 먼저 최신 포스팅에서 찾기
      let post = client.posts?.find(p => {
        const pId = p.url ? p.url.split('id=')[1] : new Date(p.created_at).getTime().toString(36);
        return pId === postId;
      });

      // 최신 포스팅에 없으면 Firestore archive에서 찾기
      if (!post) {
        try {
          const snapshot = await firestore.collection('posts_archive')
            .where('subdomain', '==', subdomain)
            .get();

          const archivePost = snapshot.docs.find(doc => {
            const data = doc.data();
            const archiveId = data.url ? data.url.split('id=')[1] : '';
            return archiveId === postId;
          });

          if (archivePost) {
            post = archivePost.data();
          }
        } catch (error) {
          console.error('Archive search error:', error);
        }
      }

      if (!post) return res.status(404).send('Post not found');

      const html = await pages.generatePostPage(client, post, env);
      res.set('Content-Type', 'text/html; charset=utf-8');
      return res.send(html);
    }

    // 랜딩페이지 (make-page.com)
    if (subdomain === 'make-page' || host === 'make-page.com') {
      let htmlFile = 'index.html';
      if (pathname === '/privacy') htmlFile = 'privacy.html';
      else if (pathname === '/terms') htmlFile = 'terms.html';

      const htmlPath = path.join(__dirname, 'landing', htmlFile);
      const html = fs.readFileSync(htmlPath, 'utf-8');

      res.set('Content-Type', 'text/html; charset=utf-8');
      res.set('Cache-Control', 'public, max-age=3600');
      return res.send(html);
    }

    console.log('[DEBUG] Requested subdomain:', subdomain);

    const cachedHTML = await cache.getCachedHTML(subdomain, env);
    if (cachedHTML && !req.query.refresh) {
      res.set('Content-Type', 'text/html; charset=utf-8');
      return res.send(cachedHTML);
    }

    const { client, debugInfo } = await sheets.getClientFromSheets(subdomain, env);
    console.log('[DEBUG] Client found:', !!client);
    if (!client) return res.status(404).send('Not found');

    const html = await pages.generateClientPage(client, debugInfo, env);
    cache.setCachedHTML(subdomain, html, env);

    res.set('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
});

