/**
 * Failed Postings 자동 재시도 Worker
 *
 * 목적: 실패한 포스팅을 3시간마다 자동 재시도
 * Cron: 0 */3 * * * (매 3시간마다)
 */

const SUPABASE_URL = 'https://tvymimryuwtgsfakuffl.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR2eW1pbXJ5dXd0Z3NmYWt1ZmZsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjYxMjkxMzgsImV4cCI6MjA4MTcwNTEzOH0.nC063W3Z92eNYJ-cDKrVeVqs2Q2byrw89F4kT8iJiX8';

// ntfy.sh 푸시 알림 전송
async function sendNtfyAlert(title, message, priority = 3, tags = []) {
  try {
    await fetch('https://ntfy.sh', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        topic: 'caps-alerts',
        title: title,
        message: message,
        priority: priority,
        tags: tags
      })
    });
  } catch (err) {
    console.error('ntfy alert failed:', err);
  }
}

export default {
  async scheduled(event, env, ctx) {
    ctx.waitUntil(retryFailedPostings(env));
  },

  async fetch(request, env) {
    // 수동 테스트용
    if (request.method === 'GET') {
      await retryFailedPostings(env);
      return new Response('Retry completed', { status: 200 });
    }
    return new Response('Method not allowed', { status: 405 });
  }
};

async function retryFailedPostings(env) {
  try {
    console.log('[Failed Postings Retry] Starting...');

    // 재시도 대상: status='pending' AND retry_count < 3
    const failedPostingsUrl = `${SUPABASE_URL}/rest/v1/failed_postings?status=eq.pending&retry_count=lt.3&select=id,client_id,retry_count`;

    const response = await fetch(failedPostingsUrl, {
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch failed_postings: ${response.status}`);
    }

    const failedPostings = await response.json();

    if (!Array.isArray(failedPostings) || failedPostings.length === 0) {
      console.log('[Failed Postings Retry] No failed postings to retry');
      return;
    }

    console.log(`[Failed Postings Retry] Found ${failedPostings.length} failed postings`);

    let retriedCount = 0;
    let failedRetryCount = 0;

    // Fly.io API 서버로 재시도 요청 (순차 처리)
    for (const failed of failedPostings) {
      try {
        const retryResponse = await fetch(`${env.FLY_APP_URL}/api/admin/failed-postings/${failed.id}/retry`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          }
        });

        if (retryResponse.ok) {
          retriedCount++;
          console.log(`[Success] Retried failed posting: ${failed.id}`);
        } else {
          failedRetryCount++;
          console.error(`[Failed] Failed to retry posting: ${failed.id} (${retryResponse.status})`);
        }
      } catch (retryError) {
        failedRetryCount++;
        console.error(`[Error] Error retrying posting ${failed.id}:`, retryError);
      }
    }

    console.log(`[Failed Postings Retry] Completed: ${retriedCount} retried, ${failedRetryCount} failed`);

    // ntfy 알림 (재시도 결과)
    if (retriedCount > 0 || failedRetryCount > 0) {
      await sendNtfyAlert(
        '🔄 실패 포스팅 재시도 완료',
        `재시도: ${retriedCount}건\n실패: ${failedRetryCount}건\n대기 중: ${failedPostings.length - retriedCount - failedRetryCount}건`,
        3,  // default
        ['arrows_counterclockwise', 'chart_with_upwards_trend']
      );
    }

    // logs 테이블에 기록
    try {
      await fetch(`${SUPABASE_URL}/rest/v1/logs`, {
        method: 'POST',
        headers: {
          'apikey': SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=minimal'
        },
        body: JSON.stringify({
          type: failedRetryCount > 0 ? 'error' : 'success',
          message: `실패 포스팅 재시도: ${retriedCount}건 성공, ${failedRetryCount}건 실패`,
          error_type: failedRetryCount > 0 ? 'retry_failed' : null,
          metadata: {
            total: failedPostings.length,
            retried: retriedCount,
            failed: failedRetryCount
          }
        })
      });
    } catch (logError) {
      console.error('Failed to log retry result:', logError);
    }

  } catch (error) {
    console.error('[Failed Postings Retry] Error:', error);

    // ntfy 긴급 알림
    await sendNtfyAlert(
      '🚨 재시도 시스템 오류',
      `Failed Postings 재시도 시스템이 실패했습니다.\n\n에러: ${error.message}`,
      5,  // urgent
      ['rotating_light', 'tools']
    );

    // 로그 기록
    try {
      await fetch(`${SUPABASE_URL}/rest/v1/logs`, {
        method: 'POST',
        headers: {
          'apikey': SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=minimal'
        },
        body: JSON.stringify({
          type: 'error',
          message: `재시도 시스템 오류: ${error.message}`,
          error_type: 'retry_system_failure',
          metadata: {
            error: error.message,
            stack: error.stack
          }
        })
      });
    } catch (logError) {
      console.error('Failed to log retry system error:', logError);
    }
  }
}
