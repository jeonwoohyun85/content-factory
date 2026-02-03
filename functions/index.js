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
    const subdomain = host.split('.')[0];
    const pathname = req.path;


    // Health Check 엔드포인트
    if (pathname === '/health') {
      try {
        await firestore.collection('_health').doc('check').set({ timestamp: new Date() }, { merge: true });
        const sheets = require('./modules/sheets.js');

        return res.status(200).json({
          status: 'healthy',
          service: 'content-factory',
          timestamp: new Date().toISOString(),
          checks: {
            firestore: 'ok',
            secrets: env.GEMINI_API_KEY ? 'ok' : 'missing',
            runtime: 'ok'
          }
        });
      } catch (error) {
        return res.status(503).json({
          status: 'unhealthy',
          service: 'content-factory',
          timestamp: new Date().toISOString(),
          error: error.message
        });
      }
    }

    // Cron 및 테스트 엔드포인트 (subdomain 무관)
    if (pathname === '/cron-trigger') {
      const results = [];
      for (const sub of ['00001', '00002', '00003', '00004']) {
        const result = await posting.generatePostingForClient(sub, env);
        results.push({ subdomain: sub, success: result.success });
      }
      return res.json({ success: true, results });
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

    const cachedHTML = await cache.getCachedHTML(subdomain, env);
    if (cachedHTML && !req.query.refresh) {
      res.set('Content-Type', 'text/html; charset=utf-8');
      return res.send(cachedHTML);
    }

    const client = await sheets.getClientFromSheets(subdomain, env);
    if (!client) return res.status(404).send('Not found');

    const html = await pages.generateClientPage(client, env);
    cache.setCachedHTML(subdomain, html, env);

    res.set('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
});

