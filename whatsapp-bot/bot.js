import { makeWASocket, useMultiFileAuthState, DisconnectReason } from '@whiskeysockets/baileys';
import pino from 'pino';
import qrcode from 'qrcode-terminal';
import QRCode from 'qrcode';
import http from 'http';
import { Jimp } from 'jimp';
import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

// Live in-memory activity logger
const recentLogs = [];
function addLog(level, ...args) {
  const time = new Date().toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata' });
  const text = args.map((a) => (typeof a === 'object' ? JSON.stringify(a) : String(a))).join(' ');
  const prefix = level === 'error' ? '❌ ' : level === 'warn' ? '⚠️ ' : '';
  recentLogs.push(`[${time}] ${prefix}${text}`);
  if (recentLogs.length > 50) recentLogs.shift();
}

const origLog = console.log;
const origErr = console.error;
const origWarn = console.warn;
console.log = (...args) => {
  origLog(...args);
  addLog('info', ...args);
};
console.error = (...args) => {
  origErr(...args);
  addLog('error', ...args);
};
console.warn = (...args) => {
  origWarn(...args);
  addLog('warn', ...args);
};

const CHANNEL_INVITE_CODE = '0029VbE4k2N8fewji3I3Wa0t';
const API_URL = 'https://mizodeals.com/api/deals?status=active&limit=200';
const PRIORITY_ASINS = ['B0DJ1KBQ52', 'B084HG5XPP', 'B0FZKZ9RY5'];
const POSTED_FILE = path.join(process.cwd(), 'posted_deals.json');
const AUTH_DIR = path.join(process.cwd(), 'auth_info');
const SCRAPER_SOURCES = ['telegram', 'dealsmagnet', 'indiadesire', 'nykaa', 'meesho', 'all'];
let currentSourceIndex = 0;
let hasSyncedAllAuth = false;

// Anti-Duplicate System: 14-day memory, multi-factor deduplication (ASIN, Deal ID, Title, Image), & Cloudflare D1 persistence
const POSTED_RETENTION_MS = 14 * 24 * 60 * 60 * 1000; // Keep in memory for 14 days
const MAX_POSTED_RECORDS = 2000;

function getTitleKey(title) {
  if (!title) return '';
  return title
    .toLowerCase()
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '')
    .replace(/&#39;/g, "'")
    .replace(/[^a-z0-9]/g, '')
    .slice(0, 35);
}

function getImageKey(imageUrl) {
  if (!imageUrl || typeof imageUrl !== 'string') return '';
  try {
    const clean = imageUrl.split('?')[0].split('#')[0];
    const parts = clean.split('/').filter(Boolean);
    const lastPart = parts[parts.length - 1] || '';
    return lastPart.toLowerCase();
  } catch (e) {
    return imageUrl.slice(-40).toLowerCase();
  }
}

function getPostedRecords() {
  try {
    if (fs.existsSync(POSTED_FILE)) {
      const data = JSON.parse(fs.readFileSync(POSTED_FILE, 'utf8'));
      if (Array.isArray(data)) {
        const now = Date.now();
        const valid = data.filter((item) => {
          if (!item) return false;
          if (typeof item === 'string') return true;
          if (typeof item === 'object') {
            if (!item.postedAt) return true;
            return now - item.postedAt < POSTED_RETENTION_MS;
          }
          return false;
        });
        return valid.slice(-MAX_POSTED_RECORDS);
      }
    }
  } catch (e) {}
  return [];
}

function getPostedLookup() {
  const records = getPostedRecords();
  const ids = new Set();
  const asins = new Set();
  const titles = new Set();
  const images = new Set();

  for (const item of records) {
    if (typeof item === 'string') {
      ids.add(item);
      if (/^[A-Z0-9]{10}$/i.test(item)) asins.add(item.toUpperCase());
    } else if (typeof item === 'object') {
      if (item.id) ids.add(item.id);
      if (item.asin) asins.add(item.asin.toUpperCase());
      if (item.titleKey) titles.add(item.titleKey);
      if (item.imageKey) images.add(item.imageKey);
    }
  }

  return { ids, asins, titles, images, recordsCount: records.length };
}

function isDealAlreadyPosted(deal, lookup) {
  if (!deal) return true;
  if (deal.id && lookup.ids.has(deal.id)) return true;
  if (deal.asin && lookup.asins.has(deal.asin.toUpperCase())) return true;
  const tKey = getTitleKey(deal.title);
  if (tKey && lookup.titles.has(tKey)) return true;
  const imgKey = getImageKey(deal.imageUrl);
  if (imgKey && lookup.images.has(imgKey)) return true;
  return false;
}

function recordPostedDeal(deal) {
  try {
    let records = getPostedRecords();
    const entry = {
      id: deal.id,
      asin: deal.asin ? deal.asin.toUpperCase() : undefined,
      title: deal.title,
      titleKey: getTitleKey(deal.title),
      imageKey: getImageKey(deal.imageUrl),
      productType: getProductType(deal),
      category: deal.category || 'general',
      store: deal.store || 'amazon',
      postedAt: Date.now(),
    };

    const alreadyExists = records.some((r) => {
      if (typeof r === 'string') return r === deal.id || (deal.asin && r === deal.asin);
      return (
        r.id === deal.id ||
        (deal.asin && r.asin === deal.asin.toUpperCase()) ||
        (entry.titleKey && r.titleKey === entry.titleKey) ||
        (entry.imageKey && r.imageKey === entry.imageKey)
      );
    });

    if (!alreadyExists) {
      records.push(entry);
    }

    if (records.length > MAX_POSTED_RECORDS) {
      records = records.slice(-MAX_POSTED_RECORDS);
    }

    const jsonStr = JSON.stringify(records, null, 2);
    fs.writeFileSync(POSTED_FILE, jsonStr);

    // Sync to Cloudflare D1 so restarts never wipe posted deals memory
    fetch('https://mizodeals.com/api/bot-auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ files: { 'posted_deals.json': jsonStr } }),
    }).catch(() => {});
  } catch (err) {
    console.error('Failed to record posted deal:', err.message);
  }
}

async function restorePostedDealsFromCloud() {
  if (fs.existsSync(POSTED_FILE)) return;
  try {
    console.log('📦 Local posted_deals.json missing. Restoring history from Cloudflare D1...');
    const authRes = await fetch('https://mizodeals.com/api/bot-auth', { signal: AbortSignal.timeout(15000) });
    if (authRes.ok) {
      const authData = await authRes.json();
      if (authData.success && authData.files && authData.files['posted_deals.json']) {
        fs.writeFileSync(POSTED_FILE, authData.files['posted_deals.json'], 'utf8');
        console.log(`✅ Restored posted_deals.json from Cloudflare D1!`);
      }
    }
  } catch (err) {
    console.warn('⚠️ Cloudflare D1 posted_deals.json restore notice:', err.message);
  }
}

function formatINR(amount) {
  return '₹' + amount.toLocaleString('en-IN');
}

function cleanTitle(str) {
  if (!str) return '';
  return str
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#8377;/g, '₹')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/buy\s+max\s+q(?:nty|ty)\s*:?/gi, '')
    .replace(/^[:\s\-\.\,]+|[:\s\-\.\,]+$/g, '')
    .trim();
}

function isMobilePhone(title) {
  if (!title) return false;
  const t = title.toLowerCase();
  if (/(?:cover|case|tempered|guard|skin|cable|charger|adapter|pouch|holder|stand|mount|lens\s*protector|stylus|strap|screen\s*protector|earbud|headphone|earphone|neckband|tws|smartwatch|watch|speaker)/i.test(t)) {
    return false;
  }
  return /\b(?:smartphone|mobile\s*phone|5g\s*phone|iphone(?:\s*(?:1[1-7]|se))?|galaxy\s*(?:s\d{2}[a-z]*|m\d{2}[a-z]*|a\d{2}[a-z]*|f\d{2}[a-z]*|z\s*(?:fold|flip)\d*|\w+)|redmi(?:\s*(?:note|\d{1,2}[a-z]*|c\d{1,2}|a\d{1,2}|\w+))?|realme(?:\s*(?:narzo|\d{1,2}[a-z]*|gt|p\d|c\d{1,2}|\w+))?|poco(?:\s*(?:c|m|x|f)\d{1,2}[a-z]*|\w+)?|oneplus(?:\s*(?:nord|\d{1,2}[a-z]?|\w+))?|iqoo(?:\s*(?:z|neo|\d{1,2}[a-z]*|\w+))?|motorola|moto\s*(?:edge|g\d{2})|pixel\s*(?:[6-9]|1[0-2])|vivo\s*(?:t\d|y\d|v\d|x\d|\w+)|oppo\s*(?:a\d|k\d|reno|find|\w+)|nothing\s*phone)\b/i.test(t);
}

