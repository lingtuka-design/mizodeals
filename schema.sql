-- Initial D1 database schema for Mizodeals
CREATE TABLE IF NOT EXISTS deals (
  id TEXT PRIMARY KEY,
  asin TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  category TEXT NOT NULL,
  store TEXT NOT NULL DEFAULT 'amazon',
  original_price INTEGER NOT NULL,
  deal_price INTEGER NOT NULL,
  current_price INTEGER,
  discount_percent INTEGER NOT NULL,
  rating REAL NOT NULL DEFAULT 4.3,
  ratings_count INTEGER NOT NULL DEFAULT 100,
  image_url TEXT NOT NULL,
  affiliate_url TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  is_loot_deal INTEGER NOT NULL DEFAULT 0,
  coupon_text TEXT,
  description TEXT,
  created_at TEXT NOT NULL,
  last_checked_at TEXT NOT NULL,
  verified_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_deals_status ON deals(status);
CREATE INDEX IF NOT EXISTS idx_deals_category ON deals(category);
CREATE INDEX IF NOT EXISTS idx_deals_created_at ON deals(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_deals_is_loot ON deals(is_loot_deal);

CREATE TABLE IF NOT EXISTS page_views (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  path TEXT NOT NULL,
  visitor_hash TEXT NOT NULL,
  city TEXT,
  region TEXT,
  country TEXT,
  device TEXT,
  referrer TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_pv_created_at ON page_views(created_at);
CREATE INDEX IF NOT EXISTS idx_pv_visitor ON page_views(visitor_hash, created_at);
