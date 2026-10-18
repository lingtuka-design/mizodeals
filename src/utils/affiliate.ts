import { AFFILIATE_TAG, SITE_URL } from '../config/constants';
import type { Deal } from '../types';

/**
 * Builds an affiliate URL for a given ASIN and store.
 * Always appends the affiliate tag: https://www.amazon.in/dp/{ASIN}?tag=lalmalsawmtlu-21
 */
export function buildAffiliateUrl(asinOrUrl: string, store: Deal['store'] = 'amazon'): string {
  const clean = asinOrUrl.trim();
  const asinMatch = clean.match(/(?:dp|gp\/product|product)\/([A-Z0-9]{10})/i) || clean.match(/^([A-Z0-9]{10})$/i);
  if (asinMatch && asinMatch[1]) {
    return `https://www.amazon.in/dp/${asinMatch[1].toUpperCase()}?tag=${AFFILIATE_TAG}`;
  }
  if (clean.startsWith('http://') || clean.startsWith('https://')) {
    return ensureAffiliateTag(clean);
  }
  if (store === 'amazon') {
    return `https://www.amazon.in/dp/${clean}?tag=${AFFILIATE_TAG}`;
  }
  if (store === 'flipkart') {
    return `https://www.flipkart.com/search?q=${encodeURIComponent(clean)}&affid=${AFFILIATE_TAG}`;
  }
  return `https://www.amazon.in/dp/${clean}?tag=${AFFILIATE_TAG}`;
}

/**
 * Ensures an Amazon URL has the affiliate tag appended properly
 */
export function ensureAffiliateTag(url: string): string {
  try {
    const parsed = new URL(url);
    parsed.searchParams.set('tag', AFFILIATE_TAG);
    return parsed.toString();
  } catch {
    return url.includes('?') 
      ? `${url}&tag=${AFFILIATE_TAG}` 
      : `${url}?tag=${AFFILIATE_TAG}`;
  }
}

/**
 * Builds the canonical Mizodeals landing page URL for a deal
 */
export function getDealLandingUrl(deal: Deal): string {
  const origin = typeof window !== 'undefined' && window.location?.origin ? window.location.origin : SITE_URL;
  return `${origin}/deals/${deal.id}`;
}

/**
 * Generates high-converting pre-filled WhatsApp share copy
 * Uses Mizodeals landing bridge URL to protect Amazon Associates account from dark referrer bans
 */
export function generateWhatsAppDealShareText(deal: Deal): string {
  const savings = deal.originalPrice - deal.dealPrice;
  const savingsFormatted = savings > 0 ? ` (Save ₹${savings.toLocaleString('en-IN')})` : '';
  const lootHeader = deal.isLootDeal 
    ? '🔥 *PRICE TLAHNIAM NASA!* 🔥\n' 
    : '⚡ *PRICE TLAHNIAM!* ⚡\n';

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
  const landingUrl = getDealLandingUrl(deal);

  return (
    `${lootHeader}` +
    `*${title}*\n\n` +
    `💰 Deal Price: *₹${deal.dealPrice.toLocaleString('en-IN')}*` +
    ` ~₹${deal.originalPrice.toLocaleString('en-IN')}~${savingsFormatted}\n` +
    `💥 Discount: *${deal.discountPercent}% OFF*\n` +
    `⭐ Rating: ${deal.rating}/5 (${deal.ratingsCount.toLocaleString('en-IN')}+ reviews)\n` +
    `${deal.couponText ? `🎟️ Coupon: ${deal.couponText}\n` : ''}` +
    `\n` +
    `👉 *Enna leh Leina (Deal Link):*\n${landingUrl}\n\n` +
    `📲 _Shared via Mizodeals • Curated deals for Mizoram & NE_`
  );
}

/**
 * Builds direct WhatsApp Web / App share URL
 */
export function getWhatsAppShareLink(deal: Deal): string {
  const text = generateWhatsAppDealShareText(deal);
  return `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;
}

/**
 * Quick share to WhatsApp directly via window.open
 */
export function shareDealToWhatsApp(deal: Deal): void {
  const url = getWhatsAppShareLink(deal);
  window.open(url, '_blank', 'noopener,noreferrer');
}
