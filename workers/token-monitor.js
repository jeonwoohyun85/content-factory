// 토큰 만료일 자동 모니터링 Worker
// 매일 09:00 KST 실행

const SUPABASE_URL = 'https://tvymimryuwtgsfakuffl.supabase.co';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR2eW1pbXJ5dXd0Z3NmYWt1ZmZsIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczNjU3Nzc5OCwiZXhwIjoyMDUyMTUzNzk4fQ.IUk-YIb-sQJ7f0LZhLHJZmhlOT0OwxQCn1uHVXlRvNI';

export default {
  async scheduled(event, env, ctx) {
    console.log('Token monitor started at:', new Date().toISOString());

    try {
      // token_manager 테이블에서 모든 토큰 조회
      const response = await fetch(
        `${SUPABASE_URL}/rest/v1/token_manager?select=*`,
        {
          headers: {
            'apikey': SUPABASE_SERVICE_KEY,
            'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to fetch tokens: ${response.status}`);
      }

      const tokens = await response.json();
      const now = new Date();
      const warnings = [];

      for (const token of tokens) {
        // expires_at이 NULL이면 영구 토큰 → 스킵
        if (!token.expires_at) {
          continue;
        }

        const expiresAt = new Date(token.expires_at);
        const daysLeft = Math.floor((expiresAt - now) / (1000 * 60 * 60 * 24));

        // 만료됨
        if (daysLeft < 0) {
          warnings.push({
            level: 'critical',
            service: token.service_name,
            name: token.token_name,
            daysLeft: daysLeft,
            message: `❌ 만료됨: ${token.service_name} - ${token.token_name} (${Math.abs(daysLeft)}일 전 만료)`
          });
        }
        // 30일 이내 만료
        else if (daysLeft <= 30) {
          warnings.push({
            level: 'warning',
            service: token.service_name,
            name: token.token_name,
            daysLeft: daysLeft,
            message: `⚠️ 만료 임박: ${token.service_name} - ${token.token_name} (${daysLeft}일 남음)`
          });
        }
        // 90일 이내 만료 (사전 알림)
        else if (daysLeft <= 90) {
          warnings.push({
            level: 'info',
            service: token.service_name,
            name: token.token_name,
            daysLeft: daysLeft,
            message: `ℹ️ 갱신 권장: ${token.service_name} - ${token.token_name} (${daysLeft}일 남음)`
          });
        }
      }

      // 경고가 있으면 로그 기록
      if (warnings.length > 0) {
        console.log(`Token warnings (${warnings.length}):`);
        warnings.forEach(w => console.log(w.message));

        // logs 테이블에 기록
        const criticalWarnings = warnings.filter(w => w.level === 'critical');
        const warningLevel = warnings.filter(w => w.level === 'warning');

        if (criticalWarnings.length > 0 || warningLevel.length > 0) {
          const logMessage = [
            `토큰 만료 알림:`,
            criticalWarnings.length > 0 ? `만료됨 ${criticalWarnings.length}개` : null,
            warningLevel.length > 0 ? `임박 ${warningLevel.length}개` : null
          ].filter(Boolean).join(', ');

          await fetch(
            `${SUPABASE_URL}/rest/v1/logs`,
            {
              method: 'POST',
              headers: {
                'apikey': SUPABASE_SERVICE_KEY,
                'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
                'Content-Type': 'application/json',
                'Prefer': 'return=minimal'
              },
              body: JSON.stringify({
                level: criticalWarnings.length > 0 ? 'error' : 'warning',
                message: logMessage,
                metadata: { warnings: warnings }
              })
            }
          );
        }

        return new Response(JSON.stringify({
          success: true,
          checked: tokens.length,
          warnings: warnings
        }), {
          headers: { 'Content-Type': 'application/json' }
        });
      }

      console.log('All tokens OK');
      return new Response(JSON.stringify({
        success: true,
        checked: tokens.length,
        warnings: []
      }), {
        headers: { 'Content-Type': 'application/json' }
      });

    } catch (error) {
      console.error('Token monitor error:', error);

      // 에러 로그 기록
      await fetch(
        `${SUPABASE_URL}/rest/v1/logs`,
        {
          method: 'POST',
          headers: {
            'apikey': SUPABASE_SERVICE_KEY,
            'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
            'Content-Type': 'application/json',
            'Prefer': 'return=minimal'
          },
          body: JSON.stringify({
            level: 'error',
            message: `토큰 모니터 에러: ${error.message}`
          })
        }
      );

      return new Response(JSON.stringify({
        success: false,
        error: error.message
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }
};
