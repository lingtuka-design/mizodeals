interface DesiDimeDealResult {
  dealId: string;
  title: string;
  price: number;
  originalPrice: number;
  discountPercent: number;
  rating: number;
  ratingsCount: number;
  imageUrl: string;
  asin: string | null;
  amazonUrl: string | null;
  category: string;
  source: string;
  isLootDeal: boolean;
}

export const onRequestGet: PagesFunction = async (context) => {
  const { request } = context;
  const url = new URL(request.url);
  const limitParam = url.searchParams.get('limit') || '15';
  const limit = Math.min(Math.max(parseInt(limitParam, 10) || 15, 1), 30);
  const targetTag = url.searchParams.get('tag') || 'lalmalsawmtlu-21';

  try {
    // 1. Fetch DesiDime /deals page with clean browser headers
    const desidimeRes = await fetch('https://www.desidime.com/deals', {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
      },
    });

    if (!desidimeRes.ok) {
      return new Response(
        JSON.stringify({
          success: false,
          error: `DesiDime responded with status ${desidimeRes.status}`,
        }),
        {
          status: 502,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
        }
      );
    }

    const html = await desidimeRes.text();

    // 2. Split into articles
    const articleChunks = html.split('<article class="');
    const rawDeals: {
      dealId: string;
      title: string;
      store: string;
      price: number;
      originalPrice: number;
      discountPercent: number;
      imageUrl: string;
      visitUrl: string;
    }[] = [];

    for (let i = 1; i < articleChunks.length && rawDeals.length < limit * 2; i++) {
      const art = articleChunks[i];
      const dealId = art.match(/data-gtm-deal-id="([^"]+)"/)?.[1];
      const store = art.match(/data-gtm-store="([^"]+)"/)?.[1] || '';

      // We focus on Amazon deals, or fallback to all if fewer
      const isAmazon = store.toLowerCase().includes('amazon') || art.toLowerCase().includes('amazon');
      if (!dealId || !isAmazon) continue;

      // Image
      const imgMatch =
        art.match(/id="image-[0-9]+"\s+src="([^"]+)"/i) ||
        art.match(/<img[^>]+src="([^"]+desidime\.com\/[^"]+)"/i) ||
        art.match(/<img[^>]+src="([^"]+)"/i);
      const imageUrl = imgMatch ? imgMatch[1].replace(/&amp;/g, '&') : '';

      // Title
      const titleMatch =
        art.match(/alt="([^"]+)"/i) ||
        art.match(/data-permalink="deals\/([^"]+)"/i);
      let title = titleMatch ? titleMatch[1].replace(/-/g, ' ').trim() : 'Amazon Deal';
      // Clean up title capitalization if came from permalink
      if (title.length > 5) {
        title = title.charAt(0).toUpperCase() + title.slice(1);
      }

      // Price extraction
      const priceText = art.match(/₹\s*([0-9,]+)/)?.[1];
      const dealPrice = priceText ? parseInt(priceText.replace(/,/g, ''), 10) : 999;

      // Discount extraction
      const discountMatch = art.match(/([0-9]+)%\s*off/i);
      const discountPercent = discountMatch ? parseInt(discountMatch[1], 10) : 40;

      // Calculate approximate original price if not explicitly in card
      const originalPrice = Math.round(dealPrice / (1 - Math.min(discountPercent, 85) / 100));

      rawDeals.push({
        dealId,
        title,
        store: 'Amazon',
        price: dealPrice,
        originalPrice,
        discountPercent,
        imageUrl,
        visitUrl: `https://visit.desidime.com/visit/home-get-deals-1/${dealId}`,
      });
    }

    // 3. Resolve Amazon ASINs from visit links concurrently (up to limit)
    const candidates = rawDeals.slice(0, limit);
    const resolvedDeals: DesiDimeDealResult[] = [];

    await Promise.all(
      candidates.map(async (item) => {
        let asin: string | null = null;
        let cleanAmazonUrl: string | null = null;

        try {
          const redirRes = await fetch(item.visitUrl, {
            redirect: 'manual',
            headers: {
              'User-Agent':
                'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko)',
            },
          });

          const loc = redirRes.headers.get('location');
          if (loc && loc.includes('url=')) {
            const matchUrl = loc.match(/url=([^&]+)/);
            if (matchUrl) {
              const decoded = decodeURIComponent(matchUrl[1]);
              const asinMatch = decoded.match(/(?:dp|gp\/product)\/([A-Z0-9]{10})/i);
              if (asinMatch) {
                asin = asinMatch[1];
                cleanAmazonUrl = `https://www.amazon.in/dp/${asin}?tag=${targetTag}`;
              } else if (decoded.includes('amazon.in')) {
                // Category or search page link
                const parsed = new URL(decoded);
                parsed.searchParams.set('tag', targetTag);
                cleanAmazonUrl = parsed.toString();
              }
            }
          }
        } catch (err) {
          // If redirect fails, leave ASIN as null
        }

        // Categorize based on title
        const lowerTitle = item.title.toLowerCase();
        let category = 'electronics';
        if (lowerTitle.includes('shirt') || lowerTitle.includes('shoe') || lowerTitle.includes('bag') || lowerTitle.includes('wear') || lowerTitle.includes('jewel')) {
          category = 'fashion';
        } else if (lowerTitle.includes('cook') || lowerTitle.includes('kitchen') || lowerTitle.includes('bottle') || lowerTitle.includes('fan') || lowerTitle.includes('mop')) {
          category = 'home';
        } else if (lowerTitle.includes('shampoo') || lowerTitle.includes('serum') || lowerTitle.includes('cream') || lowerTitle.includes('face') || lowerTitle.includes('perfume')) {
          category = 'beauty';
        }

        // Check if loot deal (>= 50% discount)
        const isLootDeal = item.discountPercent >= 50;

        resolvedDeals.push({
          dealId: item.dealId,
          title: item.title,
          price: item.price,
          originalPrice: item.originalPrice,
          discountPercent: item.discountPercent,
          rating: 4.3,
          ratingsCount: 450,
          imageUrl: item.imageUrl,
          asin,
          amazonUrl: cleanAmazonUrl || (asin ? `https://www.amazon.in/dp/${asin}?tag=${targetTag}` : null),
          category,
          source: 'DesiDime Live FPD',
          isLootDeal,
        });
      })
    );

    return new Response(
      JSON.stringify({
        success: true,
        count: resolvedDeals.length,
        deals: resolvedDeals,
        timestamp: new Date().toISOString(),
      }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Cache-Control': 'public, max-age=300', // Cache 5 mins at edge
        },
      }
    );
  } catch (error: any) {
    return new Response(
      JSON.stringify({
        success: false,
        error: 'Failed to scrape DesiDime deals',
        details: error?.message || String(error),
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
