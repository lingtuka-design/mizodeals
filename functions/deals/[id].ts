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

  const formattedDealPrice = '₹' + deal.dealPrice.toLocaleString('en-IN');
  const formattedOrigPrice = '₹' + deal.originalPrice.toLocaleString('en-IN');
  const discountText = `${deal.discountPercent}% OFF`;
  const savings = deal.originalPrice - deal.dealPrice;
  const savingsText = savings > 0 ? ` (Save ₹${savings.toLocaleString('en-IN')})` : '';

  const ogTitle = `${deal.title} — ${formattedDealPrice} (${discountText})`;
  const ogDescription = `Deal Price: ${formattedDealPrice} ~${formattedOrigPrice}~${savingsText} | ⭐ ${deal.rating}/5 (${deal.ratingsCount.toLocaleString('en-IN')}+ reviews). Exclusive Amazon deal curated on Mizodeals.`;
  const ogImage = deal.imageUrl || 'https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?auto=format&fit=crop&w=1200&q=80';
  const pageTitle = `${deal.title} — Mizodeals`;

  return new HTMLRewriter()
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
