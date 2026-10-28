interface Env {
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

    return new Response(
      JSON.stringify({
        success: true,
        asin,
        partnerTag,
        data: creatorsData,
      }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Cache-Control': 'public, max-age=300',
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