function getProductType(deal) {
  if (!deal) return 'general';
  const t = (deal.title || '').toLowerCase();
  const cat = (deal.category || '').toLowerCase();
  if (isMobilePhone(t)) return 'smartphones';
  if (/shoe|sneaker|derby|loafer|boot|footwear|sandal|flip\s*flop|clog|oxford|formal\s*shoe/i.test(t)) return 'footwear';
  if (/hoodie|jacket|sweater|sweatshirt|fleece|winter|thermal|cardigan|coat|muffler|beanie|lukhum|gloves|scarf|woolen/i.test(t)) return 'winterwear';
  if (/handbag|tote|clutch|sling\s*bag|purse|earring|necklace|jewell?ery|pendant|bangle|bracelet|hair\s*clip|scrunchie|kurti|saree|dress/i.test(t)) return 'women_fashion';
  if (/shirt|t-shirt|pant|jeans|trouser|boxer|legging|trackpant/i.test(t)) return 'apparel';
  if (/light|led|rope|strip|decor|fairy|curtain|lamp|cove|christmas/i.test(t)) return 'festive_lights';
  if (/kettle|cooker|pan|knife|bottle|chopper|fryer|blender|toaster|mixer|heater|geyser|iron|vacuum/i.test(t)) return 'kitchen_home';
  if (/earbud|earphone|headphone|airdope|basspod|neckband|tws|headset/i.test(t)) return 'audio_gadgets';
  if (/smart\s*watch|smartwatch|watch|fitness\s*band/i.test(t)) return 'smartwatches';
  if (/power\s*bank|charger|cable|adapter|keyboard|mouse|ssd|hard\s*drive/i.test(t)) return 'tech_accessories';
  if (/shampoo|serum|facewash|cream|perfume|deodorant|lotion|sunscreen|loofah|soap|grooming|lipstick|kajal|mascara|makeup/i.test(t)) return 'beauty_grooming';
  return cat || 'general';
}

function formatMessage(deal, dealUrl = `https://mizodeals.com/deals/${deal.id}`) {
  const savings = deal.originalPrice - deal.dealPrice;
  const savingsText = savings > 0 ? ` (Save ${formatINR(savings)})` : '';
  const isWinter = /hoodie|jacket|sweater|sweatshirt|fleece|winter|thermal|cardigan|coat|muffler|beanie|lukhum|gloves|scarf|woolen/i.test(deal.title || '');
  const isFestive = /light|led|rope|strip|decor|fairy|curtain|lamp|bulb|christmas|cove/i.test(deal.title || '');

  let lootHeader = deal.isLootDeal || deal.discountPercent >= 50
    ? '*MAN TLAHNIAM NASA!*\n'
    : '*MAN TLAHNIAM!*\n';

  const pType = getProductType(deal);
  if (pType === 'smartphones') {
    lootHeader = '*📱 SMARTPHONE & 5G MOBILE LOOT!*\n';
  } else if (isWinter) {
    lootHeader = '*🧥 THLASIK INTHUAM LUMNA!*\n';
  } else if (pType === 'audio_gadgets' || pType === 'tech_accessories') {
    lootHeader = '*🎧 WIRELESS GADGETS & TECH DEALS!*\n';
  } else if (pType === 'kitchen_home') {
    lootHeader = '*🍳 CHOKA & IN CHHUNG MAMAWH!*\n';
  } else if (pType === 'beauty_grooming') {
    const isWomenSpecific = /women|woman|ladies|girl|lipstick|kajal|serum|sunscreen|lip\s*balm|skincare|handbag|tote|clutch|earring|necklace|dress|mascara|makeup|facial|lotion/i.test(deal.title || '') || deal.store === 'nykaa';
    lootHeader = isWomenSpecific ? '*✨ HMEICHHETÊ TAN BIK (BEAUTY & SKINCARE)!*\n' : '*✨ BEAUTY & GROOMING DEALS!*\n';
  } else if (pType === 'women_fashion') {
    lootHeader = '*✨ HMEICHHE DUHZAWNG / FASHION PICK!*\n';
  } else if (/shoe|sneaker|derby|loafer|boot|reebok|puma|adidas|nike/i.test(deal.title || '')) {
    lootHeader = '*👟 SNEAKER & SHOES DEALS!*\n';
  }

  const title = cleanTitle(deal.title);
  const cleanStore = (deal.store || 'amazon').toLowerCase().trim();
  const storeName = {
    flipkart: 'Flipkart',
    meesho: 'Meesho',
    myntra: 'Myntra',
    nykaa: 'Nykaa',
    ajio: 'Ajio',
    hm: 'H&M',
    amazon: 'Amazon.in'
  }[cleanStore] || (cleanStore === 'meesho' ? 'Meesho' : 'Amazon.in');

  return (
    `${lootHeader}` +
    `*${title}*\n\n` +
    `• Deal Price: *${formatINR(deal.dealPrice)}* ~${formatINR(deal.originalPrice)}~${savingsText}\n` +
    `• Discount: *${deal.discountPercent}% OFF*\n` +
    `• Store: ${storeName}\n` +
    `• Rating: ${deal.rating}/5 (${deal.ratingsCount.toLocaleString('en-IN')}+ reviews)\n` +
    `${deal.couponText ? `• Coupon: ${deal.couponText}\n` : ''}\n` +
    `👉 *Enna leh Leina (Deal Link):*\n${dealUrl}\n\n` +
    `📲 _Shared via Mizodeals VIP (mizodeals.com)_`
  );
}

async function postToFacebookPage(deal, caption, imageBuffer = null) {
  if (!FB_PAGE_ID || !FB_PAGE_ACCESS_TOKEN) return false;
  try {
    const fbCaption = caption.replace(/\*/g, '').replace(/~/g, '');
    const fbApiUrl = `https://graph.facebook.com/v19.0/${FB_PAGE_ID}/photos`;

    let res;
    if (imageBuffer) {
      const fd = new FormData();
      fd.append('source', new Blob([imageBuffer], { type: 'image/jpeg' }), 'deal.jpg');
      fd.append('caption', fbCaption);
      fd.append('access_token', FB_PAGE_ACCESS_TOKEN);

      res = await fetch(fbApiUrl, {
        method: 'POST',
        body: fd,
      });
    } else {
      let photoUrl = deal.imageUrl || '';
      res = await fetch(fbApiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: photoUrl,
          caption: fbCaption,
          access_token: FB_PAGE_ACCESS_TOKEN,
        }),
      });
    }

    const data = await res.json();
    if (data.id) {
      console.log(`📘 [Facebook Page] Posted deal: ${deal.title.slice(0, 30)} (Photo ID: ${data.id})`);
      return true;
    } else {
      console.error(`📘 [Facebook Page Error]:`, data.error?.message || data);
      return false;
    }
  } catch (err) {
    console.error(`Failed to post to Facebook Page:`, err.message);
    return false;
  }
}

const CHANNEL_JID = '120363414138647022@newsletter';
const OFFICIAL_GROUP_JID = '120363430926865877@g.us';
const GROUP_INVITE_CODE = 'KCBEUuKs3Dk4TsowNE34dj';
const FB_PAGE_ID = process.env.FB_PAGE_ID || '';
const FB_PAGE_ACCESS_TOKEN = process.env.FB_PAGE_ACCESS_TOKEN || '';
let lastFbPostTime = 0;
const FB_COOLDOWN_MS = 2.5 * 60 * 60 * 1000; // 2.5 hours minimum interval between FB posts
const FB_MIN_DISCOUNT = 60; // Only post high-discount deals (>= 60% OFF) to Facebook

function canPostToFacebook(deal) {
  if (!FB_PAGE_ID || !FB_PAGE_ACCESS_TOKEN) return { allowed: false, reason: 'No FB credentials' };

  // 1. High discount / Loot deal gate
  const discount = deal.discountPercent || 0;
  if (discount < FB_MIN_DISCOUNT && !deal.isLootDeal) {
    return { allowed: false, reason: `Discount ${discount}% is below ${FB_MIN_DISCOUNT}% threshold` };
  }

  // 2. Active hours gate: 08:00 AM to 10:30 PM IST (Asia/Kolkata)
  const now = new Date();
  const istTimeStr = now.toLocaleTimeString('en-US', { timeZone: 'Asia/Kolkata', hour12: false });
  const [hStr, mStr] = istTimeStr.split(':');
  const totalMins = parseInt(hStr, 10) * 60 + parseInt(mStr, 10);
  if (totalMins < 480 || totalMins > 1350) {
    return { allowed: false, reason: `Outside active hours (08:00 AM - 10:30 PM IST)` };
  }

  // 3. Cooldown gate: minimum 2.5 hours between Facebook posts
  const elapsed = Date.now() - lastFbPostTime;
  if (elapsed < FB_COOLDOWN_MS) {
    const minsLeft = Math.ceil((FB_COOLDOWN_MS - elapsed) / 60000);
    return { allowed: false, reason: `Cooldown active (${minsLeft} mins left)` };
  }

  return { allowed: true };
}
let activeGroupJid = OFFICIAL_GROUP_JID;
let latestQrDataUrl = null;
let isConnected = false;
let activeSock = null;
let lastCheckTime = null;
let lastSuccessfulPostTime = 0;
const MIN_AUTO_POST_INTERVAL_MS = 30 * 60 * 1000; // Strictly minimum 30 minutes between automated deal posts
let isChecking = false;
let reconnectTimer = null;
let autoPostInterval = null;

