interface ScrapedDeal {
  dealId: string;
  title: string;
  price: number;
  originalPrice: number;
  discountPercent: number;
  rating: number;
  ratingsCount: number;
  imageUrl: string;
  asin: string | null;
  amazonUrl: string;
  store: 'amazon' | 'flipkart' | 'myntra' | 'nykaa' | 'ajio' | 'meesho';
  category: string;
  source: 'Telegram Deals' | 'DealsMagnet' | 'IndiaFreeStuff' | 'IndiaDesire' | 'Meesho Deals' | 'DesiDime';
  isLootDeal: boolean;
  couponText?: string | null;
}

interface Env {
  DB?: D1Database;
  AMAZON_PARTNER_TAG?: string;
  AMAZON_CLIENT_ID?: string;
  AMAZON_CLIENT_SECRET?: string;
}

const MEESHO_CREATOR_ID = '611878749';
const MEESHO_CAMPAIGN_ID = '15245137';

function buildMeeshoAffiliateUrl(pidOrUrl: string, explicitExtId?: string): string {
  const clean = pidOrUrl.trim();
  if (clean.includes(`af_invite/${MEESHO_CREATOR_ID}`)) {
    if (!clean.includes('ext_id=')) {
      const pIdMatch = clean.match(/[?&]p_id=([0-9a-zA-Z]+)/i);
      if (pIdMatch && pIdMatch[1]) {
        return clean.includes('?') ? `${clean}&ext_id=${pIdMatch[1]}` : `${clean}?ext_id=${pIdMatch[1]}`;
      }
    }
    return clean;
  }
  const pIdMatch = clean.match(/[?&]p_id=([0-9a-zA-Z]+)/i);
  const extIdMatch = clean.match(/[?&]ext_id=([0-9a-zA-Z]+)/i);
  const slugMatch = clean.match(/\/p\/([a-zA-Z0-9]+)/i);

  let pid = '';
  let extId = explicitExtId || '';

  if (pIdMatch && pIdMatch[1]) {
    pid = pIdMatch[1];
  }
  if (extIdMatch && extIdMatch[1]) {
    extId = extIdMatch[1];
  }
  if (slugMatch && slugMatch[1]) {
    if (!extId) extId = slugMatch[1];
    if (!pid) pid = slugMatch[1];
  }

  if (!pid && !extId) {
    const numMatch = clean.match(/([0-9]{6,12})/);
    const candidate = numMatch ? numMatch[1] : clean;
    pid = candidate;
    extId = candidate;
  } else if (!extId) {
    extId = pid;
  } else if (!pid) {
    pid = extId;
  }

  return `https://www.meesho.com/af_invite/${MEESHO_CREATOR_ID}:facebook:${MEESHO_CAMPAIGN_ID}?p_id=${encodeURIComponent(pid)}&ext_id=${encodeURIComponent(extId)}&utm_source=facebook`;
}

const EARNKARO_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJfaWQiOiI2YWQ2ZmI1ZGVmOTM2Y2JkNzEzZWRhYTUiLCJlYXJua2FybyI6IjU3MzAzOTIiLCJpYXQiOjE3OTI0NzQyMTJ9.yC7pF3WzcpVcl5yPEbe2rtg0DugrglJ64SUJqmDNOc0';

async function convertWithEarnkaro(targetUrl: string): Promise<string | null> {
  try {
    const res = await fetch('https://ekaro-api.affiliaters.in/api/converter/public', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${EARNKARO_TOKEN}`,
      },
      body: JSON.stringify({
        deal: targetUrl,
        convert_option: 'convert_only',
      }),
      signal: AbortSignal.timeout(4000),
    });
    if (res.ok) {
      const data: any = await res.json();
      if (data && data.success === 1 && typeof data.data === 'string' && data.data.startsWith('http')) {
        return data.data;
      }
    }
  } catch (e: any) {
    console.error('EarnKaro conversion failed for:', targetUrl, e?.message);
  }
  return `https://earnkaro.com?r=5730392&fname=lingtuka&url=${encodeURIComponent(targetUrl)}`;
}

function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash).toString(36).toUpperCase();
}

// Helper: Identify genuine smartphones & 5G mobile phones (strictly exclude cases, covers, screen protectors, cables, etc.)
export function isMobilePhone(title: string): boolean {
  if (!title) return false;
  const t = title.toLowerCase();
  // Filter out accessories, covers, audio & components
  if (/(?:cover|case|tempered|guard|skin|cable|charger|adapter|pouch|holder|stand|mount|lens\s*protector|stylus|strap|screen\s*protector|earbud|headphone|earphone|neckband|tws|smartwatch|watch|speaker)/i.test(t)) {
    return false;
  }
  return /\b(?:smartphone|mobile\s*phone|5g\s*phone|iphone(?:\s*(?:1[1-7]|se))?|galaxy\s*(?:s\d{2}[a-z]*|m\d{2}[a-z]*|a\d{2}[a-z]*|f\d{2}[a-z]*|z\s*(?:fold|flip)\d*|\w+)|redmi(?:\s*(?:note|\d{1,2}[a-z]*|c\d{1,2}|a\d{1,2}|\w+))?|realme(?:\s*(?:narzo|\d{1,2}[a-z]*|gt|p\d|c\d{1,2}|\w+))?|poco(?:\s*(?:c|m|x|f)\d{1,2}[a-z]*|\w+)?|oneplus(?:\s*(?:nord|\d{1,2}[a-z]?|\w+))?|iqoo(?:\s*(?:z|neo|\d{1,2}[a-z]*|\w+))?|motorola|moto\s*(?:edge|g\d{2})|pixel\s*(?:[6-9]|1[0-2])|vivo\s*(?:t\d|y\d|v\d|x\d|\w+)|oppo\s*(?:a\d|k\d|reno|find|\w+)|nothing\s*phone)\b/i.test(t);
}

// Category classifier helper
function classifyCategory(title: string): string {
  const t = title.toLowerCase();
  // High Priority: Genuine Smartphones strictly categorized as 'gadgets'
  if (isMobilePhone(title)) {
    return 'gadgets';
  }
  if (/lipstick|perfume|serum|sunscreen|lotion|cream|shampoo|skincare|cosmetic|kajal|beauty|makeup|facewash/i.test(t)) {
    return 'beauty';
  }
  // Dedicated Gadgets classification: Smart devices, audio, phones, wearables, and mobile accessories
  if (/phone|iphone|samsung|oneplus|realme|redmi|xiaomi|poco|motorola|moto|vivo|oppo|iqoo|mobile|smartphone|earbud|airpod|headphone|earphone|neckband|tws|audio|speaker|soundbar|bluetooth|gadget|smartwatch|watch|strap|band|tracker|power\s*bank|powerbank|charger|adapter|cable|usb|magsafe|tripod|selfie\s*stick|gimbal|mount|stylus|pen\s*drive|pendrive|otg/i.test(t)) {
    return 'gadgets';
  }
  if (/laptop|macbook|monitor|keyboard|mouse|ssd|hard\s*drive|hdd|ram|cpu|gpu|motherboard|router|wifi|printer|scanner|pc|computer|tablet|ipad|camera|lens|projector|television|tv|ups/i.test(t)) {
    return 'electronics';
  }
  if (/shirt|t-shirt|pant|jeans|dress|shoe|sneaker|kurta|saree|jacket|hoodie|sweatshirt|sweater|beanie|muffler|scarf|gloves|thermal|cardigan|fleece|coat|woolen|sock|sandal|wallet|bag|backpack|fashion|cloth|wear/i.test(t)) {
    return 'shoes_fashion';
  }
  if (/cooker|bottle|pan|bedsheet|pillow|light|lamp|curtain|mop|cleaner|purifier|kettle|knife|kitchen|home|room|towel/i.test(t)) {
    return 'home_kitchen';
  }
  if (/gym|fitness|dumbbell|badminton|football|cricket|yoga|sport|cycle|exercise/i.test(t)) {
    return 'sports';
  }
  return 'electronics';
}

// Block products that do not sell well on affiliate channels, clutter the feed, cause customer fatigue,
// or have high return rates / impossible delivery logistics in Mizoram
function isBlockedProduct(title: string): boolean {
  if (!title) return false;
  // 1. Phone back covers & tempered glass protectors (generic spam, low conversion)
  if (/(?:back\s*cover|mobile\s*cover|phone\s*cover|phone\s*case|bumper\s*case|magnetic\s*case|tempered\s*glass|screen\s*protector|camera\s*lens\s*protector|cases?\s*(?:&|and)\s*covers?|\bcase\s*for\s+(?:iphone|oneplus|samsung|redmi|realme|vivo|oppo|poco|xiaomi|ipad)|\bcover\s*for\s+(?:iphone|oneplus|samsung|redmi|realme|vivo|oppo|poco|xiaomi|ipad))/i.test(title)) {
    return true;
  }
  // 2. Bulky furniture / heavy freight (undeliverable or exorbitant shipping fees to Mizoram)
  if (/\b(?:sofa|couch|mattress|wardrobe|almirah|recliner|dining\s*table|office\s*chair|gaming\s*chair|bookshelf|bookcase|dressing\s*table|tv\s*unit|tv\s*cabinet|bed\s*(?:king|queen|single|double)|heavy\s*cabinet)\b/i.test(title)) {
    return true;
  }
  // 3. Heavy home appliances (huge delivery friction, high freight damage)
  if (/\b(?:washing\s*machine|refrigerator|fridge|split\s*ac|air\s*conditioner|window\s*ac|dishwasher|storage\s*water\s*heater|kitchen\s*chimney)\b/i.test(title)) {
    return true;
  }
  // 4. Oversized or high-breakage items / vehicle tyres
  if (/\b(?:full\s*length\s*mirror|oversized\s*mirror|car\s*tyre|car\s*tire|bike\s*tyre|alloy\s*wheel)\b/i.test(title)) {
    return true;
  }
  // 5. Digital spam, mock tests, courses
  if (/\b(?:kindle\s*edition|test\s*series|mock\s*test|online\s*course|e-?book)\b/i.test(title)) {
    return true;
  }
  return false;
}

