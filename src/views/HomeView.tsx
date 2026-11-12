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

const HERO_CATEGORIES = [
  { id: 'mobiles', label: 'Mobiles', icon: '/assets/hero/cat-mobiles.webp', filter: { category: 'gadgets' as DealCategory } },
  { id: 'flash_sale', label: 'Flash Sale', icon: '/assets/hero/cat-electronics.webp', filter: { tab: 'loot' as DealsTabMode, lootOnly: true } },
  { id: 'shopping', label: 'Shopping', icon: '/assets/hero/cat-fashion.webp', filter: { category: 'shoes_fashion' as DealCategory } },
  { id: 'food', label: 'Food', icon: '/assets/hero/cat-food.webp', filter: { category: 'home_kitchen' as DealCategory } },
  { id: 'grocery', label: 'Grocery', icon: '/assets/hero/cat-grocery.webp', filter: { category: 'home_kitchen' as DealCategory } },
  { id: 'recharge', label: 'Recharge', icon: '/assets/hero/cat-recharge.webp', filter: { category: 'gadgets' as DealCategory } },
  { id: 'travel', label: 'Travel', icon: '/assets/hero/cat-travel.webp', filter: { category: 'shoes_fashion' as DealCategory } },
  { id: 'medicines', label: 'Medicines', icon: '/assets/hero/cat-medicine.webp', filter: { category: 'beauty' as DealCategory } },
];

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
      all: activeDeals.length,
      winterwear: 0,
      shoes_fashion: 0,
      electronics: 0,
      sports: 0,
      home_kitchen: 0,
      gadgets: 0,
      beauty: 0,
    };

    activeDeals.forEach((deal) => {
      if (counts[deal.category] !== undefined) {
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
        if (activeFilters.category === 'winterwear') {
          if (!isWinterwear(deal)) return false;
        } else if (deal.category !== activeFilters.category) {
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
        const inTitle = deal.title.toLowerCase().includes(query);
        const inDesc = deal.description?.toLowerCase().includes(query) ?? false;
        const inCat = deal.category.toLowerCase().includes(query);
        if (!inTitle && !inDesc && !inCat) return false;
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
      {/* 1. IndiaDesire Top Announcement Bar */}
      <div className="bg-red-50 border border-red-200/80 rounded-xl px-3.5 py-2.5 flex items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2 min-w-0">
          <span className="bg-[#C72026] text-white font-extrabold text-[10px] px-2 py-0.5 rounded shrink-0 uppercase tracking-wider">
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
          className="hidden sm:inline-flex items-center gap-1 text-[#C72026] hover:text-[#96141A] font-bold shrink-0"
        >
          <span>Get WhatsApp Alerts &rarr;</span>
        </a>
      </div>

      {/* 2. IndiaDesire 3D Festive Hero Section */}
      <section className="relative overflow-hidden rounded-2xl sm:rounded-3xl bg-[#09241E] text-white min-h-[360px] grid grid-cols-1 lg:grid-cols-12 isolate shadow-md">
        {/* Background 3D Festive Art */}
        <div className="absolute inset-0 -z-10 overflow-hidden">
          <img
            src="/assets/hero/hero.webp"
            alt="IndiaDesire Festive Season"
            className="w-full h-full object-cover object-right"
          />
          {/* Gradient Overlay for high-contrast legible text */}
          <div className="absolute inset-0 bg-gradient-to-r from-[#09241E] via-[#09241E]/95 lg:via-[#09241E]/80 to-transparent" />
        </div>

        {/* Hero Left Content Body */}
        <div className="lg:col-span-7 p-6 sm:p-10 flex flex-col justify-center space-y-4">
          <div className="inline-flex items-center gap-2 bg-white/12 border border-white/20 px-3 py-1 rounded-full text-[11px] sm:text-xs font-bold tracking-wider uppercase text-white w-fit backdrop-blur-xs">
            <span className="w-2 h-2 rounded-full bg-[#FDBA74] animate-pulse" />
            <span>Festive sale season is live</span>
          </div>

          <h1 className="text-2xl sm:text-4xl lg:text-5xl font-black text-white tracking-tight leading-[1.08]">
            India&rsquo;s smartest way to <em className="not-italic bg-gradient-to-r from-[#FDBA74] to-[#FB923C] bg-clip-text text-transparent">shop for less</em>
          </h1>

          <p className="text-xs sm:text-sm md:text-base text-[#CFE5DE] max-w-xl leading-relaxed">
            Hand-picked loot deals, coupons and bank offers from Amazon, Flipkart, Myntra and 100+ stores &mdash; checked and updated every few minutes.
          </p>

          {/* CTA Action Buttons */}
          <div className="flex flex-wrap items-center gap-3 pt-1">
            <button
              type="button"
              onClick={() => handleFilterChange({ tab: 'loot', lootOnly: true })}
              className="inline-flex items-center gap-2 px-5 py-3 bg-[#E6F4EA] hover:bg-[#CEEAD6] text-[#0D652D] font-extrabold text-xs sm:text-sm rounded-xl transition-all shadow-sm cursor-pointer"
            >
              <span>Browse loot deals</span>
              <ArrowRight className="w-4 h-4" />
            </button>

            <a
              href={WHATSAPP_CHANNEL_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-5 py-3 bg-white hover:bg-stone-100 text-stone-900 font-bold text-xs sm:text-sm rounded-xl transition-all shadow-sm"
            >
              <MessageCircle className="w-4 h-4 fill-stone-900" />
              <span>Get WhatsApp alerts</span>
            </a>
          </div>

          {/* Stats Row */}
          <div className="flex flex-wrap items-center gap-4 sm:gap-8 pt-3 text-xs sm:text-sm text-[#B9D6CD] border-t border-white/10">
            <div>
              <b className="block text-lg sm:text-xl font-black text-white">100+</b>
              <span>stores tracked</span>
            </div>
            <div>
              <b className="block text-lg sm:text-xl font-black text-white">Since 2014</b>
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
            <div className="w-12 h-12 rounded-xl bg-orange-100 text-orange-900 flex flex-col items-center justify-center font-black leading-none shrink-0 border border-orange-200">
              <small className="text-[10px] uppercase font-bold text-orange-600">OCT</small>
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

      {/* 3. IndiaDesire 3D Rendered Categories Row */}
      <section aria-label="Shop by category" className="pt-1">
        <div className="grid grid-cols-4 sm:grid-cols-4 md:grid-cols-8 gap-2 sm:gap-3">
          {HERO_CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => handleFilterChange(cat.filter)}
              className="flex flex-col items-center justify-center gap-1.5 p-2.5 sm:p-3 bg-white border border-stone-200 hover:border-red-400 hover:shadow-md hover:-translate-y-1 rounded-2xl transition-all cursor-pointer group text-center"
            >
              <img
                src={cat.icon}
                alt={cat.label}
                className="w-12 h-12 sm:w-16 sm:h-16 object-contain group-hover:scale-105 transition-transform"
                loading="lazy"
              />
              <span className="text-[11px] sm:text-xs font-bold text-stone-800 group-hover:text-[#C72026] transition-colors leading-tight">
                {cat.label}
              </span>
            </button>
          ))}
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
