interface Env {
  DB: D1Database;
}

// Simple fast SHA-256 hash in Web Crypto API
async function hashIp(ip: string, salt: string): Promise<string> {
  const enc = new TextEncoder();
  const data = enc.encode(`${ip}-${salt}`);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('').slice(0, 16);
}

function detectDevice(userAgent: string): string {
  if (!userAgent) return 'desktop';
  const ua = userAgent.toLowerCase();
  if (/mobile|android|iphone|ipod|blackberry|windows phone/i.test(ua)) {
    return 'mobile';
  }
  if (/tablet|ipad/i.test(ua)) {
    return 'tablet';
  }
  return 'desktop';
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { request, env } = context;

  if (!env.DB) {
    return new Response(JSON.stringify({ ok: true, source: 'no-db' }), {
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    });
  }

  try {
    const body: any = await request.json().catch(() => ({}));
    const path = String(body.path || '/').slice(0, 200);
    const referrer = String(body.referrer || request.headers.get('referer') || 'Direct').slice(0, 300);

    const clientIp = request.headers.get('cf-connecting-ip') || '127.0.0.1';
    const userAgent = request.headers.get('user-agent') || '';
    const today = new Date().toISOString().slice(0, 10);
    const visitorHash = await hashIp(clientIp, today);
    const device = detectDevice(userAgent);

    const cf: any = (request as any).cf || {};
    const city = String(cf.city || 'Unknown').slice(0, 100);
    const region = String(cf.region || cf.regionCode || 'Mizoram').slice(0, 100);
    const country = String(cf.country || 'IN').slice(0, 10);
    const nowIso = new Date().toISOString();

    await env.DB.prepare(
      `INSERT INTO page_views (path, visitor_hash, city, region, country, device, referrer, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    )
      .bind(path, visitorHash, city, region, country, device, referrer, nowIso)
      .run();

    return new Response(JSON.stringify({ ok: true }), {
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ ok: false, error: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    });
  }
};

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { env } = context;

  if (!env.DB) {
    return new Response(JSON.stringify({ success: false, message: 'No DB configured' }), {
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    });
  }

  try {
    const todayPrefix = new Date().toISOString().slice(0, 10);

    // 1. Total & Today metrics
    const totalRow: any = await env.DB.prepare('SELECT COUNT(*) as count FROM page_views').first();
    const todayRow: any = await env.DB.prepare(
      'SELECT COUNT(DISTINCT visitor_hash) as unique_visitors, COUNT(*) as views FROM page_views WHERE created_at >= ?'
    )
      .bind(`${todayPrefix}T00:00:00`)
      .first();

    // 2. Top Cities
    const { results: topCities } = await env.DB.prepare(
      `SELECT city, region, COUNT(*) as count
       FROM page_views
       WHERE city IS NOT NULL AND city != 'Unknown'
       GROUP BY city, region
       ORDER BY count DESC
       LIMIT 8`
    ).all();

    // 3. Top Devices
    const { results: topDevices } = await env.DB.prepare(
      `SELECT device, COUNT(*) as count
       FROM page_views
       GROUP BY device
       ORDER BY count DESC`
    ).all();

    // 4. Top Referrers
    const { results: topReferrers } = await env.DB.prepare(
      `SELECT referrer, COUNT(*) as count
       FROM page_views
       WHERE referrer IS NOT NULL AND referrer != ''
       GROUP BY referrer
       ORDER BY count DESC
       LIMIT 8`
    ).all();

    // 5. Recent Views
    const { results: recentViews } = await env.DB.prepare(
      `SELECT path, city, device, referrer, created_at
       FROM page_views
       ORDER BY created_at DESC
       LIMIT 15`
    ).all();

    return new Response(
      JSON.stringify({
        success: true,
        stats: {
          totalViews: totalRow?.count || 0,
          todayUniqueVisitors: todayRow?.unique_visitors || 0,
          todayViews: todayRow?.views || 0,
          topCities: topCities || [],
          topDevices: topDevices || [],
          topReferrers: topReferrers || [],
          recentViews: recentViews || [],
          serverTime: new Date().toISOString(),
        },
      }),
      {
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Cache-Control': 'no-cache',
        },
      }
    );
  } catch (err: any) {
    return new Response(JSON.stringify({ success: false, error: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    });
  }
};
