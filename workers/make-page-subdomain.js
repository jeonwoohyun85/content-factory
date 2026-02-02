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
import { generateStatusPage } from './modules/status.js';

export default {
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

      // 크론 상태 페이지
      if (pathname === '/status') {
        return generateStatusPage(env);
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

      // 저장소 이미지 컬럼 포스트 URL 복구
      if (pathname === '/restore-archive-urls' && request.method === 'POST') {
        try {
          const accessToken = await getGoogleAccessTokenForPosting(env);
          const archiveSheetName = env.ARCHIVE_SHEET_NAME || '저장소';

          // 1. 저장소 시트 읽기
          const response = await fetch(
            `https://sheets.googleapis.com/v4/spreadsheets/${env.SHEETS_ID}/values/${encodeURIComponent(archiveSheetName)}!A:Z`,
            { headers: { Authorization: `Bearer ${accessToken}` } }
          );

          const data = await response.json();
          const rows = data.values || [];

          if (rows.length < 2) {
            return new Response(JSON.stringify({ success: false, message: '데이터 없음' }), {
              headers: { 'Content-Type': 'application/json' }
            });
          }

          const headers = rows[0];
          const domainIndex = headers.indexOf('도메인');
          const urlIndex = headers.indexOf('URL');
          const imagesIndex = headers.indexOf('이미지');

          if (domainIndex === -1 || urlIndex === -1 || imagesIndex === -1) {
            return new Response(JSON.stringify({ 
              success: false, 
              message: '필수 컬럼(도메인, URL, 이미지) 없음' 
            }), {
              status: 400,
              headers: { 'Content-Type': 'application/json' }
            });
          }

          // 2. 이미지 컬럼이 비어있거나 포스트 URL이 없는 행 찾기
          const updates = [];

          for (let i = 1; i < rows.length; i++) {
            const row = rows[i];
            const domain = row[domainIndex] || '';
            const images = row[imagesIndex] || '';
            // 데이터가 한 칸 밀려있으므로 실제 생성일시는 URL 헤더 위치에 있음
            const createdAt = row[urlIndex] || '';

            // 이미지 컬럼이 비어있거나 포스트 URL 형식이 아니면서, 도메인과 생성일시가 있으면
            const needsRestore = (!images || !images.includes('drive.google.com')) && domain && createdAt;

            if (needsRestore) {
              const normalizedDomain = domain.replace('.make-page.com', '');
              const encodedCreatedAt = encodeURIComponent(createdAt);
              const postUrl = `${normalizedDomain}.make-page.com/post?id=${encodedCreatedAt}`;

              updates.push({
                row: i + 1,
                url: postUrl
              });
            }
          }

          if (updates.length === 0) {
            return new Response(JSON.stringify({ 
              success: true, 
              message: '복구할 URL 없음',
              updated: 0
            }), {
              headers: { 'Content-Type': 'application/json' }
            });
          }

          // 3. 일괄 업데이트 (이미지 컬럼에 포스트 URL 저장)
          const imagesColumnLetter = String.fromCharCode(65 + imagesIndex);
          const batchData = updates.map(u => ({
            range: `${archiveSheetName}!${imagesColumnLetter}${u.row}`,
            values: [[u.url]]
          }));

          // 100개씩 나눠서 업데이트
          const batchSize = 100;
          let totalUpdated = 0;

          for (let i = 0; i < batchData.length; i += batchSize) {
            const batch = batchData.slice(i, i + batchSize);

            const batchResponse = await fetch(
              `https://sheets.googleapis.com/v4/spreadsheets/${env.SHEETS_ID}/values:batchUpdate`,
              {
                method: 'POST',
                headers: {
                  'Authorization': `Bearer ${accessToken}`,
                  'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                  valueInputOption: 'RAW',
                  data: batch
                })
              }
            );

            if (batchResponse.ok) {
              totalUpdated += batch.length;
            } else {
              const errorText = await batchResponse.text();
              console.error(`이미지 컬럼 URL 복구 실패 (배치 ${i / batchSize + 1}):`, errorText);
            }

            // API 제한 방지
            if (i + batchSize < batchData.length) {
              await new Promise(resolve => setTimeout(resolve, 1000));
            }
          }

          return new Response(JSON.stringify({
            success: true,
            message: `${totalUpdated}개 포스트 URL 복구 완료`,
            updated: totalUpdated,
            total: updates.length
          }), {
            headers: { 'Content-Type': 'application/json' }
          });

        } catch (error) {
          return new Response(JSON.stringify({
            success: false,
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

        // 포스트 찾기 (새 형식: 36진수 ID, 기존 형식: created_at)
        const post = postId
          ? client.posts.find(p => {
              // 새 형식: 타임스탬프 36진수 ID
              const generatedId = new Date(p.created_at).getTime().toString(36);
              if (generatedId === postId) return true;
              // 기존 형식: created_at 그대로
              if (p.created_at === postId) return true;
              return false;
            })
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
