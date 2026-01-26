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
    ctx.waitUntil(checkSystemHealth(env));
  },

  async fetch(request, env) {
    // 수동 테스트용
    if (request.method === 'GET') {
      await checkSystemHealth(env);
      return new Response('Monitor check completed', { status: 200 });
    }
    return new Response('Method not allowed', { status: 405 });
  }
};

async function checkSystemHealth(env) {
  try {
    // 어제 날짜 계산 (KST 기준)
    const now = new Date();
    const kstNow = new Date(now.getTime() + (9 * 60 * 60 * 1000));
    const yesterday = new Date(kstNow);
    yesterday.setDate(yesterday.getDate() - 1);

    const yesterdayStart = new Date(yesterday.setHours(0, 0, 0, 0));
    const yesterdayEnd = new Date(yesterday.setHours(23, 59, 59, 999));

    // UTC로 변환
    const utcStart = new Date(yesterdayStart.getTime() - (9 * 60 * 60 * 1000));
    const utcEnd = new Date(yesterdayEnd.getTime() - (9 * 60 * 60 * 1000));

    const dateStr = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, '0')}-${String(yesterday.getDate()).padStart(2, '0')}`;

    // 1. 어제 포스팅 체크
    const contentsUrl = `${env.SUPABASE_URL}/rest/v1/contents?created_at=gte.${utcStart.toISOString()}&created_at=lte.${utcEnd.toISOString()}&select=id,client_id,created_at`;

    const contentsResponse = await fetch(contentsUrl, {
      headers: {
        'apikey': env.SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${env.SUPABASE_ANON_KEY}`
      }
    });

    const contents = await contentsResponse.json();
    const postingCount = Array.isArray(contents) ? contents.length : 0;

    // 2. 어제 에러 체크
    const logsUrl = `${env.SUPABASE_URL}/rest/v1/logs?created_at=gte.${utcStart.toISOString()}&created_at=lte.${utcEnd.toISOString()}&status=eq.error&select=id,subdomain,error_message`;

    const logsResponse = await fetch(logsUrl, {
      headers: {
        'apikey': env.SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${env.SUPABASE_ANON_KEY}`
      }
    });

    const errors = await logsResponse.json();
    const errorCount = Array.isArray(errors) ? errors.length : 0;

    // 3. 구독 중인데 포스팅 없는 거래처 체크
    const clientsUrl = `${env.SUPABASE_URL}/rest/v1/clients?status=eq.active&select=subdomain`;

    const clientsResponse = await fetch(clientsUrl, {
      headers: {
        'apikey': env.SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${env.SUPABASE_ANON_KEY}`
      }
    });

    const activeClients = await clientsResponse.json();

    // 어제 포스팅한 거래처 ID 추출
    const postedClientIds = Array.isArray(contents)
      ? [...new Set(contents.map(c => c.client_id))]
      : [];

    // 포스팅 없는 거래처 찾기
    const missingPostings = [];
    if (Array.isArray(activeClients)) {
      for (const client of activeClients) {
        const clientDetailUrl = `${env.SUPABASE_URL}/rest/v1/clients?subdomain=eq.${client.subdomain}&select=id`;
        const clientDetailResponse = await fetch(clientDetailUrl, {
          headers: {
            'apikey': env.SUPABASE_ANON_KEY,
            'Authorization': `Bearer ${env.SUPABASE_ANON_KEY}`
          }
        });
        const clientDetail = await clientDetailResponse.json();

        if (clientDetail && clientDetail[0] && !postedClientIds.includes(clientDetail[0].id)) {
          missingPostings.push(client.subdomain);
        }
      }
    }

    // 4. 실패한 포스팅 체크 및 재시도
    const failedPostingsUrl = `${env.SUPABASE_URL}/rest/v1/failed_postings?status=eq.pending&select=id,client_id,retry_count`;

    const failedPostingsResponse = await fetch(failedPostingsUrl, {
      headers: {
        'apikey': env.SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${env.SUPABASE_ANON_KEY}`
      }
    });

    const failedPostings = await failedPostingsResponse.json();
    let retriedCount = 0;
    let failedRetryCount = 0;

    // 재시도 가능한 실패 포스팅 처리 (retry_count < 3)
    if (Array.isArray(failedPostings)) {
      for (const failed of failedPostings) {
        if (failed.retry_count < 3) {
          try {
            // Fly.io API 서버로 재시도 요청
            const retryResponse = await fetch(`${env.FLY_APP_URL}/api/admin/failed-postings/${failed.id}/retry`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json'
              }
            });

            if (retryResponse.ok) {
              retriedCount++;
              console.log(`Retried failed posting: ${failed.id}`);
            } else {
              failedRetryCount++;
              console.error(`Failed to retry posting: ${failed.id}`);
            }
          } catch (retryError) {
            failedRetryCount++;
            console.error(`Error retrying posting ${failed.id}:`, retryError);
          }
        }
      }
    }

    // 5. 메시지 포맷팅
    let message;

    const hasFailed = failedPostings && Array.isArray(failedPostings) && failedPostings.length > 0;
    const hasIssues = errorCount > 0 || missingPostings.length > 0 || hasFailed;

    if (!hasIssues) {
      // 정상
      message = `✅ 일일 리포트 (${dateStr})
- 어제 포스팅: ${postingCount}개
- 에러: 0건
- 실패 포스팅: 0건`;
    } else {
      // 문제 발생
      message = `🚨 시스템 이상 감지 (${dateStr})`;

      message += `\n\n어제 포스팅: ${postingCount}개`;

      if (missingPostings.length > 0) {
        message += `\n- 포스팅 누락 거래처: ${missingPostings.join(', ')}`;
      }

      if (errorCount > 0) {
        message += `\n- 에러: ${errorCount}건`;

        // 에러 상세 (최대 3개)
        if (Array.isArray(errors) && errors.length > 0) {
          message += '\n\n에러 상세:';
          errors.slice(0, 3).forEach(err => {
            message += `\n• ${err.subdomain || 'N/A'}: ${(err.error_message || '').substring(0, 50)}...`;
          });
        }
      }

      if (hasFailed) {
        const totalFailed = failedPostings.length;
        message += `\n\n실패 포스팅: ${totalFailed}건 (재시도: ${retriedCount}건, 실패: ${failedRetryCount}건)`;
      }
    }

    // 6. ntfy.sh 알림 (문제 있을 때만)
    if (hasIssues) {
      await sendNtfyAlert(
        '⚠️ 일일 리포트 - 이상 감지',
        `날짜: ${dateStr}\n포스팅: ${postingCount}개\n에러: ${errorCount}건\n누락 거래처: ${missingPostings.length}곳\n실패 포스팅: ${failedPostings ? failedPostings.length : 0}건`,
        4, // high priority
        ['warning', 'chart_with_upwards_trend']
      );
    }

    // 7. logs 테이블에 일일 리포트 기록
    try {
      await fetch(`${env.SUPABASE_URL}/rest/v1/logs`, {
        method: 'POST',
        headers: {
          'apikey': env.SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${env.SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=minimal'
        },
        body: JSON.stringify({
          type: hasIssues ? 'error' : 'success',
          message: message,
          error_type: hasIssues ? 'daily_report' : null,
          metadata: {
            date: dateStr,
            posting_count: postingCount,
            error_count: errorCount,
            missing_postings: missingPostings,
            failed_postings: failedPostings ? failedPostings.length : 0,
            retried_count: retriedCount,
            failed_retry_count: failedRetryCount
          }
        })
      });
    } catch (logError) {
      console.error('Failed to log daily report:', logError);
    }

    console.log('Daily monitor completed:', {
      postingCount,
      errorCount,
      missingPostings,
      failedPostings: failedPostings ? failedPostings.length : 0,
      retriedCount,
      failedRetryCount
    });

    // 6. 오래된 로그 정리 (90일 이상)
    try {
      const cleanupUrl = `${env.WEBAPP_URL}/api/cleanup-logs`;
      const cleanupResponse = await fetch(cleanupUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (cleanupResponse.ok) {
        const result = await cleanupResponse.json();
        console.log('Log cleanup completed:', result);
      }
    } catch (cleanupError) {
      console.error('Log cleanup failed:', cleanupError);
    }


  } catch (error) {
    console.error('Monitor error:', error);

    // ntfy.sh 긴급 알림
    await sendNtfyAlert(
      '💥 모니터링 시스템 크래시',
      `모니터링 자체가 실패했습니다.\n에러: ${error.message}`,
      5, // urgent
      ['skull', 'fire']
    );

    // 모니터링 자체 실패 시 로그 기록
    try {
      await fetch(`${env.SUPABASE_URL}/rest/v1/logs`, {
        method: 'POST',
        headers: {
          'apikey': env.SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${env.SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=minimal'
        },
        body: JSON.stringify({
          type: 'error',
          message: `모니터링 시스템 오류: ${error.message}`,
          error_type: 'monitor_failure',
          metadata: {
            error: error.message,
            stack: error.stack
          }
        })
      });
    } catch (logError) {
      console.error('Failed to log monitor error:', logError);
    }
  }
}
