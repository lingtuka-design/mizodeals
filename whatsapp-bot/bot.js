import { makeWASocket, useMultiFileAuthState, DisconnectReason } from '@whiskeysockets/baileys';
import pino from 'pino';
import qrcode from 'qrcode-terminal';
import QRCode from 'qrcode';
import http from 'http';
import { Jimp } from 'jimp';
import fs from 'fs';
import path from 'path';

const CHANNEL_INVITE_CODE = '0029VbE4k2N8fewji3I3Wa0t';
const API_URL = 'https://mizodeals.pages.dev/api/deals?status=all&limit=100';
const POSTED_FILE = path.join(process.cwd(), 'posted_deals.json');
const AUTH_DIR = path.join(process.cwd(), 'auth_info');
const SCRAPER_SOURCES = ['telegram', 'dealsmagnet', 'ifs', 'all'];
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

function formatMessage(deal) {
  const savings = deal.originalPrice - deal.dealPrice;
  const savingsText = savings > 0 ? ` (Save ${formatINR(savings)})` : '';
  const lootHeader = deal.isLootDeal || deal.discountPercent >= 50
    ? '🔥 *MAN TLAHNIAM NASA!* 🔥\n'
    : '⚡ *MAN TLAHNIAM!* ⚡\n';

  const dealUrl = `https://mizodeals.pages.dev/deals/${deal.id}`;

  return (
    `${lootHeader}` +
    `*${deal.title}*\n\n` +
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

// Cloud Web Server for Render/Railway with live status & Web QR Code
const PORT = process.env.PORT || 3000;
http
  .createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    if (isConnected) {
      res.end(`<!doctype html>
<html>
  <head><title>Mizodeals Bot — 24/7 Cloud Active</title><meta name="viewport" content="width=device-width,initial-scale=1"></head>
  <body style="font-family:system-ui,sans-serif;text-align:center;padding:40px 20px;background:#FAF9F5;color:#1c1917;">
    <div style="max-width:480px;margin:auto;background:white;padding:30px;border-radius:24px;border:1px solid #EAE6DF;box-shadow:0 10px 25px -5px rgba(0,0,0,0.05);">
      <div style="font-size:42px;margin-bottom:12px;">✅</div>
      <h2 style="color:#16a34a;margin:0 0 10px 0;">Mizodeals Bot Is Running 24/7!</h2>
      <p style="font-size:13px;color:#78716c;">Connected to Official Channel:<br><code style="background:#f5f5f4;padding:4px 8px;border-radius:6px;">120363414138647022@newsletter</code></p>
      <div style="margin-top:20px;padding:12px;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:12px;font-size:12px;color:#15803d;font-weight:600;">
        ⚡ Rotating Auto-Harvest: Telegram Deals &bull; DealsMagnet &bull; IFS
      </div>
      <p style="font-size:11px;color:#a8a29e;margin-top:16px;">Checking and posting high-discount loot deals every 30 minutes.</p>
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
  .listen(PORT, () => {
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
      const statusCode = lastDisconnect?.error?.output?.statusCode;
      const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
      console.log(`Connection closed (${statusCode}). Reconnecting: ${shouldReconnect}`);
      if (shouldReconnect) {
        setTimeout(startBot, 4000);
      }
    } else if (connection === 'open') {
      isConnected = true;
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

async function checkAndPostDeals(sock, channelJid) {
  if (!sock || !channelJid) return;

  const currentSource = SCRAPER_SOURCES[currentSourceIndex % SCRAPER_SOURCES.length];
  currentSourceIndex++;

  console.log(`\n======================================================`);
  console.log(`[${new Date().toLocaleTimeString()}] 🔄 AUTO-HARVEST CYCLE: [${currentSource.toUpperCase()}]`);
  console.log(`======================================================`);

  // Step 1: Auto-scrape from rotated source and auto-publish to D1 (no manual work needed)
  try {
    const harvestUrl = `https://mizodeals.pages.dev/api/multi-scraper?autoPublish=true&source=${currentSource}&limit=40`;
    const harvestRes = await fetch(harvestUrl);
    if (harvestRes.ok) {
      const harvestData = await harvestRes.json();
      console.log(`🌾 Auto-harvested: ${harvestData.count || 0} deals found from ${currentSource.toUpperCase()} (${harvestData.insertedCount || 0} updated in D1 database).`);
    } else {
      console.warn(`Auto-harvest responded with status: ${harvestRes.status}`);
    }
  } catch (hErr) {
    console.warn('Auto-harvest background sync notice:', hErr.message);
  }

  // Step 2: Fetch newly synced live deals from database
  console.log(`[${new Date().toLocaleTimeString()}] Checking live unposted loot deals in catalog...`);

  try {
    const res = await fetch(API_URL);
    if (!res.ok) return;
    const data = await res.json();
    if (!data.success || !Array.isArray(data.deals)) return;

    const postedIds = getPostedDealIds();

    // Sort deals by highest discount first so top loot deals get prioritized
    newDeals.sort((a, b) => (b.discountPercent || 0) - (a.discountPercent || 0));

    // Multi-Category Diversity Selector: Pick 3 top deals across DIFFERENT categories
    const toPost = [];
    const seenCategories = new Set();

    // Round 1: Pick top deals from unique categories (e.g. 1 Electronics/Gadget, 1 Shoes/Fashion, 1 Home/Kitchen)
    for (const deal of newDeals) {
      if (toPost.length >= 3) break;
      const cat = deal.category || 'general';
      if (!seenCategories.has(cat)) {
        seenCategories.add(cat);
        toPost.push(deal);
      }
    }

    // Round 2: If fewer than 3 categories were available, fill remaining slots with highest discounts
    for (const deal of newDeals) {
      if (toPost.length >= 3) break;
      if (!toPost.includes(deal)) {
        toPost.push(deal);
      }
    }

    console.log(`Selected ${toPost.length} diverse loot deals across categories: [${toPost.map((d) => d.category).join(', ')}]`);

    for (const deal of toPost) {
      const caption = formatMessage(deal);
      const dealUrl = `https://mizodeals.pages.dev/deals/${deal.id}`;
      console.log(`Posting: "${deal.title.slice(0, 40)}..." (${deal.discountPercent}% OFF)`);

      try {
        let linkPreview = undefined;
        if (deal.imageUrl && deal.imageUrl.startsWith('http')) {
          try {
            const img = await Jimp.read(deal.imageUrl);
            img.resize({ w: 200, h: 200 });
            const thumbBuffer = await img.getBuffer('image/jpeg');
            const savings = deal.originalPrice - deal.dealPrice;
            const savingsText = savings > 0 ? ` (Save ${formatINR(savings)})` : '';
            linkPreview = {
              'matched-text': dealUrl,
              title: deal.title,
              description: `Deal Price: ${formatINR(deal.dealPrice)} ~${formatINR(deal.originalPrice)}~${savingsText} (${deal.discountPercent}% OFF)`,
              jpegThumbnail: thumbBuffer,
            };
          } catch (imgErr) {
            console.log(`Thumbnail buffer skipped for ${deal.id}:`, imgErr.message);
          }
        }

        const msgPayload = { text: caption };
        if (linkPreview) {
          msgPayload.linkPreview = linkPreview;
        }

        await sock.sendMessage(channelJid, msgPayload);

        recordPostedDeal(deal);
        console.log(`✅ Posted successfully with thumbnail: ${deal.id} [${deal.asin || 'NO-ASIN'}] - ${deal.title.slice(0, 30)}`);

        // Wait 10 seconds between posts to keep channel clean
        await new Promise((resolve) => setTimeout(resolve, 10000));
      } catch (postErr) {
        console.error(`Failed to post deal ${deal.id}:`, postErr.message);
      }
    }
  } catch (err) {
    console.error('Error in checkAndPostDeals:', err.message);
  }
}

startBot();
