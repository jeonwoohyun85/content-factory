// Analytics D1 Query Functions

export async function getVisitorStats(env, subdomain, dateRange = '7days') {
  const now = Math.floor(Date.now() / 1000);
  const ranges = {
    '1day': 86400,
    '7days': 604800,
    '30days': 2592000,
    '90days': 7776000
  };
  const since = now - (ranges[dateRange] || 604800);

  const stats = await env.ANALYTICS_DB.prepare(`
    SELECT
      COUNT(*) as total,
      COUNT(DISTINCT visitor_hash) as unique_visitors,
      COUNT(CASE WHEN visited_at > ? THEN 1 END) as today_visits,
      COUNT(CASE WHEN visited_at > ? THEN 1 END) as weekly_visits,
      COUNT(CASE WHEN visited_at > ? THEN 1 END) as monthly_visits,
      COUNT(CASE WHEN visited_at > ? THEN 1 END) as realtime_visits
    FROM analytics_visits
    WHERE subdomain = ? AND visited_at > ?
  `).bind(
    now - 86400,
    now - 604800,
    now - 2592000,
    now - 300,
    subdomain,
    since
  ).first();

  return stats || { total: 0, unique_visitors: 0, today_visits: 0, weekly_visits: 0, monthly_visits: 0, realtime_visits: 0 };
}

export async function getCountryStats(env, subdomain, dateRange = '7days') {
  const now = Math.floor(Date.now() / 1000);
  const ranges = { '1day': 86400, '7days': 604800, '30days': 2592000, '90days': 7776000 };
  const since = now - (ranges[dateRange] || 604800);

  const countries = await env.ANALYTICS_DB.prepare(`
    SELECT country, COUNT(*) as visits
    FROM analytics_visits
    WHERE subdomain = ? AND visited_at > ? AND country IS NOT NULL
    GROUP BY country
    ORDER BY visits DESC
    LIMIT 10
  `).bind(subdomain, since).all();

  return countries.results || [];
}

export async function getCityStats(env, subdomain, dateRange = '7days') {
  const now = Math.floor(Date.now() / 1000);
  const ranges = { '1day': 86400, '7days': 604800, '30days': 2592000, '90days': 7776000 };
  const since = now - (ranges[dateRange] || 604800);

  const cities = await env.ANALYTICS_DB.prepare(`
    SELECT city, country, COUNT(*) as visits
    FROM analytics_visits
    WHERE subdomain = ? AND visited_at > ? AND city IS NOT NULL
    GROUP BY city, country
    ORDER BY visits DESC
    LIMIT 10
  `).bind(subdomain, since).all();

  return cities.results || [];
}

export async function getReferrerStats(env, subdomain, dateRange = '7days') {
  const now = Math.floor(Date.now() / 1000);
  const ranges = { '1day': 86400, '7days': 604800, '30days': 2592000, '90days': 7776000 };
  const since = now - (ranges[dateRange] || 604800);

  const referrers = await env.ANALYTICS_DB.prepare(`
    SELECT referrer, COUNT(*) as visits
    FROM analytics_visits
    WHERE subdomain = ? AND visited_at > ?
    GROUP BY referrer
    ORDER BY visits DESC
    LIMIT 10
  `).bind(subdomain, since).all();

  return referrers.results || [];
}

export async function getPageStats(env, subdomain, dateRange = '7days') {
  const now = Math.floor(Date.now() / 1000);
  const ranges = { '1day': 86400, '7days': 604800, '30days': 2592000, '90days': 7776000 };
  const since = now - (ranges[dateRange] || 604800);

  const pages = await env.ANALYTICS_DB.prepare(`
    SELECT pathname, COUNT(*) as visits
    FROM analytics_visits
    WHERE subdomain = ? AND visited_at > ? AND pathname IS NOT NULL
    GROUP BY pathname
    ORDER BY visits DESC
    LIMIT 10
  `).bind(subdomain, since).all();

  return pages.results || [];
}

export async function getDeviceStats(env, subdomain, dateRange = '7days') {
  const now = Math.floor(Date.now() / 1000);
  const ranges = { '1day': 86400, '7days': 604800, '30days': 2592000, '90days': 7776000 };
  const since = now - (ranges[dateRange] || 604800);

  const devices = await env.ANALYTICS_DB.prepare(`
    SELECT
      CASE
        WHEN user_agent LIKE '%Mobile%' OR user_agent LIKE '%Android%' THEN 'Mobile'
        WHEN user_agent LIKE '%Tablet%' OR user_agent LIKE '%iPad%' THEN 'Tablet'
        ELSE 'Desktop'
      END as device_type,
      COUNT(*) as visits
    FROM analytics_visits
    WHERE subdomain = ? AND visited_at > ?
    GROUP BY device_type
    ORDER BY visits DESC
  `).bind(subdomain, since).all();

  return devices.results || [];
}

export async function sha256(message) {
  const msgBuffer = new TextEncoder().encode(message);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

export async function recordVisit(env, request, subdomain, pathname) {
  const userAgent = request.headers.get('User-Agent') || '';

  if (/bot|crawler|spider|crawling/i.test(userAgent)) {
    return;
  }

  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
  const country = request.cf?.country || null;
  const city = request.cf?.city || null;
  const referrer = request.headers.get('Referer') || 'Direct';

  const today = new Date().toISOString().substring(0, 10).replace(/-/g, '');
  const visitorHash = await sha256(`${ip}-${subdomain}-${today}`);

  const existingVisit = await env.ANALYTICS_DB.prepare(`
    SELECT id FROM analytics_visits
    WHERE subdomain = ? AND visitor_hash = ? AND visited_at > ?
    LIMIT 1
  `).bind(subdomain, visitorHash, Math.floor(Date.now() / 1000) - 86400).first();

  const isUniqueToday = existingVisit ? 0 : 1;

  try {
    await env.ANALYTICS_DB.prepare(`
      INSERT INTO analytics_visits
      (subdomain, visited_at, country, city, referrer, user_agent, pathname, visitor_hash, is_unique_today)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      subdomain,
      Math.floor(Date.now() / 1000),
      country,
      city,
      referrer,
      userAgent.substring(0, 255),
      pathname,
      visitorHash,
      isUniqueToday
    ).run();
  } catch (error) {
    console.error('Failed to record visit:', error);
  }
}