function triggerReconnect(delayMs = 3000) {
  if (reconnectTimer) return;
  isConnected = false;
  if (activeSock) {
    try {
      activeSock.ev.removeAllListeners();
      activeSock.ws?.close();
      activeSock.end(undefined);
    } catch (e) {}
    activeSock = null;
  }
  console.log(`🔄 Triggering bot reconnection in ${delayMs / 1000}s...`);
  reconnectTimer = setTimeout(async () => {
    reconnectTimer = null;
    await startBot();
  }, delayMs);
}

function ensureAutoPostScheduler() {
  if (autoPostInterval) return;
  console.log('⏰ Auto-post timer scheduled: Checks every 2 minutes (strictly 30m cooldown enforced)');
  autoPostInterval = setInterval(async () => {
    if (!activeSock || !isConnected) {
      console.log('⏳ Auto-post timer: Bot not connected, attempting reconnect...');
      triggerReconnect(1000);
      return;
    }
    if (isChecking) {
      return;
    }
    isChecking = true;
    try {
      await checkAndPostDeals(activeSock, CHANNEL_JID);
    } catch (err) {
      console.error('Auto-post cycle error:', err.message);
    } finally {
      isChecking = false;
    }
  }, 2 * 60 * 1000);
}

// Keep Render Free Tier awake
const SELF_URL = process.env.RENDER_EXTERNAL_URL || 'https://mizodeals-whatsapp-bot.onrender.com';
setInterval(() => {
  fetch(SELF_URL).catch(() => {});
}, 8 * 60 * 1000);

// Cloud Web Server for Render/Railway with live status, manual trigger, & Web QR Code
const PORT = process.env.PORT || 3000;
http
  .createServer(async (req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });

    if (req.url === '/restart') {
      console.log('🔄 Manual restart requested via /restart endpoint');
      if (activeSock) {
        try {
          activeSock.ev.removeAllListeners();
          activeSock.ws?.close();
          activeSock.end(undefined);
        } catch (e) {}
        activeSock = null;
      }
      setTimeout(() => process.exit(0), 1000);
      return res.end(`<!doctype html><html><body style="font-family:system-ui,sans-serif;text-align:center;padding:50px 20px;background:#FAF9F5;">
        <h2>🔄 Clean Rebooting WhatsApp Bot...</h2>
        <p>Container supervisor restarting with fresh memory. Please wait 6 seconds.</p>
        <script>setTimeout(() => { window.location.href = '/'; }, 6000);</script>
      </body></html>`);
    }

    if (req.url === '/reset') {
      console.log('⚠️ Manual session reset requested via /reset endpoint');
      try {
        if (fs.existsSync(AUTH_DIR)) fs.rmSync(AUTH_DIR, { recursive: true, force: true });
      } catch (e) {}
      fetch('https://mizodeals.com/api/bot-auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reset: true }),
      }).catch(() => {});
      triggerReconnect(1000);
      return res.end(`<!doctype html><html><body style="font-family:system-ui,sans-serif;text-align:center;padding:50px 20px;background:#FAF9F5;">
        <h2>🔄 Resetting WhatsApp Bot Session...</h2>
        <p>Old credentials wiped. Generating fresh QR code...</p>
        <script>setTimeout(() => { window.location.href = '/'; }, 3000);</script>
      </body></html>`);
    }

    if (req.url === '/clear-posted' || req.url === '/reset-posted') {
      console.log('🧹 Clearing posted deals history cache...');
      try {
        fs.writeFileSync(POSTED_FILE, '[]', 'utf8');
        fetch('https://mizodeals.com/api/bot-auth', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ files: { 'posted_deals.json': '[]' } }),
        }).catch(() => {});
      } catch (e) {}
      return res.end(`<!doctype html><html><body style="font-family:system-ui,sans-serif;text-align:center;padding:50px 20px;background:#FAF9F5;">
        <h2>✅ History Cleared!</h2>
        <p>Triggering immediate post of top active loots...</p>
        <script>setTimeout(() => { window.location.href = '/post-now'; }, 1500);</script>
      </body></html>`);
    }

    if (req.url === '/clean-auth') {
      console.log('🧹 Purging stale session keys while keeping credentials...');
      try {
        if (fs.existsSync(AUTH_DIR)) {
          const files = fs.readdirSync(AUTH_DIR);
          for (const f of files) {
            if (f !== 'creds.json' && !f.startsWith('app-state-sync-key-')) {
              try { fs.unlinkSync(path.join(AUTH_DIR, f)); } catch (e) {}
            }
          }
        }
        await fetch('https://mizodeals.com/api/bot-auth', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ clean_sessions: true }),
        });
      } catch (e) {}
      setTimeout(() => process.exit(0), 1000);
      return res.end(`<!doctype html><html><body style="font-family:system-ui,sans-serif;text-align:center;padding:50px 20px;background:#FAF9F5;">
        <h2>✨ Stale Signal Session Keys Purged!</h2>
        <p>Login credentials preserved. Bot is restarting fresh and will auto-negotiate clean group encryption keys.</p>
        <script>setTimeout(() => { window.location.href = '/'; }, 6000);</script>
      </body></html>`);
    }

    if (req.url === '/group-status') {
      if (!activeSock) return res.end(JSON.stringify({ error: 'No active socket' }));
      try {
        const target = activeGroupJid || OFFICIAL_GROUP_JID;
        const metadata = await activeSock.groupMetadata(target);
        const botUser = activeSock.user;
        const botParticipant = metadata.participants.find(
          (p) => p.id.split(':')[0] === botUser?.id?.split(':')[0]
        );
        return res.end(
          JSON.stringify(
            {
              groupSubject: metadata.subject,
              groupId: metadata.id,
              announce: metadata.announce,
              restrict: metadata.restrict,
              botUserId: botUser?.id,
              botIsAdmin: !!botParticipant?.admin,
              botRole: botParticipant?.admin || 'regular member',
              participantsCount: metadata.participants.length,
            },
            null,
            2
          )
        );
      } catch (err) {
        return res.end(JSON.stringify({ error: err.message }));
      }
    }

    if (req.url === '/send-test-group') {
      if (!activeSock) return res.end(JSON.stringify({ error: 'No active socket' }));
      try {
        const target = activeGroupJid || OFFICIAL_GROUP_JID;
        const msgRes = await activeSock.sendMessage(target, {
          text: `🤖 Mizodeals Bot Diagnostic Test (${new Date().toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata' })})`,
        });
        return res.end(JSON.stringify({ success: true, target, msgRes }, null, 2));
      } catch (err) {
        return res.end(JSON.stringify({ success: false, error: err.message }));
      }
    }

    if (req.url === '/post-now' || req.url === '/trigger') {
      if (!isConnected || !activeSock) {
        return res.end(`<!doctype html><html><body style="font-family:system-ui,sans-serif;text-align:center;padding:40px;background:#FAF9F5;">
          <h2>⚠️ Bot is not connected yet!</h2>
          <p>Please wait for WhatsApp connection or scan QR code.</p>
          <p><a href="/" style="display:inline-block;padding:8px 16px;background:#ea580c;color:white;border-radius:8px;text-decoration:none;">Go Back</a></p>
        </body></html>`);
      }
      if (isChecking) {
        return res.end(`<!doctype html><html><body style="font-family:system-ui,sans-serif;text-align:center;padding:40px;background:#FAF9F5;">
          <h2>⏳ Post check already running...</h2>
          <p>A deal check is currently underway. Please wait a moment.</p>
          <p><a href="/" style="display:inline-block;padding:8px 16px;background:#ea580c;color:white;border-radius:8px;text-decoration:none;">Go Back</a></p>
        </body></html>`);
      }
      isChecking = true;
      try {
        await checkAndPostDeals(activeSock, CHANNEL_JID, true);
      } catch (err) {
        console.error('Manual trigger error:', err.message);
      } finally {
        isChecking = false;
      }

      return res.end(`<!doctype html><html><body style="font-family:system-ui,sans-serif;text-align:center;padding:40px 20px;background:#FAF9F5;color:#1c1917;">
        <h2>⚡ Deal Posting Cycle Finished!</h2>
        <p>Check the live log below or look at the WhatsApp Channel:</p>
        <div style="max-width:600px;margin:20px auto;text-align:left;background:#0f172a;color:#f8fafc;padding:16px;border-radius:14px;font-family:monospace;font-size:12px;white-space:pre-wrap;max-height:300px;overflow-y:auto;">
${recentLogs.slice(-15).join('\n')}
        </div>
        <p><a href="/" style="display:inline-block;padding:10px 20px;background:#ea580c;color:white;border-radius:10px;text-decoration:none;font-weight:600;">Return to Dashboard</a></p>
      </body></html>`);
    }

    if (isConnected) {
      const postedCount = getPostedRecords().length;
      res.end(`<!doctype html>
<html>
  <head><title>Mizodeals Bot — 24/7 Cloud Active</title><meta name="viewport" content="width=device-width,initial-scale=1"></head>
  <body style="font-family:system-ui,sans-serif;text-align:center;padding:40px 20px;background:#FAF9F5;color:#1c1917;">
    <div style="max-width:540px;margin:auto;background:white;padding:30px;border-radius:24px;border:1px solid #EAE6DF;box-shadow:0 10px 25px -5px rgba(0,0,0,0.05);">
      <div style="font-size:42px;margin-bottom:12px;">✅</div>
      <h2 style="color:#16a34a;margin:0 0 10px 0;">Mizodeals Bot Is Running 24/7!</h2>
      <p style="font-size:13px;color:#78716c;">Connected to Official Channel:<br><code style="background:#f5f5f4;padding:4px 8px;border-radius:6px;">120363414138647022@newsletter</code></p>
      
      <div style="margin:20px 0;padding:14px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:16px;text-align:left;font-size:13px;color:#334155;line-height:1.6;">
        <div>🚀 <b>Bot Build:</b> <span style="background:#dcfce7;color:#15803d;padding:2px 8px;border-radius:6px;font-weight:600;">v3.6-high-discount-gadget-focus</span></div>
        <div>⏰ <b>Last Post Check:</b> ${lastCheckTime ? lastCheckTime.toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata' }) : 'In Progress...'}</div>
        <div>⏳ <b>Next Auto Post:</b> ${lastSuccessfulPostTime ? new Date(lastSuccessfulPostTime + MIN_AUTO_POST_INTERVAL_MS).toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata' }) : 'Every 30 minutes'}</div>
        <div>📦 <b>Total Deals Sent:</b> ${postedCount}</div>
        <div>🔄 <b>Auto Frequency:</b> Strictly every 30 minutes (Anti-Spam)</div>
        <div>📘 <b>Facebook Page:</b> ${FB_PAGE_ID && FB_PAGE_ACCESS_TOKEN ? '<span style="background:#dbeafe;color:#1e40af;padding:2px 8px;border-radius:6px;font-weight:600;">Active (Smart Anti-Spam: 60%+ Loot Only, 2.5h Cooldown)</span>' : '<span style="background:#f1f5f9;color:#64748b;padding:2px 8px;border-radius:6px;">Waiting for credentials</span>'}</div>
      </div>

      <div style="display:flex;gap:10px;justify-content:center;flex-wrap:wrap;">
        <a href="/post-now" style="display:inline-block;padding:12px 20px;background:#ea580c;color:white;border-radius:12px;text-decoration:none;font-weight:bold;font-size:14px;box-shadow:0 4px 12px rgba(234,88,12,0.25);">⚡ Post Deals Now</a>
        <a href="/clean-auth" style="display:inline-block;padding:12px 20px;background:#0284c7;color:white;border-radius:12px;text-decoration:none;font-weight:bold;font-size:14px;">✨ Clean Stale Keys</a>
        <a href="/restart" style="display:inline-block;padding:12px 20px;background:#475569;color:white;border-radius:12px;text-decoration:none;font-weight:bold;font-size:14px;">🔄 Reconnect Bot</a>
      </div>
      <p style="font-size:11px;color:#a8a29e;margin-top:10px;">Runs automatically every 30 mins. Click above to trigger an immediate check or reconnect.</p>

      <div style="margin-top:24px;text-align:left;background:#0f172a;color:#f8fafc;padding:16px;border-radius:14px;font-family:monospace;font-size:11px;max-height:260px;overflow-y:auto;white-space:pre-wrap;border:1px solid #334155;">
<b style="color:#38bdf8;">📋 Live Bot Activity Log:</b><br><br>
${recentLogs.length > 0 ? recentLogs.join('\n') : 'Waiting for next activity...'}
      </div>
    </div>
  </body>
</html>`);
    } else if (latestQrDataUrl) {
      res.end(`<!doctype html>
<html>
  <head><title>Scan QR Code — Mizodeals Bot</title><meta name="viewport" content="width=device-width,initial-scale=1"></head>
  <body style="font-family:system-ui,sans-serif;text-align:center;padding:40px 20px;background:#FAF9F5;color:#1c1917;">
    <div style="max-width:440px;margin:auto;background:white;padding:30px;border-radius:24px;border:1px solid #EAE6DF;box-shadow:0 10px 25px -5px rgba(0,0,0,0.05);">
      <h2 style="margin:0 0 8px 0;color:#ea580c;">📲 Scan QR Code</h2>
      <p style="font-size:13px;color:#78716c;margin:0 0 20px 0;">Open WhatsApp &gt; Settings/Menu &gt; <b>Linked Devices &gt; Link a Device</b></p>
      <img src="${latestQrDataUrl}" style="width:240px;height:240px;border:4px solid #ea580c;border-radius:16px;padding:6px;background:white;" alt="WhatsApp QR Code" />
      <p style="font-size:11px;color:#a8a29e;margin-top:16px;">This page will automatically refresh once connected.</p>
      <script>setTimeout(() => location.reload(), 4000);</script>
    </div>
  </body>
</html>`);
    } else {
      res.end(`<!doctype html>
<html>
  <head><title>Mizodeals Bot Starting</title><meta name="viewport" content="width=device-width,initial-scale=1"></head>
  <body style="font-family:system-ui,sans-serif;text-align:center;padding:40px 20px;background:#FAF9F5;color:#1c1917;">
    <div style="max-width:540px;margin:auto;background:white;padding:30px;border-radius:24px;border:1px solid #EAE6DF;box-shadow:0 10px 25px -5px rgba(0,0,0,0.05);">
      <div style="font-size:36px;margin-bottom:8px;">⏳</div>
      <h3 style="margin:0 0 10px 0;">Mizodeals Bot Starting Up...</h3>
      <p style="font-size:13px;color:#78716c;">Connecting to WhatsApp network, please wait a moment...</p>

      <div style="margin:20px 0;text-align:left;background:#0f172a;color:#f8fafc;padding:14px;border-radius:12px;font-family:monospace;font-size:11px;max-height:220px;overflow-y:auto;white-space:pre-wrap;">
<b style="color:#38bdf8;">📋 Live Bot Activity Log:</b><br><br>
${recentLogs.length > 0 ? recentLogs.join('\n') : 'Initializing bot...'}
      </div>

      <div style="display:flex;gap:10px;justify-content:center;margin-top:15px;">
        <a href="/restart" style="display:inline-block;padding:10px 16px;background:#475569;color:white;border-radius:10px;text-decoration:none;font-size:13px;font-weight:600;">🔄 Reconnect</a>
        <a href="/reset" style="display:inline-block;padding:10px 16px;background:#ea580c;color:white;border-radius:10px;text-decoration:none;font-size:13px;font-weight:600;">⚠️ Reset & New QR</a>
      </div>
      <script>setTimeout(() => location.reload(), 4000);</script>
    </div>
  </body>
</html>`);
    }
  })
  .listen(PORT, '0.0.0.0', () => {
    console.log(`🌐 Web status server listening on port ${PORT}`);
  });

