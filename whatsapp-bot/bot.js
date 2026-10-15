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

// Load already posted deal IDs
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

function recordPostedDealId(dealId) {
  const ids = Array.from(getPostedDealIds());
  ids.push(dealId);
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
  console.log(`[${new Date().toLocaleTimeString()}] Checking live deals from Mizodeals database...`);

  try {
    const res = await fetch(API_URL);
    if (!res.ok) return;
    const data = await res.json();
    if (!data.success || !Array.isArray(data.deals)) return;

    const postedIds = getPostedDealIds();

    // Prioritize top loot deals (50%+ off or marked isLootDeal)
    const newDeals = data.deals.filter(
      (d) => !postedIds.has(d.id) && (d.isLootDeal || d.discountPercent >= 50)
    );

    console.log(`Found ${newDeals.length} unposted loot deals.`);

    // To prevent channel spam, post max 2-3 per run
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

        recordPostedDealId(deal.id);
        console.log(`✅ Posted successfully with thumbnail: ${deal.id} - ${deal.title.slice(0, 30)}`);

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
