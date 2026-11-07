interface Env {
  DB?: D1Database;
  AMAZON_CLIENT_ID?: string;
  AMAZON_CLIENT_SECRET?: string;
  AMAZON_PARTNER_TAG?: string;
}

interface LwaTokenResponse {
  access_token: string;
  expires_in: number;
  token_type: string;
}

function classifyCategory(title: string): string {
  const t = (title || '').toLowerCase();
  if (/shoe|sneaker|derby|loafer|boot|footwear|sandal|flip\s*flop|clog|shirt|pant|jeans|dress|jacket|hoodie|fleece|sweater|beanie|muffler|fashion/i.test(t)) {
    return 'shoes_fashion';
  }
  if (/laptop|phone|earbud|headphone|smartwatch|watch|power\s*bank|tv|camera|keyboard|mouse|speaker|gadget|charger/i.test(t)) {
    return 'gadgets';
  }
  if (/cooker|kettle|knife|light|led|pan|bottle|chopper|fryer|home|kitchen|curtain/i.test(t)) {
    return 'home_kitchen';
  }
  if (/shampoo|serum|cream|face|perfume|beauty/i.test(t)) {
    return 'beauty';
  }
  return 'shoes_fashion';
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { request, env } = context;
  const url = new URL(request.url);
  const paramId = url.searchParams.get('id') || '';
  let asin = url.searchParams.get('asin') || '';
  const partnerTag = env.AMAZON_PARTNER_TAG || 'lalmalsawmtlu-21';

  // If id is provided but not asin, check if id contains or is an ASIN
  if (!asin && paramId) {
    const asinMatch = paramId.match(/(?:deal-amz-)?([a-z0-9]{10})/i);
    if (asinMatch) {
      asin = asinMatch[1].toUpperCase();
    }
  }

  // 1. Check if the deal is already in Cloudflare D1 by id or asin
  if (env.DB && (paramId || asin)) {
    try {
      const dbDeal = await env.DB.prepare(
        'SELECT * FROM deals WHERE id = ? OR (asin IS NOT NULL AND UPPER(asin) = ?)'
      )
        .bind(paramId, asin ? asin.toUpperCase() : paramId)
        .first();

      if (dbDeal) {
        const store = (dbDeal as any).store || 'amazon';
        let affiliateUrl = (dbDeal as any).affiliate_url;
        if (!affiliateUrl || store === 'amazon') {
          affiliateUrl = `https://www.amazon.in/dp/${(dbDeal as any).asin}?tag=${partnerTag}`;
        }
        const mappedDeal = {
          id: (dbDeal as any).id,
          asin: (dbDeal as any).asin,
          title: (dbDeal as any).title,
          category: (dbDeal as any).category,
          store,
          originalPrice: (dbDeal as any).original_price,
          dealPrice: (dbDeal as any).deal_price,
          currentPrice: (dbDeal as any).current_price,
          discountPercent: (dbDeal as any).discount_percent,
          rating: (dbDeal as any).rating,
          ratingsCount: (dbDeal as any).ratings_count,
          imageUrl: (dbDeal as any).image_url,
          affiliateUrl,
          status: (dbDeal as any).status,
          isLootDeal: Boolean((dbDeal as any).is_loot_deal),
          couponText: (dbDeal as any).coupon_text,
          description: (dbDeal as any).description,
          createdAt: (dbDeal as any).created_at,
          lastCheckedAt: (dbDeal as any).last_checked_at,
          verifiedAt: (dbDeal as any).verified_at,
        };

        if (!url.searchParams.get('refresh')) {
          return new Response(JSON.stringify({ success: true, deal: mappedDeal }), {
            headers: {
              'Content-Type': 'application/json',
              'Access-Control-Allow-Origin': '*',
              'Cache-Control': 'public, max-age=60',
            },
          });
        }
      }
    } catch (e) {}
  }

  if (!asin) {
    asin = 'B0CHX1W1XY';
  }

  const clientId = env.AMAZON_CLIENT_ID;
  const clientSecret = env.AMAZON_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    return new Response(
      JSON.stringify({
        success: false,
        error: 'Amazon API credentials not configured in Cloudflare environment',
      }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      }
    );
  }

  try {
    // 1. Fetch LWA Access Token
    const tokenRes = await fetch('https://api.amazon.com/auth/o2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        grant_type: 'client_credentials',
        client_id: clientId,
        client_secret: clientSecret,
        scope: 'creatorsapi::default',
      }),
    });

    if (!tokenRes.ok) {
      const errText = await tokenRes.text();
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Failed to retrieve Amazon OAuth token',
          details: errText,
        }),
        {
          status: 400,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
        }
      );
    }

    const tokenData = (await tokenRes.json()) as LwaTokenResponse;

    // 2. Query Amazon Creators API getItems endpoint
    const creatorsRes = await fetch('https://creatorsapi.amazon/catalog/v1/getItems', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${tokenData.access_token}`,
        'x-marketplace': 'www.amazon.in',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        partnerTag,
        partnerType: 'Associates',
        itemIdType: 'ASIN',
        itemIds: [asin],
        resources: [
          'itemInfo.title',
          'images.primary.large',
          'offersV2.listings.price',
        ],
      }),
    });

    const creatorsData = await creatorsRes.json();

    if (!creatorsRes.ok) {
      return new Response(
        JSON.stringify({
          success: false,
          status: creatorsRes.status,
          message: 'Amazon Creators API response status',
          creatorsApiResponse: creatorsData,
          note: 'Amazon requires 3-10 referred qualifying sales within the last 30/180 days on your Associates account to unlock live product API queries (AssociateNotEligible).',
        }),
        {
          status: creatorsRes.status,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
        }
      );
    }

    // 3. Extract live price and item details
    const item = (creatorsData as any)?.itemsResult?.items?.[0];
    const listing = item?.offersV2?.listings?.find((l: any) => l.isBuyBoxWinner) || item?.offersV2?.listings?.[0];
    const livePrice = listing?.price?.money?.amount;
    const liveMrp = listing?.price?.savingBasis?.money?.amount;
    const liveSavings = listing?.price?.savings?.percentage;
    const isAvailable = typeof livePrice === 'number' && livePrice > 0;
    const officialTitle = item?.itemInfo?.title?.displayValue;
    const officialImage = item?.images?.primary?.large?.url;

    const roundedPrice = isAvailable ? Math.round(livePrice) : null;
    const roundedMrp = typeof liveMrp === 'number' && liveMrp > 0 ? Math.round(liveMrp) : null;
    const computedDiscount = typeof liveSavings === 'number'
      ? Math.round(liveSavings)
      : (roundedMrp && roundedPrice ? Math.round(((roundedMrp - roundedPrice) / roundedMrp) * 100) : 0);

    // 4. Auto-update live price in Cloudflare D1 database if DB is bound
    let dbSyncStatus = 'skipped';
    let dbErrorMsg: string | null = null;
    if (env.DB && asin) {
      try {
        const nowIso = new Date().toISOString();
        if (isAvailable && roundedPrice) {
          const status = computedDiscount >= 15 ? 'active' : 'expired';
          const dealCategory = classifyCategory(officialTitle || '');
          const originalPrice = roundedMrp || Math.round(roundedPrice * 1.5);
          const isLoot = computedDiscount >= 50 ? 1 : 0;
          const coupon = computedDiscount >= 50 ? '🔥 Price Tlahniam Nasa!' : null;

          await env.DB.prepare(
            `INSERT INTO deals (
              id, asin, title, category, store, original_price, deal_price, current_price,
              discount_percent, rating, ratings_count, image_url, affiliate_url, status,
              is_loot_deal, coupon_text, description, created_at, last_checked_at, verified_at
            ) VALUES (?, ?, ?, ?, 'amazon', ?, ?, ?, ?, 4.4, 3200, ?, ?, ?, ?, ?, ?, ?, ?, 'Verified via Amazon Creators API')
            ON CONFLICT(asin) DO UPDATE SET
              deal_price = excluded.deal_price,
              current_price = excluded.current_price,
              original_price = COALESCE(excluded.original_price, deals.original_price),
              discount_percent = excluded.discount_percent,
              title = COALESCE(excluded.title, deals.title),
              image_url = COALESCE(excluded.image_url, deals.image_url),
              status = excluded.status,
              last_checked_at = excluded.last_checked_at,
              verified_at = excluded.verified_at`
          )
            .bind(
              `deal-amz-${asin.toLowerCase()}`,
              asin,
              officialTitle || 'Amazon Deal',
              dealCategory,
              originalPrice,
              roundedPrice,
              roundedPrice,
              computedDiscount,
              officialImage || '',
              `https://www.amazon.in/dp/${asin}?tag=${partnerTag}`,
              status,
              isLoot,
              coupon,
              `${officialTitle || 'Amazon deal'} • Save ₹${originalPrice - roundedPrice}`,
              nowIso,
              nowIso
            )
            .run();
          dbSyncStatus = 'success';
        } else {
          await env.DB.prepare(
            `UPDATE deals SET
              status = 'expired',
              last_checked_at = ?,
              verified_at = 'Amazon API (Out of Stock)'
            WHERE asin = ?`
          )
            .bind(nowIso, asin)
            .run();
          dbSyncStatus = 'marked_expired';
        }
      } catch (dbErr: any) {
        dbSyncStatus = 'failed';
        dbErrorMsg = dbErr?.message || String(dbErr);
        console.error('Failed to sync deal to D1 database:', dbErr);
      }
    } else {
      dbSyncStatus = !env.DB ? 'no_db_binding' : 'no_asin';
    }

    const dealCategory = classifyCategory(officialTitle || '');
    const originalPrice = roundedMrp || Math.round((roundedPrice || 499) * 1.5);
    const nowIso = new Date().toISOString();
    const isLoot = computedDiscount >= 50;
    const coupon = computedDiscount >= 50 ? '🔥 Price Tlahniam Nasa!' : null;

    const mappedDeal = {
      id: `deal-amz-${asin.toLowerCase()}`,
      asin: asin.toUpperCase(),
      title: officialTitle || 'Amazon Deal',
      category: dealCategory,
      store: 'amazon',
      originalPrice,
      dealPrice: roundedPrice || originalPrice,
      currentPrice: roundedPrice || originalPrice,
      discountPercent: computedDiscount,
      rating: 4.4,
      ratingsCount: 3200,
      imageUrl: officialImage || '',
      affiliateUrl: `https://www.amazon.in/dp/${asin.toUpperCase()}?tag=${partnerTag}`,
      status: computedDiscount >= 15 && isAvailable ? 'active' : 'expired',
      isLootDeal: isLoot,
      couponText: coupon,
      description: `${officialTitle || 'Amazon deal'} • Save ₹${originalPrice - (roundedPrice || 0)}`,
      createdAt: nowIso,
      lastCheckedAt: nowIso,
      verifiedAt: 'Verified via Amazon Creators API',
    };

    return new Response(
      JSON.stringify({
        success: true,
        deal: mappedDeal,
        asin,
        partnerTag,
        livePrice: roundedPrice,
        liveMrp: roundedMrp,
        discountPercent: computedDiscount,
        isAvailable,
        title: officialTitle,
        imageUrl: officialImage,
        dbSyncStatus,
        dbErrorMsg,
        data: creatorsData,
      }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Cache-Control': 'public, max-age=120',
        },
      }
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return new Response(
      JSON.stringify({
        success: false,
        error: 'Internal server error while fetching Amazon deal',
        message,
      }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      }
    );
  }
};
