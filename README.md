# Mizodeals — Amazon Affiliate & Loot Deals Portal

Curated Amazon India price drops, lightning loot deals, and buying guides tailored for Mizoram & Northeast India.

## Key Links & Endpoints

- **Live Website:** [https://mizodeals.pages.dev](https://mizodeals.pages.dev)
- **Official WhatsApp Channel:** [https://whatsapp.com/channel/0029VbE4k2N8fewji3I3Wa0t](https://whatsapp.com/channel/0029VbE4k2N8fewji3I3Wa0t)
- **24/7 Cloud WhatsApp Bot Dashboard:** [https://mizodeals-whatsapp-bot.onrender.com/](https://mizodeals-whatsapp-bot.onrender.com/)
- **Admin Dashboard:** [https://mizodeals.pages.dev/admin](https://mizodeals.pages.dev/admin)

## Architecture

1. **Frontend & Bridge Pages:** React 19 + TypeScript + Vite + Tailwind CSS deployed on Cloudflare Pages.
2. **Database:** Cloudflare D1 (SQLite at the edge) storing verified deals with automatic deduplication by ASIN.
3. **Multi-Source Scraper:** `functions/api/multi-scraper.ts` scraping live deals across:
   - Telegram Deals (`dealbee`, `shopping_deals`)
   - DealsMagnet (`dealsmagnet.com`)
   - IndiaFreeStuff (`indiafreestuff.in`)
4. **24/7 Autonomous Bot:** Hosted on Render Cloud (`whatsapp-bot/bot.js`):
   - Rotates sources every 30 minutes.
   - Auto-publishes to Cloudflare D1 with Amazon tag `lalmalsawmtlu-21`.
   - Posts to WhatsApp Channel with real Jimp thumbnails and Mizo headers (`🔥 MAN TLAHNIAM NASA! 🔥`).
