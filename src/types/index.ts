export type DealCategory = 
  | 'all'
  | 'shoes_fashion'
  | 'electronics'
  | 'sports'
  | 'home_kitchen'
  | 'gadgets';

export type StoreType = 'amazon' | 'flipkart' | 'hm';

export type DealStatus = 'active' | 'expired';

export interface PricePoint {
  date: string;
  price: number;
}

export interface Deal {
  id: string;
  asin: string;
  title: string;
  category: DealCategory;
  store: StoreType;
  originalPrice: number;
  dealPrice: number;
  currentPrice?: number; // Latest monitored price
  discountPercent: number;
  rating: number;
  ratingsCount: number;
  imageUrl: string;
  affiliateUrl: string;
  status: DealStatus; // 'active' | 'expired'
  isLootDeal?: boolean; // >= 50% discount & >= 4.0 rating & >= 100 ratings
  createdAt: string; // ISO string for "New Deals" tracking (<6 hrs)
  lastCheckedAt?: string; // Price re-check timestamp
  verifiedAt: string; // e.g., "Updated 15 mins ago"
  description?: string;
  highlights?: string[];
  specs?: Record<string, string>;
  priceHistory?: PricePoint[];
  couponText?: string;
  lowestEverPrice?: number;
}

export interface BlogPost {
  id: string;
  slug: string;
  title: string;
  summary: string;
  content: string; // Markdown or rich text
  coverImage: string;
  category: string;
  readTime: string;
  publishedAt: string;
  featuredDealIds: string[]; // Deals embedded inside the review
  author?: {
    name: string;
    avatar: string;
    role: string;
  };
}

export type DealsTabMode = 'all' | 'loot' | 'new' | 'expired';

export interface DealsFilterParams {
  category?: DealCategory;
  search?: string;
  sort?: 'discount_desc' | 'price_asc' | 'price_desc' | 'rating_desc' | 'newest';
  lootOnly?: boolean;
  tab?: DealsTabMode;
  priceRange?: 'all' | 'under_500' | 'under_1500' | 'under_5000' | 'above_5000';
  store?: StoreType | 'all';
}
