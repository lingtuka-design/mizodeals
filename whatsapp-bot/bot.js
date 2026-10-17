import { makeWASocket, useMultiFileAuthState, DisconnectReason } from '@whiskeysockets/baileys';
import pino from 'pino';
import qrcode from 'qrcode-terminal';
import QRCode from 'qrcode';
import http from 'http';
import { Jimp } from 'jimp';
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
const API_URL = 'https://mizodeals.com/api/deals?status=all&limit=200';
const POSTED_FILE = path.join(process.cwd(), 'posted_deals.json');
const AUTH_DIR = path.join(process.cwd(), 'auth_info');
const SCRAPER_SOURCES = ['telegram', 'dealsmagnet', 'all'];
let currentSourceIndex = 0;

// Load already posted deal IDs and ASINs
function getPostedDealIds() {
  try {
    if (fs.existsSync(POSTED_FILE)) {
      const data = JSON.parse(fs.readFileSync(POSTED_FILE, 'utf8'));
      return new Set(Array.isArray(data) ? data : []);
    }
  } catch (e) {
    // fallback
  }
  return new Set();
}

// Record both deal ID and ASIN to guarantee 0 duplicate products
function recordPostedDeal(deal) {
  const ids = Array.from(getPostedDealIds());
  if (deal.id && !ids.includes(deal.id)) ids.push(deal.id);
  if (deal.asin && !ids.includes(deal.asin)) ids.push(deal.asin);
  fs.writeFileSync(POSTED_FILE, JSON.stringify(ids, null, 2));
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

function formatMessage(deal) {
  const savings = deal.originalPrice - deal.dealPrice;
  const savingsText = savings > 0 ? ` (Save ${formatINR(savings)})` : '';
  const lootHeader = deal.isLootDeal || deal.discountPercent >= 50
    ? '🔥 *MAN TLAHNIAM NASA!* 🔥\n'
    : '⚡ *MAN TLAHNIAM!* ⚡\n';

  const title = cleanTitle(deal.title);
  const dealUrl = `https://mizodeals.com/deals/${deal.id}`;

  return (
    `${lootHeader}` +
    `*${title}*\n\n` +
    `💰 Deal Price: *${formatINR(deal.dealPrice)}* ~${formatINR(deal.originalPrice)}~${savingsText}\n` +
    `💥 Discount: *${deal.discountPercent}% OFF*\n` +
    `⭐ Rating: ${deal.rating}/5 (${deal.ratingsCount.toLocaleString('en-IN')}+ reviews)\n` +
    `${deal.couponText ? `🎟️ Coupon: ${deal.couponText}\n` : ''}\n` +
    `👉 *Enna leh Leina (Deal Link):*\n${dealUrl}\n\n` +
    `📲 _Shared via Mizodeals VIP Channel_`
  );
}

const CHANNEL_JID = '120363414138647022@newsletter';
let latestQrDataUrl = null;
let isConnected = false;
let activeSock = null;
let lastCheckTime = null;
let isChecking = false;

// Cloud Web Server for Render/Railway with live status, manual trigger, & Web QR Code
const PORT = process.env.PORT || 3000;
http
  .createServer(async (req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });

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
        await checkAndPostDeals(activeSock, CHANNEL_JID);
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
      const postedCount = getPostedDealIds().size;
      res.end(`<!doctype html>
<html>
  <head><title>Mizodeals Bot — 24/7 Cloud Active</title><meta name="viewport" content="width=device-width,initial-scale=1"></head>
  <body style="font-family:system-ui,sans-serif;text-align:center;padding:40px 20px;background:#FAF9F5;color:#1c1917;">
    <div style="max-width:540px;margin:auto;background:white;padding:30px;border-radius:24px;border:1px solid #EAE6DF;box-shadow:0 10px 25px -5px rgba(0,0,0,0.05);">
      <div style="font-size:42px;margin-bottom:12px;">✅</div>
      <h2 style="color:#16a34a;margin:0 0 10px 0;">Mizodeals Bot Is Running 24/7!</h2>
      <p style="font-size:13px;color:#78716c;">Connected to Official Channel:<br><code style="background:#f5f5f4;padding:4px 8px;border-radius:6px;">120363414138647022@newsletter</code></p>
      
      <div style="margin:20px 0;padding:14px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:16px;text-align:left;font-size:13px;color:#334155;line-height:1.6;">
        <div>⏰ <b>Last Post Check:</b> ${lastCheckTime ? lastCheckTime.toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata' }) : 'In Progress...'}</div>
        <div>📦 <b>Total Deals Sent:</b> ${postedCount}</div>
        <div>🔄 <b>Auto Frequency:</b> Every 30 minutes</div>
      </div>

      <a href="/post-now" style="display:inline-block;padding:12px 24px;background:#ea580c;color:white;border-radius:12px;text-decoration:none;font-weight:bold;font-size:14px;box-shadow:0 4px 12px rgba(234,88,12,0.25);">⚡ Post Deals Now</a>
      <p style="font-size:11px;color:#a8a29e;margin-top:10px;">Runs automatically every 30 mins. Click above to trigger an immediate check.</p>

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
  <body style="font-family:system-ui,sans-serif;text-align:center;padding:50px 20px;background:#FAF9F5;">
    <h3>⏳ Mizodeals Bot Starting Up...</h3>
    <p style="font-size:13px;color:#78716c;">Connecting to WhatsApp network, please wait a few seconds...</p>
    <script>setTimeout(() => location.reload(), 3000);</script>
  </body>
</html>`);
    }
  })
  .listen(PORT, '0.0.0.0', () => {
    console.log(`🌐 Web status server listening on port ${PORT}`);
  });

