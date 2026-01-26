// config-snapshot.js
// 시스템 설정 자동 스냅샷 및 변경 감지
// 매일 09:00 KST 실행

const SUPABASE_URL = 'https://tvymimryuwtgsfakuffl.supabase.co';

export default {
  async fetch(request, env, ctx) {
    // 수동 테스트용
    return await this.scheduled(null, env, ctx);
  },

  async scheduled(event, env, ctx) {
    console.log('Config snapshot started at:', new Date().toISOString());

    try {
      const SUPABASE_KEY = env.SUPABASE_SERVICE_KEY;
      const CLOUDFLARE_ACCOUNT_ID = env.CLOUDFLARE_ACCOUNT_ID;
      const CLOUDFLARE_API_TOKEN = env.CLOUDFLARE_API_TOKEN;

      const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
      const changes = [];

      // 1. Supabase 테이블 목록 스냅샷
      const supabaseTables = await fetchSupabaseTables(SUPABASE_KEY);
      const supabaseChanged = await saveSnapshot(
        SUPABASE_KEY,
        today,
        'supabase_tables',
        supabaseTables
      );
      if (supabaseChanged) changes.push(supabaseChanged);

      // 2. Cloudflare Workers 목록 스냅샷
      const cloudflareWorkers = await fetchCloudflareWorkers(
        CLOUDFLARE_ACCOUNT_ID,
        CLOUDFLARE_API_TOKEN
      );
      const workersChanged = await saveSnapshot(
        SUPABASE_KEY,
        today,
        'cloudflare_workers',
        cloudflareWorkers
      );
      if (workersChanged) changes.push(workersChanged);

      // 3. 변경사항 logs에 기록
      if (changes.length > 0) {
        await logChanges(SUPABASE_KEY, changes);
        console.log(`Changes detected: ${changes.length}`);
      } else {
        console.log('No changes detected');
      }

      return new Response(JSON.stringify({
        success: true,
        date: today,
        changes: changes.length
      }), {
        headers: { 'Content-Type': 'application/json' }
      });

    } catch (error) {
      console.error('Config snapshot error:', error);

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

// Supabase 테이블 목록 가져오기
async function fetchSupabaseTables(supabaseKey) {
  // config_snapshots 테이블에서 직접 조회하는 대신
  // 여러 테이블에 SELECT 쿼리를 시도해서 존재하는 테이블 목록 추출
  const knownTables = [
    'partners', 'clients', 'folders', 'client_photos', 'contents',
    'payments', 'logs', 'translations', 'api_usage', 'token_manager',
    'password_reset_tokens', 'config_snapshots'
  ];

  const existingTables = [];

  for (const table of knownTables) {
    try {
      const response = await fetch(
        `${SUPABASE_URL}/rest/v1/${table}?select=id&limit=0`,
        {
          headers: {
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`
          }
        }
      );

      if (response.ok) {
        existingTables.push(table);
      }
    } catch (e) {
      // 테이블 없으면 스킵
    }
  }

  return { tables: existingTables.sort(), count: existingTables.length };
}

// Cloudflare Workers 목록 가져오기
async function fetchCloudflareWorkers(accountId, apiToken) {
  const response = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${accountId}/workers/scripts`,
    {
      headers: {
        'Authorization': `Bearer ${apiToken}`,
        'Content-Type': 'application/json'
      }
    }
  );

  if (!response.ok) {
    throw new Error(`Failed to fetch Cloudflare Workers: ${response.status}`);
  }

  const data = await response.json();
  const workers = data.result || [];

  // Worker 이름과 핸들러만 추출
  const workerList = workers.map(w => ({
    id: w.id,
    handlers: w.handlers,
    routes: w.routes ? w.routes.map(r => r.pattern) : []
  })).sort((a, b) => a.id.localeCompare(b.id));

  return { workers: workerList, count: workerList.length };
}

// 스냅샷 저장 및 변경 감지
async function saveSnapshot(supabaseKey, date, service, data) {
  // 어제 스냅샷 가져오기
  const yesterday = new Date(date);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().split('T')[0];

  const prevResponse = await fetch(
    `${SUPABASE_URL}/rest/v1/config_snapshots?snapshot_date=eq.${yesterdayStr}&service=eq.${service}&select=config_data`,
    {
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`
      }
    }
  );

  const prevData = prevResponse.ok ? await prevResponse.json() : [];
  const prevSnapshot = prevData[0]?.config_data;

  // 오늘 스냅샷 저장 (UPSERT)
  await fetch(
    `${SUPABASE_URL}/rest/v1/config_snapshots`,
    {
      method: 'POST',
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`,
        'Content-Type': 'application/json',
        'Prefer': 'resolution=merge-duplicates'
      },
      body: JSON.stringify({
        snapshot_date: date,
        service: service,
        config_data: data
      })
    }
  );

  // 변경 감지
  if (prevSnapshot) {
    const changes = detectChanges(service, prevSnapshot, data);
    if (changes) {
      return { service, changes };
    }
  }

  return null;
}

// 변경사항 감지
function detectChanges(service, prev, current) {
  if (service === 'supabase_tables') {
    const prevTables = new Set(prev.tables || []);
    const currTables = new Set(current.tables || []);

    const added = [...currTables].filter(t => !prevTables.has(t));
    const removed = [...prevTables].filter(t => !currTables.has(t));

    if (added.length > 0 || removed.length > 0) {
      return { added, removed };
    }
  }

  if (service === 'cloudflare_workers') {
    const prevWorkers = new Set((prev.workers || []).map(w => w.id));
    const currWorkers = new Set((current.workers || []).map(w => w.id));

    const added = [...currWorkers].filter(w => !prevWorkers.has(w));
    const removed = [...prevWorkers].filter(w => !currWorkers.has(w));

    if (added.length > 0 || removed.length > 0) {
      return { added, removed };
    }
  }

  return null;
}

// 변경사항 로그 기록
async function logChanges(supabaseKey, changes) {
  const messages = [];

  for (const change of changes) {
    if (change.service === 'supabase_tables') {
      if (change.changes.added.length > 0) {
        messages.push(`Supabase 테이블 추가: ${change.changes.added.join(', ')}`);
      }
      if (change.changes.removed.length > 0) {
        messages.push(`Supabase 테이블 삭제: ${change.changes.removed.join(', ')}`);
      }
    }

    if (change.service === 'cloudflare_workers') {
      if (change.changes.added.length > 0) {
        messages.push(`Cloudflare Worker 추가: ${change.changes.added.join(', ')}`);
      }
      if (change.changes.removed.length > 0) {
        messages.push(`Cloudflare Worker 삭제: ${change.changes.removed.join(', ')}`);
      }
    }
  }

  if (messages.length > 0) {
    await fetch(
      `${SUPABASE_URL}/rest/v1/logs`,
      {
        method: 'POST',
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=minimal'
        },
        body: JSON.stringify({
          type: 'success',
          message: `설정 변경 감지: ${messages.join(', ')}`,
          metadata: { changes }
        })
      }
    );
  }
}
