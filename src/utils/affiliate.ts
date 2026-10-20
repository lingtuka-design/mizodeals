import { AFFILIATE_TAG, SITE_URL, STORE_BADGES } from '../config/constants';
import type { Deal } from '../types';

/**
 * Builds an affiliate URL for a given ASIN and store.
 * Always appends the affiliate tag: https://www.amazon.in/dp/{ASIN}?tag=lalmalsawmtlu-21
 */
const EARNKARO_USER_ID = '5730392';
const EARNKARO_FNAME = 'lingtuka';

export function buildAffiliateUrl(asinOrUrl: string, store: Deal['store'] = 'amazon'): string {
  const clean = asinOrUrl.trim();
  if (clean.startsWith('http://') || clean.startsWith('https://')) {
    return ensureAffiliateTag(clean);
  }
  const asinMatch = clean.match(/(?:dp|gp\/product|product)\/([A-Z0-9]{10})/i) || clean.match(/^([A-Z0-9]{10})$/i);
  if (store === 'amazon' && asinMatch && asinMatch[1]) {
    return `https://www.amazon.in/dp/${asinMatch[1].toUpperCase()}?tag=${AFFILIATE_TAG}`;
  }
  if (store === 'flipkart') {
    return `https://earnkaro.com?r=${EARNKARO_USER_ID}&fname=${EARNKARO_FNAME}&url=${encodeURIComponent(`https://www.flipkart.com/search?q=${clean}`)}`;
  }
  if (store === 'myntra') {
    return `https://earnkaro.com?r=${EARNKARO_USER_ID}&fname=${EARNKARO_FNAME}&url=${encodeURIComponent(`https://www.myntra.com/${clean}`)}`;
  }
  if (store === 'nykaa') {
    return `https://earnkaro.com?r=${EARNKARO_USER_ID}&fname=${EARNKARO_FNAME}&url=${encodeURIComponent(`https://www.nykaa.com/search/result/?q=${clean}`)}`;
  }
  if (store === 'ajio') {
    return `https://earnkaro.com?r=${EARNKARO_USER_ID}&fname=${EARNKARO_FNAME}&url=${encodeURIComponent(`https://www.ajio.com/search/?text=${clean}`)}`;
  }
  if (store === 'hm') {
    return `https://earnkaro.com?r=${EARNKARO_USER_ID}&fname=${EARNKARO_FNAME}&url=${encodeURIComponent(`https://www2.hm.com/en_in/search-results.html?q=${clean}`)}`;
  }
  return `https://www.amazon.in/dp/${clean}?tag=${AFFILIATE_TAG}`;
}

/**
 * Ensures an Amazon URL has the affiliate tag appended properly,
 * while safely preserving non-Amazon EarnKaro / converted affiliate links.
 */
export function ensureAffiliateTag(url: string): string {
  // If it's already an EarnKaro, Flipkart shortlink, Myntra shortlink, Nykaa shortlink, or Ajio shortlink, preserve it 100%
  if (
    url.includes('fktr.in') ||
    url.includes('myntr.it') ||
    url.includes('bitli.in') ||
    url.includes('ajiio.in') ||
    url.includes('earnkaro.com') ||
    url.includes('ekaro.in') ||
    (!url.includes('amazon.') && !url.includes('amzn.'))
  ) {
    return url;
  }
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
  const storeLabel = (deal.store && STORE_BADGES[deal.store]?.name) || 'Amazon.in';

  return (
    `${lootHeader}` +
    `*${title}*\n\n` +
    `💰 Deal Price: *₹${deal.dealPrice.toLocaleString('en-IN')}*` +
    ` ~₹${deal.originalPrice.toLocaleString('en-IN')}~${savingsFormatted}\n` +
    `💥 Discount: *${deal.discountPercent}% OFF*\n` +
    `🏬 Store: *${storeLabel}*\n` +
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