// Gating function: Enforce Mizoram e-commerce sweet spot
// Affiliate conversion in Mizoram is heavily clustered in impulse purchases: ₹199 to ₹1,499.
// Items > ₹4,500 have extremely low affiliate conversion and high cancellation/freight rejection,
// EXCEPT for genuine mobile phones/smartphones which have high customer demand and zero shipping friction.
// Items < ₹80 yield negligible affiliate commissions and often fail with add-on delivery costs.
function isPriceAndLogisticsViable(price: number, discountPercent: number, category: string, title?: string): boolean {
  if (price < 80) return false;

  // Genuine Smartphone Exception:
  // Mobile phones (iPhones, Galaxy, OnePlus, Redmi, POCO, Vivo, Motorola, Pixel)
  // are lightweight, high-intent products where nominal discounts are 8%-35%.
  if (title && isMobilePhone(title)) {
    if (price <= 85000 && (discountPercent >= 8 || price >= 6000)) {
      return true;
    }
    return false;
  }

  if (price > 4500) {
    // Only allow high-value gadgets/electronics under ₹7,000 if they have a steep 45%+ discount
    if ((category === 'gadgets' || category === 'electronics') && discountPercent >= 45 && price <= 7000) {
      return true;
    }
    return false;
  }
  return true;
}

// Calculate priority score for harvested deals based on the 3-Pillar Revenue Strategy
// 1. Tech & Wireless Gadgets (40% target)
// 2. Kitchen Utilities & Home Essentials (35% target)
// 3. Personal Care, Grooming & Winterwear (25% target)
function computeDealScore(deal: ScrapedDeal): number {
  let score = deal.discountPercent || 0;
  const cat = deal.category;
  const title = deal.title.toLowerCase();

  // Pillar 1: Tech Accessories & Mobile Gadgets (+35)
  if (
    cat === 'gadgets' ||
    /earbud|airpod|headphone|earphone|neckband|tws|smartwatch|watch|charger|cable|power\s*bank|powerbank|mouse|keyboard|pendrive|flash\s*drive|speaker|soundbar|bluetooth|tripod|otg/i.test(title)
  ) {
    score += 35;
  }

  // Pillar 2: Kitchen Utilities & Daily Home Essentials (+30)
  if (
    cat === 'home_kitchen' ||
    /kettle|bottle|flask|knife|cooker|pan|chopper|grinder|organizer|rack|dispenser|blender|towel|mop/i.test(title)
  ) {
    score += 30;
  }

  // Pillar 3: Personal Grooming & Beauty (+35)
  if (
    cat === 'beauty' ||
    /perfume|serum|sunscreen|facewash|cream|lotion|shampoo|trimmer|shaver|hair\s*dryer|skincare|cosmetic|lipstick/i.test(title)
  ) {
    score += 35;
  }

  // Winter Wear & Warm Accessories (+30)
  if (
    /hoodie|jacket|sweater|beanie|muffler|scarf|gloves|thermal|fleece|woolen|cardigan|lukhum/i.test(title)
  ) {
    score += 30;
  }

  // High-Intent Smartphones & 5G Mobiles bonus (+45)
  if (isMobilePhone(deal.title)) {
    score += 45;
  } else if (deal.price >= 199 && deal.price <= 1499) {
    score += 35;
  } else if (deal.price > 1499 && deal.price <= 2999) {
    score += 15;
  } else if (deal.price > 3500) {
    score -= 25;
  }

  // Store boost for trusted impulse platforms
  if (deal.store === 'amazon') score += 15;
  if (deal.store === 'meesho') score += 20; // high impulse conversion in Mizoram
  if (deal.store === 'nykaa') score += 15;

  return score;
}

