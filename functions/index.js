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
    const { getClientFromSheets } = require('./modules/sheets/client-reader.js');
    const { getActiveClients } = require('./modules/sheets/client-lister.js');
    const { generateClientPage } = require('./modules/pages/client-page.js');
    const { generatePostPage } = require('./modules/pages/post-page.js');
    const posting = require('./modules/posting.js');
    const { checkRateLimit, getRateLimitHeaders } = require('./modules/rate-limiter.js');

    const host = req.headers.host || 'make-page.com';
    const pathname = req.path;
    const clientIp = req.headers['x-forwarded-for']?.split(',')[0] || req.ip || 'unknown';

    // pathname에서 subdomain 추출 (/00001 형식) 또는 host에서 추출
    let subdomain = host.split('.')[0];
    if (pathname.match(/^\/\d{5}/)) {
      subdomain = pathname.substring(1).split('/')[0];
    }


    // Cron 및 테스트 엔드포인트 (subdomain 무관)
    if (pathname === '/cron-trigger') {
      // OIDC 인증: Cloud Scheduler만 허용
      const authHeader = req.headers.authorization;
      const userAgent = req.headers['user-agent'];

      // Authorization 헤더와 User-Agent 둘 다 확인
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        console.error('[CRON AUTH] Missing or invalid Authorization header');
        return res.status(401).json({ error: 'Unauthorized: Missing Authorization' });
      }

      if (!userAgent || !userAgent.includes('Google-Cloud-Scheduler')) {
        console.error('[CRON AUTH] Invalid User-Agent:', userAgent);
        return res.status(401).json({ error: 'Unauthorized: Invalid User-Agent' });
      }

      console.log('[CRON AUTH] Authorized: Cloud Scheduler');

      try {
        const startTime = Date.now();
        const activeClients = await getActiveClients(env);
        const results = [];
        let successCount = 0;
        let failCount = 0;
        const BATCH_SIZE = 5;

        console.log(`[CRON] 시작: ${activeClients.length}개 거래처 처리 (배치 ${BATCH_SIZE}개)`);

        // 배치 병렬 처리 (5개씩)
        for (let i = 0; i < activeClients.length; i += BATCH_SIZE) {
          const batch = activeClients.slice(i, i + BATCH_SIZE);
          const batchNum = Math.floor(i / BATCH_SIZE) + 1;

          console.log(`[CRON] 배치 ${batchNum} 시작: ${batch.length}개 처리`);

          const batchPromises = batch.map(async (client) => {
            const sub = client.subdomain.replace('.make-page.com', '');
            try {
              const result = await posting.generatePostingForClient(sub, env);
              if (result.success) {
                console.log(`[CRON] ✓ ${sub} 성공`);
              } else {
                console.error(`[CRON] ✗ ${sub} 실패: ${result.error}`);
              }
              return { subdomain: sub, success: result.success, error: result.error || null };
            } catch (error) {
              console.error(`[CRON] ✗ ${sub} 예외: ${error.message}`);
              return { subdomain: sub, success: false, error: error.message };
            }
          });

          const batchResults = await Promise.all(batchPromises);
          results.push(...batchResults);

          // 배치 결과 집계
          batchResults.forEach(result => {
            if (result.success) successCount++;
            else failCount++;
          });

          console.log(`[CRON] 배치 ${batchNum} 완료: ${batchResults.filter(r => r.success).length}/${batch.length} 성공`);
        }

        const duration = ((Date.now() - startTime) / 1000).toFixed(2);
        console.log(`[CRON] 전체 완료: ${successCount}/${activeClients.length} 성공, ${failCount} 실패, ${duration}초`);

        // 전체 실패 시 ERROR 로그 (Telegram 알림 트리거)
        if (failCount === activeClients.length && activeClients.length > 0) {
          console.error(`[CRON ERROR] 모든 거래처 실패! 시스템 점검 필요`);
        }

        // Telegram 크론 결과 알림
        const telegramToken = secretsCache.TELEGRAM_BOT_TOKEN;
        const chatId = secretsCache.TELEGRAM_CHAT_ID;
        if (telegramToken && chatId) {
          try {
            const kstNow = new Date(Date.now() + (9 * 60 * 60 * 1000));
            const kstTime = kstNow.toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' });

            const failedClients = results.filter(r => !r.success);
            const failedList = failedClients.length > 0
              ? `\n\n실패 거래처:\n${failedClients.map(r => `- ${r.subdomain}: ${r.error}`).join('\n')}`
              : '';

            const message = `🤖 크론 실행 완료\n\n✅ 성공: ${successCount}/${activeClients.length}\n❌ 실패: ${failCount}\n\n⏱ 소요 시간: ${duration}초\n🗓 실행 시간: ${kstTime}${failedList}`;

            await fetch(`https://api.telegram.org/bot${telegramToken}/sendMessage`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                chat_id: chatId,
                text: message
              })
            });
            console.log('[CRON] Telegram 알림 전송 완료');
          } catch (error) {
            console.error('[CRON] Telegram 알림 전송 실패:', error.message);
          }
        }

        return res.json({
          success: true,
          results,
          summary: {
            total: activeClients.length,
            success: successCount,
            fail: failCount,
            duration: `${duration}s`,
            batchSize: BATCH_SIZE
          }
        });
      } catch (error) {
        console.error(`[CRON FATAL] 크론 실행 실패: ${error.message}`, error.stack);
        return res.status(500).json({
          success: false,
          error: error.message,
          stack: error.stack?.substring(0, 500)
        });
      }
    }

    if (pathname === '/test-posting') {
      const rateLimitResult = await checkRateLimit(clientIp, pathname, env);
      const headers = getRateLimitHeaders(rateLimitResult);
      Object.entries(headers).forEach(([key, value]) => res.set(key, value));

      if (!rateLimitResult.allowed) {
        return res.status(429).json({
          error: 'Too many requests',
          retryAfter: rateLimitResult.retryAfter
        });
      }

      const sub = req.body?.subdomain || req.query.subdomain;
      const result = await posting.generatePostingForClient(sub, env);
      return res.json(result);
    }

    if (pathname === '/refresh') {
      const rateLimitResult = await checkRateLimit(clientIp, pathname, env);
      const headers = getRateLimitHeaders(rateLimitResult);
      Object.entries(headers).forEach(([key, value]) => res.set(key, value));

      if (!rateLimitResult.allowed) {
        return res.status(429).json({
          error: 'Too many requests',
          retryAfter: rateLimitResult.retryAfter
        });
      }

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

      const { client } = await getClientFromSheets(subdomain, env);
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

      const html = await generatePostPage(client, post, env);
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

    const { client, debugInfo } = await getClientFromSheets(subdomain, env);
    console.log('[DEBUG] Client found:', !!client);
    if (!client) return res.status(404).send('Not found');

    const html = await generateClientPage(client, debugInfo, env);
    cache.setCachedHTML(subdomain, html, env);

    res.set('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
});

