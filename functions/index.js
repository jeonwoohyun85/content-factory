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
  const secretNames = ['GEMINI_API_KEY', 'TELEGRAM_BOT_TOKEN', 'TELEGRAM_CHAT_ID', 'UMAMI_USERNAME', 'UMAMI_PASSWORD'];
  const projectId = process.env.GCP_PROJECT || 'content-factory-1770105623';
  for (const name of secretNames) {
    try {
      const [version] = await secretClient.accessSecretVersion({
        name: 'projects/' + projectId + '/secrets/' + name + '/versions/latest'
      });
      secretsCache[name] = version.payload.data.toString('utf8').trim();
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
    SHEETS_ID: process.env.SHEETS_ID || '1KrzLFi8Wt9GTGT97gcMoXnbZ3OJ04NsP4lncJyIdyhU',
    DRIVE_FOLDER_ID: process.env.DRIVE_FOLDER_ID || '1JiVmIkliR9YrPIUPOn61G8Oh7h9HTMEt',
    UMAMI_USERNAME: secretsCache.UMAMI_USERNAME,
    UMAMI_PASSWORD: secretsCache.UMAMI_PASSWORD,
    GOOGLE_SHEETS_CSV_URL: process.env.GOOGLE_SHEETS_CSV_URL
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

    // X-Forwarded-Host 우선 사용 (Load Balancer를 통한 접속 시 원본 Host)
    const host = req.headers['x-forwarded-host'] || req.headers.host || 'make-page.com';
    const pathname = req.path;
    const clientIp = req.headers['x-forwarded-for']?.split(',')[0] || req.ip || 'unknown';

    // 디버그: 헤더 확인
    console.log('[DEBUG HEADERS]', {
      'x-forwarded-host': req.headers['x-forwarded-host'],
      'host': req.headers.host,
      'resolved host': host,
      'pathname': pathname
    });

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

      // 동시 실행 방지: Firestore 락 (KST 날짜 기준)
      const kstNow = new Date(Date.now() + (9 * 60 * 60 * 1000));
      const kstDateStr = kstNow.toISOString().split('T')[0];
      const lockKey = `cron_lock_${kstDateStr}`;
      const lockRef = firestore.collection('cron_locks').doc(lockKey);
      let lockAcquired = false;

      try {
        const lockDoc = await lockRef.get();
        if (lockDoc.exists) {
          const lockData = lockDoc.data();
          const lockAge = Date.now() - lockData.locked_at;

          // 락이 30분 이내면 중복 실행으로 간주
          if (lockAge < 30 * 60 * 1000) {
            console.log(`[CRON] 중복 실행 방지: ${lockKey} (${Math.floor(lockAge / 1000)}초 전 실행됨)`);
            return res.status(409).json({
              error: 'Cron already running',
              lockKey,
              lockedAt: lockData.locked_at
            });
          }
        }

        // 락 설정
        await lockRef.set({
          locked_at: Date.now(),
          locked_date: kstDateStr
        });
        lockAcquired = true;
        console.log(`[CRON] 락 설정: ${lockKey}`);

        const startTime = Date.now();
        const activeClients = await getActiveClients(env);

        console.log(`[CRON] 시작: ${activeClients.length}개 거래처 Cloud Tasks 등록`);

        // Cloud Tasks에 Task 등록 (비동기 분산 처리)
        const { createPostingTasksBatch } = require('./modules/task-dispatcher.js');
        const projectId = process.env.GCP_PROJECT || 'content-factory-1770105623';
        const location = 'asia-northeast3';
        const queue = 'posting-queue';
        const functionUrl = process.env.FUNCTION_URL || 'https://content-factory-wdbgrmxlaa-du.a.run.app';

        // 거래처 서브도메인 추출
        const subdomains = activeClients.map(client =>
          client.subdomain.replace('.make-page.com', '')
        );

        // Cloud Tasks 배치 등록 (100개씩)
        const taskResult = await createPostingTasksBatch(
          subdomains,
          projectId,
          location,
          queue,
          functionUrl,
          100 // 배치 크기
        );

        const duration = ((Date.now() - startTime) / 1000).toFixed(2);
        console.log(`[CRON] Task 등록 완료: ${taskResult.success}/${taskResult.total} 성공, ${duration}초`);

        // Firestore에 크론 세션 생성
        const sessionId = `cron_${Date.now()}`;
        await firestore.collection('cron_sessions').doc(sessionId).set({
          sessionId,
          startTime: new Date(),
          total: taskResult.success,
          completed: 0,
          succeeded: 0,
          failed: 0,
          results: [],
          telegramToken: secretsCache.TELEGRAM_BOT_TOKEN,
          chatId: secretsCache.TELEGRAM_CHAT_ID
        });
        console.log(`[CRON] 세션 생성: ${sessionId}`);

        // Telegram 크론 시작 알림
        const telegramToken = secretsCache.TELEGRAM_BOT_TOKEN;
        const chatId = secretsCache.TELEGRAM_CHAT_ID;
        if (telegramToken && chatId) {
          try {
            const kstTime = new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' });

            const failedList = taskResult.errors.length > 0
              ? `\n\n등록 실패:\n${taskResult.errors.map(e => `- ${e.subdomain}: ${e.error}`).join('\n')}`
              : '';

            const message = `🚀 크론 시작\n\n📋 Task 등록: ${taskResult.success}/${taskResult.total}\n❌ 등록 실패: ${taskResult.fail}\n\n⏱ 등록 시간: ${duration}초\n🗓 시작 시간: ${kstTime}${failedList}\n\n💡 Cloud Tasks가 자동으로 분산 처리합니다.`;

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
          message: 'Cloud Tasks 등록 완료',
          summary: {
            total: taskResult.total,
            tasksCreated: taskResult.success,
            tasksFailed: taskResult.fail,
            duration: `${duration}s`,
            queue: `${projectId}/locations/${location}/queues/${queue}`
          },
          errors: taskResult.errors
        });
      } catch (error) {
        console.error(`[CRON FATAL] 크론 실행 실패: ${error.message}`, error.stack);
        return res.status(500).json({
          success: false,
          error: error.message,
          stack: error.stack?.substring(0, 500)
        });
      } finally {
        // 락 해제 (에러 발생해도 무조건 실행)
        if (lockAcquired) {
          try {
            await lockRef.delete();
            console.log(`[CRON] 락 해제: ${lockKey}`);
          } catch (cleanupError) {
            console.error(`[CRON] 락 해제 실패: ${cleanupError.message}`);
          }
        }
      }
    }

    // Cloud Tasks Worker: 개별 거래처 포스팅 처리
    if (pathname === '/task/posting') {
      // OIDC 인증: Cloud Tasks만 허용
      const authHeader = req.headers.authorization;

      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        console.error('[TASK AUTH] Missing or invalid Authorization header');
        return res.status(401).json({ error: 'Unauthorized: Missing Authorization' });
      }

      console.log('[TASK AUTH] Authorized: Cloud Tasks');

      try {
        const { subdomain } = req.body;

        if (!subdomain) {
          return res.status(400).json({ error: 'subdomain required' });
        }

        console.log(`[TASK] 처리 시작: ${subdomain}`);

        const result = await posting.generatePostingForClient(subdomain, env);

        // 최신 크론 세션 업데이트
        const sessionsSnapshot = await firestore.collection('cron_sessions')
          .orderBy('startTime', 'desc')
          .limit(1)
          .get();

        if (!sessionsSnapshot.empty) {
          const sessionDoc = sessionsSnapshot.docs[0];
          const sessionRef = firestore.collection('cron_sessions').doc(sessionDoc.id);

          // Firestore Transaction으로 경쟁 상태 방지
          const isSuccess = result.success;
          let newCompleted, newSucceeded, newFailed, sessionData;

          await firestore.runTransaction(async (transaction) => {
            const doc = await transaction.get(sessionRef);
            sessionData = doc.data();

            newCompleted = (sessionData.completed || 0) + 1;
            newSucceeded = (sessionData.succeeded || 0) + (isSuccess ? 1 : 0);
            newFailed = (sessionData.failed || 0) + (isSuccess ? 0 : 1);

            transaction.update(sessionRef, {
              completed: newCompleted,
              succeeded: newSucceeded,
              failed: newFailed,
              results: [...(sessionData.results || []), {
                subdomain,
                success: isSuccess,
                error: result.error || null,
                timestamp: new Date()
              }]
            });
          });

          console.log(`[TASK] 세션 업데이트: ${newCompleted}/${sessionData.total}`);

          // 모든 Task 완료 시 Telegram 알림
          if (newCompleted === sessionData.total) {
            const telegramToken = sessionData.telegramToken;
            const chatId = sessionData.chatId;

            if (telegramToken && chatId) {
              try {
                const kstTime = new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' });
                const duration = ((Date.now() - sessionData.startTime.toDate().getTime()) / 1000).toFixed(0);

                // 업데이트된 세션 데이터 다시 읽기
                const updatedSession = await sessionRef.get();
                const updatedData = updatedSession.data();
                const failedResults = (updatedData.results || []).filter(r => !r.success);
                const failedList = newFailed > 0
                  ? `\n\n❌ 실패 거래처:\n${failedResults.map(r => `- ${r.subdomain}: ${r.error}`).join('\n')}`
                  : '';

                const message = `✅ 크론 완료\n\n📊 결과: ${newSucceeded}/${sessionData.total} 성공\n❌ 실패: ${newFailed}\n\n⏱ 소요 시간: ${duration}초\n🗓 완료 시간: ${kstTime}${failedList}`;

                await fetch(`https://api.telegram.org/bot${telegramToken}/sendMessage`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    chat_id: chatId,
                    text: message
                  })
                });
                console.log('[TASK] Telegram 완료 알림 전송 완료');
              } catch (error) {
                console.error('[TASK] Telegram 알림 전송 실패:', error.message);
              }
            }
          }
        }

        if (result.success) {
          console.log(`[TASK] ✓ ${subdomain} 성공`);
          return res.json({
            success: true,
            subdomain,
            message: 'Posting created successfully'
          });
        } else {
          console.error(`[TASK] ✗ ${subdomain} 실패: ${result.error}`);
          return res.status(500).json({
            success: false,
            subdomain,
            error: result.error
          });
        }
      } catch (error) {
        console.error(`[TASK ERROR] ${req.body?.subdomain || 'unknown'}: ${error.message}`, error.stack);
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

    if (pathname === '/debug-drive') {
      try {
        const { getGoogleAccessTokenForPosting } = require('./modules/drive-manager.js');
        const accessToken = await getGoogleAccessTokenForPosting(env);
        const DRIVE_FOLDER_ID = env.DRIVE_FOLDER_ID || '1JiVmIkliR9YrPIUPOn61G8Oh7h9HTMEt';

        const query = `mimeType = 'application/vnd.google-apps.folder' and '${DRIVE_FOLDER_ID}' in parents and trashed = false`;
        const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id,name)&orderBy=name`;

        const response = await fetch(url, {
          headers: { Authorization: `Bearer ${accessToken}` }
        });

        const data = await response.json();
        return res.json({
          success: true,
          driveFolder: DRIVE_FOLDER_ID,
          folders: data.files || [],
          count: (data.files || []).length
        });
      } catch (error) {
        return res.status(500).json({
          success: false,
          error: error.message
        });
      }
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

      // Umami 캐시는 유지 (데이터 보존)

      return res.json({ success: true });
    }

    // 방문 추적 API
    if (pathname === '/api/track-visit') {
      if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
      }

      try {
        const { subdomain, timestamp, userAgent, referrer, path, duration } = req.body;
        if (!subdomain) {
          return res.status(400).json({ error: 'Subdomain required' });
        }

        // IP 주소 추출 (Load Balancer 경유 시 X-Forwarded-For 사용)
        const ip = (req.headers['x-forwarded-for'] || req.ip || 'unknown').split(',')[0].trim();

        const visitData = {
          subdomain,
          timestamp: timestamp || Date.now(),
          userAgent: userAgent || 'unknown',
          referrer: referrer || 'direct',
          path: path || '/',
          ip: ip,
          created_at: new Date()
        };

        // 체류 시간이 있으면 추가
        if (duration) {
          visitData.duration = duration;
        }

        await firestore.collection('visits').add(visitData);

        return res.json({ success: true });
      } catch (error) {
        console.error('Track visit error:', error);
        return res.status(500).json({ error: error.message });
      }
    }

    // 링크 클릭 추적 API
    if (pathname === '/api/track-link') {
      if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
      }

      try {
        const { subdomain, link_type, link_url, timestamp } = req.body;
        if (!subdomain || !link_type || !link_url) {
          return res.status(400).json({ error: 'Missing required fields' });
        }

        await firestore.collection('link_clicks').add({
          subdomain,
          link_type,
          link_url,
          timestamp: timestamp || Date.now(),
          created_at: new Date()
        });

        return res.json({ success: true });
      } catch (error) {
        console.error('Track link error:', error);
        return res.status(500).json({ error: error.message });
      }
    }

    // 통계 데이터 API
    if (pathname === '/api/stats-data') {
      const sub = req.query.subdomain;
      if (!sub) {
        return res.status(400).json({ error: 'Subdomain required' });
      }

      try {
        const { getVisitStats, getLinkClickStats } = require('./modules/stats/stats-reader.js');
        const days = parseInt(req.query.days) || 30;

        const visitStats = await getVisitStats(sub, env, days);
        const linkClickStats = await getLinkClickStats(sub, env, days);

        return res.json({
          visitStats,
          linkClickStats
        });
      } catch (error) {
        console.error('Stats data API error:', error);
        return res.status(500).json({ error: error.message });
      }
    }

    // 통계 페이지 (간단)
    if (pathname === '/stats') {
      const sub = req.query.subdomain || subdomain;
      if (!sub) {
        return res.status(400).send('Subdomain required');
      }

      try {
        const { generateStatsPage } = require('./modules/stats/stats-page.js');
        const days = parseInt(req.query.days) || 30;
        const html = await generateStatsPage(sub, env, days);

        res.set('Content-Type', 'text/html; charset=utf-8');
        return res.send(html);
      } catch (error) {
        console.error('Stats page error:', error);
        return res.status(500).send('Stats page generation failed');
      }
    }

    // 상세 통계 페이지 (모든 거래처 공통)
    if (pathname === '/stats-detailed') {
      try {
        const htmlPath = path.join(__dirname, 'landing', 'stats-detailed.html');
        const html = fs.readFileSync(htmlPath, 'utf-8');

        res.set('Content-Type', 'text/html; charset=utf-8');
        return res.send(html);
      } catch (error) {
        console.error('Detailed stats page error:', error);
        return res.status(500).send('Stats page not found');
      }
    }

    // Previous Posts AJAX API
    if (pathname === '/api/posts') {
      const sub = req.query.subdomain;
      const offset = parseInt(req.query.offset) || 0;
      const limit = parseInt(req.query.limit) || 10;

      if (!sub) return res.status(400).json({ error: 'Subdomain required' });

      try {
        // 총 개수 조회
        const countSnapshot = await firestore.collection('posts_archive')
          .where('subdomain', '==', sub)
          .count()
          .get();
        const total = countSnapshot.data().count;

        // 페이지 데이터 조회
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

        return res.json({ success: true, posts, total });
      } catch (error) {
        console.error('API posts error:', error);
        return res.status(500).json({ error: error.message });
      }
    }

    // Sitemap.xml (모든 포스트 URL for SEO)
    if (pathname === '/sitemap.xml') {
      try {
        const snapshot = await firestore.collection('posts_archive')
          .orderBy('created_at', 'desc')
          .get();

        const urls = snapshot.docs.map(doc => {
          const data = doc.data();
          const domain = data.domain || `${data.subdomain}.make-page.com`;
          const postId = data.url ? data.url.split('id=')[1] : '';
          const lastmod = data.created_at ? new Date(data.created_at).toISOString().split('T')[0] : '';

          return `  <url>
    <loc>https://${domain}/post?id=${postId}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.7</priority>
  </url>`;
        }).join('\n');

        const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>`;

        res.setHeader('Content-Type', 'application/xml');
        return res.send(xml);
      } catch (error) {
        console.error('Sitemap error:', error);
        return res.status(500).send('Sitemap generation failed');
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

      // 최신 포스팅에 없으면 Firestore archive에서 찾기 (최적화: postId 직접 쿼리)
      if (!post) {
        try {
          const snapshot = await firestore.collection('posts_archive')
            .where('subdomain', '==', subdomain)
            .where('postId', '==', postId)
            .limit(1)
            .get();

          if (!snapshot.empty) {
            post = snapshot.docs[0].data();
            console.log(`[POST] Archive 조회 성공 (최적화): ${postId}`);
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
      res.set('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
      res.set('Pragma', 'no-cache');
      res.set('Expires', '0');
      return res.send(cachedHTML);
    }

    const { client, debugInfo } = await getClientFromSheets(subdomain, env);
    console.log('[DEBUG] Client found:', !!client);
    if (!client) return res.status(404).send('Not found');

    const html = await generateClientPage(client, debugInfo, env);
    cache.setCachedHTML(subdomain, html, env);

    res.set('Content-Type', 'text/html; charset=utf-8');
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');
    res.send(html);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
});