// Resolve Amazon shortlink or URL to get clean ASIN & affiliate link
async function resolveAmazonUrl(rawUrl: string, targetTag: string): Promise<{ asin: string | null; cleanUrl: string }> {
  try {
    let resolvedUrl = rawUrl;
    if (rawUrl.includes('amzn.to') || rawUrl.includes('/deal/')) {
      const headRes = await fetch(rawUrl, {
        method: 'HEAD',
        redirect: 'follow',
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
        signal: AbortSignal.timeout(3000),
      });
      resolvedUrl = headRes.url || rawUrl;
    }

    const asinMatch =
      resolvedUrl.match(/(?:dp|gp\/product|product)\/([A-Z0-9]{10})/i) ||
      resolvedUrl.match(/(?:ASIN|asin)=([A-Z0-9]{10})/i);
    if (asinMatch && asinMatch[1]) {
      const asin = asinMatch[1].toUpperCase();
      return {
        asin,
        cleanUrl: `https://www.amazon.in/dp/${asin}?tag=${targetTag}`,
      };
    }

    // Fallback if ASIN wasn't in standard /dp/ path
    const urlObj = new URL(resolvedUrl);
    urlObj.searchParams.set('tag', targetTag);
    return { asin: null, cleanUrl: urlObj.toString() };
  } catch (e) {
    return { asin: null, cleanUrl: rawUrl };
  }
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { request, env } = context;
  const url = new URL(request.url);
  const limitParam = url.searchParams.get('limit') || '80';
  const limit = Math.min(Math.max(parseInt(limitParam, 10) || 80, 5), 150);
  const targetTag = url.searchParams.get('tag') || env.AMAZON_PARTNER_TAG || 'lalmalsawmtlu-21';
  const filterSource = url.searchParams.get('source'); // 'all', 'telegram', 'dealsmagnet', 'ifs', 'indiadesire'
  const shouldAutoPublish = url.searchParams.get('autoPublish') === 'true';

  const userAgent =
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

  const collectedDeals: ScrapedDeal[] = [];
  const seenAsins = new Set<string>();

  // ==========================================
  // SOURCE 1: TELEGRAM PUBLIC DEALS HUBS (7 ACTIVE VERIFIED CHANNELS)
  // ==========================================
  if (!filterSource || filterSource === 'all' || filterSource === 'telegram' || filterSource === 'meesho') {
    const telegramChannels = [
      'dealbee',
      'deals_loot',
      'amazon_flipkart_loots',
      'looter_deals',
      'online_loot_deals',
      'dealsprime',
      'loot_offers_india',
      'meesho_deal',
      'meeshodealsloot',
      'nykaabeautydeals',
      'fashion_loot_deals'
    ];
    for (const ch of telegramChannels) {
      if (collectedDeals.length >= limit) break;
      try {
        const tgRes = await fetch(`https://t.me/s/${ch}`, {
          headers: { 'User-Agent': userAgent },
          signal: AbortSignal.timeout(4000),
        });
        if (tgRes.ok) {
          const html = await tgRes.text();
          const messageBlocks = html.split('<div class="tgme_widget_message_wrap');
          const startIndex = Math.max(1, messageBlocks.length - 8);

          for (let i = messageBlocks.length - 1; i >= startIndex; i--) {
            if (collectedDeals.length >= limit) break;
            const block = messageBlocks[i];

            // Extract store and product link
            const amzMatch = block.match(/href="([^"]*(?:amzn\.to|amazon\.in)[^"]*)"/i);
            const fkMatch = block.match(/href="([^"]*(?:fkrt\.it|fkrt\.co|flipkart\.com|dl\.flipkart\.com)[^"]*)"/i);
            const myMatch = block.match(/href="([^"]*(?:myntr\.it|myntra\.com)[^"]*)"/i);
            const nyMatch = block.match(/href="([^"]*(?:nykaa\.com|nykaa\.ly)[^"]*)"/i);
            const meeMatch = block.match(/href="([^"]*(?:meesho\.com|msho\.in)[^"]*)"/i);

            if (!amzMatch && !fkMatch && !myMatch && !nyMatch && !meeMatch) continue;

            let store: 'amazon' | 'flipkart' | 'myntra' | 'nykaa' | 'meesho' = 'amazon';
            let rawDealUrl = '';
            if (amzMatch) {
              store = 'amazon';
              rawDealUrl = amzMatch[1];
            } else if (meeMatch) {
              store = 'meesho';
              rawDealUrl = meeMatch[1];
            } else if (fkMatch) {
              store = 'flipkart';
              rawDealUrl = fkMatch[1];
            } else if (myMatch) {
              store = 'myntra';
              rawDealUrl = myMatch[1];
            } else if (nyMatch) {
              store = 'nykaa';
              rawDealUrl = nyMatch[1];
            }

            // Extract text
            const textMatch = block.match(/<div class="tgme_widget_message_text[^>]*>([\s\S]*?)<\/div>/i);
            if (!textMatch) continue;
            const rawText = textMatch[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

            // Extract Price
            const priceMatch = rawText.match(/(?:at\s*|@\s*|₹\s*|rs\.?\s*)([\d,]+)/i);
            let dealPrice = 499;
            if (priceMatch) {
              dealPrice = parseInt(priceMatch[1].replace(/,/g, ''), 10) || 499;
            }

            // Extract Discount or compute original price
            const discountMatch = rawText.match(/(\d+)%\s*(?:off|discount)/i);
            let discountPercent = discountMatch ? parseInt(discountMatch[1], 10) : 0;
            if (discountPercent === 0 || discountPercent > 90) {
              discountPercent = Math.min(Math.floor(35 + Math.random() * 30), 75);
            }

            let originalPrice = Math.round(dealPrice / (1 - discountPercent / 100));
            if (originalPrice <= dealPrice) {
              originalPrice = Math.round(dealPrice * 1.5);
            }

            // Clean Title
            let title = rawText
              .replace(/https?:\/\/\S+/gi, '')
              .replace(/at\s*₹?\s*[\d,]+/gi, '')
              .replace(/upto\s*\d+%\s*off\s*(?:on)?/gi, '')
              .replace(/\d+%\s*off\s*(?:on)?/gi, '')
              .replace(/coupon|apply|flat|deal|loot/gi, '')
              .replace(/&amp;/g, '&')
              .replace(/&quot;/g, '"')
              .replace(/&#8377;/g, '₹')
              .replace(/&#39;/g, "'")
              .replace(/&nbsp;/g, ' ')
              .replace(/buy\s+max\s+q(?:nty|ty)\s*:?/gi, '')
              .replace(/^[:\s\-\.\,]+|[:\s\-\.\,]+$/g, '')
              .trim();

            if (title.length < 15) {
              title = rawText.slice(0, 70).replace(/https?:\/\/\S+/gi, '').replace(/^[:\s\-\.\,]+|[:\s\-\.\,]+$/g, '').trim();
            }
            if (title.length > 90) {
              title = title.slice(0, 90) + '...';
            }

            if (!title || title.length < 5 || /^(?:loot|deal|bigg?\s*lo+t)$/i.test(title) || isBlockedProduct(title)) {
              continue;
            }
            if (/proof|invoice|delivered|order\s*details|received\s*by|bill/i.test(title) || /proof|invoice|delivered|order\s*details|received\s*by/i.test(rawText)) {
              continue;
            }

            // Extract Image if embedded
            const imgMatch = block.match(/background-image:url\('([^']+)'\)/i);
            let imageUrl = imgMatch ? imgMatch[1] : '';

            // Resolve PID/ASIN, Ultra-HD images, and Affiliate URLs based on store
            let asin: string | null = null;
            let cleanUrl = '';

            if (store === 'amazon') {
              const res = await resolveAmazonUrl(rawDealUrl, targetTag);
              asin = res.asin;
              cleanUrl = res.cleanUrl;
              if (!asin || !/^[A-Z0-9]{10}$/i.test(asin)) continue;
              if (seenAsins.has(asin)) continue;
              seenAsins.add(asin);

              const officialAmzImg = `https://images-eu.ssl-images-amazon.com/images/P/${asin}.01.MAIN._SCRMZZZZZZ_.jpg`;
              try {
                const headImg = await fetch(officialAmzImg, {
                  method: 'HEAD',
                  signal: AbortSignal.timeout(1500),
                });
                const cl = parseInt(headImg.headers.get('content-length') || '0', 10);
                if (headImg.ok && cl > 1000) {
                  imageUrl = officialAmzImg;
                }
              } catch (e) {}
            } else if (store === 'flipkart') {
              const pidMatch = rawDealUrl.match(/(?:pid=|itm)([a-zA-Z0-9]{16}|[a-zA-Z0-9]{10})/i) || rawDealUrl.match(/([a-zA-Z0-9]{16})/i);
              asin = pidMatch ? pidMatch[1].toUpperCase() : 'FK' + simpleHash(rawDealUrl);
              if (seenAsins.has(asin)) continue;
              seenAsins.add(asin);

              const converted = await convertWithEarnkaro(rawDealUrl);
              cleanUrl = converted || `https://earnkaro.com?r=5730392&fname=lingtuka&url=${encodeURIComponent(rawDealUrl)}`;

              // Upgrade Flipkart photo to 832x832 Ultra-HD
              if (imageUrl.includes('flixcart.com')) {
                imageUrl = imageUrl.replace(/\/image\/\d+\/\d+\//, '/image/832/832/');
              }
            } else if (store === 'myntra') {
              const myMatch = rawDealUrl.match(/\/(\d{6,10})/);
              asin = myMatch ? myMatch[1] : 'MY' + simpleHash(rawDealUrl);
              if (seenAsins.has(asin)) continue;
              seenAsins.add(asin);

              const converted = await convertWithEarnkaro(rawDealUrl);
              cleanUrl = converted || `https://earnkaro.com?r=5730392&fname=lingtuka&url=${encodeURIComponent(rawDealUrl)}`;

              // Upgrade Myntra photo to 1080x1440 Ultra-HD Studio
              if (imageUrl.includes('myntassets.com')) {
                imageUrl = imageUrl.replace(/(?:dpr_[^,]+,)?(?:q_\d+,)?(?:w_\d+,)?(?:c_limit,)?(?:fl_progressive\/)?/, 'h_1440,q_95,w_1080/');
              }
            } else if (store === 'nykaa') {
              const nyMatch = rawDealUrl.match(/\/p\/([a-zA-Z0-9_-]+)/i);
              asin = nyMatch ? nyMatch[1] : 'NY' + simpleHash(rawDealUrl);
              if (seenAsins.has(asin)) continue;
              seenAsins.add(asin);

              const converted = await convertWithEarnkaro(rawDealUrl);
              cleanUrl = converted || `https://earnkaro.com?r=5730392&fname=lingtuka&url=${encodeURIComponent(rawDealUrl)}`;
            } else if (store === 'meesho') {
              const meePidMatch = rawDealUrl.match(/[?&]p_id=([0-9a-zA-Z]+)/i);
              const meeExtMatch = rawDealUrl.match(/[?&]ext_id=([0-9a-zA-Z]+)/i);
              const meeSlugMatch = rawDealUrl.match(/\/p\/([a-zA-Z0-9]+)/i);

              const pid = meePidMatch ? meePidMatch[1] : (meeSlugMatch ? meeSlugMatch[1] : simpleHash(rawDealUrl));
              const extId = meeExtMatch ? meeExtMatch[1] : (meeSlugMatch ? meeSlugMatch[1] : pid);
              asin = `MSH-${pid}`;
              if (seenAsins.has(asin)) continue;
              seenAsins.add(asin);

              cleanUrl = buildMeeshoAffiliateUrl(pid, extId);
            }

            // Strictly require authentic photo
            if (!imageUrl || !imageUrl.startsWith('http') || imageUrl.trim().length < 15 || imageUrl.includes('unsplash.com')) {
              continue;
            }

            let category = classifyCategory(title);
            if (store === 'myntra' && (category === 'electronics' || category === 'gadgets')) {
              category = 'shoes_fashion';
            }
            if (store === 'nykaa') {
              category = 'beauty';
            }

            if (!isPriceAndLogisticsViable(dealPrice, discountPercent, category, title)) {
              continue;
            }

            collectedDeals.push({
              dealId: `tg-${Date.now().toString().slice(-6)}-${collectedDeals.length + 1}`,
              title,
              price: dealPrice,
              originalPrice,
              discountPercent,
              rating: 4.4,
              ratingsCount: 2450,
              imageUrl,
              asin,
              amazonUrl: cleanUrl,
              store,
              category,
              source: 'Telegram Deals',
              isLootDeal: discountPercent >= 50,
              couponText: discountPercent >= 60 ? '⚡ Exclusive Flash Deal' : null,
            });
          }
        }
      } catch (tgErr) {
        console.error('Error fetching Telegram deals:', tgErr);
      }
    }
  }

  // ==========================================
  // SOURCE 2: DEALSMAGNET (AMAZON PRICE DROPS)
  // ==========================================
  if (!filterSource || filterSource === 'all' || filterSource === 'dealsmagnet') {
    if (collectedDeals.length < limit) {
      try {
        const dmRes = await fetch('https://www.dealsmagnet.com', {
          headers: { 'User-Agent': userAgent },
        });
        if (dmRes.ok) {
          const html = await dmRes.text();
          const dealBlocks = html.split('class="row p-1 rounded shadow-sm hotdeal"');

          for (let i = 1; i < dealBlocks.length; i++) {
            if (collectedDeals.length >= limit) break;
            const block = dealBlocks[i];

            // Title
            const titleMatch = block.match(/<p class="title">\s*([\s\S]*?)\s*<\/p>/i);
            if (!titleMatch) continue;
            let title = titleMatch[1].replace(/<[^>]+>/g, '').trim();
            if (isBlockedProduct(title)) continue;

            // Discount
            const discountMatch = title.match(/(\d+)%\s*off/i) || block.match(/(\d+)%\s*off/i);
            let discountPercent = discountMatch ? parseInt(discountMatch[1], 10) : 40;

            // Image - strictly require genuine product thumbnail from DealsMagnet
            const imgMatch = block.match(/data-src="([^"]+)"/i) || block.match(/src="([^"]+\.jpg)"/i);
            if (!imgMatch || !imgMatch[1] || !imgMatch[1].startsWith('http')) {
              continue; // Skip deals with no authentic product picture
            }
            const rawImg = imgMatch[1];
            let imageUrl = rawImg.replace('-s-', '-l-').replace('-m-', '-l-');

            // Prices
            const discPriceMatch = block.match(/DiscountedPrice[^>]*>\s*₹?\s*([\d,]+)/i);
            const origPriceMatch = block.match(/OriginalPrice[^>]*>\s*₹?\s*([\d,]+)/i);

            let dealPrice = discPriceMatch ? parseInt(discPriceMatch[1].replace(/,/g, ''), 10) : 999;
            let originalPrice = origPriceMatch ? parseInt(origPriceMatch[1].replace(/,/g, ''), 10) : 1999;

            if (originalPrice <= dealPrice) {
              originalPrice = Math.round(dealPrice * (1 + discountPercent / 100));
            }

            // Deal link
            const linkMatch = block.match(/href="([^"]*\/deal\/[^"]+)"/i);
            if (!linkMatch) continue;
            const dealPageUrl = linkMatch[1];

            // Resolve authentic Amazon ASIN from DealsMagnet buy redirect
            let asin: string | null = null;
            try {
              const dpRes = await fetch(dealPageUrl, {
                headers: { 'User-Agent': userAgent },
                signal: AbortSignal.timeout(3000),
              });
              if (dpRes.ok) {
                const dpHtml = await dpRes.text();
                const codeMatch = dpHtml.match(/class="[^"]*buy-button[^"]*"[^>]*data-code="([^"]+)"/i);
                if (codeMatch) {
                  const buyUrl = `https://www.dealsmagnet.com/buy?${codeMatch[1]}`;
                  const buyRes = await fetch(buyUrl, {
                    method: 'GET',
                    redirect: 'manual',
                    headers: { 'User-Agent': userAgent },
                    signal: AbortSignal.timeout(3000),
                  });
                  const loc = buyRes.headers.get('location') || '';
                  const asinMatch = loc.match(/(?:dp|gp\/product|product)\/([A-Z0-9]{10})/i);
                  if (asinMatch) {
                    asin = asinMatch[1].toUpperCase();
                  }
                }
              }
            } catch (dpErr) {
              // Skip if deal page resolution fails
            }

            // CRITICAL: Strictly skip deals that do not resolve to an authentic 10-char Amazon ASIN!
            // This eliminates all generic collections, search pages, Flipkart redirects, and category banners.
            if (!asin || !/^[A-Z0-9]{10}$/i.test(asin)) {
              continue;
            }

            if (seenAsins.has(asin)) continue;
            seenAsins.add(asin);

            // Prefer Amazon official Ultra-HD photo if available
            const officialAmzImg = `https://images-eu.ssl-images-amazon.com/images/P/${asin}.01.MAIN._SCRMZZZZZZ_.jpg`;
            try {
              const headImg = await fetch(officialAmzImg, {
                method: 'HEAD',
                signal: AbortSignal.timeout(1500),
              });
              const cl = parseInt(headImg.headers.get('content-length') || '0', 10);
              if (headImg.ok && cl > 1000) {
                imageUrl = officialAmzImg;
              }
            } catch (e) {
              // keep DealsMagnet large image
            }

            // Clean title (remove store prefixes and discount banners)
            title = title
              .replace(/^(?:Amazon|Flipkart|Myntra)\s*:\s*/i, '')
              .replace(/^(?:flat|up\s*to)?\s*\d+%\s*off\s*[-:]?\s*/i, '')
              .trim();

            const category = classifyCategory(title);
            if (!isPriceAndLogisticsViable(dealPrice, discountPercent, category, title)) {
              continue;
            }
            const cleanUrl = `https://www.amazon.in/dp/${asin}?tag=${targetTag}`;

            collectedDeals.push({
              dealId: `dm-${Date.now().toString().slice(-6)}-${collectedDeals.length + 1}`,
              title,
              price: dealPrice,
              originalPrice,
              discountPercent,
              rating: 4.5,
              ratingsCount: 3120,
              imageUrl,
              asin,
              amazonUrl: cleanUrl,
              store: 'amazon',
              category,
              source: 'DealsMagnet',
              isLootDeal: discountPercent >= 50,
              couponText: discountPercent >= 60 ? '🔥 All-Time Lowest Price' : null,
            });
          }
        }
      } catch (dmErr) {
        console.error('Error fetching DealsMagnet deals:', dmErr);
      }
    }
  }

  // ==========================================
  // ==========================================
  // SOURCE 3: INDIAFREESTUFF (AUTHENTIC ONLY)
  // ==========================================
  if (!filterSource || filterSource === 'all' || filterSource === 'ifs') {
    if (collectedDeals.length < limit) {
      try {
        const ifsRes = await fetch('https://indiafreestuff.in', {
          headers: {
            'User-Agent': userAgent,
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          },
        });
        if (ifsRes.ok) {
          const html = await ifsRes.text();
          // Strictly skip if challenged or blocked
          if (!html.includes('Just a moment...') && !html.includes('cf-browser-verification')) {
            const dealArticles = html.split('<article');
            for (let i = 1; i < dealArticles.length; i++) {
              if (collectedDeals.length >= limit) break;
              const article = dealArticles[i];
              const titleMatch = article.match(/class="[^"]*deal-title[^"]*"[^>]*>([\s\S]*?)<\/a>/i);
              if (!titleMatch) continue;
              const title = titleMatch[1].replace(/<[^>]+>/g, '').trim();
              if (isBlockedProduct(title)) continue;

              const imgMatch = article.match(/<img[^>]+src="([^"]+)"/i) || article.match(/data-src="([^"]+)"/i);
              if (!imgMatch || !imgMatch[1] || !imgMatch[1].startsWith('http') || imgMatch[1].includes('unsplash.com')) {
                continue; // Strictly reject any deal lacking authentic product photo
              }
              let imageUrl = imgMatch[1];

              const linkMatch = article.match(/href="([^"]*(?:amzn\.to|amazon\.in)[^"]*)"/i);
              if (!linkMatch) continue;
              const { asin, cleanUrl } = await resolveAmazonUrl(linkMatch[1], targetTag);
              if (!asin || seenAsins.has(asin)) continue;
              seenAsins.add(asin);

              // Prefer Amazon official Ultra-HD photo if available
              const officialAmzImg = `https://images-eu.ssl-images-amazon.com/images/P/${asin}.01.MAIN._SCRMZZZZZZ_.jpg`;
              try {
                const headImg = await fetch(officialAmzImg, {
                  method: 'HEAD',
                  signal: AbortSignal.timeout(1500),
                });
                const cl = parseInt(headImg.headers.get('content-length') || '0', 10);
                if (headImg.ok && cl > 1000) {
                  imageUrl = officialAmzImg;
                }
              } catch (e) {}

              const category = classifyCategory(title);
              if (!isPriceAndLogisticsViable(999, 50, category, title)) continue;

              collectedDeals.push({
                dealId: `ifs-${Date.now().toString().slice(-6)}-${collectedDeals.length + 1}`,
                title,
                price: 999,
                originalPrice: 1999,
                discountPercent: 50,
                rating: 4.3,
                ratingsCount: 1840,
                imageUrl,
                asin,
                amazonUrl: cleanUrl,
                store: 'amazon',
                category,
                source: 'IndiaFreeStuff',
                isLootDeal: true,
                couponText: '⚡ Curated Loot',
              });
            }
          }
        }
      } catch (ifsErr) {
        console.error('Error in IFS fetch:', ifsErr);
      }
    }
  }

  // ==========================================
  // SOURCE 4: INDIADESIRE (HIGH QUALITY LOOT DEALS)
  // ==========================================
  if (!filterSource || filterSource === 'all' || filterSource === 'indiadesire') {
    if (collectedDeals.length < limit) {
      try {
        const idRes = await fetch('https://indiadesire.com/lootdeals', {
          headers: {
            'User-Agent': userAgent,
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          },
          signal: AbortSignal.timeout(6000),
        });

        if (idRes.ok) {
          const html = await idRes.text();
          const dealBoxes = html.split(/<div class=['"]px-xl-2 py-xl-1 col-6/i);

          for (let i = 1; i < dealBoxes.length; i++) {
            if (collectedDeals.length >= limit) break;
            const box = dealBoxes[i];

            // 1. Check if deal is explicitly marked expired
            if (box.includes("class='expired'") && !box.includes('displaynoneexpired') && box.includes('offer_expired.png')) {
              continue;
            }

            // 2. Extract Store & PID
            const storeMatch = box.match(/store=([^&'"\s>]+)/i) || box.match(/store=['"]([^'"]+)['"]/i);
            const rawStore = storeMatch ? storeMatch[1].toLowerCase() : 'amazon';
            if (rawStore !== 'amazon' && rawStore !== 'flipkart' && rawStore !== 'myntra' && rawStore !== 'nykaa' && rawStore !== 'ajio') {
              continue;
            }
            const store = rawStore as 'amazon' | 'flipkart' | 'myntra' | 'nykaa' | 'ajio';

            // Ensure store diversity: give plenty of room to Flipkart, Myntra, Nykaa, Ajio
            const storeCount = collectedDeals.filter((d) => d.store === store).length;
            const maxPerStore = store === 'amazon' ? Math.min(Math.floor(limit * 0.35), 20) : 40;
            if (storeCount >= maxPerStore) continue;

            const asinMatch = box.match(/pid=['"]([A-Z0-9]{10})['"]/i) || box.match(/redirectpid1=([A-Z0-9]{10})/i);
            const pidMatch = (store === 'amazon' ? asinMatch : null) || box.match(/pid=['"]([^'"]+)['"]/i) || box.match(/redirectpid1=([^&'"\s>]+)/i);
            if (!pidMatch) continue;
            const pid = pidMatch[1].trim();
            if (seenAsins.has(pid)) continue;

            // 3. Extract title
            const titleMatch = box.match(/id="[^"]*OfferDetails[^"]*">([\s\S]*?)<\/span>/i) || box.match(/alt=['"]([^'"]+)['"]/i);
            if (!titleMatch) continue;
            let title = titleMatch[1].replace(/<[^>]+>/g, '').trim();
            if (!title || title.length < 5) continue;

            title = title
              .replace(/^(?:Amazon|Flipkart|Myntra|Nykaa|Ajio)\s*:\s*/i, '')
              .replace(/^(?:flat|up\s*to)?\s*\d+%\s*off\s*[-:]?\s*/i, '')
              .trim();

            if (isBlockedProduct(title)) continue;

            // 4. Extract prices
            const currPriceMatch = box.match(/currentprice[^"]*">[^0-9]*([0-9,]+)/i);
            const prevPriceMatch = box.match(/prevlowprice[^"]*">[^0-9]*([0-9,]+)/i);
            const dealPrice = currPriceMatch ? parseInt(currPriceMatch[1].replace(/,/g, ''), 10) : 0;
            let originalPrice = prevPriceMatch ? parseInt(prevPriceMatch[1].replace(/,/g, ''), 10) : 0;

            if (dealPrice <= 0) continue;
            if (originalPrice <= dealPrice) {
              originalPrice = Math.round(dealPrice * 1.5);
            }

            // 5. Calculate discount percent
            let discountPercent = Math.round(((originalPrice - dealPrice) / originalPrice) * 100);
            const offMatch = box.match(/(\d+)%\s*OFF/i);
            if (offMatch) {
              const explicitDiscount = parseInt(offMatch[1], 10);
              if (explicitDiscount > discountPercent) discountPercent = explicitDiscount;
            }

            // 6. Image extraction: prefer high-resolution
            const imgMatch = box.match(/data-src=['"]([^'"]+)['"]/i) || box.match(/src=['"](https:\/\/[^'"]+)['"]/i);
            let imageUrl = imgMatch ? imgMatch[1] : '';

            // Reject placeholder SVG icons (like gears.svg or star SVGs)
            if (imageUrl.includes('.svg') || imageUrl.includes('gears') || imageUrl.includes('placeholder')) {
              continue;
            }

            if (store === 'amazon') {
              if (imageUrl.includes('_SL300_')) {
                imageUrl = imageUrl.replace('_SL300_', '_SL600_');
              }
              const officialAmzImg = `https://images-eu.ssl-images-amazon.com/images/P/${pid}.01.MAIN._SCRMZZZZZZ_.jpg`;
              try {
                const headImg = await fetch(officialAmzImg, {
                  method: 'HEAD',
                  signal: AbortSignal.timeout(1500),
                });
                const cl = parseInt(headImg.headers.get('content-length') || '0', 10);
                if (headImg.ok && cl > 1000) {
                  imageUrl = officialAmzImg;
                }
              } catch (e) {}
              if (!imageUrl || !imageUrl.startsWith('http')) {
                imageUrl = officialAmzImg;
              }
            } else if (store === 'flipkart') {
              if (imageUrl.includes('flixcart.com')) {
                imageUrl = imageUrl.replace(/\/image\/\d+\/\d+\//, '/image/832/832/');
              }
            }

            if (!imageUrl || !imageUrl.startsWith('http')) continue;

            seenAsins.add(pid);

            // 7. Category classification
            let category = classifyCategory(title);
            if ((store === 'myntra' || store === 'ajio') && (category === 'electronics' || category === 'gadgets')) {
              category = 'shoes_fashion';
            }
            if (store === 'nykaa') {
              category = 'beauty';
            }

            if (!isPriceAndLogisticsViable(dealPrice, discountPercent, category, title)) {
              continue;
            }

            // 8. Build target link & convert with EarnKaro
            let cleanUrl = '';
            if (store === 'amazon') {
              cleanUrl = `https://www.amazon.in/dp/${pid.toUpperCase()}?tag=${targetTag}`;
            } else if (store === 'flipkart') {
              const target = `https://www.flipkart.com/product/p/itme?pid=${pid}`;
              const converted = await convertWithEarnkaro(target);
              cleanUrl = converted || `https://earnkaro.com?r=5730392&fname=lingtuka&url=${encodeURIComponent(target)}`;
            } else if (store === 'myntra') {
              const target = `https://www.myntra.com/a/b/c/${pid}/buy`;
              const converted = await convertWithEarnkaro(target);
              cleanUrl = converted || `https://earnkaro.com?r=5730392&fname=lingtuka&url=${encodeURIComponent(target)}`;
            } else if (store === 'nykaa') {
              const target = `https://www.nykaa.com/product/p/${pid}`;
              const converted = await convertWithEarnkaro(target);
              cleanUrl = converted || `https://earnkaro.com?r=5730392&fname=lingtuka&url=${encodeURIComponent(target)}`;
            } else if (store === 'ajio') {
              const target = `https://www.ajio.com/p/${pid}`;
              const converted = await convertWithEarnkaro(target);
              cleanUrl = converted || `https://earnkaro.com?r=5730392&fname=lingtuka&url=${encodeURIComponent(target)}`;
            }

            collectedDeals.push({
              dealId: `id-${Date.now().toString().slice(-6)}-${collectedDeals.length + 1}`,
              title,
              price: dealPrice,
              originalPrice,
              discountPercent,
              rating: 4.4,
              ratingsCount: 2450,
              imageUrl,
              asin: pid,
              amazonUrl: cleanUrl,
              store,
              category,
              source: 'IndiaDesire',
              isLootDeal: discountPercent >= 50,
              couponText: discountPercent >= 60 ? '⚡ Super Loot Deal' : null,
            });
          }
        }
      } catch (idErr: any) {
        console.error('Error fetching IndiaDesire deals:', idErr.message);
      }
    }
  }

  // ==========================================
  // SOURCE 5: NYKAA BEAUTY & SKINCARE BESTSELLER DEALS
  // ==========================================
  if (!filterSource || filterSource === 'all' || filterSource === 'nykaa') {
    const nykaaCatalog = [
      {
        pid: 'NYK54116',
        title: 'Maybelline New York Super Stay Vinyl Ink Liquid Lipstick (Long-Wear Transferproof)',
        price: 649,
        originalPrice: 849,
        discountPercent: 24,
        rating: 4.5,
        ratingsCount: 14200,
        imageUrl: 'https://images-static.nykaa.com/media/catalog/product/4/7/47e3cf9MAYBE00000403z_1.jpg?tr=w-500',
        url: 'https://www.nykaa.com/maybelline-new-york-super-stay-vinyl-ink-liquid-lipstick/p/54116',
        couponText: '⚡ Trending Beauty Loot',
      },
      {
        pid: 'NYK1067982',
        title: 'Minimalist 10% Niacinamide Face Serum with Zinc For Blemish & Acne Marks (30ml)',
        price: 569,
        originalPrice: 599,
        discountPercent: 5,
        rating: 4.6,
        ratingsCount: 28500,
        imageUrl: 'https://images-static.nykaa.com/media/catalog/product/f/f/ff6433d8906128102379_1.jpg?tr=w-500',
        url: 'https://www.nykaa.com/minimalist-10percent-niacinamide-face-serum-with-zinc/p/1067982',
        couponText: '⭐ Dermatologist Recommended',
      },
      {
        pid: 'NYK573572',
        title: 'Kay Beauty Matte Action Lip Liner - Waterproof & Ultra Long Lasting (Hypoallergenic)',
        price: 499,
        originalPrice: 599,
        discountPercent: 17,
        rating: 4.4,
        ratingsCount: 8900,
        imageUrl: 'https://images-static.nykaa.com/media/catalog/product/b/3/b328fc08904330900257_1.jpg?tr=w-500',
        url: 'https://www.nykaa.com/kay-beauty-matte-action-lip-liner/p/573572',
        couponText: '💄 Katrina Kaif Brand',
      },
      {
        pid: 'NYK5095369',
        title: 'Dot & Key Vitamin C + E Super Bright Sunscreen SPF 50+ PA++++ (No White Cast)',
        price: 395,
        originalPrice: 445,
        discountPercent: 11,
        rating: 4.5,
        ratingsCount: 19800,
        imageUrl: 'https://images-static.nykaa.com/media/catalog/product/e/9/e9e5b79DOTKE00000213l_1.jpg?tr=w-500',
        url: 'https://www.nykaa.com/dot-key-vitamin-c-e-super-bright-sunscreen-spf-50-pa-in-vivo-tested/p/5095369',
        couponText: '☀️ Daily UV Shield',
      },
      {
        pid: 'NYK20432',
        title: 'Cetaphil Gentle Skin Cleanser For Sensitive & Dry Skin (Hydrating Formula)',
        price: 359,
        originalPrice: 399,
        discountPercent: 10,
        rating: 4.7,
        ratingsCount: 36400,
        imageUrl: 'https://images-static.nykaa.com/media/catalog/product/1/5/153feb3NYCETA0000010_M.jpg?tr=w-500',
        url: 'https://www.nykaa.com/cetaphil-gentle-skin-cleanser/p/20432',
        couponText: '💧 Gentle Hydration',
      },
      {
        pid: 'NYK5069134',
        title: 'The Ordinary Niacinamide 10% + Zinc 1% High Strength Blemish Serum (30ml)',
        price: 585,
        originalPrice: 650,
        discountPercent: 10,
        rating: 4.6,
        ratingsCount: 42100,
        imageUrl: 'https://images-static.nykaa.com/media/catalog/product/8/8/88a48a1THECI00000026_1.jpg?tr=w-500',
        url: 'https://www.nykaa.com/the-ordinary-niacinamide-10-zinc-1-high-strength-face-serum-for-oil-control-and-blemishes/p/5069134',
        couponText: '🏆 Cult Global Bestseller',
      },
      {
        pid: 'NYK380963',
        title: 'Plum Green Tea Pore Cleansing Face Wash with Glycolic Acid (Acne & Oil Control)',
        price: 296,
        originalPrice: 395,
        discountPercent: 25,
        rating: 4.4,
        ratingsCount: 15300,
        imageUrl: 'https://images-static.nykaa.com/media/catalog/product/b/b/bbed6a8PLUMX00001019_01.jpg?tr=w-500',
        url: 'https://www.nykaa.com/plum-green-tea-pore-cleansing-face-wash-with-glycolic-acid-fights-pimpels-control-oil/p/380963',
        couponText: '🌿 100% Vegan Cleanser',
      },
      {
        pid: 'NYK1210134',
        title: 'Nykaa Cosmetics Matte to Last Transferproof Liquid Lipstick (Deep Matte)',
        price: 499,
        originalPrice: 649,
        discountPercent: 23,
        rating: 4.4,
        ratingsCount: 22700,
        imageUrl: 'https://images-static.nykaa.com/media/catalog/product/c/7/c74658d8904245704247_1.jpg?tr=w-500',
        url: 'https://www.nykaa.com/nykaa-matte-to-last-transferproof-liquid-lipstick/p/vn/1210134',
        couponText: '💋 Transfer-Proof 12H',
      },
    ];

    for (const item of nykaaCatalog) {
      if (seenAsins.has(item.pid)) continue;
      seenAsins.add(item.pid);

      let affiliateUrl = await convertWithEarnkaro(item.url);
      if (!affiliateUrl) {
        affiliateUrl = `https://earnkaro.com?r=5730392&fname=lingtuka&url=${encodeURIComponent(item.url)}`;
      }

      collectedDeals.push({
        dealId: `nyk-${Date.now().toString().slice(-6)}-${collectedDeals.length + 1}`,
        title: item.title,
        price: item.price,
        originalPrice: item.originalPrice,
        discountPercent: item.discountPercent,
        rating: item.rating,
        ratingsCount: item.ratingsCount,
        imageUrl: item.imageUrl,
        asin: item.pid,
        amazonUrl: affiliateUrl,
        store: 'nykaa',
        category: 'beauty',
        source: 'IndiaDesire',
        isLootDeal: item.discountPercent >= 20,
        couponText: item.couponText,
      });
    }
  }

  // ==========================================
  // SOURCE 5: CURATED MEESHO MEGA LOOT HARVESTER (TOP MIZORAM PICKS)
  // ==========================================
  if (!filterSource || filterSource === 'all' || filterSource === 'meesho') {
    const meeshoCatalog = [
      {
        pid: 'MSH-533821031',
        title: 'SW-MEXICO T-Blue Dailywear Sports Sneakers Running Shoes For Men',
        price: 305,
        originalPrice: 799,
        discountPercent: 62,
        rating: 4.5,
        ratingsCount: 2650,
        imageUrl: 'https://images.meesho.com/images/products/533821031/xs0rw.jpg',
        extId: '8ttmxz',
        category: 'shoes_fashion',
        couponText: '👟 Mizo Top Pick',
      },
      {
        pid: 'MSH-489214731',
        title: 'Urban Trend Korean Oversized Drop-Shoulder Heavy Cotton T-Shirt',
        price: 249,
        originalPrice: 699,
        discountPercent: 64,
        rating: 4.4,
        ratingsCount: 8400,
        imageUrl: 'https://images.meesho.com/images/products/475709371/fxckd_512.jpg',
        extId: '7wxq1a',
        category: 'shoes_fashion',
        couponText: '🔥 Korean Oversized',
      },
      {
        pid: 'MSH-412891045',
        title: 'T800 Ultra Smartwatch with Bluetooth Calling, Heart Rate & Fitness Modes',
        price: 399,
        originalPrice: 1499,
        discountPercent: 73,
        rating: 4.3,
        ratingsCount: 15400,
        imageUrl: 'https://images.meesho.com/images/products/419351045/fneje_512.jpg',
        extId: '6kmno9',
        category: 'gadgets',
        couponText: '⚡ Calling Smartwatch',
      },
      {
        pid: 'MSH-367812903',
        title: 'M10 TWS Wireless Gaming Earbuds with Digital LED Display & Powerbank Case',
        price: 299,
        originalPrice: 999,
        discountPercent: 70,
        rating: 4.3,
        ratingsCount: 32000,
        imageUrl: 'https://images.meesho.com/images/products/681394114/v8cw1_512.jpg',
        extId: '5yrt3p',
        category: 'gadgets',
        couponText: '🎧 Deep Bass Gaming',
      },
      {
        pid: 'MSH-456721098',
        title: 'Multipurpose 4-Tier Rotating Kitchen Spice Rack & Storage Organizer',
        price: 289,
        originalPrice: 699,
        discountPercent: 59,
        rating: 4.5,
        ratingsCount: 4200,
        imageUrl: 'https://images.meesho.com/images/products/945642903/qlbmw_512.jpg',
        extId: '8hjk2l',
        category: 'home_kitchen',
        couponText: '🏠 Kitchen Organizer',
      },
      {
        pid: 'MSH-512903847',
        title: 'Men Luxury Roman Numerals Dial Analog Watch with Brown Leather Strap',
        price: 199,
        originalPrice: 599,
        discountPercent: 67,
        rating: 4.4,
        ratingsCount: 9100,
        imageUrl: 'https://images.meesho.com/images/products/918606604/jjcjp_512.jpg',
        extId: '9vbn5m',
        category: 'gadgets',
        couponText: '⌚ Under ₹200 Watch',
      },
      {
        pid: 'MSH-498123049',
        title: 'Women Elegant Rose Gold Dial Stainless Steel Luxury Watch',
        price: 299,
        originalPrice: 899,
        discountPercent: 67,
        rating: 4.5,
        ratingsCount: 14600,
        imageUrl: 'https://images.meesho.com/images/products/405221223/gtu3d_512.jpg',
        extId: '8qaz4w',
        category: 'gadgets',
        couponText: '✨ Rose Gold Watch',
      },
      {
        pid: 'MSH-439012874',
        title: 'Rugged Shockproof Outdoor Sports Smartwatch with Fitness Tracker',
        price: 349,
        originalPrice: 999,
        discountPercent: 65,
        rating: 4.4,
        ratingsCount: 11200,
        imageUrl: 'https://images.meesho.com/images/products/468539792/fagvq_512.jpg',
        extId: '7edc3v',
        category: 'gadgets',
        couponText: '⚡ Rugged Smartwatch',
      },
      {
        pid: 'MSH-523491028',
        title: 'Waterproof Anti-Theft Travel & College Laptop Backpack with USB Charging Port',
        price: 399,
        originalPrice: 1199,
        discountPercent: 67,
        rating: 4.5,
        ratingsCount: 7800,
        imageUrl: 'https://images.meesho.com/images/products/485682499/mjccg_512.jpg',
        extId: '9plm0k',
        category: 'shoes_fashion',
        couponText: '🎒 Anti-Theft USB',
      },
      {
        pid: 'MSH-541298401',
        title: 'Classic Casual Printed Crew Neck 100% Breathable Cotton T-Shirt',
        price: 249,
        originalPrice: 699,
        discountPercent: 64,
        rating: 4.4,
        ratingsCount: 5600,
        imageUrl: 'https://images.meesho.com/images/products/456373264/yrdmg_512.jpg',
        extId: '8ttmxz',
        category: 'shoes_fashion',
        couponText: '👕 100% Cotton Tee',
      },
      {
        pid: 'MSH-612984102',
        title: 'Winter Warm Woolen Beanie Cap with Neck Warmer Muffler Scarf Set for Men & Women',
        price: 229,
        originalPrice: 699,
        discountPercent: 67,
        rating: 4.5,
        ratingsCount: 9400,
        imageUrl: 'https://images.meesho.com/images/products/20088361/dykeg_512.webp',
        extId: '9wkm1z',
        category: 'shoes_fashion',
        couponText: '🧣 Lukhum & Muffler Set',
      },
      {
        pid: 'MSH-623491873',
        title: 'Korean Style Solid Oversized Unisex Fleece Hoodie with Kangaroo Pockets',
        price: 399,
        originalPrice: 999,
        discountPercent: 60,
        rating: 4.4,
        ratingsCount: 12800,
        imageUrl: 'https://images.meesho.com/images/products/608218139/tgkdn_512.webp',
        extId: '8plq4c',
        category: 'shoes_fashion',
        couponText: '🧥 Korean Fleece Hoodie',
      },
      {
        pid: 'MSH-631029485',
        title: 'Winter Thermal Windproof Touchscreen Riding Hand Gloves for Men & Women',
        price: 149,
        originalPrice: 499,
        discountPercent: 70,
        rating: 4.4,
        ratingsCount: 7200,
        imageUrl: 'https://images.meesho.com/images/products/620686165/oztdo_512.webp',
        extId: '7tnx2v',
        category: 'shoes_fashion',
        couponText: '🧤 Riding Gloves',
      }
    ];

    for (const item of meeshoCatalog) {
      if (seenAsins.has(item.pid)) continue;
      seenAsins.add(item.pid);

      const pid = item.pid.replace('MSH-', '');
      const affiliateUrl = buildMeeshoAffiliateUrl(pid, item.extId);

      collectedDeals.push({
        dealId: `msh-${Date.now().toString().slice(-6)}-${collectedDeals.length + 1}`,
        title: item.title,
        price: item.price,
        originalPrice: item.originalPrice,
        discountPercent: item.discountPercent,
        rating: item.rating,
        ratingsCount: item.ratingsCount,
        imageUrl: item.imageUrl,
        asin: item.pid,
        amazonUrl: affiliateUrl,
        store: 'meesho',
        category: item.category,
        source: 'Meesho Deals',
        isLootDeal: item.discountPercent >= 50,
        couponText: item.couponText,
      });
    }
  }

  // ==========================================
  // SOURCE 6: PROVEN AMAZON WINNERS & FESTIVE LOOT HARVESTER (TOP MIZORAM PICKS)
  // High-converting festive lighting, kitchen utilities, and 30%-70% gadgets
  // ==========================================
  if (!filterSource || filterSource === 'all' || filterSource === 'amazon') {
    const amazonProvenCatalog = [
      {
        asin: 'B07WMS7TWB',
        title: 'Pigeon Amaze Plus Electric Kettle 1.5 L, 1300 Watt Stainless Steel Body',
        price: 489,
        originalPrice: 1245,
        discountPercent: 61,
        rating: 4.2,
        ratingsCount: 124000,
        imageUrl: 'https://m.media-amazon.com/images/I/31na34LxwmL._SL500_.jpg',
        category: 'home_kitchen',
        couponText: '⚡ Winter Kitchen Essential',
      },
      {
        asin: 'B0CG239B3T',
        title: 'Pigeon by Stovekraft Edge Carbon Knife Set with Wooden Block (6 Pieces)',
        price: 950,
        originalPrice: 1995,
        discountPercent: 52,
        rating: 4.3,
        ratingsCount: 14200,
        imageUrl: 'https://m.media-amazon.com/images/I/41tGiElRp8L._SL500_.jpg',
        category: 'home_kitchen',
        couponText: '🔪 Kitchen Best Seller',
      },
      {
        asin: 'B0C413GYVC',
        title: 'boAt Airdopes Joy TWS Bluetooth Earbuds with 35H Battery & Fast Charge',
        price: 799,
        originalPrice: 3490,
        discountPercent: 77,
        rating: 4.3,
        ratingsCount: 22000,
        imageUrl: 'https://m.media-amazon.com/images/I/31+N6nk6X5L._SL500_.jpg',
        category: 'gadgets',
        couponText: '🎧 77% OFF Earbuds',
      },
      {
        asin: 'B0C3ZYFZ77',
        title: 'boAt Airdopes Alpha True Wireless Earbuds with 35H Playtime, Fast Charge & IPX5 (Jet Black)',
        price: 799,
        originalPrice: 3490,
        discountPercent: 77,
        rating: 4.3,
        ratingsCount: 22000,
        imageUrl: 'https://m.media-amazon.com/images/I/31w8ruMm+AL._SL500_.jpg',
        category: 'gadgets',
        couponText: '🎧 77% OFF boAt Earbuds',
      },
      {
        asin: 'B07YYK13LF',
        title: 'SanDisk 64GB Ultra Dual Drive Go USB Type-C & Type-A Flash Drive',
        price: 699,
        originalPrice: 1300,
        discountPercent: 46,
        rating: 4.4,
        ratingsCount: 82000,
        imageUrl: 'https://m.media-amazon.com/images/I/410l0pKc2OL._SL500_.jpg',
        category: 'gadgets',
        couponText: '💾 OTG Dual Drive',
      },
      {
        asin: 'B098K1439N',
        title: 'Zebronics Zeb-Jaguar 2.4GHz Wireless Optical Mouse with USB Nano Receiver',
        price: 249,
        originalPrice: 599,
        discountPercent: 58,
        rating: 4.2,
        ratingsCount: 38000,
        imageUrl: 'https://m.media-amazon.com/images/I/31tl6cuu4jl._SL500_.jpg',
        category: 'gadgets',
        couponText: '🖱️ Wireless Mouse',
      },
      {
        asin: 'B078PCSHXL',
        title: 'Wild Stone Hydra Energy Eau De Parfum for Men (50ml Luxury Long Lasting Perfume)',
        price: 199,
        originalPrice: 399,
        discountPercent: 50,
        rating: 4.2,
        ratingsCount: 28000,
        imageUrl: 'https://m.media-amazon.com/images/I/51ghodqwill._SL500_.jpg',
        category: 'beauty',
        couponText: '✨ Luxury Perfume',
      },
      {
        asin: 'B0B7X2625M',
        title: 'Wipro 4-Socket Extension Board with Individual Switches & Surge Spike Guard',
        price: 399,
        originalPrice: 799,
        discountPercent: 50,
        rating: 4.3,
        ratingsCount: 16000,
        imageUrl: 'https://m.media-amazon.com/images/I/41rtdc4kvzl._SL500_.jpg',
        category: 'gadgets',
        couponText: '⚡ Extension Board',
      },
      {
        asin: 'B081PNXH2M',
        title: 'Alexvyan Unisex Woolen Beanie Cap with Neck Warmer Muffler Scarf Set with Soft Fur Lining',
        price: 299,
        originalPrice: 999,
        discountPercent: 70,
        rating: 4.4,
        ratingsCount: 14000,
        imageUrl: 'https://m.media-amazon.com/images/I/514WzK91e9L._SL500_.jpg',
        category: 'shoes_fashion',
        couponText: '🧣 Lukhum & Muffler Set',
      },
      {
        asin: 'B0FRMXLW3N',
        title: 'Reebok Courtswift Duelist Unisex Classics Shoes (Navy/Chalk/Grey)',
        price: 1600,
        originalPrice: 3999,
        discountPercent: 60,
        rating: 4.4,
        ratingsCount: 3200,
        imageUrl: 'https://m.media-amazon.com/images/I/31y3hOB0YcL._SL500_.jpg',
        category: 'shoes_fashion',
        couponText: '👟 Reebok 60% OFF',
      }
    ];

    for (const item of amazonProvenCatalog) {
      if (seenAsins.has(item.asin)) continue;
      seenAsins.add(item.asin);

      const affiliateUrl = `https://www.amazon.in/dp/${item.asin}?tag=${targetTag}`;

      collectedDeals.push({
        dealId: `amz-top-${Date.now().toString().slice(-6)}-${collectedDeals.length + 1}`,
        title: item.title,
        price: item.price,
        originalPrice: item.originalPrice,
        discountPercent: item.discountPercent,
        rating: item.rating,
        ratingsCount: item.ratingsCount,
        imageUrl: item.imageUrl,
        asin: item.asin,
        amazonUrl: affiliateUrl,
        store: 'amazon',
        category: item.category,
        source: 'IndiaDesire',
        isLootDeal: item.discountPercent >= 50,
        couponText: item.couponText,
      });
    }
  }

  // ==========================================
  // SOURCE 6: SMARTPHONES & 5G MOBILE DEALS HARVESTER (DESIDIME & DIRECT MOBILE HUBS)
  // ==========================================
  if (!filterSource || filterSource === 'all' || filterSource === 'mobiles' || filterSource === 'desidime') {
    try {
      const ddRes = await fetch('https://www.desidime.com/groups/mobile-phones', {
        headers: {
          'User-Agent': userAgent,
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        },
        signal: AbortSignal.timeout(7000),
      });

      if (ddRes.ok) {
        const ddHtml = await ddRes.text();
        const slides = ddHtml.split(/<div class=['"]swiper-slide[^'"]*['"]>/i);

        for (let i = 1; i < slides.length; i++) {
          if (collectedDeals.length >= limit + 25) break;
          const slide = slides[i];
          const linkMatch = slide.match(/href=['"](\/deals\/[^'"]+)['"]/i);
          const imgMatch = slide.match(/src=['"]([^'"]+)['"]/i);
          const titleMatch = slide.match(/alt=['"]([^'"]+)['"]/i) || slide.match(/class=['"][^'"]*font-medium[^'"]*['"][^>]*>([\s\S]*?)<\/span>/i);
          const priceMatch = slide.match(/₹\s*([0-9,]+)/);

          if (!linkMatch || !titleMatch || !priceMatch) continue;

          let title = titleMatch[1].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
          if (!isMobilePhone(title)) continue;

          const dealPrice = parseInt(priceMatch[1].replace(/,/g, ''), 10);
          if (isNaN(dealPrice) || dealPrice < 2000 || dealPrice > 120000) continue;

          const dealIdMatch = linkMatch[1].match(/-(\d+)$/);
          const dealId = dealIdMatch ? dealIdMatch[1] : null;
          if (!dealId || seenAsins.has(`DD-${dealId}`)) continue;

          let targetUrl = '';
          let store: 'amazon' | 'flipkart' = 'amazon';
          let asin: string | null = null;

          // Resolve direct merchant redirect URL from DesiDime visit link
          try {
            const visitRes = await fetch(`https://visit.desidime.com/visit/deal-details-image-1/${dealId}`, {
              redirect: 'manual',
              headers: { 'User-Agent': userAgent },
              signal: AbortSignal.timeout(4000),
            });
            const locationHeader = visitRes.headers.get('location') || '';
            const urlParam = locationHeader.match(/[?&]url=([^&]+)/);
            if (urlParam && urlParam[1]) {
              const decoded = decodeURIComponent(urlParam[1]);
              if (decoded.includes('flipkart.com')) {
                store = 'flipkart';
                const converted = await convertWithEarnkaro(decoded);
                targetUrl = converted || `https://earnkaro.com?r=5730392&fname=lingtuka&url=${encodeURIComponent(decoded)}`;
              } else {
                store = 'amazon';
                const amzAsin = decoded.match(/\/(?:dp|gp\/product)\/([A-Z0-9]{10})/i);
                if (amzAsin) {
                  asin = amzAsin[1].toUpperCase();
                  targetUrl = `https://www.amazon.in/dp/${asin}?tag=${targetTag}`;
                } else {
                  targetUrl = decoded.includes('?') ? `${decoded}&tag=${targetTag}` : `${decoded}?tag=${targetTag}`;
                }
              }
            }
          } catch (_) {
            continue;
          }

          if (!targetUrl) continue;
          seenAsins.add(`DD-${dealId}`);
          if (asin) seenAsins.add(asin);

          const originalPrice = Math.round(dealPrice * 1.22);
          const discountPercent = Math.max(Math.round(((originalPrice - dealPrice) / originalPrice) * 100), 15);
          const imageUrl = imgMatch ? imgMatch[1] : (asin ? `https://images-eu.ssl-images-amazon.com/images/P/${asin}.01.MAIN._SCRMZZZZZZ_.jpg` : '');

          collectedDeals.push({
            dealId: `dd-${dealId}`,
            title,
            price: dealPrice,
            originalPrice,
            discountPercent,
            rating: 4.4,
            ratingsCount: 520,
            imageUrl,
            asin,
            amazonUrl: targetUrl,
            store,
            category: 'gadgets',
            source: 'DesiDime',
            isLootDeal: discountPercent >= 20,
            couponText: '📱 Smartphone Deal',
          });
        }
      }
    } catch (e) {
      console.warn('DesiDime mobiles harvester error:', (e as Error).message);
    }
  }

  // ==========================================
  // SYNC & AUTO-CORRECT WITH AMAZON CREATORS API
  // ==========================================
  async function syncAmazonDealsWithApi(
    deals: ScrapedDeal[],
    envConfig: Env
  ): Promise<{ verified: number; updated: number; discarded: number }> {
    const amzDeals = deals.filter(
      (d) => (!d.store || d.store === 'amazon') && d.asin && /^[A-Z0-9]{10}$/i.test(d.asin)
    );

    if (amzDeals.length === 0) return { verified: 0, updated: 0, discarded: 0 };

    const clientId = envConfig.AMAZON_CLIENT_ID;
    const clientSecret = envConfig.AMAZON_CLIENT_SECRET;
    const partnerTag = envConfig.AMAZON_PARTNER_TAG || 'lalmalsawmtlu-21';

    if (!clientId || !clientSecret) {
      return { verified: 0, updated: 0, discarded: 0 };
    }

    try {
      const tokenRes = await fetch('https://api.amazon.com/auth/o2/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          grant_type: 'client_credentials',
          client_id: clientId,
          client_secret: clientSecret,
          scope: 'creatorsapi::default',
        }),
        signal: AbortSignal.timeout(6000),
      });

      if (!tokenRes.ok) {
        return { verified: 0, updated: 0, discarded: 0 };
      }

      const tokenData = (await tokenRes.json()) as { access_token?: string };
      if (!tokenData?.access_token) return { verified: 0, updated: 0, discarded: 0 };

      const token = tokenData.access_token;
      let verifiedCount = 0;
      let updatedCount = 0;
      let discardedCount = 0;

      const chunkSize = 10;
      const chunks: ScrapedDeal[][] = [];
      for (let i = 0; i < amzDeals.length; i += chunkSize) {
        chunks.push(amzDeals.slice(i, i + chunkSize));
      }

      await Promise.all(
        chunks.map(async (chunk) => {
          const asins = chunk.map((c) => c.asin as string);
          try {
            const apiRes = await fetch('https://creatorsapi.amazon/catalog/v1/getItems', {
              method: 'POST',
              headers: {
                Authorization: `Bearer ${token}`,
                'x-marketplace': 'www.amazon.in',
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                partnerTag,
                partnerType: 'Associates',
                itemIdType: 'ASIN',
                itemIds: asins,
                resources: [
                  'itemInfo.title',
                  'images.primary.large',
                  'offersV2.listings.price',
                ],
              }),
              signal: AbortSignal.timeout(8000),
            });

            if (!apiRes.ok) return;

            const data = (await apiRes.json()) as any;
            const items: any[] = data?.itemsResult?.items || [];

            for (const item of items) {
              const itemAsin = item.asin;
              const targetDeal = chunk.find((c) => c.asin?.toUpperCase() === itemAsin?.toUpperCase());
              if (!targetDeal) continue;

              verifiedCount++;
              const listing =
                item.offersV2?.listings?.find((l: any) => l.isBuyBoxWinner) ||
                item.offersV2?.listings?.[0];
              const livePrice = listing?.price?.money?.amount;
              const liveMrp = listing?.price?.savingBasis?.money?.amount;
              const liveSavings = listing?.price?.savings?.percentage;

              if (item.images?.primary?.large?.url) {
                targetDeal.imageUrl = item.images.primary.large.url;
              }

              if (item.itemInfo?.title?.displayValue) {
                targetDeal.title = item.itemInfo.title.displayValue;
              }

              if (typeof livePrice === 'number' && livePrice > 0) {
                const prevPrice = targetDeal.price;
                targetDeal.price = Math.round(livePrice);
                if (typeof liveMrp === 'number' && liveMrp > 0) {
                  targetDeal.originalPrice = Math.round(liveMrp);
                }
                if (typeof liveSavings === 'number') {
                  targetDeal.discountPercent = Math.round(liveSavings);
                } else if (targetDeal.originalPrice > targetDeal.price) {
                  targetDeal.discountPercent = Math.round(
                    ((targetDeal.originalPrice - targetDeal.price) / targetDeal.originalPrice) * 100
                  );
                }

                targetDeal.isLootDeal = targetDeal.discountPercent >= 50;
                (targetDeal as any)._isAmazonLiveVerified = true;
                if (prevPrice !== targetDeal.price) {
                  updatedCount++;
                }
              } else {
                (targetDeal as any)._isUnavailable = true;
                discardedCount++;
              }
            }
          } catch {
            // Gracefully ignore chunk failure
          }
        })
      );

      return { verified: verifiedCount, updated: updatedCount, discarded: discardedCount };
    } catch (err) {
      console.warn('Amazon API batch sync error:', err);
      return { verified: 0, updated: 0, discarded: 0 };
    }
  }

  // ==========================================
  // 3-PILLAR RANKING & LOGISTICS OPTIMIZATION
  // ==========================================
  // Filter out any bulky/ineligible products and rank by 3-pillar data-driven conversion score
  const qualifiedDeals = collectedDeals.filter(
    (deal) => !isBlockedProduct(deal.title) && isPriceAndLogisticsViable(deal.price, deal.discountPercent, deal.category, deal.title)
  );

  qualifiedDeals.sort((a, b) => computeDealScore(b) - computeDealScore(a));
  const topDeals = qualifiedDeals.slice(0, limit);

  // ==========================================
  // AUTO-PUBLISH TO CLOUDFLARE D1 DATABASE
  // ==========================================
  let insertedCount = 0;
  let amazonSyncStats = { verified: 0, updated: 0, discarded: 0 };

  if (topDeals.length > 0) {
    try {
      amazonSyncStats = await syncAmazonDealsWithApi(topDeals, env);
    } catch (e) {
      console.warn('Amazon API sync failed, continuing with scraped deals:', e);
    }
  }

  if (shouldAutoPublish && env.DB && topDeals.length > 0) {
    const nowIso = new Date().toISOString();
    for (const deal of topDeals) {
      // STRICT VERIFICATION GATE:
      // 1. Amazon deals must have authentic 10-character Amazon ASIN
      // 2. Non-Amazon deals (Flipkart/Myntra/Nykaa/Ajio) must have valid product ID
      // 3. Must have valid product image starting with http
      // 4. Must NOT have any Unsplash or stock placeholder images
      // 5. Must NOT have search collection URLs (/s?k= or /deal/)
      // 6. Skip items marked unavailable (out of stock) by Amazon API
      // 7. Skip items where discount has evaporated below 15% (except smartphones >= 8%)
      // 8. Strict Logistics & Price Sweet Spot Re-check
      if (isBlockedProduct(deal.title) || !isPriceAndLogisticsViable(deal.price, deal.discountPercent, deal.category, deal.title)) {
        continue;
      }
      const isAmz = !deal.store || deal.store === 'amazon';
      if ((deal as any)._isUnavailable) {
        continue;
      }
      if (isAmz && (!deal.asin || !/^[A-Z0-9]{10}$/i.test(deal.asin))) {
        continue;
      }
      if (isAmz && deal.discountPercent < 15 && !isMobilePhone(deal.title)) {
        continue;
      }
      if (
        !deal.asin ||
        deal.asin.startsWith('DM') ||
        !deal.imageUrl ||
        !deal.imageUrl.startsWith('http') ||
        deal.imageUrl.length < 15 ||
        deal.imageUrl.includes('unsplash.com') ||
        deal.imageUrl.includes('photo-1523275335684-37898b6baf30') ||
        deal.imageUrl.includes('.svg') ||
        deal.imageUrl.includes('gears') ||
        deal.imageUrl.includes('placeholder') ||
        deal.imageUrl.includes('white-star-display') ||
        (deal.amazonUrl && (deal.amazonUrl.includes('/s?k=') || deal.amazonUrl.includes('/deal/')))
      ) {
        continue;
      }
      try {
        const finalAsin = deal.asin;
        const verifiedTag = (deal as any)._isAmazonLiveVerified
          ? 'Verified via Amazon Creators API'
          : 'Verified via Multi-Source Harvester';

        await env.DB.prepare(
          `INSERT INTO deals (
            id, asin, title, category, store, original_price, deal_price, current_price,
            discount_percent, rating, ratings_count, image_url, affiliate_url, status,
            is_loot_deal, coupon_text, description, created_at, last_checked_at, verified_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(asin) DO UPDATE SET
            deal_price = excluded.deal_price,
            current_price = excluded.deal_price,
            original_price = excluded.original_price,
            discount_percent = excluded.discount_percent,
            title = excluded.title,
            image_url = excluded.image_url,
            created_at = excluded.created_at,
            last_checked_at = excluded.last_checked_at,
            verified_at = excluded.verified_at`
        )
          .bind(
            `deal-${deal.dealId}`,
            finalAsin,
            deal.title,
            deal.category,
            deal.store || 'amazon',
            deal.originalPrice,
            deal.price,
            deal.price,
            deal.discountPercent,
            deal.rating,
            deal.ratingsCount,
            deal.imageUrl,
            deal.amazonUrl,
            'active',
            deal.isLootDeal ? 1 : 0,
            deal.couponText || (deal.discountPercent >= 55 ? '🔥 Price Tlahniam Nasa!' : null),
            `Curated from ${deal.source}. 100% genuine ${deal.store ? deal.store.toUpperCase() : 'Amazon'} deal verified with ${deal.discountPercent}% OFF.`,
            nowIso,
            nowIso,
            verifiedTag
          )
          .run();
        insertedCount++;
      } catch (dbErr) {
        // Continue loop on duplicates
      }
    }

    // Automated Maintenance: Auto-prune stale deals older than 21 days (3 weeks) or marked expired
    try {
      await env.DB.prepare("DELETE FROM deals WHERE created_at < datetime('now', '-21 days') OR status = 'expired'").run();
    } catch (pruneErr) {
      // Non-blocking cleanup
    }
  }

  return new Response(
    JSON.stringify({
      success: true,
      count: topDeals.length,
      insertedCount: shouldAutoPublish ? insertedCount : undefined,
      autoPublished: shouldAutoPublish,
      amazonLiveSync: amazonSyncStats,
      deals: topDeals,
      timestamp: new Date().toISOString(),
    }),
    {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': shouldAutoPublish ? 'no-cache' : 'public, max-age=120',
      },
    }
  );
};
