const functions = require('@google-cloud/functions-framework');
const { Firestore } = require('@google-cloud/firestore');
const { SecretManagerServiceClient } = require('@google-cloud/secret-manager');

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

    if (subdomain === 'make-page') {
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
      return res.redirect(301, 'https://make-page.com');
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