async function startBot() {
  try {
    let sessionRestoredFromD1 = false;
    // 1. Auto-restore session from Cloudflare D1 if local auth_info is missing
    const credsPath = path.join(AUTH_DIR, 'creds.json');
    if (!fs.existsSync(credsPath)) {
      console.log('📦 Local credentials missing. Restoring session from Cloudflare D1...');
      try {
        const authRes = await fetch('https://mizodeals.com/api/bot-auth', { signal: AbortSignal.timeout(15000) });
        if (authRes.ok) {
          const authData = await authRes.json();
          if (authData.success && authData.files) {
            if (!fs.existsSync(AUTH_DIR)) fs.mkdirSync(AUTH_DIR, { recursive: true });
            let restoredCount = 0;
            for (const [fname, content] of Object.entries(authData.files)) {
              if (fname === 'posted_deals.json') {
                fs.writeFileSync(POSTED_FILE, content, 'utf8');
              } else if (fname === 'creds.json' || fname.startsWith('app-state-sync-key-')) {
                fs.writeFileSync(path.join(AUTH_DIR, fname), content, 'utf8');
                restoredCount++;
              }
            }
            console.log(`✅ Restored ${restoredCount} essential auth session files from Cloudflare D1!`);
            sessionRestoredFromD1 = true;
          }
        }
      } catch (d1Err) {
        console.warn('⚠️ Cloudflare D1 session restore notice:', d1Err.message);
      }
    }

    // 2. Ensure posted_deals.json is restored even if credentials already existed
    await restorePostedDealsFromCloud();

    const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);

    const sock = makeWASocket({
      auth: state,
      logger: pino({ level: 'silent' }),
      printQRInTerminal: false,
      keepAliveIntervalMs: 25_000,
      connectTimeoutMs: 60_000,
      defaultQueryTimeoutMs: 60_000,
      retryRequestDelayMs: 500,
      maxMsgRetryCount: 5,
    });

    const syncCredsToCloud = async () => {
      saveCreds();
      try {
        const credsFile = path.join(AUTH_DIR, 'creds.json');
        if (fs.existsSync(credsFile)) {
          const credsContent = fs.readFileSync(credsFile, 'utf8');
          fetch('https://mizodeals.com/api/bot-auth', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ files: { 'creds.json': credsContent } }),
          }).catch(() => {});
        }
      } catch (e) {}
    };

    const syncAllAuthToCloud = async () => {
      try {
        if (!fs.existsSync(AUTH_DIR)) return;
        const files = fs.readdirSync(AUTH_DIR);
        // Only back up essentials: creds and app-state-sync keys; avoid ephemeral lid/pre-key bloat
        const essentialFiles = files.filter(
          (f) => f === 'creds.json' || f.startsWith('app-state-sync-key-')
        );
        console.log(`☁️ Syncing ${essentialFiles.length} essential auth files to Cloudflare D1...`);
        const fileMap = {};
        for (const f of essentialFiles) {
          fileMap[f] = fs.readFileSync(path.join(AUTH_DIR, f), 'utf8');
        }
        await fetch('https://mizodeals.com/api/bot-auth', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ files: fileMap }),
        });
        console.log(`✅ Essential auth securely backed up to Cloudflare D1!`);
      } catch (e) {
        console.warn('⚠️ Cloud sync notice:', e.message);
      }
    };

    sock.ev.on('creds.update', syncCredsToCloud);

    sock.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect, qr } = update;

      if (qr) {
        console.log('\n======================================================');
        console.log('📲 I PHONE WHATSAPP-IN HE QR CODE HI SCAN RAWH LE:');
        console.log('   (WhatsApp > Settings/Menu > Linked Devices > Link a Device)');
        console.log('======================================================\n');
        qrcode.generate(qr, { small: true });
        try {
          latestQrDataUrl = await QRCode.toDataURL(qr);
        } catch (e) {}
        isConnected = false;
      }

      if (connection === 'close') {
        isConnected = false;
        const statusCode = lastDisconnect?.error?.output?.statusCode;
        const isLoggedOut = statusCode === DisconnectReason.loggedOut;
        console.log(`Connection closed (statusCode: ${statusCode}). Logged out: ${isLoggedOut}`);

        // Thoroughly dismantle closed socket
        try {
          sock.ev.removeAllListeners();
          sock.ws?.close();
          sock.end(undefined);
        } catch (e) {}
        if (activeSock === sock) activeSock = null;

        if (isLoggedOut) {
          console.warn('⚠️ WhatsApp session logged out / expired (401). Purging stale auth for fresh QR...');
          try {
            if (fs.existsSync(AUTH_DIR)) fs.rmSync(AUTH_DIR, { recursive: true, force: true });
          } catch (e) {}
          fetch('https://mizodeals.com/api/bot-auth', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ reset: true }),
          }).catch(() => {});
          triggerReconnect(1500);
        } else if (statusCode === 440) {
          console.warn('⚠️ Connection replaced (440). Backing off 20s to break collision loop...');
          triggerReconnect(20000);
        } else {
          triggerReconnect(4000);
        }
      } else if (connection === 'open') {
        isConnected = true;
        activeSock = sock;
        latestQrDataUrl = null;
        console.log('\n======================================================');
        console.log('✅ WHATSAPP BOT CONNECTED HLAWHTLING TAKIN!');
        console.log(`📢 Official Channel Connected: ${CHANNEL_JID}`);

        // Automatically resolve Target Group JID (with guaranteed fallback)
        try {
          const participatingGroups = await sock.groupFetchAllParticipating();
          for (const [jid, group] of Object.entries(participatingGroups)) {
            console.log(`👥 Found WhatsApp Group: "${group.subject}" (${jid})`);
            activeGroupJid = jid.includes('@') ? jid : `${jid}@g.us`;
          }
          if (!activeGroupJid && GROUP_INVITE_CODE) {
            const inviteInfo = await sock.groupGetInviteInfo(GROUP_INVITE_CODE);
            if (inviteInfo && inviteInfo.id) {
              activeGroupJid = inviteInfo.id.includes('@') ? inviteInfo.id : `${inviteInfo.id}@g.us`;
            }
          }
          if (!activeGroupJid) {
            activeGroupJid = OFFICIAL_GROUP_JID;
          }
          console.log(`🎯 Target WhatsApp Group: ${activeGroupJid}`);
        } catch (gErr) {
          activeGroupJid = OFFICIAL_GROUP_JID;
          console.warn('⚠️ Group resolution note, using default group:', activeGroupJid);
        }

        console.log('======================================================\n');

        if (!sessionRestoredFromD1 && !hasSyncedAllAuth) {
          hasSyncedAllAuth = true;
          syncAllAuthToCloud().catch(() => {});
        }
        ensureAutoPostScheduler();

        setTimeout(async () => {
          if (!isChecking && activeSock) {
            isChecking = true;
            try {
              await checkAndPostDeals(activeSock, CHANNEL_JID, false);
            } finally {
              isChecking = false;
            }
          }
        }, 3000);
      }
    });
  } catch (err) {
    console.error('Fatal error starting WhatsApp bot:', err.message);
    triggerReconnect(5000);
  }
}

