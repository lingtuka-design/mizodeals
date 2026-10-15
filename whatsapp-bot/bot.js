import { makeWASocket, useMultiFileAuthState, DisconnectReason } from '@whiskeysockets/baileys';
import pino from 'pino';
import qrcode from 'qrcode-terminal';
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
    }

    if (connection === 'close') {
      const statusCode = lastDisconnect?.error?.output?.statusCode;
      const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
      console.log(`Connection closed (${statusCode}). Reconnecting: ${shouldReconnect}`);
      if (shouldReconnect) {
        setTimeout(startBot, 4000);
      }
    } else if (connection === 'open') {
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

    // Prioritize top loot deals (50%+ off or marked isLootDeal)
    // Filter out both deal ID and ASIN so product duplicates are 100% prevented
    const newDeals = data.deals.filter(
      (d) =>
        !postedIds.has(d.id) &&
        (!d.asin || !postedIds.has(d.asin)) &&
        (d.isLootDeal || d.discountPercent >= 50)
    );

    console.log(`Found ${newDeals.length} unposted loot deals available.`);

    // To prevent channel spam, post max 1-2 per 30 minutes
    const toPost = newDeals.slice(0, 2);

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
