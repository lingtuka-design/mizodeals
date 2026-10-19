import type { Deal } from '../../src/types';
import { INITIAL_DEALS } from '../../src/data/deals';

interface Env {
  DB: D1Database;
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { env, params, request } = context;
  const dealId = params.id as string;

  let deal: Deal | undefined;

  // 1. Fetch deal from D1 Database
  if (env.DB) {
    try {
      const row: any = await env.DB.prepare(
        'SELECT * FROM deals WHERE id = ? OR asin = ? LIMIT 1'
      )
        .bind(dealId, dealId)
        .first();

      if (row) {
        deal = {
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
        };
      }
    } catch (e) {
      console.error('Error fetching deal for OG metadata:', e);
    }
  }

  // 2. Fallback to static seed deals
  if (!deal) {
    deal = INITIAL_DEALS.find((d) => d.id === dealId || d.asin === dealId);
  }

  // Fetch compiled index.html
  const response = await context.next();

  if (!deal) {
    return response;
  }

  const cleanTitle = (str: string) =>
    str
      .replace(/&amp;/g, '&')
      .replace(/&quot;/g, '"')
      .replace(/&#8377;/g, '₹')
      .replace(/&#39;/g, "'")
      .replace(/&nbsp;/g, ' ')
      .replace(/buy\s+max\s+q(?:nty|ty)\s*:?/gi, '')
      .replace(/^[:\s\-\.\,]+|[:\s\-\.\,]+$/g, '')
      .trim();

  const title = cleanTitle(deal.title);
  const formattedDealPrice = '₹' + deal.dealPrice.toLocaleString('en-IN');
  const formattedOrigPrice = '₹' + deal.originalPrice.toLocaleString('en-IN');
  const discountText = `${deal.discountPercent}% OFF`;
  const savings = deal.originalPrice - deal.dealPrice;
  const savingsText = savings > 0 ? ` (Save ₹${savings.toLocaleString('en-IN')})` : '';

  const ogTitle = `${title} — ${formattedDealPrice} (${discountText})`;
  const ogDescription = `Deal Price: ${formattedDealPrice} ~${formattedOrigPrice}~${savingsText} | ⭐ ${deal.rating}/5 (${deal.ratingsCount.toLocaleString('en-IN')}+ reviews). Exclusive Amazon deal curated on Mizodeals.`;
  const rawImg = deal.imageUrl || '';
  const hdImg = rawImg.includes('dealsmagnet.com/images/') && rawImg.includes('-s-')
    ? rawImg.replace('-s-', '-m-')
    : rawImg;

  const ogImage =
    hdImg && !hdImg.includes('unsplash.com') && hdImg.length > 15
      ? hdImg
      : deal.asin && deal.asin.length === 10 && !deal.asin.startsWith('DM')
      ? `https://images-eu.ssl-images-amazon.com/images/P/${deal.asin.toUpperCase()}.01.MAIN._SCRMZZZZZZ_.jpg`
      : 'https://mizodeals.com/logo.png';
  const pageTitle = `${title} — Mizodeals`;

  return new HTMLRewriter()
    .on('head', {
      element(el) {
        el.append(
          `<meta property="og:image:width" content="1200" /><meta property="og:image:height" content="630" /><meta property="og:image:type" content="image/jpeg" />`,
          { html: true }
        );
      },
    })
    .on('title', {
      element(el) {
        el.setInnerContent(pageTitle);
      },
    })
    .on('meta[name="description"]', {
      element(el) {
        el.setAttribute('content', ogDescription);
      },
    })
    .on('meta[property="og:title"]', {
      element(el) {
        el.setAttribute('content', ogTitle);
      },
    })
    .on('meta[property="og:description"]', {
      element(el) {
        el.setAttribute('content', ogDescription);
      },
    })
    .on('meta[property="og:image"]', {
      element(el) {
        el.setAttribute('content', ogImage);
      },
    })
    .on('meta[property="og:url"]', {
      element(el) {
        el.setAttribute('content', request.url);
      },
    })
    .on('meta[property="twitter:title"]', {
      element(el) {
        el.setAttribute('content', ogTitle);
      },
    })
    .on('meta[property="twitter:description"]', {
      element(el) {
        el.setAttribute('content', ogDescription);
      },
    })
    .on('meta[property="twitter:image"]', {
      element(el) {
        el.setAttribute('content', ogImage);
      },
    })
    .on('meta[property="twitter:url"]', {
      element(el) {
        el.setAttribute('content', request.url);
      },
    })
    .transform(response);
};
