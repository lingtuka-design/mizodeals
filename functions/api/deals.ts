import type { Deal } from '../../src/types';
import { INITIAL_DEALS } from '../../src/data/deals';

interface Env {
  DB: D1Database;
  AMAZON_PARTNER_TAG?: string;
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { env, request } = context;
  const url = new URL(request.url);
  const category = url.searchParams.get('category');
  const status = url.searchParams.get('status') || 'active';
  const isLoot = url.searchParams.get('loot');
  const limit = Math.min(parseInt(url.searchParams.get('limit') || '50', 10), 100);

  if (!env.DB) {
    // Fallback to static seed deals if DB binding not available in dev
    let filtered = INITIAL_DEALS;
    if (status !== 'all') {
      filtered = filtered.filter((d) => d.status === status);
    }
    if (category && category !== 'all') {
      filtered = filtered.filter((d) => d.category === category);
    }
    return new Response(JSON.stringify({ success: true, count: filtered.length, deals: filtered, source: 'fallback' }), {
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    });
  }

  try {
    let query = 'SELECT * FROM deals WHERE 1=1';
    const params: any[] = [];

    if (status !== 'all') {
      query += ' AND status = ?';
      params.push(status);
    }

    if (category && category !== 'all') {
      query += ' AND category = ?';
      params.push(category);
    }

    if (isLoot === 'true') {
      query += ' AND is_loot_deal = 1';
    }

    query += ' ORDER BY created_at DESC LIMIT ?';
    params.push(limit);

    const { results } = await env.DB.prepare(query).bind(...params).all();

    // Map database snake_case columns back to Deal interface
    const mappedDeals: Deal[] = (results || []).map((row: any) => ({
      id: row.id,
      asin: row.asin,
      title: row.title,
      category: row.category,
      store: row.store || 'amazon',
      originalPrice: row.original_price,
      dealPrice: row.deal_price,
      currentPrice: row.current_price,
      discountPercent: row.discount_percent,
      rating: row.rating,
      ratingsCount: row.ratings_count,
      imageUrl: row.image_url,
      affiliateUrl: row.affiliate_url,
      status: row.status,
      isLootDeal: Boolean(row.is_loot_deal),
      couponText: row.coupon_text,
      description: row.description,
      createdAt: row.created_at,
      lastCheckedAt: row.last_checked_at,
      verifiedAt: row.verified_at,
    }));

    // If database is empty (e.g. freshly created), return INITIAL_DEALS as fallback
    if (mappedDeals.length === 0 && !category) {
      return new Response(
        JSON.stringify({ success: true, count: INITIAL_DEALS.length, deals: INITIAL_DEALS, source: 'seed' }),
        { headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        count: mappedDeals.length,
        deals: mappedDeals,
        source: 'd1',
      }),
      {
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Cache-Control': 'public, max-age=60',
        },
      }
    );
  } catch (error: any) {
    return new Response(
      JSON.stringify({ success: false, error: error?.message || 'Database query error' }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      }
    );
  }
};