// Keep Render Free Tier awake
if (process.env.RENDER_EXTERNAL_URL) {
  setInterval(() => {
    fetch(process.env.RENDER_EXTERNAL_URL).catch(() => {});
  }, 14 * 60 * 1000);
}

async function startBot() {
  const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);

  const sock = makeWASocket({
    auth: state,
    logger: pino({ level: 'silent' }),
    printQRInTerminal: false,
  });

  sock.ev.on('creds.update', saveCreds);

  let isChecking = false;

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
      activeSock = null;
      const statusCode = lastDisconnect?.error?.output?.statusCode;
      const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
      console.log(`Connection closed (${statusCode}). Reconnecting: ${shouldReconnect}`);
      if (shouldReconnect) {
        setTimeout(startBot, 4000);
      }
    } else if (connection === 'open') {
      isConnected = true;
      activeSock = sock;
      latestQrDataUrl = null;
      console.log('\n======================================================');
      console.log('✅ WHATSAPP BOT CONNECTED HLAWHTLING TAKIN!');
      console.log(`📢 Official Channel Connected: ${CHANNEL_JID}`);
      console.log('======================================================\n');

      setTimeout(async () => {
        if (!isChecking) {
          isChecking = true;
          await checkAndPostDeals(sock, CHANNEL_JID);
          isChecking = false;
        }
      }, 3000);

      console.log('⏰ Auto-post timer scheduled: Every 30 minutes');
      setInterval(async () => {
        if (!isChecking) {
          isChecking = true;
          await checkAndPostDeals(sock, CHANNEL_JID);
          isChecking = false;
        }
      }, 30 * 60 * 1000);
    }
  });
}

async function checkAndPostDeals(sock, channelJid, maxToPost = 3) {
  if (!sock || !channelJid) return;
  lastCheckTime = new Date();

  const currentSource = SCRAPER_SOURCES[currentSourceIndex % SCRAPER_SOURCES.length];
  currentSourceIndex++;

  console.log(`\n======================================================`);
  console.log(`[${new Date().toLocaleTimeString()}] 🔄 AUTO-HARVEST CYCLE: [${currentSource.toUpperCase()}]`);
  console.log(`======================================================`);

  // Step 1: Auto-scrape from rotated source and auto-publish to D1 with 12s safe timeout
  try {
    const harvestUrl = `https://mizodeals.com/api/multi-scraper?autoPublish=true&source=${currentSource}&limit=40`;
    const harvestRes = await fetch(harvestUrl, { signal: AbortSignal.timeout(12000) });
    if (harvestRes.ok) {
      const harvestData = await harvestRes.json();
      console.log(`🌾 Auto-harvested: ${harvestData.count || 0} deals found from ${currentSource.toUpperCase()} (${harvestData.insertedCount || 0} updated in D1 database).`);
    } else {
      console.warn(`Auto-harvest responded with status: ${harvestRes.status}`);
    }
  } catch (hErr) {
    console.warn('Auto-harvest background sync notice:', hErr.message);
  }

  // Step 2: Fetch newly synced live deals from database with 10s safe timeout
  console.log(`[${new Date().toLocaleTimeString()}] Checking live unposted loot deals in catalog...`);

  try {
    const res = await fetch(API_URL, { signal: AbortSignal.timeout(10000) });
    if (!res.ok) {
      console.error(`Deals API responded with status ${res.status}`);
      return;
    }
    const data = await res.json();
    if (!data.success || !Array.isArray(data.deals)) return;

    const postedIds = getPostedDealIds();

    const candidates = data.deals.filter(
      (d) =>
        !postedIds.has(d.id) &&
        (!d.asin || !postedIds.has(d.asin)) &&
        (d.isLootDeal || d.discountPercent >= 50) &&
        d.imageUrl &&
        d.imageUrl.startsWith('http') &&
        d.imageUrl.length > 15 &&
        !d.imageUrl.includes('unsplash.com') &&
        !d.imageUrl.includes('images-eu.ssl-images-amazon.com') &&
        !d.imageUrl.includes('photo-1523275335684-37898b6baf30')
    );

    console.log(`Found ${candidates.length} unposted candidate loot deals.`);

    // Sort deals by highest discount first so top loot deals get prioritized
    candidates.sort((a, b) => (b.discountPercent || 0) - (a.discountPercent || 0));

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

    let postedCount = 0;

    for (const deal of orderedCandidates) {
      if (postedCount >= maxToPost) break;

      const caption = formatMessage(deal);
      console.log(`Evaluating deal: "${deal.title.slice(0, 40)}..." (${deal.discountPercent}% OFF)`);

      try {
        // WhatsApp Channels / Newsletters strictly require text with URL to render rich cards
        await sock.sendMessage(channelJid, {
          text: caption,
        });
        recordPostedDeal(deal);
        postedCount++;
        console.log(`✅ [${postedCount}/${maxToPost}] Posted deal to WhatsApp Channel: ${deal.id} - ${deal.title.slice(0, 30)}`);

        // Wait 10 seconds between posts to keep channel clean
        if (postedCount < maxToPost) {
          await new Promise((resolve) => setTimeout(resolve, 10000));
        }
      } catch (postErr) {
        console.error(`Failed to post deal ${deal.id}:`, postErr.message);
      }
    }

    console.log(`✨ Completed check cycle: Successfully posted ${postedCount} deals.`);
  } catch (err) {
    console.error('Error in checkAndPostDeals:', err.message);
  }
}

startBot();