async function checkAndPostDeals(sock, channelJid, isManual = false) {
  if (!sock || !channelJid) return;
  lastCheckTime = new Date();

  // Rate Limiting Cooldown: strictly enforce minimum 30 minutes between automated deal posts
  const now = Date.now();
  if (!isManual && lastSuccessfulPostTime > 0 && now - lastSuccessfulPostTime < MIN_AUTO_POST_INTERVAL_MS) {
    const minsLeft = Math.ceil((MIN_AUTO_POST_INTERVAL_MS - (now - lastSuccessfulPostTime)) / 60000);
    if (minsLeft % 5 === 0 || now - lastSuccessfulPostTime < 130000) {
      console.log(`⏳ [Cooldown Active] Last deal post was only ${Math.round((now - lastSuccessfulPostTime) / 60000)}m ago. Next automated post eligible in ${minsLeft}m.`);
    }
    return;
  }

  // Ensure target group is resolved with guaranteed fallback
  if (!activeGroupJid) {
    activeGroupJid = OFFICIAL_GROUP_JID;
  }

  const currentSource = SCRAPER_SOURCES[currentSourceIndex % SCRAPER_SOURCES.length];
  currentSourceIndex++;

  console.log(`\n======================================================`);
  console.log(`[${new Date().toLocaleTimeString()}] 🔄 DEAL POSTING CYCLE: [Source rotation: ${currentSource.toUpperCase()}]`);
  console.log(`======================================================`);

  // Step 1: Fetch live deals from database with safe fallback
  console.log(`[${new Date().toLocaleTimeString()}] Checking live unposted loot deals in catalog...`);

  try {
    let res;
    try {
      res = await fetch('https://mizodeals.com/api/deals?status=all&limit=300', { signal: AbortSignal.timeout(8000) });
    } catch (e) {
      console.warn('mizodeals.com API slow, falling back to pages.dev...');
      res = await fetch('https://mizodeals.pages.dev/api/deals?status=all&limit=300', { signal: AbortSignal.timeout(8000) });
    }

    if (!res.ok) {
      console.error(`Deals API responded with status ${res.status}`);
      return;
    }
    const data = await res.json();
    if (!data.success || !Array.isArray(data.deals)) return;

    const lookup = getPostedLookup();

    const isEligibleDeal = (d) => {
      const isPriority = d.asin && PRIORITY_ASINS.includes(d.asin.toUpperCase());
      if (!isPriority && isDealAlreadyPosted(d, lookup)) return false;
      // Strictly reject any expired or inactive deals
      if (d.status && d.status !== 'active') return false;
      if (d.isExpired) return false;
      if (!d.asin || d.asin.startsWith('DM')) return false;
      if ((!d.store || d.store === 'amazon') && !/^[A-Z0-9]{10}$/i.test(d.asin)) return false;
      if (d.affiliateUrl && (d.affiliateUrl.includes('/s?k=') || d.affiliateUrl.includes('/deal/'))) return false;
      if (!d.imageUrl || !d.imageUrl.startsWith('http') || d.imageUrl.length < 15) return false;
      if (d.imageUrl.includes('unsplash.com') || d.imageUrl.includes('photo-1523275335684-37898b6baf30')) return false;

      // Price Sweet Spot Gate: Mizoram WhatsApp shoppers convert primarily between ₹100 and ₹3,500.
      // Filter out heavy deliberate purchases (> ₹4,500 like ACs, refrigerators, large TVs)
      // EXCEPT genuine smartphones/5G mobiles (up to ₹85,000) and micro items (< ₹80) unless in PRIORITY_ASINS.
      const isPhone = isMobilePhone(d.title || '');
      if (!isPriority) {
        if (isPhone) {
          if (d.dealPrice > 85000 || (d.discountPercent < 8 && ((d.originalPrice || 0) - d.dealPrice < 1000))) return false;
        } else {
          if (d.dealPrice > 4500) return false;
          if (d.dealPrice < 80) return false;
        }
      }

      // Strictly exclude phone back covers, mobile cases, and tempered glass screen protectors
      // (Model-specific, low conversion, clutter/spam for customers)
      if (/(?:back\s*cover|mobile\s*cover|phone\s*cover|phone\s*case|bumper\s*case|magnetic\s*case|tempered\s*glass|screen\s*protector|camera\s*lens\s*protector|cases?\s*(?:&|and)\s*covers?|\bcase\s*for\s+(?:iphone|oneplus|samsung|redmi|realme|vivo|oppo|poco|xiaomi|ipad)|\bcover\s*for\s+(?:iphone|oneplus|samsung|redmi|realme|vivo|oppo|poco|xiaomi|ipad))/i.test(d.title || '')) {
        return false;
      }

      // Strictly exclude bulky furniture and heavy freight items (Low demand, exorbitant delivery fee in Mizoram)
      if (/\b(?:sofa|couch|mattress|wardrobe|almirah|recliner|dining\s*table|office\s*chair|gaming\s*chair|bookshelf|bookcase|dressing\s*table|tv\s*unit|tv\s*cabinet|bed\s*(?:king|queen|single|double)|heavy\s*cabinet)\b/i.test(d.title || '') || d.category === 'furniture') {
        return false;
      }

      // Strictly exclude heavy home appliances (massive delivery friction, high freight damage)
      if (/\b(?:washing\s*machine|refrigerator|fridge|split\s*ac|air\s*conditioner|window\s*ac|dishwasher|storage\s*water\s*heater|kitchen\s*chimney)\b/i.test(d.title || '')) {
        return false;
      }

      // Strictly exclude oversized or high-breakage items / vehicle tyres
      if (/\b(?:full\s*length\s*mirror|oversized\s*mirror|car\s*tyre|car\s*tire|bike\s*tyre|alloy\s*wheel)\b/i.test(d.title || '')) {
        return false;
      }

      const isGadget = d.category === 'gadgets' || d.category === 'electronics';
      if (isGadget) {
        // Gadgets sweet spot: 30% to 75% discount
        return (d.discountPercent >= 30 && d.discountPercent <= 75) || d.isLootDeal;
      }

      // Pillar 2: Kitchen Utilities & Daily Home Essentials
      if (d.category === 'home_kitchen' || /kettle|bottle|flask|knife|cooker|pan|chopper|grinder|organizer|rack|dispenser/i.test(d.title || '')) {
        return d.discountPercent >= 30 || d.isLootDeal;
      }

      // Pillar 3: Personal Grooming & Beauty
      if (d.category === 'beauty' || /perfume|serum|sunscreen|facewash|cream|lotion|shampoo|trimmer|shaver|hair\s*dryer/i.test(d.title || '')) {
        return d.discountPercent >= 20 || d.isLootDeal;
      }

      // Seasonal winterwear & warm accessories (Nov to Feb in Mizoram): Lukhum lum, mufflers, hoodies, jackets, gloves at 30%+ discount
      const currentMonth = new Date().getMonth(); // 10 = Nov, 11 = Dec, 0 = Jan, 1 = Feb
      if ([10, 11, 0, 1].includes(currentMonth) && /hoodie|jacket|sweater|sweatshirt|fleece|winter|thermal|cardigan|coat|muffler|beanie|lukhum|gloves|scarf|woolen/i.test(d.title || '')) {
        return d.discountPercent >= 30 || d.isLootDeal;
      }

      // Other categories: Solid high discounts (40%+ or marked loot)
      return d.isLootDeal || d.discountPercent >= 40;
    };

    const candidates = data.deals.filter(isEligibleDeal);

    // If catalog is dry, harvest immediately so the cycle never stalls
    if (candidates.length === 0) {
      console.log(`🌾 Catalog dry (0 unposted candidates). Triggering instant harvest from ${currentSource}...`);
      try {
        const harvestLimit = currentSource === 'indiadesire' ? 60 : 35;
        const hRes = await fetch(`https://mizodeals.com/api/multi-scraper?autoPublish=true&source=${currentSource}&limit=${harvestLimit}`, { signal: AbortSignal.timeout(20000) });
        const hData = await hRes.json();
        console.log(`🌾 Harvested ${hData.count || 0} deals (${hData.insertedCount || 0} new). Re-fetching catalog...`);
        const refetchRes = await fetch('https://mizodeals.com/api/deals?status=active&limit=300', { signal: AbortSignal.timeout(8000) });
        const refetchData = await refetchRes.json();
        if (refetchData.success && Array.isArray(refetchData.deals)) {
          candidates.push(...refetchData.deals.filter(isEligibleDeal));
        }
      } catch (hErr) {
        console.warn('🌾 Instant harvest notice:', hErr.message);
      }
    }

    console.log(`Found ${candidates.length} unposted candidate loot deals.`);

    // Extract recent post history for dynamic anti-clustering and variety balancing
    const postedRecords = getPostedRecords();
    const validRecent = postedRecords
      .filter((r) => typeof r === 'object' && r.postedAt)
      .sort((a, b) => b.postedAt - a.postedAt);

    const recentTypes = validRecent.slice(0, 6).map((r) => r.productType || (r.title ? getProductType(r) : ''));
    const lastPostedType = recentTypes[0] || '';
    const lastPostedCategory = (validRecent[0] && validRecent[0].category) || '';
    const footwearCountRecent = recentTypes.filter((t) => t === 'footwear').length;

    // Quality-weighted scoring: Prioritize genuine high discounts, 30%-70% gadgets, high ratings, and customer favorites
    const computeDealScore = (d) => {
      let score = d.discountPercent || 0;
      const isGadget = d.category === 'gadgets' || d.category === 'electronics';
      const pType = getProductType(d);

      // 0. Manual Priority ASIN Boost (Top-of-Queue immediate post requested by admin)
      if (d.asin && PRIORITY_ASINS.includes(d.asin.toUpperCase())) {
        score += 500;
      }

      // 1. Gadgets sweet spot (30%-70% discount) get prioritized
      if (isGadget && d.discountPercent >= 30 && d.discountPercent <= 75) {
        score += 25;
      }

      // 1b. Price Sweet Spot Boost (Impulse Buy Optimization & Smartphone Exception):
      // 95%+ of community purchases occur between ₹100 and ₹3,000.
      if (isMobilePhone(d.title || '')) {
        score += 50; // Flagship & 5G budget smartphone priority boost
      } else if (d.dealPrice >= 199 && d.dealPrice <= 1499) {
        score += 35; // Prime impulse sweet spot (instant UPI/GPay purchase)
      } else if (d.dealPrice >= 100 && d.dealPrice <= 1999) {
        score += 25; // Broad impulse sweet spot
      } else if (d.dealPrice > 1999 && d.dealPrice <= 3499) {
        score += 15; // Mid-range sweet spot (branded shoes, winter jackets)
      } else if (d.dealPrice > 3500) {
        score -= 40; // High ticket penalty: slow conversion, deliberate buy
      }

      // 2. High customer rating: ensures quality over cheap junk
      if (d.rating >= 4.3) score += 20;
      else if (d.rating >= 4.0) score += 10;

      // 3. Top 3 Revenue Pillars (Data-backed Amazon customer velocity):
      // Pillar 1: Wireless & Tech Accessories
      if (pType === 'audio_gadgets' || pType === 'tech_accessories' || d.category === 'gadgets') {
        score += 35;
      }
      // Pillar 2: Home & Kitchen Utensils
      if (pType === 'kitchen_home' || d.category === 'home_kitchen') {
        score += 30;
      }
      // Pillar 3: Beauty, Skincare & Grooming (Highest direct conversion)
      if (pType === 'beauty_grooming' || d.category === 'beauty') {
        score += 35;
      }
      // Seasonal Winterwear
      if (pType === 'winterwear') {
        score += 25;
      }

      // 4. Significant rupee savings (value-for-money brand deals)
      const savings = (d.originalPrice || 0) - (d.dealPrice || 0);
      if (savings >= 1000) score += 15;
      else if (savings >= 500) score += 10;

      // 5. High review volume (trusted products)
      if ((d.ratingsCount || 0) >= 1000) score += 10;

      // 6. DYNAMIC ANTI-CLUSTERING & CATEGORY VARIETY BALANCING:
      // a. Immediate back-to-back duplicate product type penalty
      if (lastPostedType && pType === lastPostedType) {
        score -= 50; // Hard suppression so we never post the same product type twice in a row
      }

      // b. Strict Shoe / Footwear Throttling (Keep shoes as occasional highlights, never spamming)
      if (pType === 'footwear') {
        if (recentTypes.slice(0, 2).includes('footwear')) {
          score -= 60; // Absolute block if shoes were posted in any of the last 2 runs
        } else if (footwearCountRecent >= 2) {
          score -= 35; // Throttled if shoes already appeared 2+ times in recent history
        }
      }

      // c. Category alternation penalty
      if (lastPostedCategory && d.category === lastPostedCategory) {
        score -= 15;
      }

      // d. Freshness bonus for product types not seen in recent history
      if (!recentTypes.includes(pType)) {
        score += 20; // Reward unrepresented categories/types
      }

      // e. Gender Audience Balancing (Optimized: ~65% Male/Tech/Unisex, ~35% Female/Beauty/Home):
      const isFemaleOriented =
        d.category === 'beauty' ||
        d.category === 'home_kitchen' ||
        d.store === 'nykaa' ||
        pType === 'women_fashion' ||
        /women|woman|ladies|girl|female|lipstick|kajal|serum|sunscreen|lip\s*balm|skincare|handbag|tote|clutch|earring|necklace|dress|mascara|makeup|facial/i.test(
          d.title || ''
        );

      const recentFemaleCount = validRecent.slice(0, 4).filter((r) => {
        const title = (r.title || '').toLowerCase();
        return (
          r.category === 'beauty' ||
          r.category === 'home_kitchen' ||
          r.store === 'nykaa' ||
          /women|woman|ladies|girl|female|lipstick|kajal|serum|sunscreen|lip\s*balm|skincare|handbag|tote|clutch|earring|necklace|dress|mascara|makeup|facial/i.test(
            title
          )
        );
      }).length;

      if (isFemaleOriented) {
        if (recentFemaleCount === 0) {
          // If no female-targeted deals were posted in the last 4 runs, strongly boost (+45) to ensure women are never neglected
          score += 45;
        } else if (recentFemaleCount >= 2) {
          // If already 2+ of the last 4 deals were female-oriented, cool down to maintain the majority male preference
          score -= 20;
        }
      } else {
        // Male tech, gadgets & sneakers get boosted if female deals already had their turn
        if (recentFemaleCount >= 2) {
          score += 25;
        }
      }

      return score;
    };

    candidates.sort((a, b) => computeDealScore(b) - computeDealScore(a));

    // Diverse category ordering: group by category and interleave
    const byCategory = {};
    for (const d of candidates) {
      const cat = d.category || 'general';
      if (!byCategory[cat]) byCategory[cat] = [];
      byCategory[cat].push(d);
    }

    const orderedCandidates = [];
    const catKeys = Object.keys(byCategory);
    let index = 0;
    let added = true;
    while (added) {
      added = false;
      for (const cat of catKeys) {
        if (byCategory[cat][index]) {
          orderedCandidates.push(byCategory[cat][index]);
          added = true;
        }
      }
      index++;
    }

    // Interleave stores so Flipkart, Myntra, Nykaa, and Ajio are regularly featured alongside Amazon without static bias
    const byStore = {};
    for (const d of orderedCandidates) {
      const s = d.store || 'amazon';
      if (!byStore[s]) byStore[s] = [];
      byStore[s].push(d);
    }

    const diverseStoreCandidates = [];
    const storeKeys = Object.keys(byStore);
    // Rotate store keys dynamically based on hour to avoid single-store domination
    const rotOffset = storeKeys.length > 0 ? new Date().getHours() % storeKeys.length : 0;
    const rotatedStoreKeys = [...storeKeys.slice(rotOffset), ...storeKeys.slice(0, rotOffset)];

    let sIdx = 0;
    let sAdded = true;
    while (sAdded) {
      sAdded = false;
      for (const s of rotatedStoreKeys) {
        if (byStore[s][sIdx]) {
          diverseStoreCandidates.push(byStore[s][sIdx]);
          sAdded = true;
        }
      }
      sIdx++;
    }

    // Ensure priority ASINs are placed at the absolute front of diverseStoreCandidates
    diverseStoreCandidates.sort((a, b) => {
      const aPrio = a.asin && PRIORITY_ASINS.includes(a.asin.toUpperCase()) ? 1 : 0;
      const bPrio = b.asin && PRIORITY_ASINS.includes(b.asin.toUpperCase()) ? 1 : 0;
      return bPrio - aPrio;
    });

    // Select top 2 deals per run, ensuring strict variety: no duplicate title, image, ASIN, category, or product type!
    const toPost = [];
    const seenTitlesInBatch = new Set();
    const seenImagesInBatch = new Set();
    const seenAsinsInBatch = new Set();
    const seenCategoriesInBatch = new Set();
    const seenProductTypesInBatch = new Set();

    for (const d of diverseStoreCandidates) {
      const tKey = getTitleKey(d.title);
      const imgKey = getImageKey(d.imageUrl);
      const asinKey = d.asin ? d.asin.toUpperCase() : null;
      const pType = getProductType(d);
      const cat = d.category || 'general';
      const isPriority = d.asin && PRIORITY_ASINS.includes(d.asin.toUpperCase());

      if (tKey && seenTitlesInBatch.has(tKey)) continue;
      if (imgKey && seenImagesInBatch.has(imgKey)) continue;
      if (asinKey && seenAsinsInBatch.has(asinKey)) continue;

      // STRICT BATCH DIVERSITY: Never post 2 items of the same product type in one run (unless explicitly priority)!
      if (!isPriority) {
        if (seenProductTypesInBatch.has(pType)) continue;
        if (seenCategoriesInBatch.has(cat) && toPost.length < 1) continue;
        if (pType === 'footwear' && lastPostedType === 'footwear') continue;
      }

      if (tKey) seenTitlesInBatch.add(tKey);
      if (imgKey) seenImagesInBatch.add(imgKey);
      if (asinKey) seenAsinsInBatch.add(asinKey);
      seenProductTypesInBatch.add(pType);
      seenCategoriesInBatch.add(cat);

      toPost.push(d);
      if (toPost.length >= 2) break;
    }
    let postedCount = 0;
    let postedToFbThisCycle = false;

    for (const deal of toPost) {

      const dealUrl = `https://mizodeals.com/deals/${deal.id}`;
      const caption = formatMessage(deal, dealUrl);
      console.log(`Evaluating deal: "${deal.title.slice(0, 40)}..." (${deal.discountPercent}% OFF, store: ${deal.store || 'amazon'})`);

      let rawImg = deal.imageUrl || '';

      // 1. Live Amazon Availability & Deal Status Verification Gate
      if ((!deal.store || deal.store === 'amazon') && deal.asin && /^[A-Z0-9]{10}$/i.test(deal.asin)) {
        try {
          const verifyRes = await fetch(`https://mizodeals.com/api/deal?asin=${deal.asin}`, { signal: AbortSignal.timeout(6000) });
          if (verifyRes.ok) {
            const verifyData = await verifyRes.json();
            if (verifyData.success) {
              if (verifyData.isAvailable === false) {
                console.warn(`[SKIP - LIVE OUT OF STOCK] Deal ${deal.id} (${deal.asin}) is out of stock / expired on Amazon. Skipping.`);
                recordPostedDeal(deal);
                continue;
              }
              if (typeof verifyData.discountPercent === 'number' && verifyData.discountPercent < 15) {
                console.warn(`[SKIP - LIVE DISCOUNT TOO LOW] Deal ${deal.id} discount dropped to ${verifyData.discountPercent}%. Skipping.`);
                recordPostedDeal(deal);
                continue;
              }
              if (verifyData.imageUrl && verifyData.imageUrl.startsWith('http') && !verifyData.imageUrl.includes('images-eu.ssl-images-amazon')) {
                rawImg = verifyData.imageUrl;
              }
              if (verifyData.title) {
                deal.title = verifyData.title;
              }
              if (typeof verifyData.livePrice === 'number' && verifyData.livePrice > 0) {
                deal.dealPrice = verifyData.livePrice;
              }
              if (typeof verifyData.liveMrp === 'number' && verifyData.liveMrp > 0) {
                deal.originalPrice = verifyData.liveMrp;
              }
              if (typeof verifyData.discountPercent === 'number') {
                deal.discountPercent = verifyData.discountPercent;
              }
            }
          }
        } catch (vErr) {
          console.warn(`[LIVE VERIFY NOTICE] Deal ${deal.id}:`, vErr.message);
        }
      }

      let thumbBuffer = null;
      let fullImageBuffer = null;

      if (rawImg.includes('dealsmagnet.com/images/') && rawImg.includes('-s-')) {
        rawImg = rawImg.replace('-s-', '-m-');
      }
      if (deal.store === 'flipkart' && rawImg.includes('flixcart.com')) {
        rawImg = rawImg.replace(/\/image\/\d+\/\d+\//, '/image/832/832/');
      }
      if (deal.store === 'myntra' && rawImg.includes('myntassets.com')) {
        rawImg = rawImg.replace(/(?:dpr_[^,]+,)?(?:q_\d+,)?(?:w_\d+,)?(?:c_limit,)?(?:fl_progressive\/)?/, 'h_1440,q_95,w_1080/');
      }
      if (deal.store === 'meesho' && rawImg.includes('images.meesho.com') && rawImg.endsWith('.webp')) {
        rawImg = rawImg.replace(/\.webp$/i, '.jpg');
      }
      if (rawImg.includes('media-amazon.com')) {
        rawImg = rawImg.replace(/\._[A-Z0-9_,]+_\./i, '._SL800_.');
      }
      if (rawImg.includes('images-eu.ssl-images-amazon.com')) {
        rawImg = `https://m.media-amazon.com/images/P/${deal.asin.toUpperCase()}.01.MAIN._SL800_.jpg`;
      }

      // Fetch authentic image and decode via sharp into Jimp
      let img = null;
      try {
        if (rawImg && rawImg.startsWith('http')) {
          const fetchRes = await fetch(rawImg, { signal: AbortSignal.timeout(7000) });
          if (fetchRes.ok) {
            const rawBuffer = Buffer.from(await fetchRes.arrayBuffer());
            if (rawBuffer.length > 200) {
              const convertedJpeg = await sharp(rawBuffer).jpeg({ quality: 90 }).toBuffer();
              img = await Jimp.read(convertedJpeg);
            }
          }
        }
      } catch (imgErr) {
        console.warn(`[IMAGE FETCH/DECODE NOTICE] Deal ${deal.id}:`, imgErr.message);
      }

      // STRICT BLANK/CORRUPT IMAGE CHECK: Reject any image smaller than 80x80 pixels
      if (!img || img.bitmap.width < 80 || img.bitmap.height < 80) {
        console.warn(`[SKIP - BLANK/CORRUPT IMAGE] Deal ${deal.id} (${deal.title.slice(0, 30)}) has invalid image size ${img ? img.bitmap.width + 'x' + img.bitmap.height : 'null'}. Skipping.`);
        recordPostedDeal(deal);
        continue;
      }

      try {
        // 1. High-resolution square canvas (800x800) for WhatsApp Group full-width photo
        const groupSize = 800;
        const groupCanvas = new Jimp({ width: groupSize, height: groupSize, color: 0xffffffff });
        const groupImg = img.clone();
        groupImg.scaleToFit({ w: 760, h: 760 });
        const gx = Math.round((groupSize - groupImg.bitmap.width) / 2);
        const gy = Math.round((groupSize - groupImg.bitmap.height) / 2);
        groupCanvas.composite(groupImg, gx, gy);
        fullImageBuffer = Buffer.from(await groupCanvas.getBuffer('image/jpeg', { quality: 85 }));

        // 2. Generate 1.91:1 widescreen canvas (500x262) for WhatsApp Channel Hero Card
        const canvasW = 500;
        const canvasH = 262;
        const canvas = new Jimp({ width: canvasW, height: canvasH, color: 0xffffffff });

        // Gracefully scale product image with comfortable margins
        img.scaleToFit({ w: 460, h: 242 });

        // Center product image on pure white canvas
        const x = Math.round((canvasW - img.bitmap.width) / 2);
        const y = Math.round((canvasH - img.bitmap.height) / 2);
        canvas.composite(img, x, y);

        thumbBuffer = Buffer.from(await canvas.getBuffer('image/jpeg', { quality: 80 }));
      } catch (renderErr) {
        console.warn(`[CANVAS RENDER FAILED] Deal ${deal.id}:`, renderErr.message);
      }

      // Strictly require both valid full image and thumbnail before posting
      if (!fullImageBuffer || !thumbBuffer) {
        console.warn(`[SKIP - NO BUFFERS] Deal ${deal.id} canvas buffers missing. Skipping.`);
        recordPostedDeal(deal);
        continue;
      }

      const savings = deal.originalPrice - deal.dealPrice;
      const savingsText = savings > 0 ? ` (Save ${formatINR(savings)})` : '';
      const cleanTitleText = cleanTitle(deal.title);
      const descriptionText = `Deal Price: ${formatINR(deal.dealPrice)} ~${formatINR(deal.originalPrice)}~${savingsText} (${deal.discountPercent}% OFF)`;

      const msgPayload = {
        text: caption,
        linkPreview: {
          'matched-text': dealUrl,
          title: cleanTitleText,
          description: descriptionText,
          jpegThumbnail: thumbBuffer,
        },
      };

      try {
        let postedToChannel = false;
        let postedToGroup = false;

        // 1. Post to Group as Full-Width HD Photo Message (with native card fallback)
        const targetGroup = activeGroupJid || OFFICIAL_GROUP_JID;
        try {
          const groupPayload = fullImageBuffer
            ? { image: fullImageBuffer, caption }
            : (rawImg && rawImg.startsWith('http')
                ? { image: { url: rawImg }, caption }
                : msgPayload);

          await sock.sendMessage(targetGroup, groupPayload);
          postedToGroup = true;
          console.log(`👥 [Group Full Photo] Posted deal: ${deal.title.slice(0, 30)}`);
        } catch (grpErr) {
          console.error(`Failed to post photo to Group (${targetGroup}), fallback to card:`, grpErr.message);
          try {
            await sock.sendMessage(targetGroup, msgPayload);
            postedToGroup = true;
            console.log(`👥 [Group Card Fallback] Posted deal: ${deal.title.slice(0, 30)}`);
          } catch (fallbackErr) {
            console.error(`Group fallback failed:`, fallbackErr.message);
          }
        }

        // Wait 1.5 seconds to let the WebSocket pipeline settle cleanly
        await new Promise((resolve) => setTimeout(resolve, 1500));

        // 2. Post to Channel (Ultra-reliable native linkPreview card over WebSocket)
        try {
          await sock.sendMessage(channelJid, msgPayload);
          postedToChannel = true;
          console.log(`📢 [Channel] Posted deal: ${deal.title.slice(0, 30)}`);
        } catch (chanErr) {
          console.error(`Failed to post to Channel:`, chanErr.message);
        }

        // Wait 2 seconds before Facebook
        await new Promise((resolve) => setTimeout(resolve, 2000));

        // 3. Post to Facebook Page (Smart Anti-Spam Gate)
        if (FB_PAGE_ID && FB_PAGE_ACCESS_TOKEN && !postedToFbThisCycle) {
          const fbCheck = canPostToFacebook(deal);
          if (fbCheck.allowed) {
            try {
              const ok = await postToFacebookPage(deal, caption, fullImageBuffer);
              if (ok) {
                lastFbPostTime = Date.now();
                postedToFbThisCycle = true;
                console.log(`📘 [Facebook Gate] Cooldown started: Next FB post eligible in 2.5 hours.`);
              }
            } catch (fbErr) {
              console.error(`Failed to post to Facebook Page:`, fbErr.message);
            }
          } else {
            console.log(`📘 [Facebook Gate] Skipped FB: ${fbCheck.reason}`);
          }
        }

        // ONLY record deal if it actually got posted to at least one active destination
        if (postedToChannel || postedToGroup || postedToFbThisCycle) {
          recordPostedDeal(deal);
          postedCount++;
          console.log(`✅ [${postedCount}/${toPost.length}] Successfully broadcast deal card: ${deal.id} - ${deal.title.slice(0, 30)}`);
        } else {
          console.warn(`⚠️ Deal ${deal.id} not recorded: All destinations failed. Checking socket health...`);
          if (!isConnected || !activeSock) {
            console.error(`🚨 Fatal WhatsApp socket disconnect during cycle. Triggering instant reconnect...`);
            triggerReconnect(2000);
            break;
          }
        }

        // Wait 10 seconds between posts to keep broadcast clean
        if (postedCount < toPost.length) {
          await new Promise((resolve) => setTimeout(resolve, 10000));
        }
      } catch (postErr) {
        console.error(`Failed to post deal ${deal.id}:`, postErr.message);
        if (
          postErr.message?.includes('Connection Closed') ||
          postErr.message?.includes('connection closed') ||
          postErr.message?.includes('not connected') ||
          postErr.message?.includes('Stream Errored') ||
          postErr.message?.includes('statusCode: 428')
        ) {
          console.error(`🚨 Fatal WhatsApp socket disconnect (${postErr.message}). Triggering instant reconnect...`);
          triggerReconnect(2000);
          break;
        }
      }
    }

    console.log(`✨ Completed check cycle: Successfully posted ${postedCount} deals.`);
    if (postedCount > 0) {
      lastSuccessfulPostTime = Date.now();
    }

    // Trigger background harvest for next cycle after deals are already posted
    try {
      const harvestLimit = currentSource === 'indiadesire' ? 70 : 35;
      const harvestUrl = `https://mizodeals.com/api/multi-scraper?autoPublish=true&source=${currentSource}&limit=${harvestLimit}`;
      fetch(harvestUrl, { signal: AbortSignal.timeout(20000) })
        .then((r) => r.json())
        .then((d) => console.log(`🌾 Background harvest synced: ${d.count || 0} deals (${d.insertedCount || 0} new)`))
        .catch((e) => console.log('🌾 Background sync notice:', e.message));
    } catch (e) {}
  } catch (err) {
    console.error('Error in checkAndPostDeals:', err.message);
  }
}

startBot();
