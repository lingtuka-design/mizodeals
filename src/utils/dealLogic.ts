import type { Deal } from '../types';

/**
 * Checks if a deal satisfies the Hot / Loot Deal criteria:
 * - Discount >= 50%
 * - Rating >= 4.0
 * - Ratings Count >= 100
 */
export function isLootDeal(deal: Deal): boolean {
  if (deal.isLootDeal) return true;
  return (
    deal.discountPercent >= 50 &&
    deal.rating >= 4.0 &&
    deal.ratingsCount >= 100
  );
}

/**
 * Checks if a deal is "New" (ingested within the last 6 hours)
 */
export function isNewDeal(deal: Deal, thresholdHours: number = 6): boolean {
  if (!deal.createdAt) return false;
  try {
    const createdTime = new Date(deal.createdAt).getTime();
    const diffMs = Date.now() - createdTime;
    return diffMs >= 0 && diffMs <= thresholdHours * 60 * 60 * 1000;
  } catch {
    return false;
  }
}

/**
 * Checks if a deal is marked expired or if current price has rebounded
 */
export function isDealExpired(deal: Deal): boolean {
  if (deal.status === 'expired') return true;
  if (deal.currentPrice && deal.currentPrice > deal.dealPrice * 1.15) {
    return true;
  }
  return false;
}

/**
 * Formats a clean, readable timestamp in Mizo / English:
 * e.g., "Added 15 mins ago" or "Chhuah thar: 2:10 PM"
 */
export function formatDealTime(dateString: string): string {
  if (!dateString) return 'Live now';
  try {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (60 * 1000));
    const diffHours = Math.floor(diffMins / 60);

    if (diffMins < 5) return 'Added just now';
    if (diffMins < 60) return `Added ${diffMins} mins ago`;
    if (diffHours < 24) {
      const timeStr = date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
      return `Chhuah thar: ${timeStr}`;
    }
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  } catch {
    return 'Recently added';
  }
}

/**
 * Upgrades blurry/low-resolution deal images to crystal-clear high-definition images:
 * 1. If valid Amazon ASIN is present, resolves official Amazon 1000px+ HD image
 * 2. If DealsMagnet thumbnail (-s- / -m-), upgrades to large (-l-)
 * 3. If Amazon media URL with small sizing modifier, upgrades to high-res (_SL800_)
 */
export function getHighResImageUrl(url?: string | null, asin?: string | null, store?: string): string {
  if ((!store || store === 'amazon') && asin && /^[A-Z0-9]{10}$/i.test(asin)) {
    return `https://images-eu.ssl-images-amazon.com/images/P/${asin.toUpperCase()}.01.MAIN._SCRMZZZZZZ_.jpg`;
  }
  if (!url) return '';
  if (url.includes('dealsmagnet.com/images/')) {
    return url.replace('-s-', '-l-').replace('-m-', '-l-');
  }
  if (url.includes('flixcart.com')) {
    return url.replace(/\/image\/\d+\/\d+\//, '/image/612/612/');
  }
  if (url.includes('images-eu.ssl-images-amazon.com') || url.includes('media-amazon.com')) {
    return url.replace(/\._[A-Z0-9_,]+_\./i, '._SL800_.');
  }
  return url;
}
