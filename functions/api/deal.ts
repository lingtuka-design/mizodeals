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

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { request, env } = context;
  const url = new URL(request.url);
  const asin = url.searchParams.get('asin') || 'B0CHX1W1XY';

  const clientId = env.AMAZON_CLIENT_ID;
  const clientSecret = env.AMAZON_CLIENT_SECRET;
  const partnerTag = env.AMAZON_PARTNER_TAG || 'lalmalsawmtlu-21';

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
    if (env.DB && asin) {
      try {
        const nowIso = new Date().toISOString();
        if (isAvailable && roundedPrice) {
          const status = computedDiscount >= 15 ? 'active' : 'expired';
          await env.DB.prepare(
            `UPDATE deals SET
              deal_price = ?,
              current_price = ?,
              original_price = COALESCE(?, original_price),
              discount_percent = ?,
              title = COALESCE(?, title),
              image_url = COALESCE(?, image_url),
              status = ?,
              last_checked_at = ?,
              verified_at = 'Verified via Amazon Creators API'
            WHERE asin = ?`
          )
            .bind(
              roundedPrice,
              roundedPrice,
              roundedMrp,
              computedDiscount,
              officialTitle || null,
              officialImage || null,
              status,
              nowIso,
              asin
            )
            .run();
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
        }
      } catch (dbErr) {
        console.error('Failed to sync deal to D1 database:', dbErr);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        asin,
        partnerTag,
        livePrice: roundedPrice,
        liveMrp: roundedMrp,
        discountPercent: computedDiscount,
        isAvailable,
        title: officialTitle,
        imageUrl: officialImage,
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
