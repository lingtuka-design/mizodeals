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
const SCRAPER_SOURCES = ['telegram', 'dealsmagnet', 'indiadesire', 'nykaa', 'all'];
let currentSourceIndex = 0;

// Load already posted deal IDs and ASINs with rolling 40-item window
function getPostedDealIds() {
  try {
    if (fs.existsSync(POSTED_FILE)) {
      const data = JSON.parse(fs.readFileSync(POSTED_FILE, 'utf8'));
      if (Array.isArray(data)) {
        // Cap to recent 30 items so old deals from previous weeks don't permanently freeze posting
        const capped = data.length > 40 ? data.slice(-30) : data;
        return new Set(capped);
      }
    }
  } catch (e) {}
  return new Set();
}

// Record deal ID and ASIN with rolling cap to prevent permanent lockup
function recordPostedDeal(deal) {
  let ids = Array.from(getPostedDealIds());
  if (deal.id && !ids.includes(deal.id)) ids.push(deal.id);
  if (deal.asin && !ids.includes(deal.asin)) ids.push(deal.asin);
  if (ids.length > 50) {
    ids = ids.slice(-40);
  }
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
  const storeEmoji = {
    flipkart: '🛒 *Flipkart*',
    myntra: '👗 *Myntra*',
    nykaa: '💄 *Nykaa*',
    ajio: '🛍️ *Ajio*',
    hm: '👔 *H&M*',
    amazon: '📦 *Amazon.in*'
  }[deal.store || 'amazon'] || '📦 *Amazon.in*';

  return (
    `${lootHeader}` +
    `*${title}*\n\n` +
    `💰 Deal Price: *${formatINR(deal.dealPrice)}* ~${formatINR(deal.originalPrice)}~${savingsText}\n` +
    `💥 Discount: *${deal.discountPercent}% OFF*\n` +
    `🏬 Store: ${storeEmoji}\n` +
    `⭐ Rating: ${deal.rating}/5 (${deal.ratingsCount.toLocaleString('en-IN')}+ reviews)\n` +
    `${deal.couponText ? `🎟️ Coupon: ${deal.couponText}\n` : ''}\n` +
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
let activeGroupJid = null;
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

    if (req.url === '/clear-posted' || req.url === '/reset-posted') {
      console.log('🧹 Clearing posted deals history cache...');
      try {
        fs.writeFileSync(POSTED_FILE, '[]', 'utf8');
      } catch (e) {}
      return res.end(`<!doctype html><html><body style="font-family:system-ui,sans-serif;text-align:center;padding:50px 20px;background:#FAF9F5;">
        <h2>✅ History Cleared!</h2>
        <p>Triggering immediate post of top active loots...</p>
        <script>setTimeout(() => { window.location.href = '/post-now'; }, 1500);</script>
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
        <div>🚀 <b>Bot Build:</b> <span style="background:#dcfce7;color:#15803d;padding:2px 8px;border-radius:6px;font-weight:600;">v2.3-hd-group-photos</span></div>
        <div>⏰ <b>Last Post Check:</b> ${lastCheckTime ? lastCheckTime.toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata' }) : 'In Progress...'}</div>
        <div>📦 <b>Total Deals Sent:</b> ${postedCount}</div>
        <div>🔄 <b>Auto Frequency:</b> Every 30 minutes</div>
        <div>📘 <b>Facebook Page:</b> ${FB_PAGE_ID && FB_PAGE_ACCESS_TOKEN ? '<span style="background:#dbeafe;color:#1e40af;padding:2px 8px;border-radius:6px;font-weight:600;">Active (Smart Anti-Spam: 60%+ Loot Only, 2.5h Cooldown)</span>' : '<span style="background:#f1f5f9;color:#64748b;padding:2px 8px;border-radius:6px;">Waiting for credentials</span>'}</div>
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
            for (const [fname, content] of Object.entries(authData.files)) {
              fs.writeFileSync(path.join(AUTH_DIR, fname), content, 'utf8');
            }
            console.log(`✅ Restored ${Object.keys(authData.files).length} session auth files from Cloudflare D1!`);
            sessionRestoredFromD1 = true;
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
        const jsonFiles = files.filter((f) => f.endsWith('.json'));
        console.log(`☁️ Syncing ${jsonFiles.length} auth session files to Cloudflare D1 in batches...`);
        for (let i = 0; i < jsonFiles.length; i += 40) {
          const chunk = jsonFiles.slice(i, i + 40);
          const fileMap = {};
          for (const f of chunk) {
            fileMap[f] = fs.readFileSync(path.join(AUTH_DIR, f), 'utf8');
          }
          await fetch('https://mizodeals.com/api/bot-auth', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ files: fileMap }),
          });
        }
        console.log(`✅ All ${jsonFiles.length} auth files securely backed up to Cloudflare D1!`);
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

        // Automatically resolve Target Group JID
        try {
          const participatingGroups = await sock.groupFetchAllParticipating();
          for (const [jid, group] of Object.entries(participatingGroups)) {
            console.log(`👥 Found WhatsApp Group: "${group.subject}" (${jid})`);
            activeGroupJid = jid;
          }
          if (!activeGroupJid && GROUP_INVITE_CODE) {
            const inviteInfo = await sock.groupGetInviteInfo(GROUP_INVITE_CODE);
            activeGroupJid = inviteInfo.id;
          }
          console.log(`🎯 Target WhatsApp Group: ${activeGroupJid || 'None'}`);
        } catch (gErr) {
          console.warn('⚠️ Group resolution note:', gErr.message);
        }

        console.log('======================================================\n');

        if (!sessionRestoredFromD1) {
          syncAllAuthToCloud().catch(() => {});
        }
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

  // Ensure target group is resolved
  if (!activeGroupJid && GROUP_INVITE_CODE) {
    try {
      const inviteInfo = await sock.groupGetInviteInfo(GROUP_INVITE_CODE);
      if (inviteInfo && inviteInfo.id) {
        activeGroupJid = inviteInfo.id;
        console.log(`🎯 Target Group JID dynamically resolved: ${activeGroupJid}`);
      }
    } catch (e) {
      try {
        const groups = await sock.groupFetchAllParticipating();
        for (const [jid, group] of Object.entries(groups)) {
          activeGroupJid = jid;
          console.log(`👥 Target Group from participating list: ${activeGroupJid}`);
          break;
        }
      } catch (err) {}
    }
  }

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
        ((d.store && d.store !== 'amazon') || /^[A-Z0-9]{10}$/i.test(d.asin)) &&
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
    let postedToFbThisCycle = false;

    for (const deal of toPost) {

      const dealUrl = `https://mizodeals.com/deals/${deal.id}`;
      const caption = formatMessage(deal, dealUrl);
      console.log(`Evaluating deal: "${deal.title.slice(0, 40)}..." (${deal.discountPercent}% OFF, store: ${deal.store || 'amazon'})`);

      let thumbBuffer = null;
      let fullImageBuffer = null;
      let rawImg = deal.imageUrl || '';
      if (rawImg.includes('dealsmagnet.com/images/') && rawImg.includes('-s-')) {
        rawImg = rawImg.replace('-s-', '-m-');
      }
      if (deal.store === 'flipkart' && rawImg.includes('flixcart.com')) {
        rawImg = rawImg.replace(/\/image\/\d+\/\d+\//, '/image/612/612/');
      }

      let targetImgUrl = null;
      if ((!deal.store || deal.store === 'amazon') && deal.asin && /^[A-Z0-9]{10}$/i.test(deal.asin)) {
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
          // 1. High-resolution square canvas (800x800) for WhatsApp Group full-width photo
          try {
            const groupSize = 800;
            const groupCanvas = new Jimp({ width: groupSize, height: groupSize, color: 0xffffffff });
            const groupImg = img.clone();
            groupImg.scaleToFit({ w: 760, h: 760 });
            const gx = Math.round((groupSize - groupImg.bitmap.width) / 2);
            const gy = Math.round((groupSize - groupImg.bitmap.height) / 2);
            groupCanvas.composite(groupImg, gx, gy);
            fullImageBuffer = await groupCanvas.getBuffer('image/jpeg', { quality: 85 });
          } catch (e) {
            console.warn(`[GROUP IMAGE GENERATION FAILED] Deal ${deal.id}:`, e.message);
          }

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

          thumbBuffer = await canvas.getBuffer('image/jpeg', { quality: 80 });
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
        // 1. Post to Channel (using linkPreview which works reliably on @newsletter)
        try {
          await sock.sendMessage(channelJid, msgPayload);
          console.log(`📢 [Channel] Posted deal: ${deal.title.slice(0, 30)}`);
        } catch (chanErr) {
          console.error(`Failed to post to Channel:`, chanErr.message);
        }

        // 2. Post to Group as Full-Width HD Image Message
        if (activeGroupJid) {
          try {
            const groupPayload = fullImageBuffer
              ? { image: fullImageBuffer, caption }
              : (rawImg && rawImg.startsWith('http')
                  ? { image: { url: rawImg }, caption }
                  : msgPayload);

            await sock.sendMessage(activeGroupJid, groupPayload);
            console.log(`👥 [Group Full Photo] Posted deal: ${deal.title.slice(0, 30)}`);
          } catch (grpErr) {
            console.error(`Failed to post image to Group (${activeGroupJid}), falling back to text:`, grpErr.message);
            try {
              await sock.sendMessage(activeGroupJid, msgPayload);
            } catch (fallbackErr) {
              console.error(`Group fallback also failed:`, fallbackErr.message);
            }
          }
        }

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

        recordPostedDeal(deal);
        postedCount++;
        console.log(`✅ [${postedCount}/${toPost.length}] Successfully broadcast deal card: ${deal.id} - ${deal.title.slice(0, 30)}`);

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
  } catch (err) {
    console.error('Error in checkAndPostDeals:', err.message);
  }
}

startBot();
