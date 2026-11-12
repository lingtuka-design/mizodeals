import React, { useState, useMemo } from 'react';
import { useSearch, useNavigate } from '@tanstack/react-router';
import { useData } from '../context/DataContext';
import type { Deal, DealCategory, DealsFilterParams, DealsTabMode } from '../types';
import { DealFilters } from '../components/deals/DealFilters';
import { DealGrid } from '../components/deals/DealGrid';
import { DealDetailModal } from '../components/deals/DealDetailModal';
import { PriceAlertModal } from '../components/common/PriceAlertModal';
import { useBookmarks } from '../hooks/useBookmarks';
import { isLootDeal, isNewDeal, isDealExpired } from '../utils/dealLogic';
import { 
  Flame, 
  Zap, 
  ShieldCheck, 
  ArrowRight, 
  MessageCircle
} from 'lucide-react';
import { WHATSAPP_CHANNEL_URL, WHATSAPP_COMMUNITY_MEMBERS, STORE_BADGES } from '../config/constants';

function isMobilePhone(title: string): boolean {
  if (!title) return false;
  const t = title.toLowerCase();
  if (/(?:cover|case|tempered|guard|skin|cable|charger|adapter|pouch|holder|stand|mount|lens\s*protector|stylus|strap|screen\s*protector|earbud|headphone|earphone|neckband|tws|smartwatch|watch|speaker)/i.test(t)) {
    return false;
  }
  return /\b(?:smartphone|mobile\s*phone|5g\s*phone|iphone(?:\s*(?:1[1-7]|se))?|galaxy\s*(?:s\d{2}[a-z]*|m\d{2}[a-z]*|a\d{2}[a-z]*|f\d{2}[a-z]*|z\s*(?:fold|flip)\d*|\w+)|redmi(?:\s*(?:note|\d{1,2}[a-z]*|c\d{1,2}|a\d{1,2}|\w+))?|realme(?:\s*(?:narzo|\d{1,2}[a-z]*|gt|p\d|c\d{1,2}|\w+))?|poco(?:\s*(?:c|m|x|f)\d{1,2}[a-z]*|\w+)?|oneplus(?:\s*(?:nord|\d{1,2}[a-z]?|\w+))?|iqoo(?:\s*(?:z|neo|\d{1,2}[a-z]*|\w+))?|motorola|moto\s*(?:edge|g\d{2})|pixel\s*(?:[6-9]|1[0-2])|vivo\s*(?:t\d|y\d|v\d|x\d|\w+)|oppo\s*(?:a\d|k\d|reno|find|\w+)|nothing\s*phone)\b/i.test(t);
}

