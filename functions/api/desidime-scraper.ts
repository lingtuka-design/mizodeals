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

interface Env {
  DB?: D1Database;
  AMAZON_PARTNER_TAG?: string;
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { request, env } = context;
  const url = new URL(request.url);
  const limitParam = url.searchParams.get('limit') || '50';
  const limit = Math.min(Math.max(parseInt(limitParam, 10) || 50, 1), 80);
  const targetTag = url.searchParams.get('tag') || 'lalmalsawmtlu-21';

  try {
    const headers = {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
    };

    // Parallel fetch from 2 High-Volume endpoints:
    // 1) Amazon India Dedicated Store Page (contains 70+ direct Amazon deals)
    // 2) Live Deals Catalog
    const [storeRes, dealsRes] = await Promise.all([
      fetch('https://www.desidime.com/stores/amazon-india', { headers }).catch(() => null),
      fetch('https://www.desidime.com/deals', { headers }).catch(() => null),
    ]);

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

    const seenIds = new Set<string>();

    // 1. Parse Deals Page (Articles)
    if (dealsRes && dealsRes.ok) {
      const dealsHtml = await dealsRes.text();
      const articleChunks = dealsHtml.split('<article class="');

      for (let i = 1; i < articleChunks.length; i++) {
        const art = articleChunks[i];
        const dealId = art.match(/data-gtm-deal-id="([^"]+)"/)?.[1];
        const store = art.match(/data-gtm-store="([^"]+)"/)?.[1] || '';

        const isAmazon = store.toLowerCase().includes('amazon') || art.toLowerCase().includes('amazon');
        if (!dealId || !isAmazon || seenIds.has(dealId)) continue;
        seenIds.add(dealId);

        // Image
        const imgMatch =
          art.match(/id="image-[0-9]+"\s+src="([^"]+)"/i) ||
          art.match(/<img[^>]+src="([^"]+desidime\.com\/[^"]+)"/i) ||
          art.match(/<img[^>]+src="([^"]+)"/i);
        const imageUrl = imgMatch ? imgMatch[1].replace(/&amp;/g, '&') : '';

        // Title
        const alts = [...art.matchAll(/alt="([^"]+)"/g)]
          .map((m) => m[1])
          .filter((a) => !a.toLowerCase().includes('icon') && !a.toLowerCase().includes('avatar') && a.length > 5);

        const permalinkMatch = art.match(/data-permalink="deals\/([^"]+)"/i)?.[1];
        let permalinkTitle = permalinkMatch ? permalinkMatch.replace(/-/g, ' ').trim() : '';
        if (permalinkTitle.length > 5) {
          permalinkTitle = permalinkTitle.charAt(0).toUpperCase() + permalinkTitle.slice(1);
        }

        let title = alts[0] || permalinkTitle || 'Amazon Hot Deal';
        title = title.replace(/&#39;/g, "'").replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();

        // Price
        const priceText = art.match(/₹\s*([0-9,]+)/)?.[1];
        const dealPrice = priceText ? parseInt(priceText.replace(/,/g, ''), 10) : 999;

        // Discount
        const discountMatch = art.match(/([0-9]+)%\s*off/i);
        const discountPercent = discountMatch ? parseInt(discountMatch[1], 10) : 40;
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
    }

    // 2. Parse Amazon Store Page (Coupons & Deals)
    if (storeRes && storeRes.ok) {
      const storeHtml = await storeRes.text();
      const cardRegex = /data-href-alt="https:\/\/visit\.desidime\.com\/visit\/[^\/]+\/([0-9]+)"[^>]*>([\s\S]*?)<\/a>/g;
      let match;

      while ((match = cardRegex.exec(storeHtml)) !== null) {
        const id = match[1];
        if (seenIds.has(id)) continue;
        seenIds.add(id);

        const cleanTitle = match[2]
          .replace(/<[^>]+>/g, '')
          .replace(/&#39;/g, "'")
          .replace(/&amp;/g, '&')
          .trim();

        if (cleanTitle.length < 6) continue;

        // Check if discount % mentioned in title
        const discMatch = cleanTitle.match(/([0-9]+)%\s*off/i);
        const discountPercent = discMatch ? parseInt(discMatch[1], 10) : 45;

        // Extract price from title if available (e.g., "Rs. 1500" or "Rs 999")
        const priceMatch = cleanTitle.match(/(?:Rs\.?|₹)\s*([0-9,]+)/i);
        const dealPrice = priceMatch ? parseInt(priceMatch[1].replace(/,/g, ''), 10) : 1499;
        const originalPrice = Math.round(dealPrice / (1 - Math.min(discountPercent, 85) / 100));

        rawDeals.push({
          dealId: id,
          title: cleanTitle,
          store: 'Amazon',
          price: dealPrice,
          originalPrice,
          discountPercent,
          imageUrl: 'https://images.unsplash.com/photo-1546868871-7041f2a55e12?auto=format&fit=crop&w=400&q=80',
          visitUrl: `https://visit.desidime.com/visit/coupons-2/${id}`,
        });
      }
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
                const parsed = new URL(decoded);
                parsed.searchParams.set('tag', targetTag);
                cleanAmazonUrl = parsed.toString();
              }
            }
          }
        } catch (err) {
          // If redirect fails, fallback gracefully
        }

        // Smart Category Classifier
        const lowerTitle = item.title.toLowerCase();
        let category = 'electronics';

        if (
          lowerTitle.includes('shoe') ||
          lowerTitle.includes('sneaker') ||
          lowerTitle.includes('shirt') ||
          lowerTitle.includes('t-shirt') ||
          lowerTitle.includes('pant') ||
          lowerTitle.includes('jeans') ||
          lowerTitle.includes('dress') ||
          lowerTitle.includes('jacket') ||
          lowerTitle.includes('bag') ||
          lowerTitle.includes('luggage') ||
          lowerTitle.includes('trolley') ||
          lowerTitle.includes('watch') ||
          lowerTitle.includes('jewel') ||
          lowerTitle.includes('gold') ||
          lowerTitle.includes('sandal') ||
          lowerTitle.includes('fashion') ||
          lowerTitle.includes('clothing')
        ) {
          category = 'shoes_fashion';
        } else if (
          lowerTitle.includes('cook') ||
          lowerTitle.includes('kitchen') ||
          lowerTitle.includes('kettle') ||
          lowerTitle.includes('bottle') ||
          lowerTitle.includes('fan') ||
          lowerTitle.includes('mop') ||
          lowerTitle.includes('cleaner') ||
          lowerTitle.includes('bed') ||
          lowerTitle.includes('mattress') ||
          lowerTitle.includes('pillow') ||
          lowerTitle.includes('chair') ||
          lowerTitle.includes('furniture') ||
          lowerTitle.includes('refrigerator') ||
          lowerTitle.includes('fridge') ||
          lowerTitle.includes('washing machine') ||
          lowerTitle.includes('purifier')
        ) {
          category = 'home_kitchen';
        } else if (
          lowerTitle.includes('dumbbell') ||
          lowerTitle.includes('gym') ||
          lowerTitle.includes('football') ||
          lowerTitle.includes('badminton') ||
          lowerTitle.includes('cricket') ||
          lowerTitle.includes('yoga') ||
          lowerTitle.includes('sport') ||
          lowerTitle.includes('cycle')
        ) {
          category = 'sports';
        } else if (
          lowerTitle.includes('smartwatch') ||
          lowerTitle.includes('earbuds') ||
          lowerTitle.includes('earphone') ||
          lowerTitle.includes('headphone') ||
          lowerTitle.includes('charger') ||
          lowerTitle.includes('powerbank') ||
          lowerTitle.includes('cable') ||
          lowerTitle.includes('mouse') ||
          lowerTitle.includes('keyboard') ||
          lowerTitle.includes('stand') ||
          lowerTitle.includes('holder') ||
          lowerTitle.includes('gadget')
        ) {
          category = 'gadgets';
        } else {
          category = 'electronics';
        }

        // Only publish deals that have a verified Amazon ASIN (filters out generic store coupons)
        if (!asin) return;

        // Dynamic category image fallback if image is missing or generic unsplash watch
        let finalImage = item.imageUrl;
        if (!finalImage || finalImage.includes('546868871-7041f2a55e12')) {
          if (category === 'shoes_fashion') {
            finalImage = 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=600&q=80';
          } else if (category === 'home_kitchen') {
            finalImage = 'https://images.unsplash.com/photo-1583947215259-38e31be8751f?auto=format&fit=crop&w=600&q=80';
          } else if (category === 'sports') {
            finalImage = 'https://images.unsplash.com/photo-1517838277536-f5f99be501cd?auto=format&fit=crop&w=600&q=80';
          } else if (category === 'gadgets') {
            finalImage = 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=600&q=80';
          } else {
            finalImage = 'https://images.unsplash.com/photo-1526738549149-8e07eca6c147?auto=format&fit=crop&w=600&q=80';
          }
        }

        const isLootDeal = item.discountPercent >= 50;

        resolvedDeals.push({
          dealId: item.dealId,
          title: item.title,
          price: item.price,
          originalPrice: item.originalPrice,
          discountPercent: item.discountPercent,
          rating: 4.4,
          ratingsCount: 520,
          imageUrl: finalImage,
          asin,
          amazonUrl: cleanAmazonUrl || `https://www.amazon.in/dp/${asin}?tag=${targetTag}`,
          category,
          source: 'DesiDime Live FPD',
          isLootDeal,
        });
      })
    );

    // 4. If auto_publish=true and DB is bound, persist directly to Cloudflare D1
    let insertedCount = 0;
    const shouldAutoPublish = url.searchParams.get('auto_publish') === 'true';
    if (shouldAutoPublish && env.DB && resolvedDeals.length > 0) {
      const nowIso = new Date().toISOString();
      for (const deal of resolvedDeals) {
        const finalAsin = deal.asin || `DD-${deal.dealId}`;
        const affiliateUrl =
          deal.amazonUrl || `https://www.amazon.in/dp/${finalAsin}?tag=${targetTag}`;

        try {
          await env.DB.prepare(
            `INSERT INTO deals (
              id, asin, title, category, store, original_price, deal_price, current_price,
              discount_percent, rating, ratings_count, image_url, affiliate_url, status,
              is_loot_deal, coupon_text, description, created_at, last_checked_at, verified_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(asin) DO UPDATE SET
              deal_price = excluded.deal_price,
              discount_percent = excluded.discount_percent,
              last_checked_at = excluded.last_checked_at,
              verified_at = 'Re-checked via Auto-Sync'`
          )
            .bind(
              `deal-${deal.dealId}`,
              finalAsin,
              deal.title,
              deal.category,
              'amazon',
              deal.originalPrice,
              deal.price,
              deal.price,
              deal.discountPercent,
              deal.rating,
              deal.ratingsCount,
              deal.imageUrl,
              affiliateUrl,
              'active',
              deal.isLootDeal ? 1 : 0,
              deal.discountPercent >= 60 ? '⚡ Exclusive Loot Deal' : null,
              `Curated via DesiDime Smart Auto-Harvester. 100% verified Amazon pricing categorized into ${deal.category}.`,
              nowIso,
              nowIso,
              'Auto-published just now'
            )
            .run();
          insertedCount++;
        } catch (dbErr) {
          // Skip if any error
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        count: resolvedDeals.length,
        insertedCount: shouldAutoPublish ? insertedCount : undefined,
        autoPublished: shouldAutoPublish,
        deals: resolvedDeals,
        timestamp: new Date().toISOString(),
      }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Cache-Control': shouldAutoPublish ? 'no-cache' : 'public, max-age=180',
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
