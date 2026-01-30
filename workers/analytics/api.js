// Analytics API Endpoints

import {
  getVisitorStats,
  getCountryStats,
  getCityStats,
  getReferrerStats,
  getPageStats,
  getDeviceStats
} from './queries.js';

export async function handleStatsAPI(env, request, subdomain) {
  const url = new URL(request.url);
  const endpoint = url.pathname.split('/').pop();
  const dateRange = url.searchParams.get('range') || '7days';

  try {
    let data;

    switch (endpoint) {
      case 'summary':
        data = await getVisitorStats(env, subdomain, dateRange);
        break;
      case 'countries':
        data = await getCountryStats(env, subdomain, dateRange);
        break;
      case 'cities':
        data = await getCityStats(env, subdomain, dateRange);
        break;
      case 'referrers':
        data = await getReferrerStats(env, subdomain, dateRange);
        break;
      case 'pages':
        data = await getPageStats(env, subdomain, dateRange);
        break;
      case 'devices':
        data = await getDeviceStats(env, subdomain, dateRange);
        break;
      default:
        return new Response(JSON.stringify({ error: 'Unknown endpoint' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
        });
    }

    return new Response(JSON.stringify(data), {
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    });
  } catch (error) {
    console.error('Stats API error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    });
  }
}