export const HomeView: React.FC = () => {
  const { deals } = useData();
  const searchParams = useSearch({ strict: false }) as DealsFilterParams;
  const navigate = useNavigate();

  const { isBookmarked, toggleBookmark } = useBookmarks();

  // Active modal state
  const [selectedDeal, setSelectedDeal] = useState<Deal | null>(null);
  const [alertDeal, setAlertDeal] = useState<Deal | null>(null);

  // Active Feed Tab: 'all' | 'loot' | 'new'
  const activeTab: DealsTabMode = (searchParams.tab as DealsTabMode) || 'all';

  // Filter params with defaults (Default sort is newest so live scraped deals appear on top)
  const activeFilters: DealsFilterParams = useMemo(() => ({
    category: searchParams.category || 'all',
    search: searchParams.search || '',
    sort: searchParams.sort || 'newest',
    lootOnly: activeTab === 'loot' || Boolean(searchParams.lootOnly),
    tab: activeTab,
    priceRange: searchParams.priceRange || 'all',
    store: searchParams.store || 'all',
  }), [searchParams, activeTab]);

  const handleFilterChange = (newFilters: Partial<DealsFilterParams>) => {
    navigate({
      to: '/',
      search: (prev: Record<string, unknown>) => {
        const next: Record<string, unknown> = {
          ...prev,
          ...newFilters,
        };
        // Clean out default / empty values so URL stays completely clean (e.g. https://mizodeals.com/)
        if (!next.category || next.category === 'all') delete next.category;
        if (!next.search) delete next.search;
        if (!next.sort || next.sort === 'newest') delete next.sort;
        if (!next.lootOnly || next.lootOnly === 'false' || next.lootOnly === false) delete next.lootOnly;
        if (!next.tab || next.tab === 'all') delete next.tab;
        if (!next.priceRange || next.priceRange === 'all') delete next.priceRange;
        if (!next.store || next.store === 'all') delete next.store;
        return next;
      },
      resetScroll: false,
      replace: true,
    });
  };

  // Only active deals on the homepage (Expired deals are hidden from public feed per specification)
  const activeDeals = useMemo(() => {
    return deals.filter((deal) => !isDealExpired(deal));
  }, [deals]);

  // Featured Hot Loot Deals (Top Loot Spotlight - swipeable carousel on mobile, responsive grid on desktop)
  const topLootDeals = useMemo(() => {
    return [...activeDeals]
      .filter(isLootDeal)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 6);
  }, [activeDeals]);

  // Whether the Top Loot Deals spotlight section is currently visible on the page
  const isTopLootVisible = useMemo(() => {
    return (!activeFilters.store || activeFilters.store === 'all') && topLootDeals.length > 0;
  }, [activeFilters.store, topLootDeals.length]);

  const topLootDealIds = useMemo(() => {
    return new Set(topLootDeals.map((d) => d.id));
  }, [topLootDeals]);

  const isWinterwear = (deal: Deal) => {
    const t = deal.title.toLowerCase();
    const d = (deal.description || '').toLowerCase();
    const c = deal.category as string;
    if (c === 'winterwear') return true;
    return /hoodie|jacket|sweater|sweatshirt|fleece|winter|thermal|cardigan|coat|muffler|beanie|lukhum|gloves|scarf|woolen/i.test(t) ||
      /hoodie|jacket|sweater|sweatshirt|fleece|winter|thermal|muffler|beanie|gloves/i.test(d);
  };

  // Category counts calculation based on active deals
  const categoryCounts = useMemo(() => {
    const counts: Record<DealCategory, number> = {
      all: 0,
      mobiles: 0,
      winterwear: 0,
      shoes_fashion: 0,
      electronics: 0,
      sports: 0,
      home_kitchen: 0,
      gadgets: 0,
      beauty: 0,
    };

    activeDeals.forEach((deal) => {
      const isPhone = isMobilePhone(deal.title);
      if (isPhone) {
        counts.mobiles++;
      } else {
        counts.all++;
      }
      if (counts[deal.category] !== undefined && !isPhone) {
        counts[deal.category]++;
      }
      if (isWinterwear(deal)) {
        counts.winterwear++;
      }
    });

    return counts;
  }, [activeDeals]);

  // Filtered and sorted deals
  const filteredDeals = useMemo(() => {
    return activeDeals.filter((deal) => {
      // Tab filter
      if (activeTab === 'loot' && !isLootDeal(deal)) {
        return false;
      }
      if (activeTab === 'new' && !isNewDeal(deal, 6)) {
        return false;
      }

      // Store filter
      if (activeFilters.store && activeFilters.store !== 'all') {
        const store = deal.store || 'amazon';
        if (store !== activeFilters.store) return false;
      }

      // Category filter
      if (activeFilters.category && activeFilters.category !== 'all') {
        if (activeFilters.category === 'mobiles') {
          if (!isMobilePhone(deal.title)) return false;
        } else if (activeFilters.category === 'winterwear') {
          if (!isWinterwear(deal)) return false;
        } else if (deal.category !== activeFilters.category || isMobilePhone(deal.title)) {
          return false;
        }
      } else {
        // When viewing default "All Deals" on the Homepage:
        // Exclude mobile phones from the default homepage feed so they don't drown out impulse loots.
        // Users can easily access phones via the "Mobiles" category button or direct search.
        const isExplicitSearch = activeFilters.search && activeFilters.search.trim().length > 0;
        if (!isExplicitSearch && isMobilePhone(deal.title)) {
          return false;
        }
      }

      // Loot deal toggle
      if (activeFilters.lootOnly && !isLootDeal(deal)) {
        return false;
      }

      // Price range
      if (activeFilters.priceRange && activeFilters.priceRange !== 'all') {
        if (activeFilters.priceRange === 'under_500' && deal.dealPrice >= 500) return false;
        if (activeFilters.priceRange === 'under_1500' && (deal.dealPrice < 500 || deal.dealPrice > 1500)) return false;
        if (activeFilters.priceRange === 'under_5000' && (deal.dealPrice < 1500 || deal.dealPrice > 5000)) return false;
        if (activeFilters.priceRange === 'above_5000' && deal.dealPrice <= 5000) return false;
      }

      // Keyword search
      if (activeFilters.search && activeFilters.search.trim()) {
        const query = activeFilters.search.toLowerCase().trim();
        if (query === 'phone' || query === 'phones' || query === 'mobile' || query === 'mobiles' || query === 'smartphone') {
          if (!isMobilePhone(deal.title)) return false;
        } else {
          const inTitle = deal.title.toLowerCase().includes(query);
          const inDesc = deal.description?.toLowerCase().includes(query) ?? false;
          const inCat = deal.category.toLowerCase().includes(query);
          if (!inTitle && !inDesc && !inCat) return false;
        }
      }

      return true;
    }).sort((a, b) => {
      if (activeTab === 'new') {
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      }
      switch (activeFilters.sort) {
        case 'discount_desc':
          return b.discountPercent - a.discountPercent || new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        case 'price_asc':
          return a.dealPrice - b.dealPrice;
        case 'price_desc':
          return b.dealPrice - a.dealPrice;
        case 'rating_desc':
          return b.rating - a.rating;
        case 'newest':
        default:
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      }
    });
  }, [activeDeals, activeFilters, activeTab]);

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-6 py-4 sm:py-6 space-y-4 sm:space-y-6">
      {/* 1. Top Announcement Bar */}
      <div className="bg-blue-50 border border-blue-200/80 rounded-xl px-3.5 py-2.5 flex items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2 min-w-0">
          <span className="bg-[#0369A1] text-white font-extrabold text-[10px] px-2 py-0.5 rounded shrink-0 uppercase tracking-wider">
            Live
          </span>
          <p className="text-stone-800 font-medium truncate">
            <strong>Mizoram's #1 Loot Deals Hub</strong> — Amazon, Meesho, Flipkart, Nykaa &amp; Myntra price drops verified 24x7!
          </p>
        </div>
        <a
          href={WHATSAPP_CHANNEL_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="hidden sm:inline-flex items-center gap-1 text-[#0369A1] hover:text-[#075985] font-bold shrink-0"
        >
          <span>Get WhatsApp Alerts &rarr;</span>
        </a>
      </div>

      {/* 2. IndiaDesire 3D Festive Hero Section (Ocean / Navy Blue Theme) */}
      <section className="relative overflow-hidden rounded-2xl sm:rounded-3xl bg-[#0A192F] text-white min-h-[360px] grid grid-cols-1 lg:grid-cols-12 isolate shadow-md">
        {/* Background 3D Festive Art with Blue Tone Color Filter */}
        <div className="absolute inset-0 -z-10 overflow-hidden">
          <img
            src="/assets/hero/hero.webp"
            alt="MizoDeals Festive Season"
            className="w-full h-full object-cover object-right"
          />
          {/* Blue Tone Color Shift Blend */}
          <div className="absolute inset-0 bg-[#0B2545]/60 mix-blend-color" />
          {/* Deep Navy/Blue Gradient Overlay for high-contrast legible text */}
          <div className="absolute inset-0 bg-gradient-to-r from-[#0A192F] via-[#0A192F]/95 lg:via-[#0A192F]/85 to-transparent" />
        </div>

        {/* Hero Left Content Body */}
        <div className="lg:col-span-7 p-6 sm:p-10 flex flex-col justify-center space-y-4">
          <div className="inline-flex items-center gap-2 bg-white/12 border border-white/20 px-3 py-1 rounded-full text-[11px] sm:text-xs font-bold tracking-wider uppercase text-white w-fit backdrop-blur-xs">
            <span className="w-2 h-2 rounded-full bg-[#38BDF8] animate-pulse" />
            <span>Festive sale season is live</span>
          </div>

          <h1 className="text-2xl sm:text-4xl lg:text-5xl font-black text-white tracking-tight leading-[1.08]">
            Mizoram&rsquo;s smartest way to <em className="not-italic bg-gradient-to-r from-[#FDBA74] to-[#FB923C] bg-clip-text text-transparent">shop for less</em>
          </h1>

          <p className="text-xs sm:text-sm md:text-base text-[#D0E2FF] max-w-xl leading-relaxed">
            Hand-picked loot deals, coupons and bank offers from Amazon, Flipkart, Myntra and 100+ stores &mdash; checked and updated every few minutes.
          </p>

          {/* CTA Action Buttons */}
          <div className="flex flex-wrap items-center gap-3 pt-1">
            <button
              type="button"
              onClick={() => handleFilterChange({ tab: 'loot', lootOnly: true })}
              className="inline-flex items-center gap-2 px-5 py-3 bg-[#E0F2FE] hover:bg-[#BAE6FD] text-[#0369A1] font-extrabold text-xs sm:text-sm rounded-xl transition-all shadow-sm cursor-pointer"
            >
              <span>Browse loot deals</span>
              <ArrowRight className="w-4 h-4" />
            </button>

            <a
              href={WHATSAPP_CHANNEL_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-5 py-3 bg-[#25D366] hover:bg-[#20bd5a] text-stone-950 font-bold text-xs sm:text-sm rounded-xl transition-all shadow-sm"
            >
              <MessageCircle className="w-4 h-4 fill-stone-950" />
              <span>Get WhatsApp alerts</span>
            </a>
          </div>

          {/* Stats Row */}
          <div className="flex flex-wrap items-center gap-4 sm:gap-8 pt-3 text-xs sm:text-sm text-[#A6C8FF] border-t border-white/10">
            <div>
              <b className="block text-lg sm:text-xl font-black text-white">100+</b>
              <span>stores tracked</span>
            </div>
            <div>
              <b className="block text-lg sm:text-xl font-black text-white">2026</b>
              <span>trusted deal hunters</span>
            </div>
            <div>
              <b className="block text-lg sm:text-xl font-black text-white">24&times;7</b>
              <span>price-drop alerts</span>
            </div>
          </div>
        </div>

        {/* Hero Right Floating Event Cards (Flipkart & Amazon Sales) */}
        <div className="hidden lg:flex lg:col-span-5 flex-col justify-center gap-3 p-8">
          <a
            href="#deals"
            onClick={(e) => {
              e.preventDefault();
              handleFilterChange({ store: 'flipkart' });
            }}
            className="flex items-center gap-3 bg-white/95 text-stone-900 rounded-2xl p-3.5 shadow-lg hover:scale-[1.02] transition-transform cursor-pointer"
          >
            <div className="w-12 h-12 rounded-xl bg-blue-100 text-blue-900 flex flex-col items-center justify-center font-black leading-none shrink-0 border border-blue-200">
              <small className="text-[10px] uppercase font-bold text-blue-600">OCT</small>
              <span className="text-base font-black">9</span>
            </div>
            <div>
              <strong className="block text-sm font-bold text-stone-900">Flipkart Big Billion Days</strong>
              <span className="text-xs text-stone-500">Dates, bank offers &amp; best deals list</span>
            </div>
          </a>

          <a
            href="#deals"
            onClick={(e) => {
              e.preventDefault();
              handleFilterChange({ store: 'amazon' });
            }}
            className="flex items-center gap-3 bg-white/95 text-stone-900 rounded-2xl p-3.5 shadow-lg hover:scale-[1.02] transition-transform cursor-pointer"
          >
            <div className="w-12 h-12 rounded-xl bg-amber-100 text-amber-900 flex flex-col items-center justify-center font-black leading-none shrink-0 border border-amber-200">
              <small className="text-[10px] uppercase font-bold text-amber-600">OCT</small>
              <span className="text-base font-black">8</span>
            </div>
            <div>
              <strong className="block text-sm font-bold text-stone-900">Amazon Great Indian Festival</strong>
              <span className="text-xs text-stone-500">SBI offers, early deals &amp; lightning deals</span>
            </div>
          </a>
        </div>
      </section>

      {/* 3. IndiaDesire Section Heading: "Loot Deals Of The Hour" */}
      <div className="flex items-center justify-between pt-2">
        <div className="flex items-center gap-2">
          <h2 className="text-lg sm:text-2xl font-black text-[#C72026] flex items-center gap-1.5 tracking-tight">
            <Flame className="w-5 h-5 sm:w-6 sm:h-6 fill-[#C72026]" />
            <span>
              {activeTab === 'loot' 
                ? 'Loot Deals Of The Hour' 
                : activeFilters.store && activeFilters.store !== 'all'
                ? `${STORE_BADGES[activeFilters.store]?.name || activeFilters.store} Deals`
                : activeFilters.category && activeFilters.category !== 'all'
                ? `${activeFilters.category.replace('_', ' ').toUpperCase()} Deals`
                : 'Loot Deals Of The Hour'}
            </span>
          </h2>
          <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-stone-100 text-stone-700 border border-stone-200">
            {filteredDeals.length} deals
          </span>
        </div>

        {/* Quick Tabs Toggle */}
        <div className="flex items-center gap-1 text-xs">
          <button
            type="button"
            onClick={() => handleFilterChange({ tab: 'all', lootOnly: false })}
            className={`px-3 py-1.5 rounded-lg font-bold transition-all ${
              activeTab === 'all'
                ? 'bg-stone-900 text-white'
                : 'bg-stone-100 hover:bg-stone-200 text-stone-700'
            }`}
          >
            All
          </button>
          <button
            type="button"
            onClick={() => handleFilterChange({ tab: 'loot', lootOnly: true })}
            className={`px-3 py-1.5 rounded-lg font-bold transition-all flex items-center gap-1 ${
              activeTab === 'loot'
                ? 'bg-[#C72026] text-white shadow-xs'
                : 'bg-stone-100 hover:bg-stone-200 text-stone-700'
            }`}
          >
            <Flame className={`w-3 h-3 ${activeTab === 'loot' ? 'fill-white' : 'text-[#C72026]'}`} />
            <span>50%+ Off</span>
          </button>
        </div>
      </div>

      {/* 4. IndiaDesire Deal Filters (Search, Stores, Categories, Sort) */}
      <section className="bg-white border border-stone-200 rounded-xl p-3 sm:p-4 shadow-2xs">
        <DealFilters
          filters={activeFilters}
          onFilterChange={handleFilterChange}
          categoryCounts={categoryCounts}
          totalDealsCount={activeDeals.length}
        />
      </section>

      {/* 5. Main Deals Grid (.dgrid in IndiaDesire: 2-col on mobile, 4-col on desktop) */}
      <DealGrid
        deals={filteredDeals}
        isBookmarked={isBookmarked}
        onToggleBookmark={toggleBookmark}
        onOpenDetails={(deal) => setSelectedDeal(deal)}
        onOpenAlert={(deal) => setAlertDeal(deal)}
        onResetFilters={() => handleFilterChange({ category: 'all', search: '', lootOnly: false, priceRange: 'all', tab: 'all', store: 'all' })}
      />

      {/* Deal Detail Modal */}
      <DealDetailModal
        deal={selectedDeal}
        isOpen={Boolean(selectedDeal)}
        onClose={() => setSelectedDeal(null)}
        isBookmarked={selectedDeal ? isBookmarked(selectedDeal.id) : false}
        onToggleBookmark={toggleBookmark}
        onOpenAlert={(deal) => setAlertDeal(deal)}
      />

      {/* Price Alert Modal */}
      <PriceAlertModal
        deal={alertDeal}
        isOpen={Boolean(alertDeal)}
        onClose={() => setAlertDeal(null)}
      />
    </div>
  );
};
