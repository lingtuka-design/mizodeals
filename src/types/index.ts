export type DealCategory = 
  | 'all'
  | 'shoes_fashion'
  | 'electronics'
  | 'sports'
  | 'home_kitchen'
  | 'gadgets';

export type StoreType = 'amazon' | 'flipkart' | 'hm';

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
  discountPercent: number;
  rating: number;
  ratingsCount: number;
  imageUrl: string;
  affiliateUrl: string;
  isLootDeal?: boolean;
  isExpired?: boolean;
  verifiedAt: string; // e.g., "Updated 20 mins ago"
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

export interface DealsFilterParams {
  category?: DealCategory;
  search?: string;
  sort?: 'discount_desc' | 'price_asc' | 'price_desc' | 'rating_desc' | 'newest';
  lootOnly?: boolean;
  priceRange?: 'all' | 'under_500' | 'under_1500' | 'under_5000' | 'above_5000';
  store?: StoreType | 'all';
}
