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
const SCRAPER_SOURCES = ['telegram', 'dealsmagnet', 'indiadesire', 'all'];
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

function formatMessage(deal, dealUrl = `https://mizodeals.com/deals/${deal.id}`) {
  const savings = deal.originalPrice - deal.dealPrice;
  const savingsText = savings > 0 ? ` (Save ${formatINR(savings)})` : '';
  const lootHeader = deal.isLootDeal || deal.discountPercent >= 50
    ? '🔥 *MAN TLAHNIAM NASA!* 🔥\n'
    : '⚡ *MAN TLAHNIAM!* ⚡\n';

  const title = cleanTitle(deal.title);

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
let reconnectTimer = null;
let autoPostInterval = null;

function triggerReconnect(delayMs = 3000) {
  if (reconnectTimer) return;
  isConnected = false;
  if (activeSock) {
    try {
      activeSock.ev.removeAllListeners();
      activeSock.ws?.close();
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
  console.log('⏰ Auto-post timer scheduled: Every 30 minutes');
  autoPostInterval = setInterval(async () => {
    if (!activeSock || !isConnected) {
      console.log('⏳ Auto-post timer: Bot not connected, attempting reconnect...');
      triggerReconnect(1000);
      return;
    }
    if (isChecking) {
      console.log('⏳ Auto-post timer: Check already in progress, skipping.');
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
  }, 30 * 60 * 1000);
}

// Active WebSocket presence keep-alive every 2 minutes
setInterval(() => {
  if (activeSock && isConnected) {
    activeSock.sendPresenceUpdate('available').catch(() => {});
  }
}, 2 * 60 * 1000);

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
      triggerReconnect(1000);
      return res.end(`<!doctype html><html><body style="font-family:system-ui,sans-serif;text-align:center;padding:50px 20px;background:#FAF9F5;">
        <h2>🔄 Reconnecting WhatsApp Bot...</h2>
        <p>Please wait 5 seconds while the bot reconnects to WhatsApp.</p>
        <script>setTimeout(() => { window.location.href = '/'; }, 5000);</script>
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
        <div>🚀 <b>Bot Build:</b> <span style="background:#dcfce7;color:#15803d;padding:2px 8px;border-radius:6px;font-weight:600;">v2.1-permanent-thumbnails</span></div>
        <div>⏰ <b>Last Post Check:</b> ${lastCheckTime ? lastCheckTime.toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata' }) : 'In Progress...'}</div>
        <div>📦 <b>Total Deals Sent:</b> ${postedCount}</div>
        <div>🔄 <b>Auto Frequency:</b> Every 30 minutes</div>
      </div>

      <div style="display:flex;gap:10px;justify-content:center;flex-wrap:wrap;">
        <a href="/post-now" style="display:inline-block;padding:12px 20px;background:#ea580c;color:white;border-radius:12px;text-decoration:none;font-weight:bold;font-size:14px;box-shadow:0 4px 12px rgba(234,88,12,0.25);">⚡ Post Deals Now</a>
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
            for (const [fname, content] of Object.entries(authData.files)) {
              fs.writeFileSync(path.join(AUTH_DIR, fname), content, 'utf8');
            }
            console.log(`✅ Restored ${Object.keys(authData.files).length} session auth files from Cloudflare D1!`);
          }
        }
      } catch (d1Err) {
        console.warn('⚠️ Cloudflare D1 session restore notice:', d1Err.message);
      }
    }

    const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);

    const sock = makeWASocket({
      auth: state,
      logger: pino({ level: 'silent' }),
      printQRInTerminal: false,
      keepAliveIntervalMs: 25_000,
      connectTimeoutMs: 60_000,
      defaultQueryTimeoutMs: 60_000,
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
        const fileMap = {};
        for (const f of files) {
          if (f.endsWith('.json')) {
            fileMap[f] = fs.readFileSync(path.join(AUTH_DIR, f), 'utf8');
          }
        }
        if (fileMap['creds.json']) {
          await fetch('https://mizodeals.com/api/bot-auth', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ files: fileMap }),
          });
          console.log(`☁️ Synced ${Object.keys(fileMap).length} auth session files to Cloudflare D1!`);
        }
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
        activeSock = null;
        const statusCode = lastDisconnect?.error?.output?.statusCode;
        const isLoggedOut = statusCode === DisconnectReason.loggedOut;
        console.log(`Connection closed (statusCode: ${statusCode}). Logged out: ${isLoggedOut}`);
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
        console.log('======================================================\n');

        syncAllAuthToCloud().catch(() => {});
        ensureAutoPostScheduler();

        setTimeout(async () => {
          if (!isChecking && activeSock) {
            isChecking = true;
            try {
              await checkAndPostDeals(activeSock, CHANNEL_JID);
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

async function checkAndPostDeals(sock, channelJid, maxToPost = 3) {
  if (!sock || !channelJid) return;
  lastCheckTime = new Date();

  const currentSource = SCRAPER_SOURCES[currentSourceIndex % SCRAPER_SOURCES.length];
  currentSourceIndex++;

  console.log(`\n======================================================`);
  console.log(`[${new Date().toLocaleTimeString()}] 🔄 AUTO-HARVEST CYCLE: [${currentSource.toUpperCase()}]`);
  console.log(`======================================================`);

  // Trigger background harvest asynchronously without blocking deal posting
  try {
    const harvestUrl = `https://mizodeals.com/api/multi-scraper?autoPublish=true&source=${currentSource}&limit=40`;
    fetch(harvestUrl, { signal: AbortSignal.timeout(25000) })
      .then((r) => r.json())
      .then((d) => console.log(`🌾 Background harvest synced: ${d.count || 0} deals (${d.insertedCount || 0} new)`))
      .catch((e) => console.log('🌾 Background sync notice:', e.message));
  } catch (e) {}

  // Step 2: Fetch newly synced live deals from database with safe fallback
  console.log(`[${new Date().toLocaleTimeString()}] Checking live unposted loot deals in catalog...`);

  try {
    let res;
    try {
      res = await fetch('https://mizodeals.com/api/deals?status=all&limit=100', { signal: AbortSignal.timeout(8000) });
    } catch (e) {
      console.warn('mizodeals.com API slow, falling back to pages.dev...');
      res = await fetch('https://mizodeals.pages.dev/api/deals?status=all&limit=100', { signal: AbortSignal.timeout(8000) });
    }

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
        d.asin &&
        !d.asin.startsWith('DM') &&
        /^[A-Z0-9]{10}$/i.test(d.asin) &&
        !postedIds.has(d.asin) &&
        (!d.affiliateUrl || (!d.affiliateUrl.includes('/s?k=') && !d.affiliateUrl.includes('/deal/'))) &&
        (d.isLootDeal || d.discountPercent >= 50) &&
        d.imageUrl &&
        d.imageUrl.startsWith('http') &&
        d.imageUrl.length > 15 &&
        !d.imageUrl.includes('unsplash.com') &&
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

    // Select top 2 deals per run (exactly like the reliable dev version)
    const toPost = orderedCandidates.slice(0, 2);
    let postedCount = 0;

    for (const deal of toPost) {

      const dealUrl = `https://mizodeals.com/deals/${deal.id}`;
      const caption = formatMessage(deal, dealUrl);
      console.log(`Evaluating deal: "${deal.title.slice(0, 40)}..." (${deal.discountPercent}% OFF)`);

      let thumbBuffer = null;
      let rawImg = deal.imageUrl || '';
      if (rawImg.includes('dealsmagnet.com/images/') && rawImg.includes('-s-')) {
        rawImg = rawImg.replace('-s-', '-m-');
      }

      let targetImgUrl = null;
      if (deal.asin && /^[A-Z0-9]{10}$/i.test(deal.asin)) {
        targetImgUrl = `https://images-eu.ssl-images-amazon.com/images/P/${deal.asin.toUpperCase()}.01.MAIN._SCRMZZZZZZ_.jpg`;
      }

      // Try Amazon Ultra-HD first, then seamlessly fallback to rawImg
      try {
        let img = null;
        if (targetImgUrl) {
          try {
            img = await Jimp.read(targetImgUrl);
            if (img.bitmap.width <= 2 || img.bitmap.height <= 2) {
              img = null;
            }
          } catch (e) {
            img = null;
          }
        }

        if (!img && rawImg && rawImg.startsWith('http')) {
          img = await Jimp.read(rawImg);
        }

        if (img) {
          img.scaleToFit({ w: 320, h: 320 });
          thumbBuffer = await img.getBuffer('image/jpeg', { quality: 80 });
        }
      } catch (imgErr) {
        console.warn(`[THUMBNAIL NOTICE] Deal ${deal.id}:`, imgErr.message);
      }

      // Strictly require a valid thumbnail before posting so no deal is posted without photo
      if (!thumbBuffer) {
        console.warn(`[SKIP - NO THUMBNAIL] Deal ${deal.id} has no valid thumbnail. Skipping to next deal.`);
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
        await sock.sendMessage(channelJid, msgPayload);
        recordPostedDeal(deal);
        postedCount++;
        console.log(`✅ [${postedCount}/${toPost.length}] Posted deal card: ${deal.id} - ${deal.title.slice(0, 30)}`);

        // Wait 10 seconds between posts to keep channel clean
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
  } catch (err) {
    console.error('Error in checkAndPostDeals:', err.message);
  }
}

startBot();
