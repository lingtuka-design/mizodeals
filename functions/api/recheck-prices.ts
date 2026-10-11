interface Env {
  AMAZON_CLIENT_ID?: string;
  AMAZON_CLIENT_SECRET?: string;
  AMAZON_PARTNER_TAG?: string;
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { request } = context;

  try {
    const body = await request.json() as {
      deals?: Array<{
        id: string;
        asin: string;
        dealPrice: number;
        originalPrice: number;
        currentPrice?: number;
        rating: number;
        ratingsCount: number;
      }>;
    };

    if (!body.deals || !Array.isArray(body.deals)) {
      return new Response(
        JSON.stringify({ error: 'Expected deals array in request body' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const now = new Date().toISOString();
    let expiredCount = 0;
    let lootCount = 0;

    const updatedDeals = body.deals.map((item) => {
      // Calculate active discount
      const effectivePrice = item.currentPrice || item.dealPrice;
      const discount = item.originalPrice > 0 
        ? Math.round(((item.originalPrice - effectivePrice) / item.originalPrice) * 100) 
        : 0;

      // Rule: If price increased or discount dropped below 20% -> expired
      const isExpired = effectivePrice > item.dealPrice * 1.15 || discount < 20;
      
      // Rule: Hot Loot Deal
      const isLoot = !isExpired && discount >= 50 && item.rating >= 4.0 && item.ratingsCount >= 100;

      if (isExpired) expiredCount++;
      if (isLoot) lootCount++;

      return {
        id: item.id,
        status: isExpired ? 'expired' : 'active',
        isLootDeal: isLoot,
        discountPercent: discount,
        lastCheckedAt: now,
      };
    });

    return new Response(
      JSON.stringify({
        success: true,
        checkedAt: now,
        totalChecked: body.deals.length,
        activeCount: body.deals.length - expiredCount,
        expiredCount,
        lootCount,
        results: updatedDeals,
      }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      }
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return new Response(
      JSON.stringify({ error: 'Failed to process price re-check', message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
