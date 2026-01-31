// Content Factory - Modularized Version

// 모듈 import
import { fetchWithTimeout, parseCSV, normalizeClient } from './modules/utils.js';
import { getCachedHTML, setCachedHTML } from './modules/cache.js';
import { getClientFromSheets } from './modules/sheets.js';
import {
  generatePostPage,
  generateClientPage,
  generateRobotsTxt,
  handleSitemap,
  deletePost
} from './modules/pages.js';
import { generatePostingForClient } from './modules/posting.js';
import { getGoogleAccessTokenForPosting } from './modules/auth.js';

export default {
  async scheduled(event, env, ctx) {
    const nowUtc = new Date();
    const nowKst = new Date(nowUtc.getTime() + (9 * 60 * 60 * 1000));
    const timestamp = nowKst.toISOString().replace('T', ' ').substring(0, 19);
    console.log('Scheduled trigger started at (KST)', timestamp);

    // 동시 실행 방지 (날짜별 KV 락)
    const kstDate = nowKst.toISOString().split('T')[0]; // YYYY-MM-DD
    const lockKey = `cron_posting_lock_${kstDate}`;
    const lockValue = await env.POSTING_KV.get(lockKey);

    if (lockValue) {
      console.log(`Cron already executed for ${kstDate}, skipping...`);
      return;
    }

    try {
      // 락 설정 (48시간 TTL - 다음 날 실행 보장)
      await env.POSTING_KV.put(lockKey, timestamp, { expirationTtl: 172800 });

      // 1. 모든 구독 거래처 조회
      const SHEET_URL = env.GOOGLE_SHEETS_CSV_URL || 'https://docs.google.com/spreadsheets/d/1KrzLFi8Wt9GTGT97gcMoXnbZ3OJ04NsP4lncJyIdyhU/export?format=csv&gid=0';
      const response = await fetchWithTimeout(SHEET_URL, {}, 10000);

      if (!response.ok) {
        throw new Error(`Sheets fetch failed: ${response.status}`);
      }

      const csvText = await response.text();
      const clients = parseCSV(csvText).map(normalizeClient).filter(c => c.subscription === '활성');

      console.log(`Found ${clients.length} active clients`);

      // 2. 배치 처리 (10개씩 Queue 전송)
      const batchSize = 10;
      let successCount = 0;
      let failCount = 0;

      for (let i = 0; i < clients.length; i += batchSize) {
        const batch = clients.slice(i, i + batchSize);

        for (const client of batch) {
          try {
            const normalizedSubdomain = client.subdomain.replace('.make-page.com', '').replace('/', '');
            await env.POSTING_QUEUE.send({ subdomain: normalizedSubdomain });
            successCount++;
            console.log(`Queue sent: ${normalizedSubdomain}`);
          } catch (err) {
            failCount++;
            console.error(`Queue send failed for ${client.subdomain}:`, err);
          }
        }

        // 배치 간 1초 대기
        if (i + batchSize < clients.length) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }

      console.log(`Cron completed: ${successCount} queued, ${failCount} failed`);

    } catch (error) {
      console.error('Scheduled handler error:', error);
    }
    // 락은 TTL(48시간)로 자동 만료됨 - 수동 삭제 불필요
  },

  async queue(batch, env) {
    await Promise.all(
      batch.messages.map(async (message) => {
        try {
          const result = await generatePostingForClient(message.body.subdomain, env);
          if (result.success) {
            console.log(`✅ ${message.body.subdomain} 포스팅 성공`);
            message.ack();
          } else {
            console.error(`❌ ${message.body.subdomain} 실패: ${result.error}`);
            message.retry();  // 실패 시 재시도
          }
        } catch (error) {
          console.error(`❌ ${message.body.subdomain} 에러: ${error.message}`);
          message.retry();  // 에러 시 재시도
        }
      })
    );
  },

  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const hostname = url.hostname;
    const pathname = url.pathname;

    // www 리다이렉트
    if (hostname === 'www.make-page.com') {
      const redirectUrl = `https://make-page.com${pathname}${url.search}`;
      return Response.redirect(redirectUrl, 301);
    }

    // 서브도메인 추출
    const subdomain = hostname.split('.')[0];

    // make-page.com (메인 도메인) 처리
    if (hostname === 'make-page.com' || hostname === 'staging.make-page.com') {
      if (pathname === '/sitemap.xml') {
        return handleSitemap(env);
      }

      if (pathname === '/robots.txt') {
        return new Response(generateRobotsTxt(), {
          headers: { 'Content-Type': 'text/plain; charset=utf-8' }
        });
      }

      // IndexNow API 키 파일
      if (pathname === '/kmlsc7f9b1pm7n7x7gq1zdihmzxtkqzr.txt') {
        return new Response('kmlsc7f9b1pm7n7x7gq1zdihmzxtkqzr', {
          headers: { 'Content-Type': 'text/plain; charset=utf-8' }
        });
      }

      // Test posting generation (직접 실행, Queue 우회)
      if (pathname === '/test-posting' && request.method === 'POST') {
        try {
          const { subdomain } = await request.json();
          const result = await generatePostingForClient(subdomain, env);

          return new Response(JSON.stringify(result, null, 2), {
            headers: { 'Content-Type': 'application/json' }
          });
        } catch (error) {
          return new Response(JSON.stringify({
            error: error.message,
            stack: error.stack
          }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
          })
;
        }
      }

      // Test cron trigger (Cron 수동 실행 테스트)
      if (pathname === '/test-cron' && request.method === 'POST') {
        try {
          const nowUtc = new Date();
          const nowKst = new Date(nowUtc.getTime() + (9 * 60 * 60 * 1000));
          const timestamp = nowKst.toISOString().replace('T', ' ').substring(0, 19);
          const logs = [`Manual cron test started at (KST) ${timestamp}`];

          // 1. 모든 구독 거래처 조회
          const SHEET_URL = env.GOOGLE_SHEETS_CSV_URL || 'https://docs.google.com/spreadsheets/d/1KrzLFi8Wt9GTGT97gcMoXnbZ3OJ04NsP4lncJyIdyhU/export?format=csv&gid=0';
          const response = await fetchWithTimeout(SHEET_URL, {}, 10000);

          if (!response.ok) {
            throw new Error(`Sheets fetch failed: ${response.status}`);
          }

          const csvText = await response.text();
          const clients = parseCSV(csvText).map(normalizeClient).filter(c => c.subscription === '활성');
          logs.push(`Found ${clients.length} active clients`);

          // 2. 배치 처리 (10개씩 Queue 전송)
          const batchSize = 10;
          let successCount = 0;
          let failCount = 0;

          for (let i = 0; i < clients.length; i += batchSize) {
            const batch = clients.slice(i, i + batchSize);

            for (const client of batch) {
              try {
                const normalizedSubdomain = client.subdomain.replace('.make-page.com', '').replace('/', '');
                await env.POSTING_QUEUE.send({ subdomain: normalizedSubdomain });
                successCount++;
                logs.push(`Queue sent: ${normalizedSubdomain}`);
              } catch (err) {
                failCount++;
                logs.push(`Queue send failed for ${client.subdomain}: ${err.message}`);
              }
            }

            // 배치 간 1초 대기
            if (i + batchSize < clients.length) {
              await new Promise(resolve => setTimeout(resolve, 1000));
            }
          }

          logs.push(`Test cron completed: ${successCount} queued, ${failCount} failed`);

          return new Response(JSON.stringify({
            success: true,
            totalClients: clients.length,
            successCount,
            failCount,
            logs
          }, null, 2), {
            headers: { 'Content-Type': 'application/json' }
          });
        } catch (error) {
          return new Response(JSON.stringify({
            error: error.message,
            stack: error.stack
          }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
          });
        }
      }

      // 캐시 새로고침
      if (pathname === '/refresh') {
        const sub = url.searchParams.get('subdomain');
        if (!sub) return new Response('subdomain required', { status: 400 });
        const { client } = await getClientFromSheets(sub, env);
        if (!client) return new Response('Not found', { status: 404 });
        const html = await generateClientPage(client, {}, env);
        await setCachedHTML(sub, html, env);
        return new Response(JSON.stringify({ success: true }), {
          headers: { 'Content-Type': 'application/json' }
        });
      }

      // Test sheet reading (시트 데이터 확인)
      if (pathname === '/test-sheet' && request.method === 'GET') {
        try {
          const accessToken = await getGoogleAccessTokenForPosting(env);
          const archiveSheetName = env.ARCHIVE_SHEET_NAME || '저장소';
          const latestSheetName = env.LATEST_POSTING_SHEET_NAME || '최신 포스팅';

          const latestResponse = await fetch(
            `https://sheets.googleapis.com/v4/spreadsheets/${env.SHEETS_ID}/values/${encodeURIComponent(latestSheetName)}!A:Z`,
            { headers: { Authorization: `Bearer ${accessToken}` } }
          );
          const latestData = await latestResponse.json();

          const archiveResponse = await fetch(
            `https://sheets.googleapis.com/v4/spreadsheets/${env.SHEETS_ID}/values/${encodeURIComponent(archiveSheetName)}!A:Z`,
            { headers: { Authorization: `Bearer ${accessToken}` } }
          );
          const archiveData = await archiveResponse.json();

          // 열 너비 정보 가져오기
          const spreadsheetResponse = await fetch(
            `https://sheets.googleapis.com/v4/spreadsheets/${env.SHEETS_ID}?fields=sheets(properties(title,sheetId),data.columnMetadata.pixelSize)`,
            { headers: { Authorization: `Bearer ${accessToken}` } }
          );
          const spreadsheetData = await spreadsheetResponse.json();

          // 각 시트의 열 너비 찾기
          const latestSheet = spreadsheetData.sheets.find(s => s.properties.title === latestSheetName);
          const archiveSheet = spreadsheetData.sheets.find(s => s.properties.title === archiveSheetName);
          const mainSheet = spreadsheetData.sheets[0]; // 관리자 시트

          const getColumnWidths = (sheet) => {
            if (!sheet || !sheet.data || !sheet.data[0] || !sheet.data[0].columnMetadata) {
              return [];
            }
            return sheet.data[0].columnMetadata.slice(0, 9).map(col => col.pixelSize || 100);
          };

          return new Response(JSON.stringify({
            latest: {
              sheetName: latestSheetName,
              rowCount: (latestData.values || []).length,
              headers: (latestData.values || [])[0] || [],
              firstDataRow: (latestData.values || [])[1] || [],
              allRows: latestData.values || [],
              columnWidths: getColumnWidths(latestSheet)
            },
            archive: {
              sheetName: archiveSheetName,
              rowCount: (archiveData.values || []).length,
              headers: (archiveData.values || [])[0] || [],
              firstDataRow: (archiveData.values || [])[1] || [],
              allRows: archiveData.values || [],
              columnWidths: getColumnWidths(archiveSheet)
            },
            main: {
              sheetName: mainSheet?.properties?.title || '관리자',
              columnWidths: getColumnWidths(mainSheet)
            }
          }, null, 2), {
            headers: { 'Content-Type': 'application/json' }
          });
        } catch (error) {
          return new Response(JSON.stringify({
            error: error.message,
            stack: error.stack
          }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
          });
        }
      }

      // Generate posting (Queue 전송)
      if (pathname === '/generate-posting' && request.method === 'POST') {
        try {
          const { subdomain } = await request.json();

          // Queue에 메시지 전송
          await env.POSTING_QUEUE.send({ subdomain });

          // 즉시 202 응답
          return new Response(JSON.stringify({
            success: true,
            message: "포스팅 생성이 Queue에 추가되었습니다. 완료까지 2-3분 소요됩니다.",
            subdomain: subdomain
          }), {
            status: 202,
            headers: { 'Content-Type': 'application/json' }
          });
        } catch (error) {
          return new Response(JSON.stringify({
            error: error.message,
            stack: error.stack
          }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
          });
        }
      }

      // 메인 도메인은 404 (랜딩페이지 없음)
      return new Response('Not Found', { status: 404 });
    }

    // 서브도메인이 5자리 숫자가 아니면 404
    if (!/^\d{5}$/.test(subdomain)) {
      return new Response('Not Found', { status: 404 });
    }

    try {
      // Delete post 엔드포인트
      if (pathname === '/delete-post' && request.method === 'POST') {
        const { subdomain: reqSubdomain, created_at, password } = await request.json();
        const result = await deletePost(reqSubdomain, created_at, password, env);
        return new Response(JSON.stringify(result), {
          status: result.success ? 200 : 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      // 캐시 확인 (포스트 상세 페이지 제외)
      if (pathname !== '/post' && !url.searchParams.get('refresh')) {
        const cached = await getCachedHTML(subdomain, env);
        if (cached) {
          return new Response(cached, {
            headers: { 'Content-Type': 'text/html; charset=utf-8' }
          });
        }
      }

      // Google Sheets에서 거래처 정보 조회
      const { client, debugInfo } = await getClientFromSheets(subdomain, env);

      if (!client) {
        return new Response('Not Found', { status: 404 });
      }

      // 포스트 상세 페이지
      if (pathname === '/post' && client.posts && client.posts.length > 0) {
        // Query parameter에서 post ID 추출
        const postId = url.searchParams.get('id');

        // created_at으로 포스트 찾기
        const post = postId
          ? client.posts.find(p => p.created_at === postId)
          : client.posts[0];

        if (!post) {
          return new Response('Post not found', { status: 404 });
        }

        return new Response(await generatePostPage(client, post, env), {
          headers: {
            'Content-Type': 'text/html; charset=utf-8',
            'Cache-Control': 'public, max-age=300'
          }
        });
      }

      // 거래처 페이지 생성
      const html = await generateClientPage(client, debugInfo, env);
      ctx.waitUntil(setCachedHTML(subdomain, html, env));

      return new Response(html, {
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
          'Cache-Control': 'public, max-age=300'
        }
      });

    } catch (error) {
      console.error('Error:', error);
      return new Response('Internal Server Error', { status: 500 });
    }
  }
};
